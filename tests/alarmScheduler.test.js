import { beforeEach, describe, expect, it, vi } from 'vitest'

const storage = new Map()

vi.stubGlobal('uni', {
  getStorageSync: key => (storage.has(key) ? storage.get(key) : ''),
  setStorageSync: (key, value) => storage.set(key, value)
})

const { loadAlarmAcks, loadAlarmSnoozes, saveAlarms } = await import('@/services/db')
const {
  findDueAlarmForPrompt,
  markAlarmDelivered,
  rescheduleAlarms,
  snoozeAlarm
} = await import('@/services/alarmScheduler')

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

beforeEach(() => {
  storage.clear()
})

describe('markAlarmDelivered', () => {
  it('只记录闹钟排程 id，忽略商品提醒', () => {
    const changed = markAlarmDelivered(['alarm:a1:123', 'p1|2026-10-20|expiry', 'other'])
    expect(changed).toBe(1)
    expect(Object.keys(loadAlarmAcks())).toContain('alarm:a1:123')
  })

  it('重复写入不增加记录数', () => {
    markAlarmDelivered(['alarm:a1:123'])
    expect(markAlarmDelivered(['alarm:a1:123'])).toBe(0)
  })

  it('支持稍后提醒的 id', () => {
    markAlarmDelivered(['alarm-snooze:a1:456'])
    expect(Object.keys(loadAlarmAcks())).toContain('alarm-snooze:a1:456')
  })
})

describe('findDueAlarmForPrompt', () => {
  const now = at(2026, 10, 29, 9, 5)

  it('返回窗口内最近一次未确认的响铃', () => {
    const hit = findDueAlarmForPrompt([alarm()], now, 30 * 60 * 1000, {})
    expect(hit).not.toBeNull()
    expect(hit.alarm.id).toBe('a1')
    expect(hit.at).toBe(at(2026, 10, 29, 9))
  })

  it('已确认的响铃不再返回', () => {
    const hit = findDueAlarmForPrompt([alarm()], now, 30 * 60 * 1000, {})
    expect(findDueAlarmForPrompt([alarm()], now, 30 * 60 * 1000, { [hit.entryId]: Date.now() })).toBeNull()
  })

  it('多个闹钟时取最近一次响铃', () => {
    const a2 = alarm({ id: 'a2', time: '09:04' })
    const hit = findDueAlarmForPrompt([alarm(), a2], now, 30 * 60 * 1000, {})
    expect(hit.alarm.id).toBe('a2')
  })

  it('关闭的闹钟与窗口外的响铃不返回', () => {
    expect(findDueAlarmForPrompt([alarm({ enabled: false })], now, 30 * 60 * 1000, {})).toBeNull()
    expect(findDueAlarmForPrompt([alarm()], at(2026, 10, 29, 10), 30 * 60 * 1000, {})).toBeNull()
  })
})

describe('rescheduleAlarms', () => {
  it('按规则展开未来时间点', () => {
    const result = rescheduleAlarms([alarm({ rule: { type: 'daily' } })], {
      now: at(2026, 10, 29, 8)
    })
    expect(result.count).toBe(120)
    expect(result.native).toBe(false)
  })

  it('关闭的闹钟不排程', () => {
    const result = rescheduleAlarms([alarm({ enabled: false })], {
      now: at(2026, 10, 29, 8)
    })
    expect(result.count).toBe(0)
  })

  it('清理已经过期的稍后提醒', () => {
    const now = at(2026, 10, 29, 8)
    storage.set(
      'pa.alarm.snooze.v1',
      JSON.stringify([
        { alarmId: 'a1', at: now - 1000 },
        { alarmId: 'a1', at: now + 5 * 60 * 1000 }
      ])
    )
    const result = rescheduleAlarms([alarm()], { now })
    expect(loadAlarmSnoozes()).toHaveLength(1)
    expect(result.count).toBe(121)
  })
})

describe('snoozeAlarm', () => {
  it('记录 5 分钟后的稍后提醒', () => {
    const now = at(2026, 10, 29, 9)
    const a = alarm()
    saveAlarms([a])

    const next = snoozeAlarm(a, 5, now)
    expect(next).toBe(now + 5 * 60 * 1000)
    expect(loadAlarmSnoozes()).toEqual([{ alarmId: 'a1', at: next }])
  })

  it('同一个闹钟重复点稍后只保留最新一条', () => {
    const now = at(2026, 10, 29, 9)
    const a = alarm()
    saveAlarms([a])

    snoozeAlarm(a, 5, now)
    const next = snoozeAlarm(a, 10, now)
    expect(loadAlarmSnoozes()).toEqual([{ alarmId: 'a1', at: next }])
  })

  it('没有 id 时返回 null', () => {
    expect(snoozeAlarm({ title: '无 id' }, 5, Date.now())).toBeNull()
  })
})
