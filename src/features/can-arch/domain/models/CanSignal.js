export class CanSignal {
  constructor(data = {}) {
    this.id = data.id ?? crypto.randomUUID();
    this.name = data.name ?? `SIG_${Date.now().toString().slice(-4)}`;
    this.startBit = Number.isInteger(data.startBit) ? data.startBit : 0;
    this.length = Number.isInteger(data.length) ? data.length : 8;
    this.factor = Number.isFinite(data.factor) ? data.factor : 1;
    this.offset = Number.isFinite(data.offset) ? data.offset : 0;
    this.min = Number.isFinite(data.min) ? data.min : null;
    this.max = Number.isFinite(data.max) ? data.max : null;
    this.signed = Boolean(data.signed);
    this.unit = data.unit ?? '';
    this.comment = data.comment ?? '';
  }

  clone(overrides = {}) {
    return new CanSignal({
      ...this.toJSON(),
      id: crypto.randomUUID(),
      name: overrides.name ?? `${this.name}_copy`,
      ...overrides,
    });
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      startBit: this.startBit,
      length: this.length,
      factor: this.factor,
      offset: this.offset,
      min: this.min,
      max: this.max,
      signed: this.signed,
      unit: this.unit,
      comment: this.comment,
    };
  }
}