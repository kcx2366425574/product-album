/**
 * 花费统计：纯函数，方便单测。
 * 金额来自商品购买价 purchaseAmount 和续费记录 renewals[].amount。
 */

function toAmount(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function round2(n) {
  return Math.round(n * 100) / 100
}

/** 单个商品累计花费：购买金额 + 所有续费金额 */
export function productSpend(product) {
  if (!product) return 0
  let total = toAmount(product.purchaseAmount)
  for (const renewal of product.renewals || []) {
    total += toAmount(renewal && renewal.amount)
  }
  return round2(total)
}

/**
 * @param {Array} products
 * @param {string} today YYYY-MM-DD
 * @returns {{total:number, month:number, year:number, renewalCount:number}}
 */
export function spendSummary(products, today) {
  const day = String(today || '')
  const monthKey = day.slice(0, 7)
  const yearKey = day.slice(0, 4)

  let total = 0
  let month = 0
  let year = 0
  let renewalCount = 0

  for (const product of products || []) {
    if (!product) continue

    const purchase = toAmount(product.purchaseAmount)
    if (purchase) {
      total += purchase
      if (product.purchaseDate && String(product.purchaseDate).slice(0, 7) === monthKey) {
        month += purchase
      }
      if (product.purchaseDate && String(product.purchaseDate).slice(0, 4) === yearKey) {
        year += purchase
      }
    }

    for (const renewal of product.renewals || []) {
      const amount = toAmount(renewal && renewal.amount)
      if (!amount) continue
      total += amount
      renewalCount++
      if (renewal.date && String(renewal.date).slice(0, 7) === monthKey) month += amount
      if (renewal.date && String(renewal.date).slice(0, 4) === yearKey) year += amount
    }
  }

  return {
    total: round2(total),
    month: round2(month),
    year: round2(year),
    renewalCount
  }
}
