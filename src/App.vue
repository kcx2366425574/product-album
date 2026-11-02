<script setup>
import { onHide, onLaunch, onShow } from '@dcloudio/uni-app'
import { initStore, refreshToday, state, updateSettings } from '@/store/app'
import { alarmState, initAlarms } from '@/store/alarm'
import { markDelivered, pruneNotifyRecords, reschedule, runScan } from '@/services/reminder'
import { loadPromptRecord, savePromptRecord } from '@/services/db'
import { describeRule } from '@/services/alarmRule'
import {
  findDueAlarmForPrompt,
  markAlarmDelivered,
  rescheduleAlarms,
  snoozeAlarm
} from '@/services/alarmScheduler'
import {
  consumeDeliveredIds,
  consumeLaunchPayload,
  ensurePermission,
  getPermissionState,
  getRingingAlarmId,
  hasNativeScheduler,
  isRinging,
  stopRinging
} from '@/services/notify'
import { shouldPromptPermission } from '@/services/permission'
import { feedUrlOf, shouldAutoCheck } from '@/services/update'
import { checkForUpdate } from '@/services/updater'
import { showUpdateDialog } from '@/services/updateFlow'
import { todayStr } from '@/utils/date'

let lastScanAt = 0
let launchPayloadHandled = false
let permissionPrompting = false
let updateChecking = false
let dayTimer = null
let ringTimer = null
let lastRingOpenAt = 0

/** App 可能长时间停留在前台，跨午夜时刷新"今天"并补一次提醒扫描 */
function startDayTimer() {
  if (dayTimer) return
  dayTimer = setInterval(() => {
    if (refreshToday()) {
      lastScanAt = 0
      scanAndPrompt()
    }
    // H5 / 无通知权限时，靠前台轮询补上闹钟弹窗
    promptDueAlarm()
  }, 60 * 1000)
}

/**
 * 打开闹钟响铃页。
 * 已经在闹钟页时用事件通知页面弹窗，避免重复压入页面。
 */
function openAlarmRing(alarmId) {
  if (!alarmId) return
  // 原生响铃 + 通知点击可能在同一时刻触发，只处理一次
  const now = Date.now()
  if (now - lastRingOpenAt < 1500) return
  lastRingOpenAt = now

  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  const current = pages.length ? pages[pages.length - 1] : null
  if (current && current.route === 'pages/alarm/alarm') {
    uni.$emit('alarm:ring', alarmId)
    return
  }
  uni.navigateTo({
    url: `/pages/alarm/alarm?ring=${encodeURIComponent(alarmId)}`,
    fail: () => {
      uni.reLaunch({ url: `/pages/alarm/alarm?ring=${encodeURIComponent(alarmId)}` })
    }
  })
}

/**
 * 原生闹钟正在响铃时，打开 App 就停止铃声并进入闹钟页。
 * App 在前台时靠 3 秒轮询，保证到点后也能看到弹窗。
 */
function handleRingingAlarm() {
  if (!isRinging()) return false
  const alarmId = getRingingAlarmId()
  stopRinging()
  openAlarmRing(alarmId)
  return true
}

function startRingWatch() {
  if (ringTimer) return
  ringTimer = setInterval(handleRingingAlarm, 3 * 1000)
}

function stopRingWatch() {
  if (ringTimer) {
    clearInterval(ringTimer)
    ringTimer = null
  }
}

function scanAndPrompt() {
  const now = Date.now()
  // onLaunch / onShow 会连续触发，避免重复扫描
  if (now - lastScanAt < 1500) return false
  lastScanAt = now
  try {
    // 先记下原生闹钟已经弹过的提醒，再扫描，避免同一条提醒重复弹出。
    // 商品提醒与闹钟使用不同的确认表，这里按 id 前缀分开。
    const alarmIds = []
    const productIds = []
    for (const id of consumeDeliveredIds()) {
      if (/^alarm(-snooze)?:/.test(id)) alarmIds.push(id)
      else productIds.push(id)
    }
    markDelivered(productIds)
    markAlarmDelivered(alarmIds)
    const { pending } = runScan(state.products, state.settings)
    reschedule(state.products, state.settings)
    pruneNotifyRecords(state.products)
    return promptIfNeeded(pending)
  } catch (e) {
    console.error('[app] 提醒扫描失败', e)
    return false
  }
}

