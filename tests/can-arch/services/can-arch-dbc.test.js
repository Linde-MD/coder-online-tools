import { describe, expect, it } from 'vitest';
import {
  canProtocols,
  parseDbcMessages,
  parseDbcNodes,
  serializeNodesToDbc,
  validateCanNodeDraft,
} from '@/features/can-arch/services/can-arch-dbc.js';

describe('can-arch-dbc', () => {
  it('serializes and parses node metadata roundtrip', () => {
    const dbc = serializeNodesToDbc([
      {
        name: 'VCU Main',
        protocols: [canProtocols.J1939, canProtocols.CANOPEN],
        j1939Addresses: [1, 33],
        canopenNodeIds: [10, 11],
      },
      {
        name: 'BMS',
        protocols: [],
        j1939Addresses: [],
        canopenNodeIds: [],
      },
    ]);

    const parsed = parseDbcNodes(dbc);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe('VCU_Main');
    expect(parsed[0].protocols).toEqual([canProtocols.J1939, canProtocols.CANOPEN]);
    expect(parsed[0].j1939Addresses).toEqual([1, 33]);
    expect(parsed[0].canopenNodeIds).toEqual([10, 11]);
    expect(parsed[1].name).toBe('BMS');
  });

  it('marks J1939 profile version when requested', () => {
    const dbc = serializeNodesToDbc([
      {
        name: 'TCU',
        protocols: [canProtocols.J1939],
        j1939Addresses: [45],
        canopenNodeIds: [],
      },
    ], {
      profile: 'j1939',
    });

    expect(dbc).toContain('VERSION "CAN_ARCH_NODES_J1939_v1"');
    expect(dbc).toContain('BA_ "NmStationAddress" BU_ TCU 45;');
  });

  it('validates draft values and catches range errors', () => {
    const result = validateCanNodeDraft({
      name: 'Node_A',
      note: '',
      protocols: [canProtocols.CANOPEN, canProtocols.J1939],
      j1939AddressesInput: '1, 300',
      canopenNodeIdsInput: '1, 128',
    });

    expect(result.normalized.j1939Addresses).toEqual([1, 300]);
    expect(result.warnings).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('CANopen 节点号超出范围');
  });

  it('serializes default sender in BO_ and extra senders in BO_TX_BU_', () => {
    const nodes = [
      { id: 'ecu-a', name: 'ECU_A', protocols: [], j1939Addresses: [], canopenNodeIds: [] },
      { id: 'ecu-b', name: 'ECU_B', protocols: [], j1939Addresses: [], canopenNodeIds: [] },
      { id: 'ecu-c', name: 'ECU_C', protocols: [], j1939Addresses: [], canopenNodeIds: [] },
    ];

    const dbc = serializeNodesToDbc(nodes, {
      messagesByNode: {
        'ecu-a': {
          rxMessages: [],
          txMessages: [
            {
              id: 'm1',
              name: 'MSG_A',
              idHex: '0x123',
              dlc: 8,
              protocol: 'generic_std',
              byteOrder: 'intel',
              senders: ['ecu-b', 'ecu-a', 'ecu-c'],
              receivers: ['ecu-a', 'ecu-b', 'ecu-c'],
              signals: [
                {
                  id: 's1',
                  name: 'SIG1',
                  startBit: 0,
                  length: 8,
                  signed: false,
                  factor: 1,
                  offset: 0,
                  min: 0,
                  max: 255,
                  unit: '',
                },
              ],
            },
          ],
        },
      },
    });

    expect(dbc).toContain('BO_ 291 MSG_A: 8 ECU_B');
    expect(dbc).toContain('BO_TX_BU_ 291 : ECU_B,ECU_A,ECU_C;');

    const parsedMessages = parseDbcMessages(dbc);
    const parsed = parsedMessages.find((msg) => msg.name === 'MSG_A');
    expect(parsed).toBeTruthy();
    expect(parsed.senders).toEqual(['ECU_B', 'ECU_A', 'ECU_C']);
  });

  it('serializes broadcast receiver as Vector__XXX and parses receiverMode=broadcast', () => {
    const nodes = [
      { id: 'ecu-a', name: 'ECU_A', protocols: [], j1939Addresses: [], canopenNodeIds: [] },
      { id: 'ecu-b', name: 'ECU_B', protocols: [], j1939Addresses: [], canopenNodeIds: [] },
    ];

    const dbc = serializeNodesToDbc(nodes, {
      messagesByNode: {
        'ecu-a': {
          rxMessages: [],
          txMessages: [
            {
              id: 'm2',
              name: 'MSG_BC',
              idHex: '0x200',
              dlc: 8,
              protocol: 'generic_std',
              byteOrder: 'intel',
              senders: ['ecu-a'],
              receiverMode: 'broadcast',
              receivers: [],
              signals: [
                {
                  id: 's2',
                  name: 'SIG_BC',
                  startBit: 8,
                  length: 8,
                  signed: false,
                  factor: 1,
                  offset: 0,
                  min: 0,
                  max: 255,
                  unit: '',
                },
              ],
            },
          ],
        },
      },
    });

    expect(dbc).toContain(' SG_ SIG_BC : 8|8@1+ (1,0) [0|255] "" Vector__XXX');

    const parsedMessages = parseDbcMessages(dbc);
    const parsed = parsedMessages.find((msg) => msg.name === 'MSG_BC');
    expect(parsed).toBeTruthy();
    expect(parsed.receiverMode).toBe('broadcast');
    expect(parsed.receivers).toEqual([]);
  });
});
