<template>
  <view class="page" :class="themeClass">
    <NavBar title="设置" />

    <view class="container">
      <view class="group">
        <text class="group-title">到期提醒</text>
        <view class="group-card">
          <view class="row">
            <view class="row-main">
              <text class="row-title">开启提醒</text>
              <text class="row-sub">关闭后不再发送到期通知</text>
            </view>
            <switch
              :checked="state.settings.notifyEnabled"
              color="#2F6B4F"
              @change="onNotifyToggle"
            />
          </view>

          <view class="row">
            <view class="row-main">
              <text class="row-title">默认提前</text>
              <text class="row-sub">新商品默认使用这个天数，可在商品里单独改</text>
            </view>
            <view class="stepper">
              <view class="step-btn" @tap="changeReminderDays(-1)">−</view>
              <text class="step-value num">{{ state.settings.defaultReminderDays }}</text>
              <text class="step-unit">天</text>
              <view class="step-btn" @tap="changeReminderDays(1)">+</view>
            </view>
          </view>

          <view class="row">
            <view class="row-main">
              <text class="row-title">提醒时间</text>
              <text class="row-sub">提醒日的这个时间发送通知</text>
            </view>
            <picker mode="time" :value="state.settings.notifyTime" @change="onTimeChange">
              <view class="row-value num">{{ state.settings.notifyTime }}</view>
            </picker>
          </view>

          <view class="row">
            <view class="row-main">
              <text class="row-title">逾期重复</text>
              <text class="row-sub">商品过期后按这个间隔继续提醒</text>
            </view>
            <picker mode="selector" :range="repeatLabels" :value="repeatIndex" @change="onRepeatChange">
              <view class="row-value">{{ repeatLabel }}</view>
            </picker>
          </view>
        </view>
      </view>

      <view class="group">
        <text class="group-title">通知权限</text>
        <view class="group-card">
          <view class="row">
            <view class="row-main">
              <text class="row-title">系统通知</text>
              <text class="row-sub">{{ permissionHint }}</text>
            </view>
            <view class="perm-pill" :class="permissionState">{{ permissionText }}</view>
          </view>
          <view v-if="permissionState !== 'granted'" class="row row-action" @tap="requestPermission">
            <text class="row-action-text">去开启通知权限</text>
            <text class="row-arrow">›</text>
          </view>
          <view v-if="isApp" class="row">
            <view class="row-main">
              <text class="row-title">后台定时</text>
              <text class="row-sub">{{ nativeReady ? 'App 关闭后也能按时提醒' : '原生定时模块未就绪，只能打开 App 时提醒' }}</text>
            </view>
            <view class="perm-pill" :class="nativeReady ? 'granted' : 'denied'">
              {{ nativeReady ? '已启用' : '未启用' }}
            </view>
          </view>
          <view v-if="isApp && nativeReady" class="row row-action" @tap="onExactAlarmTap">
            <view class="row-main">
              <text class="row-title">精确提醒</text>
              <text class="row-sub">{{ exactAlarmReady ? '已授权，提醒时间准确' : '未授权，系统可能延迟几分钟' }}</text>
            </view>
            <view class="perm-pill" :class="exactAlarmReady ? 'granted' : 'denied'">
              {{ exactAlarmReady ? '已授权' : '去授权' }}
            </view>
          </view>
        </view>
      </view>

      <view class="group">
        <text class="group-title">外观</text>
        <view class="group-card">
          <view class="row">
            <view class="row-main">
              <text class="row-title">主题</text>
              <text class="row-sub">跟随系统时会随手机的深色模式自动切换</text>
            </view>
            <picker mode="selector" :range="themeLabels" :value="themeIndex" @change="onThemeChange">
              <view class="row-value">{{ themeLabel }}</view>
            </picker>
          </view>
        </view>
      </view>

      <view class="group">
        <text class="group-title">花费统计</text>
        <view class="group-card">
          <view class="row">
            <text class="row-title">累计花费</text>
            <text class="row-value num">{{ money(spend.total) }}</text>
          </view>
          <view class="row">
            <text class="row-title">本月支出</text>
            <text class="row-value num">{{ money(spend.month) }}</text>
          </view>
          <view class="row">
            <text class="row-title">今年支出</text>
            <text class="row-value num">{{ money(spend.year) }}</text>
          </view>
          <view class="row">
            <text class="row-title">续费次数</text>
            <text class="row-value num">{{ spend.renewalCount }} 次</text>
          </view>
        </view>
        <text class="group-note">统计购买金额与续费金额，未填写的金额不计入。</text>
      </view>

      <view class="group">
        <text class="group-title">数据</text>
        <view class="group-card">
          <view class="row">
            <text class="row-title">商品数量</text>
            <text class="row-value num">{{ state.products.length }} 件</text>
          </view>
          <view class="row">
            <text class="row-title">图片数量</text>
            <text class="row-value num">{{ imageInfo.count }} 张</text>
          </view>
          <view class="row">
            <text class="row-title">图片占用</text>
            <text class="row-value num">{{ formatBytes(imageInfo.bytes) }}</text>
          </view>
          <view class="row row-action" @tap="exportBackup">
            <view class="row-main">
              <text class="row-title">导出备份</text>
              <text class="row-sub">商品、图片、续费记录和设置打包为一个 JSON 文件</text>
            </view>
            <text class="row-arrow">›</text>
          </view>
          <view class="row row-action" @tap="doImportBackup">
            <view class="row-main">
              <text class="row-title">从备份导入</text>
              <text class="row-sub">会覆盖当前全部数据，适合换手机或重装</text>
            </view>
            <text class="row-arrow">›</text>
          </view>
          <view v-if="state.settings.lastBackupAt" class="row">
            <text class="row-title">上次备份</text>
            <text class="row-value num">{{ lastBackupText }}</text>
          </view>
          <view class="row row-action" @tap="clearAll">
            <text class="row-action-text danger">清空所有数据</text>
            <text class="row-arrow">›</text>
          </view>
        </view>
        <text class="group-note">数据只保存在本机，卸载 App 会一起清除，建议定期导出备份。图片占用按原图大小估算。</text>
      </view>

      <view class="group">
        <text class="group-title">关于</text>
        <view class="group-card">
          <view class="row">
            <text class="row-title">版本</text>
            <text class="row-value num">{{ APP_VERSION }}</text>
          </view>
          <view class="row">
            <text class="row-title">用途</text>
            <text class="row-value">商品图片 + 到期提醒</text>
          </view>
        </view>
        <text class="group-note">商品图册 · 离线优先，不联网也能用。</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import NavBar from '@/components/NavBar.vue'