function promptIfNeeded(pending) {
  if (!pending || !pending.length) return false
  const today = todayStr()
  const record = loadPromptRecord()
  if (record.lastPromptDate === today) return false

  const lines = pending.slice(0, 3).map(item => {
    if (item.type === 'expired') return `「${item.product.name}」已过期 ${Math.abs(item.days)} 天`
    if (item.type === 'expiry') return `「${item.product.name}」今天到期`
    return `「${item.product.name}」还有 ${item.days} 天到期`
  })
  if (pending.length > 3) lines.push(`…等 ${pending.length} 件商品需要处理`)

  savePromptRecord({ ...record, lastPromptDate: today })
  uni.showModal({
    title: '到期提醒',
    content: lines.join('\n'),
    confirmText: '知道了',
    showCancel: false
  })
  return true
}

/**
 * App 首次启动引导开启通知权限。
 * 只在原生端执行；如果本次已经弹过到期提醒，就等下次前台再引导，避免两个弹窗打架。
 */
function maybePromptPermission(duePromptShown) {
  // #ifdef APP-PLUS
  if (permissionPrompting || duePromptShown) return
  if (!shouldPromptPermission(state.settings, getPermissionState())) return

  permissionPrompting = true
  setTimeout(() => {
    uni.showModal({
      title: '开启到期提醒',
      content: '允许通知后，商品到期时才能在通知栏提醒你；关闭通知时只能在打开 App 时看到提示。',
      confirmText: '去开启',
      cancelText: '暂不',
      success: async res => {
        updateSettings({ permissionPrompted: true })
        if (!res.confirm) {
          permissionPrompting = false
          return
        }
        const ok = await ensurePermission()
        permissionPrompting = false
        if (ok) {
          reschedule(state.products, state.settings)
          uni.showToast({ title: '通知已开启', icon: 'none' })
        } else {
          uni.showToast({ title: '未获得通知权限，可在系统设置中开启', icon: 'none' })
        }
      }
    })
  }, 600)
  // #endif
}

/**
 * 闹钟响铃的前台兜底提示。
 * App 原生定时器 + 通知权限都可用时由系统通知负责，避免同一响铃弹两次；
 * H5 或通知权限被拒时，靠这里在打开 App / 前台轮询时补一次弹窗。
 */
function promptDueAlarm() {
  if (hasNativeScheduler() && getPermissionState() === 'granted') return false

  const hit = findDueAlarmForPrompt(alarmState.alarms)
  if (!hit) return false

  markAlarmDelivered([hit.entryId])
  uni.showModal({
    title: `${hit.alarm.title} · 闹钟响了`,
    content: `${hit.alarm.time} · ${describeRule(hit.alarm.rule)}`,
    confirmText: '关闭',
    cancelText: '稍后 5 分钟',
    success: res => {
      if (res.confirm) return
      const at = snoozeAlarm(hit.alarm, 5)
      if (at) uni.showToast({ title: '5 分钟后再提醒', icon: 'none' })
    }
  })
  return true
}

/**
 * 启动后静默检查更新，有新版才弹窗。
 * 6 小时内只自动检查一次；用户也可以在设置页手动检查。
 */
function maybeCheckUpdate() {
  // #ifdef APP-PLUS
  if (updateChecking) return
  if (!shouldAutoCheck(state.settings.lastUpdateCheckAt)) return

  updateChecking = true
  checkForUpdate({ feedUrl: feedUrlOf(state.settings) })
    .then(result => {
      updateSettings({ lastUpdateCheckAt: Date.now() })
      if (result.status === 'update') showUpdateDialog(result.manifest)
    })
    .catch(() => {})
    .finally(() => {
      updateChecking = false
    })
  // #endif
}

function handleLaunchPayload() {
  if (launchPayloadHandled) return
  const payload = consumeLaunchPayload()
  if (!payload) return
  launchPayloadHandled = true

  if (payload.module === 'alarm' && payload.alarmId) {
    // 通知点击进入：铃声可能还在响，先停掉再弹「闹钟响了」
    setTimeout(() => {
      stopRinging()
      openAlarmRing(payload.alarmId)
    }, 300)
    return
  }

  if (!payload.productId) return
  setTimeout(() => {
    // 到期/已过期的通知直接打开续费面板，提前提醒只进入详情
    const renew = payload.type === 'expiry' || payload.type === 'expired' ? '&renew=1' : ''
    uni.navigateTo({
      url: `/pages/detail/detail?id=${encodeURIComponent(payload.productId)}${renew}`
    })
  }, 300)
}

onLaunch(() => {
  initStore()
  initAlarms()
  startDayTimer()
})

