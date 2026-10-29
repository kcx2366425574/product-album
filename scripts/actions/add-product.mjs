import path from 'node:path'

export default async function (page) {
  // 1. 进入新建页
  await page.getByText('添加第一个商品', { exact: true }).click()
  await page.waitForTimeout(1200)

  // 2. 填名称（编辑页第一个 input 是商品名称）
  const inputs = page.locator('input')
  await inputs.nth(0).fill('测试商品 · 品牌授权图包')
  await inputs.nth(1).fill('服装')
  await inputs.nth(2).fill('授权 秋冬')

  // 3. 点"添加"图片，接住文件选择框
  const chooserPromise = page.waitForEvent('filechooser', { timeout: 8000 })
  await page.getByText('添加', { exact: true }).click()
  const chooser = await chooserPromise
  await chooser.setFiles(path.resolve('src/static/logo.png'))
  await page.waitForTimeout(2000)

  // 4. 保存
  await page.getByText('保存商品', { exact: true }).click()
  await page.waitForTimeout(2000)
}
