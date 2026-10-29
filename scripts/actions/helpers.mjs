import path from 'node:path'

/**
 * 在空数据状态下新建一个商品。
 * @param {import('playwright-core').Page} page
 */
export async function addProduct(page, opts = {}) {
  const { name = '测试商品 · 品牌授权图包', category = '服装', tags = '授权 秋冬', withImage = true } = opts

  await page.getByText('添加第一个商品', { exact: true }).click()
  await page.waitForTimeout(1200)

  const inputs = page.locator('input')
  await inputs.nth(0).fill(name)
  await inputs.nth(1).fill(category)
  await inputs.nth(2).fill(tags)

  if (withImage) {
    const chooserPromise = page.waitForEvent('filechooser', { timeout: 8000 })
    await page.getByText('添加', { exact: true }).click()
    const chooser = await chooserPromise
    await chooser.setFiles(path.resolve('src/static/logo.png'))
    await page.waitForTimeout(1800)
  }

  await page.getByText('保存商品', { exact: true }).click()
  await page.waitForTimeout(1800)
}
