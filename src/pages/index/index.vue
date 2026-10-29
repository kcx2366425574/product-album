<template>
  <view class="page" :class="themeClass">
    <view class="nav">
      <view class="nav-inner">
        <view class="brand">
          <view class="brand-mark">
            <view class="brand-leaf" />
          </view>
          <text class="brand-name">商品图册</text>
        </view>
        <view class="nav-spacer" />
        <view class="calendar-btn" @tap="goCalendar">
          <text class="calendar-text">日历</text>
        </view>
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

    <view v-if="showPermissionBanner" class="container">
      <view class="perm-banner" @tap="openPermission">
        <view class="perm-dot" />
        <view class="perm-main">
          <text class="perm-title">通知未开启</text>
          <text class="perm-sub">
            {{ permissionState === 'denied' ? '系统已关闭通知，到期提醒收不到' : '开启后到期时自动提醒你' }}
          </text>
        </view>
        <text class="perm-action">去开启 ›</text>
      </view>
    </view>

    <view v-if="showBackupBanner" class="container">
      <view class="backup-banner" @tap="goSettings">
        <view class="backup-dot" />
        <view class="perm-main">
          <text class="backup-title">建议备份数据</text>
          <text class="perm-sub">
            {{ state.settings.lastBackupAt ? '商品只存在本机，已超过 30 天没有导出备份' : '商品只存在本机，还没有导出过备份' }}
          </text>
        </view>
        <text class="backup-action">去备份 ›</text>
      </view>
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

    <scroll-view v-if="categories.length" class="cat-row" scroll-x>
      <view class="cat-chip" :class="{ active: !state.category }" @tap="setCategory('')">全部</view>
      <view
        v-for="item in categories"
        :key="item.name"
        class="cat-chip"
        :class="{ active: state.category === item.name }"
        @tap="setCategory(item.name)"
      >
        {{ item.name }}<text class="cat-count">{{ item.count }}</text>
      </view>
    </scroll-view>

    <view class="list-head container">
      <text class="list-title">{{ filterLabel }}</text>
      <view class="list-side">
        <text class="list-count">{{ list.length }} 件</text>
        <view class="manage-btn" @tap="toggleManage">{{ managing ? '取消' : '管理' }}</view>
        <picker mode="selector" :range="sortLabels" :value="sortIndex" @change="onSortChange">
          <view class="sort-btn">{{ sortLabel }}<text class="sort-caret">▾</text></view>
        </picker>
      </view>
    </view>

    <template v-if="list.length">
      <view class="grid container">
        <view v-for="p in visibleList" :key="p.id" class="card-wrap">
          <ProductCard
            :product="p"
            :default-reminder-days="state.settings.defaultReminderDays"
            :today="state.today"
            :selectable="managing"
            :selected="isSelected(p.id)"
            @open="goDetail"
            @select="toggleSelect"
          />
        </view>
      </view>

      <view v-if="hasMore" class="load-more container" @tap="loadMore">
        <text class="load-more-text">加载更多（还有 {{ list.length - visibleCount }} 件）</text>
      </view>
    </template>

    <EmptyState
      v-else-if="!state.products.length"
      action-text="添加第一个商品"
      @action="goCreate"
    />

    <view v-else class="none">
      <text class="none-text">{{ state.keyword ? '没有找到匹配的商品' : '当前筛选下没有商品' }}</text>
      <view class="none-btn" @tap="resetFilter">{{ state.keyword ? '清空搜索' : '查看全部' }}</view>
    </view>

    <view v-if="!managing" class="fab-wrap">
      <view class="fab" @tap="goCreate">
        <view class="plus-h" />
        <view class="plus-v" />
      </view>
    </view>

    <view v-if="managing" class="batch-bar">
      <text class="batch-info">已选 <text class="num">{{ selectedCount }}</text> 件</text>
      <view class="batch-actions">
        <view class="batch-btn" @tap="selectAll">{{ allSelected ? '取消全选' : '全选' }}</view>
        <view
          class="batch-btn danger"
          :class="{ disabled: !selectedCount }"
          @tap="confirmBatchDelete"
        >
          删除
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import ProductCard from '@/components/ProductCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import {
  categories,
  deleteProducts,
  dueItems,
  filteredProducts,
  initStore,
  state,
  stats
} from '@/store/app'
import { ensurePermission, getPermissionState } from '@/services/notify'
import { reschedule } from '@/services/reminder'
import { removeImage } from '@/services/imageStore'
import { SORT_OPTIONS } from '@/services/filters'
import { isBackupDue } from '@/services/backup'
import { themeClass } from '@/store/theme'

