/**
 * 主题判定的纯函数。
 * theme: 'auto' | 'light' | 'dark'
 */
export function resolveDark(theme, systemDark) {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return !!systemDark
}
