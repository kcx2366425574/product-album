import { describe, expect, it } from 'vitest'
import { MAX_IMAGE_BYTES, isOversize } from '@/utils/limits'

describe('isOversize', () => {
  it('等于上限不算超限', () => {
    expect(isOversize(MAX_IMAGE_BYTES)).toBe(false)
  })

  it('超过上限算超限', () => {
    expect(isOversize(MAX_IMAGE_BYTES + 1)).toBe(true)
  })

  it('支持自定义上限', () => {
    expect(isOversize(101, 100)).toBe(true)
    expect(isOversize(99, 100)).toBe(false)
  })

  it('非法值按未超限处理', () => {
    expect(isOversize(undefined)).toBe(false)
    expect(isOversize('abc')).toBe(false)
    expect(isOversize(-1)).toBe(false)
  })
})
