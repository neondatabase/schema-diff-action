import { createApiClient, type Branch } from '@neondatabase/api-client'
import * as github from '@actions/github'

import { diff, summary, SummaryComment, upsertGitHubComment } from '../src/diff'
import { getBranchURL } from '../src/utils'

jest.mock('@actions/github')
jest.mock('@neondatabase/api-client')

const mockClient = {
  listProjectBranches: jest.fn(),
  getProjectBranchSchema: jest.fn()
}
;(createApiClient as jest.Mock).mockReturnValue(mockClient)

describe('diff function', () => {
  const projectId = 'test-project'
  const apiKey = 'test-api-key'
  const apiHost = 'https://api.neon.tech'
  const database = 'test-db'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('throws an error if branches cannot be retrieved', async () => {
    mockClient.listProjectBranches.mockResolvedValueOnce({ status: 500 })

    await expect(
      diff(
        projectId,
        { compare: { type: 'name', value: 'branch1' } },
        apiKey,
        apiHost,
        database
      )
    ).rejects.toThrow(`Failed to list branches for project ${projectId}`)
  })

  it('throws an error if the compare branch is not found', async () => {
    mockClient.listProjectBranches.mockResolvedValueOnce({
      status: 200,
      data: { branches: [] }
    })

    await expect(
      diff(
        projectId,
        { compare: { type: 'name', value: 'branch1' } },
        apiKey,
        apiHost,
        database
      )
    ).rejects.toThrow(`Branch branch1 not found in project ${projectId}`)
  })

  it('throws an error if the base branch is not found', async () => {
    mockClient.listProjectBranches.mockResolvedValueOnce({
      status: 200,
      data: { branches: [{ id: '1', name: 'branch1' }] }
    })

    await expect(
      diff(
        projectId,
        {
          compare: { type: 'name', value: 'branch1' },
          base: { type: 'name', value: 'branch2' }
        },
        apiKey,
        apiHost,
        database
      )
    ).rejects.toThrow(`Branch branch2 not found in project ${projectId}`)
  })

  it('throws an error if the compare branch has no parent and no base branch is provided', async () => {
    mockClient.listProjectBranches.mockResolvedValueOnce({
      status: 200,
      data: { branches: [{ id: '1', name: 'branch1' }] }
    })

    await expect(
      diff(
        projectId,
        { compare: { type: 'name', value: 'branch1' } },
        apiKey,
        apiHost,
        database
      )
    ).rejects.toThrow(`Branch branch1 has no parent`)
  })

  it('throws an error if the parent branch is not found', async () => {
    mockClient.listProjectBranches.mockResolvedValueOnce({
      status: 200,
      data: {
        branches: [
          { id: '1', name: 'branch1', parent_id: '2' },
          { id: '3', name: 'branch3' }
        ]
      }
    })

    await expect(
      diff(
        projectId,
        { compare: { type: 'name', value: 'branch1' } },
        apiKey,
        apiHost,
        database
      )
    ).rejects.toThrow(`Parent branch for branch1 not found`)
  })

  it('throws an error if the child branch schema cannot be retrieved', async () => {
    mockClient.listProjectBranches.mockResolvedValueOnce({
      status: 200,
      data: {
        branches: [
          { id: '1', name: 'branch1', parent_id: '2' },
          { id: '2', name: 'branch2' }
        ]
      }
    })
    mockClient.getProjectBranchSchema.mockResolvedValueOnce({
      status: 500
    })

    await expect(
      diff(
        projectId,
        { compare: { type: 'name', value: 'branch1' } },
        apiKey,
        apiHost,
        database
      )
    ).rejects.toThrow(
      `Failed to get schema for branch branch1 in project ${projectId}`
    )
  })

  it('throws an error if the parent branch schema cannot be retrieved', async () => {
    mockClient.listProjectBranches.mockResolvedValueOnce({
      status: 200,
      data: {
        branches: [
          { id: '1', name: 'branch1', parent_id: '2' },
          { id: '2', name: 'branch2' }
        ]
      }
    })
    mockClient.getProjectBranchSchema
      .mockResolvedValueOnce({
        status: 200,
        data: { sql: 'CREATE TABLE test (id INT);' }
      })
      .mockResolvedValueOnce({ status: 500 })

    await expect(
      diff(
        projectId,
        { compare: { type: 'name', value: 'branch1' } },
        apiKey,
        apiHost,
        database
      )
    ).rejects.toThrow(
      `Failed to get schema for the base branch branch2 in project ${projectId}`
    )
  })

  it('returns an empty diff if the schemas are identical', async () => {
    const schemaSQL = 'CREATE TABLE test (id INT);'
    mockClient.listProjectBranches.mockResolvedValueOnce({
      status: 200,
      data: {
        branches: [
          { id: '1', name: 'branch1', parent_id: '2' },
          { id: '2', name: 'branch2' }
        ]
      }
    })
    mockClient.getProjectBranchSchema
      .mockResolvedValueOnce({
        status: 200,
        data: { sql: schemaSQL }
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { sql: schemaSQL }
      })

    const result = await diff(
      projectId,
      { compare: { type: 'name', value: 'branch1' } },
      apiKey,
      apiHost,
      database
    )

    expect(result.sql).toBe('')
    expect(result.hash).toBe('')
    expect(result.compareBranch.name).toBe('branch1')
    expect(result.baseBranch.name).toBe('branch2')
  })

  it('returns a diff if the schemas are different', async () => {
    const parentSQL = 'CREATE TABLE test (id INT);'
    const childSQL = 'CREATE TABLE test (id INT, name TEXT);'
    const fakeDiff =
      'Index: test-db-schema.sql\n' +
      '===================================================================\n' +
      '--- test-db-schema.sql\tBranch branch2\n' +
      '+++ test-db-schema.sql\tBranch branch1\n' +
      '@@ -1,1 +1,1 @@\n' +
      '-CREATE TABLE test (id INT);\n' +
      '\\ No newline at end of file\n' +
      '+CREATE TABLE test (id INT, name TEXT);\n' +
      '\\ No newline at end of file\n'
    const fakeHash = 'abcd1234'

    // (createPatch as jest.Mock).mockReturnValue(fakeDiff);
    mockClient.listProjectBranches.mockResolvedValueOnce({
      status: 200,
      data: {
        branches: [
          { id: '1', name: 'branch1', parent_id: '2' },
          { id: '2', name: 'branch2' }
        ]
      }
    })
    mockClient.getProjectBranchSchema
      .mockResolvedValueOnce({
        status: 200,
        data: { sql: childSQL }
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { sql: parentSQL }
      })

    // Mock the hashing function to return a fixed hash for consistency in tests
    jest
      .spyOn(global.crypto.subtle, 'digest')
      .mockResolvedValueOnce(
        new Uint8Array(
          (String(fakeHash).match(/.{2}/g) || []).map(byte =>
            parseInt(byte, 16)
          )
        )
      )

    const result = await diff(
      projectId,
      { compare: { type: 'name', value: 'branch1' } },
      apiKey,
      apiHost,
      database
    )

    expect(result.sql).toBe(fakeDiff)
    expect(result.hash).toBe(fakeHash)
    expect(result.compareBranch.name).toBe('branch1')
    expect(result.baseBranch.name).toBe('branch2')
  })
})

