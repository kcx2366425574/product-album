/**
 * 更新的界面流程：发现新版本弹窗、下载进度、安装失败引导。
 * 与 updater.js 分离，便于启动检查与设置页复用。
 */
import { downloadAndInstall, openInstallPermissionSettings } from './updater'
import { formatBytes } from './storage'

let updating = false

/** 发现新版本后的确认弹窗 */
export function showUpdateDialog(manifest) {
  if (!manifest) return

  const notes = manifest.notes || '修复问题并优化体验。'
  const size = manifest.size > 0 ? `\n安装包大小：${formatBytes(manifest.size)}` : ''

  uni.showModal({
    title: `发现新版本 ${manifest.versionName}`,
    content: `${notes}${size}\n\n下载完成后会打开系统安装界面。`,
    confirmText: '下载更新',
    cancelText: '稍后',
    success: res => {
      if (res.confirm) downloadWithProgress(manifest)
    }
  })
}

/** 下载并安装，带进度提示；同一时间只允许一个更新任务 */
export async function downloadWithProgress(manifest) {
  if (updating) {
    uni.showToast({ title: '正在更新中，请稍候', icon: 'none' })
    return false
  }

  updating = true
  let shown = -1
  uni.showLoading({ title: '下载中 0%', mask: true })

  try {
    await downloadAndInstall(manifest, {
      onProgress: percent => {
        const value = Math.max(0, Math.min(100, Math.round(percent)))
        if (value === shown) return
        shown = value
        uni.showLoading({ title: `下载中 ${value}%`, mask: true })
      }
    })
    uni.hideLoading()
    uni.showToast({
      title: '已开始安装，请按系统提示完成',
      icon: 'none',
      duration: 3000
    })
    return true
  } catch (e) {
    uni.hideLoading()
    showError(e)
    return false
  } finally {
    updating = false
  }
}

function showError(error) {
  const message = (error && error.message) || '更新失败，请稍后重试'

  if (error && error.code === 'install') {
    uni.showModal({
      title: '安装失败',
      content: `${message}\n\n请允许本应用安装未知应用后再试；如果仍然失败，请确认新包与当前 App 使用同一签名。`,
      confirmText: '去设置',
      cancelText: '知道了',
      success: res => {
        if (res.confirm) openInstallPermissionSettings()
      }
    })
    return
  }

  uni.showModal({
    title: '更新失败',
    content: message,
    showCancel: false,
    confirmText: '知道了'
  })
}
