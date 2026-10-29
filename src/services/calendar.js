/**
 * 到期日历的纯计算逻辑。
 * 月份统一使用 1-based，日期统一使用 YYYY-MM-DD。
 */
import { formatDate } from '@/utils/date'

export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/**
 * 生成 6x7 的月历格子（总是 42 格，前后补上月/下月日期）。
 * @param {number} year
 * @param {number} month 1-based
 * @param {string} today YYYY-MM-DD
 */
export function buildMonthGrid(year, month, today = '') {
  const first = new Date(year, month - 1, 1)
  const offset = first.getDay()

  const cells = []
  for (let i = 0; i < 42; i++) {
    const date = new Date(year, month - 1, i - offset + 1)
    const dateStr = formatDate(date)
    cells.push({
      date: dateStr,
      day: date.getDate(),
      inMonth: date.getFullYear() === year && date.getMonth() === month - 1,
      isToday: dateStr === today
    })
  }
  return cells
}

/** 按到期日分组：{ 'YYYY-MM-DD': Product[] } */
export function groupExpiries(products) {
  const map = {}
  for (const product of products || []) {
    if (!product || !product.expiryDate) continue
    if (!map[product.expiryDate]) map[product.expiryDate] = []
    map[product.expiryDate].push(product)
  }
  return map
}

/** 指定月份内到期的商品数量 */
export function monthExpiryCount(products, year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`
  let count = 0
  for (const product of products || []) {
    if (product && String(product.expiryDate || '').startsWith(prefix)) count++
  }
  return count
}
