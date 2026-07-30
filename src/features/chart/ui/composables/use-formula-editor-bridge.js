import {
  compileDslFormulaToJs,
  getDslAssistSnippets,
  getDslFormulaHelpText,
} from '@/features/chart/services/formula-dsl.js';

export function useFormulaEditorBridge(options) {
  const {
    curveGroups,
    buildDefaultFunctionSource,
    buildFormulaEditorTitle,
    validateFormulaBeforeSave,
    onFormulaSaved,
  } = options;

  const formulaModal = document.getElementById('formula-editor-modal');
  const formulaTitle = document.getElementById('formula-editor-title');
  const formulaEditorHost = document.getElementById('formula-code-editor');
  const formulaTextarea = document.getElementById('textarea-formula-code');
  const formulaError = document.getElementById('formula-editor-error');
  const closeFormulaBtn = document.getElementById('btn-formula-cancel');
  const saveFormulaBtn = document.getElementById('btn-formula-save');
  const formulaLanguageSelect = document.getElementById('formula-language-select');
  const formulaDslHelpBtn = document.getElementById('btn-formula-dsl-help');
  const formulaDslHelpPanel = document.getElementById('formula-dsl-help-panel');
  const formulaDslHelpText = document.getElementById('formula-dsl-help-text');
  const formulaDslHelpClose = document.getElementById('btn-formula-dsl-help-close');
  const formulaDslAssist = document.getElementById('formula-dsl-assist');

  let editingGroupIndex = -1;
  let editingCurveIndex = -1;
  let monacoEditor = null;
  let monacoReadyPromise = null;
  let currentLanguage = 'js';
  let currentDslDraft = '';
  let currentJsDraft = '';

  formulaTextarea.addEventListener('keydown', function(event) {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const start = formulaTextarea.selectionStart;
    const end = formulaTextarea.selectionEnd;
    const value = formulaTextarea.value;
    const insert = '  ';
    formulaTextarea.value = value.slice(0, start) + insert + value.slice(end);
    formulaTextarea.selectionStart = formulaTextarea.selectionEnd = start + insert.length;
  });

  function ensureMonacoEditor() {
    if (monacoEditor) return Promise.resolve(monacoEditor);
    if (monacoReadyPromise) return monacoReadyPromise;

    monacoReadyPromise = new Promise((resolve, reject) => {
      if (!window.require) {
        reject(new Error('Monaco loader 不可用'));
        return;
      }

      if (!window.monaco) {
        window.require.config({
          paths: {
            vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs'
          }
        });
      }

      window.require(['vs/editor/editor.main'], () => {
        try {
          monacoEditor = window.monaco.editor.create(formulaEditorHost, {
            value: '',
            language: 'javascript',
            theme: 'vs-dark',
            automaticLayout: true,
            fontSize: 13,
            lineNumbers: 'on',
            minimap: { enabled: false },
            tabSize: 2,
            insertSpaces: true,
            detectIndentation: false,
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            roundedSelection: false,
            renderWhitespace: 'boundary'
          });
          resolve(monacoEditor);
        } catch (error) {
          reject(error);
        }
      }, err => reject(err));
    });

    return monacoReadyPromise;
  }

  function setEditorValue(text) {
    formulaTextarea.value = text;
    if (monacoEditor) {
      monacoEditor.setValue(text);
    }
  }

  function getEditorValue() {
    if (monacoEditor) {
      return monacoEditor.getValue();
    }
    return formulaTextarea.value;
  }

  function getMonacoSyntaxErrorMessage() {
    if (!monacoEditor || !window.monaco) return '';
    const model = monacoEditor.getModel();
    if (!model) return '';

    const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
    const syntaxErrors = markers.filter(marker => marker.severity === window.monaco.MarkerSeverity.Error);
    if (syntaxErrors.length === 0) return '';

    const first = syntaxErrors[0];
    return `语法检查失败（第 ${first.startLineNumber} 行）: ${first.message}`;
  }

  function setMonacoLanguage(language) {
    if (!monacoEditor || !window.monaco) return;
    const model = monacoEditor.getModel();
    if (!model) return;
    window.monaco.editor.setModelLanguage(model, language === 'dsl' ? 'plaintext' : 'javascript');
  }

  function syncDraftFromEditor() {
    const value = getEditorValue();
    if (currentLanguage === 'dsl') {
      currentDslDraft = value;
    } else {
      currentJsDraft = value;
    }
  }

  function toggleDslUi() {
    const showDsl = currentLanguage === 'dsl';
    if (formulaDslHelpBtn) {
      formulaDslHelpBtn.style.display = showDsl ? 'inline-flex' : 'none';
    }
    if (formulaDslAssist) {
      formulaDslAssist.style.display = showDsl ? 'flex' : 'none';
    }
    if (!showDsl && formulaDslHelpPanel) {
      formulaDslHelpPanel.style.display = 'none';
    }
  }

  function insertTextAtCursor(insertText) {
    if (!insertText) return;
    if (monacoEditor) {
      const selection = monacoEditor.getSelection();
      if (!selection) return;
      monacoEditor.executeEdits('dsl-assist', [{ range: selection, text: insertText, forceMoveMarkers: true }]);
      monacoEditor.focus();
      syncDraftFromEditor();
      return;
    }

    const start = formulaTextarea.selectionStart;
    const end = formulaTextarea.selectionEnd;
    const value = formulaTextarea.value;
    formulaTextarea.value = value.slice(0, start) + insertText + value.slice(end);
    const next = start + insertText.length;
    formulaTextarea.selectionStart = next;
    formulaTextarea.selectionEnd = next;
    formulaTextarea.focus();
    syncDraftFromEditor();
  }

  function compileCurrentDslToJs() {
    const result = compileDslFormulaToJs(String(currentDslDraft || '').trim());
    currentJsDraft = result.jsSource;
    return result;
  }

  function handleLanguageSwitch(nextLanguage) {
    if (nextLanguage === currentLanguage) return;

    syncDraftFromEditor();
    if (nextLanguage === 'js') {
      const compiled = compileCurrentDslToJs();
      setEditorValue(compiled.jsSource);
      formulaError.textContent = '已显示由 DSL 编译的 JS，可继续编辑。';
    } else {
      if (!String(currentDslDraft || '').trim()) {
        currentDslDraft = 'y1';
      }
      setEditorValue(currentDslDraft);
      formulaError.textContent = '';
    }

    currentLanguage = nextLanguage === 'dsl' ? 'dsl' : 'js';
    setMonacoLanguage(currentLanguage);
    toggleDslUi();
  }

  function closeFormulaEditor() {
    editingGroupIndex = -1;
    editingCurveIndex = -1;
    formulaModal.classList.remove('open');
    formulaModal.setAttribute('aria-hidden', 'true');
  }

  function openFormulaEditor(groupIdx, curveIdx) {
    editingGroupIndex = groupIdx;
    editingCurveIndex = curveIdx;
    const curve = curveGroups[groupIdx]?.curves?.[curveIdx];
    formulaTitle.textContent = buildFormulaEditorTitle(curveGroups, groupIdx, curveIdx);
    currentLanguage = curve?.formulaLanguage === 'dsl' ? 'dsl' : 'js';
    currentJsDraft = String(curve?.formulaSource || buildDefaultFunctionSource(curveIdx));
    currentDslDraft = String(curve?.formulaDslSource || '');
    if (currentLanguage === 'dsl' && !currentDslDraft.trim()) {
      currentDslDraft = 'y1';
    }

    if (formulaLanguageSelect) {
      formulaLanguageSelect.value = currentLanguage;
    }
    setEditorValue(currentLanguage === 'dsl' ? currentDslDraft : currentJsDraft);
    formulaError.textContent = '';
    formulaModal.classList.add('open');
    formulaModal.setAttribute('aria-hidden', 'false');
    toggleDslUi();

    ensureMonacoEditor()
      .then(editor => {
        formulaTextarea.style.display = 'none';
        formulaEditorHost.style.display = 'block';
        setMonacoLanguage(currentLanguage);
        editor.setValue(formulaTextarea.value);
        editor.focus();
      })
      .catch(() => {
        formulaEditorHost.style.display = 'none';
        formulaTextarea.style.display = 'block';
        formulaTextarea.focus();
      });
  }

  function saveFormula() {
    syncDraftFromEditor();

    try {
      let formulaText = '';
      let formulaDslSource = '';

      if (currentLanguage === 'dsl') {
        const compiled = compileCurrentDslToJs();
        formulaText = compiled.jsSource;
        formulaDslSource = compiled.dslSource;
      } else {
        formulaText = String(currentJsDraft || '').trim();
        const markerErr = getMonacoSyntaxErrorMessage();
        if (markerErr) {
          throw new Error(markerErr);
        }
      }

      validateFormulaBeforeSave({
        editingGroupIndex,
        editingCurveIndex,
        formulaText,
        formulaLanguage: currentLanguage,
        formulaDslSource,
      });
      onFormulaSaved({
        editingGroupIndex,
        editingCurveIndex,
        formulaText,
        formulaLanguage: currentLanguage,
        formulaDslSource,
      });
      closeFormulaEditor();
    } catch (error) {
      formulaError.textContent = error.message;
    }
  }

  closeFormulaBtn.addEventListener('click', closeFormulaEditor);

  formulaModal.addEventListener('click', function(event) {
    if (event.target === formulaModal) {
      closeFormulaEditor();
    }
  });

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && formulaModal.classList.contains('open')) {
      closeFormulaEditor();
    }
  });

  saveFormulaBtn.addEventListener('click', saveFormula);

  if (formulaLanguageSelect) {
    formulaLanguageSelect.addEventListener('change', function(event) {
      try {
        handleLanguageSwitch(event.target.value);
      } catch (error) {
        event.target.value = currentLanguage;
        formulaError.textContent = error.message;
      }
    });
  }

  if (formulaDslAssist) {
    const assistButtons = getDslAssistSnippets().map(item => {
      return `<button type="button" class="btn btn-outline-secondary btn-sm formula-dsl-assist-btn" data-code="${item.code}">${item.label}</button>`;
    }).join('');
    formulaDslAssist.innerHTML = assistButtons;
    formulaDslAssist.addEventListener('click', function(event) {
      const button = event.target.closest('.formula-dsl-assist-btn');
      if (!button) return;
      const code = button.getAttribute('data-code') || '';
      insertTextAtCursor(code);
    });
  }

  if (formulaDslHelpText) {
    formulaDslHelpText.textContent = getDslFormulaHelpText();
  }

  if (formulaDslHelpBtn && formulaDslHelpPanel) {
    formulaDslHelpBtn.addEventListener('click', function() {
      formulaDslHelpPanel.style.display = formulaDslHelpPanel.style.display === 'block' ? 'none' : 'block';
    });
  }

  if (formulaDslHelpClose && formulaDslHelpPanel) {
    formulaDslHelpClose.addEventListener('click', function() {
      formulaDslHelpPanel.style.display = 'none';
    });
  }

  return {
    openFormulaEditor,
    closeFormulaEditor,
  };
}
