export function initResize(triggerRedraw) {
  const widthInput = document.getElementById('input-width');
  const heightInput = document.getElementById('input-height');
  let lastWidth = +widthInput.value;
  let lastHeight = +heightInput.value;

  function getWrappers() {
    return Array.from(document.querySelectorAll('.svg-resize-wrapper'));
  }

  function checkResize() {
    const wrappers = getWrappers();
    if (wrappers.length === 0) return;
    // 直接读取拖拽把手修改的 inline style 而不是通过 DOM Layout 计算，
    // 以彻底避开边框、内边距等导致的微小误差和渲染死循环。
    let changed = false;

    for (const wrapper of wrappers) {
      const styleW = parseInt(wrapper.style.width, 10);
      const styleH = parseInt(wrapper.style.height, 10);
      let wrapperChanged = false;

      if (!isNaN(styleW) && styleW !== lastWidth) {
        lastWidth = styleW;
        widthInput.value = styleW;
        changed = true;
        wrapperChanged = true;
      }
      if (!isNaN(styleH) && styleH !== lastHeight) {
        lastHeight = styleH;
        heightInput.value = styleH;
        changed = true;
        wrapperChanged = true;
      }

      // 分图模式下任一 wrapper 被拖拽后，立即以该尺寸为准触发一次重绘，
      // 避免后续未变化的 wrapper 把新尺寸覆盖回旧值。
      if (wrapperChanged) break;
    }

    if (changed) {
      triggerRedraw();
    }
  }
  setInterval(checkResize, 200);

  widthInput.addEventListener('change', function() {
    getWrappers().forEach(wrapper => {
      wrapper.style.width = widthInput.value + 'px';
    });
    lastWidth = +widthInput.value;
    triggerRedraw();
  });
  heightInput.addEventListener('change', function() {
    getWrappers().forEach(wrapper => {
      wrapper.style.height = heightInput.value + 'px';
    });
    lastHeight = +heightInput.value;
    triggerRedraw();
  });
}
