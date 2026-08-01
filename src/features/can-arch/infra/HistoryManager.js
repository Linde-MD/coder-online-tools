export class HistoryManager {
  constructor(limit = 80) {
    this.limit = Math.max(1, Number.isInteger(limit) ? limit : 80);
    this.undoStack = [];
    this.redoStack = [];
    this._capturing = false;
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  get canRedo() {
    return this.redoStack.length > 0;
  }

  _truncate(stack) {
    while (stack.length > this.limit) {
      stack.shift();
    }
  }

  snapshot(serializer) {
    if (this._capturing) return;
    try {
      const data = typeof serializer === 'function' ? serializer() : serializer;
      this.undoStack.push(data);
      this._truncate(this.undoStack);
      this.redoStack.length = 0;
    } catch {
      // ignore serialization errors
    }
  }

  beginBatch() {
    this._capturing = true;
  }

  commitBatch(serializer) {
    this._capturing = false;
    this.snapshot(serializer);
  }

  undo(applySnapshot) {
    if (this.undoStack.length === 0) return false;
    const prev = this.undoStack.pop();
    try {
      const current = typeof applySnapshot === 'function' ? applySnapshot(prev, true) : null;
      if (current != null) {
        this.redoStack.push(current);
        this._truncate(this.redoStack);
      }
      return true;
    } catch {
      this.undoStack.push(prev);
      return false;
    }
  }

  redo(applySnapshot) {
    if (this.redoStack.length === 0) return false;
    const next = this.redoStack.pop();
    try {
      const current = typeof applySnapshot === 'function' ? applySnapshot(next, false) : null;
      if (current != null) {
        this.undoStack.push(current);
        this._truncate(this.undoStack);
      }
      return true;
    } catch {
      this.redoStack.push(next);
      return false;
    }
  }

  reset() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}