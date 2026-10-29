import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const storage = new Map()

vi.stubGlobal('uni', {
  getStorageSync: key => (storage.has(key) ? storage.get(key) : ''),
  setStorageSync: (key, value) => storage.set(key, value)
})

const { state, initStore, refreshToday, dueItems, stats } = await import('@/store/app')

function product(overrides = {}) {
  return {
    id: 'p1',
    name: '测试商品',
    expiryDate: '2026-10-30',
    reminderDays: -1,
    purchaseDate: '2026-10-01',
    images: [],
    tags: [],
    renewals: [],
    updatedAt: 0,
    ...overrides
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 29, 10, 0, 0))
  storage.clear()
  initStore()
  state.settings = { ...state.settings, defaultReminderDays: 7 }
  state.products = [product()]
})

afterEach(() => {
  vi.useRealTimers()
})

describe('refreshToday', () => {
  it('同一天返回 false', () => {
    expect(refreshToday()).toBe(false)
    expect(state.today).toBe('2026-10-29')
  })

  it('跨午夜后更新今天，并驱动剩余天数与状态重算', () => {
    expect(dueItems.value[0].days).toBe(1)
    expect(dueItems.value[0].type).toBe('advance')

    vi.setSystemTime(new Date(2026, 9, 30, 0, 1, 0))
    expect(refreshToday()).toBe(true)

    expect(state.today).toBe('2026-10-30')
    expect(dueItems.value[0].days).toBe(0)
    expect(dueItems.value[0].type).toBe('expiry')
  })

  it('跨天后统计随过期状态变化', () => {
    expect(stats.value.soon).toBe(1)
    expect(stats.value.expired).toBe(0)

    vi.setSystemTime(new Date(2026, 9, 31, 0, 1, 0))
    refreshToday()

    expect(stats.value.soon).toBe(0)
    expect(stats.value.expired).toBe(1)
  })
})
