/**
 * js/state.js
 *
 * アプリケーションの状態管理モジュール。
 * EventTarget を継承し、状態変更時にイベントを購読できるようにします。
 */

export class AppState extends EventTarget {
  #currentJsonStr = '';
  #characterName = '';
  #charData = null;

  /**
   * 生成されたココフォリアJSON文字列
   * @returns {string}
   */
  get currentJsonStr() {
    return this.#currentJsonStr;
  }

  set currentJsonStr(val) {
    this.#currentJsonStr = String(val || '');
    this.dispatchEvent(new CustomEvent('change', { detail: { key: 'currentJsonStr', value: this.#currentJsonStr } }));
  }

  /**
   * キャラクター名
   * @returns {string}
   */
  get characterName() {
    return this.#characterName;
  }

  set characterName(val) {
    this.#characterName = String(val || '');
    this.dispatchEvent(new CustomEvent('change', { detail: { key: 'characterName', value: this.#characterName } }));
  }

  /**
   * パース済みのキャラクターデータオブジェクト
   * @returns {object|null}
   */
  get charData() {
    return this.#charData;
  }

  set charData(val) {
    this.#charData = val;
    this.dispatchEvent(new CustomEvent('change', { detail: { key: 'charData', value: this.#charData } }));
  }

  /**
   * 状態を初期状態にリセットする
   */
  reset() {
    this.#currentJsonStr = '';
    this.#characterName = '';
    this.#charData = null;
    this.dispatchEvent(new CustomEvent('reset'));
  }
}

export const appState = new AppState();
