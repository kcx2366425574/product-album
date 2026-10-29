import { describe, expect, it } from 'vitest'
import { resolveDark } from '@/utils/theme'

describe('resolveDark', () => {
  it('手动深色始终为深色', () => {
    expect(resolveDark('dark', false)).toBe(true)
    expect(resolveDark('dark', true)).toBe(true)
  })

  it('手动浅色始终为浅色', () => {
    expect(resolveDark('light', true)).toBe(false)
    expect(resolveDark('light', false)).toBe(false)
  })

  it('跟随系统时取系统状态', () => {
    expect(resolveDark('auto', true)).toBe(true)
    expect(resolveDark('auto', false)).toBe(false)
  })

  it('未知或缺失设置按跟随系统处理', () => {
    expect(resolveDark(undefined, true)).toBe(true)
    expect(resolveDark('', false)).toBe(false)
  })
})
