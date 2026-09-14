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
import { buildSkillEntries } from './parsers/parser-utils.js';
import {
  getLastPresetIndex,
  loadPresetFromSlot,
  applyPresetDataToUI,
} from './preset.js';
import { setupPresetUI } from './presetUI.js';
import { ColorPicker } from './ColorPicker.js';
import {
  showLoading,
  showError,
  showPreview,
  hidePreview,
  showToast,
} from './ui.js';
import { appState } from './state.js';
import { collectOptions } from './optionsCollector.js';
import { createRemoveBtn } from './utils.js';

// カラーピッカーインスタンス
let colorPickerInstance = null;

/**
 * 初回ロード用の空キャラクターデータ（全技能初期値・取得技能0件）を生成する
 * @returns {object}
 */
function createInitialCharacterData() {
  const stats = {
    STR: 0, CON: 0, POW: 0, DEX: 0, APP: 0, SIZ: 0, INT: 0, EDU: 0,
    currentHP: 0, maxHP: 0, currentMP: 0, maxMP: 0,
    initialSAN: 0, currentSAN: 0,
    idea: 0, luck: 0, know: 0,
    DB: '+0',
  };

  const skills = buildSkillEntries(new Map(), stats);

  return {
    name: '-',
    memo: '-',
    initiative: 0,
    externalUrl: '',
    stats,
    skills,
    isPartial: false,
    parseWarnings: [],
    sourceUrl: '',
    sourceType: 'initial',
  };
}

/**
 * プレビューUI上の入力を state.charData に同期する
 */
function syncDataFromPreview() {
  if (!appState.charData) return;
  const s = appState.charData.stats;
  if (!s) return;

  const getVal = (id) => {
    const el = document.getElementById(id);
    if (!el) return 0;
    const val = parseInt(el.value);
    return isNaN(val) ? 0 : val;
  };

  const nameInput = document.getElementById('preview-name');
  if (nameInput) appState.charData.name = nameInput.value;

  const initInput = document.getElementById('preview-initiative');
  if (initInput) appState.charData.initiative = getVal('preview-initiative');

  const urlInput = document.getElementById('preview-url');
  if (urlInput) appState.charData.externalUrl = urlInput.value;

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
    appState.charData.memo = memoInput.value;
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
 * 現在の appState.charData とオプションをもとに再ビルドし、画面を更新する
 * @param {boolean} redrawBuilder - trueの場合、チャットパレットビルダーUIも再描画する
 * @param {boolean} isInitial - 初回ロード時かどうか
 */
function rebuildOutput(redrawBuilder = true, isInitial = false) {
  if (!appState.charData) return;

  try {
    // JSON出力等に影響する値（チャットパレット計算に使用する能力値など）を同期
    if (!isInitial) {
      syncDataFromPreview();
    }
    const rawOptions = collectOptions();
    const sanitizedOptions = sanitizeOptions(rawOptions);

    const chatPalette = buildChatPalette(appState.charData, sanitizedOptions, getPaletteBlocks());
    const jsonObj = buildCocofoliaJson(appState.charData, sanitizedOptions, chatPalette);
    appState.currentJsonStr = JSON.stringify(jsonObj, null, 2);

    showPreview(appState.charData, sanitizedOptions, chatPalette, isInitial);

    // 裏のtextareaにも値を入れておく
    const cpTextarea = document.getElementById('preview-chatpalette');
    if (cpTextarea) cpTextarea.value = chatPalette;

    if (redrawBuilder) {
      renderPaletteBuilder(appState.charData, sanitizedOptions, rebuildOutput);
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
  appState.reset();

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

      // サービスごとのAPIエンドポイントに変換
      let apiUrl;
      if (service === 'hokanjo') {
        // 保管所: {id}.js でJSON取得
        apiUrl = `https://charasheet.vampire-blood.net/${id}.js`;
      } else if (service === 'charaeno') {
        // キャラエノ: summary APIでJSON取得
        apiUrl = `https://charaeno.com/api/v1/6th/${id}/summary`;
      } else {
        apiUrl = url;
      }

      try {
        const body = await fetchWithProxy(apiUrl);
        charData = await parse(service, body, id);
      } catch (fetchErr) {
        if (service === 'charaeno') {
          // 404（キャラが存在しない）以外はプロキシ/通信エラーとしてココフォリア出力貼り付けへ誘導
          if (fetchErr instanceof AppError && fetchErr.code === 'HTTP_NOT_FOUND') {
            throw fetchErr;
          }
          throw new AppError('CHARAENO_FETCH_FAILED', fetchErr.message || fetchErr.detail);
        }
        throw fetchErr;
      }
    }

    appState.characterName = charData.name || '名無し';
    appState.charData = charData;

    // JSONで色が指定されていた場合、カラーピッカーに反映
    if (charData.originalColor && validation.type === 'json') {
      const customRadio = document.querySelector('input[name="chatColorMode"][value="custom"]');
      if (customRadio) {
        customRadio.checked = true;
      }
      updateChatColorUI(charData.originalColor);
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
  if (!appState.currentJsonStr) return;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(appState.currentJsonStr);
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
 * チャットカラーのUI（隠しinput、スウォッチ、HEX表示、ピッカー）を一括更新する
 * @param {string} hexColor
 */
function updateChatColorUI(hexColor, { skipPicker = false } = {}) {
  if (!hexColor) return;
  const hex = hexColor.toUpperCase();
  const hiddenInput = document.getElementById('opt-chat-color');
  if (hiddenInput) hiddenInput.value = hex;

  const swatch = document.getElementById('chat-color-swatch');
  if (swatch) swatch.style.backgroundColor = hex;

  const hexText = document.getElementById('chat-color-hex');
  if (hexText) hexText.textContent = hex;

  // skipPicker=true のとき（onChange 経由）はピッカーに再設定しない
  // （再設定すると _updateState→rgbToHsv でカーソルが正規化位置に飛ぶ）
  if (!skipPicker && colorPickerInstance) {
    colorPickerInstance.setColorStr(hex);
  }
}

/**
 * カラーピッカーおよびポップオーバーの初期化
 */
function setupChatColorPicker() {
  const popoverEl = document.getElementById('global-color-picker-container');
  const triggerBtn = document.getElementById('btn-chat-color-trigger');
  if (!popoverEl || !triggerBtn) return;

  const initialColor = document.getElementById('opt-chat-color')?.value || '#A4C2F4';

  // ColorPicker インスタンス初期化 (hasAlpha: false)
  colorPickerInstance = new ColorPicker(popoverEl, {
    color: initialColor,
    hasAlpha: false,
    onChange: (hex) => {
      // skipPicker: true — ピッカー自身が色を変えたので再設定不要
      updateChatColorUI(hex, { skipPicker: true });
      requestRebuild();
    },
  });

  const positionPopover = () => {
    const triggerRect = triggerBtn.getBoundingClientRect();
    const popoverRect = popoverEl.getBoundingClientRect();
    const margin = 6;

    let top = triggerRect.bottom + margin;
    let left = triggerRect.left;

    // 画面下部からはみ出る場合は上側に表示
    if (top + popoverRect.height > window.innerHeight && triggerRect.top > popoverRect.height + margin) {
      top = triggerRect.top - popoverRect.height - margin;
    }

    // 画面右端からはみ出る場合は左に寄せる
    if (left + popoverRect.width > window.innerWidth) {
      left = Math.max(10, window.innerWidth - popoverRect.width - 16);
    }

    popoverEl.style.top = `${Math.round(top)}px`;
    popoverEl.style.left = `${Math.round(left)}px`;
  };

  const openPopover = () => {
    popoverEl.classList.add('visible');
    popoverEl.setAttribute('aria-hidden', 'false');
    positionPopover();
  };

  const closePopover = () => {
    popoverEl.classList.remove('visible');
    popoverEl.setAttribute('aria-hidden', 'true');
  };

  triggerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (popoverEl.classList.contains('visible')) {
      closePopover();
    } else {
      openPopover();
    }
  });

  // 外側クリックで閉じる
  document.addEventListener('pointerdown', (e) => {
    if (!popoverEl.classList.contains('visible')) return;
    if (!popoverEl.contains(e.target) && !triggerBtn.contains(e.target)) {
      closePopover();
    }
  });

  // Escキーで閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && popoverEl.classList.contains('visible')) {
      closePopover();
    }
  });

  // リサイズ・スクロール時の追従
  window.addEventListener('resize', () => {
    if (popoverEl.classList.contains('visible')) positionPopover();
  });
  window.addEventListener(
    'scroll',
    () => {
      if (popoverEl.classList.contains('visible')) positionPopover();
    },
    { passive: true }
  );

  // プリセット適用イベント受信時の反映
  window.addEventListener('presetColorApplied', (e) => {
    if (e.detail?.color) {
      updateChatColorUI(e.detail.color);
    }
  });
}

