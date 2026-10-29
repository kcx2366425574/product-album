/** 单张图片允许写入本地的最大体积：8MB */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024

/** 体积超限判断，非法值按未超限处理 */
export function isOversize(bytes, max = MAX_IMAGE_BYTES) {
  const value = Number(bytes)
  return Number.isFinite(value) && value > max
}
