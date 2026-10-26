import { appDatabase } from '@/shared/utils/app-storage';

const BOOKSHELF_HANDLE_KEY = 'coderOnlineTools.materialReader.bookshelf.v1';

async function saveBookshelfHandle(handle) {
  await appDatabase.table('directoryHandles').put({
    key: BOOKSHELF_HANDLE_KEY,
    handle,
  });
}

async function readBookshelfHandle() {
  const record = await appDatabase.table('directoryHandles').get(BOOKSHELF_HANDLE_KEY);
  return record?.handle;
}

async function getDirectoryPermission(handle, request = false) {
  const permissionOptions = { mode: 'read' };
  if (request && typeof handle.requestPermission === 'function') {
    return handle.requestPermission(permissionOptions);
  }
  if (typeof handle.queryPermission === 'function') {
    return handle.queryPermission(permissionOptions);
  }
  return 'granted';
}

async function listBookshelfResults(bookshelfHandle) {
  const results = [];
  for await (const [name, handle] of bookshelfHandle.entries()) {
    if (handle.kind !== 'directory') continue;

    const files = [];
    for await (const [fileName, fileHandle] of handle.entries()) {
      if (fileHandle.kind !== 'file') continue;
      const extension = fileName.split('.').pop()?.toLowerCase();
      if (!['html', 'htm', 'md', 'markdown'].includes(extension)) continue;
      files.push({
        name: fileName,
        type: ['md', 'markdown'].includes(extension) ? 'markdown' : 'html',
        handle: fileHandle,
      });
    }

    files.sort((left, right) => {
      if (left.type !== right.type) return left.type === 'html' ? -1 : 1;
      return left.name.localeCompare(right.name, 'zh-CN');
    });
    results.push({ name, handle, files });
  }

  return results.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

async function readMaterialFile(fileHandle) {
  const file = await fileHandle.getFile();
  return {
    name: file.name,
    content: await file.text(),
    lastModified: file.lastModified,
  };
}

export {
  getDirectoryPermission,
  listBookshelfResults,
  readBookshelfHandle,
  readMaterialFile,
  saveBookshelfHandle,
};
