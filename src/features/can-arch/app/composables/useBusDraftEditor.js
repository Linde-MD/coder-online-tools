import { computed, reactive } from 'vue';

export function useBusDraftEditor({ firstSelectedBus }) {
  const busDraft = reactive({
    open: false,
    id: '',
    name: '',
    note: '',
    baud: 500,
    color: '',
    errors: [],
  });

  function resetBusDraftFromBus(bus, defaults) {
    busDraft.id = bus?.id ?? '';
    busDraft.name = bus?.name ?? defaults?.name ?? '';
    busDraft.note = bus?.note ?? '';
    busDraft.baud = bus?.baud ?? defaults?.baud ?? 500;
    busDraft.color = bus?.color ?? defaults?.color ?? '#1e88e5';
    busDraft.errors = [];
  }

  function applyBusDraftToBus(bus) {
    const errors = [];
    const name = String(busDraft.name || '').trim();
    if (!name) errors.push('CAN BUS 名称不能为空。');
    const baudParsed = Number.parseInt(String(busDraft.baud || '').trim(), 10);
    if (!Number.isInteger(baudParsed) || baudParsed <= 0) errors.push('波特率必须为正整数。');

    if (errors.length > 0) {
      busDraft.errors = errors;
      return false;
    }
    busDraft.errors = [];

    bus.name = name;
    bus.note = String(busDraft.note || '').trim();
    bus.baud = baudParsed;
    bus.color = busDraft.color;
    return true;
  }

  function openBusEditor(bus, defaults = {}) {
    resetBusDraftFromBus(bus, defaults);
    busDraft.open = true;
  }

  function closeBusEditor() {
    busDraft.open = false;
  }

  const isEditingExisting = computed(() => Boolean(busDraft.id));

  return {
    busDraft,
    resetBusDraftFromBus,
    applyBusDraftToBus,
    openBusEditor,
    closeBusEditor,
    isEditingExisting,
  };
}