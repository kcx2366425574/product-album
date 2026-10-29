<script setup>
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { initStore, state } from '@/store/app'
import { pruneNotifyRecords, reschedule, runScan } from '@/services/reminder'
import { loadPromptRecord, savePromptRecord } from '@/services/db'
import { consumeLaunchPayload } from '@/services/notify'
import { todayStr } from '@/utils/date'

let lastScanAt = 0
let launchPayloadHandled = false

function scanAndPrompt() {
  const now = Date.now()
  // onLaunch / onShow 会连续触发，避免重复扫描
  if (now - lastScanAt < 1500) return
  lastScanAt = now
  try {
    const { pending } = runScan(state.products, state.settings)
    reschedule(state.products, state.settings)
    pruneNotifyRecords(state.products)
    promptIfNeeded(pending)
  } catch (e) {
    console.error('[app] 提醒扫描失败', e)
  }
}

function promptIfNeeded(pending) {
  if (!pending || !pending.length) return
  const today = todayStr()
  const record = loadPromptRecord()
  if (record.lastPromptDate === today) return

  const lines = pending.slice(0, 3).map(item => {
    if (item.type === 'expired') return `「${item.product.name}」已过期 ${Math.abs(item.days)} 天`
    if (item.type === 'expiry') return `「${item.product.name}」今天到期`
    return `「${item.product.name}」还有 ${item.days} 天到期`
  })
  if (pending.length > 3) lines.push(`…等 ${pending.length} 件商品需要处理`)

  savePromptRecord({ ...record, lastPromptDate: today })
  uni.showModal({
    title: '到期提醒',
    content: lines.join('\n'),
    confirmText: '知道了',
    showCancel: false
  })
}

function handleLaunchPayload() {
  if (launchPayloadHandled) return
  const payload = consumeLaunchPayload()
  if (!payload || !payload.productId) return
  launchPayloadHandled = true
  setTimeout(() => {
    uni.navigateTo({ url: `/pages/detail/detail?id=${encodeURIComponent(payload.productId)}` })
  }, 300)
}

onLaunch(() => {
  initStore()
})

onShow(() => {
  initStore()
  scanAndPrompt()
  handleLaunchPayload()
})
</script>

<style>
page {
  --bg: #f4f2ec;
  --surface: #ffffff;
  --surface-2: #fbfaf6;
  --ink: #1d231f;
  --ink-2: #59625c;
  --ink-3: #8c958f;
  --line: #e7e2d9;
  --brand: #2f6b4f;
  --brand-dark: #24543d;
  --brand-soft: #e6f0e9;
  --warn: #b9611a;
  --warn-soft: #fbeedf;
  --danger: #b03a31;
  --danger-soft: #fbe9e6;
  --radius-lg: 28rpx;
  --radius-md: 20rpx;
  --radius-sm: 12rpx;
  --shadow: 0 10rpx 34rpx rgba(29, 35, 31, 0.06);

  background: var(--bg);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', sans-serif;
  font-size: 28rpx;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

view,
text,
image,
scroll-view,
swiper {
  box-sizing: border-box;
}

.page {
  min-height: 100vh;
  max-width: 750rpx;
  margin: 0 auto;
  background: var(--bg);
  padding-bottom: calc(180rpx + env(safe-area-inset-bottom));
}

.container {
  padding-left: 32rpx;
  padding-right: 32rpx;
}

/* 自定义导航栏：顶部留出状态栏 */
.nav {
  position: sticky;
  top: 0;
  z-index: 30;
  padding-top: var(--status-bar-height);
  background: var(--bg);
}

.nav-inner {
  height: 100rpx;
  padding: 0 24rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.nav-title {
  font-size: 32rpx;
  font-weight: 600;
  letter-spacing: 0.5rpx;
}

.nav-side {
  width: 88rpx;
  display: flex;
  align-items: center;
}

.nav-side.right {
  justify-content: flex-end;
}

.icon-back {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-back::before {
  content: '';
  width: 20rpx;
  height: 20rpx;
  border-left: 4rpx solid var(--ink);
  border-bottom: 4rpx solid var(--ink);
  transform: rotate(45deg);
}

/* 按钮 */
.btn {
  height: 96rpx;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 600;
  letter-spacing: 1rpx;
}

.btn-primary {
  background: var(--brand);
  color: #ffffff;
}

.btn-primary:active {
  background: var(--brand-dark);
}

.btn-ghost {
  background: transparent;
  border: 2rpx solid var(--line);
  color: var(--ink);
}

.btn-ghost:active {
  background: var(--surface-2);
}

.btn-danger {
  background: var(--danger-soft);
  color: var(--danger);
}

.btn-sm {
  height: 72rpx;
  padding: 0 32rpx;
  font-size: 26rpx;
  border-radius: 16rpx;
}

/* 筛选 chip */
.chip {
  padding: 12rpx 28rpx;
  border-radius: 999rpx;
  background: var(--surface);
  border: 2rpx solid var(--line);
  color: var(--ink-2);
  font-size: 26rpx;
  white-space: nowrap;
}

.chip.active {
  background: var(--ink);
  border-color: var(--ink);
  color: #ffffff;
}

/* 卡片 */
.card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
}

.muted {
  color: var(--ink-3);
}

.num {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum';
}

/* #ifdef H5 */
html,
body {
  background: var(--bg);
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-thumb {
  background: rgba(29, 35, 31, 0.14);
  border-radius: 3px;
}
/* #endif */
</style>
