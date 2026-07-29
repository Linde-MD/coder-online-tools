const SPECIAL_PGN_MAP = {
  59904: '请求报文',
  59392: '响应报文',
  60928: '地址声明报文',
  60416: '多包报文请求/响应/结束',
  60160: '多包报文数据报文',
  65266: 'DM1'
};

export function parseNumberInput(rawValue) {
  if (rawValue === null || rawValue === undefined) return NaN;
  const value = String(rawValue).trim();
  if (!value) return NaN;

  if (/^0x[0-9a-f]+$/i.test(value)) {
    return parseInt(value, 16);
  }
  if (/^0b[01]+$/i.test(value)) {
    return parseInt(value.slice(2), 2);
  }
  if (/^[0-9]+$/.test(value)) {
    return parseInt(value, 10);
  }
  return NaN;
}

export function formatHex(value, width = 0) {
  if (!Number.isFinite(value)) return 'N/A';
  return `0x${value.toString(16).toUpperCase().padStart(width, '0')}`;
}

export function decodeJ1939Id(id) {
  if (!Number.isInteger(id) || id < 0 || id > 0x1FFFFFFF) {
    return { valid: false, error: 'ID 必须是 0 ~ 0x1FFFFFFF 的整数。' };
  }

  const SA = id & 0xFF;
  const PS = (id >> 8) & 0xFF;
  const PF = (id >> 16) & 0xFF;
  const DP = (id >> 24) & 0x01;
  const RDP = (id >> 24) & 0x03;
  const P = (id >> 26) & 0x07;

  const GE = PF >= 240 ? PS : 0;
  const isBroadcast = PF >= 240;
  const PGN = (RDP << 16) | (PF << 8) | GE;

  return {
    valid: true,
    SA,
    PS,
    PF,
    DP,
    RDP,
    P,
    GE,
    PGN,
    isBroadcast,
    destinationAddress: isBroadcast ? null : PS,
    specialPgnName: SPECIAL_PGN_MAP[PGN] || ''
  };
}

export function encodeJ1939IdFromPgn(pgn, priority, sourceAddress, destinationAddress) {
  if (!Number.isInteger(pgn) || pgn < 0 || pgn > 0x3FFFF) {
    return { valid: false, error: 'PGN 必须是 0 ~ 0x3FFFF 的整数。' };
  }
  if (!Number.isInteger(priority) || priority < 0 || priority > 7) {
    return { valid: false, error: '优先级 P 必须在 0 ~ 7。' };
  }
  if (!Number.isInteger(sourceAddress) || sourceAddress < 0 || sourceAddress > 255) {
    return { valid: false, error: '源地址 SA 必须在 0 ~ 255。' };
  }

  const RDP = pgn >> 16;
  const PF = (pgn >> 8) & 0xFF;
  const GE = pgn & 0xFF;
  const isPdu2 = PF >= 240;

  if (!isPdu2 && GE !== 0) {
    return {
      valid: false,
      error: '该 PGN 不可用: 当 PF < 240 时，GE 必须为 0。',
      RDP,
      PF,
      GE,
      isPdu2
    };
  }

  let PS;
  if (isPdu2) {
    PS = GE;
  } else {
    if (!Number.isInteger(destinationAddress) || destinationAddress < 0 || destinationAddress > 255) {
      return { valid: false, error: '目的地址 DA 必须在 0 ~ 255。' };
    }
    PS = destinationAddress;
  }

  const id = (priority << 26) | (RDP << 24) | (PF << 16) | (PS << 8) | sourceAddress;

  return {
    valid: true,
    id,
    RDP,
    PF,
    GE,
    PS,
    isPdu2,
    specialPgnName: SPECIAL_PGN_MAP[pgn] || ''
  };
}

export function getSpecialPgnName(pgn) {
  return SPECIAL_PGN_MAP[pgn] || '';
}
