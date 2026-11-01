import { describe, expect, it } from 'vitest'
import {
  buildBackup,
  createBackup,
  isBackupDue,
  parseBackup,
  prepareImport,
  sanitizeSettings
} from '@/services/backup'

const validBackup = {
  app: 'product-album',
  schemaVersion: 1,
  products: []
}

describe('isBackupDue', () => {
  const now = Date.UTC(2026, 9, 29)
  const day = 24 * 60 * 60 * 1000

  it('没有商品时不提醒', () => {
    expect(isBackupDue([], 0, now)).toBe(false)
  })

  it('从未备份时提醒', () => {
    expect(isBackupDue([{ id: 'p1' }], 0, now)).toBe(true)
  })

  it('超过 30 天未备份时提醒', () => {
    expect(isBackupDue([{ id: 'p1' }], now - 31 * day, now)).toBe(true)
  })

  it('30 天内备份过不提醒', () => {
    expect(isBackupDue([{ id: 'p1' }], now - 10 * day, now)).toBe(false)
  })
})

describe('sanitizeSettings', () => {
  it('只保留允许备份的设置项', () => {
    expect(
      sanitizeSettings({
        defaultReminderDays: 7,
        notifyTime: '09:00',
        notifyEnabled: true,
        overdueRepeatDays: 3,
        theme: 'auto',
        permissionPrompted: true,
        lastBackupAt: 123
      })
    ).toEqual({
      defaultReminderDays: 7,
      notifyTime: '09:00',
      notifyEnabled: true,
      overdueRepeatDays: 3,
      theme: 'auto'
    })
  })
})

describe('buildBackup', () => {
  it('携带图片数据并去掉本机路径字段', () => {
    const backup = buildBackup(
      [
        {
          id: 'p1',
          name: '商品',
          images: [{ id: 'img1', w: 10, h: 20, size: 30, path: '_doc/x.jpg', thumbPath: '_doc/y.jpg' }]
        }
      ],
      { defaultReminderDays: 7, permissionPrompted: true },
      { img1: 'data:image/jpeg;base64,abc' }
    )

    expect(backup.app).toBe('product-album')
    expect(backup.products[0].images[0]).toEqual({
      id: 'img1',
      w: 10,
      h: 20,
      size: 30,
      data: 'data:image/jpeg;base64,abc'
    })
    expect(backup.settings.permissionPrompted).toBeUndefined()
  })
})

describe('createBackup', () => {
  it('单张图片读取失败时写入空 data，不影响其他图片', async () => {
    const backup = await createBackup(
      [{ id: 'p1', images: [{ id: 'img1' }, { id: 'img2' }] }],
      {},
      async image => {
        if (image.id === 'img2') throw new Error('读取失败')
        return `data:${image.id}`
      }
    )

    expect(backup.products[0].images[0].data).toBe('data:img1')
    expect(backup.products[0].images[1].data).toBe('')
  })
})

describe('parseBackup', () => {
  it('接受有效备份', () => {
    expect(parseBackup(JSON.stringify(validBackup)).products).toEqual([])
  })

  it('拒绝非法 JSON', () => {
    expect(() => parseBackup('{')).toThrow('备份文件不是有效的 JSON')
  })

  it('拒绝其他 App 的文件', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'other', products: [] }))).toThrow(
      '不是商品图册的备份文件'
    )
  })

  it('拒绝版本过新的文件', () => {
    expect(() =>
      parseBackup(JSON.stringify({ ...validBackup, schemaVersion: 99 }))
    ).toThrow('备份文件版本过新')
  })

  it('拒绝缺少商品列表的文件', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'product-album' }))).toThrow(
      '备份文件缺少商品列表'
    )
  })

  it('拒绝闹钟列表格式不正确的文件', () => {
    expect(() =>
      parseBackup(JSON.stringify({ ...validBackup, alarms: 'oops' }))
    ).toThrow('备份文件闹钟列表格式不正确')
  })

  it('兼容没有闹钟字段的旧备份', () => {
    expect(parseBackup(JSON.stringify(validBackup)).alarms).toBeUndefined()
  })
})

