/**
 * 本地数据持久化。
 * 元数据统一走 uni.setStorageSync（H5 → localStorage，App → plus storage），
 * 图片二进制不在这里，见 services/imageStore.js。
 *
 * 所有值都以 JSON 字符串写入，跨端行为一致。
 */
import { isValidDateStr, todayStr } from '@/utils/date'
import { calcExpiry } from './expiry'

const KEY_PRODUCTS = 'pa.products.v1'
const KEY_SETTINGS = 'pa.settings.v1'
const KEY_NOTIFY = 'pa.notify.v1'
const KEY_PROMPT = 'pa.prompt.v1'

export const DEFAULT_SETTINGS = {
  schemaVersion: 1,
  defaultReminderDays: 7,
  notifyTime: '09:00',
  notifyEnabled: true,
  permissionPrompted: false,
  theme: 'auto',
  lastBackupAt: 0
}

function read(key, fallback) {
  try {
    const raw = uni.getStorageSync(key)
    if (raw === '' || raw === null || raw === undefined) return fallback
    return JSON.parse(raw)
  } catch (e) {
    console.error('[db] 读取失败', key, e)
    return fallback
  }
}

function write(key, value) {
  try {
    uni.setStorageSync(key, JSON.stringify(value))
    return true
  } catch (e) {
    console.error('[db] 写入失败', key, e)
    return false
  }
}

function toInt(v, fallback = 0) {
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) ? n : fallback
}

export function normalizeProduct(raw) {
  if (!raw || typeof raw !== 'object') return null

  const purchaseDate = isValidDateStr(raw.purchaseDate) ? raw.purchaseDate : todayStr()
  const durationValue = Math.max(1, toInt(raw.durationValue, 1))
  const durationUnit = ['day', 'month', 'year'].includes(raw.durationUnit) ? raw.durationUnit : 'day'
  const expiryDate = isValidDateStr(raw.expiryDate)
    ? raw.expiryDate
    : calcExpiry(purchaseDate, durationValue, durationUnit)

  const images = Array.isArray(raw.images)
    ? raw.images
        .filter(i => i && i.id)
        .map(i => ({
          id: String(i.id),
          w: toInt(i.w),
          h: toInt(i.h),
          size: toInt(i.size),
          path: String(i.path || ''),
          // 缩略图字段：老数据没有这些字段时为空，展示层会自动回退到原图
          thumbId: String(i.thumbId || ''),
          thumbPath: String(i.thumbPath || ''),
          thumbW: toInt(i.thumbW),
          thumbH: toInt(i.thumbH)
        }))
    : []

  const coverIndex = images.length ? Math.min(Math.max(0, toInt(raw.coverIndex)), images.length - 1) : 0

  return {
    id: String(raw.id || ''),
    name: String(raw.name || '').trim() || '未命名商品',
    category: String(raw.category || '').trim(),
    tags: Array.isArray(raw.tags) ? raw.tags.filter(Boolean).map(String) : [],
    note: String(raw.note || ''),
    images,
    coverIndex,
    purchaseDate,
    durationValue,
    durationUnit,
    expiryDate,
    reminderDays: Number.isFinite(Number(raw.reminderDays)) ? toInt(raw.reminderDays, -1) : -1,
    renewals: Array.isArray(raw.renewals) ? raw.renewals.filter(Boolean) : [],
    createdAt: toInt(raw.createdAt) || Date.now(),
    updatedAt: toInt(raw.updatedAt) || Date.now()
  }
}

export function loadProducts() {
  const list = read(KEY_PRODUCTS, [])
  if (!Array.isArray(list)) return []
  return list.map(normalizeProduct).filter(Boolean)
}

export function saveProducts(list) {
  return write(KEY_PRODUCTS, list)
}

export function getProduct(id) {
  return loadProducts().find(p => p.id === id) || null
}

export function upsertProduct(product) {
  const list = loadProducts()
  const normalized = normalizeProduct(product)
  if (!normalized) return null
  const idx = list.findIndex(p => p.id === normalized.id)
  if (idx >= 0) list[idx] = normalized
  else list.push(normalized)
  // 写入失败（例如存储已满）时返回 null，让调用方提示用户，避免误以为保存成功
  return saveProducts(list) ? normalized : null
}

export function removeProduct(id) {
  return saveProducts(loadProducts().filter(p => p.id !== id))
}

export function loadSettings() {
  const s = read(KEY_SETTINGS, {})
  return { ...DEFAULT_SETTINGS, ...(s && typeof s === 'object' ? s : {}) }
}

export function saveSettings(patch) {
  const merged = { ...loadSettings(), ...(patch || {}) }
  write(KEY_SETTINGS, merged)
  return merged
}

export function loadNotifyRecords() {
  const r = read(KEY_NOTIFY, {})
  return r && typeof r === 'object' && !Array.isArray(r) ? r : {}
}

export function saveNotifyRecords(records) {
  return write(KEY_NOTIFY, records || {})
}

export function loadPromptRecord() {
  const r = read(KEY_PROMPT, {})
  return r && typeof r === 'object' ? r : {}
}

export function savePromptRecord(record) {
  return write(KEY_PROMPT, record || {})
}
