import * as github from '@actions/github'
import { createApiClient, type Branch } from '@neondatabase/api-client'
import { createPatch } from 'diff'
import { BranchComparisonInput, getBranchURL, PointInTime } from './utils'
import { version } from './version'

const DIFF_COMMENT_IDENTIFIER =
  '<!--- [schema diff GitHub action comment identifier] -->'
const DIFF_HASH_COMMENT_TEMPLATE = '<!--- [diff digest: %s] -->'

export type BranchDiff = {
  sql: string
  hash: string
  compareBranch: Branch
  baseBranch: Branch
  role: string
  database: string
}

export type SummaryComment = {
  url?: string
  operation: 'created' | 'updated' | 'noop' | 'deleted'
}

export async function diff(
  projectId: string,
  compareBranchInput: BranchComparisonInput,
  apiKey: string,
  apiHost: string,
  username: string,
  database: string,
  pointInTime?: PointInTime
): Promise<BranchDiff> {
  const client = createApiClient({
    apiKey,
    baseURL: apiHost,
    timeout: 60000,
    headers: {
      // action version from the package.json
      'User-Agent': `neon-schema-diff-action v${version}`
    }
  })

  // Get all branches for the project
  const branches = await client.listProjectBranches(projectId)
  if (branches.status !== 200) {
    throw new Error(`Failed to list branches for project ${projectId}`)
  }

  const { compare: compareInput, base: baseInput } = compareBranchInput

  // Find a branch by id or name
  const compareBranch = branches.data?.branches.find(
    branch =>
      branch.id === compareInput.value || branch.name === compareInput.value
  )
  if (!compareBranch) {
    throw new Error(
      `Branch ${compareInput.value} not found in project ${projectId}`
    )
  }

  // Get the parent branch either from the base branch or from the
  // parent of the child branch
  let baseBranch: Branch | undefined
  if (baseInput) {
    baseBranch = branches.data?.branches.find(
      branch => branch.id === baseInput.value || branch.name === baseInput.value
    )
    if (!baseBranch) {
      throw new Error(
        `Branch ${baseInput.value} not found in project ${projectId}`
      )
    }
  } else {
    if (!compareBranch.parent_id) {
      throw new Error(
        `Branch ${compareInput.value} has no parent to compare to, please provide a base branch`
      )
    }

    baseBranch = branches.data?.branches.find(
      branch => branch.id === compareBranch.parent_id
    )
    if (!baseBranch) {
      throw new Error(`Parent branch for ${compareInput.value} not found`)
    }
  }
  const compareSchema = await client.getProjectBranchSchema({
    projectId,
    branchId: compareBranch.id,
    role: username,
    db_name: database,
    lsn: pointInTime?.type === 'lsn' ? pointInTime.value : undefined,
    timestamp: pointInTime?.type === 'timestamp' ? pointInTime.value : undefined
  })
  if (compareSchema.status !== 200) {
    throw new Error(
      `Failed to get schema for branch ${compareInput.value} in project ${projectId}`
    )
  }

  const baseSchema = await client.getProjectBranchSchema({
    projectId,
    branchId: baseBranch.id,
    role: username,
    db_name: database
  })
  if (baseSchema.status !== 200) {
    throw new Error(
      `Failed to get schema for the base branch ${baseInput?.value || baseBranch.name} in project ${projectId}`
    )
  }

  if (compareSchema.data?.sql === baseSchema.data?.sql) {
    return {
      sql: '',
      hash: '',
      compareBranch,
      baseBranch,
      role: username,
      database: database
    }
  }

  const diff = createPatch(
    `${database}-schema.sql`,
    baseSchema.data?.sql || '',
    compareSchema.data?.sql || '',
    `Branch ${baseBranch.name}`,
    `Branch ${compareBranch.name}`
  )

  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(diff)
  )

  const hash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return {
    sql: diff,
    hash: hash,
    compareBranch,
    baseBranch,
    role: username,
    database: database
  }
}

export function summary(
  sql: string,
  hash: string,
  compareBranch: Branch,
  baseBranch: Branch,
  database: string,
  role: string,
  projectId: string
): string {
  if (sql.trim() === '') {
    return ''
  }

  const diffContent = `\`\`\`diff\n${sql}\n\`\`\``

  const compareBranchURL = getBranchURL(projectId, compareBranch.id)
  const baseBranchURL = getBranchURL(projectId, baseBranch.id)

  return `
${DIFF_COMMENT_IDENTIFIER}
${DIFF_HASH_COMMENT_TEMPLATE.replace('%s', hash)}

# <picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/neondatabase/schema-diff-action/refs/heads/main/docs/logos/logo-dark.svg"><img alt="Neon logo" src="https://raw.githubusercontent.com/neondatabase/schema-diff-action/refs/heads/main/docs/logos/logo-light.svg" width="24" height="24"></picture> Neon Schema Diff summary

Schema diff between the compare branch ([${compareBranch.name}](${compareBranchURL})) and the base branch ([${baseBranch.name}](${baseBranchURL})).

- Base branch: ${baseBranch.name} ([${baseBranch.id}](${baseBranchURL})) ${baseBranch.protected ? '🔒' : ''}
- Compare branch: ${compareBranch.name} ([${compareBranch.id}](${compareBranchURL})) ${compareBranch.protected ? '🔒' : ''}
- Database: ${database}
- Role: ${role}

${diffContent}

This comment was last updated at ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
`
}

export async function upsertGitHubComment(
  token: string,
  diff: string,
  hash: string
): Promise<SummaryComment> {
  const { context } = github

  const oktokit = github.getOctokit(token)

  // Search the current pr for the comment
  const comments = await oktokit.rest.issues.listComments({
    ...context.repo,
    issue_number: context.issue.number
  })

  const comment = comments.data.find(comment =>
    comment.body?.includes(DIFF_COMMENT_IDENTIFIER)
  )

  const emptyDiff = diff.trim() === ''

  // If we can find the comment we update it, otherwise we create a new comment
  if (comment) {
    if (emptyDiff) {
      // If the diff is empty, we delete the comment.
      const deletedComment = await oktokit.rest.issues.deleteComment({
        ...context.repo,
        comment_id: comment.id
      })
      if (deletedComment.status !== 204) {
        throw new Error('Failed to delete comment')
      }

      return {
        operation: 'deleted'
      }
    }

    // Before updating the comment, check if the hash is the same, if it is,
    // we don't need to update the comment as the diff hasn't changed
    if (
      comment.body &&
      comment.body.includes(DIFF_HASH_COMMENT_TEMPLATE.replace('%s', hash))
    ) {
      return {
        url: comment.html_url,
        operation: 'noop'
      }
    }

    const updatedComment = await oktokit.rest.issues.updateComment({
      ...context.repo,
      comment_id: comment.id,
      body: diff
    })

    if (updatedComment.status !== 200) {
      throw new Error(`Failed to update comment ${comment.id}`)
    }

    return {
      url: updatedComment.data.html_url,
      operation: 'updated'
    }
  }

  // If the diff is empty, we don't need to create a comment
  if (emptyDiff) {
    return {
      operation: 'noop'
    }
  }

  // Create a new comment
  const createdComment = await oktokit.rest.issues.createComment({
    ...context.repo,
    issue_number: context.issue.number,
    body: diff
  })
  if (createdComment.status !== 201) {
    throw new Error('Failed to create a comment')
  }

  return {
    url: createdComment.data.html_url,
    operation: 'created'
  }
}
