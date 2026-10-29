import { addProduct } from './helpers.mjs'

/**
 * 端到端验证：导入图片后必须同时写入原图和缩略图，
 * 并且首页卡片使用缩略图（Blob URL）。
 */
export default async function (page) {
  // 用一张大图，才能验证列表确实加载了缩小后的缩略图
  await addProduct(page, { imagePath: 'docs/screenshots/home.png' })
  await page.waitForTimeout(1500)

  const data = await page.evaluate(async () => {
    function decodeProducts(raw) {
      try {
        let value = JSON.parse(raw)
        if (typeof value === 'string') value = JSON.parse(value)
        if (value && typeof value === 'object' && !Array.isArray(value) && 'data' in value) {
          value = typeof value.data === 'string' ? JSON.parse(value.data) : value.data
        }
        return Array.isArray(value) ? value : []
      } catch (e) {
        return []
      }
    }

    let products = []
    for (const key of Object.keys(localStorage)) {
      if (!key.includes('pa.products')) continue
      const parsed = decodeProducts(localStorage.getItem(key))
      if (parsed.length) products = parsed
    }

    const keys = await new Promise((resolve, reject) => {
      const req = indexedDB.open('product-album', 1)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('images')) {
          resolve([])
          return
        }
        const tx = db.transaction('images', 'readonly')
        const r = tx.objectStore('images').getAllKeys()
        r.onsuccess = () => resolve(r.result)
        r.onerror = () => reject(r.error)
      }
    })

    const cover = document.querySelector('.cover-img')
    const inner = cover ? cover.querySelector('img') : null
    const coverSrc = (inner && inner.getAttribute('src')) || (cover && cover.getAttribute('src')) || ''

    const coverSize = coverSrc
      ? await new Promise(resolve => {
          const im = new Image()
          im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight })
          im.onerror = () => resolve(null)
          im.src = coverSrc
        })
      : null

    return { products, keys, coverSrc, coverSize }
  })

  const image = data.products[0] && data.products[0].images && data.products[0].images[0]
  const errors = []

  if (!image) {
    errors.push('没有找到商品图片元数据')
  } else {
    if (!image.thumbId || !image.thumbId.endsWith('__thumb')) {
      errors.push(`thumbId 不正确: ${image.thumbId}`)
    }
    if (!data.keys.includes(image.thumbId)) errors.push('IndexedDB 中没有缩略图记录')
    if (!data.keys.includes(image.id)) errors.push('IndexedDB 中没有原图记录')
  }
  if (!String(data.coverSrc).startsWith('blob:')) {
    errors.push(`封面没有使用 Blob URL: ${data.coverSrc}`)
  }
  if (!data.coverSize) {
    errors.push('封面图片加载失败')
  } else if (Math.max(data.coverSize.w, data.coverSize.h) > 480) {
    errors.push(`封面没有使用缩略图，尺寸为 ${data.coverSize.w}x${data.coverSize.h}`)
  }
  if (image && image.thumbW > 0 && Math.max(image.thumbW, image.thumbH) > 480) {
    errors.push(`缩略图元数据尺寸过大: ${image.thumbW}x${image.thumbH}`)
  }

  console.log(
    JSON.stringify(
      { image, keys: data.keys, coverSrc: data.coverSrc, coverSize: data.coverSize, errors },
      null,
      2
    )
  )
  if (errors.length) throw new Error(errors.join('; '))
}
