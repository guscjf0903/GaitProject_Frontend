import { describe, expect, it } from 'vitest'
import { normalizeBranchName } from '../branch'
import { isUuid, shortHash } from '../ids'

describe('branch and id helpers', () => {
  it('normalizes branch names into stable path-like values', () => {
    expect(normalizeBranchName('  feat my branch!  ')).toBe('feat-my-branch')
    expect(normalizeBranchName('feature//clean up')).toBe('feature/clean-up')
    expect(normalizeBranchName('release/v1.0')).toBe('release/v1.0')
  })

  it('returns an 8-character short hash', () => {
    expect(shortHash('1234567890abcdef')).toBe('12345678')
    expect(shortHash('abc')).toBe('abc')
  })

  it('recognizes UUID values', () => {
    expect(isUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
    expect(isUuid('not-a-uuid')).toBe(false)
  })
})
