# 商品图册

离线优先的「商品图片 + 使用期限提醒」工具。用 uni-app（Vue 3 + Vite）开发，一套代码同时跑 H5 网页和 Android APK。

核心场景：把商品图片存进 App，给每个商品设置购买日期和使用时长，临近到期时通过系统通知提醒续费。

## 功能

**已实现**

- 商品增删改查：名称、分类、标签、备注、购买金额
- 图片管理：从相册/相机导入多张、压缩、480px 缩略图、设置封面、大图预览
- 到期计算：按天 / 月 / 年，自动处理月末和闰年（1/31 + 1 个月 = 2/28）
- 首页概览：总数 / 正常 / 即将到期 / 已过期，点数字直接筛选
- 搜索：按名称、分类、标签过滤
- 分类筛选与排序：分类 chip（含数量），按到期日 / 最近更新 / 名称排序
- 到期日历：月视图、上下月切换、按天查看到期商品
- 续费：到期日顺延、记录时长/金额/备注、续费历史
- 花费统计：单品累计花费、总/本月/今年支出、续费次数
- 到期提醒：提前 N 天 + 到期当天，支持全局默认值和单品覆盖，排程覆盖未来 365 天
- 通知可靠性：通知权限检查、原生送达回写去重、设备重启后恢复排程、精确闹钟授权状态
- 首次启动引导开启通知权限，首页提供常驻提示条
- 数据备份：JSON 导出/导入（商品、图片、续费记录、设置），记录上次备份时间
- 深色模式：跟随系统 / 浅色 / 深色
- 设置：默认提前天数、提醒时间、主题、图片占用、清空数据
- 双端图片持久化：H5 用 IndexedDB，App 用私有目录

**规划中**

- 多个提前提醒点 / 逾期后重复提醒
- 批量操作与回收站
- 通知内快捷操作（去续费 / 稍后提醒）
- 应用锁、桌面小组件

## 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | uni-app + Vue 3 `<script setup>` |
| 构建 | Vite 5 + `@dcloudio/vite-plugin-uni` |
| 状态 | 自写轻量 reactive store（未引入 Pinia） |
| H5 图片存储 | IndexedDB |
| App 图片存储 | `plus.zip.compressImage` + `_doc/` 私有目录 |
| App 定时通知 | UTS 插件 `helper-alarm`（AlarmManager + NotificationManager） |
| 测试 | Vitest（115 个用例）+ Edge/Playwright H5 流程检查 |

## 目录结构

```
product-album/
├── src/
│   ├── pages/
│   │   ├── index/index.vue        # 首页：概览 + 搜索 + 分类筛选 + 排序
│   │   ├── detail/detail.vue      # 商品详情 + 续费 + 花费
│   │   ├── edit/edit.vue          # 新建 / 编辑
│   │   ├── calendar/calendar.vue  # 到期日历
│   │   └── settings/settings.vue  # 设置 / 备份 / 花费 / 主题
│   ├── components/                # NavBar / ProductCard / EmptyState
│   ├── composables/useImageUrl.js # 图片元数据 → 可显示地址（支持缩略图）
│   ├── services/
│   │   ├── db.js                  # 本地存储 + 数据规范化 + 损坏备份
│   │   ├── expiry.js              # 到期计算（纯函数）
│   │   ├── imageStore.js          # 图片存储（H5 / App 分支）
│   │   ├── notify.js              # 通知抽象（H5 / App 分支）
│   │   ├── reminder.js            # 提醒扫描 + 去重 + 排程生成
│   │   ├── backup.js              # 备份导出 / 导入
│   │   ├── calendar.js            # 日历网格与到期分组
│   │   ├── filters.js             # 分类统计 + 排序
│   │   ├── stats.js               # 花费统计
│   │   └── storage.js             # 图片存储占用
│   ├── store/app.js               # 全局状态 + 派生数据
│   ├── store/theme.js             # 主题状态
│   ├── utils/                     # 日期、ID、主题、版本
│   └── uni_modules/helper-alarm/  # UTS 原生定时通知插件
├── tests/                         # Vitest 单元测试
├── scripts/                       # 基于 Edge 的 H5 自动化检查
└── docs/                          # 需求分析、截图
```

