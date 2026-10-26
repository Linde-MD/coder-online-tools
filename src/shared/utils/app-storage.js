import Dexie from 'dexie';

export const appDatabase = new Dexie('coderOnlineTools');
appDatabase.version(1).stores({ settings: '&key' });
appDatabase.version(2).stores({
  settings: '&key',
  directoryHandles: '&key',
});

export async function readStoredValue(key, { legacyKeys = [], parse = JSON.parse } = {}) {
  const record = await appDatabase.table('settings').get(key);
  if (record) return record.value;

  for (const legacyKey of [key, ...legacyKeys]) {
    let raw;
    try {
      raw = globalThis.localStorage?.getItem(legacyKey);
    } catch (error) {
      console.warn('Unable to read legacy storage', legacyKey, error);
      continue;
    }
    if (raw == null) continue;

    let value;
    try {
      value = parse(raw);
    } catch (error) {
      console.warn('Unable to parse legacy storage', legacyKey, error);
      continue;
    }
    await appDatabase.table('settings').add({ key, value }).catch(async (error) => {
      if (error.name !== 'ConstraintError') throw error;
    });
    try {
      for (const oldKey of [key, ...legacyKeys]) globalThis.localStorage?.removeItem(oldKey);
    } catch (error) {
      console.warn('Unable to remove migrated storage', key, error);
    }
    return (await appDatabase.table('settings').get(key)).value;
  }
  return undefined;
}

export async function writeStoredValue(key, value) {
  await appDatabase.table('settings').put({ key, value: JSON.parse(JSON.stringify(value)) });
}

export async function removeStoredValue(key, legacyKeys = []) {
  await appDatabase.table('settings').delete(key);
  for (const oldKey of [key, ...legacyKeys]) globalThis.localStorage?.removeItem(oldKey);
}