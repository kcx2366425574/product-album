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

  it('规范化时保留图片缩略图字段', () => {
    upsertProduct(
      product({
        images: [
          {
            id: 'img1',
            w: 1600,
            h: 1200,
            size: 1000,
            path: '',
            thumbId: 'img1__thumb',
            thumbPath: '',
            thumbW: 480,
            thumbH: 360
          }
        ]
      })
    )

    const image = loadProducts()[0].images[0]
    expect(image.thumbId).toBe('img1__thumb')
    expect(image.thumbW).toBe(480)
    expect(image.thumbH).toBe(360)
  })

  it('规范化购买金额，负数归零', () => {
    upsertProduct(product({ purchaseAmount: '99.5' }))
    expect(loadProducts()[0].purchaseAmount).toBe(99.5)

    upsertProduct(product({ id: 'p2', purchaseAmount: -10 }))
    expect(loadProducts().find(item => item.id === 'p2').purchaseAmount).toBe(0)
  })

  it('老数据缺少缩略图字段时安全回退为空值', () => {
    upsertProduct(
      product({ images: [{ id: 'img1', w: 1600, h: 1200, size: 1000, path: '' }] })
    )

    const image = loadProducts()[0].images[0]
    expect(image.thumbId).toBe('')
    expect(image.thumbPath).toBe('')
    expect(image.thumbW).toBe(0)
  })
})
