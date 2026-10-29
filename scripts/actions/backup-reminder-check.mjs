/**
 * 端到端验证：
 * 1. 有商品且从未备份时，首页显示备份提醒
 * 2. 点击提醒进入设置页
 * 3. 最近备份过后不再显示
 */
export default async function (page) {
  await page.evaluate(() => {
    const now = new Date()
    const pad = n => String(n).padStart(2, '0')
    const d = new Date(now)
    d.setDate(d.getDate() + 10)
    const expiry = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

    localStorage.setItem(
      'pa.products.v1',
      JSON.stringify([
        {
          id: 'backup_demo',
          name: '备份提醒商品',
          category: '测试',
          tags: [],
          note: '',
          images: [],
          coverIndex: 0,
          purchaseDate: expiry,
          purchaseAmount: 0,
          durationValue: 1,
          durationUnit: 'day',
          expiryDate: expiry,
          reminderDays: 0,
          renewals: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ])
    )
    localStorage.setItem(
      'pa.settings.v1',
      JSON.stringify({
        defaultReminderDays: 7,
        notifyTime: '09:00',
        notifyEnabled: true,
        theme: 'light',
        lastBackupAt: 0
      })
    )
  })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  const errors = []
  if (!(await page.getByText('建议备份数据', { exact: true }).isVisible())) {
    errors.push('首页没有显示备份提醒')
  }
  if (await page.getByText('当前筛选下没有商品', { exact: true }).isVisible()) {
    errors.push('有商品时仍显示空状态文案')
  }

  await page.getByText('去备份 ›', { exact: true }).click()
  await page.waitForTimeout(1200)
  if (!(await page.getByText('设置', { exact: true }).first().isVisible())) {
    errors.push('点击备份提醒没有进入设置页')
  }

  // 模拟刚刚备份过，再回首页
  await page.evaluate(() => {
    const settings = JSON.parse(localStorage.getItem('pa.settings.v1'))
    settings.lastBackupAt = Date.now()
    localStorage.setItem('pa.settings.v1', JSON.stringify(settings))
  })
  const base = page.url().split('#')[0]
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  if (await page.getByText('建议备份数据', { exact: true }).isVisible()) {
    errors.push('刚备份过仍显示备份提醒')
  }

  // 恢复为未备份，方便截图
  await page.evaluate(() => {
    const settings = JSON.parse(localStorage.getItem('pa.settings.v1'))
    settings.lastBackupAt = 0
    localStorage.setItem('pa.settings.v1', JSON.stringify(settings))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  console.log(JSON.stringify({ errors }, null, 2))
  if (errors.length) throw new Error(errors.join('; '))
}
