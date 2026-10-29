import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      // 必须放在 '@' 前面，否则会被 '@' 先匹配成 src/uni_modules/helper-alarm
      '@/uni_modules/helper-alarm': path.resolve('tests/stubs/helper-alarm.js'),
      '@': path.resolve('src')
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js']
  }
})
