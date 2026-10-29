import { describe, expect, it } from 'vitest'
import { formatBytes, imageStats } from '@/services/storage'

describe('imageStats', () => {
  it('统计图片数量和字节数', () => {
    const products = [
      { images: [{ size: 1000 }, { size: 2048 }] },
      { images: [{ size: 500 }] },
      { images: [] }
    ]
    expect(imageStats(products)).toEqual({ count: 3, bytes: 3548 })
  })

  it('忽略缺失和非法 size', () => {
    expect(imageStats([{ images: [{}, { size: 'abc' }, { size: -1 }] }])).toEqual({
      count: 3,
      bytes: 0
    })
  })

  it('空数据安全返回', () => {
    expect(imageStats(null)).toEqual({ count: 0, bytes: 0 })
  })
})

describe('formatBytes', () => {
  it('按 B/KB/MB/GB 格式化', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe('2.00 GB')
  })

  it('非法值返回 0 B', () => {
    expect(formatBytes(undefined)).toBe('0 B')
    expect(formatBytes(-10)).toBe('0 B')
  })
})
