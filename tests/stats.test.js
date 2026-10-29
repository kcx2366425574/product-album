import { describe, expect, it } from 'vitest'
import { productSpend, spendSummary } from '@/services/stats'

const products = [
  {
    id: 'p1',
    purchaseDate: '2026-10-01',
    purchaseAmount: 100,
    renewals: [
      { date: '2026-10-05', amount: 30 },
      { date: '2025-12-01', amount: 20 }
    ]
  },
  {
    id: 'p2',
    purchaseDate: '2025-06-01',
    purchaseAmount: 50,
    renewals: [{ date: '2026-01-02', amount: 10 }]
  }
]

describe('productSpend', () => {
  it('累计购买金额与续费金额', () => {
    expect(productSpend(products[0])).toBe(150)
  })

  it('忽略缺失、非法和负数金额', () => {
    expect(productSpend({ purchaseAmount: 'abc', renewals: [{ amount: -5 }, null, {}] })).toBe(0)
  })

  it('空商品返回 0', () => {
    expect(productSpend(null)).toBe(0)
  })

  it('处理小数精度', () => {
    expect(productSpend({ purchaseAmount: 0.1, renewals: [{ amount: 0.2 }] })).toBe(0.3)
  })
})

describe('spendSummary', () => {
  it('统计累计、本月、今年和续费次数', () => {
    expect(spendSummary(products, '2026-10-29')).toEqual({
      total: 210,
      month: 130,
      year: 140,
      renewalCount: 3
    })
  })

  it('没有金额时全为 0', () => {
    expect(spendSummary([{ purchaseDate: '2026-10-01', renewals: [] }], '2026-10-29')).toEqual({
      total: 0,
      month: 0,
      year: 0,
      renewalCount: 0
    })
  })

  it('空列表安全返回', () => {
    expect(spendSummary(null, '2026-10-29')).toEqual({
      total: 0,
      month: 0,
      year: 0,
      renewalCount: 0
    })
  })
})
