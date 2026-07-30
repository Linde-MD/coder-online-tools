import {
  decodeJ1939Id,
  encodeJ1939IdFromPgn,
  formatHex,
  getSpecialPgnName,
  parseNumberInput
} from '../../../shared/utils/j1939.js';

const J1939_UI_STORAGE_KEY = 'coderOnlineTools.j1939UiState.v1';

export function initJ1939Tool() {
  const idInput = document.getElementById('input-j1939-id');
  const idBtn = document.getElementById('btn-convert-id');
  const idResult = document.getElementById('id-to-pgn-result');

  const pgnInput = document.getElementById('input-j1939-pgn');
  const priorityInput = document.getElementById('input-j1939-priority');
  const saInput = document.getElementById('input-j1939-sa');
  const daInput = document.getElementById('input-j1939-da');
  const pgnBtn = document.getElementById('btn-convert-pgn');
  const pgnMsg = document.getElementById('pgn-validation-msg');
  const pgnResult = document.getElementById('pgn-to-id-result');

  if (!idInput || !idBtn || !idResult || !pgnInput || !priorityInput || !saInput || !daInput || !pgnBtn || !pgnMsg || !pgnResult) {
    return;
  }

  let daLastEditable = daInput.value;

  function saveJ1939UiState() {
    try {
      const payload = {
        id: idInput.value,
        pgn: pgnInput.value,
        priority: priorityInput.value,
        sa: saInput.value,
        da: daInput.value,
        daLastEditable,
      };
      localStorage.setItem(J1939_UI_STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {
      // Ignore localStorage errors to avoid affecting conversion flow.
    }
  }

  function loadJ1939UiState() {
    try {
      const raw = localStorage.getItem(J1939_UI_STORAGE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw);
      if (!state || typeof state !== 'object') return;

      if (typeof state.id === 'string') idInput.value = state.id;
      if (typeof state.pgn === 'string') pgnInput.value = state.pgn;
      if (typeof state.priority === 'string') priorityInput.value = state.priority;
      if (typeof state.sa === 'string') saInput.value = state.sa;
      if (typeof state.da === 'string') daInput.value = state.da;
      if (typeof state.daLastEditable === 'string') daLastEditable = state.daLastEditable;
    } catch (_) {
      // Ignore corrupted storage.
    }
  }

  function renderResultRows(rows) {
    return `
      <div class="table-responsive">
        <table class="table table-sm table-striped align-middle mb-0 j1939-result-table">
          <tbody>
            ${rows.map(row => `
              <tr class="j1939-result-row">
                <th scope="row" class="text-secondary fw-semibold">${row.name}</th>
                <td class="j1939-result-value ${row.isMain ? 'is-main fw-bold text-primary' : ''}">
                  <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <span>${row.value}</span>
                    ${row.copyValue ? `<button class="j1939-copy-btn btn btn-outline-secondary btn-sm" type="button" data-copy="${row.copyValue}">复制</button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderResultError(message) {
    return `<div class="alert alert-danger py-2 px-3 mb-0" role="alert">${message}</div>`;
  }

  function renderResultNote(message) {
    return `<div class="alert alert-primary py-2 px-3 mt-2 mb-0" role="alert">${message}</div>`;
  }

  async function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  function bindCopyAction(container) {
    container.addEventListener('click', async e => {
      if (!e.target.classList.contains('j1939-copy-btn')) {
        return;
      }

      const text = e.target.getAttribute('data-copy');
      if (!text) {
        return;
      }

      try {
        await copyText(text);
        const oldText = e.target.textContent;
        e.target.textContent = '已复制';
        setTimeout(() => {
          e.target.textContent = oldText;
        }, 1000);
      } catch (err) {
        e.target.textContent = '复制失败';
        setTimeout(() => {
          e.target.textContent = '复制';
        }, 1200);
      }
    });
  }

  function renderSpecialTag(name) {
    return name ? `<span class="special-pgn badge text-bg-info">特定PGN: ${name}</span>` : '';
  }

  function updateDaStateByPgn() {
    const pgn = parseNumberInput(pgnInput.value);
    if (!Number.isInteger(pgn) || pgn < 0 || pgn > 0x3FFFF) {
      daInput.disabled = false;
      daInput.classList.remove('input-disabled');
      daInput.value = daLastEditable;
      pgnMsg.textContent = '请输入有效 PGN（0 ~ 0x3FFFF）。';
      saveJ1939UiState();
      return;
    }

    const PF = (pgn >> 8) & 0xFF;
    const GE = pgn & 0xFF;

    if (PF >= 240) {
      if (!daInput.disabled) {
        daLastEditable = daInput.value;
      }
      daInput.disabled = true;
      daInput.classList.add('input-disabled');
      daInput.value = 'broadcast';
      pgnMsg.textContent = '';
      saveJ1939UiState();
      return;
    }

    daInput.disabled = false;
    daInput.classList.remove('input-disabled');
    if (daInput.value === 'broadcast') {
      daInput.value = daLastEditable;
    }

    if (GE !== 0) {
      pgnMsg.textContent = '该 PGN 不可用: PF < 240 时 GE 必须为 0。';
    } else {
      pgnMsg.textContent = '';
    }

    saveJ1939UiState();
  }

  function convertIdToPgn() {
    const id = parseNumberInput(idInput.value);
    if (!Number.isInteger(id)) {
      idResult.innerHTML = renderResultError('请输入有效 ID（支持十进制或0x十六进制）。');
      return;
    }

    const decoded = decodeJ1939Id(id);
    if (!decoded.valid) {
      idResult.innerHTML = renderResultError(decoded.error);
      return;
    }

    const daText = decoded.isBroadcast
      ? 'broadcast'
      : `${decoded.destinationAddress} (${formatHex(decoded.destinationAddress, 2)})`;

    const specialTag = decoded.specialPgnName ? ` ${renderSpecialTag(decoded.specialPgnName)}` : '';
    const specialNote = decoded.specialPgnName
      ? renderResultNote(`说明：该 PGN 属于特定 PGN，类别为 ${decoded.specialPgnName}。`)
      : '';

    idResult.innerHTML = renderResultRows([
      { name: 'ID', value: `${formatHex(id, 8)} (${id})`, isMain: true, copyValue: formatHex(id, 8) },
      { name: 'Priority', value: `${decoded.P}` },
      { name: 'PGN', value: `${decoded.PGN} (${formatHex(decoded.PGN, 5)})${specialTag}` },
      { name: 'PF / GE', value: `${decoded.PF} (${formatHex(decoded.PF, 2)}) / ${decoded.GE} (${formatHex(decoded.GE, 2)})` },
      { name: 'Destination Address', value: daText },
      { name: 'Source Address', value: `${decoded.SA} (${formatHex(decoded.SA, 2)})` },
      { name: 'Data Page', value: `${decoded.DP}` }
    ]) + specialNote;
  }

  function convertPgnToId() {
    const pgn = parseNumberInput(pgnInput.value);
    const priority = parseNumberInput(priorityInput.value);
    const sa = parseNumberInput(saInput.value);
    const da = daInput.disabled ? 0 : parseNumberInput(daInput.value);

    const encoded = encodeJ1939IdFromPgn(pgn, priority, sa, da);
    if (!encoded.valid) {
      pgnResult.innerHTML = renderResultError(encoded.error);
      pgnMsg.textContent = encoded.error;
      return;
    }

    pgnMsg.textContent = '';
    pgnResult.innerHTML = renderResultRows([
      { name: 'ID', value: `${formatHex(encoded.id, 8)} (${encoded.id})`, isMain: true, copyValue: formatHex(encoded.id, 8) }
    ]);
  }

  idBtn.addEventListener('click', convertIdToPgn);
  pgnBtn.addEventListener('click', convertPgnToId);
  pgnInput.addEventListener('input', updateDaStateByPgn);
  idInput.addEventListener('input', saveJ1939UiState);
  priorityInput.addEventListener('input', saveJ1939UiState);
  saInput.addEventListener('input', saveJ1939UiState);
  daInput.addEventListener('input', saveJ1939UiState);
  bindCopyAction(idResult);
  bindCopyAction(pgnResult);

  loadJ1939UiState();
  updateDaStateByPgn();
  convertIdToPgn();
  convertPgnToId();
  saveJ1939UiState();
}
