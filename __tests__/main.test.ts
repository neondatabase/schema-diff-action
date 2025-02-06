import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as core from '../__fixtures__/core'
import { diff, summary, upsertGitHubComment } from '../__fixtures__/diff'
import {
  buildBranch,
  buildBranchDiff,
  buildSummaryComment
} from '../__fixtures__/mocks'

const { run } = await import('../src/main.js')

vi.mock('@actions/core', () => core)
vi.mock('../src/diff', () => ({
  diff,
  upsertGitHubComment,
  summary
}))

const defaultComment = buildSummaryComment(
  'https://github.com/refactored-giggle/stunning-tribble/pull/2#issuecomment-2450615121',
  'created'
)
const defaultCompareBranch = buildBranch('1', 'dev', '2')
const defaultBaseBranch = buildBranch('2', 'main')
const defaultBranchDiff = buildBranchDiff(
  'CREATE TABLE test_table (id INT PRIMARY KEY);',
  'e5b4c8d3b5b6',
  defaultCompareBranch,
  defaultBaseBranch,
  'neondb'
)

describe('action', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    diff.mockReturnValue(Promise.resolve(defaultBranchDiff))

    upsertGitHubComment.mockReturnValue(Promise.resolve(defaultComment))
  })

  it('invalid api host', async () => {
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'api_host':
          return 'not a url'
        default:
          return ''
      }
    })

    await run()
    expect(core.setFailed).toHaveBeenNthCalledWith(
      1,
      'API host must be a valid URL'
    )
    expect(core.error).not.toHaveBeenCalled()
  })

  it('invalid database input', async () => {
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'api_host':
          return 'https://console.neon.tech/api/v2'
        case 'database':
          return ''
        default:
          return name
      }
    })

    await run()
    expect(core.setFailed).toHaveBeenNthCalledWith(
      1,
      'Database name cannot be empty'
    )
    expect(core.error).not.toHaveBeenCalled()
  })

  it('valid inputs', async () => {
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'api_host':
          return 'https://console.neon.tech/api/v2'
        case 'database':
          return 'neondb'
        case 'timestamp':
        case 'lsn':
          return ''
        default:
          return name
      }
    })

    await run()
    expect(diff).toHaveBeenCalled()
    expect(upsertGitHubComment).toHaveBeenCalled()
    expect(core.setFailed).not.toHaveBeenCalled()
    expect(core.error).not.toHaveBeenCalled()
    expect(core.setOutput).toHaveBeenCalledTimes(2)
    expect(core.setOutput).toHaveBeenNthCalledWith(
      1,
      'diff',
      expect.any(String)
    )
    expect(core.setOutput).toHaveBeenNthCalledWith(
      2,
      'comment_url',
      expect.any(String)
    )
    expect(core.info).toHaveBeenCalledTimes(2)
    expect(core.info).toHaveBeenNthCalledWith(
      1,
      `Comment ${defaultComment.operation} successfully`
    )
    expect(core.info).toHaveBeenNthCalledWith(
      2,
      `Comment URL: ${defaultComment.url}`
    )
  })

  it('valid inputs, noop operation', async () => {
    core.getInput.mockImplementation((name: string) => {
      switch (name) {
        case 'api_host':
          return 'https://console.neon.tech/api/v2'
        case 'database':
          return 'neondb'
        case 'timestamp':
        case 'lsn':
          return ''
        default:
          return name
      }
    })

    upsertGitHubComment.mockReturnValue(
      Promise.resolve({
        ...defaultComment,
        operation: 'noop'
      })
    )

    await run()
    expect(diff).toHaveBeenCalled()
    expect(upsertGitHubComment).toHaveBeenCalled()
    expect(core.setFailed).not.toHaveBeenCalled()
    expect(core.error).not.toHaveBeenCalled()
    expect(core.setOutput).toHaveBeenCalledTimes(2)
    expect(core.setOutput).toHaveBeenNthCalledWith(
      1,
      'diff',
      expect.any(String)
    )
    expect(core.setOutput).toHaveBeenNthCalledWith(
      2,
      'comment_url',
      expect.any(String)
    )
    expect(core.info).toHaveBeenCalledTimes(2)
    expect(core.info).toHaveBeenNthCalledWith(
      1,
      `No changes detected in the schema diff`
    )
    expect(core.info).toHaveBeenNthCalledWith(
      2,
      `Comment URL: ${defaultComment.url}`
    )
  })
})
