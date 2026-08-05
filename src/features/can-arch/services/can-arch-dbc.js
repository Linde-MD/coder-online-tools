import { detectMessageErrors } from '@/features/can-arch/app/composables/useEcuMessageWorkspace.js';

const PROTOCOL_J1939 = 'J1939';
const PROTOCOL_CANOPEN = 'CANOPEN';
const PROTOCOL_GENERIC_STD = 'GENERIC_STD';
const PROTOCOL_GENERIC_EXT = 'GENERIC_EXT';
const PROTOCOL_GENERIC = 'GENERIC';

const ATTR_PROTOCOLS = 'CAN_PROTOCOLS';
const ATTR_J1939_ADDRS = 'J1939_ADDRS';
const ATTR_CANOPEN_NODE_IDS = 'CANOPEN_NODE_IDS';
const ATTR_GENERIC_FRAME_FORMAT = 'GENERIC_FRAME_FORMAT';
const ATTR_NM_STATION_ADDRESS = 'NMSTATIONADDRESS';

const PROTOCOL_ATTR_KEYS = new Set([
  ATTR_PROTOCOLS,
  'PROTOCOLS',
]);

const J1939_ATTR_KEYS = new Set([
  ATTR_NM_STATION_ADDRESS,
  ATTR_J1939_ADDRS,
  'J1939_ADDR',
  'J1939_ADDRESS',
  'NMSTATIONADDRESS',
]);

const CANOPEN_ATTR_KEYS = new Set([
  ATTR_CANOPEN_NODE_IDS,
  'CANOPEN_IDS',
  'CANOPEN_NODE_ID',
]);

const GENERIC_FRAME_ATTR_KEYS = new Set([
  ATTR_GENERIC_FRAME_FORMAT,
  'GENERIC_FRAME',
  'GENERIC_FRAME_TYPE',
]);

function normalizeGenericFrameFormat(value) {
  const token = String(value || '').trim().toLowerCase();
  if (token === 'extended' || token === 'ext') return 'extended';
  return 'standard';
}

function normalizeProtocolsList(protocols, genericFrameFormat = 'standard') {
  const unique = [...new Set(Array.isArray(protocols) ? protocols : [])];
  const normalized = unique
    .filter((item) => item === PROTOCOL_J1939 || item === PROTOCOL_CANOPEN || item === PROTOCOL_GENERIC || item === PROTOCOL_GENERIC_STD || item === PROTOCOL_GENERIC_EXT)
    .filter((item) => item !== PROTOCOL_GENERIC);

  if (unique.includes(PROTOCOL_GENERIC)) {
    normalized.push(normalizeGenericFrameFormat(genericFrameFormat) === 'extended' ? PROTOCOL_GENERIC_EXT : PROTOCOL_GENERIC_STD);
  }

  return [...new Set(normalized)];
}