onShow(() => {
  initStore()
  initAlarms()
  const duePromptShown = scanAndPrompt()
  promptDueAlarm()
  rescheduleAlarms(alarmState.alarms)
  maybePromptPermission(duePromptShown)
  // 闹钟正在响铃时，回到 App 立即停止铃声并进入响铃页
  handleRingingAlarm()
  handleLaunchPayload()
  startRingWatch()

  // 避开启动时的到期提醒 / 权限弹窗，延迟静默检查
  setTimeout(maybeCheckUpdate, 3000)
})

onHide(() => {
  // 退到后台时停止轮询，避免把正在响铃的闹钟误停掉
  stopRingWatch()
})
</script>

<style>
page {
  --bg: #f4f2ec;
  --surface: #ffffff;
  --surface-2: #fbfaf6;
  --ink: #1d231f;
  --ink-2: #59625c;
  --ink-3: #8c958f;
  --line: #e7e2d9;
  --brand: #2f6b4f;
  --brand-dark: #24543d;
  --brand-soft: #e6f0e9;
  --warn: #b9611a;
  --warn-soft: #fbeedf;
  --danger: #b03a31;
  --danger-soft: #fbe9e6;
  --radius-lg: 28rpx;
  --radius-md: 20rpx;
  --radius-sm: 12rpx;
  --shadow: 0 10rpx 34rpx rgba(29, 35, 31, 0.06);

  background: var(--bg);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', sans-serif;
  font-size: 28rpx;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

view,
text,
image,
scroll-view,
swiper {
  box-sizing: border-box;
}

.page {
  min-height: 100vh;
  max-width: 750rpx;
  margin: 0 auto;
  background: var(--bg);
  padding-bottom: calc(180rpx + env(safe-area-inset-bottom));
}

/* 深色主题：变量挂在页面根节点，所有子元素继承 */
.page.theme-dark {
  --bg: #121512;
  --surface: #1b201c;
  --surface-2: #232a25;
  --ink: #eef2ee;
  --ink-2: #b7c0b9;
  --ink-3: #7f8a82;
  --line: #303832;
  --brand: #4f8f70;
  --brand-dark: #427a5f;
  --brand-soft: #1e3329;
  --warn: #e0a063;
  --warn-soft: #382a19;
  --danger: #e08078;
  --danger-soft: #3a201d;
  --shadow: 0 10rpx 34rpx rgba(0, 0, 0, 0.32);

  background: var(--bg);
  color: var(--ink);
}

.theme-dark .bar,
.theme-dark .cd-bar {
  background: #2b332d;
}

.theme-dark .cover-fallback {
  background: linear-gradient(150deg, #20261f 0%, #1a201b 100%);
}

.container {
  padding-left: 32rpx;
  padding-right: 32rpx;
}

/* 自定义导航栏：顶部留出状态栏 */
.nav {
  position: sticky;
  top: 0;
  z-index: 30;
  padding-top: var(--status-bar-height);
  background: var(--bg);
}

.nav-inner {
  height: 100rpx;
  padding: 0 24rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.nav-title {
  font-size: 32rpx;
  font-weight: 600;
  letter-spacing: 0.5rpx;
}

.nav-side {
  width: 88rpx;
  display: flex;
  align-items: center;
}

.nav-side.right {
  justify-content: flex-end;
}

.icon-back {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-back::before {
  content: '';
  width: 20rpx;
  height: 20rpx;
  border-left: 4rpx solid var(--ink);
  border-bottom: 4rpx solid var(--ink);
  transform: rotate(45deg);
}

/* 按钮 */
.btn {
  height: 96rpx;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 600;
  letter-spacing: 1rpx;
}

.btn-primary {
  background: var(--brand);
  color: #ffffff;
}

.btn-primary:active {
  background: var(--brand-dark);
}

.btn-ghost {
  background: transparent;
  border: 2rpx solid var(--line);
  color: var(--ink);
}

.btn-ghost:active {
  background: var(--surface-2);
}

.btn-danger {
  background: var(--danger-soft);
  color: var(--danger);
}

.btn-sm {
  height: 72rpx;
  padding: 0 32rpx;
  font-size: 26rpx;
  border-radius: 16rpx;
}

/* 筛选 chip */
.chip {
  padding: 12rpx 28rpx;
  border-radius: 999rpx;
  background: var(--surface);
  border: 2rpx solid var(--line);
  color: var(--ink-2);
  font-size: 26rpx;
  white-space: nowrap;
}

.chip.active {
  background: var(--ink);
  border-color: var(--ink);
  color: #ffffff;
}

/* 卡片 */
.card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
}

.muted {
  color: var(--ink-3);
}

.num {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum';
}

/* #ifdef H5 */
html,
body {
  background: var(--bg);
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-thumb {
  background: rgba(29, 35, 31, 0.14);
  border-radius: 3px;
}
/* #endif */
</style>
