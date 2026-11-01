import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_VERSION } from '@/utils/appInfo'

let respond

vi.stubGlobal('uni', {
  request: options => respond(options)
})

const { checkForUpdate, getCurrentVersion } = await import('@/services/updater')

const FEED = 'https://raw.githubusercontent.com/kcx2366425574/product-album/master/releases/latest.json'

beforeEach(() => {
  respond = options => options.fail({ errMsg: 'not stubbed' })
})

function manifest(overrides = {}) {
  return {
    versionName: '99.0.0',
    versionCode: 9900,
    apk: 'product-album-99.0.0.apk',
    notes: '新版本',
    ...overrides
  }
}

describe('getCurrentVersion', () => {
  it('没有原生运行时时返回构建版本', () => {
    expect(getCurrentVersion()).toBe(APP_VERSION)
  })
})

describe('checkForUpdate', () => {
  it('发现更高版本并解析相对 APK 地址', async () => {
    respond = options =>
      options.success({
        statusCode: 200,
        data: JSON.stringify(manifest())
      })

    const result = await checkForUpdate({ feedUrl: FEED })
    expect(result.status).toBe('update')
    expect(result.currentVersion).toBe(APP_VERSION)
    expect(result.manifest.apkUrl).toBe(
      'https://raw.githubusercontent.com/kcx2366425574/product-album/master/releases/product-album-99.0.0.apk'
    )
  })

  it('支持对象形式的响应体', async () => {
    respond = options =>
      options.success({
        statusCode: 200,
        data: manifest({ versionName: '0.0.1', versionCode: 1 })
      })

    const result = await checkForUpdate({ feedUrl: FEED })
    expect(result.status).toBe('latest')
  })

  it('没有配置地址时返回错误', async () => {
    const result = await checkForUpdate({ feedUrl: '' })
    expect(result).toMatchObject({ status: 'error' })
  })

  it('HTTP 非 200 返回错误', async () => {
    respond = options => options.success({ statusCode: 404, data: 'not found' })
    const result = await checkForUpdate({ feedUrl: FEED })
    expect(result.status).toBe('error')
    expect(result.error).toContain('404')
  })

  it('JSON 解析失败或信息不完整返回错误', async () => {
    respond = options => options.success({ statusCode: 200, data: '{' })
    expect((await checkForUpdate({ feedUrl: FEED })).status).toBe('error')

    respond = options => options.success({ statusCode: 200, data: { versionName: '2.0.0' } })
    const result = await checkForUpdate({ feedUrl: FEED })
    expect(result.status).toBe('error')
    expect(result.error).toContain('APK')
  })

  it('网络失败返回错误', async () => {
    respond = options => options.fail({ errMsg: 'request:fail timeout' })
    const result = await checkForUpdate({ feedUrl: FEED })
    expect(result.status).toBe('error')
    expect(result.error).toContain('timeout')
  })
})
