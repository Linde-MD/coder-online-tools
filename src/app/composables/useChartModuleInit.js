import { nextTick, onMounted, ref } from 'vue';
import { initializeChartModule } from '@/app/main.js';

export function useChartModuleInit() {
  const initializationError = ref('');
  onMounted(async () => {
    await nextTick();
    try {
      await initializeChartModule();
    } catch (error) {
      initializationError.value = `曲线配置读取失败，请刷新重试：${error?.message || '存储不可用'}`;
    }
  });
  return { initializationError };
}
