<template>
  <view class="nav">
    <view class="nav-inner">
      <view class="nav-side">
        <view v-if="back" class="icon-back" @tap="goBack" />
      </view>
      <view class="nav-center">
        <text class="nav-title">{{ title }}</text>
      </view>
      <view class="nav-side right">
        <slot name="right" />
      </view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  back: { type: Boolean, default: true }
})

function goBack() {
  uni.navigateBack({
    fail: () => uni.reLaunch({ url: '/pages/index/index' })
  })
}
</script>

<style scoped>
.nav-center {
  flex: 1;
  display: flex;
  justify-content: center;
  min-width: 0;
}

.nav-title {
  font-size: 32rpx;
  font-weight: 600;
  letter-spacing: 0.5rpx;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
