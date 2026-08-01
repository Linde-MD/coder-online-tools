export class PointerDragController {
  constructor({
    onStart = null,
    onMove = null,
    onEnd = null,
    useDocumentFallback = true,
    button = 0,
  } = {}) {
    this._onStart = onStart;
    this._onMove = onMove;
    this._onEnd = onEnd;
    this._useDocumentFallback = useDocumentFallback;
    this._requiredButton = button;
    this._state = null;
    this._boundWindowMove = null;
    this._boundWindowUp = null;
    this._boundDocMove = null;
    this._boundDocUp = null;
    this._boundCancel = null;
    this._boundLostCapture = null;
  }

  get isDragging() {
    return this._state !== null;
  }

  _capture(event) {
    const target = event.currentTarget;
    try {
      target?.setPointerCapture?.(event.pointerId);
    } catch {
      // ignore capture errors
    }
  }

  _release() {
    const state = this._state;
    if (!state) return;
    try {
      state.target?.releasePointerCapture?.(state.pointerId);
    } catch {
      // ignore
    }
  }

  _attachGlobal() {
    this._boundWindowMove = (e) => this._handleMove(e);
    this._boundWindowUp = (e) => this._handleEnd(e);
    this._boundCancel = (e) => this._handleEnd(e, true);
    this._boundLostCapture = (e) => {
      if (this._state && e.pointerId !== this._state.pointerId) return;
      this._handleEnd(e, false);
    };
    window.addEventListener('pointermove', this._boundWindowMove);
    window.addEventListener('pointerup', this._boundWindowUp);
    window.addEventListener('pointercancel', this._boundCancel);
    if (this._useDocumentFallback) {
      this._boundDocMove = (e) => this._handleMove(e);
      this._boundDocUp = (e) => this._handleEnd(e);
      document.addEventListener('pointermove', this._boundDocMove);
      document.addEventListener('pointerup', this._boundDocUp);
    }
  }

  _detachGlobal() {
    if (this._boundWindowMove) {
      window.removeEventListener('pointermove', this._boundWindowMove);
      this._boundWindowMove = null;
    }
    if (this._boundWindowUp) {
      window.removeEventListener('pointerup', this._boundWindowUp);
      this._boundWindowUp = null;
    }
    if (this._boundCancel) {
      window.removeEventListener('pointercancel', this._boundCancel);
      this._boundCancel = null;
    }
    if (this._boundDocMove) {
      document.removeEventListener('pointermove', this._boundDocMove);
      this._boundDocMove = null;
    }
    if (this._boundDocUp) {
      document.removeEventListener('pointerup', this._boundDocUp);
      this._boundDocUp = null;
    }
    if (this._boundLostCapture) {
      this._boundLostCapture = null;
    }
  }

  start(event, startPayload = {}) {
    if (this._state) return false;
    if (event.button !== undefined && event.button !== this._requiredButton) return false;
    const startCtx = this._onStart ? this._onStart(event, startPayload) : null;
    if (startCtx === false) return false;
    this._state = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      target: event.currentTarget,
      ctx: startCtx,
      moved: false,
    };
    this._capture(event);
    this._attachGlobal();
    if (this._state?.target && typeof this._state.target.addEventListener === 'function') {
      this._state.target.addEventListener('lostpointercapture', this._boundLostCapture, { once: true });
    }
    return true;
  }

  _handleMove(event) {
    const state = this._state;
    if (!state) return;
    if (state.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!state.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
      state.moved = true;
    }
    this._onMove?.(event, { dx, dy, state });
  }

  _handleEnd(event, cancelled = false) {
    const state = this._state;
    if (!state) return;
    if (event && state.pointerId !== event.pointerId) return;
    const dx = event ? event.clientX - state.startX : 0;
    const dy = event ? event.clientY - state.startY : 0;
    this._release();
    this._detachGlobal();
    this._state = null;
    this._onEnd?.(event, { dx, dy, cancelled, moved: state.moved, ctx: state.ctx });
  }

  cancel() {
    if (!this._state) return;
    this._handleEnd(null, true);
  }

  dispose() {
    this.cancel();
  }
}