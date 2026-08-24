/**
 * js/main.js
 *
 * エントリーポイントモジュール。
 * DOMイベントの紐付けおよび、変換フロー全体の制御を行います。
 */

import { AppError } from './constants.js';
import { validateInput, sanitizeOptions } from './validator.js';
import { fetchWithProxy } from './fetcher.js';
import { parse } from './parsers/index.js';
import { buildChatPalette } from './chatpalette.js';
import { buildCocofoliaJson } from './converter.js';
import { getPaletteBlocks, renderPaletteBuilder, addCustomBlock } from './paletteConfig.js';
import {
  showLoading,
  showError,
  showPreview,
  hidePreview,
  showToast
} from './ui.js';

// アプリケーションの状態管理
const state = {
  currentJsonStr: '',
  characterName: '',
  charData: null // パース済みデータを保持
};

/**
 * 画面上の入力要素からオプションオブジェクトを収集する
 * @returns {object} Optionsオブジェクト
 */
function collectOptions() {
  const diceCommandEl = document.querySelector('input[name="diceCommand"]:checked');
  const diceCommand = diceCommandEl ? diceCommandEl.value : 'CCB';

  const showInitialSkills = document.getElementById('opt-show-initial-skills').checked;
  const showDodge = document.getElementById('opt-show-dodge').checked;
  const showPerceptionSkills = document.getElementById('opt-show-perception-skills').checked;
  const showCombatDamage = document.getElementById('opt-show-combat-damage').checked;

  // 特殊ロールの収集
  const showSpecialRolls = {};
  document.querySelectorAll('.opt-special-roll').forEach(el => {
    const roll = el.dataset.roll;
    if (roll) {
      showSpecialRolls[roll] = el.checked;
    }
  });

  const showStatTimes5All = document.getElementById('opt-show-stat-times5-all').checked;

  // 個別能力値×5の収集
  const showStatTimes5 = {};
  document.querySelectorAll('.opt-stat-times5').forEach(el => {
    const stat = el.dataset.stat;
    if (stat) {
      showStatTimes5[stat] = el.checked;
    }
  });

  const hideStatus = document.getElementById('preview-secret')?.checked ?? true;
  const invisible = document.getElementById('preview-invisible')?.checked ?? false;
  const hideStatusFromBoard = document.getElementById('preview-hide-status')?.checked ?? false;

  const tokenSize = parseFloat(document.getElementById('preview-size')?.value) || 4;
  const x = tokenSize * -12;
  const y = tokenSize * -12;
  const useDefaultColor = document.getElementById('opt-use-default-color').checked;
  const chatColor = document.getElementById('opt-chat-color').value || '#a4c2f4';

  const customStatuses = Array.from(document.querySelectorAll('.custom-status-row')).map(row => ({
    label: row.querySelector('.status-label').value,
    value: row.querySelector('.status-val').value,
    max: row.querySelector('.status-max').value
  }));

  const customParams = Array.from(document.querySelectorAll('.custom-param-item')).map(item => ({
    label: item.querySelector('.param-label').value,
    value: item.querySelector('.param-val').value
  }));

  const customFaces = Array.from(document.querySelectorAll('.ccfolia-face-item')).map(item => ({
    name: item.querySelector('.face-label').value,
    iconUrl: ''
  }));

  return {
    diceCommand,
    showInitialSkills,
    showDodge,
    showPerceptionSkills,
    showCombatDamage,
    showSpecialRolls,
    showStatTimes5All,
    showStatTimes5,
    hideStatus,
    invisible,
    hideStatusFromBoard,
    tokenSize,
    x,
    y,
    useDefaultColor,
    chatColor,
    customStatuses,
    customParams,
    customFaces
  };
}

/**
 * プレビューUI上の入力を state.charData に同期する
 */
function syncDataFromPreview() {
  if (!state.charData) return;
  const s = state.charData.stats;
  if (!s) return;

  const getVal = (id) => {
    const el = document.getElementById(id);
    if (!el) return 0;
    const val = parseInt(el.value);
    return isNaN(val) ? 0 : val;
  };

  const nameInput = document.getElementById('preview-name');
  if (nameInput) state.charData.name = nameInput.value;

  const initInput = document.getElementById('preview-initiative');
  if (initInput) state.charData.initiative = getVal('preview-initiative');

  const urlInput = document.getElementById('preview-url');
  if (urlInput) state.charData.externalUrl = urlInput.value;

  s.currentHP = getVal('preview-hp-val');
  s.maxHP = getVal('preview-hp-max');
  s.currentMP = getVal('preview-mp-val');
  s.maxMP = getVal('preview-mp-max');
  s.currentSAN = getVal('preview-san-val');
  s.initialSAN = getVal('preview-san-max');

  ['STR', 'CON', 'POW', 'DEX', 'APP', 'SIZ', 'INT', 'EDU'].forEach(param => {
    s[param] = getVal(`preview-param-${param}`);
  });

  const dbInput = document.getElementById('preview-param-DB');
  if (dbInput) {
    s.DB = dbInput.value;
  }

  const memoInput = document.getElementById('preview-memo');
  if (memoInput) {
    state.charData.memo = memoInput.value;
  }
}

