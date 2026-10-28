export function validateSignalLayout(signal, message) {
  const dlc = message?.dlc;
  const totalBits = Number.isInteger(dlc) && dlc >= 0 && dlc <= 64 ? dlc * 8 : null;
  const result = {
    totalBits,
    bits: [],
    startBitError: '',
    lengthError: '',
    messageError: '',
  };
  const startBit = signal?.startBit;
  const length = signal?.length;

  if (!Number.isInteger(startBit) || startBit < 0) {
    result.startBitError = '起始位必须是非负整数。';
  }
  if (!Number.isInteger(length) || length < 1) {
    result.lengthError = '长度必须是大于 0 的整数。';
  }
  if (totalBits === null) {
    result.messageError = '报文 DLC 必须是 0-64 的整数（字节数）。';
    return result;
  }
  if (!result.startBitError && startBit >= totalBits) {
    result.startBitError = totalBits === 0
      ? '当前报文 DLC 为 0，没有可用位。'
      : `起始位超出范围：当前报文为 ${totalBits} bit，有效位编号为 0-${totalBits - 1}。`;
  }
  if (!result.lengthError && length > totalBits) {
    result.lengthError = `长度超出范围：当前报文最多容纳 ${totalBits} bit。`;
  }
  if (result.startBitError || result.lengthError) return result;

  let currentBit = startBit;
  for (let index = 0; index < length; index += 1) {
    result.bits.push(currentBit);
    currentBit = message.byteOrder === 'motorola' && currentBit % 8 === 7
      ? currentBit - 15
      : currentBit + 1;
  }
  if (result.bits.some((bit) => bit < 0 || bit >= totalBits)) {
    const byteOrder = message.byteOrder === 'motorola' ? 'Motorola' : 'Intel';
    result.lengthError = `Signal 位范围溢出：起始位 ${startBit}、长度 ${length} bit 按 ${byteOrder} 字节序超出 DLC=${dlc} 的可用范围（0-${totalBits - 1}）。`;
  }
  return result;
}