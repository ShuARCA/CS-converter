/**
 * js/presetUI.js
 *
 * プリセット管理モーダルのUI描画・イベント処理を担当するモジュール。
 * 保守性・拡張性を重視した設計。
 */

import {
  getAllPresetSlots,
  savePresetToSlot,
  renamePresetSlot,
  loadPresetFromSlot,
  deletePresetSlot,
  applyPresetDataToUI,
  setLastPresetIndex,
} from './preset.js';
import { showToast } from './ui.js';

let modalElement = null;
let containerElement = null;
let currentCallbacks = {};

// SVG アイコン定義（白色統一・アイコンサイズ拡大）
const SVG_ICONS = {
  load: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="slot-btn-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  save: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="slot-btn-icon"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
  delete: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="slot-btn-icon"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
  edit: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="slot-btn-icon"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  check: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  cancel: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
};

/**
 * プリセットUIの初期化
 * @param {object} callbacks - { onApply: Function, bindDynamicRowListeners: Function }
 */
export function setupPresetUI(callbacks = {}) {
  currentCallbacks = callbacks;
  modalElement = document.getElementById('preset-modal');
  containerElement = document.getElementById('preset-slots-container');

  const btnOpen = document.getElementById('btn-preset');
  if (btnOpen) {
    btnOpen.addEventListener('click', openPresetModal);
  }

  const btnClose = document.getElementById('btn-preset-close');
  if (btnClose) {
    btnClose.addEventListener('click', closePresetModal);
  }

  if (modalElement) {
    modalElement.addEventListener('click', (e) => {
      if (e.target === modalElement) {
        closePresetModal();
      }
    });
  }

  // ESCキーで閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalElement && modalElement.classList.contains('visible')) {
      if (document.querySelector('.preset-rename-form')) return;
      closePresetModal();
    }
  });
}

/**
 * プリセットモーダルを開く
 */
export function openPresetModal() {
  if (!modalElement) return;
  renderPresetSlots();
  modalElement.classList.add('visible');
  document.body.classList.add('modal-open');
}

/**
 * プリセットモーダルを閉じる
 */
export function closePresetModal() {
  if (!modalElement) return;
  modalElement.classList.remove('visible');
  document.body.classList.remove('modal-open');
}

/**
 * プリセットスロット一覧の描画
 */
export function renderPresetSlots() {
  if (!containerElement) return;
  containerElement.innerHTML = '';

  const slots = getAllPresetSlots();

  slots.forEach((slot, index) => {
    const slotCard = document.createElement('div');
    slotCard.className = `preset-slot-card ${slot ? 'is-filled' : 'is-empty'}`;
    slotCard.dataset.index = index;

    if (slot) {
      const formattedDate = formatDate(slot.savedAt);
      slotCard.innerHTML = `
        <div class="preset-slot-info">
          <div class="preset-slot-header-row">
            <div class="preset-slot-name-wrapper">
              <span class="preset-slot-name" title="${escapeHtml(slot.name)}">${escapeHtml(slot.name)}</span>
              <button type="button" class="preset-name-edit-btn" data-index="${index}" title="名称を変更">
                ${SVG_ICONS.edit}
              </button>
            </div>
          </div>
          <div class="preset-slot-date">保存日時: ${formattedDate}</div>
        </div>
        <div class="preset-slot-actions">
          <button type="button" class="preset-action-btn preset-btn--load" data-index="${index}" title="読込：このプリセットを適用">
            ${SVG_ICONS.load}
          </button>
          <button type="button" class="preset-action-btn preset-btn--save" data-index="${index}" title="上書き：現在の設定で保存">
            ${SVG_ICONS.save}
          </button>
          <button type="button" class="preset-action-btn preset-btn--delete" data-index="${index}" title="削除：このプリセットを削除">
            ${SVG_ICONS.delete}
          </button>
        </div>
      `;

      // 鉛筆アイコンで名称変更
      const btnEdit = slotCard.querySelector('.preset-name-edit-btn');
      if (btnEdit) {
        btnEdit.addEventListener('click', (e) => {
          e.stopPropagation();
          handleStartRename(slotCard, index, slot.name);
        });
      }

      // 読込
      const btnLoad = slotCard.querySelector('.preset-btn--load');
      if (btnLoad) {
        btnLoad.addEventListener('click', () => handleLoadSlot(index));
      }

      // 上書き保存
      const btnSave = slotCard.querySelector('.preset-btn--save');
      if (btnSave) {
        btnSave.addEventListener('click', () => handleSaveSlot(index));
      }

      // 削除
      const btnDelete = slotCard.querySelector('.preset-btn--delete');
      if (btnDelete) {
        btnDelete.addEventListener('click', () => handleDeleteSlot(index));
      }
    } else {
      // 空きスロット（読込・削除はdisabledでグレーアウト表示）
      slotCard.innerHTML = `
        <div class="preset-slot-info">
          <div class="preset-slot-header-row">
            <div class="preset-slot-name-wrapper">
              <span class="preset-slot-empty-label">(空きスロット)</span>
            </div>
          </div>
          <div class="preset-slot-date">未保存</div>
        </div>
        <div class="preset-slot-actions">
          <button type="button" class="preset-action-btn preset-btn--load" disabled title="保存されたデータがありません">
            ${SVG_ICONS.load}
          </button>
          <button type="button" class="preset-action-btn preset-btn--save" data-index="${index}" title="保存：現在の設定を保存">
            ${SVG_ICONS.save}
          </button>
          <button type="button" class="preset-action-btn preset-btn--delete" disabled title="保存されたデータがありません">
            ${SVG_ICONS.delete}
          </button>
        </div>
      `;

      // 新規保存
      const btnSave = slotCard.querySelector('.preset-btn--save');
      if (btnSave) {
        btnSave.addEventListener('click', () => handleSaveSlot(index));
      }
    }

    containerElement.appendChild(slotCard);
  });
}

