<template>
  <view class="page">
    <view class="nav">
      <view class="nav-inner">
        <view class="brand">
          <view class="brand-mark">
            <view class="brand-leaf" />
          </view>
          <text class="brand-name">商品图册</text>
        </view>
        <view class="nav-spacer" />
        <view class="settings-btn" @tap="goSettings">
          <view class="s-line"><view class="s-knob knob-1" /></view>
          <view class="s-line"><view class="s-knob knob-2" /></view>
          <view class="s-line"><view class="s-knob knob-3" /></view>
        </view>
      </view>
    </view>

    <view class="hero container">
      <text class="eyebrow">{{ todayLabel }}</text>
      <text class="h1">我的图册</text>
      <text class="sub">
        <text class="num">{{ stats.total }}</text> 件商品在册
        <text v-if="dueItems.length" class="sub-warn">，<text class="num">{{ dueItems.length }}</text> 件需要关注</text>
        <text v-else-if="stats.total" class="sub-ok">，都在有效期内</text>
      </text>
    </view>

    <view class="container">
      <view class="search">
        <view class="search-icon" />
        <input
          v-model="state.keyword"
          class="search-input"
          placeholder="搜索名称 / 分类 / 标签"
          confirm-type="search"
        />
        <view v-if="state.keyword" class="search-clear" @tap="clearKeyword">×</view>
      </view>
    </view>

    <view class="container">
      <view class="overview">
        <view class="overview-head">
          <text class="overview-title">有效期概览</text>
          <text class="overview-tip">点数字筛选</text>
        </view>
        <view class="overview-stats">
          <view class="o-stat" :class="{ active: state.filter === 'all' }" @tap="setFilter('all')">
            <text class="o-num num">{{ stats.total }}</text>
            <text class="o-label">全部</text>
          </view>
          <view class="o-stat" :class="{ active: state.filter === 'normal' }" @tap="setFilter('normal')">
            <text class="o-num num">{{ stats.normal }}</text>
            <text class="o-label">正常</text>
          </view>
          <view class="o-stat" :class="{ active: state.filter === 'soon' }" @tap="setFilter('soon')">
            <text class="o-num num">{{ stats.soon }}</text>
            <text class="o-label">即将到期</text>
          </view>
          <view class="o-stat" :class="{ active: state.filter === 'expired' }" @tap="setFilter('expired')">
            <text class="o-num num">{{ stats.expired }}</text>
            <text class="o-label">已过期</text>
          </view>
        </view>
      </view>
    </view>

    <view class="list-head container">
      <text class="list-title">{{ filterLabel }}</text>
      <text class="list-count">{{ list.length }} 件</text>
    </view>

    <view v-if="list.length" class="grid container">
      <view v-for="p in list" :key="p.id" class="card-wrap">
        <ProductCard
          :product="p"
          :default-reminder-days="state.settings.defaultReminderDays"
          @open="goDetail"
        />
      </view>
    </view>

    <EmptyState
      v-else-if="!state.products.length"
      action-text="添加第一个商品"
      @action="goCreate"
    />

    <view v-else class="none">
      <text class="none-text">{{ state.keyword ? '没有找到匹配的商品' : '当前筛选下没有商品' }}</text>
      <view class="none-btn" @tap="resetFilter">{{ state.keyword ? '清空搜索' : '查看全部' }}</view>
    </view>

    <view class="fab-wrap">
      <view class="fab" @tap="goCreate">
        <view class="plus-h" />
        <view class="plus-v" />
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import ProductCard from '@/components/ProductCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { dueItems, filteredProducts, initStore, state, stats } from '@/store/app'

const list = computed(() => filteredProducts.value)

