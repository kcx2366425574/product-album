/**
 * Vitest 环境下的 UTS 插件替身。
 * 测试只覆盖纯函数（到期计算、排程生成），不会真正触发原生通知。
 */
export function isPermissionGranted() {
  return false
}

export function requestPermission(callback) {
  if (callback) callback(false)
}

export function notifyNow() {}

export function schedule(id, at, title, content, payload, repeatDays) {}

export function cancel() {}

export function canScheduleExactAlarms() {
  return true
}

export function openExactAlarmSettings() {}

export function consumeDeliveredIds() {
  return ''
}

export function consumeLaunchPayload() {
  return ''
}

export function isRinging() {
  return false
}

export function getRingingAlarmId() {
  return ''
}

export function stopRinging() {}

export function pickRingtone(callback) {
  if (callback) callback('cancel', '')
}

export function getRingtoneName() {
  return ''
}

export function clearRingtone() {}

export function previewRingtone() {}
