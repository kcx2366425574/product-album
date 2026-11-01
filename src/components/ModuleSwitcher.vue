<template>
  <view class="module-switch">
    <view class="switcher" @tap.stop="toggle">
      <view class="mark" :class="current">
        <view v-if="current === 'album'" class="leaf" />
        <view v-else class="bell" />
      </view>
      <text class="name">{{ currentInfo.label }}</text>
      <text class="caret" :class="{ up: open }">▾</text>
    </view>

    <view v-if="open" class="overlay" @tap="close" />

    <view v-if="open" class="menu">
      <view
        v-for="item in MODULE_LIST"
        :key="item.key"
        class="menu-item"
        :class="{ active: item.key === current }"
        @tap="go(item)"
      >
        <view class="menu-mark" :class="item.key">
          <view v-if="item.key === 'album'" class="leaf small" />
          <view v-else class="bell small" />
        </view>
        <view class="menu-text">
          <text class="menu-name">{{ item.label }}</text>
          <text class="menu-sub">{{ item.sub }}</text>
        </view>
        <text v-if="item.key === current" class="menu-check">✓</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  current: { type: String, default: 'album' }
})

const MODULES = {
  album: {
    key: 'album',
    label: '商品图册',
    sub: '图片与到期提醒',
    url: '/pages/index/index'
  },
  alarm: {
    key: 'alarm',
    label: '闹钟',
    sub: '重复闹钟与响铃提醒',
    url: '/pages/alarm/alarm'
  }
}

const MODULE_LIST = [MODULES.album, MODULES.alarm]
const currentInfo = computed(() => MODULES[props.current] || MODULES.album)
const open = ref(false)

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

function go(item) {
  open.value = false
  if (!item || item.key === props.current) return
  uni.reLaunch({
    url: item.url,
    fail: () => uni.navigateTo({ url: item.url })
  })
}
</script>

<style scoped>
.module-switch {
  position: relative;
  flex-shrink: 0;
}

.switcher {
  display: flex;
  align-items: center;
  padding: 8rpx 10rpx 8rpx 0;
  border-radius: 999rpx;
}

.mark {
  width: 44rpx;
  height: 44rpx;
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 14rpx;
  flex-shrink: 0;
}

.mark.album {
  background: var(--brand);
}

.mark.alarm {
  background: var(--warn);
}

.leaf {
  width: 18rpx;
  height: 18rpx;
  border-radius: 2rpx 12rpx 2rpx 12rpx;
  background: #ffffff;
  transform: rotate(-12deg);
}

.leaf.small {
  width: 16rpx;
  height: 16rpx;
}

.bell {
  position: relative;
  width: 18rpx;
  height: 16rpx;
  border-radius: 9rpx 9rpx 3rpx 3rpx;
  background: #ffffff;
}

.bell::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -6rpx;
  width: 8rpx;
  height: 4rpx;
  border-radius: 50%;
  background: #ffffff;
  transform: translateX(-50%);
}

.bell.small {
  width: 16rpx;
  height: 14rpx;
}

.name {
  font-size: 32rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
  color: var(--ink);
  white-space: nowrap;
}

.caret {
  margin-left: 6rpx;
  font-size: 20rpx;
  color: var(--ink-3);
  transition: transform 0.18s ease;
}

.caret.up {
  transform: rotate(180deg);
}

.overlay {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 80;
  background: transparent;
}

.menu {
  position: absolute;
  left: 0;
  top: calc(100% + 8rpx);
  z-index: 90;
  width: 440rpx;
  padding: 10rpx;
  border-radius: 24rpx;
  background: var(--surface);
  border: 2rpx solid var(--line);
  box-shadow: 0 18rpx 48rpx rgba(29, 35, 31, 0.18);
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 18rpx 16rpx;
  border-radius: 18rpx;
}

.menu-item.active {
  background: var(--brand-soft);
}

.menu-mark {
  width: 56rpx;
  height: 56rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 18rpx;
  flex-shrink: 0;
}

.menu-mark.album {
  background: var(--brand);
}

.menu-mark.alarm {
  background: var(--warn);
}

.menu-text {
  flex: 1;
  min-width: 0;
}

.menu-name {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--ink);
}

.menu-sub {
  display: block;
  margin-top: 2rpx;
  font-size: 21rpx;
  color: var(--ink-3);
}

.menu-check {
  margin-left: 12rpx;
  font-size: 28rpx;
  font-weight: 700;
  color: var(--brand);
}
</style>
