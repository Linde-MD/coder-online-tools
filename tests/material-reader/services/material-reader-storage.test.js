import { describe, expect, it } from 'vitest';
import { getDirectoryPermission, listBookshelfResults } from '@/features/material-reader/services/material-reader-storage.js';

function createDirectory(entries) {
  return {
    kind: 'directory',
    async *entries() {
      for (const entry of entries) yield entry;
    },
  };
}

describe('material reader directory access', () => {
  it('lists supported files from each direct material folder in stable order', async () => {
    const firstBook = createDirectory([
      ['notes.md', { kind: 'file' }],
      ['learning.html', { kind: 'file' }],
      ['image.png', { kind: 'file' }],
    ]);
    const secondBook = createDirectory([
      ['summary.markdown', { kind: 'file' }],
    ]);
    const bookshelf = createDirectory([
      ['Z book', secondBook],
      ['A book', firstBook],
      ['cover.html', { kind: 'file' }],
    ]);

    const results = await listBookshelfResults(bookshelf);

    expect(results.map(({ name }) => name)).toEqual(['A book', 'Z book']);
    expect(results[0].files.map(({ name, type }) => [name, type])).toEqual([
      ['learning.html', 'html'],
      ['notes.md', 'markdown'],
    ]);
    expect(results[1].files[0].type).toBe('markdown');
  });

  it('uses read permission and allows requesting it from an explicit user action', async () => {
    const handle = {
      queryPermission: async (options) => (options.mode === 'read' ? 'prompt' : 'denied'),
      requestPermission: async (options) => (options.mode === 'read' ? 'granted' : 'denied'),
    };

    await expect(getDirectoryPermission(handle)).resolves.toBe('prompt');
    await expect(getDirectoryPermission(handle, true)).resolves.toBe('granted');
  });
});
