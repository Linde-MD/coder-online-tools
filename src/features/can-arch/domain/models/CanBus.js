import { BUS_COLOR_POOL, DEFAULT_BUS_BAUD } from '../can-arch-constants.js';

let _busColorCursor = 0;
const nextBusColor = () => BUS_COLOR_POOL[_busColorCursor++ % BUS_COLOR_POOL.length];

export class CanBus {
  constructor(data = {}) {
    this.id = data.id ?? crypto.randomUUID();
    this.name = data.name ?? `CAN_${Date.now().toString().slice(-3)}`;
    this.note = data.note ?? '';
    this.baud = Number.isInteger(data.baud) ? data.baud : DEFAULT_BUS_BAUD;
    this.color = data.color ?? nextBusColor();
    this.position = {
      x: Number.isFinite(data.position?.x) ? data.position.x : 0,
      y: Number.isFinite(data.position?.y) ? data.position.y : 0,
    };
  }

  clone(overrides = {}) {
    return new CanBus({
      ...this.toJSON(),
      id: crypto.randomUUID(),
      name: overrides.name ?? this.name,
      position: { ...this.position, ...(overrides.position ?? {}) },
      ...overrides,
    });
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      note: this.note,
      baud: this.baud,
      color: this.color,
      position: { ...this.position },
    };
  }
}