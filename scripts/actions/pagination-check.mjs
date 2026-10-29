/**
 * 端到端验证：50 件商品首屏只渲染 40 件，点"加载更多"后渲染 50 件。
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

    const products = Array.from({ length: 50 }, (_, index) => ({
      id: `page_${index + 1}`,
      name: `分页商品 ${index + 1}`,
      category: '分页测试',
      tags: [],
      note: '',
      images: [],
      coverIndex: 0,
      purchaseDate: date(-1),
      purchaseAmount: 0,
      durationValue: 1,
      durationUnit: 'day',
      expiryDate: date(10 + index),
      reminderDays: 0,
      renewals: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }))

    localStorage.setItem('pa.products.v1', JSON.stringify(products))
    localStorage.setItem(
      'pa.settings.v1',
      JSON.stringify({ defaultReminderDays: 7, notifyTime: '09:00', notifyEnabled: true, theme: 'light' })
    )
  })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  const errors = []
  const firstPageCards = await page.locator('.product-card').count()
  if (firstPageCards !== 40) errors.push(`首屏应渲染 40 件，实际 ${firstPageCards}`)

  const loadMore = page.getByText(/加载更多/, { exact: false })
  if (!(await loadMore.isVisible())) errors.push('没有显示加载更多按钮')

  await loadMore.click()
  await page.waitForTimeout(800)

  const afterCards = await page.locator('.product-card').count()
  if (afterCards !== 50) errors.push(`加载更多后应渲染 50 件，实际 ${afterCards}`)
  if (await page.getByText(/加载更多/, { exact: false }).isVisible()) {
    errors.push('全部加载后仍显示加载更多按钮')
  }

  console.log(JSON.stringify({ firstPageCards, afterCards, errors }, null, 2))
  if (errors.length) throw new Error(errors.join('; '))
}
