import { describe, expect, it } from 'vitest'
import { shouldPromptPermission } from '@/services/permission'

const settings = { notifyEnabled: true, permissionPrompted: false }

describe('shouldPromptPermission', () => {
  it('已授权时不提示', () => {
    expect(shouldPromptPermission(settings, 'granted')).toBe(false)
  })

  it('环境不支持时不提示', () => {
    expect(shouldPromptPermission(settings, 'unsupported')).toBe(false)
  })

  it('用户关闭提醒时不提示', () => {
    expect(shouldPromptPermission({ ...settings, notifyEnabled: false }, 'default')).toBe(false)
  })

  it('已经引导过就不再重复提示', () => {
    expect(shouldPromptPermission({ ...settings, permissionPrompted: true }, 'denied')).toBe(false)
  })

  it('未授权且未引导过时提示', () => {
    expect(shouldPromptPermission(settings, 'default')).toBe(true)
    expect(shouldPromptPermission(settings, 'denied')).toBe(true)
    expect(shouldPromptPermission(settings, 'unknown')).toBe(true)
  })

  it('设置缺失时安全返回 false', () => {
    expect(shouldPromptPermission(null, 'default')).toBe(false)
  })
})
