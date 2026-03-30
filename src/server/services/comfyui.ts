import { eq } from 'drizzle-orm'
import { comfyuiWorkflows, settings } from '../db/schema'
import { db } from '../db'
import { createLogger } from './logger'
import { injectParameters } from './comfyui-workflow'
import type { ParameterMapping } from './comfyui-workflow'
import type { GenerationBackend, GenerationResult } from './backend'
import type { ResolvedPrompts } from './prompt'

const log = createLogger('comfyui')

// ─── ComfyUI API helpers ────────────────────────────────────────────────────

function getServerUrl(): string {
  const row = db
    .select()
    .from(settings)
    .where(eq(settings.key, 'comfyui_server_url'))
    .get()
  return row?.value ?? 'http://localhost:8188'
}

function getDefaultWorkflowId(): number | null {
  const row = db
    .select()
    .from(settings)
    .where(eq(settings.key, 'comfyui_default_workflow_id'))
    .get()
  return row?.value ? Number(row.value) : null
}

async function queuePrompt(
  serverUrl: string,
  workflow: unknown,
  clientId: string,
): Promise<string> {
  const response = await fetch(`${serverUrl}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: workflow,
      client_id: clientId,
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`ComfyUI queue prompt failed (${response.status}): ${text.slice(0, 500)}`)
  }

  const data = (await response.json()) as { prompt_id: string }
  return data.prompt_id
}

async function waitForCompletion(
  serverUrl: string,
  promptId: string,
  clientId: string,
  timeoutMs = 300_000,
): Promise<{ images: Array<{ filename: string; subfolder: string; type: string }> }> {
  // Strategy: Use WebSocket to detect completion, then always fetch results from history API.
  // This is more reliable than parsing individual 'executed' messages per node,
  // because 'executed' fires per-node and we might catch a non-SaveImage node first.

  const wsCompleted = await waitForWsSignal(serverUrl, promptId, clientId, timeoutMs)

  if (!wsCompleted) {
    log.warn('ws.timeout', 'WebSocket did not signal completion, trying history')
  }

  // Always fetch final results from history API (most reliable)
  return fetchFromHistory(serverUrl, promptId, 30_000)
}

async function waitForWsSignal(
  serverUrl: string,
  promptId: string,
  clientId: string,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    const wsUrl = serverUrl.replace(/^http/, 'ws')
    let done = false

    const timeout = setTimeout(() => {
      if (!done) { done = true; ws?.close(); resolve(false) }
    }, timeoutMs)

    const finish = (success: boolean) => {
      if (!done) { done = true; clearTimeout(timeout); ws?.close(); resolve(success) }
    }

    let ws: WebSocket | null = null
    try {
      ws = new WebSocket(`${wsUrl}/ws?clientId=${clientId}`)

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as {
            type: string
            data: { prompt_id?: string; node?: string | null; output?: unknown }
          }
          if (msg.data?.prompt_id !== promptId) return

          // 'execution_error' → reject immediately
          if (msg.type === 'execution_error') {
            finish(false)
            return
          }

          // 'execution_cached' → cached nodes, do NOT treat as completion
          if (msg.type === 'execution_cached') {
            return
          }

          // 'executing' with node=null → all nodes finished (most common completion signal)
          if (msg.type === 'executing' && msg.data.node === null) {
            finish(true)
            return
          }

          // 'execution_success' → newer ComfyUI completion signal
          if (msg.type === 'execution_success') {
            finish(true)
            return
          }

          // 'execution_complete' → alternative completion signal
          if (msg.type === 'execution_complete') {
            finish(true)
            return
          }

          // 'executed' with images → node produced output (fallback detection)
          if (msg.type === 'executed') {
            const output = msg.data.output as { images?: unknown[] } | undefined
            if (output?.images && output.images.length > 0) {
              finish(true)
              return
            }
          }
        } catch {
          // Ignore binary progress messages
        }
      }

      ws.onerror = () => finish(false)
      ws.onclose = () => {
        // If not done yet, WS closed early — let history API handle it
        if (!done) { done = true; clearTimeout(timeout); resolve(false) }
      }
    } catch {
      clearTimeout(timeout)
      resolve(false)
    }
  })
}

async function fetchFromHistory(
  serverUrl: string,
  promptId: string,
  timeoutMs: number,
): Promise<{ images: Array<{ filename: string; subfolder: string; type: string }> }> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${serverUrl}/history/${promptId}`)
      if (response.ok) {
        const history = (await response.json()) as Record<
          string,
          { outputs?: Record<string, { images?: Array<{ filename: string; subfolder: string; type: string }> }> }
        >
        const entry = history[promptId]
        if (entry?.outputs) {
          const images: Array<{ filename: string; subfolder: string; type: string }> = []
          for (const output of Object.values(entry.outputs)) {
            if (output.images) images.push(...output.images)
          }
          if (images.length > 0) return { images }
        }
      }
    } catch {
      // Network error, retry
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`ComfyUI: no images found in history after ${timeoutMs / 1000}s`)
}

async function fetchOutputImage(
  serverUrl: string,
  filename: string,
  subfolder: string,
  type: string,
): Promise<Uint8Array> {
  const params = new URLSearchParams({ filename, type: type || 'output' })
  if (subfolder) params.set('subfolder', subfolder)

  log.info('api.fetchImage', 'Fetching output image', { filename, subfolder, type })

  const response = await fetch(`${serverUrl}/view?${params}`)

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Failed to fetch ComfyUI output image: ${response.status} ${text.slice(0, 200)}`)
  }

  return new Uint8Array(await response.arrayBuffer())
}

// ─── Public API helpers ─────────────────────────────────────────────────────

export async function testConnection(serverUrl: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(`${serverUrl}/system_stats`, {
      signal: AbortSignal.timeout(5000),
    })
    if (response.ok) return { valid: true }
    return { valid: false, error: `Server responded with ${response.status}` }
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Connection failed' }
  }
}

export async function getObjectInfo(serverUrl: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${serverUrl}/object_info`, {
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`Failed to get object info: ${response.status}`)
  return response.json() as Promise<Record<string, unknown>>
}

