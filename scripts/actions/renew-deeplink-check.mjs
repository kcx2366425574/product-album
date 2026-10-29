import { addProduct } from './helpers.mjs'

/**
 * 端到端验证：带 renew=1 进入详情页时自动打开续费面板。
 * 对应"到期/已过期"通知点击后的行为。
 */
export default async function (page) {
  await addProduct(page)

  const productId = await page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem('pa.products.v1') || '[]')
    return list[0] && list[0].id
  })
  if (!productId) throw new Error('没有找到商品 ID')

  const base = page.url().split('#')[0]
  await page.goto(
    `${base}#/pages/detail/detail?id=${encodeURIComponent(productId)}&renew=1`,
    { waitUntil: 'domcontentloaded' }
  )
  await page.waitForTimeout(2200)

  const sheetVisible = await page.locator('.sheet').isVisible()
  const title = (await page.locator('.sheet-title').textContent().catch(() => '')) || ''

  const errors = []
  if (!sheetVisible) errors.push('续费面板没有自动打开')
  if (!title.includes('续费')) errors.push(`面板标题不对: ${title}`)

  console.log(JSON.stringify({ productId, sheetVisible, title, errors }, null, 2))
  if (errors.length) throw new Error(errors.join('; '))
}
