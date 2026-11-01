import { describe, expect, it } from 'vitest'
import {
  UPDATE_CHECK_INTERVAL,
  compareVersion,
  feedUrlOf,
  isNewerVersion,
  parseUpdateManifest,
  resolveUrl,
  shouldAutoCheck,
  versionText
} from '@/services/update'
import { DEFAULT_UPDATE_FEED_URL } from '@/utils/appInfo'

const FEED = 'https://raw.githubusercontent.com/kcx2366425574/product-album/master/releases/latest.json'

describe('compareVersion', () => {
  it('逐段比较数字版本', () => {
    expect(compareVersion('1.2.0', '1.2.0')).toBe(0)
    expect(compareVersion('1.2', '1.2.0')).toBe(0)
    expect(compareVersion('1.2.10', '1.2.9')).toBe(1)
    expect(compareVersion('2.0', '1.9.9')).toBe(1)
    expect(compareVersion('1.2', '1.2.1')).toBe(-1)
  })

  it('非法段按 0 处理', () => {
    expect(compareVersion('', '0.0.0')).toBe(0)
    expect(compareVersion('1.x.0', '1.0.0')).toBe(0)
  })
})

describe('isNewerVersion', () => {
  it('版本号更高时提示更新', () => {
    expect(isNewerVersion({ versionName: '1.3.0', versionCode: 130 }, '1.2.0', 120)).toBe(true)
    expect(isNewerVersion({ versionName: '1.1.9', versionCode: 119 }, '1.2.0', 120)).toBe(false)
  })

  it('版本名相同时用 versionCode 判断', () => {
    expect(isNewerVersion({ versionName: '1.2.0', versionCode: 121 }, '1.2.0', 120)).toBe(true)
    expect(isNewerVersion({ versionName: '1.2.0', versionCode: 120 }, '1.2.0', 120)).toBe(false)
    expect(isNewerVersion({ versionName: '1.2.0', versionCode: 110 }, '1.2.0', 120)).toBe(false)
  })

  it('没有更新信息时返回 false', () => {
    expect(isNewerVersion(null, '1.2.0', 120)).toBe(false)
  })
})

describe('resolveUrl', () => {
  it('相对路径按 latest.json 所在目录解析', () => {
    expect(resolveUrl(FEED, 'product-album-1.3.0.apk')).toBe(
      'https://raw.githubusercontent.com/kcx2366425574/product-album/master/releases/product-album-1.3.0.apk'
    )
    expect(resolveUrl(FEED, './product-album.apk')).toBe(
      'https://raw.githubusercontent.com/kcx2366425574/product-album/master/releases/product-album.apk'
    )
  })

  it('绝对地址直接使用', () => {
    expect(resolveUrl(FEED, 'https://cdn.example.com/app.apk')).toBe('https://cdn.example.com/app.apk')
  })

  it('忽略更新地址里的查询参数和锚点', () => {
    expect(resolveUrl(`${FEED}?t=1#x`, 'app.apk')).toBe(
      'https://raw.githubusercontent.com/kcx2366425574/product-album/master/releases/app.apk'
    )
  })

  it('空路径返回空字符串', () => {
    expect(resolveUrl(FEED, '')).toBe('')
  })
})

describe('parseUpdateManifest', () => {
  it('解析并补全字段', () => {
    const manifest = parseUpdateManifest(
      {
        versionName: '1.3.0',
        versionCode: '130',
        apk: 'product-album-1.3.0.apk',
        notes: ['修复问题', '', '优化体验'],
        size: '123456',
        sha256: 'abc',
        publishedAt: '1760000000000'
      },
      FEED
    )

    expect(manifest).toMatchObject({
      versionName: '1.3.0',
      versionCode: 130,
      apkUrl:
        'https://raw.githubusercontent.com/kcx2366425574/product-album/master/releases/product-album-1.3.0.apk',
      notes: '修复问题\n优化体验',
      size: 123456,
      sha256: 'abc',
      publishedAt: 1760000000000
    })
  })

  it('缺少版本号或 APK 时抛出可读错误', () => {
    expect(() => parseUpdateManifest({ apk: 'a.apk' }, FEED)).toThrow('缺少版本号')
    expect(() => parseUpdateManifest({ versionName: '1.3.0' }, FEED)).toThrow('缺少 APK 地址')
    expect(() => parseUpdateManifest(null, FEED)).toThrow('格式不正确')
  })

  it('拒绝非 http(s) 的 APK 地址', () => {
    expect(() =>
      parseUpdateManifest({ versionName: '1.3.0', apk: 'ftp://x/a.apk' }, FEED)
    ).toThrow('必须是 http(s)')
  })
})

describe('shouldAutoCheck', () => {
  const now = 1760000000000

  it('从未检查过时检查', () => {
    expect(shouldAutoCheck(0, now)).toBe(true)
  })

  it('间隔内不重复检查', () => {
    expect(shouldAutoCheck(now - 60 * 1000, now)).toBe(false)
    expect(shouldAutoCheck(now - UPDATE_CHECK_INTERVAL + 1, now)).toBe(false)
  })

  it('到达间隔后再次检查', () => {
    expect(shouldAutoCheck(now - UPDATE_CHECK_INTERVAL, now)).toBe(true)
  })

  it('系统时间回拨时仍然检查', () => {
    expect(shouldAutoCheck(now + 60 * 1000, now)).toBe(true)
  })
})

describe('feedUrlOf', () => {
  it('优先使用设置里的自定义地址', () => {
    expect(feedUrlOf({ updateFeedUrl: 'https://mirror.example.com/latest.json' })).toBe(
      'https://mirror.example.com/latest.json'
    )
    expect(feedUrlOf({ updateFeedUrl: '  ' })).toBe(DEFAULT_UPDATE_FEED_URL)
    expect(feedUrlOf(null)).toBe(DEFAULT_UPDATE_FEED_URL)
  })
})

describe('versionText', () => {
  it('带版本号时一并展示', () => {
    expect(versionText('1.2.0', 120)).toBe('1.2.0 (120)')
    expect(versionText('1.2.0', 0)).toBe('1.2.0')
  })
})