// Define constants used in the function for DIFF_COMMENT_IDENTIFIER and DIFF_HASH_COMMENT_TEMPLATE
const DIFF_COMMENT_IDENTIFIER =
  '<!--- [schema diff GitHub action comment identifier] -->'
const DIFF_HASH_COMMENT_TEMPLATE = '<!--- [diff digest: %s] -->'

describe('summary function', () => {
  const compareBranch = {
    id: 'branch-1',
    name: 'feature-branch',
    protected: true
  } as Branch

  const baseBranch = {
    id: 'branch-0',
    name: 'main',
    protected: false
  } as Branch

  const database = 'test-db'
  const projectId = 'project-123'

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2023-01-01T12:00:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns empty summary if there are no schema changes', () => {
    const sql = ''
    const hash = 'abcd1234'

    const result = summary(
      sql,
      hash,
      compareBranch,
      baseBranch,
      database,
      projectId
    )

    expect(result).toBe('')
  })

  it('returns formatted diff when sql is not empty', () => {
    const sql = '--- a.sql\n+++ b.sql\n@@ -1,1 +1,2 @@\n+ name TEXT;'
    const hash = 'abcd1234'

    const result = summary(
      sql,
      hash,
      compareBranch,
      baseBranch,
      database,
      projectId
    )

    expect(result).toContain(DIFF_COMMENT_IDENTIFIER)
    expect(result).toContain(DIFF_HASH_COMMENT_TEMPLATE.replace('%s', hash))
    expect(result).toContain('```diff')
    expect(result).toContain(sql)
    expect(result).toContain('```')
    expect(result).toContain(
      `Schema diff between the compare branch ([${compareBranch.name}]`
    )
    expect(result).toContain(
      `- Base branch: ${baseBranch.name} ([${baseBranch.id}](${getBranchURL(
        projectId,
        baseBranch.id
      )}))`
    )
    expect(result).toContain(
      `- Compare branch: ${compareBranch.name} ([${compareBranch.id}](${getBranchURL(
        projectId,
        compareBranch.id
      )})) 🔒`
    )
    expect(result).toContain(
      `This comment was last updated at 1/1/2023 12:00:00 PM`
    )
  })

  it('handles unprotected compare and base branches correctly', () => {
    const unprotectedCompareBranch = { ...compareBranch, protected: false }
    const unprotectedBaseBranch = { ...baseBranch, protected: false }
    const sql = 'sql content'
    const hash = 'abcd1234'

    const result = summary(
      sql,
      hash,
      unprotectedCompareBranch,
      unprotectedBaseBranch,
      database,
      projectId
    )

    expect(result).toContain(
      `- Base branch: ${unprotectedBaseBranch.name} ([${unprotectedBaseBranch.id}](${getBranchURL(
        projectId,
        unprotectedBaseBranch.id
      )}))`
    )
    expect(result).not.toContain('🔒') // No lock icon since both branches are unprotected
    expect(result).toContain(
      `- Compare branch: ${unprotectedCompareBranch.name} ([${unprotectedCompareBranch.id}](${getBranchURL(
        projectId,
        unprotectedCompareBranch.id
      )}))`
    )
  })
})

