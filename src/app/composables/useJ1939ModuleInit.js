import { nextTick, onMounted } from 'vue';
import { initializeJ1939Module } from '@/app/main.js';

export function useJ1939ModuleInit() {
  onMounted(() => {
    nextTick(() => {
      initializeJ1939Module();
    });
  });
}
