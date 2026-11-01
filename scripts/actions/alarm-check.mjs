/**
 * 闹钟模块 H5 流程检查：
 * 1. 左上角模块菜单切换到闹钟
 * 2. 通过界面创建「每月最后一个周六」的闹钟
 * 3. 验证列表展示与模块切回商品图册
 */

/** 打开 uni-app H5 的滚轮选择器，拖到指定下标后点「完成」 */
async function selectWheel(page, picker, targetIndex) {
  await picker.click()
  await page.waitForTimeout(650)

  const info = await page.evaluate(() => {
    const container = [...document.querySelectorAll('.uni-picker-container')].find(
      el => getComputedStyle(el).display !== 'none'
    )
    if (!container) return null
    const select = container.querySelector('.uni-picker-select')
    const items = select ? [...select.querySelectorAll('.uni-picker-item')] : []
    const view = container.querySelector('uni-picker-view')
    const first = container.querySelector('.uni-picker-view-content .uni-picker-item')
    if (!view) return null
    const rect = view.getBoundingClientRect()
    return {
      current: items.findIndex(el => el.className.includes('selected')),
      itemHeight: first ? first.getBoundingClientRect().height : 34,
      x: rect.x,
      y: rect.y,
      w: rect.width,
      h: rect.height
    }
  })

  if (!info) throw new Error('选择器没有打开')

  const delta = (targetIndex - info.current) * info.itemHeight
  const cx = info.x + info.w / 2
  const cy = info.y + info.h / 2

  if (delta !== 0) {
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    const steps = 12
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(cx, cy - (delta * i) / steps)
      await page.waitForTimeout(20)
    }
    await page.mouse.up()
    await page.waitForTimeout(450)
  }

  await page.locator('.uni-picker-action-confirm:visible').click()
  await page.waitForTimeout(350)
}

export default async function (page) {
  const shot = name =>
    page.screenshot({ path: `docs/screenshots/${name}.png`, fullPage: false })

  // 左上角模块切换菜单
  await page.locator('.switcher').click()
  await page.waitForTimeout(350)
  await shot('alarm-menu')

  await page.locator('.menu-item').filter({ hasText: '闹钟' }).click()
  await page.waitForTimeout(1500)
  await shot('alarm-empty')

  // 新建闹钟
  await page.locator('.fab').click()
  await page.waitForTimeout(1200)

  await page.locator('.alarm-edit input').first().fill('月底复盘')
  await page.locator('.alarm-edit input').nth(1).fill('整理本月工作')

  await page.locator('.type-seg .seg-item').filter({ hasText: '每月' }).click()
  await page.waitForTimeout(300)
  await page.locator('.mode-seg .seg-item').filter({ hasText: '按星期' }).click()
  await page.waitForTimeout(300)

  // 第 5 项：最后一个；第 7 项：周六
  const pickers = page.locator('.nth-row uni-picker')
  await selectWheel(page, pickers.first(), 4)
  await selectWheel(page, pickers.nth(1), 6)

  await page.waitForTimeout(500)
  await shot('alarm-edit-last-saturday')

  await page.locator('.footer .btn-primary').click()
  await page.waitForTimeout(1600)
  await shot('alarm-last-saturday')

  // 再切回商品图册，确认模块导航可用
  await page.locator('.switcher').click()
  await page.waitForTimeout(300)
  await page.locator('.menu-item').filter({ hasText: '商品图册' }).click()
  await page.waitForTimeout(1200)
  await shot('module-back-album')
}
