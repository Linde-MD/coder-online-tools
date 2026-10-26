export const WENYAN_LANGUAGE_ID = 'wenyan';

const KEYWORDS = [
  '乃行是術曰', '若其不然者', '不知何禍歟', '欲行是術', '乃止是遍',
  '若其然者', '其物如是', '所餘幾何', '乃歸空無', '名之曰', '乃得矣',
  '之術也', '必先得', '是術曰', '恆為是', '之物也', '不等於', '不大於',
  '不小於', '吾嘗觀', '乃作罷', '吾有', '今有', '物之', '書之', '以施',
  '昔之', '是矣', '乃得', '是謂', '云云', '中之', '為是', '乃止', '若非',
  '或若', '等於', '大於', '小於', '之長', '其餘', '之書', '方悟', '之義',
  '嗚呼', '或云', '蓋謂', '注曰', '疏曰', '批曰', '有', '數', '列', '言',
  '術', '爻', '物', '元', '施', '曰', '噫', '取', '今', '其', '也', '凡',
  '遍', '若', '者', '夫', '加', '減', '乘', '除', '變', '以', '於', '之',
  '充', '銜', '陰', '陽', '中', '豈',
];

const KEYWORD_SET = new Set(KEYWORDS);
const KEYWORD_PATTERN = KEYWORDS
  .slice()
  .sort((left, right) => right.length - left.length)
  .map(keyword => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

const COMPLETION_SNIPPETS = [
  {
    label: '吾有一數',
    insertText: '吾有一數。曰\${1:三}。名之曰「\${2:甲}」。',
    detail: '声明并命名数字',
  },
  {
    label: '吾有一言',
    insertText: '吾有一言。曰「「\${1:天地玄黃}」」。名之曰「\${2:詞}」。',
    detail: '声明并命名字符串',
  },
  {
    label: '若条件',
    insertText: '若「\${1:甲}」等於「\${2:乙}」者。\n\t\${3:書之。}\n乃止也。',
    detail: '条件分支',
  },
  {
    label: '定义术',
    insertText: '吾有一術。名之曰「\${1:術名}」。欲行是術。必先得一數。曰「\${2:甲}」。\n乃行是術曰。\n\t\${3:乃得「甲」。}\n是謂「\${1:術名}」之術也。',
    detail: '定义并返回结果',
  },
];

const KEYWORD_DETAILS = new Map([
  ['吾有', '声明变量'],
  ['名之曰', '命名变量'],
  ['曰', '赋值或提供内容'],
  ['書之', '输出表达式'],
  ['若', '条件判断'],
  ['凡', '遍历循环'],
  ['恆為是', '恒为真循环'],
  ['施', '调用术'],
  ['乃得', '返回结果'],
  ['是謂', '结束术定义'],
  ['云云', '结束语句块'],
  ['加', '加法'],
  ['減', '减法'],
  ['乘', '乘法'],
  ['除', '除法'],
  ['等於', '相等比较'],
  ['大於', '大于比较'],
  ['小於', '小于比较'],
]);

let registered = false;
let availableKeywords = KEYWORDS;

export function setWenyanCompletionKeywords(keywords) {
  if (!Array.isArray(keywords)) return;
  availableKeywords = [...new Set([...KEYWORDS, ...keywords.filter(word => typeof word === 'string')])]
    .sort((left, right) => right.length - left.length);
}

export function registerWenyanLanguage(monaco) {
  if (registered) return;
  registered = true;

  monaco.languages.register({ id: WENYAN_LANGUAGE_ID });
  monaco.languages.setMonarchTokensProvider(WENYAN_LANGUAGE_ID, {
    defaultToken: 'identifier',
    tokenizer: {
      root: [
        [/「「[^」\n]*」」/, 'string'],
        [/「[^」\n]*」/, 'variable'],
        [new RegExp(KEYWORD_PATTERN), 'keyword'],
        [/[零〇一二三四五六七八九十百千万億亿兆廿卅兩两]+|\d+/, 'number'],
        [/[。．，、；：！？]/, 'delimiter'],
        [/[ \t\r\n]+/, 'white'],
        [/./, 'identifier'],
      ],
    },
  });
  monaco.languages.setLanguageConfiguration(WENYAN_LANGUAGE_ID, {
    brackets: [['「', '」'], ['「「', '」」']],
    autoClosingPairs: [
      { open: '「', close: '」' },
      { open: '「「', close: '」」' },
    ],
    surroundingPairs: [
      { open: '「', close: '」' },
      { open: '「「', close: '」」' },
    ],
  });
  monaco.languages.registerCompletionItemProvider(WENYAN_LANGUAGE_ID, {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const suggestions = availableKeywords.map((keyword, index) => ({
        label: keyword,
        kind: monaco.languages.CompletionItemKind.Keyword,
        detail: KEYWORD_DETAILS.get(keyword) || '文言关键字',
        insertText: keyword,
        filterText: keyword,
        sortText: `0${String(index).padStart(3, '0')}`,
        range,
      }));
      const snippets = COMPLETION_SNIPPETS.map((snippet, index) => ({
        label: snippet.label,
        kind: monaco.languages.CompletionItemKind.Snippet,
        detail: snippet.detail,
        insertText: snippet.insertText,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        sortText: `1${String(index).padStart(3, '0')}`,
        range,
      }));

      return { suggestions: [...snippets, ...suggestions] };
    },
  });
}

export function isWenyanKeyword(value) {
  return KEYWORD_SET.has(value);
}