let rebuildTimeoutId = null;
const requestRebuild = () => {
  if (rebuildTimeoutId) clearTimeout(rebuildTimeoutId);
  rebuildTimeoutId = setTimeout(() => {
    rebuildOutput();
  }, 200);
};

/**
 * 現在の state.charData とオプションをもとに再ビルドし、画面を更新する
 * @param {boolean} redrawBuilder - trueの場合、チャットパレットビルダーUIも再描画する
 * @param {boolean} isInitial - 初回ロード時かどうか
 */
function rebuildOutput(redrawBuilder = true, isInitial = false) {
  if (!state.charData) return;

  try {
    // JSON出力等に影響する値（チャットパレット計算に使用する能力値など）を同期
    if (!isInitial) {
      syncDataFromPreview();
    }
    const rawOptions = collectOptions();
    const sanitizedOptions = sanitizeOptions(rawOptions);

    const chatPalette = buildChatPalette(state.charData, sanitizedOptions, getPaletteBlocks());
    const jsonObj = buildCocofoliaJson(state.charData, sanitizedOptions, chatPalette);
    state.currentJsonStr = JSON.stringify(jsonObj, null, 2);

    showPreview(state.charData, sanitizedOptions, chatPalette, isInitial);

    // 裏のtextareaにも値を入れておく
    const cpTextarea = document.getElementById('preview-chatpalette');
    if (cpTextarea) cpTextarea.value = chatPalette;

    if (redrawBuilder) {
      renderPaletteBuilder(state.charData, sanitizedOptions, rebuildOutput);
    }
  } catch (e) {
    console.error('[main] Rebuild error:', e);
    showToast('プレビューの更新に失敗しました', 'error');
  }
}

/**
 * 変換処理のメインフロー
 */
async function handleConvert() {
  const urlInput = document.getElementById('url-input');
  if (!urlInput) return;

  const url = urlInput.value.trim();

  // エラーと出力をクリア
  showError(null);
  hidePreview();
  state.currentJsonStr = '';
  state.characterName = '';
  state.charData = null;

  try {
    // 1. 入力バリデーション＆自動判別
    const validation = validateInput(url);
    if (!validation.ok) {
      // IACHARA_REDIRECT の場合はそのままエラーメッセージ表示で良い
      throw new AppError(validation.code);
    }

    // ローディング開始（URLの場合のみ時間がかかるが、UIの一貫性のため一応出す）
    showLoading(true);

    let charData;

    if (validation.type === 'json') {
      // 2a. JSON入力モード
      const json = validation.json;
      charData = await parse('ccfolia_json', json, null);
    } else {
      // 2b. URL入力モード
      const { service, id } = validation;
      const html = await fetchWithProxy(url);
      charData = await parse(service, html, id);
    }

    state.characterName = charData.name || '名無し';
    state.charData = charData;

    // JSONで色が指定されていた場合、カラーピッカーに反映
    if (charData.originalColor && validation.type === 'json') {
      const optUseDefaultColor = document.getElementById('opt-use-default-color');
      const optChatColor = document.getElementById('opt-chat-color');
      if (optUseDefaultColor && optChatColor) {
        optUseDefaultColor.checked = false;
        optChatColor.disabled = false;
        optChatColor.value = charData.originalColor;
      }
    }

    // 4. 初回ビルド
    rebuildOutput(true, true);
    showToast('変換に成功しました！', 'success');

  } catch (e) {
    console.error('[main] Convert error:', e);
    if (e instanceof AppError) {
      showError(e);
    } else {
      showError(new AppError('PARSE_FAILED', e.message));
    }
    showToast('変換に失敗しました。', 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * JSONをクリップボードにコピーする
 */
async function handleCopy() {
  if (!state.currentJsonStr) return;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(state.currentJsonStr);
      showToast('クリップボードにコピーしました！', 'success');
    } else {
      throw new Error('Clipboard API not available');
    }
  } catch (e) {
    console.warn('[main] Clipboard copy failed:', e);
    showError(new AppError('CLIPBOARD_DENIED', e.message));
    showToast('コピーできませんでした。', 'error');
  }
}

/**
 * UIオプションの連動制御を設定
 */
function setupOptionControls() {
  const optAllStatTimes5 = document.getElementById('opt-show-stat-times5-all');
  const individualStatTimes5 = document.querySelectorAll('.opt-stat-times5');
  const optUseDefaultColor = document.getElementById('opt-use-default-color');
  const optChatColor = document.getElementById('opt-chat-color');

  // 1. 能力値×5「全部選択」の連動制御
  if (optAllStatTimes5) {
    optAllStatTimes5.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      individualStatTimes5.forEach(cb => {
        cb.disabled = isChecked;
        if (isChecked) {
          cb.checked = true;
        }
      });
    });
  }

  // 2. チャットカラー「デフォルト色を使用」の連動制御
  if (optUseDefaultColor && optChatColor) {
    optUseDefaultColor.addEventListener('change', (e) => {
      optChatColor.disabled = e.target.checked;
    });
  }

  // 3. 駒サイズの連動制御（X, Yを自動計算: 駒サイズ * -12）
  const previewSize = document.getElementById('preview-size');
  const previewX = document.getElementById('preview-x');
  const previewY = document.getElementById('preview-y');
  if (previewSize && previewX && previewY) {
    previewSize.addEventListener('input', (e) => {
      const size = parseFloat(e.target.value) || 0;
      const offset = size * -12;
      previewX.value = offset;
      previewY.value = offset;
    });
  }
}

