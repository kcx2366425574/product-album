import { addProduct } from './helpers.mjs'

export default async function (page) {
  await addProduct(page)
  await page.locator('.product-card').first().click()
  await page.waitForTimeout(1500)
  await page.locator('.btn-primary', { hasText: '续费' }).click()
  await page.waitForTimeout(1000)
}
