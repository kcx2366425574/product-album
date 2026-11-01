/**
 * 闹钟重复规则与下次响铃计算。
 *
 * 纯函数，不依赖 uni API，方便直接写单元测试。
 *
 * 规则模型：
 * {
 *   type: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly',
 *   date: 'YYYY-MM-DD',      // once：只响一次
 *   weekdays: [0..6],        // weekly：0 = 周日
 *   monthlyMode: 'day' | 'weekday',
 *   day: 1..31,              // 每月/每年按日期
 *   nth: 1..4 | -1,          // 第几个 / 最后一个
 *   weekday: 0..6,           // 配合 nth 使用
 *   month: 1..12             // yearly 专用
 * }
 *
 * 约定：
 * - 「每月 31 日」在短月按当月最后一天触发（与商品到期规则一致）
 * - 「每月最后一个周六」用 monthlyMode='weekday' + nth=-1 + weekday=6
 */
import { addDaysParts, daysInMonth } from '@/services/expiry'
import { atTimeOfDay, fromParts, isValidDateStr, pad2, todayStr } from '@/utils/date'

const DAY_MS = 24 * 60 * 60 * 1000
// 覆盖闰年 2 月 29 日等最长 8 年才会重复一次的情况
const MAX_SEARCH_DAYS = 366 * 8

export const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
export const WEEKDAY_SHORT = ['日', '一', '二', '三', '四', '五', '六']

export const REPEAT_TYPES = [
  { value: 'once', label: '仅一次' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'yearly', label: '每年' }
]

export const NTH_OPTIONS = [
  { value: 1, label: '第一个' },
  { value: 2, label: '第二个' },
  { value: 3, label: '第三个' },
  { value: 4, label: '第四个' },
  { value: -1, label: '最后一个' }
]

