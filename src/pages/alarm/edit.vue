<template>
  <view class="page alarm-edit" :class="themeClass">
    <NavBar :title="isEdit ? '编辑闹钟' : '新建闹钟'" />

    <view class="container">
      <view class="time-card">
        <picker mode="time" :value="form.time" @change="onTimeChange">
          <view class="time-display">
            <text class="time-main num">{{ form.time }}</text>
            <text class="time-hint">点击调整时间</text>
          </view>
        </picker>
      </view>

      <view class="section">
        <text class="section-title">闹钟信息</text>
        <view class="field">
          <input
            v-model="form.title"
            class="input"
            maxlength="30"
            placeholder="名称，例如：起床 / 吃药 / 开会"
          />
        </view>
        <view class="field">
          <input
            v-model="form.note"
            class="input"
            maxlength="120"
            placeholder="备注（可选，会显示在通知里）"
          />
        </view>
      </view>

      <view class="section">
        <text class="section-title">重复</text>

        <view class="seg type-seg">
          <view
            v-for="item in REPEAT_TYPES"
            :key="item.value"
            class="seg-item"
            :class="{ active: form.rule.type === item.value }"
            @tap="setType(item.value)"
          >
            {{ item.label }}
          </view>
        </view>

        <view v-if="form.rule.type === 'once'" class="field select-field">
          <text class="field-label">响铃日期</text>
          <picker mode="date" :value="form.rule.date" :start="todayStr()" @change="onOnceDate">
            <view class="input picker-value num">{{ form.rule.date }}</view>
          </picker>
        </view>

        <view v-if="form.rule.type === 'weekly'" class="field">
          <text class="field-label">星期几（可多选）</text>
          <view class="week-row">
            <view
              v-for="(label, index) in WEEKDAY_LABELS"
              :key="label"
              class="week-chip"
              :class="{ active: form.rule.weekdays.includes(index) }"
              @tap="toggleWeekday(index)"
            >
              {{ label }}
            </view>
          </view>
        </view>

        <view v-if="form.rule.type === 'yearly'" class="field select-field">
          <text class="field-label">月份</text>
          <picker
            mode="selector"
            :range="MONTH_OPTIONS.map(item => item.label)"
            :value="form.rule.month - 1"
            @change="onMonthChange"
          >
            <view class="input picker-value">{{ form.rule.month }} 月</view>
          </picker>
        </view>

        <template v-if="form.rule.type === 'monthly' || form.rule.type === 'yearly'">
          <view class="seg mode-seg">
            <view
              class="seg-item"
              :class="{ active: form.rule.monthlyMode === 'day' }"
              @tap="form.rule.monthlyMode = 'day'"
            >
              按日期
            </view>
            <view
              class="seg-item"
              :class="{ active: form.rule.monthlyMode === 'weekday' }"
              @tap="form.rule.monthlyMode = 'weekday'"
            >
              按星期
            </view>
          </view>

          <view v-if="form.rule.monthlyMode === 'day'" class="field select-field">
            <text class="field-label">日期</text>
            <picker
              mode="selector"
              :range="dayLabels"
              :value="form.rule.day - 1"
              @change="onDayChange"
            >
              <view class="input picker-value num">{{ form.rule.day }} 日</view>
            </picker>
          </view>

          <view v-else class="field">
            <text class="field-label">第几个 / 星期几</text>
            <view class="nth-row">
              <picker
                mode="selector"
                :range="nthLabels"
                :value="nthIndex"
                @change="onNthChange"
              >
                <view class="input picker-value">{{ nthLabel }}</view>
              </picker>
              <picker
                mode="selector"
                :range="WEEKDAY_LABELS"
                :value="form.rule.weekday"
                @change="onWeekdayChange"
              >
                <view class="input picker-value">{{ WEEKDAY_LABELS[form.rule.weekday] }}</view>
              </picker>
            </view>
            <text class="hint">例如「最后一个 + 周六」就是每月最后一个周六。</text>
          </view>
        </template>
      </view>

      <view class="section">
        <text class="section-title">响铃预览</text>
        <view class="preview-card">
          <text class="preview-rule">{{ describeRule(form.rule) }}</text>
          <text class="preview-main">{{ previewText }}</text>
          <view v-if="upcoming.length > 1" class="upcoming">
            <text v-for="item in upcoming.slice(1)" :key="item" class="upcoming-item">
              之后：{{ item }}
            </text>
          </view>
        </view>
      </view>

      <view v-if="isEdit" class="section">
        <view class="btn btn-danger" @tap="remove">删除闹钟</view>
      </view>
    </view>

    <view class="footer-wrap">
      <view class="footer">
        <view class="btn btn-primary" @tap="save">{{ isEdit ? '保存修改' : '保存闹钟' }}</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import NavBar from '@/components/NavBar.vue'
