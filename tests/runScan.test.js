import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/notify', () => ({
  notifyNow: vi.fn(),
  scheduleAll: vi.fn(() => false)
}))

import { loadNotifyRecords } from '@/services/db'
import { notifyNow } from '@/services/notify'
import { runScan } from '@/services/reminder'

const settings = { defaultReminderDays: 7, notifyTime: '09:00', notifyEnabled: true }

function product(overrides = {}) {
  return {
    id: 'p1',
    name: '测试商品',
    expiryDate: '2026-11-05',
    reminderDays: -1,
    purchaseDate: '2026-10-01',
    ...overrides
  }
}

const storage = new Map()

beforeEach(() => {
  storage.clear()
  vi.stubGlobal('uni', {
    getStorageSync: key => (storage.has(key) ? storage.get(key) : ''),
    setStorageSync: (key, value) => storage.set(key, value)
  })
  vi.mocked(notifyNow).mockReset()
})

describe('runScan 去重记录', () => {
  it('通知没有真正送达时不写去重记录', () => {
    vi.mocked(notifyNow).mockReturnValue(false)

    const result = runScan([product()], settings, { today: '2026-10-29' })

    expect(notifyNow).toHaveBeenCalledTimes(1)
    expect(result.sent).toHaveLength(0)
    expect(result.pending).toHaveLength(1)
    expect(loadNotifyRecords()).toEqual({})
  })

  it('通知送达后才写入去重记录', () => {
    vi.mocked(notifyNow).mockReturnValue(true)

    const result = runScan([product()], settings, { today: '2026-10-29' })

    expect(result.sent).toHaveLength(1)
    expect(result.pending).toHaveLength(0)
    expect(Object.keys(loadNotifyRecords())).toHaveLength(1)
  })

  it('已经提醒过的商品不会重复发送', () => {
    vi.mocked(notifyNow).mockReturnValue(true)

    runScan([product()], settings, { today: '2026-10-29' })
    const second = runScan([product()], settings, { today: '2026-10-29' })

    expect(notifyNow).toHaveBeenCalledTimes(1)
    expect(second.sent).toHaveLength(0)
    expect(second.pending).toHaveLength(0)
  })

  it('关闭提醒后不发送也不记录', () => {
    vi.mocked(notifyNow).mockReturnValue(true)

    const result = runScan([product()], { ...settings, notifyEnabled: false }, { today: '2026-10-29' })

    expect(notifyNow).not.toHaveBeenCalled()
    expect(result.sent).toHaveLength(0)
    expect(loadNotifyRecords()).toEqual({})
  })
})
