/**
 * js/ui.js
 *
 * DOM操作およびUI表示制御を担当するモジュール。
 * 画面のローディング、エラー・警告表示、プレビュー描画処理を行います。
 */

/**
 * ローディング状態を切り替える
 * @param {boolean} show - 表示するかどうか
 */
export function showLoading(show) {
  const overlay = document.getElementById('loading-overlay');
  const btnConvert = document.getElementById('btn-convert');
  
  if (overlay) {
    if (show) {
      overlay.classList.add('visible');
    } else {
      overlay.classList.remove('visible');
    }
  }

  if (btnConvert) {
    btnConvert.disabled = show;
    const textNode = btnConvert.querySelector('.btn-text') || btnConvert;
    if (show) {
      if (!btnConvert.dataset.originalText) {
        btnConvert.dataset.originalText = textNode.textContent;
      }
      textNode.textContent = '取得中...';
    } else {
      if (btnConvert.dataset.originalText) {
        textNode.textContent = btnConvert.dataset.originalText;
      }
    }
  }
}

/**
 * エラーバナーを表示する。引数が null の場合は非表示にする。
 * @param {import('./constants.js').AppError | null} error 
 */
export function showError(error) {
  const errorBanner = document.getElementById('error-banner');
  const errorText = document.getElementById('error-text');
  
  if (!errorBanner) return;

  if (error) {
    if (errorText) {
      errorText.textContent = error.userMessage;
    }
    errorBanner.classList.add('visible');
    errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    errorBanner.classList.remove('visible');
  }
}

/**
 * 警告バナーを表示する。リストが空の場合は非表示にする。
 * @param {string[]} warnings 
 */
export function showWarnings(warnings) {
  const warningBanner = document.getElementById('warning-banner');
  const warningList = document.getElementById('warning-list');
  
  if (!warningBanner) return;

  if (warnings && warnings.length > 0) {
    if (warningList) {
      warningList.innerHTML = '';
      warnings.forEach(warning => {
        const li = document.createElement('li');
        li.textContent = warning;
        warningList.appendChild(li);
      });
    }
    warningBanner.classList.add('visible');
  } else {
    warningBanner.classList.remove('visible');
  }
}

/**
 * キャラクターデータのプレビューを表示する
 * @param {import('./constants.js').CharacterData} charData 
 * @param {object} options 
 * @param {string} chatPalette 
 * @param {boolean} isInitial - 初回表示かどうか（trueの場合のみ入力項目を上書き）
 */
export function showPreview(charData, options, chatPalette, isInitial = false) {
  const previewSection = document.getElementById('preview-section');
  if (!previewSection) return;

  if (isInitial) {
    // 基本情報
    setValue('preview-name', charData.name || '名無し');
    setValue('preview-initiative', charData.stats?.DEX || 0);

    // メモ
    setValue('preview-memo', charData.memo || '');

    // 駒サイズ・座標
    setValue('preview-size', options.tokenSize);
    setValue('preview-x', options.tokenSize * -12);
    setValue('preview-y', options.tokenSize * -12);

    // 参照URL
    setValue('preview-url', charData.externalUrl || charData.url || '');

    // アイコン画像
    const iconPlaceholder = document.querySelector('.ccfolia-icon-placeholder');
    if (iconPlaceholder) {
      // ココフォリア側で画像URLからの直接貼り付けが許可されていないため、常にデフォルトアイコンを表示
      iconPlaceholder.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    }

    // ステータス（固定）
    const stats = charData.stats || {};
    setValue('preview-hp-val', stats.currentHP || 0);
    setValue('preview-hp-max', stats.maxHP || 0);
    setValue('preview-mp-val', stats.currentMP || 0);
    setValue('preview-mp-max', stats.maxMP || 0);
    setValue('preview-san-val', stats.currentSAN || 0);
    setValue('preview-san-max', stats.initialSAN || 0);

    // パラメータ（固定）
    const paramNames = ['STR', 'CON', 'POW', 'DEX', 'APP', 'SIZ', 'INT', 'EDU', 'DB'];
    paramNames.forEach(param => {
      setValue(`preview-param-${param}`, stats[param] !== undefined ? stats[param] : (param === 'DB' ? '' : 0));
    });

    // カスタム項目の初期化
    const customStatusContainer = document.getElementById('preview-status-custom');
    if (customStatusContainer) customStatusContainer.innerHTML = '';
    
    const customParamsContainer = document.getElementById('preview-params-custom');
    if (customParamsContainer) customParamsContainer.innerHTML = '';
    
    const facesContainer = document.getElementById('preview-faces-grid');
    if (facesContainer) facesContainer.innerHTML = '';

    // トグル
    setCheckbox('preview-secret', options.hideStatus);
    setCheckbox('preview-invisible', options.invisible);
    setCheckbox('preview-hide-status', options.hideStatusFromBoard);
  }

  // チャットパレット (常に更新)
  setValue('preview-chatpalette', chatPalette || '');

  // 警告表示の連動 (常に更新)
  showWarnings(charData.parseWarnings || []);
}

/**
 * プレビューセクションを非表示にする
 */
export function hidePreview() {
  const previewSection = document.getElementById('preview-section');
  if (previewSection) {
    previewSection.classList.remove('visible');
  }
}

/**
 * トースト通知を表示する
 * @param {string} message - メッセージ
 * @param {'success' | 'error'} type - 種類
 */
export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container') || document.body;
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // 3秒後に消去アニメーションを開始
  setTimeout(() => {
    toast.classList.add('hiding');
    // アニメーション完了後にDOMから削除
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 3000);
}

/**
 * 要素の値を安全に設定するヘルパー関数
 * @param {string} id - 要素ID
 * @param {string | number} val - 値
 */
function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.value = val !== undefined && val !== null ? val : '';
    } else {
      el.textContent = val !== undefined && val !== null ? val : '-';
    }
  }
}

/**
 * チェックボックスのチェック状態を設定するヘルパー関数
 * @param {string} id - 要素ID
 * @param {boolean} checked - チェック状態
 */
function setCheckbox(id, checked) {
  const el = document.getElementById(id);
  if (el && el.type === 'checkbox') {
    el.checked = !!checked;
  }
}
