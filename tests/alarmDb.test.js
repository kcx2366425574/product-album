import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadAlarmAcks,
  loadAlarms,
  loadAlarmSnoozes,
  removeAlarm,
  saveAlarmAcks,
  saveAlarmSnoozes,
  upsertAlarm
} from '@/services/db'

const storage = new Map()
let failWrites = false
let errorSpy

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  storage.clear()
  failWrites = false
  vi.stubGlobal('uni', {
    getStorageSync: key => (storage.has(key) ? storage.get(key) : ''),
    setStorageSync: (key, value) => {
      if (failWrites) throw new Error('quota exceeded')
      storage.set(key, value)
    }
  })
})

afterEach(() => {
  errorSpy.mockRestore()
})

function alarm(overrides = {}) {
  return {
    id: 'a1',
    title: '起床',
    time: '07:30',
    enabled: true,
    rule: { type: 'monthly', monthlyMode: 'weekday', nth: -1, weekday: 6 },
    ...overrides
  }
}

describe('闹钟数据存取', () => {
  it('保存后能读回，并自动补齐默认值', () => {
    const saved = upsertAlarm(alarm({ title: '  晨跑  ' }))
    expect(saved).not.toBeNull()

    const list = loadAlarms()
    expect(list).toHaveLength(1)
    expect(list[0].title).toBe('晨跑')
    expect(list[0].rule.nth).toBe(-1)
    expect(list[0].rule.weekday).toBe(6)
  })

  it('相同 id 更新而不是新增', () => {
    upsertAlarm(alarm())
    upsertAlarm(alarm({ title: '新名字', time: '08:00' }))
    const list = loadAlarms()
    expect(list).toHaveLength(1)
    expect(list[0].title).toBe('新名字')
    expect(list[0].time).toBe('08:00')
  })

  it('删除指定闹钟', () => {
    upsertAlarm(alarm({ id: 'a1' }))
    upsertAlarm(alarm({ id: 'a2' }))
    expect(removeAlarm('a1')).toBe(true)
    expect(loadAlarms().map(item => item.id)).toEqual(['a2'])
  })

  it('没有 id 的闹钟不写入', () => {
    expect(upsertAlarm(alarm({ id: '' }))).toBeNull()
    expect(loadAlarms()).toHaveLength(0)
  })

  it('写入失败时返回 null 且保留原数据', () => {
    upsertAlarm(alarm())
    failWrites = true
    expect(upsertAlarm(alarm({ title: '新名字' }))).toBeNull()
    expect(loadAlarms()[0].title).toBe('起床')
  })

  it('损坏的存储内容回退为空列表', () => {
    storage.set('pa.alarms.v1', '{')
    expect(loadAlarms()).toEqual([])
  })
})

describe('稍后提醒记录', () => {
  it('保存并过滤非法条目', () => {
    saveAlarmSnoozes([
      { alarmId: 'a1', at: 123 },
      { alarmId: '', at: 456 },
      { alarmId: 'a2', at: 0 },
      { alarmId: 'a3', at: '789' }
    ])
    expect(loadAlarmSnoozes()).toEqual([
      { alarmId: 'a1', at: 123 },
      { alarmId: 'a3', at: 789 }
    ])
  })
})

describe('响铃确认记录', () => {
  it('保存与读取确认记录', () => {
    saveAlarmAcks({ 'alarm:a1:123': 456 })
    expect(loadAlarmAcks()).toEqual({ 'alarm:a1:123': 456 })
  })

  it('非对象内容回退为空记录', () => {
    storage.set('pa.alarm.ack.v1', '[]')
    expect(loadAlarmAcks()).toEqual({})
  })
})
