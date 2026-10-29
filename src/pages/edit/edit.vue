<template>
  <view class="page edit-page" :class="themeClass">
    <NavBar :title="isEdit ? '编辑商品' : '新建商品'" />

    <view class="container">
      <view class="section">
        <text class="section-title">基本信息</text>
        <view class="field">
          <text class="field-label">商品名称 *</text>
          <input v-model="form.name" class="input" maxlength="40" placeholder="例如：XX 品牌授权图包" />
        </view>
        <view class="field">
          <text class="field-label">分类</text>
          <input v-model="form.category" class="input" maxlength="20" placeholder="例如：服装 / 食品 / 素材" />
        </view>
        <view class="field">
          <text class="field-label">标签</text>
          <input v-model="form.tagsText" class="input" maxlength="60" placeholder="多个标签用空格或逗号分隔" />
        </view>
      </view>

      <view class="section">
        <view class="section-head">
          <text class="section-title">商品图片</text>
          <text class="section-tip">{{ form.images.length }} / {{ MAX_IMAGES }}</text>
        </view>
        <view class="img-grid">
          <view v-for="(m, i) in form.images" :key="m.id" class="img-tile">
            <image
              class="img-thumb"
              :src="imageUrlMap[m.id] || ''"
              mode="aspectFill"
              @tap="previewImage(i)"
            />
            <view class="img-del" @tap.stop="removeAt(i)">×</view>
            <view
              class="img-cover"
              :class="{ active: form.coverIndex === i }"
              @tap.stop="setCover(i)"
            >
              {{ form.coverIndex === i ? '封面' : '设封面' }}
            </view>
          </view>

          <view v-if="form.images.length < MAX_IMAGES" class="img-add" @tap="chooseImages">
            <view class="plus-h" />
            <view class="plus-v" />
            <text class="img-add-text">添加</text>
          </view>
        </view>
      </view>

      <view class="section">
        <text class="section-title">使用时长</text>

        <view class="field">
          <text class="field-label">购买日期</text>
          <picker mode="date" :value="form.purchaseDate" @change="onDateChange">
            <view class="input picker-value num">{{ form.purchaseDate }}</view>
          </picker>
        </view>

        <view class="field">
          <text class="field-label">购买金额（可选）</text>
          <input v-model="form.purchaseAmount" class="input" type="digit" placeholder="0.00" />
        </view>

        <view class="field">
          <text class="field-label">时长</text>
          <view class="dur-row">
            <input v-model="form.durationValue" class="input dur-input num" type="number" />
            <view class="seg">
              <view
                v-for="u in DURATION_UNITS"
                :key="u.value"
                class="seg-item"
                :class="{ active: form.durationUnit === u.value }"
                @tap="form.durationUnit = u.value"
              >
                {{ u.label }}
              </view>
            </view>
          </view>
        </view>

        <view class="preview-row">
          <text class="preview-label">到期日</text>
          <text class="preview-value num">{{ previewExpiry }}</text>
        </view>
        <text v-if="isEdit && hasRenewals" class="hint">
          已包含 {{ original.renewals.length }} 次续费；修改购买日期或时长会重新顺延。
        </text>
      </view>

      <view class="section">
        <text class="section-title">到期提醒</text>
        <view class="switch-row">
          <view class="switch-text">
            <text class="switch-title">跟随全局设置</text>
            <text class="switch-sub">当前默认提前 {{ state.settings.defaultReminderDays }} 天提醒</text>
          </view>
          <switch
            :checked="form.reminderMode === 'default'"
            color="#2F6B4F"
            @change="onReminderModeChange"
          />
        </view>
        <view v-if="form.reminderMode === 'custom'" class="field">
          <text class="field-label">提前天数</text>
          <input v-model="form.reminderDays" class="input" type="number" placeholder="0 表示到期当天提醒" />
        </view>
      </view>

      <view class="section">
        <text class="section-title">备注</text>
        <textarea v-model="form.note" class="textarea" maxlength="500" placeholder="补充说明，比如供应商、续费渠道、价格" auto-height />
      </view>
    </view>

    <view class="footer-wrap">
      <view class="footer">
        <view class="btn btn-primary" @tap="save">{{ isEdit ? '保存修改' : '保存商品' }}</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import NavBar from '@/components/NavBar.vue'
