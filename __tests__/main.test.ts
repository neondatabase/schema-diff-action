/**
 * Unit tests for the action's main functionality, src/main.ts
 */

import * as core from '@actions/core'

// @ts-nocheck

import * as main from '../src/main'
import { diff, upsertGitHubComment, SummaryComment } from '../src/diff'
import { Branch } from '@neondatabase/api-client'

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

// Mock the GitHub Actions core library
let infoMock: jest.SpiedFunction<typeof core.info>
let errorMock: jest.SpiedFunction<typeof core.error>
let getInputMock: jest.SpiedFunction<typeof core.getInput>
let setFailedMock: jest.SpiedFunction<typeof core.setFailed>
let setOutputMock: jest.SpiedFunction<typeof core.setOutput>

// Mock diff functions
jest.mock('../src/diff')

let diffMock: jest.SpiedFunction<typeof diff>
let upsertGitHubCommentMock: jest.SpiedFunction<typeof upsertGitHubComment>

const mockedUpsertGitHubCommentResult: SummaryComment = {
  url: 'https://github.com/refactored-giggle/stunning-tribble/pull/2#issuecomment-2450615121',
  operation: 'created'
}

const mockedDiffResult = {
  sql: 'CREATE TABLE test_table (id INT PRIMARY KEY);',
  hash: 'e5b4c8d3b5b6',
  compareBranch: {
    id: '1',
    name: 'dev',
    parent_id: '2'
  } as Branch,
  baseBranch: {
    id: '2',
    name: 'main'
  } as Branch,
  database: 'neondb'
}

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    infoMock = jest.spyOn(core, 'info').mockImplementation()
    errorMock = jest.spyOn(core, 'error').mockImplementation()
    getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
    setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
    setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation()

    diffMock = jest
      .mocked(diff)
      .mockReturnValue(Promise.resolve(mockedDiffResult))

    upsertGitHubCommentMock = jest
      .mocked(upsertGitHubComment)
      .mockReturnValue(Promise.resolve(mockedUpsertGitHubCommentResult))
  })

  it('invalid api host', async () => {
    getInputMock.mockImplementation((name: string) => {
      switch (name) {
        case 'api_host':
          return 'not a url'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()
    expect(setFailedMock).toHaveBeenNthCalledWith(
      1,
      'API host must be a valid URL'
    )
    expect(errorMock).not.toHaveBeenCalled()
  })

  it('invalid database input', async () => {
    getInputMock.mockImplementation((name: string) => {
      switch (name) {
        case 'api_host':
          return 'https://console.neon.tech/api/v2'
        case 'database':
          return ''
        default:
          return name
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()
    expect(setFailedMock).toHaveBeenNthCalledWith(
      1,
      'Database name cannot be empty'
    )
    expect(errorMock).not.toHaveBeenCalled()
  })

  it('valid inputs', async () => {
    getInputMock.mockImplementation((name: string) => {
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

    await main.run()
    expect(runMock).toHaveReturned()
    expect(diffMock).toHaveBeenCalled()
    expect(upsertGitHubCommentMock).toHaveBeenCalled()
    expect(setFailedMock).not.toHaveBeenCalled()
    expect(errorMock).not.toHaveBeenCalled()
    expect(setOutputMock).toHaveBeenCalledTimes(2)
    expect(setOutputMock).toHaveBeenNthCalledWith(1, 'diff', expect.any(String))
    expect(setOutputMock).toHaveBeenNthCalledWith(
      2,
      'comment_url',
      expect.any(String)
    )
    expect(infoMock).toHaveBeenCalledTimes(2)
    expect(infoMock).toHaveBeenNthCalledWith(
      1,
      `Comment ${mockedUpsertGitHubCommentResult.operation} successfully`
    )
    expect(infoMock).toHaveBeenNthCalledWith(
      2,
      `Comment URL: ${mockedUpsertGitHubCommentResult.url}`
    )
  })

  it('valid inputs, noop operation', async () => {
    getInputMock.mockImplementation((name: string) => {
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

    upsertGitHubCommentMock.mockReturnValue(
      Promise.resolve({
        ...mockedUpsertGitHubCommentResult,
        operation: 'noop'
      })
    )

    await main.run()
    expect(runMock).toHaveReturned()
    expect(diffMock).toHaveBeenCalled()
    expect(upsertGitHubCommentMock).toHaveBeenCalled()
    expect(setFailedMock).not.toHaveBeenCalled()
    expect(errorMock).not.toHaveBeenCalled()
    expect(setOutputMock).toHaveBeenCalledTimes(2)
    expect(setOutputMock).toHaveBeenNthCalledWith(1, 'diff', expect.any(String))
    expect(setOutputMock).toHaveBeenNthCalledWith(
      2,
      'comment_url',
      expect.any(String)
    )
    expect(infoMock).toHaveBeenCalledTimes(2)
    expect(infoMock).toHaveBeenNthCalledWith(
      1,
      `No changes detected in the schema diff`
    )
    expect(infoMock).toHaveBeenNthCalledWith(
      2,
      `Comment URL: ${mockedUpsertGitHubCommentResult.url}`
    )
  })
})
