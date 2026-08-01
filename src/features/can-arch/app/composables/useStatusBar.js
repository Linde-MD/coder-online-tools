import { ref } from 'vue';

export function useStatusBar() {
  const statusMessage = ref('准备就绪。');
  const statusError = ref('');

  function setStatus(message, isError = false) {
    if (isError) {
      statusError.value = message;
      return;
    }
    statusError.value = '';
    statusMessage.value = message;
  }

  return {
    statusMessage,
    statusError,
    setStatus,
  };
}