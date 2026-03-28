import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useTranslation } from '@/lib/i18n'
import { getSetting } from '@/server/functions/settings'
import {
  listComfyUIWorkflows,
  fetchComfyUIModels,
  fetchComfyUISamplers,
  fetchComfyUISchedulers,
} from '@/server/functions/comfyui'
import { DEFAULT_FILENAME_TEMPLATE } from '@/server/services/download'

// --- Resolution presets (shared with NAI) ---
const RESOLUTION_PRESETS = [
  { key: 'portrait' as const, w: 832, h: 1216 },
  { key: 'landscape' as const, w: 1216, h: 832 },
  { key: 'square' as const, w: 1024, h: 1024 },
  { key: 'wide' as const, w: 1472, h: 832 },
  { key: 'tall' as const, w: 832, h: 1472 },
] as const

function ParamLabel({
  label,
  help,
  value,
}: {
  label: string
  help?: string
  value?: string | number
}) {
  const labelEl = (
    <div className="flex items-center justify-between">
      {help ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Label className="text-sm cursor-help border-b border-dashed border-muted-foreground/40">
              {label}
            </Label>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-52">
            <p className="text-sm">{help}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        <Label className="text-sm">{label}</Label>
      )}
      {value !== undefined && (
        <span className="text-xs tabular-nums text-muted-foreground">
          {value}
        </span>
      )}
    </div>
  )
  return labelEl
}

