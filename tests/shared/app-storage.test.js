import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appDatabase, readStoredValue, removeStoredValue, writeStoredValue } from '../../src/shared/utils/app-storage.js';
import { DexieRepository } from '@/features/can-arch/infra/DexieRepository.js';
import { STORAGE_KEY } from '@/features/can-arch/domain/can-arch-constants.js';
import { CHART_UI_STORAGE_KEY, readChartUiStateFromStorage, saveChartUiState } from '@/features/chart/services/chart-ui-storage.js';
import { KNOWLEDGE_CHAT_CONFIG_KEY, readKnowledgeChatConfig, saveKnowledgeChatConfig } from '@/features/knowledge-chat/services/knowledge-chat-storage.js';
import { SCRIPT_STORAGE_KEY, readWenyanScripts, saveWenyanScripts } from '@/features/wenyan/services/wenyan-storage.js';
import { loadFormulaSourceList, saveFormulaSourceList } from '@/shared/config/formula-storage.js';
import { J1939_UI_STORAGE_KEY, readJ1939UiState, saveJ1939UiState } from '@/features/j1939/services/j1939-ui-storage.js';

let legacy;

beforeEach(async () => {
  await appDatabase.table('settings').clear();
  legacy = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => legacy.get(key) ?? null,
    removeItem: (key) => legacy.delete(key),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Dexie application storage', () => {
  it('stores detached values and reads them back', async () => {
    const value = { scripts: ['hello'] };
    await writeStoredValue('scripts', value);
    value.scripts.push('changed');
    expect(await readStoredValue('scripts')).toEqual({ scripts: ['hello'] });
  });

  it('migrates legacy aliases and removes them after a successful write', async () => {
    legacy.set('old', '{"nodes":[1]}');
    expect(await readStoredValue('topology', { legacyKeys: ['old'] })).toEqual({ nodes: [1] });
    expect(legacy.size).toBe(0);
    expect(await readStoredValue('topology')).toEqual({ nodes: [1] });
  });

  it('prefers IndexedDB over legacy data', async () => {
    await writeStoredValue('config', { current: true });
    legacy.set('config', '{"current":false}');
    expect(await readStoredValue('config')).toEqual({ current: true });
  });

  it('preserves legacy data if migration cannot be written', async () => {
    legacy.set('config', '{}');
    vi.spyOn(appDatabase.table('settings'), 'add').mockRejectedValueOnce(new Error('write failed'));
    await expect(readStoredValue('config')).rejects.toThrow('write failed');
    expect(legacy.get('config')).toBe('{}');
  });

  it('skips corrupt data and accepts custom legacy formats', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    legacy.set('broken', '{');
    expect(await readStoredValue('broken')).toBeUndefined();
    expect(legacy.has('broken')).toBe(true);
    legacy.set('flag', '1');
    expect(await readStoredValue('flag', { parse: (raw) => raw === '1' })).toBe(true);
  });

  it('removes current and legacy records', async () => {
    await writeStoredValue('config', {});
    legacy.set('old', '{}');
    await removeStoredValue('config', ['old']);
    expect(await readStoredValue('config', { legacyKeys: ['old'] })).toBeUndefined();
  });
});

describe('feature storage migration', () => {
  it('migrates the embedded J1939 converter settings', async () => {
    const state = { id: '0x18E1F3EF', pgn: '65043', priority: '3', sa: '131', da: 'broadcast' };
    legacy.set(J1939_UI_STORAGE_KEY, JSON.stringify(state));
    expect(await readJ1939UiState()).toEqual(state);
    await saveJ1939UiState({ ...state, sa: '132' });
    expect((await readJ1939UiState()).sa).toBe('132');
    expect(legacy.has(J1939_UI_STORAGE_KEY)).toBe(false);
  });

  it('migrates and updates CAN topology through the repository', async () => {
    const repository = new DexieRepository(STORAGE_KEY);
    const topology = { nodes: [{ id: 'ecu-1', name: 'VCU' }], buses: [], links: [] };
    legacy.set(STORAGE_KEY, JSON.stringify(topology));
    expect(await repository.load()).toEqual(topology);
    topology.nodes[0].name = 'BCU';
    await repository.save(topology);
    expect(await repository.load()).toEqual(topology);
    await repository.clear();
    expect(await repository.load()).toBeNull();
  });

  it('migrates chart groups and saves normalized display settings', async () => {
    const state = { curveGroups: [{ title: 'Migrated group', curves: [] }] };
    legacy.set(CHART_UI_STORAGE_KEY, JSON.stringify(state));
    expect(await readChartUiStateFromStorage()).toEqual(state);
    await saveChartUiState({}, state.curveGroups);
    expect((await readChartUiStateFromStorage()).curveGroups[0].title).toBe('Migrated group');
    expect(legacy.has(CHART_UI_STORAGE_KEY)).toBe(false);
  });

  it('propagates database read errors instead of returning defaults', async () => {
    vi.spyOn(appDatabase.table('settings'), 'get').mockRejectedValueOnce(new Error('database unavailable'));
    await expect(readChartUiStateFromStorage()).rejects.toThrow('database unavailable');
  });

  it('migrates and saves Wenyan scripts and active selection', async () => {
    const state = { activeScriptId: 'user-1', scripts: [{ id: 'user-1', title: 'Script', source: '吾有一數。曰三。' }] };
    legacy.set(SCRIPT_STORAGE_KEY, JSON.stringify(state));
    expect(await readWenyanScripts()).toEqual(state);
    state.scripts[0].source = '吾有一數。曰五。';
    await saveWenyanScripts(state);
    expect(await readWenyanScripts()).toEqual(state);
    expect(legacy.has(SCRIPT_STORAGE_KEY)).toBe(false);
  });

  it('migrates and normalizes knowledge connection settings', async () => {
    legacy.set(KNOWLEDGE_CHAT_CONFIG_KEY, JSON.stringify({ apiUrl: ' https://example.test ', authorization: 'test-only', topK: 99 }));
    const config = await readKnowledgeChatConfig();
    expect(config.apiUrl).toBe('https://example.test');
    expect(config.topK).toBe(20);
    await saveKnowledgeChatConfig({ ...config, topK: 3 });
    expect((await readKnowledgeChatConfig()).topK).toBe(3);
    expect(legacy.has(KNOWLEDGE_CHAT_CONFIG_KEY)).toBe(false);
  });

  it('migrates formula sources and keeps count fallback behavior', async () => {
    legacy.set('chartFormulaFunctionSources', JSON.stringify(['(x) => x']));
    expect(await loadFormulaSourceList(2)).toHaveLength(2);
    await saveFormulaSourceList(['(x) => x * 2']);
    expect(await loadFormulaSourceList(1)).toEqual(['(x) => x * 2']);
    expect(legacy.has('chartFormulaFunctionSources')).toBe(false);
  });
});