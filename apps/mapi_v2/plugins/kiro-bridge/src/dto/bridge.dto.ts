import { z } from 'zod'

const domStepSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('fill'), selector: z.string().min(1), value: z.string() }),
  z.object({ op: z.literal('click'), selector: z.string().min(1) }),
  z.object({
    op: z.literal('waitFor'),
    selector: z.string().min(1),
    timeoutMs: z.number().int().positive().optional(),
  }),
  z.object({ op: z.literal('getText'), selector: z.string().min(1) }),
])

/** Body de `POST /v1/bridge/dom`. */
export const ExecuteDomSchema = z.object({
  tabId: z.number().int(),
  steps: z.array(domStepSchema).min(1),
})
export type ExecuteDomDto = z.infer<typeof ExecuteDomSchema>
