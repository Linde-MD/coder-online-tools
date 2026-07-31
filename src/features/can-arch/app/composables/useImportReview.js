import { computed } from 'vue';
import { DEFAULT_NODE_BASE_COLOR } from '@/features/can-arch/domain/can-arch-constants.js';

function trimName(value) {
  return String(value || '').trim();
}

export function useImportReview({
  importCandidates,
  importReviewState,
  nodes,
  importModalOpen,
  importStage,
}) {
  const newImportCandidates = computed(() => {
    return importCandidates.value.filter((candidate) => !candidate.conflict);
  });

  const conflictImportCandidates = computed(() => {
    return importCandidates.value.filter((candidate) => candidate.conflict);
  });

  const importSelectedCount = computed(() => {
    return importCandidates.value.reduce((count, candidate) => (candidate.selected ? count + 1 : count), 0);
  });

  const existingNodeNameOptions = computed(() => {
    return nodes.value.map((node) => node.name).filter((name) => trimName(name));
  });

  function resolveCandidateMergeNodeName(candidate) {
    const requested = trimName(candidate?.mergeNodeName);
    if (requested) return requested;
    return trimName(existingNodeNameOptions.value[0] || '');
  }

  function setImportCandidateResolveMode(candidate, mode) {
    if (!candidate) return;
    if (mode === 'merge') {
      candidate.resolveMode = 'merge';
      if (candidate.conflict) {
        candidate.mergeNodeName = candidate.name;
        return;
      }
      candidate.mergeNodeName = resolveCandidateMergeNodeName(candidate);
      return;
    }
    candidate.resolveMode = 'create';
  }

  function toggleImportCandidateGroup(groupKey) {
    if (groupKey === 'new') {
      importReviewState.newExpanded = !importReviewState.newExpanded;
      return;
    }
    importReviewState.conflictExpanded = !importReviewState.conflictExpanded;
  }

  function selectAllImportCandidates() {
    for (const candidate of importCandidates.value) {
      candidate.selected = true;
    }
  }

  function clearAllImportCandidates() {
    for (const candidate of importCandidates.value) {
      candidate.selected = false;
    }
  }

  function handleImportModalKeydown(event) {
    if (!importModalOpen.value || importStage.value !== 'review') return;
    if (!event.altKey) return;
    const key = String(event.key || '').toLowerCase();
    if (key === 'a') {
      event.preventDefault();
      selectAllImportCandidates();
      return;
    }
    if (key === 'q') {
      event.preventDefault();
      clearAllImportCandidates();
    }
  }

  function buildImportCandidatesFromParsed(parsedNodes) {
    const existingNames = new Set(nodes.value.map((node) => node.name));
    const firstExistingNodeName = trimName(nodes.value[0]?.name);
    return (Array.isArray(parsedNodes) ? parsedNodes : []).map((node, idx) => {
      const conflict = existingNames.has(node.name);
      return {
        id: `import-${idx}-${node.name}`,
        name: node.name,
        protocols: node.protocols || [],
        j1939Addresses: node.j1939Addresses || [],
        canopenNodeIds: node.canopenNodeIds || [],
        baseColor: DEFAULT_NODE_BASE_COLOR,
        conflict,
        resolveMode: conflict ? 'merge' : 'create',
        mergeNodeName: conflict ? node.name : firstExistingNodeName,
        rename: conflict ? `${node.name}_import` : node.name,
        selected: true,
      };
    });
  }

  return {
    newImportCandidates,
    conflictImportCandidates,
    importSelectedCount,
    existingNodeNameOptions,
    resolveCandidateMergeNodeName,
    setImportCandidateResolveMode,
    toggleImportCandidateGroup,
    selectAllImportCandidates,
    clearAllImportCandidates,
    handleImportModalKeydown,
    buildImportCandidatesFromParsed,
  };
}
