<template>
  <view class="page alarm-page" :class="themeClass">
    <view class="nav">
      <view class="nav-inner">
        <ModuleSwitcher current="alarm" />
        <view class="nav-spacer" />
      </view>
    </view>

    <view class="container">
      <view class="clock-card">
        <text class="clock-date">{{ todayLabel }}</text>
        <view class="clock-row">
          <text class="clock num">{{ clockText }}</text>
          <text class="clock-sec num">{{ secondsText }}</text>
        </view>
        <view class="clock-next">
          <text v-if="nextInfo" class="next-text">
            下一次 <text class="next-em">{{ nextInfo.timeText }}</text>
            <text v-if="nextInfo.title" class="next-name"> · {{ nextInfo.title }}</text>
          </text>
          <text v-else class="next-empty">还没有开启的闹钟</text>
        </view>
      </view>
    </view>

    <view v-if="showPermissionBanner" class="container">
      <view class="perm-banner" @tap="openPermission">
        <view class="perm-dot" />
        <view class="perm-main">
          <text class="perm-title">通知未开启</text>
          <text class="perm-sub">允许通知后，闹钟才能准时响铃</text>
        </view>
        <text class="perm-action">去开启 ›</text>
      </view>
    </view>

    <view v-if="list.length" class="container">
      <view class="list-head">
        <text class="list-title">我的闹钟</text>
        <text class="list-count">{{ enabledCount }} 个开启</text>
      </view>

      <view
        v-for="item in list"
        :key="item.id"
        class="alarm-card"
        :class="{ off: !item.enabled }"
        @tap="editAlarm(item)"
      >
        <view class="alarm-time num">{{ item.time }}</view>
        <view class="alarm-main">
          <view class="alarm-title-row">
            <text class="alarm-title">{{ item.title }}</text>
            <text v-if="!item.enabled" class="alarm-badge">已关闭</text>
            <text v-else-if="nextAt(item) == null" class="alarm-badge ended">已结束</text>
          </view>
          <text class="alarm-rule">{{ describeRule(item.rule) }}</text>
          <text class="alarm-next">{{ nextText(item) }}</text>
        </view>
        <view class="alarm-switch" @tap.stop>
          <switch :checked="item.enabled" color="#2F6B4F" @change="onToggle(item, $event)" />
        </view>
      </view>
    </view>

    <EmptyState
      v-else
      title="还没有闹钟"
      sub="支持每天、每周、每月最后一个周六等重复规则"
      action-text="添加第一个闹钟"
      @action="createAlarm"
    />

    <view class="fab-wrap">
      <view class="fab" @tap="createAlarm">
        <view class="plus-h" />
        <view class="plus-v" />
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onHide, onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import ModuleSwitcher from '@/components/ModuleSwitcher.vue'
import EmptyState from '@/components/EmptyState.vue'
import { alarmState, initAlarms, setAlarmEnabled } from '@/store/alarm'
import { WEEKDAY_LABELS, describeRule, nextOccurrence } from '@/services/alarmRule'
import { rescheduleAlarms, snoozeAlarm } from '@/services/alarmScheduler'
import { ensurePermission, getPermissionState } from '@/services/notify'
import { daysBetween, formatDate, pad2, todayStr } from '@/utils/date'
import { themeClass } from '@/store/theme'

const now = ref(Date.now())
const isApp = ref(false)
const permissionState = ref('granted')
let clockTimer = null
let pendingRing = ''

const clockText = computed(() => {
  const d = new Date(now.value)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
})

const secondsText = computed(() => pad2(new Date(now.value).getSeconds()))