import { getProduct } from '@/services/db'
import { importFromChooseResult, removeImage, resolveImageUrl } from '@/services/imageStore'
import { reschedule } from '@/services/reminder'
import { saveProduct, state } from '@/store/app'
import { DURATION_UNITS, computeExpiryWithRenewals } from '@/services/expiry'
import { themeClass } from '@/store/theme'
import { makeId } from '@/utils/id'
import { todayStr } from '@/utils/date'

const MAX_IMAGES = 20

const isEdit = ref(false)
const original = ref(null)
const saved = ref(false)
const imageUrlMap = reactive({})

let newImages = []
let removedImages = []

const form = reactive({
  id: '',
  name: '',
  category: '',
  tagsText: '',
  note: '',
  purchaseDate: todayStr(),
  purchaseAmount: '',
  durationValue: 90,
  durationUnit: 'day',
  reminderMode: 'default',
  reminderDays: 7,
  images: [],
  coverIndex: 0
})

const hasRenewals = computed(() => !!(original.value && original.value.renewals.length))

const datesChanged = computed(() => {
  if (!original.value) return true
  return (
    form.purchaseDate !== original.value.purchaseDate ||
    Number(form.durationValue) !== original.value.durationValue ||
    form.durationUnit !== original.value.durationUnit
  )
})

const previewExpiry = computed(() => {
  const v = Number(form.durationValue)
  if (!Number.isFinite(v) || v <= 0) return '—'
  if (original.value && !datesChanged.value) return original.value.expiryDate
  const renewals = original.value ? original.value.renewals : []
  return computeExpiryWithRenewals(form.purchaseDate, v, form.durationUnit, renewals)
})

onLoad(async options => {
  const id = options && options.id
  if (!id) return
  const p = getProduct(id)
  if (!p) {
    uni.showToast({ title: '商品不存在', icon: 'none' })
    return
  }
  isEdit.value = true
  original.value = p
  form.id = p.id
  form.name = p.name
  form.category = p.category
  form.tagsText = (p.tags || []).join(' ')
  form.note = p.note
  form.purchaseDate = p.purchaseDate
  form.purchaseAmount = p.purchaseAmount ? String(p.purchaseAmount) : ''
  form.durationValue = p.durationValue
  form.durationUnit = p.durationUnit
  form.reminderMode = p.reminderDays >= 0 ? 'custom' : 'default'
  form.reminderDays = p.reminderDays >= 0 ? p.reminderDays : state.settings.defaultReminderDays
  form.images = p.images.slice()
  form.coverIndex = p.coverIndex
  await fillUrls(form.images)
})

onUnload(() => {
  // 没保存就退出：把本次新导入的图片从本地存储里清掉，避免垃圾数据
  if (saved.value) return
  for (const m of newImages) removeImage(m)
  newImages = []
})

async function fillUrls(list) {
  for (const m of list) {
    if (!m || !m.id) continue
    const url = await resolveImageUrl(m)
    if (url) imageUrlMap[m.id] = url
  }
}

function onDateChange(e) {
  form.purchaseDate = e.detail.value
}

function onReminderModeChange(e) {
  form.reminderMode = e.detail.value ? 'default' : 'custom'
  if (form.reminderMode === 'custom' && !Number(form.reminderDays)) {
    form.reminderDays = state.settings.defaultReminderDays
  }
}

