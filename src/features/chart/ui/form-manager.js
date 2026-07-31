import {
  addCurveToGroup,
  addGroup,
  createDefaultCurveModel,
  createDefaultGroupModel,
  moveCurveBetweenGroups,
  normalizeCurveGroups,
  removeCurveFromGroup,
  removeGroup,
} from '@/features/chart/services';
import {
  buildDefaultCurveAlias,
  buildDefaultFunctionSource,
  parseSingleFormulaFunction,
  validateGroupCurveAliases,
  validateGroupFormulaDependencies,
  validateFormulaFunctionRuntime,
} from '../../../shared/config/formula-storage.js';
import { createCurveContextMenu } from '@/features/chart/services/curve-context-menu.js';
import { buildCurveHelpMessage } from '@/features/chart/services/curve-help.js';
import { buildFormulaEditorTitle, validateFormulaDraft } from '@/features/chart/services/formula-validation.js';
import { useFormulaEditorBridge } from '@/features/chart/ui/composables/use-formula-editor-bridge.js';
import {
  bindChartActionButtons,
} from '@/features/chart/ui/services/chart-settings-controller.js';
import { createChartUiAdapter } from '@/features/chart/ui/services/chart-ui-adapter.js';
import CurveGroupList from '@/features/chart/ui/components/CurveGroupList.vue';

