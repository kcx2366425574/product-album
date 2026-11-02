import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  stopRinging: vi.fn()
}))

const native = await import('@/uni_modules/helper-alarm')
const { getRingingAlarmId, isRinging, stopRinging } = await import('@/services/notify')

beforeEach(() => {
  native.isRinging.mockReset().mockReturnValue(false)
  native.getRingingAlarmId.mockReset().mockReturnValue('')
  native.stopRinging.mockReset()
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
