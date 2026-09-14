/**
 * js/utils.js
 *
 * アプリケーション全体で共有される汎用ユーティリティ関数
 */

/**
 * 文字列中の特殊文字をHTMLエスケープする
 * @param {string|number|null|undefined} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 指定したIDのチェックボックス要素のchecked状態を安全に設定する
 * @param {string} id - 要素ID
 * @param {boolean} checked - チェック状態
 */
export function setCheckboxChecked(id, checked) {
  const el = document.getElementById(id);
  if (el && el.type === 'checkbox') {
    el.checked = !!checked;
  }
}

/**
 * 動的行の削除ボタンHTMLを生成する
 * @returns {string}
 */
export function createRemoveBtn() {
  return `<button type="button" class="ccfolia-btn-icon ccfolia-btn-icon--remove" title="削除" aria-label="削除">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  </button>`;
}