const PAGE_SIZE = 40

const managing = ref(false)
const selectedIds = ref(new Set())
const selectedCount = computed(() => selectedIds.value.size)

const list = computed(() => filteredProducts.value)
const allSelected = computed(
  () => list.value.length > 0 && selectedIds.value.size >= list.value.length
)
const visibleCount = ref(PAGE_SIZE)
const visibleList = computed(() => list.value.slice(0, visibleCount.value))
const hasMore = computed(() => list.value.length > visibleCount.value)

// 搜索/筛选/排序变化时回到第一页
watch(
  () => [state.keyword, state.filter, state.category, state.sort],
  () => {
    visibleCount.value = PAGE_SIZE
    // 筛选条件变化后选中项可能不可见，直接退出管理模式
    if (managing.value) {
      managing.value = false
      selectedIds.value = new Set()
    }
  }
)

const sortLabels = SORT_OPTIONS.map(item => item.label)
const sortIndex = computed(() => {
  const index = SORT_OPTIONS.findIndex(item => item.value === state.sort)
  return index >= 0 ? index : 0
})
const sortLabel = computed(() => SORT_OPTIONS[sortIndex.value].label)
const isApp = ref(false)
const permissionState = ref('granted')

const showPermissionBanner = computed(
  () =>
    isApp.value &&
    state.settings.notifyEnabled !== false &&
    permissionState.value !== 'granted' &&
    permissionState.value !== 'unsupported'
)

const showBackupBanner = computed(() =>
  isBackupDue(state.products, state.settings.lastBackupAt)
)

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
  // #ifdef APP-PLUS
  isApp.value = true
  permissionState.value = getPermissionState()
  // #endif
})

async function openPermission() {
  const ok = await ensurePermission()
  permissionState.value = getPermissionState()
  if (ok) {
    reschedule(state.products, state.settings)
    uni.showToast({ title: '通知已开启', icon: 'none' })
  }
}

function setFilter(f) {
  state.filter = f
}

function setCategory(name) {
  state.category = state.category === name ? '' : name
}

function isSelected(id) {
  return selectedIds.value.has(id)
}

function toggleSelect(product) {
  const next = new Set(selectedIds.value)
  if (next.has(product.id)) next.delete(product.id)
  else next.add(product.id)
  selectedIds.value = next
}

function toggleManage() {
  managing.value = !managing.value
  selectedIds.value = new Set()
}

function selectAll() {
  selectedIds.value = allSelected.value ? new Set() : new Set(list.value.map(item => item.id))
}

function confirmBatchDelete() {
  if (!selectedIds.value.size) return

  const ids = [...selectedIds.value]
  const products = state.products.filter(item => selectedIds.value.has(item.id))

  uni.showModal({
    title: '批量删除',
    content: `确定删除选中的 ${ids.length} 件商品吗？图片和续费记录会一起删除，无法恢复。`,
    confirmText: '删除',
    confirmColor: '#B03A31',
    success: async res => {
      if (!res.confirm) return

      // 先写数据，成功后再清理图片
      if (!deleteProducts(ids)) {
        uni.showToast({ title: '删除失败，请重试', icon: 'none' })
        return
      }

      managing.value = false
      selectedIds.value = new Set()
      for (const product of products) {
        await Promise.all((product.images || []).map(image => removeImage(image)))
      }
      reschedule(state.products, state.settings)
      uni.showToast({ title: `已删除 ${products.length} 件`, icon: 'none' })
    }
  })
}

function onSortChange(event) {
  const item = SORT_OPTIONS[Number(event.detail.value)]
  if (item) state.sort = item.value
}

