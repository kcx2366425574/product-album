import { describe, expect, it } from 'vitest'
import {
  buildAlarmEntries,
  describeRule,
  findDueAlarm,
  formatOccurrence,
  lastOccurrenceInRange,
  nextOccurrence,
  normalizeAlarm,
  normalizeRule,
  normalizeTime,
  nthWeekdayDate,
  occurrencesInRange
} from '@/services/alarmRule'

function at(y, m, d, h = 9, min = 0) {
  return new Date(y, m - 1, d, h, min, 0, 0).getTime()
}

function alarm(overrides = {}) {
  return {
    id: 'a1',
    title: '起床',
    time: '09:00',
    enabled: true,
    rule: { type: 'daily' },
    ...overrides
  }
}

describe('normalizeTime', () => {
  it('保留合法时间，非法值回退到 09:00', () => {
    expect(normalizeTime('07:05')).toBe('07:05')
    expect(normalizeTime('23:59')).toBe('23:59')
    expect(normalizeTime('24:00')).toBe('09:00')
    expect(normalizeTime('7:05')).toBe('09:00')
    expect(normalizeTime('')).toBe('09:00')
  })
})

describe('normalizeRule', () => {
  it('未知类型回退到每天', () => {
    expect(normalizeRule({ type: 'hourly' }).type).toBe('daily')
    expect(normalizeRule(null).type).toBe('daily')
  })

  it('星期去重、排序并过滤非法值', () => {
    const rule = normalizeRule({ type: 'weekly', weekdays: [5, 1, 5, 9, -1, 3] })
    expect(rule.weekdays).toEqual([1, 3, 5])
  })

  it('星期为空时至少保留一天', () => {
    expect(normalizeRule({ type: 'weekly', weekdays: [] }).weekdays).toEqual([1])
  })

  it('数值字段做上下限约束', () => {
    const rule = normalizeRule({ type: 'monthly', day: 99, month: 0, nth: 9, weekday: 8 })
    expect(rule.day).toBe(31)
    expect(rule.month).toBe(1)
    expect(rule.nth).toBe(1)
    expect(rule.weekday).toBe(6)
  })

  it('保留合法的每月最后一个周六', () => {
    const rule = normalizeRule({ type: 'monthly', monthlyMode: 'weekday', nth: -1, weekday: 6 })
    expect(rule).toMatchObject({
      type: 'monthly',
      monthlyMode: 'weekday',
      nth: -1,
      weekday: 6
    })
  })
})

describe('normalizeAlarm', () => {
  it('补齐默认值', () => {
    const result = normalizeAlarm({ id: 'a1', time: 'bad' })
    expect(result.title).toBe('闹钟')
    expect(result.time).toBe('09:00')
    expect(result.enabled).toBe(true)
    expect(result.rule.type).toBe('daily')
  })

  it('保留合法字段并去掉首尾空格', () => {
    const result = normalizeAlarm({
      id: 'a1',
      title: '  晨跑  ',
      note: ' 带上水 ',
      time: '06:30',
      enabled: false,
      rule: { type: 'weekly', weekdays: [6] }
    })
    expect(result.title).toBe('晨跑')
    expect(result.note).toBe('带上水')
    expect(result.time).toBe('06:30')
    expect(result.enabled).toBe(false)
    expect(result.rule.weekdays).toEqual([6])
  })

  it('没有 id 时返回 null', () => {
    expect(normalizeAlarm({ title: '闹钟' })).toBeNull()
    expect(normalizeAlarm(null)).toBeNull()
  })
})

describe('describeRule', () => {
  it('复杂重复规则', () => {
    expect(describeRule({ type: 'monthly', monthlyMode: 'weekday', nth: -1, weekday: 6 })).toBe(
      '每月最后一个周六'
    )
    expect(describeRule({ type: 'monthly', monthlyMode: 'weekday', nth: 2, weekday: 2 })).toBe(
      '每月第二个周二'
    )
    expect(describeRule({ type: 'monthly', monthlyMode: 'day', day: 15 })).toBe('每月 15 日')
    expect(describeRule({ type: 'monthly', monthlyMode: 'day', day: 31 })).toBe('每月最后一天')
    expect(
      describeRule({ type: 'yearly', month: 5, monthlyMode: 'weekday', nth: 2, weekday: 0 })
    ).toBe('每年 5 月第二个周日')
    expect(describeRule({ type: 'yearly', month: 3, monthlyMode: 'day', day: 8 })).toBe(
      '每年 3 月 8 日'
    )
  })

  it('每周与单次', () => {
    expect(describeRule({ type: 'weekly', weekdays: [1, 3] })).toBe('每周一、三')
    expect(describeRule({ type: 'weekly', weekdays: [0] })).toBe('每周日')
    expect(describeRule({ type: 'weekly', weekdays: [0, 1, 2, 3, 4, 5, 6] })).toBe('每天')
    expect(describeRule({ type: 'once', date: '2026-11-01' })).toBe('仅一次 · 2026年11月1日')
  })
})

