<template>
  <view class="page" :class="themeClass">
    <NavBar title="商品详情">
      <template #right>
        <text v-if="product" class="nav-action" @tap="goEdit">编辑</text>
      </template>
    </NavBar>

    <view v-if="!product" class="missing">
      <text class="missing-text">商品不存在或已删除</text>
      <view class="btn btn-ghost btn-sm missing-btn" @tap="goHome">返回首页</view>
    </view>

    <template v-else>
      <view class="gallery">
        <swiper
          v-if="imageUrls.length"
          class="swiper"
          circular
          indicator-dots
          indicator-color="rgba(255,255,255,0.4)"
          indicator-active-color="#ffffff"
        >
          <swiper-item v-for="(url, i) in imageUrls" :key="i">
            <image class="swiper-img" :src="url" mode="aspectFill" @tap="previewImage(i)" />
          </swiper-item>
        </swiper>
        <view v-else class="gallery-empty">
          <text class="muted">还没有图片</text>
          <text class="gallery-empty-tip">点"编辑"添加商品图片</text>
        </view>
      </view>

      <view class="container">
        <view class="title-row">
          <text class="name">{{ product.name }}</text>
          <view class="status-pill" :class="status">{{ statusText }}</view>
        </view>
        <view v-if="product.category || product.tags.length" class="tags">
          <text v-if="product.category" class="tag tag-cat">{{ product.category }}</text>
          <text v-for="t in product.tags" :key="t" class="tag">{{ t }}</text>
        </view>

        <view class="countdown" :class="status">
          <view class="cd-top">
            <text class="cd-label">{{ days >= 0 ? '剩余有效期' : '已超期' }}</text>
            <text class="cd-date">到期日 {{ product.expiryDate }}</text>
          </view>
          <view class="cd-num-row">
            <text class="cd-num num">{{ Math.abs(days) }}</text>
            <text class="cd-unit">天</text>
            <text class="cd-desc">{{ countdownDesc }}</text>
          </view>
          <view class="cd-bar">
            <view class="cd-fill" :style="{ width: progress + '%' }" />
          </view>
        </view>

        <view class="info card">
          <view class="info-row">
            <text class="info-label">购买日期</text>
            <text class="info-value num">{{ product.purchaseDate }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">初始时长</text>
            <text class="info-value">{{ durationText(product) }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">购买金额</text>
            <text class="info-value num">{{ money(product.purchaseAmount) }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">累计花费</text>
            <text class="info-value num">{{ money(spend) }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">提醒提前</text>
            <text class="info-value">{{ reminderText }}</text>
          </view>
          <view v-if="product.note" class="info-row info-row-note">
            <text class="info-label">备注</text>
            <text class="info-value info-note">{{ product.note }}</text>
          </view>
        </view>

        <view class="actions">
          <view class="btn btn-primary" @tap="openRenew">续费</view>
          <view class="btn btn-ghost" @tap="goEdit">编辑</view>
        </view>

        <view class="section">
          <view class="section-head">
            <text class="section-title">续费记录</text>
            <text class="section-count">{{ product.renewals.length }} 次</text>
          </view>
          <view v-if="product.renewals.length" class="renew-list">
            <view v-for="r in sortedRenewals" :key="r.id" class="renew-row">
              <text class="renew-date num">{{ r.date }}</text>
              <text class="renew-dur">+{{ r.value }} {{ unitLabel(r.unit) }}</text>
              <text class="renew-amount num">{{ r.amount ? '¥' + r.amount : '—' }}</text>
            </view>
          </view>
          <text v-else class="muted section-empty">还没有续费记录</text>
        </view>

        <view class="delete-row">
          <text class="delete-text" @tap="confirmDelete">删除这个商品</text>
        </view>
      </view>
    </template>

    <view v-if="showRenew" class="mask" @tap="closeRenew">
      <view class="sheet" @tap.stop>
        <view class="sheet-handle" />
        <text class="sheet-title">续费</text>
        <text class="sheet-sub">续费后到期日会自动顺延</text>

        <view class="field">
          <text class="field-label">续费时长</text>
          <view class="dur-row">
            <input v-model="renew.value" class="input dur-input num" type="number" />
            <view class="seg">
              <view
                v-for="u in DURATION_UNITS"
                :key="u.value"
                class="seg-item"
                :class="{ active: renew.unit === u.value }"
                @tap="renew.unit = u.value"
              >
                {{ u.label }}
              </view>
            </view>
          </view>
        </view>

        <view class="field">
          <text class="field-label">金额（可选）</text>
          <input v-model="renew.amount" class="input" type="digit" placeholder="0" />
        </view>

        <view class="field">
          <text class="field-label">备注（可选）</text>
          <input v-model="renew.note" class="input" placeholder="例如：续费一年" />
        </view>

        <view class="btn btn-primary sheet-btn" @tap="doRenew">确认续费</view>
        <view class="sheet-cancel" @tap="closeRenew">取消</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import NavBar from '@/components/NavBar.vue'
import { deleteProduct, saveProduct, state } from '@/store/app'
import { getProduct } from '@/services/db'
import { removeImage, resolveImageUrl } from '@/services/imageStore'
import { reschedule } from '@/services/reminder'
import { productSpend } from '@/services/stats'
import { themeClass } from '@/store/theme'
import {
  DURATION_UNITS,
  STATUS_TEXT,
  daysLeft,
  durationText,
  effectiveReminderDays,
  renewProduct,
  statusOf,
  totalSpanDays,
  unitLabel
} from '@/services/expiry'

const productId = ref('')
const product = ref(null)
const imageUrls = ref([])

const showRenew = ref(false)
const renew = reactive({ value: 30, unit: 'day', amount: '', note: '' })

const days = computed(() =>
  product.value ? daysLeft(product.value.expiryDate, state.today) : 0
)
const status = computed(() =>
  product.value ? statusOf(product.value, state.settings.defaultReminderDays, state.today) : 'normal'
)
const statusText = computed(() => STATUS_TEXT[status.value] || '')

const countdownDesc = computed(() => {
  if (!product.value) return ''
  if (days.value < 0) return '已过期，记得续费'
  if (days.value === 0) return '今天到期'
  if (status.value === 'soon') return '快到期了，记得续费'
  return '有效期内'
})

const progress = computed(() => {
  if (!product.value) return 0
  if (days.value <= 0) return 0
  const span = totalSpanDays(product.value)
  if (!span) return 100
  return Math.max(4, Math.min(100, Math.round((days.value / span) * 100)))
})

const spend = computed(() => (product.value ? productSpend(product.value) : 0))

function money(value) {
  const n = Number(value) || 0
  return n > 0 ? `¥${n.toFixed(2)}` : '—'
}

const reminderText = computed(() => {
  if (!product.value) return ''
  const rd = effectiveReminderDays(product.value, state.settings.defaultReminderDays)
  return product.value.reminderDays >= 0 ? `提前 ${rd} 天（单独设置）` : `提前 ${rd} 天`
})

const sortedRenewals = computed(() => {
  if (!product.value) return []
  return [...product.value.renewals].sort((a, b) => (a.date < b.date ? 1 : -1))
})

async function refresh() {
  const p = getProduct(productId.value)
  product.value = p
  if (!p) {
    imageUrls.value = []
    return
  }
  imageUrls.value = await Promise.all(p.images.map(m => resolveImageUrl(m)))
}

onLoad(options => {
  productId.value = (options && options.id) || ''
  refresh()
})

onShow(() => {
  if (productId.value) refresh()
})

function previewImage(index) {
  uni.previewImage({ urls: imageUrls.value, current: index })
}

function goEdit() {
  uni.navigateTo({ url: `/pages/edit/edit?id=${encodeURIComponent(productId.value)}` })
}

function goHome() {
  uni.reLaunch({ url: '/pages/index/index' })
}

function openRenew() {
  renew.value = 30
  renew.unit = 'day'
  renew.amount = ''
  renew.note = ''
  showRenew.value = true
}

function closeRenew() {
  showRenew.value = false
}

function doRenew() {
  const value = Number(renew.value)
  if (!Number.isFinite(value) || value <= 0) {
    uni.showToast({ title: '请填写续费时长', icon: 'none' })
    return
  }
  const next = renewProduct(product.value, {
    value,
    unit: renew.unit,
    amount: Number(renew.amount) || 0,
    note: renew.note
  })
  if (!saveProduct(next)) {
    uni.showToast({ title: '续费保存失败，请重试', icon: 'none' })
    return
  }
  reschedule(state.products, state.settings)
  showRenew.value = false
  refresh()
  uni.showToast({ title: `已续费，到期日 ${next.expiryDate}`, icon: 'none' })
}

function confirmDelete() {
  uni.showModal({
    title: '删除商品',
    content: `确定删除「${product.value.name}」吗？图片和续费记录会一起删除，无法恢复。`,
    confirmText: '删除',
    confirmColor: '#B03A31',
    success: async res => {
      if (!res.confirm) return
      // 先删数据，成功后再清图片；否则存储写入失败时会丢掉图片但商品还在
      const images = product.value.images.slice()
      if (!deleteProduct(product.value.id)) {
        uni.showToast({ title: '删除失败，请重试', icon: 'none' })
        return
      }
      uni.showLoading({ title: '删除中' })
      await Promise.all(images.map(m => removeImage(m)))
      reschedule(state.products, state.settings)
      uni.hideLoading()
      uni.navigateBack({
        fail: () => uni.reLaunch({ url: '/pages/index/index' })
      })
    }
  })
}
</script>

<style scoped>
.nav-action {
  font-size: 28rpx;
  color: var(--brand);
  font-weight: 600;
  padding: 12rpx;
}

.missing {
  padding: 200rpx 60rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.missing-text {
  color: var(--ink-3);
  font-size: 28rpx;
}

.missing-btn {
  margin-top: 32rpx;
}

.gallery {
  padding: 8rpx 32rpx 0;
}

.swiper {
  width: 100%;
  height: 686rpx;
  border-radius: 32rpx;
  overflow: hidden;
  background: var(--surface-2);
}

.swiper-img {
  width: 100%;
  height: 100%;
  display: block;
}

.gallery-empty {
  height: 360rpx;
  border-radius: 32rpx;
  background: var(--surface);
  border: 2rpx dashed var(--line);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.gallery-empty-tip {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: var(--ink-3);
}

.title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-top: 32rpx;
}

.name {
  flex: 1;
  font-size: 42rpx;
  font-weight: 700;
  line-height: 1.3;
  color: var(--ink);
  letter-spacing: 0.5rpx;
}

.status-pill {
  flex-shrink: 0;
  margin-left: 20rpx;
  margin-top: 8rpx;
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 600;
}

.status-pill.normal {
  background: var(--brand-soft);
  color: var(--brand);
}

.status-pill.soon {
  background: var(--warn-soft);
  color: var(--warn);
}

.status-pill.expired {
  background: var(--danger-soft);
  color: var(--danger);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  margin-top: 16rpx;
}

.tag {
  margin-right: 12rpx;
  margin-bottom: 10rpx;
  padding: 6rpx 18rpx;
  border-radius: 8rpx;
  background: var(--surface);
  border: 2rpx solid var(--line);
  font-size: 22rpx;
  color: var(--ink-2);
}

.tag-cat {
  background: var(--brand-soft);
  border-color: transparent;
  color: var(--brand);
}

.countdown {
  margin-top: 28rpx;
  border-radius: 28rpx;
  padding: 28rpx 32rpx;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.cd-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cd-label {
  font-size: 24rpx;
  color: var(--ink-3);
  letter-spacing: 1rpx;
}

.cd-date {
  font-size: 22rpx;
  color: var(--ink-3);
}

.cd-num-row {
  display: flex;
  align-items: baseline;
  margin-top: 8rpx;
}

.cd-num {
  font-size: 88rpx;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -1rpx;
}

.cd-unit {
  margin-left: 8rpx;
  font-size: 28rpx;
  color: var(--ink-2);
}

.cd-desc {
  margin-left: auto;
  font-size: 24rpx;
  color: var(--ink-3);
}

.countdown.normal .cd-num {
  color: var(--brand);
}

.countdown.soon .cd-num {
  color: var(--warn);
}

.countdown.expired .cd-num {
  color: var(--danger);
}

.cd-bar {
  margin-top: 18rpx;
  height: 10rpx;
  border-radius: 999rpx;
  background: #eeebe4;
  overflow: hidden;
}

.cd-fill {
  height: 100%;
  border-radius: 999rpx;
  background: var(--brand);
  transition: width 0.3s ease;
}

.countdown.soon .cd-fill {
  background: var(--warn);
}

.countdown.expired .cd-fill {
  background: var(--danger);
}

.info {
  margin-top: 24rpx;
  padding: 8rpx 28rpx;
}

.info-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 22rpx 0;
  border-bottom: 2rpx solid var(--surface-2);
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  flex-shrink: 0;
  font-size: 26rpx;
  color: var(--ink-3);
  width: 160rpx;
}

.info-value {
  font-size: 27rpx;
  color: var(--ink);
  text-align: right;
}

.info-note {
  line-height: 1.6;
  white-space: pre-wrap;
}

.actions {
  margin-top: 28rpx;
  display: flex;
}

.actions .btn {
  flex: 1;
}

.actions .btn + .btn {
  margin-left: 20rpx;
}

.section {
  margin-top: 48rpx;
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
}

.section-count {
  font-size: 24rpx;
  color: var(--ink-3);
}

.renew-list {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: 0 24rpx;
}

.renew-row {
  display: flex;
  align-items: center;
  padding: 22rpx 0;
  border-bottom: 2rpx solid var(--surface-2);
  font-size: 26rpx;
}

.renew-row:last-child {
  border-bottom: none;
}

.renew-date {
  width: 200rpx;
  color: var(--ink-2);
}

.renew-dur {
  flex: 1;
  color: var(--ink);
}

.renew-amount {
  color: var(--ink-2);
}

.section-empty {
  font-size: 26rpx;
}

.delete-row {
  margin-top: 48rpx;
  padding: 24rpx 0 8rpx;
  display: flex;
  justify-content: center;
}

.delete-text {
  font-size: 26rpx;
  color: var(--danger);
  padding: 12rpx 32rpx;
}

.mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: rgba(20, 24, 21, 0.45);
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet {
  width: 750rpx;
  max-width: 100%;
  background: var(--surface);
  border-radius: 36rpx 36rpx 0 0;
  padding: 20rpx 40rpx calc(40rpx + env(safe-area-inset-bottom));
}

.sheet-handle {
  width: 72rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: var(--line);
  margin: 0 auto 28rpx;
}

.sheet-title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  text-align: center;
}

.sheet-sub {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: var(--ink-3);
  text-align: center;
}

.field {
  margin-top: 32rpx;
}

.field-label {
  display: block;
  font-size: 24rpx;
  color: var(--ink-3);
  margin-bottom: 12rpx;
}

.input {
  height: 92rpx;
  padding: 0 24rpx;
  border-radius: 18rpx;
  background: var(--surface-2);
  border: 2rpx solid var(--line);
  font-size: 30rpx;
  color: var(--ink);
}

.dur-row {
  display: flex;
  align-items: center;
}

.dur-input {
  width: 180rpx;
  margin-right: 20rpx;
  text-align: center;
}

.seg {
  flex: 1;
  display: flex;
  background: var(--surface-2);
  border-radius: 18rpx;
  padding: 6rpx;
  border: 2rpx solid var(--line);
}

.seg-item {
  flex: 1;
  height: 76rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  color: var(--ink-2);
  border-radius: 14rpx;
}

.seg-item.active {
  background: var(--surface);
  color: var(--brand);
  font-weight: 600;
  box-shadow: 0 4rpx 12rpx rgba(29, 35, 31, 0.08);
}

.sheet-btn {
  margin-top: 44rpx;
}

.sheet-cancel {
  height: 96rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: var(--ink-3);
}
</style>
