import { vi } from 'vitest'

import type * as core from '@actions/core'

export const debug = vi.fn<
  Parameters<typeof core.debug>,
  ReturnType<typeof core.debug>
>()
export const error = vi.fn<
  Parameters<typeof core.error>,
  ReturnType<typeof core.error>
>()
export const info = vi.fn<
  Parameters<typeof core.info>,
  ReturnType<typeof core.info>
>()
export const getInput = vi.fn<
  Parameters<typeof core.getInput>,
  ReturnType<typeof core.getInput>
>()
export const setOutput = vi.fn<
  Parameters<typeof core.setOutput>,
  ReturnType<typeof core.setOutput>
>()
export const setFailed = vi.fn<
  Parameters<typeof core.setFailed>,
  ReturnType<typeof core.setFailed>
>()
export const warning = vi.fn<
  Parameters<typeof core.warning>,
  ReturnType<typeof core.warning>
>()
