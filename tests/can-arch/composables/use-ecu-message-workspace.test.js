import { nextTick, ref } from 'vue';
import { describe, expect, it } from 'vitest';
import { useEcuMessageWorkspace } from '../../../src/features/can-arch/app/composables/useEcuMessageWorkspace.js';

function createMessage(id, name, senders, receivers, receiverMode = 'nodes') {
  return {
    id,
    idHex: `0x${id}`,
    name,
    protocol: 'generic_std',
    senders,
    receivers,
    receiverMode,
    signals: [],
  };
}

describe('useEcuMessageWorkspace peer filters', () => {
  it('filters RX by sender and TX by receiver while retaining broadcast TX messages', async () => {
    const ecuId = crypto.randomUUID();
    const peerA = crypto.randomUUID();
    const peerB = crypto.randomUUID();
    const busId = crypto.randomUUID();
    const ecuRef = ref({
      id: ecuId,
      messageWorkspace: {
        [busId]: {
          rxMessages: [
            createMessage('101', 'RX_A', [peerA], [ecuId]),
            createMessage('102', 'RX_B', [peerB], [ecuId]),
          ],
          txMessages: [
            createMessage('201', 'TX_A', [ecuId], [peerA]),
            createMessage('202', 'TX_B', [ecuId], [peerB]),
            createMessage('203', 'TX_BROADCAST', [ecuId], [], 'broadcast'),
          ],
        },
      },
    });
    const busTabsRef = ref([{
      busId,
      peers: [{ id: peerA, name: 'ECU_A' }, { id: peerB, name: 'ECU_B' }],
    }]);
    const workspace = useEcuMessageWorkspace({ ecuRef, busTabsRef });
    await nextTick();

    expect(workspace.filterPeerIds.value).toEqual([peerA, peerB]);
    expect(workspace.filteredRxMessages.value.map((message) => message.name)).toEqual(['RX_A', 'RX_B']);
    expect(workspace.filteredTxMessages.value.map((message) => message.name)).toEqual([
      'TX_A', 'TX_B', 'TX_BROADCAST',
    ]);

    workspace.filterPeerIds.value = [peerA];

    expect(workspace.filteredRxMessages.value.map((message) => message.name)).toEqual(['RX_A']);
    expect(workspace.filteredTxMessages.value.map((message) => message.name)).toEqual([
      'TX_A', 'TX_BROADCAST',
    ]);
  });

  it('does not add a nodes message when the bus has no receiver peers', async () => {
    const ecuId = crypto.randomUUID();
    const busId = crypto.randomUUID();
    const ecuRef = ref({ id: ecuId, messageWorkspace: { [busId]: { rxMessages: [], txMessages: [] } } });
    const busTabsRef = ref([{ busId, peers: [] }]);
    const workspace = useEcuMessageWorkspace({ ecuRef, busTabsRef });
    await nextTick();

    expect(workspace.addMessage('tx')).toBeNull();
    expect(workspace.txMessages.value).toEqual([]);
  });
});