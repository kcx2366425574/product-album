import fs from 'node:fs'
import path from 'node:path'

const BAD_IMAGE = path.resolve('C:/Users/asus/AppData/Local/Temp/bad-image.png')

/**
 * 端到端验证：选择一个不是图片的文件时，界面提示失败且不产生图片卡片。
 */
export default async function (page) {
  fs.writeFileSync(BAD_IMAGE, 'this is definitely not an image')

  await page.getByText('添加第一个商品', { exact: true }).click()
  await page.waitForTimeout(1200)

  const chooserPromise = page.waitForEvent('filechooser', { timeout: 8000 })
  await page.getByText('添加', { exact: true }).click()
  const chooser = await chooserPromise
  await chooser.setFiles(BAD_IMAGE)
  await page.waitForTimeout(1200)

  // uni-app H5 的 toast 不一定有固定的 .uni-toast 选择器，直接检查页面文本
  const bodyText = (await page.locator('body').textContent()) || ''
  const tileCount = await page.locator('.img-tile').count()

  const errors = []
  if (!bodyText.includes('1 张图片导入失败')) errors.push('没有出现失败提示')
  if (tileCount !== 0) errors.push(`失败文件不应产生图片卡片，实际 ${tileCount} 张`)

  console.log(JSON.stringify({ hasToast: bodyText.includes('1 张图片导入失败'), tileCount, errors }, null, 2))
  if (errors.length) throw new Error(errors.join('; '))
}