import { loadAlarms } from '@/services/db'
import {
  DAY_OPTIONS,
  MONTH_OPTIONS,
  NTH_OPTIONS,
  REPEAT_TYPES,
  WEEKDAY_LABELS,
  describeRule,
  formatOccurrence,
  nextOccurrence,
  normalizeRule
} from '@/services/alarmRule'
import { rescheduleAlarms } from '@/services/alarmScheduler'
import { offsetDateStr } from '@/services/expiry'
import { alarmState, deleteAlarm, saveAlarm } from '@/store/alarm'
import { atTimeOfDay, pad2, todayStr } from '@/utils/date'
import { makeId } from '@/utils/id'
import { themeClass } from '@/store/theme'

const isEdit = ref(false)
const original = ref(null)

const form = reactive({
  id: '',
  title: '',
  note: '',
  time: defaultTime(),
  rule: normalizeRule({ type: 'daily' })
})

const dayLabels = DAY_OPTIONS.map(item => item.label)
const nthLabels = NTH_OPTIONS.map(item => item.label)

const nthIndex = computed(() => {
  const index = NTH_OPTIONS.findIndex(item => item.value === form.rule.nth)
  return index >= 0 ? index : 0
})
const nthLabel = computed(() => NTH_OPTIONS[nthIndex.value].label)

const previewAlarm = computed(() => ({
  time: form.time,
  enabled: true,
  rule: form.rule
}))

const previewAt = computed(() => nextOccurrence(previewAlarm.value, Date.now()))

const previewText = computed(() => {
  if (previewAt.value != null) return `下次 ${formatOccurrence(previewAt.value)}`
  if (form.rule.type === 'once') return '这个时间已经过去，请调整日期或时间'
  return '这个重复规则不会响铃，请调整'
})

const upcoming = computed(() => {
  const out = []
  let from = Date.now()
  for (let i = 0; i < 3; i++) {
    const at = nextOccurrence(previewAlarm.value, from)
    if (at == null) break
    out.push(formatOccurrence(at))
    from = at
  }
  return out
})

onLoad(options => {
  const id = options && options.id
  if (!id) return

  const alarm = loadAlarms().find(item => item.id === id)
  if (!alarm) {
    uni.showToast({ title: '闹钟不存在', icon: 'none' })
    return
  }

  isEdit.value = true
  original.value = alarm
  form.id = alarm.id
  form.title = alarm.title
  form.note = alarm.note
  form.time = alarm.time
  form.rule = normalizeRule(alarm.rule)
})

function defaultTime() {
  const d = new Date(Date.now() + 60 * 60 * 1000)
  return `${pad2(d.getHours())}:00`
}

function onTimeChange(event) {
  form.time = event.detail.value
}

function setType(type) {
  if (form.rule.type === type) return
  form.rule.type = type
  if (type === 'weekly' && !form.rule.weekdays.length) {
    form.rule.weekdays = [new Date().getDay()]
  }
  if (type === 'once') {
    const at = atTimeOfDay(form.rule.date || todayStr(), form.time)
    if (at <= Date.now()) form.rule.date = offsetDateStr(todayStr(), 1, 'day')
  }
}

function onOnceDate(event) {
  form.rule.date = event.detail.value
}

function toggleWeekday(day) {
  const set = new Set(form.rule.weekdays)
  if (set.has(day)) {
    // 至少保留一天
    if (set.size <= 1) return
    set.delete(day)
  } else {
    set.add(day)
  }
  form.rule.weekdays = [...set].sort((a, b) => a - b)
}

function onMonthChange(event) {
  const item = MONTH_OPTIONS[Number(event.detail.value)]
  if (item) form.rule.month = item.value
}

function onDayChange(event) {
  const item = DAY_OPTIONS[Number(event.detail.value)]
  if (item) form.rule.day = item.value
}

function onNthChange(event) {
  const item = NTH_OPTIONS[Number(event.detail.value)]
  if (item) form.rule.nth = item.value
}

function onWeekdayChange(event) {
  const value = Number(event.detail.value)
  if (Number.isInteger(value) && value >= 0 && value <= 6) form.rule.weekday = value
}