export function ComfyUIParameterForm({
  localParams,
  set,
}: {
  localParams: Record<string, unknown>
  set: (key: string, value: unknown) => void
}) {
  const { t } = useTranslation()
  const w = Number(localParams.width ?? 832)
  const h = Number(localParams.height ?? 1216)
  const steps = Number(localParams.steps ?? 28)
  const scale = Number(localParams.scale ?? 7)

  const [serverUrl, setServerUrl] = useState<string | null>(null)

  useEffect(() => {
    getSetting({ data: 'comfyui_server_url' }).then((url) =>
      setServerUrl(url ?? 'http://localhost:8188'),
    )
  }, [])

  const activePreset = RESOLUTION_PRESETS.find((p) => p.w === w && p.h === h)

  // Fetch dynamic options from ComfyUI server
  const { data: workflows } = useQuery({
    queryKey: ['comfyui-workflows'],
    queryFn: () => listComfyUIWorkflows(),
    staleTime: 60_000,
  })

  const { data: modelsResult } = useQuery({
    queryKey: ['comfyui-models', serverUrl],
    queryFn: () => fetchComfyUIModels({ data: serverUrl! }),
    enabled: !!serverUrl,
    staleTime: 60_000,
  })

  const { data: samplersResult } = useQuery({
    queryKey: ['comfyui-samplers', serverUrl],
    queryFn: () => fetchComfyUISamplers({ data: serverUrl! }),
    enabled: !!serverUrl,
    staleTime: 60_000,
  })

  const { data: schedulersResult } = useQuery({
    queryKey: ['comfyui-schedulers', serverUrl],
    queryFn: () => fetchComfyUISchedulers({ data: serverUrl! }),
    enabled: !!serverUrl,
    staleTime: 60_000,
  })

  const models = modelsResult?.models ?? []
  const samplers = samplersResult?.samplers ?? []
  const schedulers = schedulersResult?.schedulers ?? []

  return (
    <div className="space-y-4">
      {/* Workflow */}
      <section className="space-y-1.5">
        <ParamLabel
          label={t('comfyuiParams.workflow')}
          help={t('comfyuiParams.workflowHelp')}
        />
        {workflows && workflows.length > 0 ? (
          <Select
            value={String(localParams.workflowId ?? '')}
            onValueChange={(v) => set('workflowId', Number(v))}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder={t('comfyuiParams.workflow')} />
            </SelectTrigger>
            <SelectContent>
              {workflows.map((wf) => (
                <SelectItem key={wf.id} value={String(wf.id)}>
                  {wf.name} {wf.isDefault === 1 ? `(${t('settings.comfyuiWorkflowDefault')})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t('comfyuiParams.noWorkflows')}
          </p>
        )}
      </section>

      {/* Model (Checkpoint) */}
      <section className="space-y-1.5">
        <ParamLabel
          label={t('comfyuiParams.model')}
          help={t('comfyuiParams.modelHelp')}
        />
        {models.length > 0 ? (
          <Select
            value={String(localParams.comfyuiModel ?? '')}
            onValueChange={(v) => set('comfyuiModel', v)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder={t('comfyuiParams.model')} />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-xs text-muted-foreground">
            {serverUrl ? t('comfyuiParams.loadingModels') : t('comfyuiParams.noModels')}
          </p>
        )}
      </section>

      {/* Resolution */}
      <section className="space-y-1.5">
        <ParamLabel
          label={t('params.resolution')}
          value={`${w} × ${h}`}
        />
        <div className="flex flex-wrap gap-1">
          {RESOLUTION_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
                activePreset?.key === p.key
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
              onClick={() => {
                set('width', p.w)
                set('height', p.h)
              }}
            >
              {t(`params.${p.key}` as any)} {p.w}×{p.h}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">W</Label>
            <Input
              type="number"
              min={64}
              max={2048}
              step={64}
              value={w}
              onChange={(e) => set('width', Number(e.target.value))}
              className="h-7 text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">H</Label>
            <Input
              type="number"
              min={64}
              max={2048}
              step={64}
              value={h}
              onChange={(e) => set('height', Number(e.target.value))}
              className="h-7 text-sm tabular-nums"
            />
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="space-y-1.5">
        <ParamLabel label={t('params.steps')} value={steps} />
        <Slider
          value={[steps]}
          onValueChange={([v]) => set('steps', v)}
          min={1}
          max={100}
          step={1}
        />
      </section>

      {/* CFG Scale */}
      <section className="space-y-1.5">
        <ParamLabel label={t('params.scale')} value={scale.toFixed(1)} />
        <Slider
          value={[scale]}
          onValueChange={([v]) => set('scale', v)}
          min={1}
          max={30}
          step={0.5}
        />
      </section>

      {/* Sampler */}
      <section className="space-y-1.5">
        <ParamLabel label={t('params.sampler')} />
        {samplers.length > 0 ? (
          <Select
            value={String(localParams.sampler ?? '')}
            onValueChange={(v) => set('sampler', v)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder={t('params.sampler')} />
            </SelectTrigger>
            <SelectContent>
              {samplers.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-xs text-muted-foreground">{t('comfyuiParams.noModels')}</p>
        )}
      </section>

      {/* Scheduler */}
      <section className="space-y-1.5">
        <ParamLabel label={t('params.scheduler')} />
        {schedulers.length > 0 ? (
          <Select
            value={String(localParams.scheduler ?? '')}
            onValueChange={(v) => set('scheduler', v)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder={t('params.scheduler')} />
            </SelectTrigger>
            <SelectContent>
              {schedulers.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-xs text-muted-foreground">{t('comfyuiParams.noModels')}</p>
        )}
      </section>

      {/* Seed */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="comfyui-seed-fixed"
            checked={localParams.seed != null}
            onCheckedChange={(checked) => {
              if (checked) {
                set('seed', 0)
              } else {
                set('seed', undefined)
              }
            }}
          />
          <ParamLabel label={t('params.seedFixed')} />
        </div>
        {localParams.seed != null ? (
          <Input
            type="number"
            min={0}
            max={4294967295}
            value={String(localParams.seed || 0)}
            onChange={(e) => {
              const v = Math.max(
                0,
                Math.min(4294967295, Math.floor(Number(e.target.value) || 0)),
              )
              set('seed', v)
            }}
            className="h-8 text-sm tabular-nums"
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            {t('params.seedRandom')}
          </p>
        )}
      </section>

      <hr className="border-border" />

      {/* Download Settings */}
      <section className="space-y-2">
        <Label className="text-sm font-medium">
          {t('export.exportSettings')}
        </Label>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t('export.filenameTemplate')}
          </Label>
          <Input
            value={String(
              localParams.filenameTemplate ?? DEFAULT_FILENAME_TEMPLATE,
            )}
            onChange={(e) => set('filenameTemplate', e.target.value)}
            placeholder={DEFAULT_FILENAME_TEMPLATE}
            className="h-8 text-sm font-mono"
          />
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t('export.templateHelp')}
          </p>
        </div>
      </section>
    </div>
  )
}
