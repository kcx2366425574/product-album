/**
 * 轻量全局状态。数据量小，不引入 Pinia。
 */
import { computed, reactive } from 'vue'
import * as db from '@/services/db'
import { STATUS, daysLeft, effectiveReminderDays, statusOf } from '@/services/expiry'
import { todayStr } from '@/utils/date'

export const state = reactive({
  products: [],
  settings: db.loadSettings(),
  filter: 'all', // all | soon | expired | normal
  keyword: '',
  inited: false,
  // 响应式的"今天"，跨午夜后由 refreshToday() 更新，驱动所有派生数据重算
  today: todayStr()
})

export function initStore() {
  state.products = db.loadProducts()
  state.settings = db.loadSettings()
  state.today = todayStr()
  state.inited = true
}

/** 日期变化时更新 state.today，返回是否发生了变化 */
export function refreshToday() {
  const today = todayStr()
  if (state.today === today) return false
  state.today = today
  return true
}

export function reloadProducts() {
  state.products = db.loadProducts()
}

export function saveProduct(product) {
  const saved = db.upsertProduct(product)
  reloadProducts()
  return saved
}

export function deleteProduct(id) {
  db.removeProduct(id)
  reloadProducts()
}

export function updateSettings(patch) {
  state.settings = db.saveSettings({ ...state.settings, ...patch })
  return state.settings
}

export const stats = computed(() => {
  const today = state.today
  const rd = state.settings.defaultReminderDays
  const out = { total: 0, normal: 0, soon: 0, expired: 0 }
  for (const p of state.products) {
    out.total++
    const st = statusOf(p, rd, today)
    if (st === STATUS.EXPIRED) out.expired++
    else if (st === STATUS.SOON) out.soon++
    else out.normal++
  }
  return out
})

/** 首页当前筛选条件下的列表 */
export const filteredProducts = computed(() => {
  const today = state.today
  const rd = state.settings.defaultReminderDays
  const kw = String(state.keyword || '').trim().toLowerCase()

  let list = state.products.slice()

  if (state.filter !== 'all') {
    list = list.filter(p => {
      const st = statusOf(p, rd, today)
      if (state.filter === 'soon') return st === STATUS.SOON
      if (state.filter === 'expired') return st === STATUS.EXPIRED
      if (state.filter === 'normal') return st === STATUS.NORMAL
      return true
    })
  }

  if (kw) {
    list = list.filter(p =>
      [p.name, p.category, p.note, ...(p.tags || [])]
        .join(' ')
        .toLowerCase()
        .includes(kw)
    )
  }

  list.sort((a, b) => {
    const da = daysLeft(a.expiryDate, today)
    const db_ = daysLeft(b.expiryDate, today)
    if (da !== db_) return da - db_
    return b.updatedAt - a.updatedAt
  })

  return list
})

/** 首页顶部横幅：需要用户处理的到期项 */
export const dueItems = computed(() => {
  const today = state.today
  const rd = state.settings.defaultReminderDays
  const out = []
  for (const p of state.products) {
    const dl = daysLeft(p.expiryDate, today)
    const limit = effectiveReminderDays(p, rd)
    if (dl < 0) out.push({ product: p, days: dl, type: 'expired' })
    else if (dl <= limit) out.push({ product: p, days: dl, type: dl === 0 ? 'expiry' : 'advance' })
  }
  out.sort((a, b) => a.days - b.days)
  return out
})
