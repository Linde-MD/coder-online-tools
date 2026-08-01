export class LocalStorageRepository {
  constructor(key, serializer = JSON, options = {}) {
    this.key = key;
    this.serializer = serializer;
    this.compatKeys = Array.isArray(options.compatKeys) ? options.compatKeys : [];
    this.suppressErrors = options.suppressErrors !== false;
  }

  static isAvailable() {
    try {
      const testKey = '__local_storage_probe__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  save(data) {
    try {
      const text = this.serializer.stringify(data);
      window.localStorage.setItem(this.key, text);
      return true;
    } catch (err) {
      if (!this.suppressErrors) throw err;
      return false;
    }
  }

  load() {
    const keys = [this.key, ...this.compatKeys];
    for (const k of keys) {
      try {
        const text = window.localStorage.getItem(k);
        if (text == null || text === '') continue;
        return this.serializer.parse(text);
      } catch {
        // continue to next compat key
      }
    }
    return null;
  }

  clear() {
    try {
      window.localStorage.removeItem(this.key);
      for (const k of this.compatKeys) {
        window.localStorage.removeItem(k);
      }
      return true;
    } catch (err) {
      if (!this.suppressErrors) throw err;
      return false;
    }
  }
}