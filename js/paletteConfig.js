/**
 * paletteConfig.js
 * チャットパレット構成（ビルダーUI）の管理を行います。
 */

import { getBlockText } from './chatpalette.js';

export const DEFAULT_PALETTE_BLOCKS = [
  { id: 'custom-1', type: 'custom', title: '基本コマンド', content: '1d10\n1d100\nRESB(-)\nCCB<= 【】', visible: true, isExpanded: false, isDeletable: true },
  { id: 'special_rolls', type: 'special_rolls', title: '共通ロール', visible: true, isExpanded: false, isDeletable: false },
  { id: 'stats', type: 'stats', title: '能力値×5', visible: true, isExpanded: false, isDeletable: false },
  { id: 'skills', type: 'skills', title: '取得技能', visible: true, isExpanded: false, isDeletable: false },
  { id: 'initial_skills', type: 'initial_skills', title: '初期値技能', visible: true, isExpanded: false, isDeletable: false }
];

let blocksState = JSON.parse(JSON.stringify(DEFAULT_PALETTE_BLOCKS));

let dragSrcEl = null;

/**
 * 外部から現在のブロック構成を取得する
 */
export function getPaletteBlocks() {
  return blocksState;
}

/**
 * プリセット保存用にブロック構成をシリアライズ（isExpandedを除外したディープコピー）
 */
export function serializePaletteBlocks() {
  return blocksState.map(block => ({
    id: block.id,
    type: block.type,
    title: block.title,
    content: block.content ?? '',
    visible: block.visible !== false,
    isDeletable: !!block.isDeletable
  }));
}

/**
 * 外部からブロック構成を設定する（リセット・プリセット復元用など）
 */
export function setPaletteBlocks(newBlocks) {
  if (!Array.isArray(newBlocks) || newBlocks.length === 0) {
    blocksState = JSON.parse(JSON.stringify(DEFAULT_PALETTE_BLOCKS));
    return;
  }
  blocksState = newBlocks.map(block => ({
    id: block.id,
    type: block.type,
    title: block.title,
    content: block.content ?? '',
    visible: block.visible !== false,
    isExpanded: false,
    isDeletable: !!block.isDeletable
  }));
}

/**
 * ビルダーUIを描画する
 * @param {object} charData - プレビュー用
 * @param {object} options - プレビュー用
 * @param {function} onUpdate - ブロックが変更された際に呼ばれるコールバック
 */
export function renderPaletteBuilder(charData, options, onUpdate) {
  const container = document.getElementById('chatpalette-builder');
  if (!container) return;

  // 初期値技能の表示状態と同期 (STEP2のチェックボックス)
  const initialSkillsCheckbox = document.getElementById('opt-show-initial-skills');
  if (initialSkillsCheckbox) {
    const initialBlock = blocksState.find(b => b.id === 'initial_skills');
    if (initialBlock) {
      initialBlock.visible = initialSkillsCheckbox.checked;
    }
  }

  // 特殊ロールの表示状態と同期（1つでもチェックがあればブロック表示、全オフなら非表示）
  const specialRollCheckboxes = document.querySelectorAll('.opt-special-roll');
  if (specialRollCheckboxes.length > 0) {
    const specialBlock = blocksState.find(b => b.id === 'special_rolls');
    if (specialBlock) {
      const anyChecked = Array.from(specialRollCheckboxes).some(cb => cb.checked);
      specialBlock.visible = anyChecked;
    }
  }

  container.innerHTML = '';

  blocksState.forEach((block, index) => {
    if (!block.visible) return; // 非表示のものはDOMに描画しない（設定UIと統合する場合は描画してグレーアウト等にする手もあるが、今は削除/追加の挙動に近いため描画しない）
    // 待って。初期値技能などはチェックボックスと連動するため、非表示なら描画しない。

    const blockEl = document.createElement('div');
    blockEl.className = `cp-block ${block.isExpanded ? 'is-expanded' : ''}`;
    blockEl.draggable = true;
    blockEl.dataset.index = index;

    // --- Left Sidebar ---
    const sidebarEl = document.createElement('div');
    sidebarEl.className = 'cp-block__sidebar';

    // Drag Handle (top)
    const dragHandle = document.createElement('div');
    dragHandle.className = 'cp-block__drag-handle';
    dragHandle.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>';

    // Up button
    const btnUp = document.createElement('button');
    btnUp.className = 'cp-action-btn';
    btnUp.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>';
    btnUp.disabled = !isAnyVisibleBefore(index);
    btnUp.addEventListener('click', (e) => { e.stopPropagation(); moveBlock(index, -1, onUpdate); });

    // Down button
    const btnDown = document.createElement('button');
    btnDown.className = 'cp-action-btn';
    btnDown.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
    btnDown.disabled = !isAnyVisibleAfter(index);
    btnDown.addEventListener('click', (e) => { e.stopPropagation(); moveBlock(index, 1, onUpdate); });

    sidebarEl.appendChild(dragHandle);
    sidebarEl.appendChild(btnUp);
    sidebarEl.appendChild(btnDown);

    // Delete button (only for custom blocks)
    if (block.isDeletable) {
      const btnDelete = document.createElement('button');
      btnDelete.className = 'cp-action-btn cp-action-btn--delete';
      btnDelete.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      btnDelete.addEventListener('click', (e) => { e.stopPropagation(); blocksState.splice(index, 1); onUpdate(true); });
      sidebarEl.appendChild(btnDelete);
    }

    // --- Text Body (right side) ---
    const bodyEl = document.createElement('div');
    bodyEl.className = 'cp-block__body';

    // 実際に生成されるテキストを取得
    const previewText = getBlockText(charData, options, block) || '(空のブロック)';

    const previewEl = document.createElement('pre');
    previewEl.className = `cp-block__text-preview ${block.type === 'custom' ? 'custom-preview' : ''}`;
    previewEl.textContent = previewText;
    bodyEl.appendChild(previewEl);

    const fadeEl = document.createElement('div');
    fadeEl.className = 'cp-block__fade';
    bodyEl.appendChild(fadeEl);

    if (block.type === 'custom') {
      const editorEl = document.createElement('div');
      editorEl.className = 'cp-block__editor';
      const textarea = document.createElement('textarea');
      textarea.value = block.content;
      textarea.placeholder = 'チャットパレットの内容を入力...';
      textarea.addEventListener('input', e => {
        block.content = e.target.value;
        onUpdate(false);
        previewEl.textContent = block.content || '(空のブロック)';
      });
      textarea.addEventListener('click', e => e.stopPropagation());
      editorEl.appendChild(textarea);
      bodyEl.appendChild(editorEl);
    }

    // テキスト本体クリックで展開・折りたたみ
    bodyEl.addEventListener('click', () => {
      block.isExpanded = !block.isExpanded;
      blockEl.classList.toggle('is-expanded', block.isExpanded);
    });

    blockEl.appendChild(sidebarEl);
    blockEl.appendChild(bodyEl);

    // Drag & Drop Events
    blockEl.addEventListener('dragstart', handleDragStart);
    blockEl.addEventListener('dragover', handleDragOver);
    blockEl.addEventListener('drop', handleDrop);
    blockEl.addEventListener('dragend', function (e) { handleDragEnd.call(this, e, onUpdate); });

    container.appendChild(blockEl);
  });
}