export const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1} 月`
}))

export const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
  value: i + 1,
  label: i + 1 === 31 ? '31 日（短月取最后一天）' : `${i + 1} 日`
}))

function clampInt(value, min, max, fallback) {
  const n = Math.trunc(Number(value))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/** 规范 'HH:mm'，非法值回退到 09:00 */
export function normalizeTime(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || ''))
  return match ? `${match[1]}:${match[2]}` : '09:00'
}

export function normalizeRule(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const type = REPEAT_TYPES.some(item => item.value === src.type) ? src.type : 'daily'

  const weekdays = Array.isArray(src.weekdays)
    ? [...new Set(
        src.weekdays
          .map(Number)
          .filter(n => Number.isInteger(n) && n >= 0 && n <= 6)
      )].sort((a, b) => a - b)
    : []

  return {
    type,
    date: isValidDateStr(src.date) ? src.date : todayStr(),
    weekdays: weekdays.length ? weekdays : [1],
    monthlyMode: src.monthlyMode === 'weekday' ? 'weekday' : 'day',
    day: clampInt(src.day, 1, 31, 1),
    nth: NTH_OPTIONS.some(item => item.value === Number(src.nth)) ? Number(src.nth) : 1,
    weekday: clampInt(src.weekday, 0, 6, 1),
    month: clampInt(src.month, 1, 12, 1)
  }
}

export function normalizeAlarm(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || '').trim()
  if (!id) return null

  return {
    id,
    title: String(raw.title || '').trim().slice(0, 30) || '闹钟',
    note: String(raw.note || '').trim().slice(0, 120),
    time: normalizeTime(raw.time),
    enabled: raw.enabled !== false,
    rule: normalizeRule(raw.rule),
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now()
  }
}

/** 某个日期是星期几（0 = 周日） */
export function weekdayOf(parts) {
  return new Date(Date.UTC(parts.y, parts.m - 1, parts.d)).getUTCDay()
}

/**
 * 计算某月「第 n 个星期几」的日期。
 * nth 为正数表示从月初数，-1 表示最后一个，-2 表示倒数第二个。
 * 当月不存在时返回 null（例如 31 日不存在第 5 个周一）。
 */
export function nthWeekdayDate(year, month, weekday, nth) {
  const total = daysInMonth(year, month)

  if (nth > 0) {
    const firstWeekday = weekdayOf({ y: year, m: month, d: 1 })
    const first = 1 + ((weekday - firstWeekday + 7) % 7)
    const day = first + (nth - 1) * 7
    return day <= total ? day : null
  }

  const lastWeekday = weekdayOf({ y: year, m: month, d: total })
  const last = total - ((lastWeekday - weekday + 7) % 7)
  const day = last + (nth + 1) * 7
  return day >= 1 ? day : null
}

function ruleMatchesDate(rule, parts) {
  const { y, m, d } = parts

  if (rule.type === 'once') return fromParts(parts) === rule.date
  if (rule.type === 'daily') return true
  if (rule.type === 'weekly') return rule.weekdays.includes(weekdayOf(parts))

  if (rule.type === 'monthly') {
    return rule.monthlyMode === 'weekday'
      ? nthWeekdayDate(y, m, rule.weekday, rule.nth) === d
      : d === Math.min(rule.day, daysInMonth(y, m))
  }

  if (rule.type === 'yearly') {
    if (m !== rule.month) return false
    if (rule.monthlyMode === 'weekday') {
      return nthWeekdayDate(y, m, rule.weekday, rule.nth) === d
    }
    // 每年 2 月 29 日只在闰年触发，不自动挪到 2 月 28 日
    return d === rule.day
  }

  return false
}

/**
 * 下一次响铃时间戳。
 * @param {{time:string, enabled?:boolean, rule:object}} alarm
 * @param {number} from 从这个时间点之后查找
 * @returns {number|null}
 */
export function nextOccurrence(alarm, from = Date.now()) {
  if (!alarm || alarm.enabled === false) return null
  const rule = normalizeRule(alarm.rule)
  const time = normalizeTime(alarm.time)

  if (rule.type === 'once') {
    const at = atTimeOfDay(rule.date, time)
    return at > from ? at : null
  }

  const start = new Date(from)
  let parts = { y: start.getFullYear(), m: start.getMonth() + 1, d: start.getDate() }

  for (let i = 0; i < MAX_SEARCH_DAYS; i++) {
    if (ruleMatchesDate(rule, parts) && atTimeOfDay(fromParts(parts), time) > from) {
      return atTimeOfDay(fromParts(parts), time)
    }
    parts = addDaysParts(parts, 1)
  }

  return null
}

/**
 * 时间区间内所有响铃时间点（左闭右闭）。
 * @returns {number[]}
 */
export function occurrencesInRange(alarm, startMs, endMs) {
  if (!alarm || alarm.enabled === false || !(endMs >= startMs)) return []
  const rule = normalizeRule(alarm.rule)
  const time = normalizeTime(alarm.time)
  const start = new Date(startMs)
  let parts = { y: start.getFullYear(), m: start.getMonth() + 1, d: start.getDate() }
  const maxDays = Math.min(MAX_SEARCH_DAYS, Math.ceil((endMs - startMs) / DAY_MS) + 2)

  const out = []
  for (let i = 0; i < maxDays; i++) {
    const dateStr = fromParts(parts)
    const at = atTimeOfDay(dateStr, time)
    if (at > endMs) break
    if (at >= startMs && ruleMatchesDate(rule, parts)) out.push(at)
    parts = addDaysParts(parts, 1)
  }
  return out
}

/**
 * 区间内是否发生过响铃，返回最后一次的时间戳。
 * 用于 App 打开/前台轮询时补一次「闹钟响了」提醒。
 */
export function lastOccurrenceInRange(alarm, startMs, endMs) {
  const list = occurrencesInRange(alarm, startMs, endMs)
  return list.length ? list[list.length - 1] : null
}

function nthLabel(nth) {
  const hit = NTH_OPTIONS.find(item => item.value === nth)
  return hit ? hit.label : '第一个'
}

function formatDateCN(dateStr) {
  const [y, m, d] = String(dateStr || '').split('-').map(Number)
  if (!y || !m || !d) return dateStr || ''
  return `${y}年${m}月${d}日`
}

/** 规则的中文描述，例如「每月最后一个周六」 */
export function describeRule(raw) {
  const rule = normalizeRule(raw)

  if (rule.type === 'once') return `仅一次 · ${formatDateCN(rule.date)}`
  if (rule.type === 'daily') return '每天'

  if (rule.type === 'weekly') {
    if (rule.weekdays.length === 7) return '每天'
    if (rule.weekdays.length === 1) return `每周${WEEKDAY_SHORT[rule.weekdays[0]]}`
    return `每周${rule.weekdays.map(day => WEEKDAY_SHORT[day]).join('、')}`
  }

  if (rule.type === 'monthly' || rule.type === 'yearly') {
    const prefix = rule.type === 'yearly' ? `每年 ${rule.month} 月` : '每月'
    if (rule.monthlyMode === 'weekday') {
      return `${prefix}${nthLabel(rule.nth)}${WEEKDAY_LABELS[rule.weekday]}`
    }
    return `${prefix}${rule.day === 31 ? '最后一天' : ` ${rule.day} 日`}`
  }

  return '每天'
}

/** 完整的响铃时间文本，例如「2026年11月28日 周六 09:00」 */
export function formatOccurrence(at) {
  const d = new Date(at)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAY_LABELS[d.getDay()]} ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`
}

