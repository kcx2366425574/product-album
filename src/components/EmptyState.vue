<template>
  <view class="empty">
    <view class="empty-art">
      <view class="frame">
        <view class="sun" />
        <view class="hill" />
      </view>
    </view>
    <text class="empty-title">{{ title }}</text>
    <text class="empty-sub">{{ sub }}</text>
    <view v-if="actionText" class="empty-btn" @tap="$emit('action')">
      <text>{{ actionText }}</text>
    </view>
  </view>
</template>

<script setup>
defineProps({
  title: { type: String, default: '还没有商品' },
  sub: { type: String, default: '点右下角的 + 添加第一个商品' },
  actionText: { type: String, default: '' }
})
defineEmits(['action'])
</script>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 60rpx;
}

.empty-art {
  width: 220rpx;
  height: 220rpx;
  border-radius: 36rpx;
  background: var(--surface);
  box-shadow: var(--shadow);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 40rpx;
}

.frame {
  position: relative;
  width: 120rpx;
  height: 120rpx;
  border-radius: 20rpx;
  background: var(--brand-soft);
  overflow: hidden;
}

.sun {
  position: absolute;
  width: 34rpx;
  height: 34rpx;
  border-radius: 50%;
  background: rgba(47, 107, 79, 0.35);
  left: 52rpx;
  top: 24rpx;
}

.hill {
  position: absolute;
  left: -20%;
  bottom: -18%;
  width: 140%;
  height: 60%;
  border-radius: 50% 50% 0 0;
  background: rgba(47, 107, 79, 0.22);
}

.empty-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--ink);
}

.empty-sub {
  margin-top: 12rpx;
  font-size: 26rpx;
  color: var(--ink-3);
  text-align: center;
  line-height: 1.6;
}

.empty-btn {
  margin-top: 40rpx;
  height: 84rpx;
  padding: 0 56rpx;
  border-radius: 999rpx;
  background: var(--brand);
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
}
</style>
