/**
 * 通知权限引导的纯逻辑，方便单测。
 * 只在 App 端调用；H5 不具备后台通知能力，不主动打扰用户。
 */

/**
 * @param {{notifyEnabled?: boolean, permissionPrompted?: boolean}} settings
 * @param {'granted'|'denied'|'default'|'unsupported'|'unknown'} permissionState
 * @returns {boolean}
 */
export function shouldPromptPermission(settings, permissionState) {
  if (!settings || settings.notifyEnabled === false) return false
  if (settings.permissionPrompted) return false
  return permissionState !== 'granted' && permissionState !== 'unsupported'
}
