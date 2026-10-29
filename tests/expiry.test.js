import { describe, expect, it } from 'vitest'
import {
  calcExpiry,
  computeExpiryWithRenewals,
  daysInMonth,
  daysLeft,
  effectiveReminderDays,
  offsetDateStr,
  renewProduct,
  statusOf,
  totalSpanDays
} from '@/services/expiry'

describe('daysInMonth', () => {
  it('普通年二月 28 天', () => expect(daysInMonth(2026, 2)).toBe(28))
  it('闰年二月 29 天', () => expect(daysInMonth(2024, 2)).toBe(29))
  it('四月 30 天', () => expect(daysInMonth(2026, 4)).toBe(30))
  it('十二月 31 天', () => expect(daysInMonth(2026, 12)).toBe(31))
})

describe('offsetDateStr', () => {
  it('按天跨月', () => expect(offsetDateStr('2026-01-31', 1, 'day')).toBe('2026-02-01'))
  it('按天跨年', () => expect(offsetDateStr('2026-12-31', 1, 'day')).toBe('2027-01-01'))
  it('按天跨闰日', () => expect(offsetDateStr('2024-02-28', 1, 'day')).toBe('2024-02-29'))
  it('按天负数', () => expect(offsetDateStr('2026-03-01', -1, 'day')).toBe('2026-02-28'))
  it('按月月末收敛（平年）', () => expect(offsetDateStr('2026-01-31', 1, 'month')).toBe('2026-02-28'))
  it('按月月末收敛（闰年）', () => expect(offsetDateStr('2024-01-31', 1, 'month')).toBe('2024-02-29'))
  it('按月跨年', () => expect(offsetDateStr('2026-11-30', 3, 'month')).toBe('2027-02-28'))
  it('按年闰日收敛', () => expect(offsetDateStr('2024-02-29', 1, 'year')).toBe('2025-02-28'))
  it('按年普通', () => expect(offsetDateStr('2026-10-29', 1, 'year')).toBe('2027-10-29'))
})

describe('calcExpiry', () => {
  it('90 天', () => expect(calcExpiry('2026-10-29', 90, 'day')).toBe('2027-01-27'))
  it('12 个月', () => expect(calcExpiry('2026-10-29', 12, 'month')).toBe('2027-10-29'))
  it('1 年', () => expect(calcExpiry('2026-10-29', 1, 'year')).toBe('2027-10-29'))
  it('1/31 加 1 个月', () => expect(calcExpiry('2026-01-31', 1, 'month')).toBe('2026-02-28'))
})

describe('daysLeft', () => {
  it('今天到期为 0', () => expect(daysLeft('2026-10-29', '2026-10-29')).toBe(0))
  it('明天为 1', () => expect(daysLeft('2026-10-30', '2026-10-29')).toBe(1))
  it('昨天为 -1', () => expect(daysLeft('2026-10-28', '2026-10-29')).toBe(-1))
  it('跨月跨年', () => expect(daysLeft('2027-01-27', '2026-10-29')).toBe(90))
})

describe('effectiveReminderDays', () => {
  it('跟随全局', () => expect(effectiveReminderDays({ reminderDays: -1 }, 7)).toBe(7))
  it('单独设置优先', () => expect(effectiveReminderDays({ reminderDays: 0 }, 7)).toBe(0))
  it('缺失时跟随全局', () => expect(effectiveReminderDays({}, 7)).toBe(7))
})

describe('statusOf', () => {
  const today = '2026-10-29'

  it('超过提醒阈值是正常', () => {
    expect(statusOf({ expiryDate: '2026-11-06', reminderDays: -1 }, 7, today)).toBe('normal')
  })
  it('正好落在阈值上是即将到期', () => {
    expect(statusOf({ expiryDate: '2026-11-05', reminderDays: -1 }, 7, today)).toBe('soon')
  })
  it('今天到期是即将到期', () => {
    expect(statusOf({ expiryDate: today, reminderDays: -1 }, 7, today)).toBe('soon')
  })
  it('昨天到期是已过期', () => {
    expect(statusOf({ expiryDate: '2026-10-28', reminderDays: -1 }, 7, today)).toBe('expired')
  })
  it('单品设置 0 天时不算即将到期', () => {
    expect(statusOf({ expiryDate: '2026-11-05', reminderDays: 0 }, 7, today)).toBe('normal')
  })
})

describe('renewProduct', () => {
  const base = {
    id: 'p1',
    name: '测试',
    purchaseDate: '2026-10-01',
    durationValue: 60,
    durationUnit: 'day',
    expiryDate: '2026-11-30',
    reminderDays: -1,
    renewals: [],
    updatedAt: 0
  }

  it('未过期从原到期日顺延', () => {
    const next = renewProduct(base, { value: 30, unit: 'day', amount: 99 }, '2026-10-29')
    expect(next.expiryDate).toBe('2026-12-30')
    expect(next.renewals).toHaveLength(1)
    expect(next.renewals[0].base).toBe('2026-11-30')
    expect(next.renewals[0].amount).toBe(99)
  })

  it('已过期从今天顺延', () => {
    const expired = { ...base, expiryDate: '2026-10-20' }
    const next = renewProduct(expired, { value: 1, unit: 'month' }, '2026-10-29')
    expect(next.expiryDate).toBe('2026-11-29')
    expect(next.renewals[0].base).toBe('2026-10-29')
  })

  it('不修改原对象', () => {
    renewProduct(base, { value: 30, unit: 'day' }, '2026-10-29')
    expect(base.expiryDate).toBe('2026-11-30')
    expect(base.renewals).toHaveLength(0)
  })
})

describe('computeExpiryWithRenewals', () => {
  it('依次叠加续费', () => {
    expect(computeExpiryWithRenewals('2026-10-01', 30, 'day', [{ value: 1, unit: 'month' }])).toBe(
      '2026-11-30'
    )
  })
  it('无续费等于初始到期日', () => {
    expect(computeExpiryWithRenewals('2026-10-01', 30, 'day', [])).toBe('2026-10-31')
  })
})

describe('totalSpanDays', () => {
  it('等于购买日到到期日的天数', () => {
    expect(totalSpanDays({ purchaseDate: '2026-10-01', expiryDate: '2026-10-31' })).toBe(30)
  })
})
