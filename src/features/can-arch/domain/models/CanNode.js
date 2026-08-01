import { DEFAULT_NODE_BASE_COLOR } from '../can-arch-constants.js';
import { canProtocols } from '../../services/can-arch-dbc.js';

function timestampIso() {
  return new Date().toISOString();
}

export class CanNode {
  constructor(data = {}) {
    this.id = data.id ?? crypto.randomUUID();
    this.name = data.name ?? `ECU_${Date.now().toString().slice(-4)}`;
    this.note = data.note ?? '';
    this.baseColor = data.baseColor ?? DEFAULT_NODE_BASE_COLOR;
    this.position = {
      x: Number.isFinite(data.position?.x) ? data.position.x : 0,
      y: Number.isFinite(data.position?.y) ? data.position.y : 0,
    };
    this.protocols = Array.isArray(data.protocols) ? [...data.protocols] : [];
    this.j1939Addresses = Array.isArray(data.j1939Addresses) ? [...data.j1939Addresses] : [];
    this.canopenNodeIds = Array.isArray(data.canopenNodeIds) ? [...data.canopenNodeIds] : [];
    this.genericFrameFormat = data.genericFrameFormat ?? 'standard';
    this.messageWorkspace =
      typeof data.messageWorkspace === 'object' && data.messageWorkspace !== null
        ? structuredClone(data.messageWorkspace)
        : {};
    this.createdAt = data.createdAt ?? timestampIso();
    this.updatedAt = data.updatedAt ?? timestampIso();
  }

  static fromValidatedDraft(draft) {
    return new CanNode({
      name: draft.name,
      note: draft.note ?? '',
      protocols: draft.protocols ?? [],
      j1939Addresses: draft.j1939Addresses ?? [],
      canopenNodeIds: draft.canopenNodeIds ?? [],
      genericFrameFormat: draft.genericFrameFormat ?? 'standard',
    });
  }

  hasJ1939() {
    return this.protocols.includes(canProtocols.J1939);
  }

  hasCanopen() {
    return this.protocols.includes(canProtocols.CANOPEN);
  }

  hasGenericStd() {
    return this.protocols.includes(canProtocols.GENERIC_STD);
  }

  hasGenericExt() {
    return this.protocols.includes(canProtocols.GENERIC_EXT);
  }

  touch() {
    this.updatedAt = timestampIso();
  }

  move(dx, dy) {
    this.position.x = Math.round(this.position.x + dx);
    this.position.y = Math.round(this.position.y + dy);
    this.touch();
  }

  ensureMessageWorkspace() {
    if (typeof this.messageWorkspace !== 'object' || this.messageWorkspace === null) {
      this.messageWorkspace = {};
    }
    return this.messageWorkspace;
  }

  getBusStore(busId) {
    const workspace = this.ensureMessageWorkspace();
    if (!workspace[busId]) {
      workspace[busId] = { rxMessages: [], txMessages: [] };
    }
    return workspace[busId];
  }

  clone(overrides = {}) {
    return new CanNode({
      ...this.toJSON(),
      id: crypto.randomUUID(),
      name: overrides.name ?? `${this.name}_copy`,
      messageWorkspace: structuredClone(this.messageWorkspace),
      position: { ...this.position, ...(overrides.position ?? {}) },
      createdAt: timestampIso(),
      updatedAt: timestampIso(),
      ...overrides,
    });
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      note: this.note,
      baseColor: this.baseColor,
      position: { ...this.position },
      protocols: [...this.protocols],
      j1939Addresses: [...this.j1939Addresses],
      canopenNodeIds: [...this.canopenNodeIds],
      genericFrameFormat: this.genericFrameFormat,
      messageWorkspace: structuredClone(this.messageWorkspace),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}