export async function getAvailableModels(serverUrl: string): Promise<string[]> {
  const info = await getObjectInfo(serverUrl)
  const checkpoint = info['CheckpointLoaderSimple'] as {
    input?: { required?: { ckpt_name?: [string[]] } }
  } | undefined
  return checkpoint?.input?.required?.ckpt_name?.[0] ?? []
}

export async function getAvailableSamplers(serverUrl: string): Promise<string[]> {
  const info = await getObjectInfo(serverUrl)
  const ksampler = info['KSampler'] as {
    input?: { required?: { sampler_name?: [string[]] } }
  } | undefined
  return ksampler?.input?.required?.sampler_name?.[0] ?? []
}

export async function getAvailableSchedulers(serverUrl: string): Promise<string[]> {
  const info = await getObjectInfo(serverUrl)
  const ksampler = info['KSampler'] as {
    input?: { required?: { scheduler?: [string[]] } }
  } | undefined
  return ksampler?.input?.required?.scheduler?.[0] ?? []
}

// ─── Reference image upload ─────────────────────────────────────────────────

export async function uploadImage(
  serverUrl: string,
  imageBuffer: Uint8Array,
  filename: string,
  subfolder = '',
  overwrite = true,
): Promise<{ name: string; subfolder: string; type: string }> {
  const formData = new FormData()
  const blob = new Blob([imageBuffer.buffer as ArrayBuffer], { type: 'image/png' })
  formData.append('image', blob, filename)
  if (subfolder) formData.append('subfolder', subfolder)
  formData.append('overwrite', overwrite ? 'true' : 'false')

  const response = await fetch(`${serverUrl}/upload/image`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`ComfyUI image upload failed (${response.status}): ${text.slice(0, 200)}`)
  }

  const result = (await response.json()) as { name: string; subfolder: string; type: string }
  log.info('api.upload', 'Image uploaded to ComfyUI', { filename: result.name, subfolder: result.subfolder })
  return result
}

// ─── ComfyUI Backend implementation ────────────────────────────────────────

class ComfyUIBackend implements GenerationBackend {
  async generate(
    prompts: ResolvedPrompts,
    parameters: Record<string, unknown>,
  ): Promise<GenerationResult> {
    const serverUrl = getServerUrl()

    // Load workflow template
    const workflowId = (parameters.workflowId as number) ?? getDefaultWorkflowId()
    if (!workflowId) {
      throw new Error('ComfyUI 워크플로우가 설정되지 않았습니다')
    }

    const workflowRow = db
      .select()
      .from(comfyuiWorkflows)
      .where(eq(comfyuiWorkflows.id, workflowId))
      .get()
    if (!workflowRow) {
      throw new Error(`ComfyUI workflow not found: ${workflowId}`)
    }

    const workflowJson = JSON.parse(workflowRow.workflowJson)
    const mapping = JSON.parse(workflowRow.parameterMapping || '{}') as ParameterMapping

    // Build combined prompt text
    const characterPromptText = prompts.characterPrompts
      .map((cp) => cp.prompt)
      .filter(Boolean)
      .join(', ')
    const positivePrompt = [prompts.generalPrompt, characterPromptText]
      .filter(Boolean)
      .join(', ')

    const characterNegText = prompts.characterPrompts
      .map((cp) => cp.negative)
      .filter(Boolean)
      .join(', ')
    const negativePrompt = [prompts.negativePrompt, characterNegText]
      .filter(Boolean)
      .join(', ')

    // Determine seed
    const seed = (parameters.seed as number) ?? Math.floor(Math.random() * 2 ** 32)

    // Inject parameters into workflow
    const preparedWorkflow = injectParameters(
      workflowJson,
      {
        seed,
        steps: parameters.steps as number | undefined,
        cfg: parameters.scale as number | undefined,
        samplerName: parameters.sampler as string | undefined,
        scheduler: parameters.scheduler as string | undefined,
        width: parameters.width as number | undefined,
        height: parameters.height as number | undefined,
        checkpointName: parameters.comfyuiModel as string | undefined,
        positivePrompt,
        negativePrompt,
      },
      mapping,
    )

    // Queue the workflow
    const clientId = crypto.randomUUID()

    log.info('api.request', 'Sending ComfyUI prompt', {
      serverUrl,
      workflowId,
      seed,
    })

    const fetchStart = Date.now()
    const promptId = await queuePrompt(serverUrl, preparedWorkflow, clientId)

    log.info('api.queued', 'ComfyUI prompt queued', { promptId })

    // Wait for completion
    const result = await waitForCompletion(serverUrl, promptId, clientId)
    const fetchDuration = Date.now() - fetchStart

    if (result.images.length === 0) {
      throw new Error('ComfyUI returned no images')
    }

    // Fetch the first output image
    const firstImage = result.images[0]
    const imageData = await fetchOutputImage(
      serverUrl,
      firstImage.filename,
      firstImage.subfolder,
      firstImage.type,
    )

    log.info('api.response', 'ComfyUI generation complete', {
      promptId,
      durationMs: fetchDuration,
      imageSizeBytes: imageData.byteLength,
    })

    return { imageData, seed }
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createComfyUIBackend(): GenerationBackend {
  return new ComfyUIBackend()
}
