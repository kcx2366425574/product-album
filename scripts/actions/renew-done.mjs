import { addProduct } from './helpers.mjs'

export default async function (page) {
  await addProduct(page)
  await page.locator('.product-card').first().click()
  await page.waitForTimeout(1500)
  await page.locator('.btn-primary', { hasText: '续费' }).click()
  await page.waitForTimeout(800)

  const sheetInputs = page.locator('.sheet input')
  await sheetInputs.nth(0).fill('30')
  await sheetInputs.nth(1).fill('99')
  await sheetInputs.nth(2).fill('续费一个月')

  await page.getByText('确认续费', { exact: true }).click()
  await page.waitForTimeout(1500)
}
