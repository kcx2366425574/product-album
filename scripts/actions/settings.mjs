import { addProduct } from './helpers.mjs'

export default async function (page) {
  await addProduct(page)
  await page.locator('.settings-btn').click()
  await page.waitForTimeout(1500)
}
