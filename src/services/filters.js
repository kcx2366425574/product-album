/**
 * 首页筛选与排序的纯函数。
 */
import { daysLeft } from './expiry'

export const SORT_OPTIONS = [
  { value: 'expiry', label: '按到期日' },
  { value: 'updated', label: '按最近更新' },
  { value: 'name', label: '按名称' }
]

/**
 * @param {Array} products
 * @param {'expiry'|'updated'|'name'} sort
 * @param {string} today
 */
export function sortProducts(products, sort, today) {
  const list = (products || []).slice()

  if (sort === 'updated') {
    return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  }

  if (sort === 'name') {
    return list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN'))
  }

  // 默认按到期日：越早到期越靠前，同一天按最近更新排序
  return list.sort((a, b) => {
    const da = daysLeft(a.expiryDate, today)
    const db = daysLeft(b.expiryDate, today)
    if (da !== db) return da - db
    return (b.updatedAt || 0) - (a.updatedAt || 0)
  })
}

/** 统计有商品的分类，按数量降序、名称升序 */
export function categorySummary(products) {
  const map = new Map()
  for (const product of products || []) {
    const name = String((product && product.category) || '').trim()
    if (!name) continue
    map.set(name, (map.get(name) || 0) + 1)
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))
}
