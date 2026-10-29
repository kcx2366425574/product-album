/**
 * 图片存储抽象层。
 *
 * - H5：压缩后以 Blob 存 IndexedDB（localStorage 只有 5MB，存不下图片）
 * - App：用 plus.zip 压缩后写入 App 私有目录 _doc/
 *
 * 对外统一暴露 imageId，只有 App 端的元数据里额外带 path。
 * 注意：H5 的 URL.createObjectURL 地址只在当前页面生命周期有效，
 * 绝对不能把它持久化到商品数据里。
 */
import { makeId } from '@/utils/id'

const MAX_SIDE = 1600
const THUMB_SIDE = 480
const JPEG_QUALITY = 0.82
const THUMB_QUALITY = 0.75

/**
 * 导入 uni.chooseImage 的结果。
 * @returns {Promise<Array<{id:string,w:number,h:number,size:number,path:string}>>}
 */
export async function importFromChooseResult(res) {
  const paths = (res && res.tempFilePaths) || []
  const files = (res && res.tempFiles) || []
  const out = []
  for (let i = 0; i < paths.length; i++) {
    try {
      const meta = await importOne(paths[i], files[i])
      if (meta) out.push(meta)
    } catch (e) {
      console.error('[imageStore] 导入图片失败', e)
    }
  }
  return out
}

/* ------------------------------------------------------------------ */
/* H5                                                                  */
/* ------------------------------------------------------------------ */
// #ifdef H5
const DB_NAME = 'product-album'
const DB_VERSION = 1
const STORE_NAME = 'images'

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前浏览器不支持 IndexedDB'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

async function idbGet(key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(key)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

async function idbPut(key, value) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(value, key)
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => reject(tx.error)
  })
}

async function idbDelete(key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => reject(tx.error)
  })
}

function loadImageEl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })
}

function renderSize(img, maxSide) {
  const w0 = img.naturalWidth || img.width
  const h0 = img.naturalHeight || img.height
  const scale = Math.min(1, maxSide / Math.max(w0, h0))
  return { w: Math.max(1, Math.round(w0 * scale)), h: Math.max(1, Math.round(h0 * scale)) }
}

function drawJpeg(img, size, quality) {
  const canvas = document.createElement('canvas')
  canvas.width = size.w
  canvas.height = size.h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, size.w, size.h)
  ctx.drawImage(img, 0, 0, size.w, size.h)
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
}

