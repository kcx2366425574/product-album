import { describe, expect, it } from 'vitest'
import { buildSchedule, collectDue } from '@/services/reminder'

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

describe('collectDue', () => {
  it('提前 7 天时命中即将到期', () => {
    const due = collectDue([product()], settings, '2026-10-29')
    expect(due).toHaveLength(1)
    expect(due[0].type).toBe('advance')
    expect(due[0].days).toBe(7)
  })

  it('还未进入提醒窗口不提醒', () => {
    expect(collectDue([product({ expiryDate: '2026-11-10' })], settings, '2026-10-29')).toHaveLength(0)
  })

  it('到期当天算 expiry', () => {
    const due = collectDue([product({ expiryDate: '2026-10-29' })], settings, '2026-10-29')
    expect(due).toHaveLength(1)
    expect(due[0].type).toBe('expiry')
  })

  it('过期后算 expired', () => {
    const due = collectDue([product({ expiryDate: '2026-10-27' })], settings, '2026-10-29')
    expect(due).toHaveLength(1)
    expect(due[0].type).toBe('expired')
    expect(due[0].days).toBe(-2)
  })

  it('单品设置 0 天时只在当天提醒', () => {
    const p = product({ expiryDate: '2026-10-30', reminderDays: 0 })
    expect(collectDue([p], settings, '2026-10-29')).toHaveLength(0)
    expect(collectDue([p], settings, '2026-10-30')).toHaveLength(1)
  })

  it('多个商品按紧急程度排序', () => {
    const list = [
      product({ id: 'a', expiryDate: '2026-11-03' }),
      product({ id: 'b', expiryDate: '2026-10-28' }),
      product({ id: 'c', expiryDate: '2026-10-30' })
    ]
    const due = collectDue(list, settings, '2026-10-29')
    expect(due.map(d => d.product.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('buildSchedule', () => {
  const now = new Date(2026, 9, 29, 8, 0, 0).getTime()

  it('生成提前提醒 + 到期当天两条', () => {
    const entries = buildSchedule([product()], settings, { now, days: 30 })
    expect(entries).toHaveLength(2)
    expect(entries[0].payload.type).toBe('advance')
    expect(entries[0].at).toBe(new Date(2026, 9, 29, 9, 0, 0).getTime())
    expect(entries[1].payload.type).toBe('expiry')
    expect(entries[1].at).toBe(new Date(2026, 10, 5, 9, 0, 0).getTime())
  })

  it('过去的时间点不排程', () => {
    const entries = buildSchedule([product({ expiryDate: '2026-10-30' })], settings, { now, days: 30 })
    // 提前提醒日期是 10-23，已过去；只剩 10-30 到期当天
    expect(entries).toHaveLength(1)
    expect(entries[0].payload.type).toBe('expiry')
  })

  it('超出排程窗口不生成', () => {
    const entries = buildSchedule([product({ expiryDate: '2026-12-31' })], settings, { now, days: 30 })
    expect(entries).toHaveLength(0)
  })

  it('关闭提醒后不排程', () => {
    const entries = buildSchedule([product()], { ...settings, notifyEnabled: false }, { now, days: 30 })
    expect(entries).toHaveLength(0)
  })

  it('提前 0 天时只排到期当天一条，不重复', () => {
    const entries = buildSchedule([product({ reminderDays: 0 })], settings, { now, days: 30 })
    expect(entries).toHaveLength(1)
    expect(entries[0].payload.type).toBe('expiry')
    expect(entries[0].at).toBe(new Date(2026, 10, 5, 9, 0, 0).getTime())
  })

  it('默认窗口覆盖一年内的提醒', () => {
    const entries = buildSchedule([product({ expiryDate: '2027-06-01' })], settings, { now })
    expect(entries).toHaveLength(2)
    expect(entries[0].payload.type).toBe('advance')
    expect(entries[1].payload.type).toBe('expiry')
  })

  it('条目超过上限时保留最近的一批', () => {
    const list = Array.from({ length: 201 }, (_, i) =>
      product({ id: `p${i}`, expiryDate: '2026-11-05', reminderDays: 1 })
    )
    const entries = buildSchedule(list, settings, { now, days: 30 })
    expect(entries).toHaveLength(400)
  })
})
