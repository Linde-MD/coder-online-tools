const _ = require('lodash');
const { addDelimiters } = require('../utils/formatter')


// const PFi = 210;
// const GEi = 0x00;
// const PGN = 0 || (PFi << 8 | GEi);
const PGN = 65043;
const SA = 131;
const P = 3;
const DA = 0x27;
console.log(' - - - - - PGN - - - - - ');
console.log(`10进制：${PGN.toString(10)}`);
console.log(`16进制：${PGN.toString(16)}`);

const RDP = PGN >> 16;
const PF = (PGN >> 8) & 0xFF;
const GE = PGN & 0xFF;
const PS = PF >= 240 ? GE : DA;

let id = (P << 26) | (RDP << 24) | (PF << 16) | (PS << 8) | SA;
console.log(' - - - - - id - - - - - ');
const binStr = addDelimiters(id.toString(2).padStart(32, '0'), '2');
console.log(`2进制：${binStr}`);
console.log(`16进制：${id.toString(16).padStart(8, '0').toUpperCase()}`);