function escapeDbcString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function unquoteDbcValue(rawValue) {
  const trimmed = String(rawValue || '').trim();
  if (!trimmed.startsWith('"')) {
    return trimmed;
  }
  let text = trimmed;
  if (text.endsWith(';')) {
    text = text.slice(0, -1);
  }
  if (text.startsWith('"') && text.endsWith('"')) {
    text = text.slice(1, -1);
  }
  return text.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

function parseIntegerList(value) {
  return String(value || '')
    .split(/[;,，\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number.parseInt(part, 10))
    .filter((num) => Number.isInteger(num));
}

function parseProtocolList(value) {
  return String(value || '')
    .split(/[;,，\s]+/)
    .map((part) => part.trim().toUpperCase())
    .map((part) => {
      if (part === 'CANOPEN' || part === 'CAN_OPEN') return PROTOCOL_CANOPEN;
      if (part === 'J1939') return PROTOCOL_J1939;
      if (part === 'GENERIC_STD' || part === 'GEN_STD' || part === 'GENERIC_STANDARD') return PROTOCOL_GENERIC_STD;
      if (part === 'GENERIC_EXT' || part === 'GEN_EXT' || part === 'GENERIC_EXTENDED') return PROTOCOL_GENERIC_EXT;
      if (part === 'GENERIC' || part === 'GEN') return PROTOCOL_GENERIC;
      return '';
    })
    .filter(Boolean)
    .filter((token, idx, list) => list.indexOf(token) === idx);
}

function parseSingleInteger(value) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function nodeNameToToken(name) {
  const raw = String(name || '').trim();
  let token = raw.replace(/[^A-Za-z0-9_]/g, '_');
  token = token.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (!token) token = 'ECU';
  if (!/^[A-Za-z_]/.test(token)) token = `N_${token}`;
  return token;
}

function buildUniqueToken(baseToken, usedTokens) {
  if (!usedTokens.has(baseToken)) {
    usedTokens.add(baseToken);
    return baseToken;
  }

  let suffix = 2;
  while (usedTokens.has(`${baseToken}_${suffix}`)) {
    suffix += 1;
  }
  const token = `${baseToken}_${suffix}`;
  usedTokens.add(token);
  return token;
}

function pushUnique(list, value) {
  if (!list.includes(value)) {
    list.push(value);
  }
}

function normalizeIntArray(value) {
  const list = Array.isArray(value) ? value : [];
  const numbers = list
    .map((item) => Number.parseInt(item, 10))
    .filter((num) => Number.isInteger(num));
  return [...new Set(numbers)];
}

function hexToDecimal(hexStr) {
  const cleaned = String(hexStr || '').replace(/^0x/i, '');
  const parsed = Number.parseInt(cleaned, 16);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function dbcByteOrder(byteOrder) {
  return (byteOrder === 'intel' || byteOrder === 'little') ? '1' : '0';
}

function dbcValueType(signed) {
  return signed ? '-' : '+';
}

function serializeMessagesToDbc(messages = [], senderToken, receiverTokens = []) {
  const lines = [];
  const safeMessages = Array.isArray(messages) ? messages : [];

  for (const msg of safeMessages) {
    if (!msg) continue;
    const canId = hexToDecimal(msg.idHex);
    const msgName = nodeNameToToken(msg.name || 'MSG');
    const dlc = Number.isInteger(msg.dlc) ? msg.dlc : 8;
    const sender = senderToken || 'Vector__XXX';
    lines.push('');
    lines.push(`BO_ ${canId} ${msgName}: ${dlc} ${sender}`);

    const signals = Array.isArray(msg.signals) ? msg.signals : [];
    for (const sig of signals) {
      if (!sig) continue;
      const sigName = nodeNameToToken(sig.name || 'SIG');
      const startBit = sig.startBit ?? 0;
      const length = sig.length ?? 8;
      const byteOrd = dbcByteOrder(msg.byteOrder);
      const valType = dbcValueType(sig.signed);
      const factor = sig.factor ?? 1;
      const offset = sig.offset ?? 0;
      const min = sig.min ?? 0;
      const max = sig.max ?? ((1 << Math.min(length, 32)) - 1);
      const unit = String(sig.unit || '');
      const receivers = receiverTokens.length > 0 ? receiverTokens.join(',') : 'Vector__XXX';
      lines.push(` SG_ ${sigName} : ${startBit}|${length}@${byteOrd}${valType} (${factor},${offset}) [${min}|${max}] "${unit}" ${receivers}`);
    }
  }

  return lines;
}

export function serializeNodesToDbc(nodes = [], options = {}) {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const profile = options?.profile === 'j1939' ? 'j1939' : 'standard';
  const usedTokens = new Set();
  const tokenRecords = safeNodes
    .map((node) => {
      const base = nodeNameToToken(node?.name || 'Node');
      const protocols = normalizeProtocolsList(
        parseProtocolList((Array.isArray(node?.protocols) ? node.protocols : []).join(',')),
        node?.genericFrameFormat
      );
      const effectiveProtocols = protocols.length > 0 ? protocols : [PROTOCOL_GENERIC_STD];
      const j1939Addresses = normalizeIntArray(node?.j1939Addresses);
      const canopenNodeIds = normalizeIntArray(node?.canopenNodeIds);
      return {
        node,
        token: buildUniqueToken(base, usedTokens),
        protocols: effectiveProtocols,
        j1939Addresses,
        canopenNodeIds,
      };
    });

  const lines = [
    profile === 'j1939' ? 'VERSION "CAN_ARCH_NODES_J1939_v1"' : 'VERSION "CAN_ARCH_NODES_v1"',
    '',
    'NS_ :',
    '  BA_DEF_',
    '  BA_',
    '',
    'BS_:',
    '',
    `BU_: ${tokenRecords.map((item) => item.token).join(' ')}`,
    '',
    'BA_DEF_ BU_ "NmStationAddress" INT 0 255;',
    `BA_DEF_ BU_ "${ATTR_PROTOCOLS}" STRING ;`,
    `BA_DEF_ BU_ "${ATTR_J1939_ADDRS}" STRING ;`,
    `BA_DEF_ BU_ "${ATTR_CANOPEN_NODE_IDS}" STRING ;`,
    `BA_DEF_ BU_ "${ATTR_GENERIC_FRAME_FORMAT}" STRING ;`,
  ];

  for (const {
    token,
    protocols: effectiveProtocols,
    j1939Addresses: effectiveJ1939Addresses,
    canopenNodeIds: effectiveCanopenNodeIds,
  } of tokenRecords) {
    const genericFrameFormat = effectiveProtocols.includes(PROTOCOL_GENERIC_EXT) ? 'extended' : 'standard';
    const primaryJ1939Address = effectiveJ1939Addresses.length > 0 ? effectiveJ1939Addresses[0] : null;

    if (primaryJ1939Address != null) {
      lines.push(`BA_ "NmStationAddress" BU_ ${token} ${primaryJ1939Address};`);
    }
    lines.push(
      `BA_ "${ATTR_PROTOCOLS}" BU_ ${token} "${escapeDbcString(effectiveProtocols.join(','))}";`,
      `BA_ "${ATTR_J1939_ADDRS}" BU_ ${token} "${escapeDbcString(effectiveJ1939Addresses.join(','))}";`,
      `BA_ "${ATTR_CANOPEN_NODE_IDS}" BU_ ${token} "${escapeDbcString(effectiveCanopenNodeIds.join(','))}";`,
      `BA_ "${ATTR_GENERIC_FRAME_FORMAT}" BU_ ${token} "${escapeDbcString(genericFrameFormat)}";`
    );
  }

  lines.push('');

  const messagesByNode = options?.messagesByNode;
  if (messagesByNode && typeof messagesByNode === 'object') {
    const tokenToName = {};
    for (const record of tokenRecords) {
      tokenToName[record.node.id] = record.token;
    }

    const allRxMessages = [];
    const allTxMessages = [];
    for (const record of tokenRecords) {
      const nodeMessages = messagesByNode[record.node.id];
      if (!nodeMessages || typeof nodeMessages !== 'object') continue;
      allRxMessages.push(...(Array.isArray(nodeMessages.rxMessages) ? nodeMessages.rxMessages : []));
      allTxMessages.push(...(Array.isArray(nodeMessages.txMessages) ? nodeMessages.txMessages : []));
    }
    const errorIds = detectMessageErrors(allRxMessages, allTxMessages);

    for (const record of tokenRecords) {
      const nodeId = record.node.id;
      const nodeMessages = messagesByNode[nodeId];
      if (!nodeMessages || typeof nodeMessages !== 'object') continue;

      let txMessages = Array.isArray(nodeMessages.txMessages) ? nodeMessages.txMessages : [];
      let rxMessages = Array.isArray(nodeMessages.rxMessages) ? nodeMessages.rxMessages : [];
      txMessages = txMessages.filter((msg) => msg && !errorIds.has(msg.id));
      rxMessages = rxMessages.filter((msg) => msg && !errorIds.has(msg.id));

      const allTokenNames = tokenRecords.map((r) => r.token);

      if (txMessages.length > 0) {
        lines.push(...serializeMessagesToDbc(txMessages, record.token, allTokenNames));
      }
      if (rxMessages.length > 0) {
        const senderTokens = [];
        for (const msg of rxMessages) {
          const senders = Array.isArray(msg.senders) ? msg.senders : [];
          for (const senderId of senders) {
            const senderToken = tokenToName[senderId];
            if (senderToken && !senderTokens.includes(senderToken)) {
              senderTokens.push(senderToken);
            }
          }
        }
        const rxSender = senderTokens.length > 0 ? senderTokens[0] : record.token;
        lines.push(...serializeMessagesToDbc(rxMessages, rxSender, allTokenNames));
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

function parseBuTokens(dbcText) {
  const lines = String(dbcText || '').split(/\r?\n/);
  const buLine = lines.find((line) => /^\s*BU_\s*:/.test(line));
  if (!buLine) return [];

  return buLine
    .replace(/^\s*BU_\s*:/, '')
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function parseBuAttributes(dbcText) {
  const lines = String(dbcText || '').split(/\r?\n/);
  const attrMap = new Map();
  const attrPattern = /^\s*BA_\s+"([^"]+)"\s+BU_\s+([A-Za-z_][A-Za-z0-9_]*)\s+(.+);\s*$/;

  for (const line of lines) {
    const matched = line.match(attrPattern);
    if (!matched) continue;

    const [, attrNameRaw, nodeToken, rawValue] = matched;
    const attrName = attrNameRaw.trim().toUpperCase();
    if (!attrMap.has(nodeToken)) {
      attrMap.set(nodeToken, new Map());
    }
    attrMap.get(nodeToken).set(attrName, unquoteDbcValue(rawValue));
  }

  return attrMap;
}

export function parseDbcNodes(dbcText) {
  const tokens = parseBuTokens(dbcText);
  const attributes = parseBuAttributes(dbcText);

  const mergedNodes = new Map();
  for (const token of tokens) {
    const attr = attributes.get(token) || new Map();

    let protocols = [];
    for (const key of PROTOCOL_ATTR_KEYS) {
      if (attr.has(key)) {
        protocols = parseProtocolList(attr.get(key));
        break;
      }
    }

    let j1939Addresses = [];
    if (attr.has(ATTR_NM_STATION_ADDRESS)) {
      const parsed = parseSingleInteger(attr.get(ATTR_NM_STATION_ADDRESS));
      if (parsed != null) {
        j1939Addresses = [parsed];
        if (!protocols.includes(PROTOCOL_J1939)) {
          protocols = [...protocols, PROTOCOL_J1939];
        }
      }
    }
    for (const key of J1939_ATTR_KEYS) {
      if (key === ATTR_NM_STATION_ADDRESS) {
        continue;
      }
      if (attr.has(key)) {
        j1939Addresses = parseIntegerList(attr.get(key));
        if (j1939Addresses.length > 0 && !protocols.includes(PROTOCOL_J1939)) {
          protocols = [...protocols, PROTOCOL_J1939];
        }
        break;
      }
    }

    let canopenNodeIds = [];
    for (const key of CANOPEN_ATTR_KEYS) {
      if (attr.has(key)) {
        canopenNodeIds = parseIntegerList(attr.get(key));
        break;
      }
    }

    let genericFrameFormat = 'standard';
    for (const key of GENERIC_FRAME_ATTR_KEYS) {
      if (attr.has(key)) {
        genericFrameFormat = normalizeGenericFrameFormat(attr.get(key));
        break;
      }
    }

    protocols = normalizeProtocolsList(protocols, genericFrameFormat);

    const nodeName = token;

    if (!mergedNodes.has(nodeName)) {
      mergedNodes.set(nodeName, {
        name: nodeName,
        protocols: [],
        j1939Addresses: [],
        canopenNodeIds: [],
        genericFrameFormat: 'standard',
      });
    }

    const merged = mergedNodes.get(nodeName);
    for (const protocol of protocols) {
      pushUnique(merged.protocols, protocol);
    }
    for (const address of j1939Addresses) {
      pushUnique(merged.j1939Addresses, address);
    }
    for (const nodeId of canopenNodeIds) {
      pushUnique(merged.canopenNodeIds, nodeId);
    }
    const mergedFrame = normalizeGenericFrameFormat(genericFrameFormat || merged.genericFrameFormat);
    merged.genericFrameFormat = merged.protocols.includes(PROTOCOL_GENERIC_EXT) ? 'extended' : mergedFrame;
  }

  return [...mergedNodes.values()];
}

export function parseDbcMessages(dbcText) {
  const lines = String(dbcText || '').split(/\r?\n/);
  const tokens = parseBuTokens(dbcText);
  const tokenSet = new Set(tokens);

  const messages = [];
  let currentMessage = null;

  const boPattern = /^\s*BO_\s+(\d+)\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(\d+)\s+([A-Za-z_][A-Za-z0-9_]*)/;
  const sgPattern = /^\s*SG_\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\s*:\s*(\d+)\|(\d+)@([01])([+-])\s*\(([^,]+),([^)]+)\)\s*\[([^|]+)\|([^\]]+)\]\s*"([^"]*)"\s*(.*))?/;

  for (const line of lines) {
    const boMatch = line.match(boPattern);
    if (boMatch) {
      if (currentMessage && currentMessage.signals.length > 0) {
        messages.push(currentMessage);
      }
      const canId = parseInt(boMatch[1], 10);
      const name = boMatch[2];
      const dlc = parseInt(boMatch[3], 10) || 8;
      const sender = boMatch[4];
      currentMessage = {
        id: crypto.randomUUID ? crypto.randomUUID() : `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: name,
        idHex: `0x${canId.toString(16).toUpperCase()}`,
        dlc: dlc,
        senders: tokenSet.has(sender) ? [sender] : [],
        receivers: [],
        signals: [],
        protocol: 'generic_std',
        color: '#8a6d4f',
        triggerMode: 'cyclic',
        txMode: 'periodic',
        periodMs: 100,
        byteOrder: 'intel',
        dlcMode: 'fixed',
        layoutMode: 'compact',
        comment: '',
        j1939: { enabled: false, mode: 'id', id: '', pgn: '', priority: 6, sa: '', da: '' },
      };
      continue;
    }

    const sgMatch = line.match(sgPattern);
    if (sgMatch && currentMessage) {
      const sigName = sgMatch[1];
      if (sgMatch[2] !== undefined) {
        const startBit = parseInt(sgMatch[2], 10) || 0;
        const length = parseInt(sgMatch[3], 10) || 8;
        const byteOrder = sgMatch[4] === '1' ? 'intel' : 'motorola';
        if (byteOrder === 'intel') {
          currentMessage.byteOrder = 'intel';
        }
        const signed = sgMatch[5] === '-';
        const factor = parseFloat(sgMatch[6]) || 1;
        const offset = parseFloat(sgMatch[7]) || 0;
        const min = parseFloat(sgMatch[8]) || 0;
        const max = parseFloat(sgMatch[9]) || 0;
        const unit = sgMatch[10] || '';
        const receiversStr = (sgMatch[11] || '').trim();
        const receiverTokens = receiversStr.split(/\s*,\s*/).filter((t) => tokenSet.has(t));
        for (const rt of receiverTokens) {
          if (!currentMessage.receivers.includes(rt)) {
            currentMessage.receivers.push(rt);
          }
        }
        currentMessage.signals.push({
          id: crypto.randomUUID ? crypto.randomUUID() : `sig_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name: sigName,
          startBit,
          length,
          signed,
          factor,
          offset,
          min,
          max,
          unit,
          comment: '',
        });
      }
    }
  }

  if (currentMessage && currentMessage.signals.length > 0) {
    messages.push(currentMessage);
  }

  return messages;
}

