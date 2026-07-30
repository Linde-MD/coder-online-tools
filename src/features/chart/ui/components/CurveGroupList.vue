<template>
  <div>
    <div
      v-for="(group, groupIdx) in curveGroups"
      :key="group.id || `group-${groupIdx}`"
      class="curve-group-card"
      :class="{ 'curve-group-collapsed': isGroupCollapsed(groupIdx) }"
      :data-group-idx="groupIdx"
    >
      <div class="curve-group-head">
        <div
          class="curve-group-title curve-group-title-editable"
          contenteditable="true"
          spellcheck="false"
          tabindex="0"
          :data-group-idx="groupIdx"
          @input.stop="onGroupTitleInput(groupIdx, $event)"
          @blur.stop="onGroupTitleBlur(groupIdx, $event)"
        >{{ group.title || `曲线组 ${groupIdx + 1}` }}</div>
        <div class="d-flex flex-wrap gap-2">
          <button
            type="button"
            class="btn-toggle-group collapse-triangle-btn"
            :data-group-idx="groupIdx"
            aria-label="折叠曲线组"
            :aria-expanded="isGroupCollapsed(groupIdx) ? 'false' : 'true'"
            @click.stop="toggleGroupCollapsed(groupIdx)"
          ></button>
          <button
            type="button"
            class="btn btn-outline-danger btn-sm btn-del-group"
            :data-group-idx="groupIdx"
            :disabled="curveGroups.length === 1"
            @click.stop="onRemoveGroup(groupIdx)"
          >
            删除曲线组
          </button>
        </div>
      </div>

      <div class="curve-group-body">
        <div class="curve-group-meta mt-2">
          <div class="curve-group-fields curve-group-fields-main">
            <div class="group-field">
              <label class="form-label mb-1">X轴名称</label>
              <input
                type="text"
                class="form-control form-control-sm group-xname"
                :data-group-idx="groupIdx"
                :value="group.xName"
                placeholder="X"
                @input.stop="onGroupFieldInput(groupIdx, 'xName', $event.target.value)"
              >
            </div>
            <div class="group-field">
              <label class="form-label mb-1">X轴单位</label>
              <input
                type="text"
                class="form-control form-control-sm group-xunit"
                :data-group-idx="groupIdx"
                :value="group.xUnit"
                placeholder="单位"
                @input.stop="onGroupFieldInput(groupIdx, 'xUnit', $event.target.value)"
              >
            </div>
            <div class="group-field">
              <label class="form-label mb-1">Y轴名称</label>
              <input
                type="text"
                class="form-control form-control-sm group-yname"
                :data-group-idx="groupIdx"
                :value="group.yName"
                placeholder="Y"
                @input.stop="onGroupFieldInput(groupIdx, 'yName', $event.target.value)"
              >
            </div>
            <div class="group-field">
              <label class="form-label mb-1">Y轴单位</label>
              <input
                type="text"
                class="form-control form-control-sm group-yunit"
                :data-group-idx="groupIdx"
                :value="group.yUnit"
                placeholder="单位"
                @input.stop="onGroupFieldInput(groupIdx, 'yUnit', $event.target.value)"
              >
            </div>
          </div>

          <div class="curve-group-fields curve-group-fields-range mt-2">
            <div class="group-field">
              <label class="form-label mb-1">函数X最小</label>
              <input
                type="number"
                class="form-control form-control-sm group-xmin"
                :data-group-idx="groupIdx"
                :value="group.formulaXMin"
                @input.stop="onGroupFieldInput(groupIdx, 'formulaXMin', $event.target.value)"
              >
            </div>
            <div class="group-field">
              <label class="form-label mb-1">函数X最大</label>
              <input
                type="number"
                class="form-control form-control-sm group-xmax"
                :data-group-idx="groupIdx"
                :value="group.formulaXMax"
                @input.stop="onGroupFieldInput(groupIdx, 'formulaXMax', $event.target.value)"
              >
            </div>
          </div>
        </div>

        <div
          class="group-curves mt-3"
          :class="{ 'is-drag-over': dragOverGroupIdx === groupIdx }"
          :data-group-idx="groupIdx"
          @dragover.prevent.stop="onGroupDragOver(groupIdx)"
          @dragleave.stop="onGroupDragLeave(groupIdx, $event)"
          @drop.prevent.stop="onGroupDrop(groupIdx, $event)"
        >
          <div
            v-for="(curve, curveIdx) in group.curves"
            :key="curve.id || `curve-${groupIdx}-${curveIdx}`"
            class="curve-item-card"
            :class="{
              'curve-item-collapsed': isCurveCollapsed(groupIdx, curveIdx),
              'is-dragging': draggingCurveKey === curveKey(groupIdx, curveIdx),
              'is-formula-mode': curve.dataMode === 'formula'
            }"
            :style="{ borderLeftColor: resolveCurveAccentColorByKey(groupIdx, curveIdx, curve) }"
            :data-group-idx="groupIdx"
            :data-curve-idx="curveIdx"
            @contextmenu.prevent.stop="onCurveContextMenu(groupIdx, curveIdx, $event)"
          >
            <div class="curve-item-head">
              <span
                class="curve-drag-handle"
                draggable="true"
                title="拖拽到其他曲线组"
                @dragstart.stop="onCurveDragStart(groupIdx, curveIdx, $event)"
                @dragend.stop="onCurveDragEnd"
              >::</span>
              <span class="curve-item-title">Curve ID: {{ curveIdx + 1 }}</span>
              <span class="curve-alias-label">alias</span>
              <input
                type="text"
                class="form-control form-control-sm curve-alias"
                :data-group-idx="groupIdx"
                :data-curve-idx="curveIdx"
                :value="normalizeAlias(curve, curveIdx)"
                placeholder="如 tempA"
                @input.stop="onCurveAliasInput(groupIdx, curveIdx, $event)"
                @blur.stop="onCurveAliasBlur(groupIdx, curveIdx, $event)"
              >
              <button
                type="button"
                class="btn-toggle-curve collapse-triangle-btn"
                :data-group-idx="groupIdx"
                :data-curve-idx="curveIdx"
                aria-label="折叠曲线"
                :aria-expanded="isCurveCollapsed(groupIdx, curveIdx) ? 'false' : 'true'"
                @click.stop="toggleCurveCollapsed(groupIdx, curveIdx)"
              ></button>
            </div>
            <div class="curve-item-body mt-1">
              <div class="curve-item-toolbar">
                <input
                  type="text"
                  class="form-control form-control-sm curve-label"
                  :data-group-idx="groupIdx"
                  :data-curve-idx="curveIdx"
                  :value="curve.text"
                  placeholder="曲线名称"
                  @input.stop="handleCurveFieldInput(groupIdx, curveIdx, 'text', $event.target.value)"
                >
                <select
                  class="form-select form-select-sm curve-data-mode"
                  :data-group-idx="groupIdx"
                  :data-curve-idx="curveIdx"
                  :value="curve.dataMode"
                  @change.stop="onCurveModeChange(groupIdx, curveIdx, $event.target.value)"
                >
                  <option value="points">插值点</option>
                  <option value="formula">函数</option>
                </select>
                <input
                  type="color"
                  class="form-control form-control-color curve-color"
                  :data-group-idx="groupIdx"
                  :data-curve-idx="curveIdx"
                  :value="curve.color"
                  title="曲线颜色"
                  @input.stop="handleCurveFieldInput(groupIdx, curveIdx, 'color', $event.target.value)"
                >
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm btn-edit-curve-formula"
                  :data-group-idx="groupIdx"
                  :data-curve-idx="curveIdx"
                  :disabled="curve.dataMode !== 'formula'"
                  @click.stop="onOpenFormulaEditor(groupIdx, curveIdx)"
                >
                  编辑函数
                </button>
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm btn-curve-formula-help"
                  :data-group-idx="groupIdx"
                  :data-curve-idx="curveIdx"
                  title="帮助"
                  @click.stop="onShowCurveHelp(groupIdx, curveIdx)"
                >
                  ?
                </button>
                <button
                  type="button"
                  class="btn btn-outline-danger btn-sm btn-del-curve"
                  :data-group-idx="groupIdx"
                  :data-curve-idx="curveIdx"
                  @click.stop="onRemoveCurve(groupIdx, curveIdx)"
                >
                  删除曲线
                </button>
              </div>
              <div v-if="curve.dataMode !== 'formula'" class="curve-item-points">
                <textarea
                  class="form-control form-control-sm curve-points"
                  style="min-height:72px;resize:vertical;"
                  :data-group-idx="groupIdx"
                  :data-curve-idx="curveIdx"
                  :value="curve.points"
                  @input.stop="handleCurveFieldInput(groupIdx, curveIdx, 'points', $event.target.value)"
                ></textarea>
              </div>
              <div v-else class="curve-formula-hint">
                当前为函数模式，插值点输入已隐藏。请使用“编辑函数”维护曲线表达式。
              </div>
            </div>
          </div>
        </div>

        <div class="mt-2">
          <button
            type="button"
            class="btn btn-outline-primary btn-sm btn-add-curve-in-group"
            :data-group-idx="groupIdx"
            @click.stop="onAddCurve(groupIdx)"
          >
            + 添加曲线
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  curveGroups: {
    type: Array,
    required: true,
  },
  buildDefaultCurveAlias: {
    type: Function,
    required: true,
  },
  onAddCurve: {
    type: Function,
    default: null,
  },
  onRemoveCurve: {
    type: Function,
    default: null,
  },
  onRemoveGroup: {
    type: Function,
    default: null,
  },
  onGroupFieldInput: {
    type: Function,
    default: null,
  },
  onCurveFieldInput: {
    type: Function,
    default: null,
  },
  onCurveModeChange: {
    type: Function,
    default: null,
  },
  onCurveAliasInput: {
    type: Function,
    default: null,
  },
  onCurveAliasBlur: {
    type: Function,
    default: null,
  },
  onOpenFormulaEditor: {
    type: Function,
    default: null,
  },
  onShowCurveHelp: {
    type: Function,
    default: null,
  },
  onCurveContextMenu: {
    type: Function,
    default: null,
  },
  onMoveCurveToGroup: {
    type: Function,
    default: null,
  },
});

