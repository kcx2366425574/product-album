<template>
  <view class="product-card" @tap="$emit('open', product)">
    <view class="cover">
      <image v-if="coverUrl" class="cover-img" :src="coverUrl" mode="aspectFill" />
      <view v-else class="cover-fallback">
        <view class="ph-sun" />
        <view class="ph-hill" />
      </view>

      <view class="badge" :class="status">{{ badgeText }}</view>
      <view v-if="product.images.length > 1" class="count">{{ product.images.length }} 图</view>
    </view>

    <view class="body">
      <text class="name">{{ product.name }}</text>
      <view class="meta">
        <text class="days num" :class="status">{{ daysText }}</text>
        <text class="date">{{ product.expiryDate }}</text>
      </view>
      <view class="bar">
        <view class="fill" :class="status" :style="{ width: progress + '%' }" />
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { daysLeft, statusOf, totalSpanDays } from '@/services/expiry'
import { useImageUrl } from '@/composables/useImageUrl'

const props = defineProps({
  product: { type: Object, required: true },
  defaultReminderDays: { type: Number, default: 7 },
  today: { type: String, default: '' }
})

defineEmits(['open'])

const cover = computed(() => props.product.images[props.product.coverIndex] || null)
const coverUrl = useImageUrl(cover)

const days = computed(() => daysLeft(props.product.expiryDate, props.today || undefined))
const status = computed(() => statusOf(props.product, props.defaultReminderDays, props.today || undefined))

const badgeText = computed(() => {
  if (days.value < 0) return '已过期'
  if (days.value === 0) return '今天到期'
  return `剩 ${days.value} 天`
})

const daysText = computed(() => {
  if (days.value < 0) return `过期 ${Math.abs(days.value)} 天`
  if (days.value === 0) return '今天到期'
  return `剩余 ${days.value} 天`
})

const progress = computed(() => {
  if (days.value <= 0) return 0
  const span = totalSpanDays(props.product)
  if (!span) return 100
  return Math.max(4, Math.min(100, Math.round((days.value / span) * 100)))
})
</script>

<style scoped>
.product-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.cover {
  position: relative;
  width: 100%;
  padding-bottom: 100%;
  background: var(--surface-2);
}

.cover-img {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.cover-fallback {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: linear-gradient(150deg, #eef1e9 0%, #e3e8dd 100%);
}

.ph-sun {
  position: absolute;
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: rgba(47, 107, 79, 0.18);
  left: 30%;
  top: 26%;
}

.ph-hill {
  position: absolute;
  left: -10%;
  bottom: -22%;
  width: 120%;
  height: 58%;
  border-radius: 50% 50% 0 0;
  background: rgba(47, 107, 79, 0.12);
}

.badge {
  position: absolute;
  left: 16rpx;
  top: 16rpx;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 600;
  color: #ffffff;
  backdrop-filter: blur(4px);
}

.badge.normal {
  background: rgba(47, 107, 79, 0.88);
}

.badge.soon {
  background: rgba(185, 97, 26, 0.9);
}

.badge.expired {
  background: rgba(176, 58, 49, 0.9);
}

.count {
  position: absolute;
  right: 16rpx;
  bottom: 16rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  font-size: 20rpx;
  color: #ffffff;
  background: rgba(29, 35, 31, 0.5);
}

.body {
  padding: 20rpx 22rpx 24rpx;
}

.name {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--ink);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.meta {
  margin-top: 10rpx;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8rpx;
}

.days {
  font-size: 24rpx;
  font-weight: 600;
}

.days.normal {
  color: var(--brand);
}

.days.soon {
  color: var(--warn);
}

.days.expired {
  color: var(--danger);
}

.date {
  font-size: 20rpx;
  color: var(--ink-3);
}

.bar {
  margin-top: 16rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: #eeebe4;
  overflow: hidden;
}

.fill {
  height: 100%;
  border-radius: 999rpx;
  transition: width 0.3s ease;
}

.fill.normal {
  background: var(--brand);
}

.fill.soon {
  background: var(--warn);
}

.fill.expired {
  background: var(--danger);
}
</style>