describe('闹钟备份', () => {
  const alarm = {
    id: 'a1',
    title: ' 晨跑 ',
    time: '07:00',
    enabled: true,
    rule: { type: 'monthly', monthlyMode: 'weekday', nth: -1, weekday: 6 }
  }

  it('buildBackup 携带规范化后的闹钟', () => {
    const backup = buildBackup([], {}, {}, [alarm])
    expect(backup.schemaVersion).toBe(2)
    expect(backup.alarms).toHaveLength(1)
    expect(backup.alarms[0].title).toBe('晨跑')
    expect(backup.alarms[0].rule).toMatchObject({ nth: -1, weekday: 6 })
  })

  it('createBackup 把闹钟一起打包', async () => {
    const backup = await createBackup([], {}, async () => '', [alarm])
    expect(backup.alarms[0].id).toBe('a1')
  })

  it('prepareImport 恢复闹钟，缺失 id 时自动生成', async () => {
    const result = await prepareImport(
      {
        products: [],
        settings: {},
        alarms: [alarm, { title: '喝水', time: '10:00', rule: { type: 'daily' } }, null]
      },
      { createImage: async () => null }
    )

    expect(result.alarms).toHaveLength(2)
    expect(result.alarms[0].id).toBe('a1')
    expect(result.alarms[1].id).toMatch(/^a_/)
    expect(result.alarms[1].title).toBe('喝水')
  })

  it('重复闹钟 id 以最后一条为准', async () => {
    const result = await prepareImport({
      products: [],
      settings: {},
      alarms: [
        { ...alarm, title: '第一条' },
        { ...alarm, title: '最后一条' }
      ]
    })

    expect(result.alarms).toHaveLength(1)
    expect(result.alarms[0].title).toBe('最后一条')
  })

  it('旧备份没有闹钟字段时返回空数组', async () => {
    const result = await prepareImport({ products: [], settings: {} })
    expect(result.alarms).toEqual([])
  })
})

describe('prepareImport', () => {
  it('恢复图片、跳过无数据图片并规范化商品', async () => {
    const backup = {
      app: 'product-album',
      schemaVersion: 1,
      settings: {
        defaultReminderDays: 3,
        notifyTime: '10:00',
        notifyEnabled: true,
        theme: 'auto',
        permissionPrompted: true
      },
      products: [
        {
          id: 'p1',
          name: '商品 A',
          purchaseDate: '2026-10-01',
          durationValue: 30,
          durationUnit: 'day',
          expiryDate: '2026-10-31',
          images: [
            { id: 'old1', data: 'd1' },
            { id: 'old2', data: '' }
          ]
        },
        {
          name: '商品 B',
          purchaseDate: '2026-10-02',
          durationValue: 1,
          durationUnit: 'month',
          expiryDate: '2026-11-02',
          images: []
        }
      ]
    }

    const result = await prepareImport(backup, {
      createImage: async data => ({ id: `new_${data}`, w: 1, h: 1, size: 1, path: '' })
    })

    expect(result.products).toHaveLength(2)
    expect(result.products[0].images).toHaveLength(1)
    expect(result.products[0].images[0].id).toBe('new_d1')
    expect(result.products[1].id).toMatch(/^p_/)
    expect(result.settings).toEqual({
      defaultReminderDays: 3,
      notifyTime: '10:00',
      notifyEnabled: true,
      theme: 'auto'
    })
    expect(result.stats).toEqual({ importedImages: 1, failedImages: 1, totalImages: 2 })
    expect(result.createdImages).toHaveLength(1)
  })

  it('重复商品 id 以最后一条为准', async () => {
    const base = {
      purchaseDate: '2026-10-01',
      durationValue: 30,
      durationUnit: 'day',
      expiryDate: '2026-10-31'
    }
    const result = await prepareImport(
      {
        products: [
          { ...base, id: 'p1', name: '第一条' },
          { ...base, id: 'p1', name: '最后一条' }
        ],
        settings: {}
      },
      { createImage: async () => null }
    )

    expect(result.products).toHaveLength(1)
    expect(result.products[0].name).toBe('最后一条')
  })

  it('图片创建异常时记为失败并继续导入', async () => {
    const result = await prepareImport(
      {
        products: [
          {
            id: 'p1',
            name: '商品',
            purchaseDate: '2026-10-01',
            durationValue: 30,
            durationUnit: 'day',
            expiryDate: '2026-10-31',
            images: [{ data: 'bad' }]
          }
        ],
        settings: {}
      },
      {
        createImage: async () => {
          throw new Error('写入失败')
        }
      }
    )

    expect(result.products).toHaveLength(1)
    expect(result.products[0].images).toHaveLength(0)
    expect(result.stats.failedImages).toBe(1)
  })
})
