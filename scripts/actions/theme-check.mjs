/**
 * 端到端验证：设置 theme=dark 后页面根节点切换到深色变量，
 * 切回 light 后恢复浅色。
 */
export default async function (page) {
  await page.evaluate(() => {
    localStorage.setItem(
      'pa.settings.v1',
      JSON.stringify({ defaultReminderDays: 7, notifyTime: '09:00', notifyEnabled: true, theme: 'dark' })
    )
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  const dark = await page.evaluate(() => {
    const el = document.querySelector('.page')
    const style = getComputedStyle(el)
    return {
      hasClass: el.classList.contains('theme-dark'),
      bg: style.backgroundColor,
      color: style.color,
      htmlBg: getComputedStyle(document.documentElement).backgroundColor
    }
  })

  const errors = []
  if (!dark.hasClass) errors.push('深色模式没有 theme-dark 类')
  if (dark.bg !== 'rgb(18, 21, 18)') errors.push(`深色背景不对: ${dark.bg}`)
  if (dark.htmlBg !== 'rgb(18, 21, 18)') errors.push(`html 背景没有同步: ${dark.htmlBg}`)

  await page.evaluate(() => {
    const settings = JSON.parse(localStorage.getItem('pa.settings.v1'))
    settings.theme = 'light'
    localStorage.setItem('pa.settings.v1', JSON.stringify(settings))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  const light = await page.evaluate(() => {
    const el = document.querySelector('.page')
    return {
      hasClass: el.classList.contains('theme-dark'),
      bg: getComputedStyle(el).backgroundColor
    }
  })
  if (light.hasClass) errors.push('浅色模式不应带 theme-dark 类')

  // 切回深色，方便截图检查最终视觉效果
  await page.evaluate(() => {
    const settings = JSON.parse(localStorage.getItem('pa.settings.v1'))
    settings.theme = 'dark'
    localStorage.setItem('pa.settings.v1', JSON.stringify(settings))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  console.log(JSON.stringify({ dark, light, errors }, null, 2))
  if (errors.length) throw new Error(errors.join('; '))
}
