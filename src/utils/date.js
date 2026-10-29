/**
 * 日期工具。
 * 业务上所有日期都按「本地日历日」处理：'YYYY-MM-DD' 字符串，不带时区。
 * 比较和天数差统一转成 UTC 午夜再算，避免夏令时导致的 23/25 小时误差。
 */

const DAY_MS = 24 * 60 * 60 * 1000

export function pad2(n) {
  return String(n).padStart(2, '0')
}

export function formatDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function todayStr() {
  return formatDate(new Date())
}

export function parseDateStr(str) {
  const [y, m, d] = String(str || '').split('-').map(Number)
  return { y, m, d }
}

export function isValidDateStr(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(str || ''))) return false
  const { y, m, d } = parseDateStr(str)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d
}

export function dateStrToUTC(str) {
  const { y, m, d } = parseDateStr(str)
  return Date.UTC(y, m - 1, d)
}

/** to - from 的日历天数差 */
export function daysBetween(fromStr, toStr) {
  return Math.round((dateStrToUTC(toStr) - dateStrToUTC(fromStr)) / DAY_MS)
}

export function fromParts({ y, m, d }) {
  return `${y}-${pad2(m)}-${pad2(d)}`
}

/** 'YYYY-MM-DD' + 'HH:mm' → 本地时间戳 */
export function atTimeOfDay(dateStr, hhmm = '09:00') {
  const { y, m, d } = parseDateStr(dateStr)
  const [hh, mm] = String(hhmm || '09:00').split(':').map(Number)
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0).getTime()
}

export function formatDateTime(ts) {
  const d = new Date(ts)
  return `${formatDate(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
