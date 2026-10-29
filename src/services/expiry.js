/**
 * 到期计算：纯函数，不依赖 uni API，方便直接写单元测试。
 *
 * 规则（见 docs/需求分析.md §6.4）：
 * - 按天：购买日 + N 天
 * - 按月/年：目标月没有该日时取该月最后一天（1/31 + 1 月 = 2/28；闰年 2/29）
 * - 到期日当天仍算最后一天：剩余 0 天 = 今天到期，< 0 = 已过期
 * - 续费：未过期从原到期日顺延，已过期从今天顺延
 */
import { daysBetween, fromParts, parseDateStr, todayStr } from '@/utils/date'
import { makeId } from '@/utils/id'

const DAY_MS = 24 * 60 * 60 * 1000

export const STATUS = {
  NORMAL: 'normal',
  SOON: 'soon',
  EXPIRED: 'expired'
}

export const STATUS_TEXT = {
  [STATUS.NORMAL]: '正常',
  [STATUS.SOON]: '即将到期',
  [STATUS.EXPIRED]: '已过期'
}

export const DURATION_UNITS = [
  { value: 'day', label: '天' },
  { value: 'month', label: '个月' },
  { value: 'year', label: '年' }
]

export function unitLabel(unit) {
  const hit = DURATION_UNITS.find(u => u.value === unit)
  return hit ? hit.label : '天'
}

/** month 为 1-based */
export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function addDaysParts(p, n) {
  const t = Date.UTC(p.y, p.m - 1, p.d) + n * DAY_MS
  const d = new Date(t)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }
}

export function addMonthsParts(p, n) {
  const total = p.y * 12 + (p.m - 1) + n
  const y = Math.floor(total / 12)
  const m = (((total % 12) + 12) % 12) + 1
  const d = Math.min(p.d, daysInMonth(y, m))
  return { y, m, d }
}

export function offsetDateStr(dateStr, value, unit) {
  const p = parseDateStr(dateStr)
  const v = Math.trunc(Number(value) || 0)
  let r
  if (unit === 'month') r = addMonthsParts(p, v)
  else if (unit === 'year') r = addMonthsParts(p, v * 12)
  else r = addDaysParts(p, v)
  return fromParts(r)
}

export function calcExpiry(purchaseDate, value, unit) {
  return offsetDateStr(purchaseDate, value, unit)
}

/**
 * 按「购买日 + 初始时长 + 历次续费」重新推算到期日。
 * 用于编辑页修改购买日期或初始时长后的重算。
 */
export function computeExpiryWithRenewals(purchaseDate, value, unit, renewals = []) {
  let cur = calcExpiry(purchaseDate, value, unit)
  for (const r of renewals) {
    if (!r || !Number(r.value)) continue
    cur = offsetDateStr(cur, r.value, r.unit)
  }
  return cur
}

export function daysLeft(expiryDate, today = todayStr()) {
  if (!expiryDate) return 0
  return daysBetween(today, expiryDate)
}

/** 单品提醒天数：-1 表示跟随全局 */
export function effectiveReminderDays(product, defaultReminderDays) {
  const v = Number(product && product.reminderDays)
  if (Number.isFinite(v) && v >= 0) return v
  const d = Number(defaultReminderDays)
  return Number.isFinite(d) && d >= 0 ? d : 0
}

export function statusOf(product, defaultReminderDays, today = todayStr()) {
  if (!product || !product.expiryDate) return STATUS.NORMAL
  const dl = daysLeft(product.expiryDate, today)
  if (dl < 0) return STATUS.EXPIRED
  if (dl <= effectiveReminderDays(product, defaultReminderDays)) return STATUS.SOON
  return STATUS.NORMAL
}

/** 商品从购买到到期的总天数，用于进度条 */
export function totalSpanDays(product) {
  if (!product || !product.purchaseDate || !product.expiryDate) return 0
  return Math.max(1, daysBetween(product.purchaseDate, product.expiryDate))
}

/**
 * 续费：返回新的商品对象（不落库）。
 */
export function renewProduct(product, { value, unit, amount = 0, note = '' }, today = todayStr()) {
  const expired = daysLeft(product.expiryDate, today) < 0
  const base = expired ? today : product.expiryDate
  const record = {
    id: makeId('r'),
    date: today,
    value: Number(value) || 0,
    unit,
    amount: Number(amount) || 0,
    note: String(note || '').trim(),
    base
  }
  return {
    ...product,
    expiryDate: offsetDateStr(base, record.value, unit),
    renewals: [...(product.renewals || []), record],
    updatedAt: Date.now()
  }
}

export function durationText(product) {
  if (!product) return ''
  return `${product.durationValue} ${unitLabel(product.durationUnit)}`
}