const FILTER_LABELS = {
  all: '全部商品',
  normal: '正常商品',
  soon: '即将到期',
  expired: '已过期'
}
const filterLabel = computed(() => FILTER_LABELS[state.filter] || '全部商品')

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const todayLabel = (() => {
  const d = new Date()
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${WEEK[d.getDay()]}`
})()

onShow(() => {
  initStore()
})

function setFilter(f) {
  state.filter = f
}

function clearKeyword() {
  state.keyword = ''
}

function resetFilter() {
  state.keyword = ''
  state.filter = 'all'
}

function goDetail(product) {
  uni.navigateTo({ url: `/pages/detail/detail?id=${encodeURIComponent(product.id)}` })
}

function goCreate() {
  uni.navigateTo({ url: '/pages/edit/edit' })
}

function goSettings() {
  uni.navigateTo({ url: '/pages/settings/settings' })
}
</script>

<style scoped>
.brand {
  display: flex;
  align-items: center;
  flex: 1;
}

.brand-mark {
  width: 44rpx;
  height: 44rpx;
  border-radius: 14rpx;
  background: var(--brand);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 14rpx;
}

.brand-leaf {
  width: 18rpx;
  height: 18rpx;
  border-radius: 2rpx 12rpx 2rpx 12rpx;
  background: #ffffff;
  transform: rotate(-12deg);
}

.brand-name {
  font-size: 32rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
  color: var(--ink);
}

.nav-spacer {
  flex: 1;
}

.settings-btn {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.s-line {
  position: relative;
  width: 34rpx;
  height: 2rpx;
  background: var(--ink-2);
  border-radius: 2rpx;
  margin: 4rpx 0;
}

.s-knob {
  position: absolute;
  top: 50%;
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: var(--ink-2);
  transform: translate(-50%, -50%);
}

.knob-1 {
  left: 28%;
}

.knob-2 {
  left: 68%;
}

.knob-3 {
  left: 44%;
}

.hero {
  padding-top: 24rpx;
  padding-bottom: 32rpx;
}

.eyebrow {
  display: block;
  font-size: 24rpx;
  color: var(--ink-3);
  letter-spacing: 1rpx;
}

.h1 {
  display: block;
  margin-top: 10rpx;
  font-size: 56rpx;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: 2rpx;
  color: var(--ink);
}

.sub {
  display: block;
  margin-top: 14rpx;
  font-size: 26rpx;
  color: var(--ink-2);
}

.sub-warn {
  color: var(--warn);
}

.sub-ok {
  color: var(--brand);
}

.search {
  display: flex;
  align-items: center;
  height: 88rpx;
  padding: 0 24rpx;
  border-radius: 20rpx;
  background: var(--surface);
  border: 2rpx solid var(--line);
  margin-bottom: 24rpx;
}

.search-icon {
  position: relative;
  width: 24rpx;
  height: 24rpx;
  border: 3rpx solid var(--ink-3);
  border-radius: 50%;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.search-icon::after {
  content: '';
  position: absolute;
  width: 12rpx;
  height: 3rpx;
  background: var(--ink-3);
  border-radius: 2rpx;
  right: -9rpx;
  bottom: -3rpx;
  transform: rotate(45deg);
}

.search-input {
  flex: 1;
  font-size: 27rpx;
  color: var(--ink);
}

.search-clear {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--ink-3);
  text-align: center;
  line-height: 44rpx;
  font-size: 26rpx;
  flex-shrink: 0;
}

.overview {
  background: linear-gradient(140deg, #263a2f 0%, #1b2620 100%);
  border-radius: 32rpx;
  padding: 30rpx 28rpx 24rpx;
  box-shadow: 0 18rpx 44rpx rgba(31, 42, 36, 0.24);
}

.overview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.overview-title {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.62);
  letter-spacing: 2rpx;
}

.overview-tip {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.34);
}

.overview-stats {
  display: flex;
  margin: 0 -8rpx;
}

.o-stat {
  flex: 1;
  padding: 14rpx 0 12rpx;
  margin: 0 8rpx;
  border-radius: 18rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: background 0.2s ease;
}

.o-stat.active {
  background: rgba(255, 255, 255, 0.1);
}

.o-num {
  font-size: 46rpx;
  font-weight: 700;
  line-height: 1.1;
  color: #ffffff;
}

.o-label {
  margin-top: 6rpx;
  font-size: 21rpx;
  color: rgba(255, 255, 255, 0.56);
}

.o-stat.active .o-label {
  color: rgba(255, 255, 255, 0.86);
}

.list-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 44rpx;
  margin-bottom: 20rpx;
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

.grid {
  display: flex;
  flex-wrap: wrap;
  margin-left: 20rpx;
  margin-right: 20rpx;
}

.card-wrap {
  width: 50%;
  padding: 0 12rpx 24rpx;
}

.none {
  padding: 100rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.none-text {
  font-size: 26rpx;
  color: var(--ink-3);
}

.none-btn {
  margin-top: 24rpx;
  padding: 14rpx 36rpx;
  border-radius: 999rpx;
  border: 2rpx solid var(--line);
  font-size: 26rpx;
  color: var(--ink-2);
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
  background: var(--brand);
  box-shadow: 0 16rpx 36rpx rgba(47, 107, 79, 0.38);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.fab:active {
  background: var(--brand-dark);
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
