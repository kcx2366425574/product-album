/** 应用版本号，需与 package.json、manifest.json 保持一致 */
export const APP_VERSION = '1.2.0'
/** Android versionCode，需与 manifest.json 的 versionCode 保持一致 */
export const APP_VERSION_CODE = 120

/**
 * 默认更新源：仓库里的 releases/latest.json。
 * 设置页可以改成镜像地址；发布新包时运行 scripts/release.mjs 更新该文件。
 */
export const DEFAULT_UPDATE_FEED_URL =
  'https://raw.githubusercontent.com/kcx2366425574/product-album/master/releases/latest.json'
