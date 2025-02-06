import {
  Branch,
  CursorPaginationResponse,
  BranchesResponse,
  AnnotationsMapResponse,
  BranchSchemaResponse
} from '@neondatabase/api-client'

import { BranchDiff, SummaryComment } from '../src/diff'

export function buildSummaryComment(
  url: string,
  operation: 'created' | 'updated' | 'deleted'
): SummaryComment {
  return {
    url,
    operation
  }
}

export function buildBranchDiff(
  sql: string,
  hash: string,
  compareBranch: Branch,
  baseBranch: Branch,
  database: string
): BranchDiff {
  return {
    sql,
    hash,
    compareBranch,
    baseBranch,
    database
  }
}

export function buildBranch(
  id: string,
  name: string,
  parentId?: string,
  isProtected?: boolean
): Branch {
  return {
    id,
    name,
    parent_id: parentId,
    project_id: 'test-project',
    current_state: 'active',
    state_changed_at: '2021-01-01T00:00:00Z',
    creation_source: 'github',
    default: true,
    protected: isProtected ?? false,
    cpu_used_sec: 0,
    compute_time_seconds: 0,
    active_time_seconds: 0,
    written_data_bytes: 0,
    data_transfer_bytes: 0,
    created_at: '2021-01-01T00:00:00Z',
    updated_at: '2021-01-01T00:00:00Z'
  }
}

export function buildListProjectsBranchesResponse(
  ...branches: Branch[]
): BranchesResponse & AnnotationsMapResponse & CursorPaginationResponse {
  return {
    branches,
    annotations: {},
    pagination: {}
  }
}

export function buildBranchSchemaResponse(
  sql: string = ''
): BranchSchemaResponse {
  return {
    sql
  }
}

export function buildGitHubComment(
  id: number,
  url: string,
  body: string = 'placeholder'
) {
  return {
    id,
    node_id: 'node1',
    url,
    body,
    html_url: url,
    user: null,
    created_at: '2023-01-01',
    updated_at: '2023-01-01',
    issue_url: 'placeholder',
    author_association: 'MEMBER' as const
  }
}
