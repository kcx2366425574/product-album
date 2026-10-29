/**
 * 往 localStorage 里塞几条不同到期状态的数据，然后刷新，
 * 用来验证首页统计、提醒弹窗。
 */
export default async function (page) {
  await page.evaluate(() => {
    const pad = n => String(n).padStart(2, '0')
    const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const add = n => {
      const d = new Date()
      d.setDate(d.getDate() + n)
      return fmt(d)
    }
    const now = Date.now()
    const make = (id, name, offset) => ({
      id,
      name,
      category: '测试',
      tags: [],
      note: '',
      images: [],
      coverIndex: 0,
      purchaseDate: fmt(new Date()),
      durationValue: 1,
      durationUnit: 'day',
      expiryDate: add(offset),
      reminderDays: -1,
      renewals: [],
      createdAt: now,
      updatedAt: now
    })
    const products = [
      make('p_expired', '已过期商品', -2),
      make('p_today', '今天到期商品', 0),
      make('p_soon', '三天后到期', 3),
      make('p_normal', '还早的商品', 30)
    ]
    localStorage.setItem('pa.products.v1', JSON.stringify(products))
    localStorage.setItem('pa.settings.v1', JSON.stringify({ defaultReminderDays: 7, notifyTime: '09:00', notifyEnabled: true }))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
}
