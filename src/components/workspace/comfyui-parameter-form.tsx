import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTranslation } from '@/lib/i18n'
import { listComfyUIWorkflows } from '@/server/functions/comfyui'
import { DEFAULT_FILENAME_TEMPLATE } from '@/server/services/download'

export function ComfyUIParameterForm({
  localParams,
  set,
}: {
  localParams: Record<string, unknown>
  set: (key: string, value: unknown) => void
}) {
  const { t } = useTranslation()

  // Fetch workflows only
  const { data: workflows } = useQuery({
    queryKey: ['comfyui-workflows'],
    queryFn: () => listComfyUIWorkflows(),
    staleTime: 60_000,
  })

  // Auto-select default workflow if none selected
  useEffect(() => {
    if (workflows && workflows.length > 0 && !localParams.workflowId) {
      const defaultWf = workflows.find((wf) => wf.isDefault === 1)
      if (defaultWf) {
        set('workflowId', defaultWf.id)
      } else {
        set('workflowId', workflows[0].id)
      }
    }
  }, [workflows, localParams.workflowId, set])

  return (
    <div className="space-y-4">
      {/* Workflow */}
      <section className="space-y-1.5">
        <Label className="text-sm">{t('comfyuiParams.workflow')}</Label>
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
          <Label className="text-sm">{t('params.seedFixed')}</Label>
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