/**
 * UIオプションの連動制御を設定
 */
function setupOptionControls() {
  const optAllStatTimes5 = document.getElementById('opt-show-stat-times5-all');
  const individualStatTimes5 = document.querySelectorAll('.opt-stat-times5');
  const chatColorRadios = document.querySelectorAll('input[name="chatColorMode"]');

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

  // 2. チャットカラーラジオボタンの連動制御
  chatColorRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      requestRebuild();
    });
  });

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

const bindRemoveAndRebuild = (container) => {
  const removeBtn = container.querySelector('.ccfolia-btn-icon--remove');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      container.remove();
      requestRebuild();
    });
  }
  const inputs = container.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('input', requestRebuild);
    input.addEventListener('change', requestRebuild);
  });
};

/**
 * プレビュー画面の動的コントロール（＋／－ボタン）のセットアップ
 */
function setupPreviewDynamicControls() {
  const btnAddFace = document.getElementById('btn-add-face');
  const btnAddStatus = document.getElementById('btn-add-status');
  const btnAddParam = document.getElementById('btn-add-param');

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
  setupChatColorPicker();
  setupOptionControls();
  setupRebuildListeners();
  setupPreviewDynamicControls();

  // プリセットUIのセットアップ
  setupPresetUI({
    onApply: () => {
      if (appState.charData) {
        rebuildOutput(true, false);
      } else {
        const rawOptions = collectOptions();
        const sanitizedOptions = sanitizeOptions(rawOptions);
        renderPaletteBuilder(null, sanitizedOptions, rebuildOutput);
      }
    },
    bindDynamicRowListeners: bindRemoveAndRebuild,
  });

  // 初回ロード時: 前回使用したプリセットの復元
  const lastIndex = getLastPresetIndex();
  if (lastIndex !== null) {
    const lastPresetData = loadPresetFromSlot(lastIndex);
    if (lastPresetData) {
      applyPresetDataToUI(lastPresetData, bindRemoveAndRebuild);
    }
  }

  // 初回ロード用キャラクターデータ（取得技能0件）の初期化とチャットパレット・JSON描画
  appState.charData = createInitialCharacterData();
  appState.characterName = appState.charData.name;
  rebuildOutput(true, false);

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
