import { ref, onBeforeUnmount, watch, nextTick } from 'vue';
import { readStoredValue, writeStoredValue } from '@/shared/utils/app-storage.js';

const MAGNETIC_HEADER_STORAGE_KEY = 'can-arch-magnetic-header';
const MAGNETIC_HOVE_ZONE = 24;

export function useMagneticHeader({
  isFullscreen,
  canvasRef,
  canvasHeight,
  onHeightSync,
}) {
  const magneticHeader = ref(false);
  let disposed = false;
  const isHeaderPeeking = ref(false);
  let _magneticMouseHandler = null;
  let _magneticCollapseTimer = null;

  function _clearMagneticCollapseTimer() {
    if (_magneticCollapseTimer) {
      window.clearTimeout(_magneticCollapseTimer);
      _magneticCollapseTimer = null;
    }
  }

  function _onMagneticMouseMove(event) {
    if (!magneticHeader.value) return;
    const y = event.clientY;
    const headerEl = document.querySelector('.can-arch-header');
    const headerRect = headerEl ? headerEl.getBoundingClientRect() : null;
    const overHeader = headerRect && y >= headerRect.top && y <= headerRect.bottom;

    let overOpenMenu = false;
    const activeMenu = document.querySelector('.can-top-menu-panel');
    if (activeMenu) {
      const r = activeMenu.getBoundingClientRect();
      if (y >= r.top && y <= r.bottom) overOpenMenu = true;
    }

    if (y < MAGNETIC_HOVE_ZONE || overHeader || overOpenMenu) {
      _clearMagneticCollapseTimer();
      isHeaderPeeking.value = true;
    } else if (isHeaderPeeking.value && !_magneticCollapseTimer) {
      _magneticCollapseTimer = window.setTimeout(() => {
        isHeaderPeeking.value = false;
        _magneticCollapseTimer = null;
      }, 320);
    }
  }

  function _recalcCanvasHeight() {
    onHeightSync?.();
  }

  function persistMagneticHeader(value) {
    writeStoredValue(MAGNETIC_HEADER_STORAGE_KEY, value).catch((error) => {
      console.warn('Unable to save magnetic header preference', error);
    });
  }

  function enableMagneticHeader(persist = true) {
    magneticHeader.value = true;
    if (persist) persistMagneticHeader(true);
    if (!_magneticMouseHandler) {
      _magneticMouseHandler = _onMagneticMouseMove;
      window.addEventListener('mousemove', _magneticMouseHandler);
    }
    if (isFullscreen.value) {
      nextTick(() => _recalcCanvasHeight());
    }
  }

  function disableMagneticHeader() {
    magneticHeader.value = false;
    isHeaderPeeking.value = false;
    persistMagneticHeader(false);
    _clearMagneticCollapseTimer();
    if (_magneticMouseHandler) {
      window.removeEventListener('mousemove', _magneticMouseHandler);
      _magneticMouseHandler = null;
    }
    if (isFullscreen.value) {
      nextTick(() => _recalcCanvasHeight());
    }
  }

  function toggleMagneticHeader() {
    if (magneticHeader.value) {
      disableMagneticHeader();
    } else {
      enableMagneticHeader();
    }
  }

  async function initMagneticHeader() {
    try {
      const enabled = await readStoredValue(MAGNETIC_HEADER_STORAGE_KEY, { parse: (raw) => raw === '1' });
      if (enabled && !disposed) enableMagneticHeader(false);
    } catch (error) {
      console.warn('Unable to load magnetic header preference', error);
    }
  }

  function teardownMagneticHeader() {
    _clearMagneticCollapseTimer();
    if (_magneticMouseHandler) {
      window.removeEventListener('mousemove', _magneticMouseHandler);
      _magneticMouseHandler = null;
    }
  }

  onBeforeUnmount(() => {
    disposed = true;
    teardownMagneticHeader();
  });

  watch(isFullscreen, () => {
    if (magneticHeader.value && isFullscreen.value) {
      nextTick(() => _recalcCanvasHeight());
    }
  });

  return {
    magneticHeader,
    isHeaderPeeking,
    enableMagneticHeader,
    disableMagneticHeader,
    toggleMagneticHeader,
    initMagneticHeader,
    teardownMagneticHeader,
  };
}