function save() {
  const title = String(form.title || '').trim() || '闹钟'

  if (form.rule.type === 'weekly' && !form.rule.weekdays.length) {
    uni.showToast({ title: '请至少选择一个星期几', icon: 'none' })
    return
  }

  const rule = normalizeRule(form.rule)
  const payload = {
    id: form.id || makeId('a'),
    title,
    note: String(form.note || '').trim(),
    time: form.time,
    enabled: original.value ? original.value.enabled : true,
    rule,
    createdAt: original.value ? original.value.createdAt : Date.now(),
    updatedAt: Date.now()
  }

  if (nextOccurrence({ ...payload, enabled: true }, Date.now()) == null) {
    uni.showToast({
      title: rule.type === 'once' ? '这个时间已经过去' : '这个重复规则不会响铃',
      icon: 'none'
    })
    return
  }

  const saved = saveAlarm(payload)
  if (!saved) {
    uni.showToast({ title: '保存失败，请检查存储空间', icon: 'none' })
    return
  }

  rescheduleAlarms(alarmState.alarms)
  uni.showToast({ title: isEdit.value ? '已保存' : '已添加', icon: 'success' })
  setTimeout(backToList, 400)
}

/** 没有上一页（例如直接打开编辑页）时回到闹钟列表 */
function backToList() {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  if (pages.length > 1) {
    uni.navigateBack({
      fail: () => uni.reLaunch({ url: '/pages/alarm/alarm' })
    })
  } else {
    uni.reLaunch({ url: '/pages/alarm/alarm' })
  }
}

function remove() {
  uni.showModal({
    title: '删除闹钟',
    content: `确定删除「${form.title || '闹钟'}」吗？删除后不再响铃。`,
    confirmText: '删除',
    confirmColor: '#B03A31',
    success: res => {
      if (!res.confirm) return
      if (!deleteAlarm(form.id)) {
        uni.showToast({ title: '删除失败，请重试', icon: 'none' })
        return
      }
      rescheduleAlarms(alarmState.alarms)
      uni.showToast({ title: '已删除', icon: 'none' })
      setTimeout(backToList, 300)
    }
  })
}
</script>

<style scoped>
.alarm-edit {
  padding-bottom: calc(220rpx + env(safe-area-inset-bottom));
}

.time-card {
  margin-top: 24rpx;
  padding: 30rpx 24rpx;
  border-radius: 28rpx;
  background: var(--surface);
  border: 2rpx solid var(--line);
  box-shadow: var(--shadow);
  text-align: center;
}

.time-main {
  display: block;
  font-size: 96rpx;
  line-height: 1.15;
  font-weight: 700;
  letter-spacing: 4rpx;
  color: var(--ink);
}

.time-hint {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: var(--ink-3);
}

.section {
  margin-top: 30rpx;
}

.section-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 16rpx;
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

.select-field {
  margin-top: 20rpx;
}

.seg {
  display: flex;
  background: var(--surface-2);
  border-radius: 18rpx;
  padding: 6rpx;
  border: 2rpx solid var(--line);
}

.seg-item {
  flex: 1;
  height: 78rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: var(--ink-2);
  border-radius: 14rpx;
  white-space: nowrap;
}

.seg-item.active {
  background: var(--surface);
  color: var(--warn);
  font-weight: 600;
  box-shadow: 0 4rpx 12rpx rgba(29, 35, 31, 0.08);
}

.mode-seg {
  margin-top: 20rpx;
}

.week-row {
  display: flex;
  flex-wrap: wrap;
}

.week-chip {
  width: calc(14.2857% - 8rpx);
  margin: 0 4rpx 8rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  background: var(--surface);
  border: 2rpx solid var(--line);
  font-size: 23rpx;
  color: var(--ink-2);
}

.week-chip.active {
  background: var(--warn-soft);
  border-color: var(--warn);
  color: var(--warn);
  font-weight: 600;
}

.nth-row {
  display: flex;
}

.nth-row > picker {
  flex: 1;
}

.nth-row > picker:first-child {
  margin-right: 16rpx;
}

.hint {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: var(--ink-3);
  line-height: 1.6;
}

.preview-card {
  padding: 26rpx 24rpx;
  border-radius: 22rpx;
  background: var(--warn-soft);
}

.preview-rule {
  display: block;
  font-size: 24rpx;
  color: var(--warn);
}

.preview-main {
  display: block;
  margin-top: 8rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: var(--ink);
}

.upcoming {
  margin-top: 14rpx;
  padding-top: 14rpx;
  border-top: 2rpx solid rgba(185, 97, 26, 0.14);
}

.upcoming-item {
  display: block;
  font-size: 22rpx;
  color: var(--ink-2);
  line-height: 1.7;
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
