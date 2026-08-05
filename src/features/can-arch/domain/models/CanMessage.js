import { CanSignal } from './CanSignal.js';

const PROTOCOL_COLORS = Object.freeze({
  j1939: '#2f9b54',
  canopen: '#3b77d7',
  generic_ext: '#7b638f',
  generic_std: '#8a6d4f',
});

export class CanMessage {
  constructor(data = {}, ecuId = null, peers = []) {
    this.id = data.id ?? crypto.randomUUID();
    this.name = data.name ?? `MSG_${Date.now().toString().slice(-4)}`;
    this.protocol = data.protocol ?? 'generic_std';
    this.color = data.color ?? PROTOCOL_COLORS[this.protocol] ?? PROTOCOL_COLORS.generic_std;
    this.idHex = data.idHex ?? '0x000';
    this.triggerMode = data.triggerMode ?? 'cyclic';
    this.txMode = data.txMode ?? 'periodic';
    if (this.txMode === 'event') {
      this.periodMs = Number.isInteger(data.periodMs) && data.periodMs >= 0 ? data.periodMs : null;
    } else {
      this.periodMs = Number.isInteger(data.periodMs) && data.periodMs >= 0 ? data.periodMs : 100;
    }
    this.byteOrder = data.byteOrder ?? 'intel';
    this.dlcMode = data.dlcMode === 'variable' ? 'variable' : 'fixed';
    this.dlc = Number.isInteger(data.dlc) ? Math.max(0, Math.min(64, data.dlc)) : 8;
    this.layoutMode = data.layoutMode ?? 'compact';
    this.comment = data.comment ?? '';
    this.senders = Array.isArray(data.senders) ? [...data.senders] : (ecuId ? [ecuId] : []);
    this.receivers = Array.isArray(data.receivers) ? [...data.receivers] : [...peers];
    this.signals = (Array.isArray(data.signals) ? data.signals : []).map((s) =>
      s instanceof CanSignal ? s : new CanSignal(s)
    );
    this.j1939 = data.j1939 ?? {
      enabled: this.protocol === 'j1939',
      mode: 'id',
      id: '',
      pgn: '',
      priority: 6,
      sa: '',
      da: '',
    };
  }

  static colorForProtocol(protocol) {
    return PROTOCOL_COLORS[protocol] ?? PROTOCOL_COLORS.generic_std;
  }

  static createDefault(pane = 'tx', ecuId = null, peers = [], protocol = 'generic_std') {
    const peerIds = peers.length > 0 ? peers : [];
    return new CanMessage({
      protocol,
      senders: pane === 'tx' ? (ecuId ? [ecuId] : []) : peerIds,
      receivers: pane === 'tx' ? peerIds : (ecuId ? [ecuId] : []),
      signals: [],
    }, ecuId, peers);
  }

  syncProtocolColor() {
    this.color = CanMessage.colorForProtocol(this.protocol);
    if (this.protocol !== 'j1939') {
      this.j1939.enabled = false;
    }
  }

  addSignal(data = {}) {
    const signal = new CanSignal({
      ...data,
      name: data.name ?? `SIG_${this.signals.length + 1}`,
    });
    this.signals.push(signal);
    return signal;
  }

  removeSignal(signalId) {
    const idx = this.signals.findIndex((s) => s.id === signalId);
    if (idx >= 0) {
      this.signals.splice(idx, 1);
      return true;
    }
    return false;
  }

  findSignal(signalId) {
    return this.signals.find((s) => s.id === signalId) ?? null;
  }

  clone(overrides = {}) {
    const cloned = new CanMessage({
      ...this.toJSON(),
      id: crypto.randomUUID(),
      name: overrides.name ?? `${this.name}_copy`,
      signals: this.signals.map((s) => s.clone()),
      ...overrides,
    });
    return cloned;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      protocol: this.protocol,
      color: this.color,
      idHex: this.idHex,
      triggerMode: this.triggerMode,
      txMode: this.txMode,
      periodMs: this.txMode === 'event' ? null : this.periodMs,
      byteOrder: this.byteOrder,
      dlcMode: this.dlcMode,
      dlc: this.dlc,
      layoutMode: this.layoutMode,
      comment: this.comment,
      senders: [...this.senders],
      receivers: [...this.receivers],
      signals: this.signals.map((s) => s.toJSON()),
      j1939: { ...this.j1939 },
    };
  }
}