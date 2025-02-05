import * as github from '@actions/github'
import { createApiClient } from '@neondatabase/api-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { apiResponse, githubApiResponse } from '../__fixtures__/api-client'
import {
  buildBranch,
  buildListProjectsBranchesResponse,
  buildBranchSchemaResponse,
  buildGitHubComment
} from '../__fixtures__/mocks'
import { diff, summary, SummaryComment, upsertGitHubComment } from '../src/diff'
import { getBranchURL } from '../src/utils'

vi.mock('@actions/github')
vi.mock('@neondatabase/api-client')

const mockClient = {
  listProjectBranches: vi.fn(),
  getProjectBranchSchema: vi.fn()
} satisfies Partial<ReturnType<typeof createApiClient>>

vi.mocked(createApiClient).mockReturnValue(
  mockClient as unknown as ReturnType<typeof createApiClient>
)

const defaultBranch = buildBranch('1', 'branch1')

describe('diff function', () => {
  const projectId = 'test-project'
  const apiKey = 'test-api-key'
  const apiHost = 'https://api.neon.tech'
  const database = 'test-db'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws an error if branches cannot be retrieved', async () => {
    mockClient.listProjectBranches.mockResolvedValueOnce(
      apiResponse(500, buildListProjectsBranchesResponse())
    )

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
    mockClient.listProjectBranches.mockResolvedValueOnce(
      apiResponse(200, buildListProjectsBranchesResponse())
    )

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
    mockClient.listProjectBranches.mockResolvedValueOnce(
      apiResponse(200, buildListProjectsBranchesResponse(defaultBranch))
    )

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
    mockClient.listProjectBranches.mockResolvedValueOnce(
      apiResponse(200, buildListProjectsBranchesResponse(defaultBranch))
    )

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
    mockClient.listProjectBranches.mockResolvedValueOnce(
      apiResponse(
        200,
        buildListProjectsBranchesResponse(
          buildBranch('1', 'branch1', '2'),
          buildBranch('3', 'branch3')
        )
      )
    )

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
    mockClient.listProjectBranches.mockResolvedValueOnce(
      apiResponse(
        200,
        buildListProjectsBranchesResponse(
          buildBranch('1', 'branch1', '2'),
          buildBranch('2', 'branch2')
        )
      )
    )
    mockClient.getProjectBranchSchema.mockResolvedValueOnce(
      apiResponse(500, buildBranchSchemaResponse())
    )

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

  it('returns an empty diff if the schemas are identical', async () => {
    const schemaSQL = 'CREATE TABLE test (id INT);'
    mockClient.listProjectBranches.mockResolvedValueOnce(
      apiResponse(
        200,
        buildListProjectsBranchesResponse(
          buildBranch('1', 'branch1', '2'),
          buildBranch('2', 'branch2')
        )
      )
    )
    mockClient.getProjectBranchSchema
      .mockResolvedValueOnce(
        apiResponse(200, buildBranchSchemaResponse(schemaSQL))
      )
      .mockResolvedValueOnce(
        apiResponse(200, buildBranchSchemaResponse(schemaSQL))
      )

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

    mockClient.listProjectBranches.mockResolvedValueOnce(
      apiResponse(
        200,
        buildListProjectsBranchesResponse(
          buildBranch('1', 'branch1', '2'),
          buildBranch('2', 'branch2')
        )
      )
    )
    mockClient.getProjectBranchSchema
      .mockResolvedValueOnce(
        apiResponse(200, buildBranchSchemaResponse(childSQL))
      )
      .mockResolvedValueOnce(
        apiResponse(200, buildBranchSchemaResponse(parentSQL))
      )

    // Mock crypto.subtle.digest in Vitest
    vi.spyOn(crypto.subtle, 'digest').mockResolvedValueOnce(
      new Uint8Array(
        (String(fakeHash).match(/.{2}/g) || []).map((byte) =>
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
  const compareBranch = buildBranch('1', 'feature-branch', undefined, true)
  const baseBranch = buildBranch('0', 'main', undefined, false)

  const database = 'test-db'
  const projectId = 'project-123'

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2023-01-01T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
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
      `This comment was last updated at Sun, 01 Jan 2023 12:00:00 GMT`
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

  let mockOctokit: ReturnType<typeof github.getOctokit>

  beforeEach(() => {
    mockOctokit = {
      rest: {
        issues: {
          listComments: vi.fn(),
          updateComment: vi.fn(),
          createComment: vi.fn(),
          deleteComment: vi.fn()
        }
      }
    } as unknown as ReturnType<typeof github.getOctokit>

    vi.mocked(github.getOctokit).mockReturnValue(mockOctokit)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('creates a new comment when no matching comment exists', async () => {
    vi.mocked(mockOctokit.rest.issues.listComments).mockResolvedValueOnce(
      githubApiResponse([], 200)
    )
    vi.mocked(mockOctokit.rest.issues.createComment).mockResolvedValueOnce(
      githubApiResponse(
        buildGitHubComment(1, 'http://example.com/new-comment'),
        201
      )
    )

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
    const existingComment = buildGitHubComment(
      123,
      'http://example.com/comment',
      `${DIFF_COMMENT_IDENTIFIER}\n<!--- [diff digest: oldhash] -->\nOld diff content`
    )

    vi.mocked(mockOctokit.rest.issues.listComments).mockResolvedValueOnce(
      githubApiResponse([existingComment], 200)
    )
    vi.mocked(mockOctokit.rest.issues.updateComment).mockResolvedValueOnce(
      githubApiResponse(
        buildGitHubComment(123, 'http://example.com/updated-comment'),
        200
      )
    )

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
    const existingComment = buildGitHubComment(
      123,
      'http://example.com/existing-comment',
      `${DIFF_COMMENT_IDENTIFIER}\n${DIFF_HASH_COMMENT_TEMPLATE.replace('%s', hash)}\nExisting diff content`
    )

    vi.mocked(mockOctokit.rest.issues.listComments).mockResolvedValueOnce(
      githubApiResponse([existingComment], 200)
    )

    const result: SummaryComment = await upsertGitHubComment(token, diff, hash)

    expect(mockOctokit.rest.issues.updateComment).not.toHaveBeenCalled()
    expect(result).toEqual({
      url: 'http://example.com/existing-comment',
      operation: 'noop'
    })
  })

  it('throws an error if updating the comment fails', async () => {
    const existingComment = buildGitHubComment(
      123,
      'http://example.com/existing-comment',
      `${DIFF_COMMENT_IDENTIFIER}\nold hash\nExisting diff content`
    )

    vi.mocked(mockOctokit.rest.issues.listComments).mockResolvedValueOnce(
      githubApiResponse([existingComment], 200)
    )

    vi.mocked(mockOctokit.rest.issues.updateComment).mockRejectedValueOnce(
      new Error('Update failed')
    )

    await expect(upsertGitHubComment(token, diff, hash)).rejects.toThrow(
      `Update failed`
    )
  })

  it('throws an error if creating the comment fails', async () => {
    vi.mocked(mockOctokit.rest.issues.listComments).mockResolvedValueOnce(
      githubApiResponse([], 200)
    )
    vi.mocked(mockOctokit.rest.issues.createComment).mockRejectedValueOnce(
      new Error('Failed to create a comment')
    )

    await expect(upsertGitHubComment(token, diff, hash)).rejects.toThrow(
      'Failed to create a comment'
    )
  })

  it('deletes the comment if the diff is empty and the comment exists', async () => {
    const existingComment = buildGitHubComment(
      123,
      'http://example.com/existing-comment',
      `${DIFF_COMMENT_IDENTIFIER}\n${DIFF_HASH_COMMENT_TEMPLATE.replace('%s', hash)}\nExisting diff content`
    )
    vi.mocked(mockOctokit.rest.issues.listComments).mockResolvedValueOnce(
      githubApiResponse([existingComment], 200)
    )
    vi.mocked(mockOctokit.rest.issues.deleteComment).mockResolvedValueOnce(
      githubApiResponse(void 0 as never, 204)
    )

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
    const existingComment = buildGitHubComment(
      123,
      'http://example.com/existing-comment',
      `${DIFF_COMMENT_IDENTIFIER}\n${DIFF_HASH_COMMENT_TEMPLATE.replace('%s', hash)}\nExisting diff content`
    )
    vi.mocked(mockOctokit.rest.issues.listComments).mockResolvedValueOnce(
      githubApiResponse([existingComment], 200)
    )

    vi.mocked(mockOctokit.rest.issues.deleteComment).mockRejectedValueOnce(
      new Error('Failed to delete comment')
    )

    await expect(upsertGitHubComment(token, '', hash)).rejects.toThrow(
      `Failed to delete comment`
    )
  })

  it('skips comment creation if diff is empty and no comment exists', async () => {
    vi.mocked(mockOctokit.rest.issues.listComments).mockResolvedValueOnce(
      githubApiResponse([], 200)
    )

    const result: SummaryComment = await upsertGitHubComment(token, '', hash)

    expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled()
    expect(result).toEqual({
      operation: 'noop',
      url: undefined
    })
  })
})