describe('upsertGitHubComment function', () => {
  const token = 'test-token'
  const diff = `${DIFF_COMMENT_IDENTIFIER}\n${DIFF_HASH_COMMENT_TEMPLATE.replace('%s', 'abcd1234')}\nSome diff content`
  const hash = 'abcd1234'

  const mockContext = {
    repo: { owner: 'test-owner', repo: 'test-repo' },
    issue: { number: 1 }
  }
  // @ts-expect-error - mock github context
  github.context = mockContext

  let mockOctokit: jest.Mocked<ReturnType<typeof github.getOctokit>>

  beforeEach(() => {
    mockOctokit = {
      rest: {
        issues: {
          listComments: jest.fn(),
          updateComment: jest.fn(),
          createComment: jest.fn(),
          deleteComment: jest.fn()
        }
      }
    } as unknown as jest.Mocked<ReturnType<typeof github.getOctokit>>
    ;(github.getOctokit as jest.Mock).mockReturnValue(mockOctokit)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('creates a new comment when no matching comment exists', async () => {
    // eslint-disable-next-line no-extra-semi
    ;(
      mockOctokit.rest.issues.listComments as unknown as jest.Mock
    ).mockResolvedValueOnce({ data: [] })
    ;(
      mockOctokit.rest.issues.createComment as unknown as jest.Mock
    ).mockResolvedValueOnce({
      status: 201,
      data: { html_url: 'http://example.com/new-comment' }
    })

    const result: SummaryComment = await upsertGitHubComment(token, diff, hash)

    expect(mockOctokit.rest.issues.listComments).toHaveBeenCalledWith({
      ...mockContext.repo,
      issue_number: mockContext.issue.number
    })
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
      ...mockContext.repo,
      issue_number: mockContext.issue.number,
      body: diff
    })
    expect(result).toEqual({
      url: 'http://example.com/new-comment',
      operation: 'created'
    })
  })

  it('updates an existing comment when the hash has changed', async () => {
    const existingComment = {
      id: 123,
      body: `${DIFF_COMMENT_IDENTIFIER}\n<!--- [diff digest: oldhash] -->\nOld diff content`,
      html_url: 'http://example.com/existing-comment'
    }
    ;(
      mockOctokit.rest.issues.listComments as unknown as jest.Mock
    ).mockResolvedValueOnce({ data: [existingComment] })
    ;(
      mockOctokit.rest.issues.updateComment as unknown as jest.Mock
    ).mockResolvedValueOnce({
      status: 200,
      data: { html_url: 'http://example.com/updated-comment' }
    })

    const result: SummaryComment = await upsertGitHubComment(token, diff, hash)

    expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith({
      ...mockContext.repo,
      comment_id: existingComment.id,
      body: diff
    })
    expect(result).toEqual({
      url: 'http://example.com/updated-comment',
      operation: 'updated'
    })
  })

  it('does not update the comment if the hash matches', async () => {
    const existingComment = {
      id: 123,
      body: `${DIFF_COMMENT_IDENTIFIER}\n${DIFF_HASH_COMMENT_TEMPLATE.replace('%s', hash)}\nExisting diff content`,
      html_url: 'http://example.com/existing-comment'
    }
    ;(
      mockOctokit.rest.issues.listComments as unknown as jest.Mock
    ).mockResolvedValueOnce({ data: [existingComment] })

    const result: SummaryComment = await upsertGitHubComment(token, diff, hash)

    expect(mockOctokit.rest.issues.updateComment).not.toHaveBeenCalled()
    expect(result).toEqual({
      url: 'http://example.com/existing-comment',
      operation: 'noop'
    })
  })

  it('throws an error if updating the comment fails', async () => {
    const existingComment = {
      id: 123,
      body: `${DIFF_COMMENT_IDENTIFIER}\n<!--- [diff digest: oldhash] -->\nOld diff content`,
      html_url: 'http://example.com/existing-comment'
    }
    ;(
      mockOctokit.rest.issues.listComments as unknown as jest.Mock
    ).mockResolvedValueOnce({ data: [existingComment] })
    ;(
      mockOctokit.rest.issues.updateComment as unknown as jest.Mock
    ).mockResolvedValueOnce({ status: 500 })

    await expect(upsertGitHubComment(token, diff, hash)).rejects.toThrow(
      `Failed to update comment ${existingComment.id}`
    )
  })

  it('throws an error if creating the comment fails', async () => {
    // eslint-disable-next-line no-extra-semi
    ;(
      mockOctokit.rest.issues.listComments as unknown as jest.Mock
    ).mockResolvedValueOnce({ data: [] })
    ;(
      mockOctokit.rest.issues.createComment as unknown as jest.Mock
    ).mockResolvedValueOnce({ status: 500 })

    await expect(upsertGitHubComment(token, diff, hash)).rejects.toThrow(
      'Failed to create a comment'
    )
  })

  it('deletes the comment if the diff is empty and the comment exists', async () => {
    const existingComment = {
      id: 123,
      body: `${DIFF_COMMENT_IDENTIFIER}\n${DIFF_HASH_COMMENT_TEMPLATE.replace('%s', hash)}\nExisting diff content`,
      html_url: 'http://example.com/existing-comment'
    }
    ;(
      mockOctokit.rest.issues.listComments as unknown as jest.Mock
    ).mockResolvedValueOnce({ data: [existingComment] })
    ;(
      mockOctokit.rest.issues.deleteComment as unknown as jest.Mock
    ).mockResolvedValueOnce({ status: 204 })

    const result: SummaryComment = await upsertGitHubComment(token, '', hash)

    expect(mockOctokit.rest.issues.deleteComment).toHaveBeenCalledWith({
      ...mockContext.repo,
      comment_id: existingComment.id
    })
    expect(result).toEqual({
      operation: 'deleted',
      url: undefined
    })
  })

  it('throw an error if deleting the comment fails', async () => {
    const existingComment = {
      id: 123,
      body: `${DIFF_COMMENT_IDENTIFIER}\n${DIFF_HASH_COMMENT_TEMPLATE.replace('%s', hash)}\nExisting diff content`,
      html_url: 'http://example.com/existing-comment'
    }
    ;(
      mockOctokit.rest.issues.listComments as unknown as jest.Mock
    ).mockResolvedValueOnce({ data: [existingComment] })
    ;(
      mockOctokit.rest.issues.deleteComment as unknown as jest.Mock
    ).mockResolvedValueOnce({ status: 500 })

    await expect(upsertGitHubComment(token, '', hash)).rejects.toThrow(
      `Failed to delete comment`
    )
  })

  it('skips comment creation if diff is empty and no comment exists', async () => {
    // eslint-disable-next-line no-extra-semi
    ;(
      mockOctokit.rest.issues.listComments as unknown as jest.Mock
    ).mockResolvedValueOnce({ data: [] })

    const result: SummaryComment = await upsertGitHubComment(token, '', hash)

    expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled()
    expect(result).toEqual({
      operation: 'noop',
      url: undefined
    })
  })
})
