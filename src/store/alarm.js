/**
 * 闹钟模块的轻量全局状态。
 * 与商品图册的 store/app.js 完全独立，切换模块时互不影响。
 */
import { reactive } from 'vue'
import * as db from '@/services/db'

export const alarmState = reactive({
  alarms: [],
  inited: false
})

export function initAlarms() {
  alarmState.alarms = db.loadAlarms()
  alarmState.inited = true
}

export function reloadAlarms() {
  alarmState.alarms = db.loadAlarms()
}

export function saveAlarm(alarm) {
  const saved = db.upsertAlarm(alarm)
  if (saved) reloadAlarms()
  return saved
}

export function deleteAlarm(id) {
  const ok = db.removeAlarm(id)
  if (ok) reloadAlarms()
  return ok
}

export function setAlarmEnabled(id, enabled) {
  const alarm = alarmState.alarms.find(item => item.id === id)
  if (!alarm) return false
  return !!saveAlarm({ ...alarm, enabled: !!enabled, updatedAt: Date.now() })
}
