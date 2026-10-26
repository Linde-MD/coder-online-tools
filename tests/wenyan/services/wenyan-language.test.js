import { describe, expect, it, vi } from 'vitest';
import {
  isWenyanKeyword,
  registerWenyanLanguage,
  setWenyanCompletionKeywords,
  WENYAN_LANGUAGE_ID,
} from '../../../src/features/wenyan/services/wenyan-language.js';

describe('wenyan language support', () => {
  it('registers a Monarch tokenizer, bracket configuration, and completions', () => {
    const registrations = {};
    const monaco = {
      languages: {
        CompletionItemKind: { Keyword: 17, Snippet: 27 },
        CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
        register: vi.fn(),
        setMonarchTokensProvider: vi.fn((id, provider) => {
          registrations.tokenizer = { id, provider };
        }),
        setLanguageConfiguration: vi.fn((id, configuration) => {
          registrations.configuration = { id, configuration };
        }),
        registerCompletionItemProvider: vi.fn((id, provider) => {
          registrations.completion = { id, provider };
        }),
      },
    };

    setWenyanCompletionKeywords(['示例关键字']);
    registerWenyanLanguage(monaco);

    expect(monaco.languages.register).toHaveBeenCalledWith({ id: WENYAN_LANGUAGE_ID });
    expect(registrations.tokenizer.id).toBe(WENYAN_LANGUAGE_ID);
    expect(registrations.tokenizer.provider.tokenizer.root).toContainEqual([/「「[^」\n]*」」/, 'string']);
    expect(registrations.configuration.configuration.autoClosingPairs).toHaveLength(2);

    const result = registrations.completion.provider.provideCompletionItems(
      { getWordUntilPosition: () => ({ startColumn: 1, endColumn: 1 }) },
      { lineNumber: 1 },
    );
    const labels = result.suggestions.map(item => item.label);
    expect(labels).toContain('示例关键字');
    expect(labels).toContain('定义术');
    expect(isWenyanKeyword('書之')).toBe(true);
  });
});