## 本地开发

```bash
npm install

npm run dev:h5       # http://localhost:5173
npm test             # 单元测试
npm run build:h5     # 产物在 dist/build/h5
```

H5 自动化检查（用本机 Edge，无需安装 Chromium）：

```bash
node scripts/check.mjs http://localhost:5173/ docs/screenshots/home.png 390 844
```

带交互的检查脚本放在 `scripts/actions/`，例如新增商品：

```bash
node scripts/check.mjs http://localhost:5173/ docs/screenshots/after-add.png 390 844 scripts/actions/add-product.mjs
```

## 打包 Android APK

项目已经通过 `cli.exe project open` 导入本机 HBuilderX。

1. 打开 HBuilderX，确认左侧项目列表里有 `product-album`
2. 登录 DCloud 账号（发行前必须）
3. 双击 `src/manifest.json`，在「基础配置」里点「重新获取」生成 AppID
4. 菜单 `发行 → 原生 App - 云打包`，平台选 Android
   - 证书：自用直接选「使用 DCloud 公共测试证书」
   - 打包类型：APK
5. 打包完成后下载 APK 安装到手机

> 云打包时 DCloud 会编译 `src/uni_modules/helper-alarm` 这个 UTS 插件。本地已用 `npx uni build -p app` 验证过 App 资源编译和 UTS→Kotlin 转换（产物 `dist/build/app/uni_modules/helper-alarm/utssdk/app-android/src/index.kt`）；本机没有 Android SDK，Kotlin 编译这一步以云打包日志为准。

## 原生通知插件说明

`src/uni_modules/helper-alarm` 是 UTS 插件，实现：

1. `AlarmManager.setExactAndAllowWhileIdle()` 在指定时间触发广播
2. 广播接收器 `AlarmReceiver` 写在 `AndroidManifest.xml` 里，App 进程被杀也能由系统实例化
3. 接收器调用 `NotificationManager.notify()` 弹通知，并把已送达的排程 id 写入 SharedPreferences
4. 点击通知通过 `PendingIntent` 拉起 App，并携带 `productId`
5. 排程同时持久化，`BootReceiver` 在 `BOOT_COMPLETED` / `MY_PACKAGE_REPLACED` 后恢复未到期闹钟

已声明的权限：

- `POST_NOTIFICATIONS`（Android 13+ 运行时权限）
- `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`（Android 12+ 精确闹钟）
- `RECEIVE_BOOT_COMPLETED`（设备重启后恢复排程）

限制：

- 未授予精确闹钟权限时自动降级为 `setAndAllowWhileIdle`，时间可能有几分钟偏差；设置页会显示授权状态
- 国产 ROM 的省电策略可能延迟或拦截闹钟，建议在系统设置里允许自启动
- 通知点击跳转到商品详情只保证冷启动场景；App 已在后台时的 `onNewIntent` 处理仍需真机验证

## 数据存储

| 数据 | H5 | App |
| --- | --- | --- |
| 商品、设置、提醒记录 | localStorage | plus storage |
| 图片文件 | IndexedDB | `_doc/pa_*.jpg` + `_doc/pa_*_thumb.jpg` |

数据只在本机，卸载 App 会一起清除。设置页支持导出 JSON 备份（含图片 base64），换机或重装后可以导入恢复。解析失败的存储内容会保留在 `<key>.corrupt`，便于排查。

## 已知限制

- H5 端只有页面打开时才能发通知，网页关闭后不会提醒
- 提醒排程在「启动 App / 修改商品 / 修改设置」时全量重排；如果只改系统时间不会触发重排
- App 端备份导出依赖 `plus.share.sendWithSystem`、导入依赖 `uni.chooseFile`，均已通过编译但需要在真机验证
- App 已在后台时点击通知的跳转依赖 DCloud 运行时的 `onNewIntent`，冷启动场景已验证性较高
- H5 的 `URL.createObjectURL` 缓存目前不主动释放；缩略图已显著降低单张内存占用
- 未做防篡改（自用工具，按需求确认不需要）

## 文档

- [需求分析与技术方案](docs/需求分析.md)
- 界面截图：`docs/screenshots/`
