/**
 * 生成带前缀的唯一 ID。
 * 单机离线场景，时间戳 + 随机串足够避免碰撞。
 */
export function makeId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
