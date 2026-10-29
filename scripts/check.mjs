/**
 * 用本机 Edge（Chromium 内核）做 H5 自动化检查。
 * 用法：node scripts/check.mjs <url> <输出图片> [宽] [高] [操作脚本]
 * 操作脚本是一个可选 .mjs，导出 async (page) => {}
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const url = process.argv[2] || 'http://localhost:5173/'
const out = process.argv[3] || 'docs/screenshots/home.png'
const width = Number(process.argv[4] || 390)
const height = Number(process.argv[5] || 844)
const actionFile = process.argv[6]
const screenshotMode = process.argv[7] || 'full'

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true
})
const page = await context.newPage()
const logs = []
page.on('console', m => {
  if (['error', 'warning'].includes(m.type())) logs.push(`[console.${m.type()}] ${m.text()}`)
})
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`))

await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3000)

if (actionFile) {
  const mod = await import(pathToFileURL(path.resolve(actionFile)).href)
  await mod.default(page)
  await page.waitForTimeout(800)
}

fs.mkdirSync(path.dirname(out), { recursive: true })
await page.screenshot({ path: out, fullPage: screenshotMode !== 'viewport' })

console.log(JSON.stringify({ url, out, logs }, null, 2))
await browser.close()