/**
 * カスタムブロックを追加する
 */
export function addCustomBlock(onUpdate) {
  blocksState.push({
    id: `custom-${Date.now()}`,
    type: 'custom',
    title: '新規ブロック',
    content: '',
    visible: true,
    isExpanded: true,
    isDeletable: true
  });
  onUpdate(true);
}

/**
 * ブロックの順序を移動する
 */
function moveBlock(currentIndex, direction, onUpdate) {
  const targetIndex = currentIndex + direction;
  if (targetIndex < 0 || targetIndex >= blocksState.length) return;

  // 入れ替え先が非表示ブロックの場合はさらにスキップする
  let actualTarget = targetIndex;
  while (actualTarget >= 0 && actualTarget < blocksState.length && !blocksState[actualTarget].visible) {
    actualTarget += direction;
  }

  if (actualTarget >= 0 && actualTarget < blocksState.length) {
    const temp = blocksState[currentIndex];
    blocksState[currentIndex] = blocksState[actualTarget];
    blocksState[actualTarget] = temp;
    onUpdate(true);
  }
}

function isAnyVisibleBefore(index) {
  for (let i = index - 1; i >= 0; i--) {
    if (blocksState[i].visible) return true;
  }
  return false;
}

function isAnyVisibleAfter(index) {
  for (let i = index + 1; i < blocksState.length; i++) {
    if (blocksState[i].visible) return true;
  }
  return false;
}

// === Drag & Drop Handlers ===
let lastDragOverElement = null;
let lastIsBottom = false;

function handleDragStart(e) {
  dragSrcEl = this;
  lastDragOverElement = null;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.index);

  // ドラッグ元を半透明にする（setTimeoutでゴースト画像には適用されないようにする）
  setTimeout(() => this.classList.add('dragging'), 0);
}

function handleDragOver(e) {
  if (e.preventDefault) e.preventDefault(); // 必須

  if (this === dragSrcEl) {
    return false; // 自分自身の上では何もしない
  }

  const bounding = this.getBoundingClientRect();
  const offset = e.clientY - bounding.top;
  const isBottom = offset > bounding.height / 2;

  // 位置が変わった場合のみDOMを動かす
  if (lastDragOverElement !== this || lastIsBottom !== isBottom) {
    lastDragOverElement = this;
    lastIsBottom = isBottom;

    // DOMを視覚的に移動させてプレビューする
    const parent = this.parentNode;
    if (isBottom) {
      parent.insertBefore(dragSrcEl, this.nextSibling);
    } else {
      parent.insertBefore(dragSrcEl, this);
    }
  }

  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDrop(e) {
  if (e.stopPropagation) e.stopPropagation();

  if (dragSrcEl && lastDragOverElement && dragSrcEl !== lastDragOverElement) {
    const srcIndex = parseInt(dragSrcEl.dataset.index, 10);
    const destIndex = parseInt(lastDragOverElement.dataset.index, 10);

    // 配列の要素を移動
    const item = blocksState.splice(srcIndex, 1)[0];

    let adjustedDest = destIndex;
    if (srcIndex < destIndex) {
      adjustedDest--;
    }
    if (lastIsBottom) {
      adjustedDest++;
    }

    blocksState.splice(adjustedDest, 0, item);
  }

  return false;
}

function handleDragEnd(e, onUpdate) {
  this.classList.remove('dragging');
  dragSrcEl = null;
  lastDragOverElement = null;

  // ドロップ成功/失敗に関わらず、現在の blocksState からUIとJSONを完全再描画する
  // 失敗した場合は元の順序に戻り、成功した場合は新しい順序で確定する
  onUpdate(true);
}
