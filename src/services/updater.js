/**
 * 应用内更新：网络检查、APK 下载与系统安装。
 *
 * 更新源是仓库里的 releases/latest.json（格式见 releases/README.md）。
 * 只有 App 端支持；H5 端会返回 unsupported。
 */
import { APP_VERSION, APP_VERSION_CODE } from '@/utils/appInfo'
import { isNewerVersion, parseUpdateManifest } from './update'

const DOWNLOAD_TIMEOUT = 5 * 60 * 1000

/** 当前安装包的版本名；App 端优先取运行时版本 */
export function getCurrentVersion() {
  // #ifdef APP-PLUS
  try {
    if (typeof plus !== 'undefined' && plus.runtime && plus.runtime.version) {
      return plus.runtime.version
    }
  } catch (e) {
    // 忽略，回退到构建时常量
  }
  // #endif
  return APP_VERSION
}

function makeError(message, code) {
  const error = new Error(message)
  error.code = code
  return error
}

/**
 * 检查是否有新版本。
 * @param {{feedUrl?: string, timeout?: number}} options
 * @returns {Promise<{status:'update'|'latest'|'unsupported'|'error', manifest?:object, currentVersion?:string, error?:string}>}
 */
export function checkForUpdate({ feedUrl = '', timeout = 12000 } = {}) {
  // #ifdef APP-PLUS
  return new Promise(resolve => {
    if (!String(feedUrl || '').trim()) {
      resolve({ status: 'error', error: '没有配置更新地址' })
      return
    }

    // 绕过 CDN/浏览器缓存；锚点要留在最后，否则查询参数会变成锚点的一部分
    const base = String(feedUrl).split('#')[0]
    const separator = base.includes('?') ? '&' : '?'
    const url = `${base}${separator}t=${Date.now()}`

    uni.request({
      url,
      method: 'GET',
      timeout,
      header: { 'Cache-Control': 'no-cache' },
      success: res => {
        if (res.statusCode !== 200) {
          resolve({ status: 'error', error: `更新源返回 HTTP ${res.statusCode}` })
          return
        }

        try {
          // GitHub raw 等静态托管可能把 JSON 当成纯文本返回
          const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
          const manifest = parseUpdateManifest(data, feedUrl)
          const currentVersion = getCurrentVersion()
          const newer = isNewerVersion(manifest, currentVersion, APP_VERSION_CODE)
          resolve({
            status: newer ? 'update' : 'latest',
            manifest,
            currentVersion
          })
        } catch (e) {
          resolve({
            status: 'error',
            error: (e && e.message) || '更新信息解析失败'
          })
        }
      },
      fail: err => {
        resolve({
          status: 'error',
          error: (err && err.errMsg) || '网络请求失败，请检查更新地址'
        })
      }
    })
  })
  // #endif
  // #ifndef APP-PLUS
  return Promise.resolve({
    status: 'unsupported',
    error: '当前平台不支持应用内更新'
  })
  // #endif
}

function downloadFile(url, onProgress) {
  return new Promise((resolve, reject) => {
    const task = uni.downloadFile({
      url,
      timeout: DOWNLOAD_TIMEOUT,
      success: res => {
        if (res.statusCode && res.statusCode !== 200) {
          reject(makeError(`下载失败（HTTP ${res.statusCode}）`, 'download'))
          return
        }
        if (!res.tempFilePath) {
          reject(makeError('下载失败：没有拿到安装包文件', 'download'))
          return
        }
        resolve(res.tempFilePath)
      },
      fail: err => {
        reject(
          makeError(
            (err && err.errMsg) || '下载失败，请检查网络后重试',
            'download'
          )
        )
      }
    })

    if (task && task.onProgressUpdate && typeof onProgress === 'function') {
      task.onProgressUpdate(event => {
        const value = Number(event && event.progress)
        onProgress(Number.isFinite(value) ? value : 0)
      })
    }
  })
}

function installApk(filePath) {
  return new Promise((resolve, reject) => {
    // #ifdef APP-PLUS
    try {
      plus.runtime.install(
        filePath,
        { force: false },
        () => resolve(),
        err => {
          const detail = (err && (err.message || err.msg)) || ''
          reject(
            makeError(
              `安装失败${detail ? `：${detail}` : ''}`,
              'install'
            )
          )
        }
      )
    } catch (e) {
      reject(makeError(`安装失败：${(e && e.message) || e}`, 'install'))
    }
    // #endif
    // #ifndef APP-PLUS
    reject(makeError('当前平台不支持安装 APK', 'unsupported'))
    // #endif
  })
}

/**
 * 下载并调起系统安装界面。
 * @param {{apkUrl:string}} manifest
 * @param {{onProgress?:(percent:number)=>void}} options
 * @returns {Promise<string>} 下载后的临时文件路径
 */
export async function downloadAndInstall(manifest, { onProgress } = {}) {
  if (!manifest || !manifest.apkUrl) {
    throw makeError('更新信息不完整，无法下载', 'manifest')
  }

  const filePath = await downloadFile(manifest.apkUrl, onProgress)
  await installApk(filePath)
  return filePath
}

/**
 * 跳转系统的「安装未知应用」授权页。
 * Android 8+ 未授权时系统安装器会拒绝安装。
 */
export function openInstallPermissionSettings() {
  // #ifdef APP-PLUS
  try {
    const main = plus.android.runtimeMainActivity()
    const Intent = plus.android.importClass('android.content.Intent')
    const Settings = plus.android.importClass('android.provider.Settings')
    const Uri = plus.android.importClass('android.net.Uri')
    const pkg = main.getPackageName()

    let intent
    try {
      intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
      intent.setData(Uri.parse('package:' + pkg))
    } catch (e) {
      intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
      intent.setData(Uri.parse('package:' + pkg))
    }
    main.startActivity(intent)
    return true
  } catch (e) {
    console.warn('[updater] 打开安装权限设置失败', e)
  }
  // #endif
  return false
}
