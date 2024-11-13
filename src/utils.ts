export type PointInTime = {
  type: 'lsn' | 'timestamp'
  value: string
}

export type BranchInput = {
  type: 'id' | 'name'
  value: string
}

export type BranchComparisonInput = {
  compare: BranchInput
  base?: BranchInput
}

const lsnRegex = /^[a-fA-F0-9]{1,8}\/[a-fA-F0-9]{1,8}$/

const haikuRegex = /^[a-z]+-[a-z]+-[a-z0-9]+$/

export function getPointInTime(
  timestamp?: string,
  lsn?: string
): PointInTime | undefined {
  if (timestamp) {
    return {
      type: 'timestamp',
      value: parseTimestamp(timestamp)
    }
  } else if (lsn) {
    return {
      type: 'lsn',
      value: parseLsn(lsn)
    }
  }

  // If neither timestamp nor lsn is provided, return undefined
}

function parseTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  if (isNaN(date.getTime())) {
    throw new Error('Invalid timestamp')
  }

  return date.toISOString()
}

function parseLsn(lsn: string): string {
  if (!lsnRegex.test(lsn)) {
    throw new Error('Invalid LSN')
  }

  return lsn
}

function isBranchId(branchId: string): boolean {
  return branchId.startsWith('br-') && haikuRegex.test(branchId.substring(3))
}

function parseBranchInput(branch: string): BranchInput | undefined {
  branch = branch.trim()

  if (branch === '') {
    return
  }

  if (isBranchId(branch)) {
    return {
      type: 'id',
      value: branch
    }
  } else {
    return {
      type: 'name',
      value: branch
    }
  }
}

export function getBranchInput(
  compareBranch: string,
  baseBranch?: string
): BranchComparisonInput {
  const compare = parseBranchInput(compareBranch)
  const base = baseBranch ? parseBranchInput(baseBranch) : undefined

  if (!compare) throw new Error('Invalid compare branch input')

  return { compare, base }
}

export function getBranchURL(projectId: string, branchId: string): string {
  return `https://console.neon.tech/app/projects/${projectId}/branches/${branchId}`
}
