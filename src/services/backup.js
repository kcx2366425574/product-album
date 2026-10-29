/**
 * 数据备份与恢复。
 *
 * 备份文件是 JSON：商品元数据 + 图片 base64 + 全局设置。
 * 图片 base64 会让文件偏大，但换来"一个文件就能换手机"的简单性。
 */
import { normalizeProduct } from './db'
import { imageToDataUrl, importFromDataUrl } from './imageStore'
import { makeId } from '@/utils/id'
import { todayStr } from '@/utils/date'

export const BACKUP_APP = 'product-album'
export const BACKUP_VERSION = 1

const SETTINGS_KEYS = ['defaultReminderDays', 'notifyTime', 'notifyEnabled', 'theme']

export function sanitizeSettings(settings) {
  const out = {}
  for (const key of SETTINGS_KEYS) {
    if (settings && settings[key] !== undefined) out[key] = settings[key]
  }
  return out
}

/**
 * 纯函数：把商品、设置和图片数据组装成备份对象。
 * @param {Array} products
 * @param {object} settings
 * @param {Record<string,string>} imageData imageId → data URL
 */
export function buildBackup(products, settings, imageData = {}) {
  return {
    app: BACKUP_APP,
    schemaVersion: BACKUP_VERSION,
    exportedAt: Date.now(),
    settings: sanitizeSettings(settings),
    products: (products || []).map(product => ({
      ...product,
      images: (product.images || []).map(image => ({
        id: image.id,
        w: image.w || 0,
        h: image.h || 0,
        size: image.size || 0,
        data: imageData[image.id] || ''
      }))
    }))
  }
}

/**
 * 读取所有图片并生成备份对象。
 * @param {Function} readImage 可注入，便于测试
 */
export async function createBackup(products, settings, readImage = imageToDataUrl) {
  const imageData = {}

  for (const product of products || []) {
    for (const image of product.images || []) {
      if (!image || !image.id || imageData[image.id] !== undefined) continue
      try {
        imageData[image.id] = (await readImage(image)) || ''
      } catch (e) {
        imageData[image.id] = ''
      }
    }
  }

  return buildBackup(products, settings, imageData)
}

/** 校验备份文本，返回解析后的对象；格式不对时抛出可读错误 */
export function parseBackup(text) {
  let data
  try {
    data = JSON.parse(String(text || ''))
  } catch (e) {
    throw new Error('备份文件不是有效的 JSON')
  }

  if (!data || data.app !== BACKUP_APP) {
    throw new Error('不是商品图册的备份文件')
  }
  const version = Number(data.schemaVersion) || 0
  if (version > BACKUP_VERSION) {
    throw new Error('备份文件版本过新，请先升级 App')
  }
  if (!Array.isArray(data.products)) {
    throw new Error('备份文件缺少商品列表')
  }
  if (data.settings !== undefined && (data.settings === null || typeof data.settings !== 'object')) {
    throw new Error('备份文件设置格式不正确')
  }

  return data
}

/**
 * 恢复图片并把商品规范化。
 * @param {Function} createImage 可注入，便于测试
 * @returns {Promise<{products, settings, createdImages, stats}>}
 */
export async function prepareImport(backup, { createImage = importFromDataUrl, onProgress } = {}) {
  const products = []
  const createdImages = []
  let importedImages = 0
  let failedImages = 0
  let totalImages = 0

  for (const raw of backup.products || []) {
    if (!raw || typeof raw !== 'object') continue

    const images = []
    for (const image of Array.isArray(raw.images) ? raw.images : []) {
      totalImages++
      if (!image || !image.data) {
        failedImages++
        continue
      }
      try {
        const meta = await createImage(image.data)
        if (meta && meta.id) {
          images.push(meta)
          createdImages.push(meta)
          importedImages++
        } else {
          failedImages++
        }
      } catch (e) {
        failedImages++
      }
      if (onProgress) {
        onProgress({ importedImages, failedImages, totalImages })
      }
    }

    const normalized = normalizeProduct({
      ...raw,
      id: raw.id || makeId('p'),
      images
    })
    if (normalized) products.push(normalized)
  }

  // 同一份备份里出现重复 id 时，以最后一条为准
  const byId = new Map()
  for (const product of products) byId.set(product.id, product)

  return {
    products: [...byId.values()],
    settings: sanitizeSettings(backup.settings),
    createdImages,
    stats: { importedImages, failedImages, totalImages }
  }
}

/* ------------------------------------------------------------------ */
/* 文件导出 / 选择（按平台分支）                                       */
/* ------------------------------------------------------------------ */
// #ifdef H5
function downloadBackupFileH5(backup) {
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `商品图册备份-${todayStr()}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function pickBackupFileH5() {
  return new Promise((resolve, reject) => {
    uni.chooseFile({
      count: 1,
      extension: ['.json'],
      success: async res => {
        const path = res.tempFilePaths && res.tempFilePaths[0]
        if (!path) {
          reject(new Error('没有选择文件'))
          return
        }
        try {
          const resp = await fetch(path)
          resolve(await resp.text())
        } catch (e) {
          reject(new Error('读取备份文件失败'))
        }
      },
      fail: err => reject(new Error((err && err.errMsg) || '选择文件失败'))
    })
  })
}
// #endif

// #ifdef APP-PLUS
function writeTextApp(text, fileName) {
  return new Promise((resolve, reject) => {
    plus.io.resolveLocalFileSystemURL(
      '_doc/',
      dir => {
        dir.getFile(
          fileName,
          { create: true },
          entry => {
            entry.createWriter(
              writer => {
                writer.onwrite = () => resolve(entry.toLocalURL())
                writer.onerror = err => reject(err)
                writer.write(text)
              },
              err => reject(err)
            )
          },
          err => reject(err)
        )
      },
      err => reject(err)
    )
  })
}

async function downloadBackupFileApp(backup) {
  const path = await writeTextApp(JSON.stringify(backup), `pa-backup-${Date.now()}.json`)
  await new Promise((resolve, reject) => {
    plus.share.sendWithSystem(
      { type: 'file', path },
      () => resolve(),
      () => reject(new Error('调起系统分享失败'))
    )
  })
}

function pickBackupFileApp() {
  return new Promise((resolve, reject) => {
    uni.chooseFile({
      count: 1,
      extension: ['.json'],
      success: res => {
        const path = res.tempFilePaths && res.tempFilePaths[0]
        if (!path) {
          reject(new Error('没有选择文件'))
          return
        }
        plus.io.resolveLocalFileSystemURL(
          path,
          entry => {
            entry.file(
              file => {
                const reader = new plus.io.FileReader()
                reader.onloadend = e => resolve((e.target && e.target.result) || '')
                reader.onerror = () => reject(new Error('读取备份文件失败'))
                reader.readAsText(file, 'utf-8')
              },
              () => reject(new Error('读取备份文件失败'))
            )
          },
          () => reject(new Error('读取备份文件失败'))
        )
      },
      fail: err => reject(new Error((err && err.errMsg) || '选择文件失败'))
    })
  })
}
// #endif

export function downloadBackupFile(backup) {
  // #ifdef H5
  return downloadBackupFileH5(backup)
  // #endif
  // #ifdef APP-PLUS
  return downloadBackupFileApp(backup)
  // #endif
}

export function pickBackupFile() {
  // #ifdef H5
  return pickBackupFileH5()
  // #endif
  // #ifdef APP-PLUS
  return pickBackupFileApp()
  // #endif
}