const collapsedGroups = ref({});
const collapsedCurves = ref({});
const dragOverGroupIdx = ref(-1);
const draggingCurveKey = ref('');
const curveAccentColors = ref({});

function curveKey(groupIdx, curveIdx) {
  return `${groupIdx}-${curveIdx}`;
}

function normalizeAlias(curve, curveIdx) {
  const alias = String(curve?.alias || '').trim();
  return alias || props.buildDefaultCurveAlias(curveIdx);
}

function resolveCurveAccentColor(curve) {
  const color = String(curve?.color || '').trim();
  return color || 'var(--color-primary)';
}

function resolveCurveAccentColorByKey(groupIdx, curveIdx, curve) {
  const key = curveKey(groupIdx, curveIdx);
  const localColor = String(curveAccentColors.value[key] || '').trim();
  if (localColor) return localColor;
  return resolveCurveAccentColor(curve);
}

function handleCurveFieldInput(groupIdx, curveIdx, field, value) {
  if (field === 'color') {
    const key = curveKey(groupIdx, curveIdx);
    curveAccentColors.value = {
      ...curveAccentColors.value,
      [key]: value,
    };
  }
  props.onCurveFieldInput?.(groupIdx, curveIdx, field, value);
}

function toggleGroupCollapsed(groupIdx) {
  const next = { ...collapsedGroups.value };
  next[groupIdx] = !next[groupIdx];
  collapsedGroups.value = next;
}

