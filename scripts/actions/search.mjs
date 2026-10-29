import seedDue from './seed-due.mjs'

export default async function (page) {
  await seedDue(page)
  // 关掉到期提醒弹窗
  const ok = page.getByText('知道了', { exact: true })
  if (await ok.count()) {
    await ok.click()
    await page.waitForTimeout(600)
  }
  await page.locator('.search-input input').fill('三天')
  await page.waitForTimeout(1000)
}
