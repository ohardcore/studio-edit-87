import { createLogger } from './logger'

const log = createLogger('comfyui-workflow')

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ParameterMapping {
  ksampler?: string
  latentImage?: string
  checkpoint?: string
  positiveClip?: string
  negativeClip?: string
}

interface WorkflowNode {
  class_type: string
  inputs: Record<string, unknown>
  _meta?: { title?: string }
}

type WorkflowJson = Record<string, WorkflowNode>

// ─── Auto-detect parameter mapping ──────────────────────────────────────────

export function autoDetectMapping(workflow: unknown): ParameterMapping {
  const wf = workflow as WorkflowJson
  const mapping: ParameterMapping = {}

  const ksamplers: string[] = []
  const latents: string[] = []
  const checkpoints: string[] = []
  const clipEncoders: string[] = []

  for (const [nodeId, node] of Object.entries(wf)) {
    if (!node.class_type) continue

    switch (node.class_type) {
      case 'KSampler':
      case 'KSamplerAdvanced':
        ksamplers.push(nodeId)
        break
      case 'EmptyLatentImage':
        latents.push(nodeId)
        break
      case 'CheckpointLoaderSimple':
      case 'CheckpointLoader':
        checkpoints.push(nodeId)
        break
      case 'CLIPTextEncode':
        clipEncoders.push(nodeId)
        break
    }
  }

  if (ksamplers.length === 1) mapping.ksampler = ksamplers[0]
  if (latents.length === 1) mapping.latentImage = latents[0]
  if (checkpoints.length === 1) mapping.checkpoint = checkpoints[0]

  // Try to identify positive/negative CLIP encoders by tracing KSampler connections
  if (mapping.ksampler && clipEncoders.length >= 2) {
    const ksNode = wf[mapping.ksampler]
    if (ksNode) {
      // KSampler has 'positive' and 'negative' inputs that reference CLIP encoder nodes
      const posRef = ksNode.inputs.positive
      const negRef = ksNode.inputs.negative
      if (Array.isArray(posRef) && clipEncoders.includes(String(posRef[0]))) {
        mapping.positiveClip = String(posRef[0])
      }
      if (Array.isArray(negRef) && clipEncoders.includes(String(negRef[0]))) {
        mapping.negativeClip = String(negRef[0])
      }
    }
  } else if (clipEncoders.length === 2) {
    // Heuristic: first is positive, second is negative (by node ID order)
    const sorted = clipEncoders.sort((a, b) => Number(a) - Number(b))
    mapping.positiveClip = sorted[0]
    mapping.negativeClip = sorted[1]
  } else if (clipEncoders.length === 1) {
    mapping.positiveClip = clipEncoders[0]
  }

  log.info('autoDetect', 'Auto-detected parameter mapping', {
    ksamplers: ksamplers.length,
    latents: latents.length,
    checkpoints: checkpoints.length,
    clipEncoders: clipEncoders.length,
    mapping,
  })

  return mapping
}

// ─── Inject parameters into workflow ────────────────────────────────────────

export function injectParameters(
  workflow: unknown,
  params: {
    seed?: number
    steps?: number
    cfg?: number
    samplerName?: string
    scheduler?: string
    width?: number
    height?: number
    checkpointName?: string
    positivePrompt?: string
    negativePrompt?: string
  },
  mapping: ParameterMapping,
): unknown {
  // Deep clone to avoid mutating the original
  const wf = JSON.parse(JSON.stringify(workflow)) as WorkflowJson

  // Inject KSampler parameters
  if (mapping.ksampler && wf[mapping.ksampler]) {
    const node = wf[mapping.ksampler]
    if (params.seed !== undefined) node.inputs.seed = params.seed
    if (params.steps !== undefined) node.inputs.steps = params.steps
    if (params.cfg !== undefined) node.inputs.cfg = params.cfg
    if (params.samplerName !== undefined) node.inputs.sampler_name = params.samplerName
    if (params.scheduler !== undefined) node.inputs.scheduler = params.scheduler
  }

  // Inject latent image dimensions
  if (mapping.latentImage && wf[mapping.latentImage]) {
    const node = wf[mapping.latentImage]
    if (params.width !== undefined) node.inputs.width = params.width
    if (params.height !== undefined) node.inputs.height = params.height
  }

  // Inject checkpoint
  if (mapping.checkpoint && wf[mapping.checkpoint]) {
    const node = wf[mapping.checkpoint]
    if (params.checkpointName !== undefined) node.inputs.ckpt_name = params.checkpointName
  }

  // Inject prompts
  if (mapping.positiveClip && wf[mapping.positiveClip]) {
    const node = wf[mapping.positiveClip]
    if (params.positivePrompt !== undefined) node.inputs.text = params.positivePrompt
  }
  if (mapping.negativeClip && wf[mapping.negativeClip]) {
    const node = wf[mapping.negativeClip]
    if (params.negativePrompt !== undefined) node.inputs.text = params.negativePrompt
  }

  return wf
}

// ─── Validate workflow ──────────────────────────────────────────────────────

export function validateWorkflow(workflow: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!workflow || typeof workflow !== 'object') {
    errors.push('Workflow must be a JSON object')
    return { valid: false, errors }
  }

  // Detect UI format (has "nodes" array) vs API format (flat node dictionary)
  const wfObj = workflow as Record<string, unknown>
  if (Array.isArray(wfObj.nodes)) {
    errors.push(
      'This is a ComfyUI UI format workflow. Please export as API format instead: ' +
      'In ComfyUI, enable "Dev mode options" in Settings, then use "Save (API Format)" from the menu.',
    )
    return { valid: false, errors }
  }

  const wf = workflow as WorkflowJson
  const entries = Object.entries(wf)

  if (entries.length === 0) {
    errors.push('Workflow has no nodes')
    return { valid: false, errors }
  }

  let hasKSampler = false
  let hasSaveImage = false

  for (const [nodeId, node] of entries) {
    if (!node.class_type) {
      errors.push(`Node "${nodeId}" is missing class_type`)
      continue
    }
    if (node.class_type === 'KSampler' || node.class_type === 'KSamplerAdvanced') {
      hasKSampler = true
    }
    if (node.class_type === 'SaveImage' || node.class_type === 'PreviewImage') {
      hasSaveImage = true
    }
  }

  if (!hasKSampler) {
    errors.push('Workflow must contain at least one KSampler node')
  }
  if (!hasSaveImage) {
    errors.push('Workflow must contain a SaveImage or PreviewImage node')
  }

  return { valid: errors.length === 0, errors }
}
