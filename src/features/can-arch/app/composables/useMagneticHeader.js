import { ref, onBeforeUnmount, watch, nextTick } from 'vue';

const MAGNETIC_HEADER_STORAGE_KEY = 'can-arch-magnetic-header';
const MAGNETIC_HOVE_ZONE = 24;

export function useMagneticHeader({
  isFullscreen,
  canvasRef,
  canvasHeight,
  onHeightSync,
}) {
  const magneticHeader = ref(localStorage.getItem(MAGNETIC_HEADER_STORAGE_KEY) === '1');
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

  function enableMagneticHeader() {
    magneticHeader.value = true;
    localStorage.setItem(MAGNETIC_HEADER_STORAGE_KEY, '1');
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
    localStorage.setItem(MAGNETIC_HEADER_STORAGE_KEY, '0');
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

  function initMagneticHeader() {
    if (magneticHeader.value) {
      enableMagneticHeader();
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