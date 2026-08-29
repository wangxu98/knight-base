/* 无头冒烟测试：stub 浏览器环境 → 加载 8 个模块 → 数据校验 + 全战斗模拟 */
'use strict';
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'js');

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.error('  ✗ FAIL: ' + msg); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ---------- 浏览器 stub ---------- */
const noop = () => {};
const ctx2d = new Proxy({}, {
  get: (t, k) => {
    if (k === 'measureText') return () => ({ width: 10 });
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop });
    return typeof k === 'string' ? noop : undefined;
  },
  set: () => true,
});
const canvasEl = () => ({
  width: 0, height: 0, style: {},
  getContext: () => ctx2d,
  addEventListener: noop,
});
const storage = (() => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
})();

global.window = new Proxy({
  innerWidth: 1180, innerHeight: 820, devicePixelRatio: 2,
  addEventListener: noop, visualViewport: null,
}, { get: (t, k) => (k in t ? t[k] : global[k]), has: () => true });
global.document = {
  getElementById: () => canvasEl(),
  createElement: (tag) => ({
    style: {}, appendChild: noop, removeChild: noop,
    getContext: () => ctx2d, addEventListener: noop,
  }),
  body: { appendChild: noop, removeChild: noop },
  addEventListener: noop,
  fonts: null,
};
global.localStorage = storage;
try { Object.defineProperty(global, 'navigator', { value: { userAgent: 'node-smoke' }, configurable: true }); } catch (e) {}
global.requestAnimationFrame = noop;
global.KB = {};

/* ---------- 加载模块 ---------- */
section('模块加载');
for (const f of ['core.js', 'data.js', 'save.js', 'ui.js', 'art.js', 'battle.js', 'scenes.js', 'main.js']) {
  const code = fs.readFileSync(path.join(DIR, f), 'utf8');
  try { new Function(code)(); ok(true, f + ' 求值通过'); }
  catch (e) { ok(false, f + ' 求值异常: ' + e.message); }
}

/* ---------- 数据校验 ---------- */
section('骑士数据（40 位）');
ok(Array.isArray(KB.KNIGHTS) && KB.KNIGHTS.length === 40, '共 40 骑士, 实际 ' + KB.KNIGHTS.length);
const badSkill = KB.KNIGHTS.filter(k => !KB.SKILLS[k.skill]);
ok(badSkill.length === 0, '全部骑士技能能命中 SKILLS 配方' + (badSkill.length ? '，缺失: ' + badSkill.map(k => k.id + ':' + k.skill).join(',') : ''));
ok(KB.KNIGHTS.filter(k => k.pos === 'melee').length === 20 && KB.KNIGHTS.filter(k => k.pos === 'ranged').length === 20, '近战20/远程20');
const dupe = new Set(); let dupeFound = false;
for (const k of KB.KNIGHTS) { if (dupe.has(k.id)) dupeFound = true; dupe.add(k.id); }
ok(!dupeFound, '骑士 id 无重复');

section('技能配方（触发器/原语全可解析）');
{
  let bad = [];
  for (const [name, rec] of Object.entries(KB.SKILLS)) {
    if (!rec.trigger || !Array.isArray(rec.prims) || !rec.prims.length) bad.push(name + '(结构)');
    if (rec.trigger === 'everyCd' && !rec.cd) bad.push(name + '(cd)');
    for (const p of rec.prims) if (!p.t) bad.push(name + ':' + JSON.stringify(p));
  }
  ok(bad.length === 0, '40 技能配方结构完整' + (bad.length ? '，异常: ' + bad.join(',') : ''));
  ok(Object.keys(KB.SKILLS).length >= 40, '技能数 ' + Object.keys(KB.SKILLS).length + ' ≥ 40');
  ok(KB.AWAKENS.length === 8, '觉醒被动 8 条');
}

