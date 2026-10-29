<template>
  <view class="page">
    <NavBar title="到期日历" />

    <view class="container">
      <view class="month-bar">
        <view class="month-nav" @tap="shiftMonth(-1)">‹</view>
        <view class="month-main">
          <text class="month-title num">{{ year }} 年 {{ month }} 月</text>
          <text class="month-sub">本月 {{ monthCount }} 件到期</text>
        </view>
        <view class="month-nav" @tap="shiftMonth(1)">›</view>
      </view>

      <view class="calendar card">
        <view class="week-row">
          <text v-for="weekday in WEEKDAYS" :key="weekday" class="week-cell">{{ weekday }}</text>
        </view>

        <view class="grid">
          <view
            v-for="cell in grid"
            :key="cell.date"
            class="day-cell"
            :class="{
              out: !cell.inMonth,
              today: cell.isToday,
              selected: cell.date === selectedDate
            }"
            :data-date="cell.date"
            @tap="selectDay(cell)"
          >
            <text class="day-num num">{{ cell.day }}</text>
            <view v-if="hasItems(cell.date)" class="day-dot" :class="dotClass(cell.date)" />
          </view>
        </view>
      </view>

      <view class="day-panel card">
        <view class="panel-head">
          <text class="panel-title">{{ selectedLabel }}</text>
          <text class="panel-count">{{ dayItems.length }} 件</text>
        </view>

        <view v-if="dayItems.length" class="day-list">
          <view v-for="item in dayItems" :key="item.id" class="day-item" @tap="goDetail(item)">
            <view class="item-main">
              <text class="item-name">{{ item.name }}</text>
              <text class="item-meta">
                {{ item.category || '未分类' }} · {{ statusText(item) }}
              </text>
            </view>
            <text class="item-arrow">›</text>
          </view>
        </view>
        <text v-else class="empty-text">这一天没有商品到期</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import NavBar from '@/components/NavBar.vue'
import { initStore, state } from '@/store/app'
import { WEEKDAYS, buildMonthGrid, groupExpiries, monthExpiryCount } from '@/services/calendar'
import { daysLeft, statusOf } from '@/services/expiry'
import { pad2 } from '@/utils/date'

const initial = new Date()
const year = ref(initial.getFullYear())
const month = ref(initial.getMonth() + 1)
const selectedDate = ref('')

function monthPrefix(y, m) {
  return `${y}-${pad2(m)}`
}

function defaultSelectedDate(y, m) {
  const prefix = monthPrefix(y, m)
  return state.today.startsWith(prefix) ? state.today : `${prefix}-01`
}

selectedDate.value = defaultSelectedDate(year.value, month.value)

const grid = computed(() => buildMonthGrid(year.value, month.value, state.today))
const byDate = computed(() => groupExpiries(state.products))
const monthCount = computed(() => monthExpiryCount(state.products, year.value, month.value))

const dayItems = computed(() => {
  const items = byDate.value[selectedDate.value] || []
  return items.slice().sort((a, b) => {
    const da = daysLeft(a.expiryDate, state.today)
    const db = daysLeft(b.expiryDate, state.today)
    if (da !== db) return da - db
    return String(a.name).localeCompare(String(b.name), 'zh-CN')
  })
})

const selectedLabel = computed(() =>
  selectedDate.value ? `${selectedDate.value} 到期` : '选择日期'
)

onShow(() => {
  initStore()
  if (!selectedDate.value) selectedDate.value = defaultSelectedDate(year.value, month.value)
})

function hasItems(date) {
  return !!(byDate.value[date] && byDate.value[date].length)
}

function worstStatus(items) {
  let result = 'normal'
  for (const product of items) {
    const status = statusOf(product, state.settings.defaultReminderDays, state.today)
    if (status === 'expired') return 'expired'
    if (status === 'soon') result = 'soon'
  }
  return result
}

function dotClass(date) {
  const items = byDate.value[date]
  return items && items.length ? worstStatus(items) : 'normal'
}

function statusText(product) {
  const days = daysLeft(product.expiryDate, state.today)
  if (days < 0) return `已过期 ${Math.abs(days)} 天`
  if (days === 0) return '今天到期'
  return `剩余 ${days} 天`
}

function selectDay(cell) {
  if (!cell.inMonth) {
    const [y, m] = cell.date.split('-').map(Number)
    year.value = y
    month.value = m
  }
  selectedDate.value = cell.date
}

function shiftMonth(delta) {
  const total = year.value * 12 + (month.value - 1) + delta
  year.value = Math.floor(total / 12)
  month.value = (((total % 12) + 12) % 12) + 1
  selectedDate.value = defaultSelectedDate(year.value, month.value)
}

function goDetail(product) {
  uni.navigateTo({ url: `/pages/detail/detail?id=${encodeURIComponent(product.id)}` })
}
</script>

<style scoped>
.month-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 20rpx;
  margin-bottom: 20rpx;
  border-radius: 24rpx;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.month-nav {
  width: 76rpx;
  height: 76rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 46rpx;
  color: var(--ink-2);
  border-radius: 50%;
  background: var(--surface-2);
}

.month-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.month-title {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--ink);
}

.month-sub {
  margin-top: 4rpx;
  font-size: 22rpx;
  color: var(--ink-3);
}

.calendar {
  padding: 18rpx 12rpx 22rpx;
}

.week-row {
  display: flex;
  padding: 4rpx 8rpx 12rpx;
}

.week-cell {
  flex: 1;
  text-align: center;
  font-size: 22rpx;
  color: var(--ink-3);
}

.grid {
  display: flex;
  flex-wrap: wrap;
}

.day-cell {
  position: relative;
  width: 14.2857%;
  height: 100rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
}

.day-num {
  font-size: 28rpx;
  color: var(--ink);
  line-height: 1.1;
}

.day-cell.out .day-num {
  color: var(--ink-3);
  opacity: 0.42;
}

.day-cell.today {
  background: var(--brand-soft);
}

.day-cell.selected {
  background: var(--brand);
}

.day-cell.selected .day-num {
  color: #ffffff;
  font-weight: 700;
}

.day-dot {
  width: 10rpx;
  height: 10rpx;
  margin-top: 8rpx;
  border-radius: 50%;
}

.day-dot.normal {
  background: var(--brand);
}

.day-dot.soon {
  background: var(--warn);
}

.day-dot.expired {
  background: var(--danger);
}

.day-cell.selected .day-dot {
  background: #ffffff;
}

.day-panel {
  margin-top: 24rpx;
  padding: 8rpx 28rpx 16rpx;
}

.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 20rpx 0 12rpx;
}

.panel-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--ink);
}

.panel-count {
  font-size: 22rpx;
  color: var(--ink-3);
}

.day-item {
  display: flex;
  align-items: center;
  padding: 22rpx 0;
  border-top: 2rpx solid var(--surface-2);
}

.item-main {
  flex: 1;
  min-width: 0;
}

.item-name {
  display: block;
  font-size: 27rpx;
  color: var(--ink);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.item-meta {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  color: var(--ink-3);
}

.item-arrow {
  margin-left: 16rpx;
  font-size: 32rpx;
  color: var(--ink-3);
}

.empty-text {
  display: block;
  padding: 36rpx 0 28rpx;
  font-size: 24rpx;
  color: var(--ink-3);
  text-align: center;
}
</style>
