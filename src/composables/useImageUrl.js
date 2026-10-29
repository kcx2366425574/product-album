import { ref, watch } from 'vue'
import { resolveImageUrl } from '@/services/imageStore'

/**
 * 把图片元数据解析成可直接给 <image src> 的地址。
 * H5 端需要异步从 IndexedDB 取 Blob 再 createObjectURL。
 */
export function useImageUrl(metaSource) {
  const url = ref('')
  watch(
    metaSource,
    async meta => {
      url.value = meta ? await resolveImageUrl(meta) : ''
    },
    { immediate: true, deep: true }
  )
  return url
}