export function normalizeIntegerList(input) {
  const parts = Array.isArray(input)
    ? input
    : String(input || '')
      .split(/[;,，\s]+/)
      .map((part) => part.trim())
      .filter(Boolean);

  const values = [];
  const invalidTokens = [];
  for (const token of parts) {
    const text = String(token).trim();
    if (!text) continue;
    const num = Number.parseInt(text, 10);
    if (!Number.isInteger(num)) {
      invalidTokens.push(text);
      continue;
    }
    values.push(num);
  }

  const uniqueValues = [...new Set(values)];

  return {
    values: uniqueValues,
    invalidTokens,
  };
}

export function validateCanNodeDraft(draft) {
  const errors = [];
  const warnings = [];

  if (!String(draft?.name || '').trim()) {
    errors.push('节点名称不能为空。');
  }

  const protocols = Array.isArray(draft?.protocols) ? draft.protocols : [];
  const j1939Result = normalizeIntegerList(draft?.j1939AddressesInput || draft?.j1939Addresses || []);
  const canopenResult = normalizeIntegerList(draft?.canopenNodeIdsInput || draft?.canopenNodeIds || []);

  if (j1939Result.invalidTokens.length > 0) {
    errors.push(`J1939 地址包含非法值: ${j1939Result.invalidTokens.join(', ')}`);
  }

  if (canopenResult.invalidTokens.length > 0) {
    errors.push(`CANopen 节点号包含非法值: ${canopenResult.invalidTokens.join(', ')}`);
  }

  if (protocols.includes(PROTOCOL_CANOPEN)) {
    const outOfRange = canopenResult.values.filter((value) => value < 1 || value > 127);
    if (outOfRange.length > 0) {
      errors.push(`CANopen 节点号超出范围(1-127): ${outOfRange.join(', ')}`);
    }
  }

  if (protocols.includes(PROTOCOL_J1939)) {
    const risky = j1939Result.values.filter((value) => value < 0 || value > 253);
    if (risky.length > 0) {
      warnings.push(`J1939 地址超出建议范围(0-253): ${risky.join(', ')}`);
    }
  }

  const normalizedProtocols = normalizeProtocolsList(protocols, draft?.genericFrameFormat);
  const hasJ1939 = normalizedProtocols.includes(PROTOCOL_J1939);
  const hasCanopen = normalizedProtocols.includes(PROTOCOL_CANOPEN);

  return {
    errors,
    warnings,
    normalized: {
      name: String(draft?.name || '').trim(),
      note: String(draft?.note || '').trim(),
      protocols: normalizedProtocols,
      j1939Addresses: hasJ1939 ? j1939Result.values : [],
      canopenNodeIds: hasCanopen ? canopenResult.values : [],
      genericFrameFormat: normalizeGenericFrameFormat(draft?.genericFrameFormat),
    },
  };
}

export const canProtocols = {
  J1939: PROTOCOL_J1939,
  CANOPEN: PROTOCOL_CANOPEN,
  GENERIC: PROTOCOL_GENERIC_STD,
  GENERIC_STD: PROTOCOL_GENERIC_STD,
  GENERIC_EXT: PROTOCOL_GENERIC_EXT,
};