describe('nthWeekdayDate', () => {
  it('从月初计算第 n 个星期几', () => {
    // 2026 年 11 月 1 日是周日，第二个周二是 11 月 10 日
    expect(nthWeekdayDate(2026, 11, 2, 2)).toBe(10)
    // 2026 年 10 月只有 4 个周一，第 5 个返回 null
    expect(nthWeekdayDate(2026, 10, 1, 5)).toBeNull()
  })

  it('从月末计算最后一个星期几', () => {
    expect(nthWeekdayDate(2026, 10, 6, -1)).toBe(31)
    expect(nthWeekdayDate(2026, 11, 6, -1)).toBe(28)
    expect(nthWeekdayDate(2026, 10, 6, -2)).toBe(24)
  })
})

describe('nextOccurrence', () => {
  it('每天：当天时间未到返回当天，已过返回次日', () => {
    expect(nextOccurrence(alarm(), at(2026, 10, 29, 8))).toBe(at(2026, 10, 29, 9))
    expect(nextOccurrence(alarm(), at(2026, 10, 29, 9))).toBe(at(2026, 10, 30, 9))
    expect(nextOccurrence(alarm(), at(2026, 10, 29, 9, 26))).toBe(at(2026, 10, 30, 9))
  })

  it('每周一、周三', () => {
    const a = alarm({ rule: { type: 'weekly', weekdays: [1, 3] } })
    // 2026-10-29 周四 → 11-02 周一
    expect(nextOccurrence(a, at(2026, 10, 29, 10))).toBe(at(2026, 11, 2, 9))
  })

  it('每月最后一个周六', () => {
    const a = alarm({ rule: { type: 'monthly', monthlyMode: 'weekday', nth: -1, weekday: 6 } })
    expect(nextOccurrence(a, at(2026, 10, 29, 8))).toBe(at(2026, 10, 31, 9))
    expect(nextOccurrence(a, at(2026, 10, 31, 9, 0) + 1)).toBe(at(2026, 11, 28, 9))
  })

  it('每月第二个周二', () => {
    const a = alarm({ rule: { type: 'monthly', monthlyMode: 'weekday', nth: 2, weekday: 2 } })
    expect(nextOccurrence(a, at(2026, 10, 29, 8))).toBe(at(2026, 11, 10, 9))
  })

  it('每月 31 日在短月取最后一天', () => {
    const a = alarm({ rule: { type: 'monthly', monthlyMode: 'day', day: 31 } })
    expect(nextOccurrence(a, at(2027, 1, 1))).toBe(at(2027, 1, 31, 9))
    expect(nextOccurrence(a, at(2027, 1, 31, 10))).toBe(at(2027, 2, 28, 9))
  })

  it('每年 5 月第二个周日', () => {
    const a = alarm({
      rule: { type: 'yearly', month: 5, monthlyMode: 'weekday', nth: 2, weekday: 0 }
    })
    expect(nextOccurrence(a, at(2026, 1, 1))).toBe(at(2026, 5, 10, 9))
  })

  it('每年 2 月 29 日会找到下一个闰年', () => {
    const a = alarm({ rule: { type: 'yearly', month: 2, monthlyMode: 'day', day: 29 } })
    expect(nextOccurrence(a, at(2026, 1, 1))).toBe(at(2028, 2, 29, 9))
  })

  it('单次闹钟过了时间返回 null', () => {
    const a = alarm({ rule: { type: 'once', date: '2026-10-29' } })
    expect(nextOccurrence(a, at(2026, 10, 29, 8))).toBe(at(2026, 10, 29, 9))
    expect(nextOccurrence(a, at(2026, 10, 29, 10))).toBeNull()
  })

  it('关闭的闹钟不返回时间', () => {
    expect(nextOccurrence(alarm({ enabled: false }), at(2026, 10, 29, 8))).toBeNull()
  })
})

