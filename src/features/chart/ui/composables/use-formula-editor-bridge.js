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

  let editingGroupIndex = -1;
  let editingCurveIndex = -1;
  let monacoEditor = null;
  let monacoReadyPromise = null;

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
    setEditorValue(curve?.formulaSource || buildDefaultFunctionSource(curveIdx));
    formulaError.textContent = '';
    formulaModal.classList.add('open');
    formulaModal.setAttribute('aria-hidden', 'false');

    ensureMonacoEditor()
      .then(editor => {
        formulaTextarea.style.display = 'none';
        formulaEditorHost.style.display = 'block';
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
    const formulaText = getEditorValue().trim();

    try {
      const markerErr = getMonacoSyntaxErrorMessage();
      if (markerErr) {
        throw new Error(markerErr);
      }

      validateFormulaBeforeSave({
        editingGroupIndex,
        editingCurveIndex,
        formulaText,
      });
      onFormulaSaved({
        editingGroupIndex,
        editingCurveIndex,
        formulaText,
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

  return {
    openFormulaEditor,
    closeFormulaEditor,
  };
}