function chooseImages() {
  const remain = MAX_IMAGES - form.images.length
  if (remain <= 0) return
  uni.chooseImage({
    count: remain,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async res => {
      let failed = 0
      uni.showLoading({ title: '处理图片', mask: true })
      try {
        const result = await importFromChooseResult(res)
        failed = result.failed
        form.images.push(...result.items)
        newImages.push(...result.items)
        await fillUrls(result.items)
      } finally {
        uni.hideLoading()
      }
      if (failed) {
        uni.showToast({ title: `${failed} 张图片导入失败`, icon: 'none' })
      }
    }
  })
}

function previewImage(index) {
  const urls = form.images.map(m => imageUrlMap[m.id]).filter(Boolean)
  const current = imageUrlMap[form.images[index].id]
  if (urls.length) uni.previewImage({ urls, current })
}

function setCover(index) {
  form.coverIndex = index
}

function removeAt(index) {
  const m = form.images[index]
  if (!m) return
  const isNew = newImages.some(x => x.id === m.id)
  if (isNew) {
    newImages = newImages.filter(x => x.id !== m.id)
    removeImage(m)
  } else {
    removedImages.push(m)
  }
  form.images.splice(index, 1)
  delete imageUrlMap[m.id]

  if (!form.images.length) form.coverIndex = 0
  else if (index < form.coverIndex) form.coverIndex--
  else if (form.coverIndex >= form.images.length) form.coverIndex = form.images.length - 1
}

function parseTags(text) {
  return String(text || '')
    .split(/[,，\s]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 8)
}

async function save() {
  const name = String(form.name || '').trim()
  if (!name) {
    uni.showToast({ title: '请填写商品名称', icon: 'none' })
    return
  }
  const value = Number(form.durationValue)
  if (!Number.isFinite(value) || value <= 0) {
    uni.showToast({ title: '时长必须大于 0', icon: 'none' })
    return
  }
  const amount = Number(form.purchaseAmount)
  if (Number.isFinite(amount) && amount < 0) {
    uni.showToast({ title: '购买金额不能为负', icon: 'none' })
    return
  }
  const purchaseAmount = Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : 0

  let reminderDays = -1
  if (form.reminderMode === 'custom') {
    reminderDays = Number(form.reminderDays)
    if (!Number.isFinite(reminderDays) || reminderDays < 0) {
      uni.showToast({ title: '提前天数不能为负', icon: 'none' })
      return
    }
    reminderDays = Math.trunc(reminderDays)
  }

  const expiryDate =
    original.value && !datesChanged.value
      ? original.value.expiryDate
      : computeExpiryWithRenewals(
          form.purchaseDate,
          value,
          form.durationUnit,
          original.value ? original.value.renewals : []
        )

  const payload = {
    id: form.id || makeId('p'),
    name,
    category: String(form.category || '').trim(),
    tags: parseTags(form.tagsText),
    note: String(form.note || '').trim(),
    images: form.images.map(m => ({
      id: m.id,
      w: m.w || 0,
      h: m.h || 0,
      size: m.size || 0,
      path: m.path || '',
      thumbId: m.thumbId || '',
      thumbPath: m.thumbPath || '',
      thumbW: m.thumbW || 0,
      thumbH: m.thumbH || 0
    })),
    coverIndex: form.coverIndex,
    purchaseDate: form.purchaseDate,
    purchaseAmount,
    durationValue: value,
    durationUnit: form.durationUnit,
    expiryDate,
    reminderDays,
    renewals: original.value ? original.value.renewals : [],
    createdAt: original.value ? original.value.createdAt : Date.now(),
    updatedAt: Date.now()
  }

  const savedProduct = saveProduct(payload)
  if (!savedProduct) {
    uni.showToast({ title: '保存失败，请检查存储空间', icon: 'none' })
    return
  }
  saved.value = true

  for (const m of removedImages) await removeImage(m)
  removedImages = []
  newImages = []

  reschedule(state.products, state.settings)
  uni.showToast({ title: isEdit.value ? '已保存' : '已添加', icon: 'success' })
  setTimeout(() => {
    uni.navigateBack({
      fail: () => uni.reLaunch({ url: '/pages/index/index' })
    })
  }, 400)
}
</script>

