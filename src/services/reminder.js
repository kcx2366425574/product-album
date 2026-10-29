/**
 * 到期提醒引擎。
 *
 * 两条路径：
 * 1. 打开 App 时扫描（runScan）：补发错过的提醒，也负责 H5 端的提醒。
 * 2. 预先排程（reschedule）：App 端把未来 60 天的提醒点交给原生 AlarmManager，
 *    这样进程被杀也能按时通知。
 *
 * 去重 key 里带 expiryDate，所以续费（到期日变化）后会重新提醒。
 */
import { atTimeOfDay, todayStr } from '@/utils/date'
import { daysLeft, effectiveReminderDays, offsetDateStr } from './expiry'
import { loadNotifyRecords, saveNotifyRecords } from './db'
import * as notify from './notify'

const DAY_MS = 24 * 60 * 60 * 1000
// 覆盖一年，避免用户长期不打开 App 时排程过期漏提醒
const SCHEDULE_DAYS = 365
// Android 单个 App 的 AlarmManager 闹钟上限约 500 条，留出余量
const MAX_SCHEDULE_ENTRIES = 400
const MAX_NOTIFY_PER_SCAN = 8

function advanceKey(product, reminderDays) {
  return `${product.id}|${product.expiryDate}|advance|${reminderDays}`
}

function expiryKey(product) {
  return `${product.id}|${product.expiryDate}|expiry`
}

function expiredKey(product) {
  return `${product.id}|${product.expiryDate}|expired`
}

/**
 * 计算当前所有"应当提醒"的项。
 * @returns {Array<{product, type:'advance'|'expiry'|'expired', days:number, key:string}>}
 */
export function collectDue(products, settings, today = todayStr()) {
  const defaultRd = Number(settings && settings.defaultReminderDays) || 0
  const due = []

  for (const p of products || []) {
    if (!p || !p.expiryDate) continue
    const rd = effectiveReminderDays(p, defaultRd)
    const dl = daysLeft(p.expiryDate, today)

    if (dl < 0) {
      due.push({ product: p, type: 'expired', days: dl, key: expiredKey(p) })
    } else if (dl === 0) {
      due.push({ product: p, type: 'expiry', days: 0, key: expiryKey(p) })
    } else if (dl <= rd) {
      due.push({ product: p, type: 'advance', days: dl, key: advanceKey(p, rd) })
    }
  }

  // 越紧急越靠前：已过期 → 今天到期 → 剩余天数少
  due.sort((a, b) => a.days - b.days)
  return due
}

export function buildMessage(item) {
  const p = item.product
  let content
  if (item.type === 'expired') {
    content = `「${p.name}」已过期 ${Math.abs(item.days)} 天，记得续费`
  } else if (item.type === 'expiry') {
    content = `「${p.name}」今天到期，记得续费`
  } else {
    content = `「${p.name}」还有 ${item.days} 天到期，记得续费`
  }
  return {
    title: '商品到期提醒',
    content,
    payload: { productId: p.id, type: item.type, expiryDate: p.expiryDate }
  }
}

/**
 * 打开 App 时扫描并发送提醒。
 * @returns {{sent: Array, pending: Array}} pending 是没能发出去（如未授权）的项
 */
export function runScan(products, settings, { today = todayStr(), mark = true } = {}) {
  if (!settings || settings.notifyEnabled === false) return { sent: [], pending: [] }

  const all = collectDue(products, settings, today)
  if (!all.length) return { sent: [], pending: [] }

  const records = loadNotifyRecords()
  const todo = all.filter(d => !records[d.key])
  if (!todo.length) return { sent: [], pending: [] }

  const sent = []
  const failed = []
  todo.slice(0, MAX_NOTIFY_PER_SCAN).forEach(item => {
    const msg = buildMessage(item)
    if (notify.notifyNow(msg)) {
      if (mark) records[item.key] = Date.now()
      sent.push(item)
    } else {
      failed.push(item)
    }
  })

  if (mark && sent.length) saveNotifyRecords(records)
  return { sent, pending: [...failed, ...todo.slice(MAX_NOTIFY_PER_SCAN)] }
}

/**
 * 把原生侧已经送达的排程 id 写入去重表。
 * 用于 App 启动时消费 AlarmReceiver 的送达记录，避免"通知已弹出 → 打开 App
 * 又立即提醒一次"。
 * @param {string[]} ids
 * @returns {number} 新写入的记录数
 */
export function markDelivered(ids) {
  const list = Array.isArray(ids) ? ids.filter(id => typeof id === 'string' && id) : []
  if (!list.length) return 0

  const records = loadNotifyRecords()
  const now = Date.now()
  let changed = 0
  for (const id of list) {
    if (records[id]) continue
    records[id] = now
    changed++
  }
  if (changed) saveNotifyRecords(records)
  return changed
}

/**
 * 生成未来一段时间内的定时提醒条目。
 * @returns {Array<{id, at, title, content, payload}>}
 */
export function buildSchedule(products, settings, { days = SCHEDULE_DAYS, now = Date.now() } = {}) {
  if (!settings || settings.notifyEnabled === false) return []
  const defaultRd = Number(settings.defaultReminderDays) || 0
  const notifyTime = settings.notifyTime || '09:00'
  const until = now + days * DAY_MS
  const entries = []

  for (const p of products || []) {
    if (!p || !p.expiryDate) continue
    const rd = effectiveReminderDays(p, defaultRd)

    const points = []
    // 提前 0 天时 adv 与到期日是同一天，排两条会在同一时刻弹两次通知
    if (rd > 0) {
      points.push({ date: offsetDateStr(p.expiryDate, -rd, 'day'), type: 'advance', days: rd })
    }
    points.push({ date: p.expiryDate, type: 'expiry', days: 0 })

    for (const pt of points) {
      const at = atTimeOfDay(pt.date, notifyTime)
      if (at <= now || at > until) continue
      const item = { product: p, type: pt.type, days: pt.days }
      entries.push({
        id: item.type === 'advance' ? advanceKey(p, rd) : expiryKey(p),
        at,
        ...buildMessage(item)
      })
    }
  }

  // 越早的提醒越重要，超出上限时优先保留最近的
  entries.sort((a, b) => a.at - b.at)
  return entries.slice(0, MAX_SCHEDULE_ENTRIES)
}

/**
 * 全量重排原生定时器，返回排程条目数。
 * 已经通过「打开 App 时扫描」发过的提醒不再排程，避免同一件事通知两次。
 */
export function reschedule(products, settings) {
  const records = loadNotifyRecords()
  const entries = buildSchedule(products, settings).filter(e => !records[e.id])
  const ok = notify.scheduleAll(entries)
  return { count: entries.length, native: ok }
}

/**
 * 清理失效的通知记录：
 * 1. 商品已删除
 * 2. 商品已续费，key 里的旧到期日与当前 expiryDate 不一致
 * 避免去重表随续费次数无限增长。
 */
export function pruneNotifyRecords(products) {
  const records = loadNotifyRecords()
  const currentExpiry = new Map()
  for (const product of products || []) {
    if (product && product.id) currentExpiry.set(product.id, String(product.expiryDate || ''))
  }

  let changed = false
  for (const key of Object.keys(records)) {
    const [id, expiry] = key.split('|')
    const expected = currentExpiry.get(id)
    if (expected === undefined || expiry !== expected) {
      delete records[key]
      changed = true
    }
  }

  if (changed) saveNotifyRecords(records)
  return changed
}