/**
 * プリセット名称のインライン編集を開始
 * @param {HTMLElement} slotCard
 * @param {number} slotIndex
 * @param {string} currentName
 */
function handleStartRename(slotCard, slotIndex, currentName) {
  const nameWrapper = slotCard.querySelector('.preset-slot-name-wrapper');
  if (!nameWrapper) return;

  // 既に編集フォームが表示されている場合はスキップ
  if (nameWrapper.querySelector('.preset-rename-form')) return;

  nameWrapper.innerHTML = `
    <div class="preset-rename-form">
      <input type="text" class="preset-rename-input editable-field" value="${escapeHtml(currentName)}" maxlength="30" placeholder="プリセット名称">
      <div class="preset-rename-actions">
        <button type="button" class="preset-rename-btn preset-rename-btn--confirm" title="確定">
          ${SVG_ICONS.check}
        </button>
        <button type="button" class="preset-rename-btn preset-rename-btn--cancel" title="キャンセル">
          ${SVG_ICONS.cancel}
        </button>
      </div>
    </div>
  `;

  const inputEl = nameWrapper.querySelector('.preset-rename-input');
  const btnConfirm = nameWrapper.querySelector('.preset-rename-btn--confirm');
  const btnCancel = nameWrapper.querySelector('.preset-rename-btn--cancel');

  if (inputEl) {
    inputEl.focus();
    inputEl.select();

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitRename();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        renderPresetSlots();
      }
    });
  }

  if (btnConfirm) {
    btnConfirm.addEventListener('click', (e) => {
      e.stopPropagation();
      submitRename();
    });
  }

  if (btnCancel) {
    btnCancel.addEventListener('click', (e) => {
      e.stopPropagation();
      renderPresetSlots();
    });
  }

  function submitRename() {
    const newName = (inputEl ? inputEl.value : currentName).trim();
    if (!newName) {
      showToast('プリセット名称を入力してください。', 'warning');
      return;
    }
    const success = renamePresetSlot(slotIndex, newName);
    if (success) {
      showToast(`プリセット名を「${newName}」に変更しました。`, 'success');
      renderPresetSlots();
    } else {
      showToast('名称の変更に失敗しました。', 'error');
    }
  }
}

/**
 * スロット保存・上書き処理
 * @param {number} slotIndex
 */
function handleSaveSlot(slotIndex) {
  const slots = getAllPresetSlots();
  const slot = slots[slotIndex];

  if (slot) {
    // 上書き保存の確認
    const ok = window.confirm(`プリセット「${slot.name}」を現在の設定で上書き保存しますか？`);
    if (!ok) return;

    try {
      savePresetToSlot(slotIndex, slot.name);
      showToast(`「${slot.name}」を上書き保存しました！`, 'success');
      renderPresetSlots();
    } catch (e) {
      console.error('[presetUI] Overwrite error:', e);
      showToast('プリセットの上書き保存に失敗しました。', 'error');
    }
  } else {
    // 新規保存
    const defaultName = `プリセット ${slotIndex + 1}`;
    try {
      savePresetToSlot(slotIndex, defaultName);
      showToast(`「${defaultName}」を保存しました！`, 'success');
      renderPresetSlots();
    } catch (e) {
      console.error('[presetUI] Save error:', e);
      showToast('プリセットの保存に失敗しました。', 'error');
    }
  }
}

/**
 * スロット読み込み処理
 * @param {number} slotIndex
 */
function handleLoadSlot(slotIndex) {
  const slots = getAllPresetSlots();
  const slot = slots[slotIndex];
  if (!slot || !slot.data) {
    showToast('指定されたスロットのデータが見つかりません。', 'error');
    return;
  }

  const ok = window.confirm(`プリセット「${slot.name}」を読み込みますか？\n現在の入力・オプション設定が上書きされます。`);
  if (!ok) return;

  try {
    const data = loadPresetFromSlot(slotIndex);
    if (!data) {
      showToast('プリセットデータの読み込みに失敗しました。', 'error');
      return;
    }

    // UIへ適用
    applyPresetDataToUI(data, currentCallbacks.bindDynamicRowListeners);
    setLastPresetIndex(slotIndex);

    // 再ビルドコールバック呼び出し
    if (typeof currentCallbacks.onApply === 'function') {
      currentCallbacks.onApply(data);
    }

    showToast(`プリセット「${slot.name}」を読み込みました！`, 'success');

    // 読み込み完了時にモーダルを自動で閉じる
    closePresetModal();
  } catch (e) {
    console.error('[presetUI] Load error:', e);
    showToast('プリセット読み込み中にエラーが発生しました。', 'error');
  }
}

/**
 * スロット削除処理
 * @param {number} slotIndex
 */
function handleDeleteSlot(slotIndex) {
  const slots = getAllPresetSlots();
  const slot = slots[slotIndex];
  if (!slot) return;

  const ok = window.confirm(`プリセット「${slot.name}」を削除しますか？\nこの操作は取り消せません。`);
  if (!ok) return;

  try {
    deletePresetSlot(slotIndex);
    showToast(`プリセット「${slot.name}」を削除しました。`, 'success');
    renderPresetSlots();
  } catch (e) {
    console.error('[presetUI] Delete error:', e);
    showToast('スロット削除中にエラーが発生しました。', 'error');
  }
}

// ────────────────────────────────────────────
// ヘルパー
// ────────────────────────────────────────────

function formatDate(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '-';
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${Y}/${M}/${D} ${h}:${m}`;
  } catch (e) {
    return '-';
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
