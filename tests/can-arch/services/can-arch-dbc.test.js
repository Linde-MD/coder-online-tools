import { describe, expect, it } from 'vitest';
import {
  canProtocols,
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
});
