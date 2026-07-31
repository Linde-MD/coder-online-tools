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
const SPLIT_TOKEN_MARKER = '__CA__';

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

function buildSplitTokenSuffix(protocol, addressValue) {
  if (protocol === PROTOCOL_J1939) {
    const token = Number.isInteger(addressValue) ? String(addressValue) : 'N';
    return `${SPLIT_TOKEN_MARKER}J1939_A_${token}`;
  }
  if (protocol === PROTOCOL_CANOPEN) {
    const token = Number.isInteger(addressValue) ? String(addressValue) : 'N';
    return `${SPLIT_TOKEN_MARKER}CANOPEN_A_${token}`;
  }
  if (protocol === PROTOCOL_GENERIC_STD) {
    return `${SPLIT_TOKEN_MARKER}GEN_STD`;
  }
  if (protocol === PROTOCOL_GENERIC_EXT) {
    return `${SPLIT_TOKEN_MARKER}GEN_EXT`;
  }
  return `${SPLIT_TOKEN_MARKER}GENERIC`;
}

function explodeNodeToDbcRecords(node) {
  const protocols = normalizeProtocolsList(
    parseProtocolList((Array.isArray(node?.protocols) ? node.protocols : []).join(',')),
    node?.genericFrameFormat
  );
  const j1939Addresses = normalizeIntArray(node?.j1939Addresses);
  const canopenNodeIds = normalizeIntArray(node?.canopenNodeIds);
  const effectiveProtocols = protocols.length > 0 ? protocols : [PROTOCOL_GENERIC_STD];
  const hasComplexProtocols = effectiveProtocols.length > 1;
  const hasComplexAddresses = j1939Addresses.length > 1 || canopenNodeIds.length > 1;
  const shouldSplit = hasComplexProtocols || hasComplexAddresses;

  if (!shouldSplit) {
    return [{
      node,
      suffix: '',
      protocols: effectiveProtocols,
      j1939Addresses,
      canopenNodeIds,
    }];
  }

  const records = [];
  const hasJ1939 = effectiveProtocols.includes(PROTOCOL_J1939) || j1939Addresses.length > 0;
  const hasCanopen = effectiveProtocols.includes(PROTOCOL_CANOPEN) || canopenNodeIds.length > 0;
  const hasGenericStd = effectiveProtocols.includes(PROTOCOL_GENERIC_STD);
  const hasGenericExt = effectiveProtocols.includes(PROTOCOL_GENERIC_EXT);

  if (hasJ1939) {
    if (j1939Addresses.length === 0) {
      records.push({
        node,
        suffix: buildSplitTokenSuffix(PROTOCOL_J1939, null),
        protocols: [PROTOCOL_J1939],
        j1939Addresses: [],
        canopenNodeIds: [],
      });
    } else {
      for (const address of j1939Addresses) {
        records.push({
          node,
          suffix: buildSplitTokenSuffix(PROTOCOL_J1939, address),
          protocols: [PROTOCOL_J1939],
          j1939Addresses: [address],
          canopenNodeIds: [],
        });
      }
    }
  }

  if (hasCanopen) {
    if (canopenNodeIds.length === 0) {
      records.push({
        node,
        suffix: buildSplitTokenSuffix(PROTOCOL_CANOPEN, null),
        protocols: [PROTOCOL_CANOPEN],
        j1939Addresses: [],
        canopenNodeIds: [],
      });
    } else {
      for (const nodeId of canopenNodeIds) {
        records.push({
          node,
          suffix: buildSplitTokenSuffix(PROTOCOL_CANOPEN, nodeId),
          protocols: [PROTOCOL_CANOPEN],
          j1939Addresses: [],
          canopenNodeIds: [nodeId],
        });
      }
    }
  }

  if (hasGenericStd) {
    records.push({
      node,
      suffix: buildSplitTokenSuffix(PROTOCOL_GENERIC_STD, null),
      protocols: [PROTOCOL_GENERIC_STD],
      j1939Addresses: [],
      canopenNodeIds: [],
    });
  }

  if (hasGenericExt) {
    records.push({
      node,
      suffix: buildSplitTokenSuffix(PROTOCOL_GENERIC_EXT, null),
      protocols: [PROTOCOL_GENERIC_EXT],
      j1939Addresses: [],
      canopenNodeIds: [],
    });
  }

  if (records.length === 0) {
    records.push({
      node,
      suffix: buildSplitTokenSuffix('', null),
      protocols: [PROTOCOL_GENERIC_STD],
      j1939Addresses: [],
      canopenNodeIds: [],
    });
  }

  return records;
}

function parseSplitToken(token) {
  const index = token.indexOf(SPLIT_TOKEN_MARKER);
  if (index < 0) return null;

  const baseName = token.slice(0, index);
  const suffix = token.slice(index + SPLIT_TOKEN_MARKER.length);
  if (!baseName || !suffix) return null;

  if (suffix === 'GENERIC') {
    return {
      baseName,
      protocol: PROTOCOL_GENERIC_STD,
      address: null,
    };
  }

  if (suffix === 'GEN_STD') {
    return {
      baseName,
      protocol: PROTOCOL_GENERIC_STD,
      address: null,
    };
  }

  if (suffix === 'GEN_EXT') {
    return {
      baseName,
      protocol: PROTOCOL_GENERIC_EXT,
      address: null,
    };
  }

  const j1939Matched = suffix.match(/^J1939_A_([0-9]+|N)$/);
  if (j1939Matched) {
    return {
      baseName,
      protocol: PROTOCOL_J1939,
      address: j1939Matched[1] === 'N' ? null : Number.parseInt(j1939Matched[1], 10),
    };
  }

  const canopenMatched = suffix.match(/^CANOPEN_A_([0-9]+|N)$/);
  if (canopenMatched) {
    return {
      baseName,
      protocol: PROTOCOL_CANOPEN,
      address: canopenMatched[1] === 'N' ? null : Number.parseInt(canopenMatched[1], 10),
    };
  }

  return null;
}

export function serializeNodesToDbc(nodes = [], options = {}) {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const profile = options?.profile === 'j1939' ? 'j1939' : 'standard';
  const usedTokens = new Set();
  const tokenRecords = safeNodes
    .flatMap((node) => explodeNodeToDbcRecords(node))
    .map((record) => {
      const base = nodeNameToToken(record.node?.name || 'Node');
      const rawToken = `${base}${record.suffix}`;
      return {
        ...record,
        token: buildUniqueToken(rawToken, usedTokens),
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
    node,
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

    const splitInfo = parseSplitToken(token);
    const nodeName = splitInfo?.baseName || token;
    if (splitInfo?.protocol) {
      if (!protocols.includes(splitInfo.protocol)) {
        protocols = [...protocols, splitInfo.protocol];
      }
      if (splitInfo.protocol === PROTOCOL_J1939 && Number.isInteger(splitInfo.address)) {
        j1939Addresses = [...j1939Addresses, splitInfo.address];
      }
      if (splitInfo.protocol === PROTOCOL_CANOPEN && Number.isInteger(splitInfo.address)) {
        canopenNodeIds = [...canopenNodeIds, splitInfo.address];
      }
    }

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
