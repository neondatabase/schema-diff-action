import { vi } from 'vitest'

import type {
  diff as diffFn,
  summary as summaryFn,
  upsertGitHubComment as upsertFn
} from '../src/diff'

export const diff = vi.fn<
  Parameters<typeof diffFn>,
  ReturnType<typeof diffFn>
>()
export const upsertGitHubComment = vi.fn<
  Parameters<typeof upsertFn>,
  ReturnType<typeof upsertFn>
>()
export const summary = vi.fn<
  Parameters<typeof summaryFn>,
  ReturnType<typeof summaryFn>
>()