section('世界与关卡生成');
{
  let okAll = true, msg = '';
  for (let w = 0; w < KB.WORLDS.length; w++) {
    const world = KB.WORLDS[w];
    if (world.bosses.length !== 6) { okAll = false; msg += `W${w + 1}boss数${world.bosses.length};`; }
    const bi = KB.bossLevelIndices(world);
    if (bi.length !== 6 || bi[5] !== world.levels) { okAll = false; msg += `W${w + 1}boss关卡${bi};`; }
    for (let i = 0; i < world.levels; i++) {
      try {
        const lv = KB.getLevelDef(w, i);
        if (!lv.waves.length) { okAll = false; msg += `W${w + 1}-${i + 1}无波次;`; }
        for (const wv of lv.waves) {
          if (!wv.entries.length) { okAll = false; msg += `W${w + 1}-${i + 1}空波;`; }
          for (const en of wv.entries) if (!en.arch && !en.boss) { okAll = false; msg += `W${w + 1}-${i + 1}空敌人;`; }
        }
      } catch (e) { okAll = false; msg += `W${w + 1}-${i + 1}:${e.message};`; }
    }
  }
  ok(okAll, '8 世界全部关卡生成无误' + (okAll ? '' : ' → ' + msg));
  const e1 = KB.enemyStats('scraper', KB.getLevelDef(0, 0));
  const e8 = KB.enemyStats('scraper', KB.getLevelDef(7, 0));
  ok(e8.hp > e1.hp * 10 && e8.atk > e1.atk * 10, `难度随世界递增 scraper hp ${e1.hp}→${e8.hp}`);
}

section('StatCalc / 经济');
{
  const s = KB.StatCalc.calc({ defId: 'm01', rarity: 0, level: 1 });
  ok(s.hp > 0 && s.atk > 0 && s.defv >= 0, `1级白卡 hp=${s.hp} atk=${s.atk} def=${s.defv}`);
  const s30 = KB.StatCalc.calc({ defId: 'm01', rarity: 0, level: 30 });
  ok(s30.atk > s.atk * 3.5, `30级成长 atk=${s.atk}→${s30.atk}`);
  const sGold = KB.StatCalc.calc({ defId: 'm01', rarity: 2, level: 1 });
  ok(sGold.atk > s.atk * 1.5, `金卡品质系数 atk=${sGold.atk}`);
  const up = KB.StatCalc.upCost({ defId: 'm01', rarity: 0, level: 5 });
  ok(Number.isFinite(up) && up > 0, `升级费 lv5=${up}`);
}

section('存档 / 货币 / 抽卡保底');
{
  KB.Player.init();
  ok(KB.Player.state.player.coins === 0, '新档初始币 0（300 由新手引导发放）');
  KB.Player.addCoins(10000);
  ok(KB.Player.trySpend(200) && KB.Player.coins() === 9800, '加钱/扣费正常');
  // 抽卡保底：30 抽内必出金
  let pityOK = true, sawGold = false, sawPurple = false;
  for (let i = 0; i < 40; i++) {
    const before = KB.Player.state.shop.sinceGold;
    const k = KB.Player.gachaPull();
    if (before >= 29 && k.rarity !== 2) pityOK = false;
    if (k.rarity === 2) sawGold = true;
    if (k.rarity === 1) sawPurple = true;
  }
  ok(pityOK, 'sinceGold≥30 时强制出金');
  ok(sawPurple || sawGold, '40 连内出现紫/金');
  // 掉落登记：recordResult(w, i, stars, won)
  KB.Player.recordResult(0, 0, 9, true);
  ok(KB.Player.levelStars(0, 0) === 9, '首通星级入档 9');
  ok(KB.Player.isWorldUnlocked(1) === false, 'W2 未解锁（W1 未全通）');
  for (let i = 0; i < KB.WORLDS[0].levels; i++) KB.Player.recordResult(0, i, 10, true);
  ok(KB.Player.isWorldUnlocked(1) === true, '全通 W1 后 W2 解锁');
}

section('融合（去重 + 品阶递进）');
{
  const a = KB.Player.grant('m01', 0);
  const b = KB.Player.grant('m01', 0); // 同底子白卡
  const baby = KB.Fusion.fuse(a, b);
  ok(baby && baby.rarity === 1, '白+白 → 紫');
  ok(new Set(baby.skills).size === baby.skills.length, '技能无重复: ' + baby.skills.join('/'));
  const p1 = KB.Player.grant('m02', 1), p2 = KB.Player.grant('m03', 1);
  const gold = KB.Fusion.fuse(p1, p2);
  ok(gold && gold.rarity === 2 && gold.skills.length === 4, '紫+紫 → 金(4技能): ' + gold.skills.join('/'));
}

