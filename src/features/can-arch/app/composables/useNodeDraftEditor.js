import { computed, reactive } from 'vue';
import { validateCanNodeDraft } from '../services/can-arch-dbc.js';

export function useNodeDraftEditor({ firstSelectedNode, onAfterPersist = null }) {
  const nodeDraft = reactive({
    open: false,
    id: '',
    name: '',
    note: '',
    baseColor: '',
    protocols: [],
    j1939AddressesInput: '',
    canopenNodeIdsInput: '',
    genericFrameFormat: 'standard',
    errors: [],
    warnings: [],
  });

  function resetDraftFromNode(node, defaults) {
    nodeDraft.id = node?.id ?? '';
    nodeDraft.name = node?.name ?? defaults?.name ?? '';
    nodeDraft.note = node?.note ?? '';
    nodeDraft.baseColor = node?.baseColor ?? defaults?.baseColor ?? '#d85f3f';
    nodeDraft.protocols = Array.isArray(node?.protocols) ? [...node.protocols] : [];
    nodeDraft.j1939AddressesInput = Array.isArray(node?.j1939Addresses) ? node.j1939Addresses.join(', ') : '';
    nodeDraft.canopenNodeIdsInput = Array.isArray(node?.canopenNodeIds) ? node.canopenNodeIds.join(', ') : '';
    nodeDraft.genericFrameFormat = node?.genericFrameFormat ?? 'standard';
    nodeDraft.errors = [];
    nodeDraft.warnings = [];
  }

  function applyDraftToNode(node) {
    const result = validateCanNodeDraft(nodeDraft);
    if (result.errors.length > 0) {
      nodeDraft.errors = result.errors;
      nodeDraft.warnings = result.warnings;
      return false;
    }
    nodeDraft.errors = [];
    nodeDraft.warnings = result.warnings;

    node.name = result.normalized.name;
    node.note = result.normalized.note;
    node.protocols = result.normalized.protocols;
    node.j1939Addresses = result.normalized.j1939Addresses;
    node.canopenNodeIds = result.normalized.canopenNodeIds;
    node.genericFrameFormat = result.normalized.genericFrameFormat;
    node.baseColor = nodeDraft.baseColor;
    node.updatedAt = new Date().toISOString();
    onAfterPersist?.(node);
    return true;
  }

  function openNodeEditor(node, defaults = {}) {
    resetDraftFromNode(node, defaults);
    nodeDraft.open = true;
  }

  function closeNodeEditor() {
    nodeDraft.open = false;
  }

  const isEditingExisting = computed(() => Boolean(nodeDraft.id));
  const hasErrors = computed(() => nodeDraft.errors.length > 0);

  return {
    nodeDraft,
    resetDraftFromNode,
    applyDraftToNode,
    openNodeEditor,
    closeNodeEditor,
    isEditingExisting,
    hasErrors,
  };
}