import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.stubGlobal('uni', {
  showToast: vi.fn()
})

// notify.js 顶部会导入原生插件的全部函数，这里统一替换成可控的替身
vi.mock('@/uni_modules/helper-alarm', () => ({
  isPermissionGranted: vi.fn(() => true),
  requestPermission: vi.fn(),
  notifyNow: vi.fn(),
  schedule: vi.fn(),
  cancel: vi.fn(),
  canScheduleExactAlarms: vi.fn(() => true),
  openExactAlarmSettings: vi.fn(),
  consumeDeliveredIds: vi.fn(() => ''),
  consumeLaunchPayload: vi.fn(() => ''),
  isRinging: vi.fn(() => false),
  getRingingAlarmId: vi.fn(() => ''),
  stopRinging: vi.fn(),
  pickRingtone: vi.fn(callback => callback('cancel', '')),
  getRingtoneName: vi.fn(() => ''),
  clearRingtone: vi.fn(),
  previewRingtone: vi.fn()
}))

const native = await import('@/uni_modules/helper-alarm')
const {
  clearRingtone,
  getRingingAlarmId,
  getRingtoneName,
  isRinging,
  pickRingtone,
  previewRingtone,
  stopRinging
} = await import('@/services/notify')

beforeEach(() => {
  native.isRinging.mockReset().mockReturnValue(false)
  native.getRingingAlarmId.mockReset().mockReturnValue('')
  native.stopRinging.mockReset()
  native.pickRingtone.mockReset().mockImplementation(callback => callback('cancel', ''))
  native.getRingtoneName.mockReset().mockReturnValue('')
  native.clearRingtone.mockReset()
  native.previewRingtone.mockReset()
  uni.showToast.mockReset()
})

describe('闹钟铃声状态', () => {
  it('原生返回 true 时 isRinging 为 true', () => {
    native.isRinging.mockReturnValue(true)
    expect(isRinging()).toBe(true)
  })

  it('原生调用异常时按未响铃处理', () => {
    native.isRinging.mockImplementation(() => {
      throw new Error('native unavailable')
    })
    expect(isRinging()).toBe(false)
  })

  it('返回正在响铃的闹钟 id', () => {
    native.getRingingAlarmId.mockReturnValue('a1')
    expect(getRingingAlarmId()).toBe('a1')
  })

  it('原生异常时返回空字符串', () => {
    native.getRingingAlarmId.mockImplementation(() => {
      throw new Error('native unavailable')
    })
    expect(getRingingAlarmId()).toBe('')
  })

  it('stopRinging 调用原生停止接口', () => {
    stopRinging()
    expect(native.stopRinging).toHaveBeenCalledTimes(1)
  })

  it('停止接口异常时不向外抛错', () => {
    native.stopRinging.mockImplementation(() => {
      throw new Error('native unavailable')
    })
    expect(() => stopRinging()).not.toThrow()
  })
})

describe('本地铃声', () => {
  it('返回当前本地铃声名', () => {
    native.getRingtoneName.mockReturnValue('起床.mp4')
    expect(getRingtoneName()).toBe('起床.mp4')
  })

  it('读取铃声名异常时返回空字符串', () => {
    native.getRingtoneName.mockImplementation(() => {
      throw new Error('native unavailable')
    })
    expect(getRingtoneName()).toBe('')
  })

  it('选择铃声成功时 resolve ok 并提示文件名', async () => {
    native.pickRingtone.mockImplementation(callback => callback('ok', '起床.mp4'))
    await expect(pickRingtone()).resolves.toBe('ok')
    expect(uni.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('起床.mp4') })
    )
  })

  it('取消选择时 resolve cancel', async () => {
    await expect(pickRingtone()).resolves.toBe('cancel')
  })

  it('选中无法播放的文件时提示并 resolve error', async () => {
    native.pickRingtone.mockImplementation(callback => callback('error', ''))
    await expect(pickRingtone()).resolves.toBe('error')
    expect(uni.showToast).toHaveBeenCalled()
  })

  it('恢复系统铃声和试听会调用原生接口', () => {
    clearRingtone()
    previewRingtone()
    expect(native.clearRingtone).toHaveBeenCalledTimes(1)
    expect(native.previewRingtone).toHaveBeenCalledTimes(1)
  })
})
