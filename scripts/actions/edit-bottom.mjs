import { addProduct } from './helpers.mjs'

export default async function (page) {
  await addProduct(page)
  await page.locator('.product-card').first().click()
  await page.waitForTimeout(1000)
  await page.locator('.btn-ghost', { hasText: '编辑' }).click()
  await page.waitForTimeout(1200)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(600)
}
