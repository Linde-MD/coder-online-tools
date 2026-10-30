export function isMessageWorkspaceEntryValid(message) {
  const hasSender = Array.isArray(message?.senders) && message.senders.some(Boolean);
  const receivers = Array.isArray(message?.receivers) ? message.receivers : [];
  const hasValidReceivers = message?.receiverMode === 'broadcast'
    ? receivers.length === 0
    : receivers.some(Boolean);
  return hasSender && hasValidReceivers;
}

export function countInvalidMessageReceiverEntries(nodes) {
  let count = 0;
  for (const node of Array.isArray(nodes) ? nodes : []) {
    const workspace = node?.messageWorkspace;
    if (!workspace || typeof workspace !== 'object') continue;
    for (const store of Object.values(workspace)) {
      for (const pane of ['rxMessages', 'txMessages']) {
        const messages = Array.isArray(store?.[pane]) ? store[pane] : [];
        count += messages.filter((message) => !isMessageWorkspaceEntryValid(message)).length;
      }
    }
  }
  return count;
}
