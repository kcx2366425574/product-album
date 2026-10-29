import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/notify', () => ({
  notifyNow: vi.fn(),
  scheduleAll: vi.fn(() => false)
}))

import { loadNotifyRecords, saveNotifyRecords } from '@/services/db'
import { notifyNow, scheduleAll } from '@/services/notify'
import { markDelivered, pruneNotifyRecords, reschedule, runScan } from '@/services/reminder'
import { offsetDateStr } from '@/services/expiry'
import { todayStr } from '@/utils/date'

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
  vi.mocked(scheduleAll).mockClear()
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

describe('逾期重复提醒', () => {
  const DAY = 24 * 60 * 60 * 1000

  it('到达重复间隔后 runScan 再次发送', () => {
    const today = todayStr()
    const expiry = offsetDateStr(today, -10, 'day')
    saveNotifyRecords({ [`p1|${expiry}|expired`]: Date.now() - 4 * DAY })

    vi.mocked(notifyNow).mockReturnValue(true)
    const result = runScan(
      [product({ expiryDate: expiry })],
      { ...settings, overdueRepeatDays: 3 },
      { today }
    )

    expect(result.sent).toHaveLength(1)
  })

  it('未到重复间隔不发送', () => {
    const today = todayStr()
    const expiry = offsetDateStr(today, -10, 'day')
    saveNotifyRecords({ [`p1|${expiry}|expired`]: Date.now() - 1 * DAY })

    vi.mocked(notifyNow).mockReturnValue(true)
    const result = runScan(
      [product({ expiryDate: expiry })],
      { ...settings, overdueRepeatDays: 3 },
      { today }
    )

    expect(result.sent).toHaveLength(0)
  })

  it('reschedule 不会因已有记录而丢掉逾期重复条目', () => {
    const today = todayStr()
    const expiry = offsetDateStr(today, -10, 'day')
    saveNotifyRecords({ [`p1|${expiry}|expired`]: Date.now() })

    reschedule([product({ expiryDate: expiry })], { ...settings, overdueRepeatDays: 3 })

    const entries = vi.mocked(scheduleAll).mock.calls.at(-1)[0]
    expect(entries.some(entry => entry.repeatDays === 3)).toBe(true)
  })
})

describe('pruneNotifyRecords', () => {
  it('清理已删除商品和续费后旧到期日的记录', () => {
    saveNotifyRecords({
      'p1|2026-11-05|advance|7': 1,
      'p1|2026-10-01|advance|7': 2,
      'pX|2026-11-05|expiry': 3
    })

    expect(pruneNotifyRecords([{ id: 'p1', expiryDate: '2026-11-05' }])).toBe(true)
    expect(loadNotifyRecords()).toEqual({ 'p1|2026-11-05|advance|7': 1 })
  })

  it('没有可清理记录时返回 false', () => {
    saveNotifyRecords({ 'p1|2026-11-05|advance|7': 1 })

    expect(pruneNotifyRecords([{ id: 'p1', expiryDate: '2026-11-05' }])).toBe(false)
    expect(loadNotifyRecords()).toEqual({ 'p1|2026-11-05|advance|7': 1 })
  })
})

describe('markDelivered 原生送达回写', () => {
  it('写入后 runScan 不再重复发送同一条提醒', () => {
    const key = 'p1|2026-11-05|advance|7'

    expect(markDelivered([key])).toBe(1)
    expect(loadNotifyRecords()[key]).toBeTypeOf('number')

    vi.mocked(notifyNow).mockReturnValue(true)
    const result = runScan([product()], settings, { today: '2026-10-29' })

    expect(notifyNow).not.toHaveBeenCalled()
    expect(result.sent).toHaveLength(0)
  })

  it('忽略空 id，且不会覆盖已有记录', () => {
    markDelivered(['a', 'a', ''])
    const first = loadNotifyRecords()
    expect(Object.keys(first)).toEqual(['a'])

    expect(markDelivered(['a'])).toBe(0)
    expect(loadNotifyRecords()).toEqual(first)
  })

  it('非数组入参安全返回 0', () => {
    expect(markDelivered(null)).toBe(0)
    expect(markDelivered(undefined)).toBe(0)
    expect(loadNotifyRecords()).toEqual({})
  })
})