const todayLabel = computed(() => {
  const d = new Date(now.value)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAY_LABELS[d.getDay()]}`
})

const showPermissionBanner = computed(
  () => isApp.value && permissionState.value !== 'granted' && permissionState.value !== 'unsupported'
)

const enabledCount = computed(() => alarmState.alarms.filter(item => item.enabled).length)

const list = computed(() => {
  const at = now.value
  return alarmState.alarms.slice().sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
    const na = a.enabled ? nextOccurrence(a, at) : null
    const nb = b.enabled ? nextOccurrence(b, at) : null
    if (na == null && nb == null) return String(a.time).localeCompare(String(b.time))
    if (na == null) return 1
    if (nb == null) return -1
    if (na !== nb) return na - nb
    return String(a.title).localeCompare(String(b.title), 'zh-CN')
  })
})

const nextInfo = computed(() => {
  let best = null
  for (const item of alarmState.alarms) {
    if (!item.enabled) continue
    const at = nextOccurrence(item, now.value)
    if (at != null && (!best || at < best.at)) best = { at, title: item.title }
  }
  if (!best) return null
  return { at: best.at, title: best.title, timeText: relativeLabel(best.at) }
})

function relativeLabel(at) {
  const date = new Date(at)
  const dateStr = formatDate(date)
  const diff = daysBetween(todayStr(), dateStr)
  const hm = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  if (diff === 0) return `今天 ${hm}`
  if (diff === 1) return `明天 ${hm}`
  if (diff === 2) return `后天 ${hm}`
  return `${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAY_LABELS[date.getDay()]} ${hm}`
}

function nextAt(alarm) {
  return nextOccurrence(alarm, now.value)
}

function nextText(alarm) {
  if (!alarm.enabled) return '已关闭'
  const at = nextAt(alarm)
  if (at == null) return '已结束'
  return `下次 ${relativeLabel(at)}`
}

function startClock() {
  stopClock()
  now.value = Date.now()
  clockTimer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
}

function stopClock() {
  if (clockTimer) {
    clearInterval(clockTimer)
    clockTimer = null
  }
}

onLoad(options => {
  pendingRing = options && options.ring ? String(options.ring) : ''
})

onShow(() => {
  initAlarms()
  permissionState.value = getPermissionState()
  // #ifdef APP-PLUS
  isApp.value = true
  // #endif
  startClock()
  rescheduleAlarms(alarmState.alarms)

  if (pendingRing) {
    const id = pendingRing
    pendingRing = ''
    setTimeout(() => showRing(id), 350)
  }
})

onHide(stopClock)
onUnload(stopClock)

function onToggle(alarm, event) {
  const ok = setAlarmEnabled(alarm.id, event.detail.value)
  if (!ok) {
    uni.showToast({ title: '保存失败，请重试', icon: 'none' })
    return
  }
  rescheduleAlarms(alarmState.alarms)
}

async function openPermission() {
  const ok = await ensurePermission()
  permissionState.value = getPermissionState()
  if (ok) {
    rescheduleAlarms(alarmState.alarms)
    uni.showToast({ title: '通知已开启', icon: 'none' })
  }
}

function createAlarm() {
  uni.navigateTo({ url: '/pages/alarm/edit' })
}

function editAlarm(alarm) {
  uni.navigateTo({ url: `/pages/alarm/edit?id=${encodeURIComponent(alarm.id)}` })
}

function showRing(alarmId) {
  const alarm = alarmState.alarms.find(item => item.id === alarmId)
  if (!alarm) return

  uni.showModal({
    title: `${alarm.title} · 闹钟响了`,
    content: `${alarm.time} · ${describeRule(alarm.rule)}`,
    confirmText: '关闭',
    cancelText: '稍后 5 分钟',
    success: res => {
      if (res.confirm) return
      const at = snoozeAlarm(alarm, 5)
      uni.showToast({
        title: at ? '5 分钟后再提醒' : '稍后提醒失败',
        icon: 'none'
      })
    }
  })
}
</script>

<style scoped>
.alarm-page {
  padding-bottom: calc(200rpx + env(safe-area-inset-bottom));
}

.nav-spacer {
  flex: 1;
}

.clock-card {
  position: relative;
  overflow: hidden;
  padding: 34rpx 32rpx 30rpx;
  border-radius: 32rpx;
  background: linear-gradient(140deg, #3d2a16 0%, #1f1811 100%);
  box-shadow: 0 18rpx 44rpx rgba(31, 24, 17, 0.24);
}

.clock-card::after {
  content: '';
  position: absolute;
  right: -80rpx;
  top: -110rpx;
  width: 300rpx;
  height: 300rpx;
  border-radius: 50%;
  background: rgba(255, 190, 110, 0.08);
}

.clock-date {
  display: block;
  font-size: 24rpx;
  letter-spacing: 1rpx;
  color: rgba(255, 255, 255, 0.58);
}

.clock-row {
  display: flex;
  align-items: baseline;
  margin-top: 8rpx;
}

.clock {
  font-size: 104rpx;
  line-height: 1.1;
  font-weight: 700;
  letter-spacing: 2rpx;
  color: #ffffff;
}

.clock-sec {
  margin-left: 12rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.46);
}

.clock-next {
  margin-top: 14rpx;
}

.next-text {
  font-size: 25rpx;
  color: rgba(255, 255, 255, 0.68);
}

.next-em {
  font-weight: 700;
  color: #ffcf8f;
}

.next-name {
  color: rgba(255, 255, 255, 0.86);
}

.next-empty {
  font-size: 25rpx;
  color: rgba(255, 255, 255, 0.42);
}

.perm-banner {
  display: flex;
  align-items: center;
  padding: 22rpx 24rpx;
  margin-top: 24rpx;
  border-radius: 20rpx;
  background: var(--warn-soft);
  border: 2rpx solid rgba(185, 97, 26, 0.18);
}

.perm-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: var(--warn);
  margin-right: 16rpx;
  flex-shrink: 0;
}

.perm-main {
  flex: 1;
  min-width: 0;
}

.perm-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: var(--warn);
}

.perm-sub {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  color: var(--ink-2);
}

.perm-action {
  flex-shrink: 0;
  margin-left: 16rpx;
  font-size: 24rpx;
  font-weight: 600;
  color: var(--warn);
}

.list-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 36rpx;
  margin-bottom: 18rpx;
}

.list-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--ink);
}

.list-count {
  font-size: 24rpx;
  color: var(--ink-3);
}

.alarm-card {
  display: flex;
  align-items: center;
  padding: 28rpx 26rpx;
  margin-bottom: 20rpx;
  border-radius: var(--radius-lg);
  background: var(--surface);
  border: 2rpx solid var(--line);
  box-shadow: var(--shadow);
}

.alarm-card.off {
  opacity: 0.66;
}

.alarm-time {
  width: 168rpx;
  flex-shrink: 0;
  font-size: 52rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
  color: var(--ink);
}

.alarm-main {
  flex: 1;
  min-width: 0;
}

.alarm-title-row {
  display: flex;
  align-items: center;
  min-width: 0;
}

.alarm-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--ink);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.alarm-badge {
  flex-shrink: 0;
  margin-left: 10rpx;
  padding: 2rpx 12rpx;
  border-radius: 999rpx;
  background: var(--surface-2);
  font-size: 19rpx;
  color: var(--ink-3);
}

.alarm-badge.ended {
  background: var(--warn-soft);
  color: var(--warn);
}

.alarm-rule {
  display: block;
  margin-top: 6rpx;
  font-size: 23rpx;
  color: var(--ink-2);
}

.alarm-next {
  display: block;
  margin-top: 4rpx;
  font-size: 21rpx;
  color: var(--ink-3);
}

.alarm-switch {
  margin-left: 12rpx;
  flex-shrink: 0;
  transform: scale(0.86);
}

.fab-wrap {
  position: fixed;
  left: 50%;
  bottom: calc(40rpx + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  width: 750rpx;
  max-width: 100%;
  display: flex;
  justify-content: flex-end;
  padding-right: 40rpx;
  pointer-events: none;
  z-index: 40;
}

.fab {
  pointer-events: auto;
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background: var(--warn);
  box-shadow: 0 16rpx 36rpx rgba(185, 97, 26, 0.36);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.fab:active {
  opacity: 0.86;
}

.plus-h,
.plus-v {
  position: absolute;
  background: #ffffff;
  border-radius: 4rpx;
}

.plus-h {
  width: 40rpx;
  height: 4rpx;
}

.plus-v {
  width: 4rpx;
  height: 40rpx;
}
</style>
