/* 全功能 UI 点击链路测试：stub 浏览器环境 → 加载模块 → 模拟点击每个界面的每个按钮 */
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

/* ---------- 浏览器 stub（与 smoke.js 一致） ---------- */
const noop = () => {};
const ctx2d = new Proxy({}, {
  get: (t, k) => {
    if (k === 'measureText') return () => ({ width: 10 });
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop });
    return typeof k === 'string' ? noop : undefined;
  },
  set: () => true,
});
const canvasEl = () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d, addEventListener: noop });
const storage = (() => {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
  };
})();
global.window = new Proxy({
  innerWidth: 1180, innerHeight: 820, devicePixelRatio: 2,
  addEventListener: noop, visualViewport: null,
}, { get: (t, k) => (k in t ? t[k] : global[k]), has: () => true });
global.document = {
  getElementById: () => canvasEl(),
  createElement: () => ({ style: {}, appendChild: noop, removeChild: noop, getContext: () => ctx2d, addEventListener: noop }),
  body: { appendChild: noop, removeChild: noop }, addEventListener: noop, fonts: null,
};
global.localStorage = storage;
try { Object.defineProperty(global, 'navigator', { value: { userAgent: 'node-ui-test' }, configurable: true }); } catch (e) {}
global.requestAnimationFrame = noop;
global.Path2D = (() => {
  class Path2DStub { constructor() {} }
  for (const m of ['moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'arcTo', 'closePath', 'rect', 'ellipse'])
    Path2DStub.prototype[m] = function () {};
  return Path2DStub;
})();
global.KB = {};

for (const f of ['core.js', 'data.js', 'save.js', 'ui.js', 'art.js', 'battle.js', 'scenes.js', 'main.js'])
  new Function(fs.readFileSync(path.join(DIR, f), 'utf8'))();

const SM = KB.SceneManager;
const tap = (x, y) => { SM.onTouch('down', x, y); SM.onTouch('up', x, y); };
const center = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const tapR = (r) => { const c = center(r); tap(c.x, c.y); };
const draw1 = () => { const t = SM.top(); t && t.draw && t.draw(ctx2d); };
const isScene = (ctor) => SM.top() instanceof ctor;
const topName = () => { const t = SM.top(); return t && t._self ? t._self.constructorName() : (t ? 'unnamed' : 'empty'); };

async function main() {
  KB.Save.load();
  section('启动 → 引导流程');
  // main.js 求值时已 push BootScene
  ok(SM.stack.length === 1, 'Boot 已入栈');
  SM.update(0.5); // Boot 定时器
  ok(SM.stack.length === 2, 'Boot 后栈: Home + Guide (实际 ' + SM.stack.length + ')');
  // 引导 step0：点任意处
  draw1(); tap(640, 400);
  // step1: 选卡
  draw1();
  const guide = SM.top()._self;
  ok(guide._cards && guide._cards.length === 6, '引导选卡面板 6 张');
  const before = KB.Player.knights().length;
  tapR(guide._cards[0]);
  ok(KB.Player.knights().length === before + 1, '引导赠卡入档');
  // step2: 点任意处关闭
  draw1(); tap(640, 400);
  ok(KB.Player.state.guide.done === true, '引导完成标记');
  ok(SM.stack.length === 1 && SM.top()._self && SM.top()._self._rects, '回到主界面');

  KB.Player.addCoins(100000); // 测试资金

  section('主界面 6 卡片');
  const home = SM.top()._self;
  const cardLabels = ['世界征途', '骑士圣殿', '融合祭坛', '商店', '基地升级'];
  for (const label of cardLabels) {
    const btn = home._rects[label];
    ok(!!btn && btn.w > 0, '卡片存在: ' + label);
    tapR(btn);
    ok(SM.stack.length === 2, '点击「' + label + '」进入子界面');
    draw1();
    const sub = SM.top()._self;
    tapR(sub._backRect);
    ok(SM.stack.length === 1, '「' + label + '」返回按钮可用');
  }

  section('世界地图 → 关卡 → 出战');
  tapR(home._rects['世界征途']);
  draw1();
  const wm = SM.top()._self;
  ok(wm._chips.length === 8, '8 世界 chips');
  ok(wm._nodeRects.length === 15, 'W1 15 关节点');
  tapR(wm._chips[1]);
  ok(true, '未解锁世界点击不崩溃（toast 提示）');
  tapR(wm._nodeRects[0]);
  ok(SM.stack.length === 3, '点击关卡进入出击准备');
  draw1();
  const lo = SM.top()._self;
  ok(lo._cards.length >= 1, '阵容卡列表非空');
  tapR(lo._cards[0]); // 选卡
  tap(640, 300); // 点空白不产生副作用
  tapR(lo._clearBtn); // 清空
  tapR(lo._startBtn); // 空选 → toast，不进战斗
  ok(SM.stack.length === 3, '空阵容无法开战');
  tapR(lo._cards[0]); // 重新选卡
  tapR(lo._startBtn);
  ok(SM.stack.length === 3 && !!SM.top()._battle, '开战进入战斗（替换布阵页）');

  section('战斗 HUD 按钮');
  draw1();
  const battle = SM.top()._battle();
  ok(!!battle._btns && !!battle._btns.pause, 'HUD 按钮已生成');
  tapR(battle._btns.speed);
  ok(battle.speed === 2, '加速按钮 ×2');
  tapR(battle._btns.speed);
  ok(battle.speed === 1, '加速按钮切回 ×1');
  const potions0 = battle.potions;
  if (potions0 > 0) {
    tapR(battle._btns.potion);
    ok(battle.potions === potions0 - 1, '药水按钮扣减');
  }
  tapR(battle._btns.pause);
  ok(battle.paused === true, '暂停按钮生效');
  draw1();
  ok(battle._pauseRects.length === 3, '暂停菜单 3 按钮');
  tapR(battle._pauseRects[0]);
  ok(battle.paused === false, '继续游戏按钮');
  tapR(battle._btns.pause);
  draw1();
  tapR(battle._pauseRects[2]); // 退出关卡
  await sleep(1000);
  ok(SM.stack.length === 2, '退出关卡回到世界地图');

  section('世界地图返回');
  draw1();
  tapR(SM.top()._self._backRect);
  ok(SM.stack.length === 1, '世界地图返回主界面');

  section('骑士圣殿：选卡 + 升级');
  draw1();
  tapR(home._rects['骑士圣殿']);
  draw1();
  const temple = SM.top()._self;
  const rows = temple._rows.filter(r => r.rowY !== undefined);
  ok(rows.length >= 1, '圣殿列表行');
  const rc = center(rows[0]);
  tap(rc.x, rc.y);
  const k0 = KB.Player.byUid(rows[0].k.uid);
  const lv0 = k0.level;
  draw1();
  ok(!!temple._upBtn, '升级按钮存在');
  tapR(temple._upBtn);
  ok(k0.level === lv0 + 1, '升级生效 Lv.' + lv0 + '→' + k0.level);
  tapR(temple._backRect);
  ok(SM.stack.length === 1, '圣殿返回');

  section('融合祭坛：选 2 卡 → 融合');
  KB.Player.grant('m01', 0); // 保证有两张白卡
  draw1();
  tapR(home._rects['融合祭坛']);
  draw1();
  const fusion = SM.top()._self;
  const cells = fusion._cells.filter(c => c.k.rarity === 0);
  ok(cells.length >= 2, '白卡 ≥2 张可选');
  const kn0 = KB.Player.knights().length;
  tapR(cells[0]);
  draw1();
  tapR(cells[1]);
  draw1();
  tapR(fusion._fuseBtn);
  ok(KB.Player.knights().length === kn0 - 1, '融合 2→1 生效');
  tapR(fusion._backRect);
  ok(SM.stack.length === 1, '融合返回');

  section('商店：单抽 + 十连');
  draw1();
  const coins0 = KB.Player.coins();
  tapR(home._rects['商店']);
  draw1();
  const shop = SM.top()._self;
  const kn1 = KB.Player.knights().length;
  tapR(shop._btns.one);
  ok(KB.Player.knights().length === kn1 + 1, '单抽 +1 骑士');
  ok(KB.Player.coins() === coins0 - KB.CONFIG.GACHA_SINGLE, '单抽扣费');
  const coins1 = KB.Player.coins();
  const kn2 = KB.Player.knights().length;
  tapR(shop._btns.ten);
  ok(KB.Player.knights().length === kn2 + 10, '十连 +10 骑士');
  ok(KB.Player.coins() === coins1 - KB.CONFIG.GACHA_TEN, '十连扣费(9折)');
  tapR(shop._backRect);
  ok(SM.stack.length === 1, '商店返回');

  section('基地升级');
  draw1();
  const base0 = KB.Player.baseLevel();
  tapR(home._rects['基地升级']);
  draw1();
  const baseup = SM.top()._self;
  tapR(baseup._upBtn);
  ok(KB.Player.baseLevel() === base0 + 1, '基地升级 Lv.' + base0 + '→' + KB.Player.baseLevel());
  tapR(baseup._backRect);
  ok(SM.stack.length === 1, '基地返回');

  section('骑士防线（快速开战）');
  KB.Player.setLoadout(KB.Player.knights().slice(0, 6).map(k => k.uid)); // 融合可能消耗了出战卡，重设
  draw1();
  tapR(home._rects['骑士防线']);
  ok(!!SM.top()._battle, '快速开战直接进战斗');
  draw1();
  const qb = SM.top()._battle();
  tapR(qb._btns.pause);
  draw1();
  tapR(qb._pauseRects[2]);
  await sleep(1000);
  ok(SM.stack.length === 1, '快速战斗退出回主界面');

  section('结算面板');
  SM.push(new KB.scenes.ResultScene(0, 0, {
    win: true, stars: 8, time: 95,
    flags: { win: true, noItems: true, fast: true, noLoss: false, coreFull: false },
  }, { from: 'map' }));
  draw1();
  const result = SM.top()._self;
  ok(result._btns.length === 3, '胜利结算 3 按钮（下一关/再来/返回）');
  tapR(result._btns.find(b => b.id === 'exit'));
  ok(SM.stack.length === 1, '结算返回 → 主界面（兜底）');

  section('调试面板');
  SM.push(new KB.scenes.DevPanelScene());
  draw1();
  const dev = SM.top()._self;
  const coins2 = KB.Player.coins();
  tapR(dev._btns.find(b => b.label === '+1万骑士币'));
  ok(KB.Player.coins() === coins2 + 10000, '调试加钱');
  tapR(dev._close);
  ok(SM.stack.length === 1, '调试面板关闭');

  section('主界面绘制无异常');
  draw1();
  ok(true, '主界面 draw 完成');

  console.log('\n──────────────────────────');
  console.log('结果: ' + pass + ' 通过 / ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('UI 测试崩溃:', e); process.exit(2); });