export function alarmEntryId(alarmId, at) {
  return `alarm:${alarmId}:${at}`
}

export function snoozeEntryId(alarmId, at) {
  return `alarm-snooze:${alarmId}:${at}`
}

/**
 * 生成一条原生排程条目。
 * payload 里的 module 用于通知点击后跳转到闹钟模块。
 */
export function buildAlarmEntry(alarm, at, { snooze = false } = {}) {
  const ruleText = describeRule(alarm.rule)
  const content = snooze
    ? `${ruleText} · 稍后提醒`
    : alarm.note
      ? `${ruleText} · ${alarm.note}`
      : ruleText

  return {
    id: snooze ? snoozeEntryId(alarm.id, at) : alarmEntryId(alarm.id, at),
    at,
    title: alarm.title || '闹钟',
    content,
    payload: { module: 'alarm', alarmId: alarm.id, at, snooze },
    alarmId: alarm.id
  }
}

/**
 * 为所有开启的闹钟生成未来一段时间的原生排程。
 * 复杂重复规则（每月最后一个周六等）由 JS 预先展开成一个个具体时间点。
 */
export function buildAlarmEntries(
  alarms,
  { now = Date.now(), days = 365, maxPerAlarm = 120, maxTotal = 400 } = {}
) {
  const until = now + days * DAY_MS
  const entries = []

  for (const alarm of alarms || []) {
    if (!alarm || !alarm.enabled) continue
    const occurrences = occurrencesInRange(alarm, now + 1, until).slice(0, maxPerAlarm)
    for (const at of occurrences) entries.push(buildAlarmEntry(alarm, at))
  }

  entries.sort((a, b) => a.at - b.at)
  return entries.slice(0, maxTotal)
}

/**
 * 找出最近一次已经响过、但用户还没确认的闹钟。
 * @returns {{alarm:object, at:number, entryId:string}|null}
 */
export function findDueAlarm(alarms, now = Date.now(), windowMs = 30 * 60 * 1000) {
  let best = null

  for (const alarm of alarms || []) {
    if (!alarm || !alarm.enabled) continue
    const at = lastOccurrenceInRange(alarm, now - windowMs, now)
    if (at == null) continue
    if (!best || at > best.at) {
      best = { alarm, at, entryId: alarmEntryId(alarm.id, at) }
    }
  }

  return best
}