function loadMore() {
  visibleCount.value += PAGE_SIZE
}

function clearKeyword() {
  state.keyword = ''
}

function resetFilter() {
  state.keyword = ''
  state.filter = 'all'
  state.category = ''
  state.sort = 'expiry'
  managing.value = false
  selectedIds.value = new Set()
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

function goCalendar() {
  uni.navigateTo({ url: '/pages/calendar/calendar' })
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

.calendar-btn {
  padding: 12rpx 22rpx;
  margin-right: 10rpx;
  border-radius: 999rpx;
  background: var(--surface);
  border: 2rpx solid var(--line);
}

.calendar-text {
  font-size: 24rpx;
  color: var(--ink-2);
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

.backup-banner {
  display: flex;
  align-items: center;
  padding: 22rpx 24rpx;
  margin-bottom: 20rpx;
  border-radius: 20rpx;
  background: var(--brand-soft);
  border: 2rpx solid rgba(47, 107, 79, 0.16);
}

.backup-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: var(--brand);
  margin-right: 16rpx;
  flex-shrink: 0;
}

.backup-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: var(--brand);
}

.backup-action {
  flex-shrink: 0;
  margin-left: 16rpx;
  font-size: 24rpx;
  font-weight: 600;
  color: var(--brand);
}

.perm-banner {
  display: flex;
  align-items: center;
  padding: 22rpx 24rpx;
  margin-bottom: 20rpx;
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

.cat-row {
  white-space: nowrap;
  padding: 0 32rpx;
  margin-top: 28rpx;
}

.cat-chip {
  display: inline-flex;
  align-items: center;
  padding: 12rpx 24rpx;
  margin-right: 12rpx;
  border-radius: 999rpx;
  background: var(--surface);
  border: 2rpx solid var(--line);
  font-size: 24rpx;
  color: var(--ink-2);
}

.cat-chip.active {
  background: var(--brand-soft);
  border-color: transparent;
  color: var(--brand);
  font-weight: 600;
}

.cat-count {
  margin-left: 8rpx;
  font-size: 20rpx;
  color: var(--ink-3);
}

.cat-chip.active .cat-count {
  color: var(--brand);
  opacity: 0.7;
}

.list-side {
  display: flex;
  align-items: center;
}

.manage-btn {
  margin-left: 16rpx;
  padding: 8rpx 18rpx;
  border-radius: 12rpx;
  background: var(--surface-2);
  font-size: 24rpx;
  color: var(--ink-2);
}

.sort-btn {
  display: flex;
  align-items: center;
  margin-left: 16rpx;
  padding: 8rpx 16rpx;
  border-radius: 12rpx;
  background: var(--surface);
  border: 2rpx solid var(--line);
  font-size: 24rpx;
  color: var(--ink-2);
}

.sort-caret {
  margin-left: 6rpx;
  font-size: 18rpx;
  color: var(--ink-3);
}

.list-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 36rpx;
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

.load-more {
  display: flex;
  justify-content: center;
  padding: 8rpx 32rpx 32rpx;
}

.load-more-text {
  padding: 16rpx 40rpx;
  border-radius: 999rpx;
  background: var(--surface);
  border: 2rpx solid var(--line);
  font-size: 24rpx;
  color: var(--ink-2);
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

.batch-bar {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 750rpx;
  max-width: 100%;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 32rpx calc(20rpx + env(safe-area-inset-bottom));
  background: var(--surface);
  border-top: 2rpx solid var(--line);
  box-shadow: 0 -8rpx 30rpx rgba(29, 35, 31, 0.08);
}

.batch-info {
  font-size: 26rpx;
  color: var(--ink-2);
}

.batch-actions {
  display: flex;
  align-items: center;
}

.batch-btn {
  margin-left: 16rpx;
  padding: 16rpx 32rpx;
  border-radius: 999rpx;
  background: var(--surface-2);
  font-size: 26rpx;
  color: var(--ink);
}

.batch-btn.danger {
  background: var(--danger-soft);
  color: var(--danger);
  font-weight: 600;
}

.batch-btn.disabled {
  opacity: 0.4;
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
