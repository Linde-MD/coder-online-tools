import { reactive, ref } from 'vue';

function cloneMessage(message) {
  const cloned = structuredClone(message);
  cloned.id = crypto.randomUUID();
  cloned.name = `${cloned.name}_copy`;
  cloned.signals = (cloned.signals || []).map((signal) => ({ ...signal, id: crypto.randomUUID() }));
  return cloned;
}

export function useEcuMessageCommands({
  activeTab,
  rxMessages,
  txMessages,
  getRowsByPane,
  selectedPane,
  selectedKeys,
  clearSelection,
  ensureSelected,
  addMessage,
  addSignalToMessage,
}) {
  const clipboard = ref(null);
  const contextMenu = reactive({
    open: false,
    x: 0,
    y: 0,
    target: 'pane',
    pane: 'rx',
    messageId: '',
  });

  function closeContextMenu() {
    contextMenu.open = false;
  }

  function openPaneContextMenu(pane, event) {
    selectedPane.value = pane;
    contextMenu.open = true;
    contextMenu.x = event.clientX;
    contextMenu.y = event.clientY;
    contextMenu.target = 'pane';
    contextMenu.pane = pane;
    contextMenu.messageId = '';
  }

  function openRowContextMenu(row, pane, event) {
    ensureSelected(row, pane);
    contextMenu.open = true;
    contextMenu.x = event.clientX;
    contextMenu.y = event.clientY;
    contextMenu.target = row.type;
    contextMenu.pane = pane;
    contextMenu.messageId = row.message.id;
  }

  function addMessageAtPane(pane) {
    closeContextMenu();
    addMessage(pane);
    selectedPane.value = pane;
  }

  function addSignalToMessageAtPane(pane, message) {
    const signal = addSignalToMessage(message);
    if (!signal) return;
    selectedPane.value = pane;
    selectedKeys.value = [`${pane}|s|${message.id}|${signal.id}`];
  }

  function addSignalToContextMessage() {
    closeContextMenu();
    const pane = contextMenu.pane;
    const rows = getRowsByPane(pane);
    const row = rows.find((item) => item.message.id === contextMenu.messageId);
    if (!row) return;
    addSignalToMessageAtPane(pane, row.message);
  }

  function removeSelectedFromList(rows, list) {
    const messageDeleteIds = new Set();
    const signalDeleteMap = new Map();
    for (const key of selectedKeys.value) {
      const row = rows.find((item) => item.key === key);
      if (!row) continue;
      if (row.type === 'message') {
        messageDeleteIds.add(row.message.id);
        continue;
      }
      if (!signalDeleteMap.has(row.message.id)) {
        signalDeleteMap.set(row.message.id, new Set());
      }
      signalDeleteMap.get(row.message.id).add(row.signal.id);
    }

    for (let i = list.length - 1; i >= 0; i -= 1) {
      const message = list[i];
      if (messageDeleteIds.has(message.id)) {
        list.splice(i, 1);
        continue;
      }
      const signalIds = signalDeleteMap.get(message.id);
      if (!signalIds) continue;
      message.signals = message.signals.filter((signal) => !signalIds.has(signal.id));
    }
  }

  function deleteSelection() {
    closeContextMenu();
    const pane = selectedPane.value;
    const rows = getRowsByPane(pane);
    const list = pane === 'rx' ? rxMessages.value : txMessages.value;
    removeSelectedFromList(rows, list);
    clearSelection();
  }

  function copySelection() {
    const pane = selectedPane.value;
    const rows = getRowsByPane(pane);
    const selectedRows = rows.filter((row) => selectedKeys.value.includes(row.key));
    clipboard.value = {
      pane,
      items: selectedRows.map((row) => ({
        type: row.type,
        message: structuredClone(row.message),
        signal: row.signal ? structuredClone(row.signal) : null,
        messageId: row.message.id,
      })),
    };
    closeContextMenu();
  }

  function cutSelection() {
    copySelection();
    deleteSelection();
  }

  function pasteAt(pane = selectedPane.value) {
    closeContextMenu();
    if (!clipboard.value || !activeTab.value) return;
    const targetList = pane === 'rx' ? rxMessages.value : txMessages.value;
    const messageItems = clipboard.value.items.filter((item) => item.type === 'message');
    for (const item of messageItems) {
      targetList.push(cloneMessage(item.message));
    }

    const signalItems = clipboard.value.items.filter((item) => item.type === 'signal');
    if (signalItems.length > 0) {
      const rows = getRowsByPane(pane);
      const selectedMessage = rows.find((row) => selectedKeys.value.includes(row.key) && row.type === 'message');
      const targetMessage = selectedMessage?.message || targetList[0];
      if (targetMessage) {
        for (const item of signalItems) {
          const cloned = structuredClone(item.signal);
          cloned.id = crypto.randomUUID();
          cloned.name = `${cloned.name}_copy`;
          targetMessage.signals.push(cloned);
        }
      }
    }
  }

  return {
    contextMenu,
    closeContextMenu,
    openPaneContextMenu,
    openRowContextMenu,
    addMessageAtPane,
    addSignalToContextMessage,
    deleteSelection,
    copySelection,
    cutSelection,
    pasteAt,
  };
}
