const now = new Date()
const pad = n => String(n).padStart(2, '0')
const dateStr = day => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(day)}`

/**
 * 端到端验证：本月 5 号两件、15 号一件到期，
 * 日历应显示 3 件统计、两个到期标记，点 5 号能看到两件商品。
 */
export default async function (page) {
  await page.evaluate(() => {
    const current = new Date()
    const y = current.getFullYear()
    const m = current.getMonth()
    const pad2 = n => String(n).padStart(2, '0')
    const date = day => `${y}-${pad2(m + 1)}-${pad2(day)}`

    const make = (id, name, day) => ({
      id,
      name,
      category: '测试',
      tags: [],
      note: '',
      images: [],
      coverIndex: 0,
      purchaseDate: date(1),
      purchaseAmount: 0,
      durationValue: 30,
      durationUnit: 'day',
      expiryDate: date(day),
      reminderDays: -1,
      renewals: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    })

    localStorage.setItem(
      'pa.products.v1',
      JSON.stringify([
        make('cal1', '日历商品 A', 5),
        make('cal2', '日历商品 B', 5),
        make('cal3', '日历商品 C', 15)
      ])
    )
    localStorage.setItem(
      'pa.settings.v1',
      JSON.stringify({ defaultReminderDays: 7, notifyTime: '09:00', notifyEnabled: true })
    )
  })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  // 种子数据会触发启动时的到期提醒弹窗，先关掉
  const modalButton = page.locator('.uni-modal__btn_primary')
  if (await modalButton.count()) {
    await modalButton.first().click()
    await page.waitForTimeout(500)
  }

  await page.getByText('日历', { exact: true }).click()
  await page.waitForTimeout(1500)

  const errors = []
  if (!(await page.getByText('本月 3 件到期', { exact: true }).isVisible())) {
    errors.push('月份统计不是 3 件')
  }

  const dotCount = await page.locator('.day-cell .day-dot').count()
  if (dotCount !== 2) errors.push(`到期标记日期应为 2 个，实际 ${dotCount}`)

  const day5 = page.locator(`.day-cell[data-date="${dateStr(5)}"]`)
  if ((await day5.count()) !== 1) {
    errors.push('找不到 5 号的日期格子')
  } else {
    await day5.click()
    await page.waitForTimeout(600)
    if (!(await page.getByText('日历商品 A', { exact: true }).isVisible())) {
      errors.push('5 号没有显示商品 A')
    }
    if (!(await page.getByText('日历商品 B', { exact: true }).isVisible())) {
      errors.push('5 号没有显示商品 B')
    }
    const panelCount = (await page.locator('.panel-count').textContent()) || ''
    if (!panelCount.includes('2')) errors.push(`面板数量不对: ${panelCount}`)
  }

  console.log(JSON.stringify({ dotCount, panelCount: await page.locator('.panel-count').textContent(), errors }, null, 2))
  if (errors.length) throw new Error(errors.join('; '))
}
