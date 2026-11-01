/**
 * 闹钟排程：把重复规则展开成具体时间点，交给原生 AlarmManager。
 *
 * 复杂规则（每月最后一个周六等）不在原生侧实现，而是由 JS 预先展开，
 * 和商品到期提醒共用 helper-alarm 插件，但使用独立的排程存储键，
 * 两套排程互不覆盖。
 */
import {
  alarmEntryId,
  buildAlarmEntry,
  buildAlarmEntries,
  lastOccurrenceInRange
} from './alarmRule'
import {
  loadAlarmAcks,
  loadAlarmSnoozes,
  loadAlarms,
  saveAlarmAcks,
  saveAlarmSnoozes
} from './db'
import * as notify from './notify'

const ALARM_SCHEDULE_KEY = 'pa.alarm.scheduled.ids.v1'
const SNOOZE_SCHEDULE_KEY = 'pa.alarm.snooze.ids.v1'
const DAY_MS = 24 * 60 * 60 * 1000
// 确认记录保留 7 天，避免无限增长
const ACK_KEEP_MS = 7 * DAY_MS

/**
 * 全量重排所有闹钟（含「稍后提醒」的一次性排程）。
 * @param {Array} [alarms] 不传时从本地存储读取
 * @returns {{count:number, native:boolean}}
 */
export function rescheduleAlarms(alarms, { now = Date.now() } = {}) {
  const list = Array.isArray(alarms) ? alarms : loadAlarms()

  // 丢掉已经过期的稍后提醒
  const stored = loadAlarmSnoozes()
  const snoozes = stored.filter(item => item.at > now)
  if (snoozes.length !== stored.length) saveAlarmSnoozes(snoozes)

  const mainEntries = buildAlarmEntries(list, { now })
  const snoozeEntries = []
  for (const item of snoozes) {
    const alarm = list.find(a => a.id === item.alarmId)
    if (alarm && alarm.enabled) snoozeEntries.push(buildAlarmEntry(alarm, item.at, { snooze: true }))
  }

  // 两套 key 分别取消上一次的排程，互不影响商品到期提醒
  const mainOk = notify.scheduleAll(mainEntries, ALARM_SCHEDULE_KEY)
  const snoozeOk = notify.scheduleAll(snoozeEntries, SNOOZE_SCHEDULE_KEY)

  return { count: mainEntries.length + snoozeEntries.length, native: mainOk || snoozeOk }
}

/**
 * 稍后提醒：把这次响铃推迟 minutes 分钟。
 * @returns {number|null} 新的响铃时间戳
 */
export function snoozeAlarm(alarm, minutes = 5, now = Date.now()) {
  if (!alarm || !alarm.id) return null
  const at = now + Math.max(1, Math.trunc(Number(minutes) || 5)) * 60 * 1000
  const list = loadAlarmSnoozes().filter(item => item.alarmId !== alarm.id)
  list.push({ alarmId: alarm.id, at })
  saveAlarmSnoozes(list)
  rescheduleAlarms(undefined, { now })
  return at
}

/**
 * 记录原生侧已经送达的闹钟排程 id，避免打开 App 时重复弹「闹钟响了」。
 * @param {string[]} ids
 * @returns {number} 新增记录数
 */
export function markAlarmDelivered(ids) {
  const list = Array.isArray(ids)
    ? ids.filter(id => typeof id === 'string' && /^alarm(-snooze)?:/.test(id))
    : []
  if (!list.length) return 0

  const records = loadAlarmAcks()
  const now = Date.now()
  let changed = 0

  for (const id of list) {
    if (records[id]) continue
    records[id] = now
    changed++
  }

  for (const key of Object.keys(records)) {
    if (now - Number(records[key]) > ACK_KEEP_MS) {
      delete records[key]
      changed++
    }
  }

  if (changed) saveAlarmAcks(records)
  return changed
}

/**
 * 找出窗口内已响铃但还没确认的闹钟。
 * @returns {{alarm:object, at:number, entryId:string}|null}
 */
export function findDueAlarmForPrompt(
  alarms,
  now = Date.now(),
  windowMs = 30 * 60 * 1000,
  acks = loadAlarmAcks()
) {
  let best = null

  for (const alarm of alarms || []) {
    if (!alarm || !alarm.enabled) continue
    const at = lastOccurrenceInRange(alarm, now - windowMs, now)
    if (at == null) continue
    const entryId = alarmEntryId(alarm.id, at)
    if (acks[entryId]) continue
    if (!best || at > best.at) best = { alarm, at, entryId }
  }

  return best
}

/** 清空闹钟相关的原生排程与稍后提醒 */
export function cancelAlarmSchedules() {
  notify.cancelAll(ALARM_SCHEDULE_KEY)
  notify.cancelAll(SNOOZE_SCHEDULE_KEY)
  saveAlarmSnoozes([])
}
