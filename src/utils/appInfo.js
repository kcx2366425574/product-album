/** 应用版本号，需与 package.json、manifest.json 保持一致 */
export const APP_VERSION = '1.3.1'
/** Android versionCode，需与 manifest.json 的 versionCode 保持一致 */
export const APP_VERSION_CODE = 131

/**
 * 默认更新源：jsDelivr 镜像的仓库 releases/latest.json。
 * 国内网络访问 GitHub raw 不稳定，jsDelivr 更可靠；
 * 也可以在设置页换成 raw 地址或其他镜像。
 */
export const DEFAULT_UPDATE_FEED_URL =
  'https://cdn.jsdelivr.net/gh/kcx2366425574/product-album@master/releases/latest.json'
