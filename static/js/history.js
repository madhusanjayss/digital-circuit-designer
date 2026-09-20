/* ==========================================================================
   Snapshot Transaction History for Undo / Redo
   ========================================================================== */

export class HistoryManager {
  constructor(circuit, maxHistory = 50) {
    this.circuit = circuit;
    this.maxHistory = maxHistory;
    this.undoStack = [];
    this.redoStack = [];
    this.activeTransaction = null;
  }

  snapshot() {
    return JSON.stringify(this.circuit.toJSON());
  }

  restore(snapshot) {
    return this.circuit.fromJSON(JSON.parse(snapshot));
  }

  pushUndoSnapshot(snapshot) {
    if (!snapshot) return;
    if (this.undoStack[this.undoStack.length - 1] === snapshot) return;
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
    this.redoStack = [];
  }

  record() {
    this.pushUndoSnapshot(this.snapshot());
  }

  pushState() {
    this.record();
  }

  beginTransaction(label = '') {
    if (this.activeTransaction) return false;
    this.activeTransaction = {
      label,
      before: this.snapshot()
    };
    return true;
  }

  commitTransaction() {
    if (!this.activeTransaction) return false;
    const { before } = this.activeTransaction;
    const after = this.snapshot();
    this.activeTransaction = null;
    if (before === after) return false;
    this.pushUndoSnapshot(before);
    return true;
  }

  cancelTransaction() {
    if (!this.activeTransaction) return false;
    const { before } = this.activeTransaction;
    this.activeTransaction = null;
    this.restore(before);
    return true;
  }

  undo() {
    if (!this.canUndo()) return false;
    if (this.activeTransaction) this.cancelTransaction();

    const currentSnapshot = this.snapshot();
    const prevSnapshot = this.undoStack.pop();
    if (!this.restore(prevSnapshot)) return false;

    this.redoStack.push(currentSnapshot);
    return true;
  }

  redo() {
    if (!this.canRedo()) return false;
    if (this.activeTransaction) this.cancelTransaction();

    const currentSnapshot = this.snapshot();
    const nextSnapshot = this.redoStack.pop();
    if (!this.restore(nextSnapshot)) return false;

    this.undoStack.push(currentSnapshot);
    return true;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.activeTransaction = null;
  }
}