describe('occurrencesInRange', () => {
  it('每天闹钟在 3 天区间内展开 4 次', () => {
    const list = occurrencesInRange(alarm(), at(2026, 10, 29, 8), at(2026, 11, 1, 10))
    expect(list).toEqual([
      at(2026, 10, 29, 9),
      at(2026, 10, 30, 9),
      at(2026, 10, 31, 9),
      at(2026, 11, 1, 9)
    ])
  })

  it('每月最后一个周六一年展开 12 次', () => {
    const a = alarm({ rule: { type: 'monthly', monthlyMode: 'weekday', nth: -1, weekday: 6 } })
    const list = occurrencesInRange(a, at(2026, 1, 1), at(2026, 12, 31, 23, 59))
    expect(list).toHaveLength(12)
    expect(list[0]).toBe(at(2026, 1, 31, 9))
    expect(list[11]).toBe(at(2026, 12, 26, 9))
  })

  it('关闭的闹钟不展开', () => {
    expect(occurrencesInRange(alarm({ enabled: false }), 0, at(2027, 1, 1))).toEqual([])
  })

  it('lastOccurrenceInRange 返回区间内最后一次', () => {
    expect(lastOccurrenceInRange(alarm(), at(2026, 10, 29, 8), at(2026, 10, 31, 12))).toBe(
      at(2026, 10, 31, 9)
    )
  })
})

describe('buildAlarmEntries', () => {
  const now = at(2026, 10, 29, 8)

  it('只展开开启的闹钟，并按时间排序', () => {
    const entries = buildAlarmEntries(
      [
        alarm({ id: 'a1', rule: { type: 'daily' } }),
        alarm({ id: 'a2', enabled: false }),
        alarm({ id: 'a3', time: '07:30', rule: { type: 'daily' } })
      ],
      { now, days: 1 }
    )
    expect(entries.map(entry => entry.alarmId)).toEqual(['a1', 'a3'])
    expect(entries[0].at).toBe(at(2026, 10, 29, 9))
    expect(entries[1].at).toBe(at(2026, 10, 30, 7, 30))
  })

  it('每条排程的 id 唯一，payload 标记闹钟模块', () => {
    const entries = buildAlarmEntries([alarm()], { now, days: 5 })
    expect(new Set(entries.map(entry => entry.id)).size).toBe(entries.length)
    expect(entries[0].payload).toMatchObject({ module: 'alarm', alarmId: 'a1' })
    expect(entries[0].title).toBe('起床')
    expect(entries[0].content).toBe('每天')
  })

  it('限制单个闹钟与总条数', () => {
    const entries = buildAlarmEntries([alarm()], { now, days: 30, maxPerAlarm: 3 })
    expect(entries).toHaveLength(3)

    const many = Array.from({ length: 10 }, (_, i) => alarm({ id: `a${i}` }))
    const capped = buildAlarmEntries(many, { now, days: 30, maxPerAlarm: 20, maxTotal: 25 })
    expect(capped).toHaveLength(25)
  })

  it('备注会附在通知内容后面', () => {
    const entries = buildAlarmEntries([alarm({ note: '带上水' })], { now, days: 1 })
    expect(entries[0].content).toBe('每天 · 带上水')
  })
})

describe('findDueAlarm', () => {
  const now = at(2026, 10, 29, 9, 5)

  it('命中 30 分钟窗口内刚响过的闹钟', () => {
    const hit = findDueAlarm([alarm()], now)
    expect(hit).not.toBeNull()
    expect(hit.at).toBe(at(2026, 10, 29, 9))
    expect(hit.entryId).toBe(`alarm:a1:${at(2026, 10, 29, 9)}`)
  })

  it('超出窗口不命中', () => {
    expect(findDueAlarm([alarm()], at(2026, 10, 29, 9, 31))).toBeNull()
  })

  it('关闭的闹钟不命中', () => {
    expect(findDueAlarm([alarm({ enabled: false })], now)).toBeNull()
  })

  it('多个命中时取最近一次响铃', () => {
    const other = alarm({ id: 'a2', time: '09:04' })
    const hit = findDueAlarm([alarm(), other], now)
    expect(hit.alarm.id).toBe('a2')
    expect(hit.at).toBe(at(2026, 10, 29, 9, 4))
  })
})

describe('formatOccurrence', () => {
  it('输出完整的星期与时间', () => {
    expect(formatOccurrence(at(2026, 11, 28, 9))).toBe('2026年11月28日 周六 09:00')
  })
})
