/**
 * 主题状态：跟随系统 / 浅色 / 深色。
 * 页面根节点绑定 themeClass 切换到深色 CSS 变量。
 */
import { computed, ref, watchEffect } from 'vue'
import { state } from './app'
import { resolveDark } from '@/utils/theme'

const systemDark = ref(false)

function initSystemTheme() {
  // #ifdef H5
  if (typeof window !== 'undefined' && window.matchMedia) {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    systemDark.value = query.matches
    const handler = event => {
      systemDark.value = !!event.matches
    }
    if (query.addEventListener) query.addEventListener('change', handler)
    else if (query.addListener) query.addListener(handler)
  }
  // #endif

  // #ifdef APP-PLUS
  if (typeof uni !== 'undefined') {
    try {
      const info = uni.getSystemInfoSync()
      systemDark.value = info.theme === 'dark'
      uni.onThemeChange(res => {
        systemDark.value = res.theme === 'dark'
      })
    } catch (e) {
      console.warn('[theme] 读取系统主题失败', e)
    }
  }
  // #endif
}

initSystemTheme()

export const isDark = computed(() => resolveDark(state.settings.theme, systemDark.value))
export const themeClass = computed(() => (isDark.value ? 'theme-dark' : ''))

// H5 下同步浏览器底色，避免页面回弹时露出浅色背景
watchEffect(() => {
  // #ifdef H5
  if (typeof document !== 'undefined') {
    document.documentElement.style.backgroundColor = isDark.value ? '#121512' : ''
  }
  // #endif
})