async function importOne(tempPath, file) {
  let source = file
  if (!(source instanceof Blob)) {
    const resp = await fetch(tempPath)
    source = await resp.blob()
  }

  const objectUrl = URL.createObjectURL(source)
  try {
    const img = await loadImageEl(objectUrl)
    const fullSize = renderSize(img, MAX_SIDE)
    const fullBlob = (await drawJpeg(img, fullSize, JPEG_QUALITY)) || source

    const id = makeId('img')
    await idbPut(id, fullBlob)

    // 列表只展示缩略图，避免每张卡片都解码 1600px 原图
    const thumbSize = renderSize(img, THUMB_SIDE)
    const thumbBlob = await drawJpeg(img, thumbSize, THUMB_QUALITY)
    let thumbId = ''
    if (thumbBlob) {
      thumbId = `${id}__thumb`
      await idbPut(thumbId, thumbBlob)
    }

    return {
      id,
      w: fullSize.w,
      h: fullSize.h,
      size: fullBlob.size,
      path: '',
      thumbId,
      thumbW: thumbSize.w,
      thumbH: thumbSize.h
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

const urlCache = new Map()

export async function resolveImageUrl(meta, options = {}) {
  if (!meta || !meta.id) return ''
  const wantThumb = !!(options && options.thumb)
  const key = wantThumb && meta.thumbId ? meta.thumbId : meta.id
  if (urlCache.has(key)) return urlCache.get(key)
  try {
    let blob = await idbGet(key)
    // 老数据没有缩略图时回退到原图
    if (!blob && key !== meta.id) blob = await idbGet(meta.id)
    if (!blob) return ''
    const url = URL.createObjectURL(blob)
    urlCache.set(key, url)
    return url
  } catch (e) {
    console.error('[imageStore] 读取图片失败', e)
    return ''
  }
}

export async function removeImage(meta) {
  if (!meta || !meta.id) return
  const keys = [meta.id, meta.thumbId].filter(Boolean)
  for (const key of keys) {
    const cached = urlCache.get(key)
    if (cached) {
      URL.revokeObjectURL(cached)
      urlCache.delete(key)
    }
  }
  try {
    await Promise.all(keys.map(key => idbDelete(key)))
  } catch (e) {
    console.error('[imageStore] 删除图片失败', e)
  }
}

export async function imageToDataUrl(meta) {
  if (!meta || !meta.id) return ''
  const blob = await idbGet(meta.id)
  if (!blob) return ''
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
// #endif

/* ------------------------------------------------------------------ */
/* App                                                                */
/* ------------------------------------------------------------------ */
// #ifdef APP-PLUS
function compressAppImage(src, id, { suffix = '', maxSide = MAX_SIDE, quality = 82 } = {}) {
  return new Promise(resolve => {
    const dst = `_doc/pa_${id}${suffix}.jpg`
    plus.zip.compressImage(
      { src, dst, quality, width: `${maxSide}px`, overwrite: true },
      () => resolve(dst),
      err => {
        console.warn('[imageStore] 压缩失败，改用原图', err)
        resolve('')
      }
    )
  })
}

function saveFileApp(tempFilePath) {
  return new Promise((resolve, reject) => {
    uni.saveFile({
      tempFilePath,
      success: r => resolve(r.savedFilePath),
      fail: err => reject(err)
    })
  })
}

function getImageInfoApp(src) {
  return new Promise(resolve => {
    uni.getImageInfo({
      src,
      success: r => resolve(r),
      fail: () => resolve({ width: 0, height: 0 })
    })
  })
}

function getFileSizeApp(filePath) {
  return new Promise(resolve => {
    uni.getFileInfo({
      filePath,
      success: r => resolve(r.size || 0),
      fail: () => resolve(0)
    })
  })
}

async function importOne(tempPath) {
  const id = makeId('img')
  let finalPath = await compressAppImage(tempPath, id)
  if (!finalPath) finalPath = await saveFileApp(tempPath)
  const info = await getImageInfoApp(finalPath)
  const size = await getFileSizeApp(finalPath)

  const thumbPath = await compressAppImage(tempPath, id, {
    suffix: '_thumb',
    maxSide: THUMB_SIDE,
    quality: 75
  })

  return {
    id,
    w: info.width || 0,
    h: info.height || 0,
    size,
    path: finalPath,
    thumbPath,
    thumbW: 0,
    thumbH: 0
  }
}

export async function resolveImageUrl(meta, options = {}) {
  if (!meta) return ''
  if (options && options.thumb && meta.thumbPath) return meta.thumbPath
  return meta.path || ''
}

function removeFileApp(path) {
  return new Promise(resolve => {
    plus.io.resolveLocalFileSystemURL(
      path,
      entry => entry.remove(() => resolve(), () => resolve()),
      () => resolve()
    )
  })
}

export function removeImage(meta) {
  if (!meta) return Promise.resolve()
  const paths = [meta.path, meta.thumbPath].filter(Boolean)
  return Promise.all(paths.map(removeFileApp))
}

export async function imageToDataUrl(meta) {
  return new Promise(resolve => {
    if (!meta || !meta.path) {
      resolve('')
      return
    }
    plus.io.resolveLocalFileSystemURL(
      meta.path,
      entry => {
        entry.file(
          file => {
            const reader = new plus.io.FileReader()
            reader.onloadend = e => resolve((e.target && e.target.result) || '')
            reader.onerror = () => resolve('')
            reader.readAsDataURL(file)
          },
          () => resolve('')
        )
      },
      () => resolve('')
    )
  })
}
// #endif
