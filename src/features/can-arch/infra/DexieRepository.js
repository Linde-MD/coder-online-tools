import { appDatabase, readStoredValue, removeStoredValue, writeStoredValue } from '@/shared/utils/app-storage.js';

export class DexieRepository {
  constructor(key, serializer = JSON, options = {}) {
    this.key = key;
    this.serializer = serializer;
    this.compatKeys = Array.isArray(options.compatKeys) ? options.compatKeys : [];
  }

  static async isAvailable() {
    try {
      await appDatabase.open();
      return true;
    } catch {
      return false;
    }
  }

  async save(data) {
    await writeStoredValue(this.key, data);
    return true;
  }

  async load() {
    return (await readStoredValue(this.key, {
      legacyKeys: this.compatKeys,
      parse: (raw) => this.serializer.parse(raw),
    })) ?? null;
  }

  async clear() {
    await removeStoredValue(this.key, this.compatKeys);
    return true;
  }
}