/**
 * オプション変更時に再ビルドするイベントを設定
 */
function setupRebuildListeners() {
  // 全てのオプション入力要素およびプレビュー入力要素にリスナーを追加
  const inputs = document.querySelectorAll('#preview-section input, #preview-section textarea');
  inputs.forEach(input => {
    input.addEventListener('change', requestRebuild);
    if (input.type === 'number' || input.type === 'color' || input.type === 'text' || input.tagName === 'TEXTAREA') {
      input.addEventListener('input', requestRebuild);
    }
  });
}

/**
 * プレビュー画面の動的コントロール（＋／－ボタン）のセットアップ
 */
function setupPreviewDynamicControls() {
  const btnAddFace = document.getElementById('btn-add-face');
  const btnAddStatus = document.getElementById('btn-add-status');
  const btnAddParam = document.getElementById('btn-add-param');

  const createRemoveBtn = () => {
    return `<button type="button" class="ccfolia-btn-icon ccfolia-btn-icon--remove" title="削除">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`;
  };

  const bindRemoveAndRebuild = (container) => {
    container.querySelector('.ccfolia-btn-icon--remove').addEventListener('click', () => {
      container.remove();
      requestRebuild();
    });
    const inputs = container.querySelectorAll('input');
    inputs.forEach(input => {
      input.addEventListener('input', requestRebuild);
      input.addEventListener('change', requestRebuild);
    });
  };

  if (btnAddFace) {
    btnAddFace.addEventListener('click', () => {
      const grid = document.getElementById('preview-faces-grid');
      const div = document.createElement('div');
      div.className = 'ccfolia-face-item';
      div.innerHTML = `<input type="text" class="face-label editable-field" placeholder="ラベル名">` + createRemoveBtn();
      bindRemoveAndRebuild(div);
      grid.appendChild(div);
      requestRebuild();
    });
  }

  if (btnAddStatus) {
    btnAddStatus.addEventListener('click', () => {
      const container = document.getElementById('preview-status-custom');
      const div = document.createElement('div');
      div.className = 'ccfolia-status-row custom-status-row mt-1';
      div.innerHTML = `
        <input type="text" class="status-label editable-field" placeholder="ラベル">
        <input type="number" class="status-val editable-field" value="0">
        <input type="number" class="status-max editable-field" value="0">
      ` + createRemoveBtn();
      bindRemoveAndRebuild(div);
      container.appendChild(div);
      requestRebuild();
    });
  }

  if (btnAddParam) {
    btnAddParam.addEventListener('click', () => {
      const grid = document.getElementById('preview-params-custom');
      const div = document.createElement('div');
      div.className = 'ccfolia-param-item custom-param-item';
      div.innerHTML = `
        <input type="text" class="param-label editable-field" placeholder="ラベル">
        <input type="text" class="param-val editable-field" value="0">
      ` + createRemoveBtn();
      bindRemoveAndRebuild(div);
      grid.appendChild(div);
      requestRebuild();
    });
  }
}

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
  setupOptionControls();
  setupRebuildListeners();
  setupPreviewDynamicControls();

  // 変換ボタンイベント
  const btnConvert = document.getElementById('btn-convert');
  if (btnConvert) {
    btnConvert.addEventListener('click', handleConvert);
  }

  // カスタムブロック追加ボタン
  const btnAddBlock = document.getElementById('btn-add-custom-block');
  if (btnAddBlock) {
    btnAddBlock.addEventListener('click', () => {
      addCustomBlock(rebuildOutput);
    });
  }

  // URL入力欄でのEnterキー押下で変換実行
  const urlInput = document.getElementById('url-input');
  if (urlInput) {
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConvert();
      }
    });
  }

  // コピーボタンイベント
  const btnCopy = document.getElementById('btn-copy');
  if (btnCopy) {
    btnCopy.addEventListener('click', handleCopy);
  }
});
