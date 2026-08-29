/* ============================================================
 * 骑士基地：世界起源 - core.js
 * 命名空间 / 全局配置 / 数学工具 / 可播种RNG / 对象池 / 事件总线
 * ============================================================ */
'use strict';
window.KB = window.KB || {};

/* ---------- 全局调参配置（平衡迭代只改这里） ---------- */
KB.CONFIG = {
  GRID_ROWS: 5,          // 战场行数
  GRID_COLS: 9,          // 战场列数
  ENERGY_START: 75,      // 开局勇气币
  ENERGY_REGEN: 5,       // 勇气币每秒回复
  ENERGY_CAP: 9999,
  CRIT_CHANCE: 0.05,     // 暴击率
  CRIT_MULT: 1.5,        // 暴击倍率
  DMG_VAR: [0.9, 1.1],   // 伤害随机浮动
  DEF_K: 100,            // 防御递减常数: def/(def+DEF_K)
  COSTS: [50, 75, 100, 125, 150],        // 费用档 C1..C5 → 勇气币
  CARD_CD: [5, 6, 7, 8, 10],             // 卡片冷却(秒) 按费用档
  MERGE_MULT: 1.5,       // 局内合并属性倍率
  MERGE_MAX: 3,          // 局内合并上限等级
  RARITY_MULT: [1, 1.2, 1.2 * 1.3],      // 白/紫/金 属性倍率
  RARITY_NAME: ['白', '紫', '金'],
  RARITY_COLOR: ['#b8c4d8', '#b06cf5', '#ffc93c'],
  LEVEL_MAX: 30,          // 骑士等级上限
  LEVEL_STEP: 0.10,       // 每级属性 +10%
  BASE_STAT_BONUS: 0.02,  // 基地每级全体属性 +2%
  BASE_ENERGY_START: 2,   // 基地每级开局勇气 +2
  BASE_ENERGY_REGEN: 0.05,// 基地每级勇气回复 +0.05/s
  BASE_UP_DISCOUNT: 0.01, // 基地每级骑士升级费用 -1%
  BASE_UP_DISCOUNT_CAP: 0.30,
  BASE_FUSION_MILESTONE: [5, 10, 15, 20], // 里程碑：融合折扣
  BASE_FUSION_DISCOUNT: [0.05, 0.10, 0.15, 0.20],
  POTION_COUNT: 3,        // 每局能量药水次数
  POTION_ENERGY: 100,     // 药水恢复勇气
  STAR_TIME_LIMIT: 180,   // 5星/7星时限（模拟秒）
  FUSION_COST: [0, 100, 1000],           // 白+白→紫 100 / 紫+紫→金 1000
  FUSION_GREAT_BONUS: 0.10,              // 融合大成功额外属性
  FUSION_GREAT_CHANCE_BASE: 0.15,        // 基础大成功率(随基地里程碑提升)
  GACHA_SINGLE: 200, GACHA_TEN: 1800,
  GACHA_RATES: [0.90, 0.09, 0.01],       // 白/紫/金
  GACHA_PITY_PURPLE: 10,                 // 十连保底紫
  GACHA_PITY_GOLD: 30,                   // 三十连保底金
  WORLD_COEFF: 2.1,       // 世界难度系数底数
  LVL_COEFF: 0.10,        // 每关难度递增
  KNIGHT_UP_COST: 50,     // 升级费用 = 50 × 等级 × 品质费用倍率
  RARITY_COST_MULT: [1, 2, 3],
  STARTER_COINS: 300,     // 新手赠送骑士币
  UI_MIN_BTN: 44,         // 最小按钮尺寸(pt)
  MAX_LOADOUT: 6,         // 出战卡上限
  CORE_HP_BASE: 1200,     // 基地核心血量基数
  CORE_HP_PER_WORLD: 240, // 每世界追加核心血量
  CORE_GRIND_RATE: 0.05,  // 城门磨蚀：驻留核心的敌人每秒损失最大生命的比例
  ELEMENTS: { none: '#cfd8e8', fire: '#ff7043', ice: '#4fc3f7', thunder: '#ffd54f',
             poison: '#9ccc65', dark: '#9575cd', light: '#fff176', nature: '#66bb6a' },
  ELEM_RING: ['fire', 'ice', 'thunder'],   // 相克环: fire>ice>thunder>fire
  ELEM_ADV: 1.3, ELEM_DIS: 0.85,
};

/* ---------- 数学工具 ---------- */
KB.math = {
  clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },
  lerp(a, b, t) { return a + (b - a) * t; },
  dist(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); },
  rand(a, b) { return a + Math.random() * (b - a); },
  randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); },
  chance(p) { return Math.random() < p; },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },
  fmtNum(n) { // 1.2万 简写
    n = Math.floor(n);
    if (n >= 100000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
    return String(n);
  },
  fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  },
};

/* ---------- 元素克制 ---------- */
KB.elemMult = function (atkElem, defElem) {
  const C = KB.CONFIG;
  if (!atkElem || !defElem || atkElem === 'none' || defElem === 'none') return 1;
  if (atkElem === defElem) return 1;
  const i = C.ELEM_RING.indexOf(atkElem), j = C.ELEM_RING.indexOf(defElem);
  if (i < 0 || j < 0) return 1;
  if ((i + 1) % 3 === j) return C.ELEM_ADV;   // 攻克
  if ((j + 1) % 3 === i) return C.ELEM_DIS;   // 被克
  return 1;
};

/* ---------- 可播种 RNG (mulberry32) ---------- */
KB.RNG = function (seed) {
  let a = seed >>> 0;
  const fn = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  fn.range = (lo, hi) => lo + fn() * (hi - lo);
  fn.int = (lo, hi) => lo + Math.floor(fn() * (hi - lo + 1));
  fn.pick = (arr) => arr[Math.floor(fn() * arr.length)];
  fn.chance = (p) => fn() < p;
  return fn;
};

/* ---------- 对象池 ---------- */
KB.Pool = function (factory, reset) {
  const free = [], active = [];
  return {
    get() {
      const o = free.pop() || factory();
      if (reset) reset(o);
      active.push(o);
      return o;
    },
    release(o) {
      const i = active.indexOf(o);
      if (i >= 0) { active.splice(i, 1); free.push(o); }
    },
    sweep(deadTest) { // 倒序回收，避免遍历中修改
      for (let i = active.length - 1; i >= 0; i--) {
        if (deadTest(active[i], i)) { free.push(active[i]); active.splice(i, 1); }
      }
    },
    forEach(fn) { for (let i = 0; i < active.length; i++) fn(active[i], i); },
    items() { return active; },
    clear() { for (const o of active) free.push(o); active.length = 0; },
    count() { return active.length; },
  };
};

/* ---------- 事件总线 ---------- */
KB.Bus = (function () {
  const map = {};
  return {
    on(ev, fn) { (map[ev] = map[ev] || []).push(fn); },
    off(ev, fn) { const l = map[ev]; if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } },
    emit(ev, data) { const l = map[ev]; if (l) for (let i = 0; i < l.length; i++) l[i](data); },
  };
})();
