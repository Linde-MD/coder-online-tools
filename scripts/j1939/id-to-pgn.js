const _ = require('lodash');
const { addDelimiters } = require('../utils/formatter')


let idArr = [
  0x1801EFF3,
  0x18E1F3EF
];
if (_.isEmpty(idArr)) {
  console.log('The ID list is empty.');
  return;
}

_.forEach(idArr, (id, index) => {
  console.log(` * * * * * * * * * id ${index + 1} * * * * * * * * *`);
  const binStr = addDelimiters(id.toString(2), '2');
  console.log(`2进制：${binStr}`);
  console.log(`10进制：${id.toString(10)}`);
  console.log(`16进制：0x${id.toString(16)}`);

  const SA = id & 0xFF;
  const PS = (id >> 8) & 0xFF;
  const PF = (id >> 16) & 0xFF;
  const DP = (id >> 24) & 0x01;
  const RDP = (id >> 24) & 0x03;
  const P = (id >> 26) & 0x07
  console.log(`- Source Address: 0x${SA.toString(16)}(HEX) ${SA}(DEC)`);
  console.log(`- Priority: ${P}`);


  const GE = PF >= 240 ? PS : 0;
  const DA = PF < 240 ? `${PS}(DEC), 0x${PS.toString(16)}(HEX)` : 'broadcast';
  const PGN = (RDP << 16) | (PF << 8) | GE;

  console.log(`- PGN: ${PGN.toString(10)}(DEC), 0x${PGN.toString(16)}(HEX)`);
  console.log(`  · PF: ${PF}`);
  console.log(`  · GE: ${GE}(DEC), 0x${GE.toString(16)}(HEX)`);
  console.log(`  · Destination Address: ${DA}`);
  console.log(`  · Data Page: ${DP}`);
  console.log('\n');
});


/**
 * PGN 分类：
 * 59904 请求报文
 * 59392 响应报文
 * 60928 地址声明报文
 * 60416 多包报文请求/响应/结束...
 * 60160 多包报文数据报文
 * 65266 DM1
 */