<style scoped>
.edit-page {
  padding-bottom: calc(220rpx + env(safe-area-inset-bottom));
}

.section {
  margin-top: 28rpx;
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.section-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 16rpx;
}

.section-tip {
  font-size: 24rpx;
  color: var(--ink-3);
}

.field {
  margin-bottom: 20rpx;
}

.field-label {
  display: block;
  font-size: 24rpx;
  color: var(--ink-3);
  margin-bottom: 10rpx;
}

.input {
  width: 100%;
  height: 92rpx;
  padding: 0 24rpx;
  border-radius: 18rpx;
  background: var(--surface);
  border: 2rpx solid var(--line);
  font-size: 30rpx;
  color: var(--ink);
}

.picker-value {
  display: flex;
  align-items: center;
}

.textarea {
  width: 100%;
  min-height: 160rpx;
  padding: 24rpx;
  border-radius: 18rpx;
  background: var(--surface);
  border: 2rpx solid var(--line);
  font-size: 28rpx;
  color: var(--ink);
  line-height: 1.6;
}

.img-grid {
  display: flex;
  flex-wrap: wrap;
  margin: 0 -8rpx;
}

.img-tile {
  position: relative;
  width: calc(33.333% - 16rpx);
  margin: 0 8rpx 16rpx;
  padding-bottom: calc(33.333% - 16rpx);
  border-radius: 18rpx;
  overflow: hidden;
  background: var(--surface-2);
}

.img-thumb {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}

.img-del {
  position: absolute;
  right: 6rpx;
  top: 6rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: rgba(20, 24, 21, 0.6);
  color: #ffffff;
  font-size: 28rpx;
  line-height: 40rpx;
  text-align: center;
}

.img-cover {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 44rpx;
  line-height: 44rpx;
  text-align: center;
  font-size: 20rpx;
  color: #ffffff;
  background: rgba(20, 24, 21, 0.45);
}

.img-cover.active {
  background: rgba(47, 107, 79, 0.9);
}

.img-add {
  position: relative;
  width: calc(33.333% - 16rpx);
  margin: 0 8rpx 16rpx;
  padding-bottom: calc(33.333% - 16rpx);
  border-radius: 18rpx;
  border: 2rpx dashed var(--line);
  background: var(--surface-2);
}

.plus-h,
.plus-v {
  position: absolute;
  left: 50%;
  top: 50%;
  background: var(--ink-3);
  border-radius: 4rpx;
  transform: translate(-50%, -50%);
}

.plus-h {
  width: 36rpx;
  height: 4rpx;
}

.plus-v {
  width: 4rpx;
  height: 36rpx;
}

.img-add-text {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 18rpx;
  text-align: center;
  font-size: 20rpx;
  color: var(--ink-3);
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
  height: 80rpx;
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

.preview-row {
  margin-top: 8rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 24rpx;
  border-radius: 18rpx;
  background: var(--brand-soft);
}

.preview-label {
  font-size: 24rpx;
  color: var(--brand);
}

.preview-value {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--brand);
}

.hint {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: var(--ink-3);
  line-height: 1.6;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx;
  border-radius: 18rpx;
  background: var(--surface);
  border: 2rpx solid var(--line);
}

.switch-title {
  display: block;
  font-size: 28rpx;
  color: var(--ink);
}

.switch-sub {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: var(--ink-3);
}

.footer-wrap {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 750rpx;
  max-width: 100%;
  background: linear-gradient(180deg, rgba(244, 242, 236, 0) 0%, var(--bg) 32%);
  padding-top: 40rpx;
  padding-bottom: calc(28rpx + env(safe-area-inset-bottom));
  z-index: 50;
}

.footer {
  padding: 0 32rpx;
}
</style>
