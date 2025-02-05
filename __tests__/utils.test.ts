import { describe, expect, it } from 'vitest'

import { getBranchInput, getPointInTime } from '../src/utils'

describe('getPointInTime', () => {
  it('should return a PointInTime with type "timestamp" when a valid timestamp is provided', () => {
    const timestamp = '2023-10-14T12:30:00Z'
    const result = getPointInTime(timestamp)

    expect(result).toEqual({
      type: 'timestamp',
      value: new Date(timestamp).toISOString()
    })
  })

  it('should throw an error for an invalid timestamp format', () => {
    const invalidTimestamp = 'invalid-date'

    expect(() => getPointInTime(invalidTimestamp)).toThrow('Invalid timestamp')
  })

  it('should return a PointInTime with type "lsn" when a valid lsn is provided', () => {
    const lsn = '1A2B3C4D/1A2B3C4D'
    const result = getPointInTime(undefined, lsn)

    expect(result).toEqual({
      type: 'lsn',
      value: lsn
    })
  })

  it('should throw an error for an invalid lsn format', () => {
    const invalidLsn = 'invalid-lsn'

    expect(() => getPointInTime(undefined, invalidLsn)).toThrow('Invalid LSN')
  })

  it('should return undefined when neither timestamp nor lsn is provided', () => {
    const result = getPointInTime()
    expect(result).toBeUndefined()
  })
})

describe('parseTimestamp', () => {
  it('should return the ISO string for a valid timestamp', () => {
    const timestamp = '2023-10-14T12:30:00Z'
    const result = getPointInTime(timestamp)

    expect(result?.value).toBe(new Date(timestamp).toISOString())
  })

  it('should throw an error for an invalid timestamp', () => {
    const invalidTimestamp = 'invalid-date'
    expect(() => getPointInTime(invalidTimestamp)).toThrow('Invalid timestamp')
  })
})

describe('parseLsn', () => {
  it('should return the LSN string when it matches the regex', () => {
    const lsn = '1A2B3C4D/1A2B3C4D'
    const result = getPointInTime(undefined, lsn)

    expect(result?.value).toBe(lsn)
  })

  it('should throw an error for an LSN that does not match the regex', () => {
    const invalidLsn = 'invalid-lsn'

    expect(() => getPointInTime(undefined, invalidLsn)).toThrow('Invalid LSN')
  })
})

const validBranchId = 'br-foo-bar-123'
const validBranchName = 'feature-branch'
const invalidBranch = ''

describe('getBranchInput', () => {
  it('should parse compareBranch as an id type when it is a valid branch id', () => {
    const result = getBranchInput(validBranchId)
    expect(result).toEqual({
      compare: { type: 'id', value: validBranchId },
      base: undefined
    })
  })

  it('should parse compareBranch as a name type when it is a valid branch name', () => {
    const result = getBranchInput(validBranchName)
    expect(result).toEqual({
      compare: { type: 'name', value: validBranchName },
      base: undefined
    })
  })

  it('should parse both compareBranch and baseBranch as id types when both are valid branch ids', () => {
    const result = getBranchInput(validBranchId, validBranchId)
    expect(result).toEqual({
      compare: { type: 'id', value: validBranchId },
      base: { type: 'id', value: validBranchId }
    })
  })

  it('should parse compareBranch as an id type and baseBranch as a name type when appropriate', () => {
    const result = getBranchInput(validBranchId, validBranchName)
    expect(result).toEqual({
      compare: { type: 'id', value: validBranchId },
      base: { type: 'name', value: validBranchName }
    })
  })

  it('should throw an error when compareBranch is an empty string', () => {
    expect(() => getBranchInput(invalidBranch)).toThrow(
      'Invalid compare branch input'
    )
  })

  it('should handle undefined baseBranch without errors', () => {
    const result = getBranchInput(validBranchName)
    expect(result).toEqual({
      compare: { type: 'name', value: validBranchName },
      base: undefined
    })
  })
})
