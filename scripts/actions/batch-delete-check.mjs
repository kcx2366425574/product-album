/**
 * 端到端验证：进入管理模式、选中 2 件、批量删除后只剩 1 件。
 */
export default async function (page) {
  await page.evaluate(() => {
    const now = new Date()
    const pad = n => String(n).padStart(2, '0')
    const date = offset => {
      const d = new Date(now)
      d.setDate(d.getDate() + offset)
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    }

    const make = (index, offset) => ({
      id: `batch_${index}`,
      name: `批量商品 ${index}`,
      category: '批量测试',
      tags: [],
      note: '',
      images: [],
      coverIndex: 0,
      purchaseDate: date(-1),
      purchaseAmount: 0,
      durationValue: 1,
      durationUnit: 'day',
      expiryDate: date(offset),
      reminderDays: 0,
      renewals: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    })

    localStorage.setItem(
      'pa.products.v1',
      JSON.stringify([make(1, 10), make(2, 20), make(3, 30)])
    )
    localStorage.setItem(
      'pa.settings.v1',
      JSON.stringify({ defaultReminderDays: 7, notifyTime: '09:00', notifyEnabled: true, theme: 'light' })
    )
  })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  const errors = []
  await page.getByText('管理', { exact: true }).click()
  await page.waitForTimeout(500)

  const cards = page.locator('.product-card')
  await cards.nth(0).click()
  await page.waitForTimeout(300)
  await cards.nth(1).click()
  await page.waitForTimeout(500)

  const batchInfo = (await page.locator('.batch-info').textContent()) || ''
  if (!batchInfo.includes('2')) errors.push(`选中数量不对: ${batchInfo}`)

  await page.locator('.batch-btn.danger').click()
  await page.locator('.uni-modal__btn_primary').click()
  await page.waitForTimeout(1500)

  const remaining = await page.locator('.product-card').count()
  if (remaining !== 1) errors.push(`删除后应剩 1 件，实际 ${remaining}`)

  const stored = await page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem('pa.products.v1') || '[]')
    return list.map(item => item.id)
  })
  if (stored.length !== 1) errors.push(`本地应剩 1 件，实际 ${stored.length}`)
  if (await page.locator('.batch-bar').isVisible()) errors.push('删除后仍显示批量操作栏')

  // 重新进入管理模式并选中一件，方便截图
  await page.getByText('管理', { exact: true }).click()
  await page.waitForTimeout(300)
  await page.locator('.product-card').first().click()
  await page.waitForTimeout(300)

  console.log(JSON.stringify({ batchInfo, remaining, stored, errors }, null, 2))
  if (errors.length) throw new Error(errors.join('; '))
}