function toggleCurveCollapsed(groupIdx, curveIdx) {
  const key = curveKey(groupIdx, curveIdx);
  const next = { ...collapsedCurves.value };
  next[key] = !next[key];
  collapsedCurves.value = next;
}

function isGroupCollapsed(groupIdx) {
  return Boolean(collapsedGroups.value[groupIdx]);
}

function isCurveCollapsed(groupIdx, curveIdx) {
  return Boolean(collapsedCurves.value[curveKey(groupIdx, curveIdx)]);
}

function onGroupTitleInput(groupIdx, event) {
  props.onGroupFieldInput?.(groupIdx, 'title', event.target.textContent || '');
}

function onGroupTitleBlur(groupIdx, event) {
  const result = props.onGroupFieldInput?.(groupIdx, 'titleBlur', event.target.textContent || '');
  if (result && typeof result === 'string') {
    event.target.textContent = result;
  }
}

function onCurveAliasInput(groupIdx, curveIdx, event) {
  const error = props.onCurveAliasInput?.(groupIdx, curveIdx, event.target.value);
  event.target.setCustomValidity(error || '');
}

function onCurveAliasBlur(groupIdx, curveIdx, event) {
  const result = props.onCurveAliasBlur?.(groupIdx, curveIdx, event.target.value) || {};
  if (typeof result.value === 'string') {
    event.target.value = result.value;
  }
  event.target.setCustomValidity(result.error || '');
  event.target.reportValidity();
}

function onCurveDragStart(groupIdx, curveIdx, event) {
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', `${groupIdx}:${curveIdx}`);
  draggingCurveKey.value = curveKey(groupIdx, curveIdx);
}

function onCurveDragEnd() {
  draggingCurveKey.value = '';
  dragOverGroupIdx.value = -1;
}

function onGroupDragOver(groupIdx) {
  dragOverGroupIdx.value = groupIdx;
}

function onGroupDragLeave(groupIdx, event) {
  const currentTarget = event.currentTarget;
  if (currentTarget && currentTarget.contains(event.relatedTarget)) {
    return;
  }
  if (dragOverGroupIdx.value === groupIdx) {
    dragOverGroupIdx.value = -1;
  }
}

function onGroupDrop(groupIdx, event) {
  dragOverGroupIdx.value = -1;
  const transfer = event.dataTransfer.getData('text/plain');
  const [fromGroupText, fromCurveText] = String(transfer || '').split(':');
  const fromGroupIdx = Number(fromGroupText);
  const fromCurveIdx = Number(fromCurveText);
  if (!Number.isFinite(fromGroupIdx) || !Number.isFinite(fromCurveIdx)) return;
  props.onMoveCurveToGroup?.(fromGroupIdx, fromCurveIdx, groupIdx);
}

function onCurveContextMenu(groupIdx, curveIdx, event) {
  props.onCurveContextMenu?.(groupIdx, curveIdx, event.clientX, event.clientY);
}
</script>
