/**
 * 端到端验证：分类筛选、全部恢复、默认按到期日排序。
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

    const make = (id, name, category, offset) => ({
      id,
      name,
      category,
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
      JSON.stringify([
        make('f1', '服装 A', '服装', 10),
        make('f2', '服装 B', '服装', 20),
        make('f3', '食品 C', '食品', 30),
        make('f4', '无分类 D', '', 40)
      ])
    )
    localStorage.setItem(
      'pa.settings.v1',
      JSON.stringify({ defaultReminderDays: 7, notifyTime: '09:00', notifyEnabled: true, theme: 'light' })
    )
  })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  const errors = []

  const initialCount = (await page.locator('.list-count').textContent()) || ''
  if (!initialCount.includes('4')) errors.push(`初始数量不对: ${initialCount}`)

  const chips = await page.locator('.cat-chip').allTextContents()
  if (!chips.some(text => text.includes('服装') && text.includes('2'))) {
    errors.push(`服装分类统计不对: ${chips.join('|')}`)
  }
  if (!chips.some(text => text.includes('食品') && text.includes('1'))) {
    errors.push(`食品分类统计不对: ${chips.join('|')}`)
  }

  await page.locator('.cat-chip', { hasText: '服装' }).click()
  await page.waitForTimeout(600)
  const filteredCount = (await page.locator('.list-count').textContent()) || ''
  if (!filteredCount.includes('2')) errors.push(`服装筛选数量不对: ${filteredCount}`)
  if (!(await page.getByText('服装 A', { exact: true }).isVisible())) errors.push('筛选后缺少服装 A')
  if (await page.getByText('食品 C', { exact: true }).isVisible()) errors.push('筛选后仍显示食品 C')

  await page.locator('.cat-chip', { hasText: '全部' }).click()
  await page.waitForTimeout(600)
  const restoredCount = (await page.locator('.list-count').textContent()) || ''
  if (!restoredCount.includes('4')) errors.push(`恢复全部后数量不对: ${restoredCount}`)

  const firstCard = (await page.locator('.product-card .name').first().textContent()) || ''
  if (!firstCard.includes('服装 A')) errors.push(`默认排序第一件不对: ${firstCard}`)

  console.log(JSON.stringify({ chips, initialCount, filteredCount, restoredCount, firstCard, errors }, null, 2))
  if (errors.length) throw new Error(errors.join('; '))
}