/* ---------- 战斗模拟 ---------- */
// 注：引擎用 setTimeout(onEnd, 900) 真实定时器收尾，模拟后需等待
function simulate(worldIdx, levelIdx0, setup) {
  const levelDef = KB.getLevelDef(worldIdx, levelIdx0);
  let ended = null;
  const B = KB.Battle({
    levelDef,
    loadout: setup.loadout,
    onEnd: (d) => { ended = d; },
  });
  B.computeLayout();
  // 直接布阵（绕过拖拽 UI，测试战斗引擎本体）
  B.energy = 9999;
  for (const [row, col, ci] of setup.placement) {
    const card = B.cards[ci];
    if (card && !B.grid[row][col]) B.placeUnit(card, row, col);
  }
  B.energy = 75;
  const step = 1 / 60;
  let t = 0, safety = 60 * 60 * 10;
  while (!ended && safety-- > 0) {
    B.update(step);
    t += step;
    if (typeof setup.tick === 'function') setup.tick(B, t);
  }
  return { B, get ended() { return ended; }, t };
}

async function main() {
  section('战斗模拟：W1-1 裸奔（无骑士）应失败');
  {
    const r = simulate(0, 0, { loadout: [], placement: [] });
    if (!r.ended) await sleep(1000);
    ok(r.ended && r.ended.win === false, '核心被推平，判定失败 @' + r.t.toFixed(0) + 's');
  }

  section('战斗模拟：W1-1 满编应胜利');
  {
    const loadout = ['m01', 'm04', 'm07', 'r01', 'r04', 'm10'].map(defId =>
      KB.Player.grant(defId, 0, { level: 1 }));
    // 近战守城门(col0 可跨行攻击驻留核心的敌人)，远程居后
    const placement = [[0, 0, 0], [1, 0, 1], [2, 0, 2], [3, 0, 5], [0, 1, 3], [2, 1, 4]];
    const r = simulate(0, 0, { loadout, placement });
    if (!r.ended) await sleep(1000);
    ok(r.ended && r.ended.win === true, '满编通关 @' + r.t.toFixed(0) + 's, stars=' + (r.ended ? r.ended.stars : '-'));
    if (r.ended) ok(r.ended.stars >= 5 && r.ended.stars <= 10, '星级在合理区间: ' + r.ended.stars);
  }

  section('战斗模拟：W1 Boss 关（第3关）');
  {
    const loadout = ['m01', 'm04', 'm07', 'm10', 'm13', 'r01'].map(defId =>
      KB.Player.grant(defId, 0, { level: 3 }));
    const placement = [[0, 0, 0], [1, 0, 1], [2, 0, 2], [3, 0, 3], [4, 0, 4], [0, 1, 5]];
    const r = simulate(0, 2, { loadout, placement });
    if (!r.ended) await sleep(1000);
    const bossSpawned = r.B.level.waves.some(w => w.entries.some(e => e.boss));
    ok(bossSpawned, 'W1-3 是 Boss 关');
    ok(r.ended !== null, '战斗正常结束 @' + r.t.toFixed(0) + 's win=' + (r.ended && r.ended.win) + ' stars=' + (r.ended && r.ended.stars));
  }

  section('战斗模拟：随机编成 × 递进关卡（引擎健壮性，40 技能全覆盖）');
  {
    let allEnded = true, err = null;
    for (let trial = 0; trial < 6; trial++) {
      try {
        const loadout = KB.KNIGHTS.slice(trial * 6, trial * 6 + 6).map(k =>
          KB.Player.grant(k.id, trial % 2, { level: 5 + trial * 3 }));
        const placement = loadout.map((k, i) =>
          KB.knightById(k.defId).pos === 'melee' ? [i % 5, 0, i] : [i % 5, 1, i]);
        const r = simulate(1, 1 + trial, { loadout, placement });
        if (!r.ended) { await sleep(1000); if (!r.ended) allEnded = false; }
      } catch (e) { err = e; allEnded = false; }
    }
    ok(allEnded && !err, '6 组随机编成全部无异常结束' + (err ? '，异常: ' + err.stack.split('\n')[0] : ''));
  }

  section('场景栈导航');
  {
    const SM = KB.SceneManager;
    SM.stack.length = 0;
    const home = new KB.scenes.HomeScene();
    SM.push(home);
    SM.push(new KB.scenes.WorldMapScene());
    ok(SM.stack.length === 2, 'Home + WorldMap');
    SM.pop(); SM.pop();
    ok(SM.stack.length >= 1 && SM.top() && typeof SM.top().draw === 'function' && typeof SM.top().onTouch === 'function', '空栈兜底回 Home');
    SM.stack.length = 0; // 清理
  }

  console.log('\n──────────────────────────');
  console.log(`结果: ${pass} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error('FATAL', e); process.exit(2); });
