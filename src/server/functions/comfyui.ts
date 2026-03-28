import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { comfyuiWorkflows } from '../db/schema'
import {
  testConnection,
  getAvailableModels,
  getAvailableSamplers,
  getAvailableSchedulers,
} from '../services/comfyui'
import {
  autoDetectMapping,
  validateWorkflow,
} from '../services/comfyui-workflow'
import { createLogger } from '../services/logger'

const log = createLogger('fn.comfyui')

// ─── Connection ─────────��─────────────────────────────���─────────────────────

export const validateComfyUIConnection = createServerFn({ method: 'POST' })
  .inputValidator((serverUrl: string) => serverUrl)
  .handler(async ({ data: serverUrl }) => {
    return testConnection(serverUrl)
  })

// ─── Dynamic options from ComfyUI server ────────────────────────────────────

export const fetchComfyUIModels = createServerFn({ method: 'POST' })
  .inputValidator((serverUrl: string) => serverUrl)
  .handler(async ({ data: serverUrl }) => {
    try {
      const models = await getAvailableModels(serverUrl)
      return { models, error: null }
    } catch (err) {
      return { models: [], error: err instanceof Error ? err.message : 'Failed to fetch models' }
    }
  })

export const fetchComfyUISamplers = createServerFn({ method: 'POST' })
  .inputValidator((serverUrl: string) => serverUrl)
  .handler(async ({ data: serverUrl }) => {
    try {
      const samplers = await getAvailableSamplers(serverUrl)
      return { samplers, error: null }
    } catch (err) {
      return { samplers: [], error: err instanceof Error ? err.message : 'Failed to fetch samplers' }
    }
  })

export const fetchComfyUISchedulers = createServerFn({ method: 'POST' })
  .inputValidator((serverUrl: string) => serverUrl)
  .handler(async ({ data: serverUrl }) => {
    try {
      const schedulers = await getAvailableSchedulers(serverUrl)
      return { schedulers, error: null }
    } catch (err) {
      return { schedulers: [], error: err instanceof Error ? err.message : 'Failed to fetch schedulers' }
    }
  })

// ─── Workflow CRUD ──────────────────────────────────────────────────────────

export const listComfyUIWorkflows = createServerFn({ method: 'GET' }).handler(
  async () => {
    return db.select().from(comfyuiWorkflows).all()
  },
)

export const getComfyUIWorkflow = createServerFn({ method: 'GET' })
  .inputValidator((id: number) => id)
  .handler(async ({ data: id }) => {
    return db.select().from(comfyuiWorkflows).where(eq(comfyuiWorkflows.id, id)).get() ?? null
  })

export const createComfyUIWorkflow = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: { name: string; description?: string; workflowJson: string }) => data,
  )
  .handler(async ({ data }) => {
    // Parse and validate
    let parsed: unknown
    try {
      parsed = JSON.parse(data.workflowJson)
    } catch {
      return { success: false, error: 'Invalid JSON format' }
    }

    const validation = validateWorkflow(parsed)
    if (!validation.valid) {
      return { success: false, error: validation.errors.join('; ') }
    }

    // Auto-detect parameter mapping
    const mapping = autoDetectMapping(parsed)

    const result = db
      .insert(comfyuiWorkflows)
      .values({
        name: data.name,
        description: data.description ?? null,
        workflowJson: data.workflowJson,
        parameterMapping: JSON.stringify(mapping),
      })
      .run()

    log.info('workflow.create', 'ComfyUI workflow created', {
      id: result.lastInsertRowid,
      name: data.name,
      mapping,
    })

    return { success: true, id: Number(result.lastInsertRowid), mapping }
  })

export const updateComfyUIWorkflow = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      id: number
      name?: string
      description?: string
      workflowJson?: string
      parameterMapping?: string
      isDefault?: boolean
    }) => data,
  )
  .handler(async ({ data }) => {
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    }

    if (data.name !== undefined) updates.name = data.name
    if (data.description !== undefined) updates.description = data.description
    if (data.parameterMapping !== undefined) updates.parameterMapping = data.parameterMapping

    if (data.workflowJson !== undefined) {
      let parsed: unknown
      try {
        parsed = JSON.parse(data.workflowJson)
      } catch {
        return { success: false, error: 'Invalid JSON format' }
      }

      const validation = validateWorkflow(parsed)
      if (!validation.valid) {
        return { success: false, error: validation.errors.join('; ') }
      }

      updates.workflowJson = data.workflowJson

      // Re-detect mapping if workflow changed and no explicit mapping provided
      if (data.parameterMapping === undefined) {
        updates.parameterMapping = JSON.stringify(autoDetectMapping(parsed))
      }
    }

    if (data.isDefault !== undefined) {
      if (data.isDefault) {
        // Clear other defaults first
        db.update(comfyuiWorkflows)
          .set({ isDefault: 0 })
          .run()
      }
      updates.isDefault = data.isDefault ? 1 : 0
    }

    db.update(comfyuiWorkflows)
      .set(updates)
      .where(eq(comfyuiWorkflows.id, data.id))
      .run()

    log.info('workflow.update', 'ComfyUI workflow updated', { id: data.id })
    return { success: true }
  })

export const deleteComfyUIWorkflow = createServerFn({ method: 'POST' })
  .inputValidator((id: number) => id)
  .handler(async ({ data: id }) => {
    db.delete(comfyuiWorkflows).where(eq(comfyuiWorkflows.id, id)).run()
    log.info('workflow.delete', 'ComfyUI workflow deleted', { id })
    return { success: true }
  })
