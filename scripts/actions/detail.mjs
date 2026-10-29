import { addProduct } from './helpers.mjs'

export default async function (page) {
  await addProduct(page)
  await page.locator('.product-card').first().click()
  await page.waitForTimeout(2000)
}
