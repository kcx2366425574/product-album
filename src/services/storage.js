/**
 * 图片存储统计的纯函数。
 */
export function imageStats(products) {
  let count = 0
  let bytes = 0

  for (const product of products || []) {
    for (const image of (product && product.images) || []) {
      count++
      const size = Number(image && image.size)
      if (Number.isFinite(size) && size > 0) bytes += size
    }
  }

  return { count, bytes }
}

export function formatBytes(value) {
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
