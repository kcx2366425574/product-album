import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadProducts, removeProduct, saveProducts, upsertProduct } from '@/services/db'

const storage = new Map()
let failWrites = false
let errorSpy

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  storage.clear()
  failWrites = false
  vi.stubGlobal('uni', {
    getStorageSync: key => (storage.has(key) ? storage.get(key) : ''),
    setStorageSync: (key, value) => {
      if (failWrites) throw new Error('quota exceeded')
      storage.set(key, value)
    }
  })
})

afterEach(() => {
  errorSpy.mockRestore()
})

function product(overrides = {}) {
  return {
    id: 'p1',
    name: '测试商品',
    purchaseDate: '2026-10-01',
    durationValue: 30,
    durationUnit: 'day',
    ...overrides
  }
}

describe('db 写入失败处理', () => {
  it('正常保存返回商品并落库', () => {
    const saved = upsertProduct(product())
    expect(saved).not.toBeNull()
    expect(loadProducts()).toHaveLength(1)
    expect(loadProducts()[0].name).toBe('测试商品')
  })

  it('写入失败时返回 null，原数据保持不变', () => {
    upsertProduct(product())
    failWrites = true

    expect(upsertProduct(product({ name: '新名字' }))).toBeNull()
    expect(loadProducts()).toHaveLength(1)
    expect(loadProducts()[0].name).toBe('测试商品')
  })

  it('删除失败返回 false，成功后返回 true', () => {
    upsertProduct(product())

    failWrites = true
    expect(removeProduct('p1')).toBe(false)
    expect(loadProducts()).toHaveLength(1)

    failWrites = false
    expect(removeProduct('p1')).toBe(true)
    expect(loadProducts()).toHaveLength(0)
  })

  it('saveProducts 直接返回写入结果', () => {
    failWrites = true
    expect(saveProducts([])).toBe(false)

    failWrites = false
    expect(saveProducts([])).toBe(true)
  })
})
