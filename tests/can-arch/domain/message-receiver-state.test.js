import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createTopologyStore } from '../../../src/features/can-arch/app/composables/useTopologyStore.js';
import { DexieRepository } from '../../../src/features/can-arch/infra/DexieRepository.js';
import { STORAGE_KEY } from '../../../src/features/can-arch/domain/can-arch-constants.js';
import { cloneMessageWorkspaceSnapshot, hydrateNodes } from '../../../src/features/can-arch/domain/can-arch-topology.js';
import { countInvalidMessageReceiverEntries } from '../../../src/features/can-arch/domain/message-receiver-state.js';

function createMessage(name, receiverMode, receivers, senders = ['ecu-peer']) {
  return { name, receiverMode, receivers, senders };
}

describe('message receiver state cleanup', () => {
  it('removes nodes-mode messages without receivers from hydrated and persisted workspaces', () => {
    const nodes = [{
      id: 'ecu-a',
      messageWorkspace: {
        'bus-a': {
          rxMessages: [
            createMessage('RX_ORPHAN', 'nodes', []),
            createMessage('RX_VALID', 'nodes', ['ecu-a']),
          ],
          txMessages: [
            createMessage('TX_ORPHAN', 'nodes', []),
            createMessage('TX_NO_SENDER', 'broadcast', [], []),
            createMessage('TX_BROADCAST', 'broadcast', []),
          ],
        },
      },
    }];

    expect(countInvalidMessageReceiverEntries(nodes)).toBe(3);
    expect(hydrateNodes(nodes)[0].messageWorkspace['bus-a']).toEqual({
      rxMessages: [createMessage('RX_VALID', 'nodes', ['ecu-a'])],
      txMessages: [createMessage('TX_BROADCAST', 'broadcast', [])],
    });
    expect(cloneMessageWorkspaceSnapshot(nodes[0].messageWorkspace)['bus-a']).toEqual({
      rxMessages: [createMessage('RX_VALID', 'nodes', ['ecu-a'])],
      txMessages: [createMessage('TX_BROADCAST', 'broadcast', [])],
    });
  });

  it('writes legacy receiverless messages out of IndexedDB during topology load', async () => {
    const repository = new DexieRepository(STORAGE_KEY);
    await repository.clear();
    await repository.save({
      nodes: [{
        id: 'ecu-legacy',
        messageWorkspace: {
          'bus-legacy': {
            rxMessages: [createMessage('RX_ORPHAN', 'nodes', [])],
            txMessages: [createMessage('TX_VALID', 'nodes', ['ecu-legacy'])],
          },
        },
      }],
      buses: [],
      links: [],
    });
    const statuses = [];
    const store = createTopologyStore({ onStatus: (status) => statuses.push(status) });

    await store.load();

    const persisted = await repository.load();
    expect(store.nodes.value[0].messageWorkspace['bus-legacy'].rxMessages).toEqual([]);
    expect(persisted.nodes[0].messageWorkspace['bus-legacy'].rxMessages).toEqual([]);
    expect(persisted.nodes[0].messageWorkspace['bus-legacy'].txMessages.map((message) => message.name))
      .toEqual(['TX_VALID']);
    expect(statuses.join(' ')).toContain('已自动清理 1 条');
    await repository.clear();
  });
});
