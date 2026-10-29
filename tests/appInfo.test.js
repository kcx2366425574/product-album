import { describe, expect, it } from 'vitest'
import { APP_VERSION } from '@/utils/appInfo'
import manifest from '../src/manifest.json'
import pkg from '../package.json'

describe('版本号', () => {
  it('代码、package.json、manifest.json 三处保持一致', () => {
    expect(APP_VERSION).toBe(pkg.version)
    expect(APP_VERSION).toBe(manifest.versionName)
  })
})
