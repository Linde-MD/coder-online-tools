const _ = require('lodash');

function addDelimiters(numStr, type = '2', delimiter = ' ', specifiedIntervalNum) {
    const defaultIntervalNum = {
        '2': 8,
    }

    const intervalNum = specifiedIntervalNum || defaultIntervalNum[type] || 4;
    if (!delimiter) {
        return numStr;
    }

    const reversedStr = _.reverse(_.split(numStr, '')); // 反转字符串，从右向左处理
    const chunks = _.chunk(reversedStr, intervalNum);
    const strSegments = _.map(chunks, chunk => _.reverse(chunk).join('')); // 将每个数组元素反转回来并转换为字符串
    const result = _.reverse(strSegments).join(delimiter);
    return result;
}

module.exports = {
    addDelimiters,
}