import { describe, expect, it } from 'vitest'
import { categorySummary, sortProducts } from '@/services/filters'

const today = '2026-10-29'
const products = [
  { id: 'a', name: 'B 商品', expiryDate: '2026-11-05', updatedAt: 100, category: '服装' },
  { id: 'b', name: 'A 商品', expiryDate: '2026-10-30', updatedAt: 300, category: '服装' },
  { id: 'c', name: 'C 商品', expiryDate: '2026-11-05', updatedAt: 200, category: '食品' },
  { id: 'd', name: 'D 商品', expiryDate: '2026-11-01', updatedAt: 50, category: '' }
]

describe('sortProducts', () => {
  it('按到期日排序，同一天按最近更新', () => {
    expect(sortProducts(products, 'expiry', today).map(item => item.id)).toEqual([
      'b',
      'd',
      'c',
      'a'
    ])
  })

  it('按最近更新排序', () => {
    expect(sortProducts(products, 'updated', today).map(item => item.id)).toEqual([
      'b',
      'c',
      'a',
      'd'
    ])
  })

  it('按名称排序', () => {
    expect(sortProducts(products, 'name', today).map(item => item.id)).toEqual([
      'b',
      'a',
      'c',
      'd'
    ])
  })

  it('未知排序方式回退为到期日', () => {
    expect(sortProducts(products, 'unknown', today).map(item => item.id)).toEqual([
      'b',
      'd',
      'c',
      'a'
    ])
  })

  it('不修改原数组', () => {
    const original = products.map(item => item.id)
    sortProducts(products, 'name', today)
    expect(products.map(item => item.id)).toEqual(original)
  })
})

describe('categorySummary', () => {
  it('统计分类并按数量、名称排序', () => {
    expect(categorySummary(products)).toEqual([
      { name: '服装', count: 2 },
      { name: '食品', count: 1 }
    ])
  })

  it('忽略空分类', () => {
    expect(categorySummary([{ category: '' }, { category: '  ' }, {}])).toEqual([])
  })
})
