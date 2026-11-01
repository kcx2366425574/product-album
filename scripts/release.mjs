#!/usr/bin/env node
/**
 * 发布 APK 到仓库内的 releases 目录，并生成 latest.json。
 *
 * 用法：
 *   node scripts/release.mjs <apk路径> [--notes "更新说明"]
 *   npm run release:apk -- <apk路径> --notes "更新说明"
 *
 * 更新源默认地址（jsDelivr 镜像）：
 *   https://cdn.jsdelivr.net/gh/kcx2366425574/product-album@master/releases/latest.json
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const releasesDir = path.join(root, 'releases')

function fail(message) {
  console.error(`✗ ${message}`)
  process.exitCode = 1
  process.exit()
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    fail(`读取 ${path.relative(root, file)} 失败：${e.message}`)
  }
}

function formatSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

const args = process.argv.slice(2)
const apkArg = args.find(arg => !arg.startsWith('--'))
const notesIndex = args.indexOf('--notes')
const notes = notesIndex >= 0 ? String(args[notesIndex + 1] || '').trim() : ''

if (!apkArg) {
  fail('请传入 APK 路径：node scripts/release.mjs <apk路径> [--notes "更新说明"]')
}

const apkPath = path.resolve(process.cwd(), apkArg)
if (!fs.existsSync(apkPath)) fail(`找不到 APK：${apkPath}`)
if (path.extname(apkPath).toLowerCase() !== '.apk') fail('只接受 .apk 文件')

// APK 本质是 ZIP：检查文件头，避免把下载失败的空文件或错误文件发布出去
const header = Buffer.alloc(4)
const fd = fs.openSync(apkPath, 'r')
fs.readSync(fd, header, 0, 4, 0)
fs.closeSync(fd)
if (header.toString('hex') !== '504b0304') {
  fail('这个文件不是有效的 APK/ZIP（文件头不是 PK）')
}

const manifest = readJson(path.join(root, 'src/manifest.json'))
const pkg = readJson(path.join(root, 'package.json'))
const appInfoSource = fs.readFileSync(path.join(root, 'src/utils/appInfo.js'), 'utf8')
const appVersion = /APP_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(appInfoSource)?.[1]
const appVersionCode = Number(/APP_VERSION_CODE\s*=\s*(\d+)/.exec(appInfoSource)?.[1])

const versionName = String(manifest.versionName || '').trim()
const versionCode = Number(manifest.versionCode)

if (!versionName) fail('manifest.json 缺少 versionName')
if (!Number.isFinite(versionCode) || versionCode <= 0) {
  fail('manifest.json 的 versionCode 无效')
}
if (versionName !== pkg.version) {
  fail(`版本号不一致：manifest.json=${versionName}，package.json=${pkg.version}`)
}
if (versionName !== appVersion) {
  fail(`版本号不一致：manifest.json=${versionName}，appInfo.js=${appVersion}`)
}
if (versionCode !== appVersionCode) {
  fail(`versionCode 不一致：manifest.json=${versionCode}，appInfo.js=${appVersionCode}`)
}

fs.mkdirSync(releasesDir, { recursive: true })
const fileName = `product-album-${versionName}.apk`
const target = path.join(releasesDir, fileName)

if (path.resolve(apkPath) !== path.resolve(target)) {
  fs.copyFileSync(apkPath, target)
}

const stat = fs.statSync(target)
const hash = crypto.createHash('sha256')

await new Promise((resolve, reject) => {
  fs.createReadStream(target)
    .on('data', chunk => hash.update(chunk))
    .on('end', resolve)
    .on('error', reject)
})

const feed = {
  versionName,
  versionCode,
  apk: fileName,
  size: stat.size,
  sha256: hash.digest('hex'),
  notes: notes || '修复已知问题并优化体验。',
  publishedAt: Date.now()
}

const feedPath = path.join(releasesDir, 'latest.json')
fs.writeFileSync(feedPath, `${JSON.stringify(feed, null, 2)}\n`, 'utf8')

console.log(`✓ 已发布 ${versionName} (${versionCode})`)
console.log(`  APK : releases/${fileName} (${formatSize(stat.size)})`)
console.log(`  SHA : ${feed.sha256}`)
console.log('  Feed: releases/latest.json')
console.log('')
console.log('下一步：')
console.log('  git add releases')
console.log(`  git commit -m "release: ${versionName}"`)
console.log('  git push')
