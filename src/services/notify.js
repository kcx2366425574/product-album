/**
 * 通知能力抽象。
 *
 * - H5：Web Notification API（只有页面打开时有效）
 * - App：调用 UTS 原生插件 helper-alarm（AlarmManager + NotificationManager），
 *        App 进程被系统杀掉后仍能按时弹通知
 *
 * UTS 插件的 import 用条件编译包裹，H5 构建时会被剔除。
 */

// #ifdef APP-PLUS
import {
  isPermissionGranted as nativeGetPermission,
  requestPermission as nativeRequestPermission,
  notifyNow as nativeNotifyNow,
  schedule as nativeSchedule,
  cancel as nativeCancel,
  consumeLaunchPayload as nativeConsumeLaunchPayload
} from '@/uni_modules/helper-alarm'
// #endif

const SCHEDULED_IDS_KEY = 'pa.scheduled.ids.v1'

// #ifdef APP-PLUS
function loadScheduledIds() {
  try {
    const raw = uni.getStorageSync(SCHEDULED_IDS_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch (e) {
    return []
  }
}

function saveScheduledIds(ids) {
  try {
    uni.setStorageSync(SCHEDULED_IDS_KEY, JSON.stringify(ids || []))
  } catch (e) {
    console.warn('[notify] 保存排程记录失败', e)
  }
}
// #endif

/**
 * @returns {'granted'|'denied'|'default'|'unsupported'|'unknown'}
 */
export function getPermissionState() {
  // #ifdef H5
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
  // #endif
  // #ifdef APP-PLUS
  try {
    return nativeGetPermission() ? 'granted' : 'denied'
  } catch (e) {
    return 'unknown'
  }
  // #endif
  // #ifndef H5 || APP-PLUS
  return 'unsupported'
  // #endif
}

/**
 * 申请通知权限。
 * H5 必须在用户手势（点击）里调用。
 * @returns {Promise<boolean>}
 */
export async function ensurePermission() {
  // #ifdef H5
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try {
    const p = await Notification.requestPermission()
    return p === 'granted'
  } catch (e) {
    return false
  }
  // #endif
  // #ifdef APP-PLUS
  return new Promise(resolve => {
    try {
      nativeRequestPermission(granted => resolve(!!granted))
    } catch (e) {
      console.warn('[notify] 申请通知权限失败', e)
      resolve(false)
    }
  })
  // #endif
  // #ifndef H5 || APP-PLUS
  return false
  // #endif
}

/**
 * 立即发一条通知。
 * @returns {boolean} 是否已交给系统
 */
export function notifyNow({ title, content, payload }) {
  // #ifdef H5
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      // eslint-disable-next-line no-new
      new Notification(title, {
        body: content,
        tag: payload && payload.productId ? String(payload.productId) : undefined
      })
      return true
    }
  } catch (e) {
    console.warn('[notify] Web Notification 失败', e)
  }
  return false
  // #endif
  // #ifdef APP-PLUS
  try {
    // 通知权限被拒绝时 notify() 不报错但不会展示，必须主动拦截，
    // 否则调用方会把没送达的提醒记成"已提醒"，导致永久漏提醒。
    if (!nativeGetPermission()) return false
    nativeNotifyNow(title, content, payload ? JSON.stringify(payload) : '')
    return true
  } catch (e) {
    console.warn('[notify] 原生通知失败', e)
    return false
  }
  // #endif
  // #ifndef H5 || APP-PLUS
  return false
  // #endif
}

/**
 * 全量重排未来提醒。
 * 先取消上一轮排程（id 记录在本地存储里），再逐条注册。
 * @param {Array<{id:string,at:number,title:string,content:string,payload:object}>} entries
 * @returns {boolean} 是否成功交给系统定时器
 */
export function scheduleAll(entries) {
  // #ifdef APP-PLUS
  try {
    // 没有通知权限时排程没有意义，也不应该向调用方报告成功。
    // 用户授权后设置页会重新调用本函数。
    if (!nativeGetPermission()) return false
    const prev = loadScheduledIds()
    for (const id of prev) nativeCancel(id)

    const ids = []
    for (const e of entries || []) {
      if (!e || !e.id || !e.at) continue
      nativeSchedule(e.id, e.at, e.title, e.content, e.payload ? JSON.stringify(e.payload) : '')
      ids.push(e.id)
    }
    saveScheduledIds(ids)
    return true
  } catch (e) {
    console.error('[notify] 排程失败', e)
    return false
  }
  // #endif
  // #ifndef APP-PLUS
  return false
  // #endif
}

export function cancelAll() {
  // #ifdef APP-PLUS
  try {
    for (const id of loadScheduledIds()) nativeCancel(id)
    saveScheduledIds([])
  } catch (e) {
    console.warn('[notify] 取消排程失败', e)
  }
  // #endif
}

/** 原生定时器是否可用（设置页展示用） */
export function hasNativeScheduler() {
  // #ifdef APP-PLUS
  return true
  // #endif
  // #ifndef APP-PLUS
  return false
  // #endif
}

/** 读取从通知点击进入 App 时携带的 payload */
export function consumeLaunchPayload() {
  // #ifdef APP-PLUS
  try {
    const raw = nativeConsumeLaunchPayload()
    if (!raw) return null
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
  // #endif
  // #ifndef APP-PLUS
  return null
  // #endif
}