import { initStore, reloadProducts, state, updateSettings } from '@/store/app'
import { removeImage } from '@/services/imageStore'
import {
  cancelAll,
  canScheduleExactAlarms,
  ensurePermission,
  getPermissionState,
  hasNativeScheduler,
  openExactAlarmSettings
} from '@/services/notify'
import { reschedule } from '@/services/reminder'
import { saveNotifyRecords, saveProducts, saveSettings } from '@/services/db'
import { spendSummary } from '@/services/stats'
import { formatBytes, imageStats } from '@/services/storage'
import {
  createBackup,
  downloadBackupFile,
  parseBackup,
  pickBackupFile,
  prepareImport
} from '@/services/backup'
import { formatDateTime } from '@/utils/date'
import { themeClass } from '@/store/theme'
import { APP_VERSION } from '@/utils/appInfo'

const spend = computed(() => spendSummary(state.products, state.today))
const imageInfo = computed(() => imageStats(state.products))
const lastBackupText = computed(() =>
  state.settings.lastBackupAt ? formatDateTime(state.settings.lastBackupAt) : ''
)

const THEMES = [
  { value: 'auto', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' }
]
const themeLabels = THEMES.map(item => item.label)
const themeIndex = computed(() => {
  const index = THEMES.findIndex(item => item.value === (state.settings.theme || 'auto'))
  return index >= 0 ? index : 0
})
const themeLabel = computed(() => THEMES[themeIndex.value].label)

function onThemeChange(event) {
  const item = THEMES[Number(event.detail.value)]
  if (item) persist({ theme: item.value })
}

function money(value) {
  const n = Number(value) || 0
  return n > 0 ? `¥${n.toFixed(2)}` : '—'
}

const permissionState = ref('default')
const isApp = ref(false)
const nativeReady = ref(false)
const exactAlarmReady = ref(true)

const PERMISSION_TEXT = {
  granted: '已授权',
  denied: '已拒绝',
  default: '未授权',
  unsupported: '不支持',
  unknown: '未知'
}

const permissionText = computed(() => PERMISSION_TEXT[permissionState.value] || '未知')

const permissionHint = computed(() => {
  if (permissionState.value === 'granted') return '到期提醒会通过系统通知发送'
  if (permissionState.value === 'denied') return '请在系统设置里允许本 App 发送通知'
  if (permissionState.value === 'unsupported') return '当前环境不支持系统通知，打开 App 时会弹窗提醒'
  return '开启后才能在通知栏收到到期提醒'
})

onShow(() => {
  // #ifdef APP-PLUS
  isApp.value = true
  nativeReady.value = hasNativeScheduler()
  exactAlarmReady.value = canScheduleExactAlarms()
  // #endif
  permissionState.value = getPermissionState()
})

function onExactAlarmTap() {
  if (exactAlarmReady.value) return
  openExactAlarmSettings()
}

function persist(patch) {
  updateSettings(patch)
  reschedule(state.products, state.settings)
}

function onNotifyToggle(e) {
  persist({ notifyEnabled: !!e.detail.value })
}

function changeReminderDays(delta) {
  const next = Math.min(90, Math.max(0, Number(state.settings.defaultReminderDays || 0) + delta))
  persist({ defaultReminderDays: next })
}

function onTimeChange(e) {
  persist({ notifyTime: e.detail.value })
}

const REPEAT_OPTIONS = [
  { value: 0, label: '不重复' },
  { value: 1, label: '每天' },
  { value: 3, label: '每 3 天' },
  { value: 7, label: '每周' }
]
const repeatLabels = REPEAT_OPTIONS.map(item => item.label)
const repeatIndex = computed(() => {
  const index = REPEAT_OPTIONS.findIndex(
    item => item.value === Number(state.settings.overdueRepeatDays || 0)
  )
  return index >= 0 ? index : 0
})
const repeatLabel = computed(() => REPEAT_OPTIONS[repeatIndex.value].label)

function onRepeatChange(e) {
  const item = REPEAT_OPTIONS[Number(e.detail.value)]
  if (item) persist({ overdueRepeatDays: item.value })
}

async function requestPermission() {
  const ok = await ensurePermission()
  permissionState.value = getPermissionState()
  if (ok) {
    const r = reschedule(state.products, state.settings)
    uni.showToast({
      title: r.native ? `已开启，排程 ${r.count} 条` : '通知已开启',
      icon: 'none'
    })
  } else {
    uni.showToast({ title: '未获得通知权限', icon: 'none' })
  }
}

async function exportBackup() {
  if (!state.products.length) {
    uni.showToast({ title: '还没有商品可备份', icon: 'none' })
    return
  }

  uni.showLoading({ title: '正在打包', mask: true })
  try {
    const backup = await createBackup(state.products, state.settings)
    await downloadBackupFile(backup)
    persist({ lastBackupAt: Date.now() })
    uni.hideLoading()
    uni.showToast({ title: '备份已导出', icon: 'success' })
  } catch (e) {
    uni.hideLoading()
    console.error('[settings] 导出备份失败', e)
    uni.showToast({ title: (e && e.message) || '导出失败', icon: 'none' })
  }
}

function doImportBackup() {
  uni.showModal({
    title: '从备份导入',
    content: '导入会覆盖当前全部商品、图片和设置，确定继续吗？',
    confirmText: '导入',
    confirmColor: '#B03A31',
    success: async res => {
      if (!res.confirm) return

      let committed = false
      let createdImages = []

      try {
        const text = await pickBackupFile()
        const backup = parseBackup(text)
        uni.showLoading({ title: '正在导入', mask: true })

        // 导入可能包含很多图片，保持一个 loading 即可，不要重复 showLoading
        const result = await prepareImport(backup)
        createdImages = result.createdImages
        const oldProducts = state.products.slice()

        // 先写入商品数据，成功后再清理旧图片，避免导入失败时两头空
        if (!saveProducts(result.products)) {
          throw new Error('导入失败，请检查存储空间')
        }
        committed = true
        saveSettings(result.settings)
        saveNotifyRecords({})
        initStore()
        reschedule(state.products, state.settings)

        for (const product of oldProducts) {
          await Promise.all((product.images || []).map(image => removeImage(image)))
        }

        uni.hideLoading()
        const failed = result.stats.failedImages
        uni.showToast({
          title: failed
            ? `导入 ${result.products.length} 件，${failed} 张图失败`
            : `已导入 ${result.products.length} 件商品`,
          icon: 'none'
        })
      } catch (e) {
        uni.hideLoading()
        if (!committed) {
          await Promise.all(createdImages.map(image => removeImage(image)))
        }
        console.error('[settings] 导入备份失败', e)
        uni.showToast({ title: (e && e.message) || '导入失败', icon: 'none' })
      }
    }
  })
}

function clearAll() {
  if (!state.products.length) {
    uni.showToast({ title: '没有数据可清空', icon: 'none' })
    return
  }
  uni.showModal({
    title: '清空所有数据',
    content: '会删除全部商品、图片和续费记录，无法恢复。确定继续吗？',
    confirmText: '清空',
    confirmColor: '#B03A31',
    success: async res => {
      if (!res.confirm) return
      const products = state.products.slice()
      uni.showLoading({ title: '清理中', mask: true })
      try {
        // 先清数据，成功后再删图片，避免写入失败时图片已丢
        if (!saveProducts([])) {
          uni.hideLoading()
          uni.showToast({ title: '清空失败，请重试', icon: 'none' })
          return
        }
        saveNotifyRecords({})
        reloadProducts()
        cancelAll()
        for (const p of products) {
          await Promise.all((p.images || []).map(m => removeImage(m)))
        }
        uni.hideLoading()
        uni.showToast({ title: '已清空', icon: 'success' })
      } catch (e) {
        uni.hideLoading()
        console.error('[settings] 清空数据失败', e)
        uni.showToast({ title: '清空失败，请重试', icon: 'none' })
      }
    }
  })
}
</script>

<style scoped>
.group {
  margin-top: 36rpx;
}

.group-title {
  display: block;
  margin: 0 8rpx 14rpx;
  font-size: 24rpx;
  color: var(--ink-3);
  letter-spacing: 1rpx;
}

.group-card {
  background: var(--surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 28rpx;
  border-bottom: 2rpx solid var(--surface-2);
  min-height: 108rpx;
}

.row:last-child {
  border-bottom: none;
}

.row-main {
  flex: 1;
  min-width: 0;
  padding-right: 20rpx;
}

.row-title {
  display: block;
  font-size: 28rpx;
  color: var(--ink);
}

.row-sub {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: var(--ink-3);
  line-height: 1.5;
}

.row-value {
  font-size: 28rpx;
  color: var(--ink-2);
}

.row-action {
  justify-content: space-between;
}

.row-action-text {
  font-size: 28rpx;
  color: var(--brand);
}

.row-action-text.danger {
  color: var(--danger);
}

.row-arrow {
  font-size: 34rpx;
  color: var(--ink-3);
  line-height: 1;
}

.stepper {
  display: flex;
  align-items: center;
  background: var(--surface-2);
  border-radius: 999rpx;
  padding: 6rpx;
}

.step-btn {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: var(--surface);
  color: var(--ink-2);
  font-size: 32rpx;
  line-height: 56rpx;
  text-align: center;
  box-shadow: 0 2rpx 8rpx rgba(29, 35, 31, 0.08);
}

.step-value {
  min-width: 64rpx;
  text-align: center;
  font-size: 30rpx;
  font-weight: 600;
  color: var(--ink);
}

.step-unit {
  font-size: 22rpx;
  color: var(--ink-3);
  margin-right: 8rpx;
}

.perm-pill {
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 600;
  white-space: nowrap;
}

.perm-pill.granted {
  background: var(--brand-soft);
  color: var(--brand);
}

.perm-pill.denied {
  background: var(--danger-soft);
  color: var(--danger);
}

.perm-pill.default,
.perm-pill.unknown {
  background: var(--warn-soft);
  color: var(--warn);
}

.perm-pill.unsupported {
  background: var(--surface-2);
  color: var(--ink-3);
}

.group-note {
  display: block;
  margin: 14rpx 8rpx 0;
  font-size: 22rpx;
  color: var(--ink-3);
  line-height: 1.6;
}
</style>
