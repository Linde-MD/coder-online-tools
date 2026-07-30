import { nextTick, onMounted } from 'vue';
import { initializeChartModule } from '@/app/main.js';

export function useChartModuleInit() {
  onMounted(() => {
    nextTick(() => {
      initializeChartModule();
    });
  });
}
