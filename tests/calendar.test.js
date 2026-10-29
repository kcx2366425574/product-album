import { describe, expect, it } from 'vitest'
import { buildMonthGrid, groupExpiries, monthExpiryCount } from '@/services/calendar'

describe('buildMonthGrid', () => {
  it('总是生成 42 个格子', () => {
    expect(buildMonthGrid(2026, 10, '2026-10-29')).toHaveLength(42)
  })

  it('2026 年 10 月 1 日是周四，前面补 4 天', () => {
    const cells = buildMonthGrid(2026, 10, '2026-10-29')
    expect(cells[0].date).toBe('2026-09-27')
    expect(cells[4].date).toBe('2026-10-01')
    expect(cells[4].inMonth).toBe(true)
  })

  it('正确标记本月、非本月和今天', () => {
    const cells = buildMonthGrid(2026, 10, '2026-10-29')
    expect(cells[0].inMonth).toBe(false)
    expect(cells.find(cell => cell.date === '2026-10-29').isToday).toBe(true)
    expect(cells.find(cell => cell.date === '2026-11-01').inMonth).toBe(false)
  })

  it('覆盖 31 天的月份', () => {
    const cells = buildMonthGrid(2026, 12, '2026-12-01')
    const december = cells.filter(cell => cell.inMonth)
    expect(december).toHaveLength(31)
    expect(december[30].date).toBe('2026-12-31')
  })
})

describe('groupExpiries', () => {
  const products = [
    { id: 'a', expiryDate: '2026-10-05' },
    { id: 'b', expiryDate: '2026-10-05' },
    { id: 'c', expiryDate: '2026-10-15' },
    { id: 'd', expiryDate: '' }
  ]

  it('按到期日分组，忽略空日期', () => {
    const map = groupExpiries(products)
    expect(map['2026-10-05']).toHaveLength(2)
    expect(map['2026-10-15']).toHaveLength(1)
    expect(Object.keys(map)).toHaveLength(2)
  })
})

describe('monthExpiryCount', () => {
  const products = [
    { expiryDate: '2026-10-05' },
    { expiryDate: '2026-10-31' },
    { expiryDate: '2026-11-01' },
    { expiryDate: '' }
  ]

  it('只统计指定月份', () => {
    expect(monthExpiryCount(products, 2026, 10)).toBe(2)
    expect(monthExpiryCount(products, 2026, 11)).toBe(1)
    expect(monthExpiryCount(products, 2025, 10)).toBe(0)
  })
})
