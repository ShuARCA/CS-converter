/**
 * chatpalette.js — チャットパレット文字列生成モジュール
 *
 * CharacterData + Options + Blocks → チャットパレット文字列を生成する。
 */

import { SKILLS } from './constants.js';

/**
 * diceCommand に基づくコマンド接頭詞を決定
 * @param {string} diceCommand - 'CCB' | 'CC' | '1d100'
 * @returns {string} コマンド文字列
 */
export function getCmd(diceCommand) {
  switch (diceCommand) {
    case 'CC': return 'CC';
    case '1d100': return '1d100';
    default: return 'CCB';
  }
}

/**
 * 特殊ロール（SAN値チェック、不定リセット、アイデア、幸運、知識）のチャットパレット文字列を生成する
 */
export function generateSpecialRollsLines(charData, options) {
  const cmd = getCmd(options.diceCommand);
  const lines = [];
  const rolls = options.showSpecialRolls || {};
  const s = charData.stats || {};

  if (rolls.san_check) {
    lines.push(`${cmd}<={SAN} 【SAN値チェック】`);
  }
  if (rolls.indefinite_reset) {
    lines.push(`:SAN.max={SAN} 不定リセット`);
  }
  if (rolls.idea) {
    const idea = (s.INT || 0) * 5;
    lines.push(`${cmd}<=${idea} 【アイデア】`);
  }
  if (rolls.luck) {
    const luck = (s.POW || 0) * 5;
    lines.push(`${cmd}<=${luck} 【幸運】`);
  }
  if (rolls.knowledge) {
    const knowledge = (s.EDU || 0) * 5;
    lines.push(`${cmd}<=${knowledge} 【知識】`);
  }
  return lines.join('\n');
}

/**
 * 能力値×5のチャットパレット文字列を生成する
 */
export function generateStatsLines(charData, options) {
  const cmd = getCmd(options.diceCommand);
  const lines = [];
  const statNames = ['STR', 'CON', 'POW', 'DEX', 'APP', 'SIZ', 'INT', 'EDU'];
  const enabledStats = statNames.filter(stat =>
    options.showStatTimes5All || (options.showStatTimes5 && options.showStatTimes5[stat])
  );

  if (enabledStats.length > 0) {
    for (const stat of enabledStats) {
      lines.push(`${cmd}<={${stat}}*5 【${stat}×5】`);
    }
  }
  return lines.join('\n');
}

/**
 * 取得技能のチャットパレット文字列を生成する
 */
export function generateSkillsLines(charData, options) {
  const cmd = getCmd(options.diceCommand);
  const lines = [];
  const s = charData.stats;

  // Step 1: ベースリスト（isAcquired=true の技能をSKILLS定義順で）
  const acquiredSkills = [];
  for (const skillDef of SKILLS) {
    const entry = charData.skills.find(sk => sk.name === skillDef.name);
    if (entry && entry.isAcquired) {
      acquiredSkills.push(entry);
    }
  }

  // Step 2: 強制追加（重複排除）
  const skillNameSet = new Set(acquiredSkills.map(sk => sk.name));

  // 回避の強制追加
  if (options.showDodge && !skillNameSet.has('回避')) {
    const dodgeEntry = charData.skills.find(sk => sk.name === '回避');
    if (dodgeEntry) {
      acquiredSkills.unshift(dodgeEntry); // 先頭に追加
      skillNameSet.add('回避');
    }
  }

  // 目星・聞き耳・図書館の強制追加
  if (options.showPerceptionSkills) {
    const perceptionSkills = ['目星', '聞き耳', '図書館'];
    for (const skillName of perceptionSkills) {
      if (!skillNameSet.has(skillName)) {
        const entry = charData.skills.find(sk => sk.name === skillName);
        if (entry) {
          acquiredSkills.push(entry); // 末尾に追加
          skillNameSet.add(skillName);
        }
      }
    }
  }

  // Step 3: 各エントリーのフォーマット
  for (const skill of acquiredSkills) {
    lines.push(`${cmd}<=${skill.value} 【${skill.displayName}】`);

    // showCombatDamage=true の場合、ダメージ行を追加
    if (options.showCombatDamage) {
      const skillDef = SKILLS.find(sd => sd.name === skill.name);
      if (skillDef && skillDef.damage) {
        // ダメージダイス + DB（例: "1d3+1d4"）
        lines.push(`${skillDef.damage}${s.DB} 【${getBaseName(skill.displayName)} ダメージ】`);
      }
    }
  }
  return lines.join('\n');
}

/**
 * 初期値技能のチャットパレット文字列を生成する
 */
export function generateInitialSkillsLines(charData, options) {
  const cmd = getCmd(options.diceCommand);
  const lines = [];

  // 取得技能のセットを作成して除外
  const acquiredSkillNames = new Set();
  for (const sk of charData.skills) {
    if (sk.isAcquired) acquiredSkillNames.add(sk.name);
  }
  // 強制追加される可能性のあるものも除外
  if (options.showDodge) acquiredSkillNames.add('回避');
  if (options.showPerceptionSkills) {
    acquiredSkillNames.add('目星');
    acquiredSkillNames.add('聞き耳');
    acquiredSkillNames.add('図書館');
  }

  const initialSkills = charData.skills.filter(sk =>
    !sk.isAcquired && sk.value > 0 && !acquiredSkillNames.has(sk.name)
  );

  if (initialSkills.length > 0) {
    for (const skill of initialSkills) {
      lines.push(`${cmd}<=${skill.value} 【${skill.displayName}】`);
    }
  }
  return lines.join('\n');
}

/**
 * 単一ブロックの最終的なテキストを取得する
 */
export function getBlockText(charData, options, block) {
  let content = '';
  let addHeader = true;

  if (block.type === 'custom') {
    content = block.content || '';
    addHeader = false; // カスタムブロックはヘッダーなし
  } else if (block.type === 'special_rolls') {
    content = generateSpecialRollsLines(charData, options);
  } else if (block.type === 'stats') {
    content = generateStatsLines(charData, options);
  } else if (block.type === 'skills') {
    content = generateSkillsLines(charData, options);
  } else if (block.type === 'initial_skills') {
    content = generateInitialSkillsLines(charData, options);
  }

  if (content.trim()) {
    if (addHeader && block.title) {
      // ブロックの末尾に空行を入れる（次のブロックとの余白）
      return `【${block.title}】----------------\n${content.trim()}\n　`;
    }
    // カスタムブロックも末尾に空行
    return `${content.trim()}\n　`;
  }
  return '';
}

/**
 * ブロック設定配列に基づいて最終的なチャットパレット文字列を構築する
 * @param {object} charData - CharacterData
 * @param {object} options - Options
 * @param {Array} blocks - ブロック構成配列
 * @returns {string} チャットパレット文字列
 */
export function buildChatPalette(charData, options, blocks = []) {
  if (!blocks || blocks.length === 0) {
    return '';
  }

  const resultLines = [];

  for (const block of blocks) {
    if (!block.visible) continue;

    const text = getBlockText(charData, options, block);
    if (text) {
      resultLines.push(text);
    }
  }

  return resultLines.join('\n');
}

/**
 * 技能表示名から基本名を取得（ダメージ行用）
 * 例: "こぶし（パンチ）" → "こぶし"
 * @param {string} displayName
 * @returns {string}
 */
function getBaseName(displayName) {
  return displayName.replace(/[（(].*[）)]/, '').trim();
}
