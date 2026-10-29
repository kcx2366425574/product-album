import fs from 'node:fs'
import path from 'node:path'
import { addProduct } from './helpers.mjs'

const BACKUP_PATH = path.resolve('C:/Users/asus/AppData/Local/Temp/pa-backup-test.json')

/**
 * 端到端验证：添加商品 → 导出备份 → 清空 → 从备份导入 → 商品和图片恢复。
 */
export default async function (page) {
  await addProduct(page)

  // 进入设置页
  await page.locator('.settings-btn').click()
  await page.waitForTimeout(1200)

  // 导出备份，接住浏览器下载
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.getByText('导出备份', { exact: true }).click()
  ])
  await download.saveAs(BACKUP_PATH)
  await page.waitForTimeout(1200)

  const backup = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'))
  const errors = []
  if (backup.app !== 'product-album') errors.push('备份 app 标识不正确')
  if (!Array.isArray(backup.products) || backup.products.length !== 1) errors.push('备份商品数量不正确')
  const backupImage = backup.products && backup.products[0] && backup.products[0].images[0]
  if (!backupImage || !String(backupImage.data).startsWith('data:image/')) {
    errors.push('备份中没有图片数据')
  }

  // 清空全部数据
  await page.getByText('清空所有数据', { exact: true }).click()
  await page.locator('.uni-modal__btn_primary').click()
  await page.waitForTimeout(1500)
  if (!(await page.getByText('0 件', { exact: true }).isVisible())) {
    errors.push('清空后商品数量不是 0')
  }

  // 从备份导入
  await page.getByText('从备份导入', { exact: true }).click()
  const chooserPromise = page.waitForEvent('filechooser', { timeout: 8000 })
  await page.locator('.uni-modal__btn_primary').click()
  const chooser = await chooserPromise
  await chooser.setFiles(BACKUP_PATH)
  await page.waitForTimeout(3500)

  if (!(await page.getByText('1 件', { exact: true }).isVisible())) {
    errors.push('导入后商品数量不是 1')
  }

  const keys = await page.evaluate(async () => {
    return new Promise((resolve, reject) => {
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
  })

  if (!keys.some(key => String(key).endsWith('__thumb'))) errors.push('导入后没有缩略图记录')
  if (keys.length < 2) errors.push(`导入后图片记录不足: ${keys.length}`)

  console.log(JSON.stringify({ backupSummary: { app: backup.app, products: backup.products.length }, keys, errors }, null, 2))
  if (errors.length) throw new Error(errors.join('; '))
}