export function initForm(chartConfig, curveGroups, triggerRedraw, options = {}) {
  let curveListApp = null;
  const uiAdapter = createChartUiAdapter(options.uiAdapter || {});
  const uidPrefix = `${Date.now()}`;
  let uidSeed = 0;

  function nextId(type) {
    uidSeed += 1;
    return `${type}-${uidPrefix}-${uidSeed}`;
  }

  const createDefaultCurve = (index = 0) => createDefaultCurveModel(index, {
    nextId,
    buildDefaultCurveAlias,
    buildDefaultFunctionSource,
  });

  const createDefaultGroup = (index = 0) => createDefaultGroupModel(index, {
    nextId,
    chartConfig,
    createDefaultCurve,
  });

  normalizeCurveGroups(curveGroups, {
    chartConfig,
    nextId,
    createDefaultGroup,
    createDefaultCurve,
    buildDefaultCurveAlias,
    buildDefaultFunctionSource,
  });

  const curveContextMenu = createCurveContextMenu({
    curveGroups,
    onMoveCurveToGroup: (fromGroupIdx, fromCurveIdx, targetGroupIdx) => {
      moveCurveToGroup(fromGroupIdx, fromCurveIdx, targetGroupIdx);
    },
  });

  function moveCurveToGroup(fromGroupIdx, fromCurveIdx, targetGroupIdx) {
    const moved = moveCurveBetweenGroups(
      curveGroups,
      fromGroupIdx,
      fromCurveIdx,
      targetGroupIdx,
      createDefaultCurve,
    );
    if (!moved) return;

    renderCurveGroups();
    triggerRedraw();
  }

  function handleGroupFieldInput(groupIdx, field, value) {
    if (!Number.isFinite(groupIdx) || !curveGroups[groupIdx]) return null;
    const group = curveGroups[groupIdx];

    if (field === 'title') {
      group.title = String(value || '').trim() || `曲线组 ${groupIdx + 1}`;
      triggerRedraw();
      return null;
    }

    if (field === 'titleBlur') {
      const nextTitle = String(value || '').trim() || `曲线组 ${groupIdx + 1}`;
      group.title = nextTitle;
      triggerRedraw();
      return nextTitle;
    }

    if (field === 'xName') group.xName = value;
    if (field === 'xUnit') group.xUnit = value;
    if (field === 'yName') group.yName = value;
    if (field === 'yUnit') group.yUnit = value;
    if (field === 'formulaXMin') group.formulaXMin = value;
    if (field === 'formulaXMax') group.formulaXMax = value;

    triggerRedraw();
    return null;
  }

  function handleCurveFieldInput(groupIdx, curveIdx, field, value) {
    if (!Number.isFinite(groupIdx) || !Number.isFinite(curveIdx)) return;
    const group = curveGroups[groupIdx];
    const curve = group?.curves?.[curveIdx];
    if (!curve) return;

    if (field === 'text') curve.text = value;
    if (field === 'points') curve.points = value;
    if (field === 'color') curve.color = value;

    triggerRedraw();
  }

  function handleCurveAliasInput(groupIdx, curveIdx, value) {
    if (!Number.isFinite(groupIdx) || !Number.isFinite(curveIdx)) return '';
    const group = curveGroups[groupIdx];
    const curve = group?.curves?.[curveIdx];
    if (!curve) return '';

    curve.alias = value;
    try {
      validateGroupCurveAliases(group.curves);
      triggerRedraw();
      return '';
    } catch (error) {
      triggerRedraw();
      return error.message;
    }
  }

  function handleCurveAliasBlur(groupIdx, curveIdx, value) {
    if (!Number.isFinite(groupIdx) || !Number.isFinite(curveIdx)) return { value: '', error: '' };
    if (!curveGroups[groupIdx] || !curveGroups[groupIdx].curves[curveIdx]) return { value: '', error: '' };

    const normalized = String(value || '').trim() || buildDefaultCurveAlias(curveIdx);
    curveGroups[groupIdx].curves[curveIdx].alias = normalized;

    try {
      validateGroupCurveAliases(curveGroups[groupIdx].curves);
      triggerRedraw();
      return { value: normalized, error: '' };
    } catch (error) {
      triggerRedraw();
      return { value: normalized, error: error.message };
    }
  }

  function handleCurveModeChange(groupIdx, curveIdx, modeValue) {
    if (!Number.isFinite(groupIdx) || !Number.isFinite(curveIdx)) return;
    if (!curveGroups[groupIdx] || !curveGroups[groupIdx].curves[curveIdx]) return;

    curveGroups[groupIdx].curves[curveIdx].dataMode = modeValue === 'formula' ? 'formula' : 'points';
    renderCurveGroups();
    triggerRedraw();
  }

  function showCurveHelp(groupIdx, curveIdx) {
    const message = buildCurveHelpMessage(curveGroups, groupIdx, curveIdx, buildDefaultCurveAlias);
    uiAdapter.showMessage(message);
  }

  function renderCurveGroups() {
    curveListApp = uiAdapter.mountCurveList({
      component: CurveGroupList,
      existingApp: curveListApp,
      props: {
      curveGroups,
      buildDefaultCurveAlias,
      onAddCurve: (groupIdx) => {
        if (!addCurveToGroup(curveGroups, groupIdx, createDefaultCurve)) return;
        renderCurveGroups();
        triggerRedraw();
      },
      onRemoveCurve: (groupIdx, curveIdx) => {
        if (!removeCurveFromGroup(curveGroups, groupIdx, curveIdx, createDefaultCurve)) return;
        renderCurveGroups();
        triggerRedraw();
      },
      onRemoveGroup: (groupIdx) => {
        if (!removeGroup(curveGroups, groupIdx)) return;
        renderCurveGroups();
        triggerRedraw();
      },
      onGroupFieldInput: handleGroupFieldInput,
      onCurveFieldInput: handleCurveFieldInput,
      onCurveModeChange: handleCurveModeChange,
      onCurveAliasInput: handleCurveAliasInput,
      onCurveAliasBlur: handleCurveAliasBlur,
      onOpenFormulaEditor: (groupIdx, curveIdx) => formulaEditorBridge.openFormulaEditor(groupIdx, curveIdx),
      onShowCurveHelp: (groupIdx, curveIdx) => showCurveHelp(groupIdx, curveIdx),
      onCurveContextMenu: (groupIdx, curveIdx, clientX, clientY) => {
        curveContextMenu.showCurveContextMenu(clientX, clientY, groupIdx, curveIdx);
      },
      onMoveCurveToGroup: (fromGroupIdx, fromCurveIdx, targetGroupIdx) => {
        moveCurveToGroup(fromGroupIdx, fromCurveIdx, targetGroupIdx);
      },
      },
    });
  }

  bindChartActionButtons({
    onAddCurveGroup: function() {
      addGroup(curveGroups, createDefaultGroup);
      renderCurveGroups();
      triggerRedraw();
    },
    onReRender: triggerRedraw,
  });

  function validateFormulaBeforeSave(payload) {
    const {
      editingGroupIndex,
      editingCurveIndex,
      formulaText,
      formulaLanguage,
      formulaDslSource,
    } = payload;
    validateFormulaDraft({
      curveGroups,
      editingGroupIndex,
      editingCurveIndex,
      formulaText,
      formulaLanguage,
      formulaDslSource,
      parseSingleFormulaFunction,
      validateGroupCurveAliases,
      validateGroupFormulaDependencies,
      validateFormulaFunctionRuntime,
    });
  }

  const formulaEditorBridge = useFormulaEditorBridge({
    curveGroups,
    buildDefaultFunctionSource,
    buildFormulaEditorTitle,
    validateFormulaBeforeSave,
    onFormulaSaved: ({ editingGroupIndex, editingCurveIndex, formulaText, formulaLanguage, formulaDslSource }) => {
      if (editingGroupIndex < 0 || editingGroupIndex >= curveGroups.length) {
        throw new Error('当前编辑的曲线组索引无效。');
      }
      if (editingCurveIndex < 0 || editingCurveIndex >= curveGroups[editingGroupIndex].curves.length) {
        throw new Error('当前编辑的曲线索引无效。');
      }

      const curve = curveGroups[editingGroupIndex].curves[editingCurveIndex];
      curve.formulaSource = formulaText;
      curve.formulaLanguage = formulaLanguage === 'dsl' ? 'dsl' : 'js';
      curve.formulaDslSource = formulaLanguage === 'dsl' ? String(formulaDslSource || '') : '';
      curve.dataMode = 'formula';
      renderCurveGroups();
      triggerRedraw();
    },
  });

  renderCurveGroups();
}
