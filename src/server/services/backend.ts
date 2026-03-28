import { eq } from 'drizzle-orm'
import { settings } from '../db/schema'
import { db } from '../db'
import { generateImage } from './nai'
import type { ReferenceData } from './nai'
import type { ResolvedPrompts } from './prompt'

// ─── Backend abstraction ────────────────────────────────────────────────────

export type BackendType = 'nai' | 'comfyui'

export interface GenerationResult {
  imageData: Uint8Array
  seed: number
}

export interface GenerationBackend {
  generate(
    prompts: ResolvedPrompts,
    parameters: Record<string, unknown>,
    referenceData?: ReferenceData,
  ): Promise<GenerationResult>
}

// ─── Backend type resolution ────────────────────────────────────────────────

export function getBackendType(): BackendType {
  const row = db
    .select()
    .from(settings)
    .where(eq(settings.key, 'generation_backend'))
    .get()
  const value = row?.value
  if (value === 'comfyui') return 'comfyui'
  return 'nai'
}

// ─── NAI Backend ────────────────────────────────────────────────────────────

class NAIBackend implements GenerationBackend {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async generate(
    prompts: ResolvedPrompts,
    parameters: Record<string, unknown>,
    referenceData?: ReferenceData,
  ): Promise<GenerationResult> {
    return generateImage(this.apiKey, prompts, parameters, referenceData)
  }
}

// ─── Backend factory ────────────────────────────────────────────────────────

export function createNAIBackend(apiKey: string): GenerationBackend {
  return new NAIBackend(apiKey)
}

// ComfyUI backend will be added in Phase 3
// export function createComfyUIBackend(): GenerationBackend { ... }
