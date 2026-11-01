/**
 * 应用内更新：版本比较、更新源解析、自动检查节流。
 *
 * 纯函数，不调用网络与原生 API，便于单元测试。
 * 更新源是仓库里的 releases/latest.json，APK 与代码放在同一个仓库。
 */
import { APP_VERSION, APP_VERSION_CODE, DEFAULT_UPDATE_FEED_URL } from '@/utils/appInfo'

// 自动检查间隔：6 小时
export const UPDATE_CHECK_INTERVAL = 6 * 60 * 60 * 1000

function versionParts(value) {
  return String(value || '')
    .split('.')
    .map(part => {
      const n = parseInt(part, 10)
      return Number.isFinite(n) ? n : 0
    })
}

/**
 * 比较版本号，返回 -1 / 0 / 1。
 * 支持 1.2、1.2.0、1.2.10 这类点分数字版本。
 */
export function compareVersion(a, b) {
  const left = versionParts(a)
  const right = versionParts(b)
  const len = Math.max(left.length, right.length)

  for (let i = 0; i < len; i++) {
    const x = left[i] || 0
    const y = right[i] || 0
    if (x !== y) return x > y ? 1 : -1
  }
  return 0
}

/** 更新源里的版本是否比当前 App 新 */
export function isNewerVersion(
  manifest,
  currentVersion = APP_VERSION,
  currentVersionCode = APP_VERSION_CODE
) {
  if (!manifest) return false
  const cmp = compareVersion(manifest.versionName, currentVersion)
  if (cmp !== 0) return cmp > 0
  return Number(manifest.versionCode) > Number(currentVersionCode)
}

/** 把 latest.json 里的相对 APK 路径解析成完整地址 */
export function resolveUrl(feedUrl, relative) {
  const rel = String(relative || '').trim()
  if (!rel) return ''
  // 绝对地址原样返回；非 http(s) 的协议由调用方校验并拒绝
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(rel)) return rel

  const clean = String(feedUrl || '').split('#')[0].split('?')[0]
  const index = clean.lastIndexOf('/')
  const dir = index >= 0 ? clean.slice(0, index + 1) : ''
  return dir + rel.replace(/^\.?\//, '')
}

/**
 * 校验并规范化 latest.json。
 * @param {object} raw
 * @param {string} feedUrl latest.json 的地址，用于解析相对 APK 路径
 */
export function parseUpdateManifest(raw, feedUrl = '') {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('更新信息格式不正确')
  }

  const versionName = String(raw.versionName || raw.version || '').trim()
  if (!versionName) throw new Error('更新信息缺少版本号')

  const apk = String(raw.apk || raw.apkUrl || '').trim()
  if (!apk) throw new Error('更新信息缺少 APK 地址')

  const apkUrl = resolveUrl(feedUrl, apk)
  if (!/^https?:\/\//i.test(apkUrl)) {
    throw new Error('APK 地址必须是 http(s)')
  }

  const notesRaw = raw.notes !== undefined ? raw.notes : raw.changelog
  const notes = Array.isArray(notesRaw)
    ? notesRaw.map(item => String(item || '').trim()).filter(Boolean).join('\n')
    : String(notesRaw || '').trim()

  return {
    versionName,
    versionCode: Math.max(0, Math.trunc(Number(raw.versionCode) || 0)),
    apkUrl,
    notes,
    size: Math.max(0, Math.trunc(Number(raw.size) || 0)),
    sha256: String(raw.sha256 || '').trim(),
    publishedAt: Number(raw.publishedAt) || 0
  }
}

/** 距离上次检查是否已经超过间隔；从未检查过返回 true */
export function shouldAutoCheck(
  lastCheckAt,
  now = Date.now(),
  interval = UPDATE_CHECK_INTERVAL
) {
  const last = Number(lastCheckAt) || 0
  if (last <= 0) return true
  if (last > now) return true
  return now - last >= interval
}

/** 当前生效的更新源地址，允许用户在设置页覆盖 */
export function feedUrlOf(settings) {
  const custom = String((settings && settings.updateFeedUrl) || '').trim()
  return custom || DEFAULT_UPDATE_FEED_URL
}

/** '1.2.0' + 版本号 → 展示文本 */
export function versionText(versionName, versionCode) {
  const code = Number(versionCode)
  return code > 0 ? `${versionName} (${code})` : String(versionName || '')
}
