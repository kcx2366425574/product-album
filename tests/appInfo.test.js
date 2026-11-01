import { describe, expect, it } from 'vitest'
import { APP_VERSION, APP_VERSION_CODE, DEFAULT_UPDATE_FEED_URL } from '@/utils/appInfo'
import manifest from '../src/manifest.json'
import pkg from '../package.json'

describe('版本号', () => {
  it('代码、package.json、manifest.json 三处保持一致', () => {
    expect(APP_VERSION).toBe(pkg.version)
    expect(APP_VERSION).toBe(manifest.versionName)
  })

  it('versionCode 与 manifest.json 保持一致', () => {
    expect(APP_VERSION_CODE).toBe(Number(manifest.versionCode))
  })

  it('默认更新源指向仓库的 releases/latest.json（jsDelivr 镜像）', () => {
    expect(DEFAULT_UPDATE_FEED_URL).toBe(
      'https://cdn.jsdelivr.net/gh/kcx2366425574/product-album@master/releases/latest.json'
    )
  })
})
