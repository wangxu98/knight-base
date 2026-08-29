/* ============================================================
 * 骑士基地：世界起源 - data.js
 * 40骑士 / 技能原语配方 / 觉醒池 / 敌人原型 / 8世界 / 关卡生成 / 数值
 * ============================================================ */
'use strict';
(function () {
  const C = () => KB.CONFIG;

  /* ============ 技能原语配方 ============ */
  // trigger: onAttack / onNth{n} / onEngageOnce / onHpBelow{p} / everyCd{cd} /
  //          onKill / aura{iv} / passive
  // prim.t:  dmgMult extraHits splash dot slow stun knock selfBuff stackBuff
  //          healSelf healAlly debuff mark dodge critBoost pierceDef aspdBoost
  //          atkBoost defBoost dmgReduce cdCut lifesteal freeze corpseBoom
  //          delayedAoe summon chain auraDot rotating alternating rotateElem
  const S = KB.SKILLS = {
    '冲锋':   { d: '接敌首击突进重创并眩晕', trigger: 'onEngageOnce', prims: [{ t: 'dmgMult', v: 2.5 }, { t: 'stun', dur: 0.5 }] },
    '连斩':   { d: '每次攻击追加两段斩击', trigger: 'onAttack', prims: [{ t: 'extraHits', n: 2, mult: 0.7 }] },
    '血怒':   { d: '血量低于50%时攻击+50%攻速+20%', trigger: 'onHpBelow', p: 0.5, prims: [{ t: 'selfBuff', atkPct: 0.5, aspdPct: 0.2, dur: 1e9 }] },
    '格挡':   { d: '受到伤害减少30%', trigger: 'passive', prims: [{ t: 'dmgReduce', v: 0.3 }] },
    '突刺':   { d: '长枪穿透前方2格敌人', trigger: 'onAttack', prims: [{ t: 'splash', r: 2, mult: 1.0 }] },
    '重击':   { d: '每第4击造成3倍伤害并眩晕', trigger: 'onNth', n: 4, prims: [{ t: 'dmgMult', v: 3 }, { t: 'stun', dur: 0.5 }] },
    '崩拳':   { d: '攻击1.5倍伤害并击退', trigger: 'onAttack', prims: [{ t: 'dmgMult', v: 1.5 }, { t: 'knock', cells: 0.6 }] },
    '双刃乱舞': { d: '每6秒对周身敌人乱舞', trigger: 'everyCd', cd: 6, prims: [{ t: 'splash', r: 1.5, mult: 0.8, rows: 1 }] },
    '圣光斩':  { d: '攻击1.2倍并吸取30%治疗', trigger: 'onAttack', prims: [{ t: 'dmgMult', v: 1.2 }, { t: 'healSelf', v: 0.3 }] },
    '暗影突袭': { d: '接敌首击2.2倍重创', trigger: 'onEngageOnce', prims: [{ t: 'dmgMult', v: 2.2 }] },
    '龙息':   { d: '每8秒喷吐龙息灼烧前方', trigger: 'everyCd', cd: 8, prims: [{ t: 'splash', r: 2, mult: 0.6 }, { t: 'dot', dps: 0.2, dur: 3 }] },
    '瞬影':   { d: '25%闪避且攻击+15%', trigger: 'passive', prims: [{ t: 'dodge', v: 0.25 }, { t: 'atkBoost', v: 0.15 }] },
    '雷霆一击': { d: '每5秒雷击周身并减速', trigger: 'everyCd', cd: 5, prims: [{ t: 'splash', r: 1.2, mult: 1.2, rows: 1 }, { t: 'slow', pct: 0.3, dur: 1 }] },
    '冰封':   { d: '攻击附带35%减速', trigger: 'onAttack', prims: [{ t: 'slow', pct: 0.35, dur: 2 }, { t: 'dmgMult', v: 1.05 }] },
    '烈焰斩':  { d: '攻击点燃敌人持续灼烧', trigger: 'onAttack', prims: [{ t: 'dot', dps: 0.15, dur: 3 }] },
    '毒雾':   { d: '散发毒雾侵蚀身边敌人', trigger: 'aura', iv: 0.5, prims: [{ t: 'auraDot', dps: 0.08, r: 1, rows: 0 }] },
    '亡灵召唤': { d: '每12秒召唤骷髅墙阻挡', trigger: 'everyCd', cd: 12, prims: [{ t: 'summon', kind: 'skeleton', hpPct: 1.5, atkPct: 0.3, life: 0 }] },
    '狂暴':   { d: '每击攻击+8%可叠5层', trigger: 'onAttack', prims: [{ t: 'stackBuff', atkPct: 0.08, max: 5 }] },
    '居合':   { d: '接敌首击居合斩3倍伤害', trigger: 'onEngageOnce', prims: [{ t: 'dmgMult', v: 3 }] },
    '分身':   { d: '每10秒生成40%属性分身', trigger: 'everyCd', cd: 10, prims: [{ t: 'summon', kind: 'clone', hpPct: 0.4, atkPct: 0.4, life: 8 }] },
    '连射':   { d: '每次射击连发3箭', trigger: 'onAttack', prims: [{ t: 'extraHits', n: 2, mult: 0.55 }] },
    '狙击':   { d: '超远狙击，暴击+25%攻+20%', trigger: 'passive', prims: [{ t: 'critBoost', v: 0.25 }, { t: 'atkBoost', v: 0.2 }] },
    '投石':   { d: '投石溅射范围1格', trigger: 'onAttack', prims: [{ t: 'splash', r: 1, mult: 1.4 }] },
    '射击':   { d: '快速射击，暴击+10%', trigger: 'passive', prims: [{ t: 'critBoost', v: 0.1 }] },
    '火球':   { d: '火球爆炸溅射', trigger: 'onAttack', prims: [{ t: 'splash', r: 0.8, mult: 1.5 }] },
    '冰箭':   { d: '冰箭减速30%', trigger: 'onAttack', prims: [{ t: 'slow', pct: 0.3, dur: 2 }, { t: 'dmgMult', v: 1.1 }] },
    '闪电链':  { d: '闪电在3个敌人间弹射', trigger: 'onAttack', prims: [{ t: 'chain', n: 3, falloff: 0.7 }] },
    '暗影箭':  { d: '1.3倍伤害并削弱敌攻', trigger: 'onAttack', prims: [{ t: 'dmgMult', v: 1.3 }, { t: 'debuff', atkPct: 0.15, dur: 3 }] },
    '光球':   { d: '追踪光球分裂二次命中', trigger: 'onAttack', prims: [{ t: 'extraHits', n: 1, mult: 0.6 }] },
    '藤蔓':   { d: '每8秒藤蔓定身2.5秒', trigger: 'everyCd', cd: 8, prims: [{ t: 'stun', dur: 2.5 }, { t: 'dot', dps: 0.1, dur: 2.5 }] },
    '召唤兽':  { d: '每15秒召唤灵宠助战', trigger: 'everyCd', cd: 15, prims: [{ t: 'summon', kind: 'pet', hpPct: 1.2, atkPct: 0.5, life: 12 }] },
    '炮台':   { d: '每10秒架设自动炮台', trigger: 'everyCd', cd: 10, prims: [{ t: 'summon', kind: 'turret', hpPct: 0.6, atkPct: 0.6, life: 8 }] },
    '药水投掷': { d: '治疗友军/酸蚀敌人交替', trigger: 'everyCd', cd: 6, prims: [{ t: 'alternating', a: [{ t: 'healRow', v: 0.15 }], b: [{ t: 'splash', r: 1, mult: 1.2 }, { t: 'dot', dps: 0.1, dur: 2 }] }] },
    '诅咒':   { d: '诅咒敌人受伤+25%', trigger: 'onAttack', prims: [{ t: 'mark', takenPct: 0.25, dur: 4 }] },
    '星落':   { d: '每10秒召唤陨石轰炸', trigger: 'everyCd', cd: 10, prims: [{ t: 'delayedAoe', mult: 3, r: 1.2, delay: 1, rows: 2 }] },
    '时间停止': { d: '每20秒冻结全场2秒', trigger: 'everyCd', cd: 20, prims: [{ t: 'freeze', dur: 2 }] },
    '灵魂吸取': { d: '伤害的50%治疗最残骑士', trigger: 'onAttack', prims: [{ t: 'healAlly', v: 0.5 }] },
    '血爆':   { d: '击杀时尸体爆炸溅射', trigger: 'onKill', prims: [{ t: 'corpseBoom', mult: 1, r: 1 }] },
    '符文爆炸': { d: '每6秒符文延迟群爆', trigger: 'everyCd', cd: 6, prims: [{ t: 'delayedAoe', mult: 2, r: 1.5, delay: 1.5, rows: 0 }] },
    '元素融合': { d: '火/冰/雷元素轮转攻击', trigger: 'passive', prims: [{ t: 'rotateElem', elems: ['fire', 'ice', 'thunder'] }] },
  };

  /* ============ 觉醒技池（融合第3技能） ============ */
  KB.AWAKENS = [
    { id: 'kuangre', name: '狂热', d: '攻速+25%', prims: [{ t: 'aspdBoost', v: 0.25 }] },
    { id: 'juli', name: '巨力', d: '攻击+25%', prims: [{ t: 'atkBoost', v: 0.25 }] },
    { id: 'tiebi', name: '铁壁', d: '防御+100', prims: [{ t: 'defBoost', v: 100 }] },
    { id: 'xunjie', name: '迅捷', d: '攻速+15%', prims: [{ t: 'aspdBoost', v: 0.15 }] },
    { id: 'jixue', name: '汲血', d: '造成伤害15%治疗自身', prims: [{ t: 'lifesteal', v: 0.15 }] },
    { id: 'pojia', name: '破甲', d: '无视50%防御', prims: [{ t: 'pierceDef', v: 0.5 }] },
    { id: 'lingguang', name: '灵光', d: '技能冷却-20%', prims: [{ t: 'cdCut', v: 0.2 }] },
    { id: 'huixin', name: '会心', d: '暴击率+15%', prims: [{ t: 'critBoost', v: 0.15 }] },
  ];

  /* ============ 40 骑士表 ============
   * [id, 名称, 近战/远程, 元素, 费用档, 强度档, hp修正, atk修正, 间隔修正, 射程格(远程), 技能, 武器外观, emoji]
   * 近战: HP=220*(1+.35(T-1))*hpX  ATK=26*(1+.32(T-1))*atkX  DEF=6T  间隔1.25*ivX  射程1
   * 远程: HP=150*(1+.30(T-1))*hpX  ATK=34*(1+.30(T-1))*atkX  DEF=3T  间隔1.5*ivX   射程rng
   */
  const RAW = [
    // ---- 近战 20 ----
    ['m01', '见习骑士', 'melee', 'none', 1, 1, 1, 1, 1, 0, '冲锋', 'sword', '🢡'],
    ['m02', '剑士', 'melee', 'none', 2, 2, 1, 1, 1, 0, '连斩', 'sword', '⚔️'],
    ['m03', '狂战士', 'melee', 'none', 3, 3, 1.05, 1.1, 0.9, 0, '血怒', 'axe', '🪓'],
    ['m04', '盾兵', 'melee', 'none', 2, 2, 1.6, 0.55, 1, 0, '格挡', 'shield', '🛡️'],
    ['m05', '枪兵', 'melee', 'none', 2, 2, 1, 1, 1, 0, '突刺', 'spear', '🔱'],
    ['m06', '重锤手', 'melee', 'none', 3, 3, 1.1, 1.05, 1.2, 0, '重击', 'hammer', '🔨'],
    ['m07', '拳师', 'melee', 'none', 1, 1, 0.9, 0.95, 0.65, 0, '崩拳', 'fist', '👊'],
    ['m08', '双刀客', 'melee', 'none', 3, 3, 0.95, 1.05, 0.85, 0, '双刃乱舞', 'dualsword', '🗡️'],
    ['m09', '圣骑士', 'melee', 'light', 4, 4, 1.15, 1, 1.05, 0, '圣光斩', 'sword', '✨'],
    ['m10', '黑暗骑士', 'melee', 'dark', 4, 4, 1, 1.1, 1, 0, '暗影突袭', 'sword', '🌑'],
    ['m11', '龙骑士', 'melee', 'fire', 5, 5, 1.2, 1.1, 1.1, 0, '龙息', 'spear', '🐉'],
    ['m12', '幻影刺客', 'melee', 'dark', 3, 3, 0.85, 1.15, 0.75, 0, '瞬影', 'dagger', '🥷'],
    ['m13', '雷霆战士', 'melee', 'thunder', 4, 4, 1, 1.05, 1.05, 0, '雷霆一击', 'hammer', '⚡'],
    ['m14', '冰霜战士', 'melee', 'ice', 2, 2, 1.05, 1, 1, 0, '冰封', 'spear', '❄️'],
    ['m15', '火焰战士', 'melee', 'fire', 3, 3, 1, 1.05, 1, 0, '烈焰斩', 'sword', '🔥'],
    ['m16', '毒战士', 'melee', 'poison', 3, 3, 1.05, 0.95, 1, 0, '毒雾', 'fist', '☠️'],
    ['m17', '亡灵战士', 'melee', 'dark', 4, 4, 1.1, 0.95, 1.05, 0, '亡灵召唤', 'scythe', '💀'],
    ['m18', '野蛮人', 'melee', 'none', 2, 2, 1.05, 1.05, 0.95, 0, '狂暴', 'axe', '🪓'],
    ['m19', '武士', 'melee', 'none', 4, 4, 1, 1.15, 1.35, 0, '居合', 'katana', '🎌'],
    ['m20', '忍者', 'melee', 'dark', 3, 3, 0.9, 1, 0.8, 0, '分身', 'dagger', '🌀'],
    // ---- 远程 20 ----
    ['r01', '弓箭手', 'ranged', 'none', 1, 1, 1, 1, 1, 4, '连射', 'bow', '🏹'],
    ['r02', '弩手', 'ranged', 'none', 3, 3, 1, 1, 1.45, 6, '狙击', 'crossbow', '🎯'],
    ['r03', '投石手', 'ranged', 'none', 2, 2, 1.1, 1, 1.2, 4, '投石', 'catapult', '🪨'],
    ['r04', '火枪手', 'ranged', 'fire', 2, 2, 0.9, 0.9, 0.55, 3.5, '射击', 'gun', '🔫'],
    ['r05', '法师学徒', 'ranged', 'fire', 1, 1, 1, 1, 1, 3.5, '火球', 'staff', '🔮'],
    ['r06', '冰霜射手', 'ranged', 'ice', 2, 2, 1, 1, 1, 4, '冰箭', 'bow', '🧊'],
    ['r07', '雷电法师', 'ranged', 'thunder', 4, 4, 1, 1.05, 1.1, 4, '闪电链', 'staff', '🌩️'],
    ['r08', '暗影法师', 'ranged', 'dark', 3, 3, 1, 1, 1, 4, '暗影箭', 'staff', '🌑'],
    ['r09', '光明法师', 'ranged', 'light', 3, 3, 1, 1, 1.05, 4, '光球', 'orb', '💡'],
    ['r10', '自然法师', 'ranged', 'nature', 3, 3, 1, 0.95, 1.05, 4, '藤蔓', 'staff', '🌿'],
    ['r11', '召唤师', 'ranged', 'nature', 4, 4, 1.05, 0.9, 1.1, 3.5, '召唤兽', 'tome', '🐾'],
    ['r12', '机械师', 'ranged', 'none', 4, 4, 1, 1, 1.05, 4, '炮台', 'gun', '⚙️'],
    ['r13', '炼金术士', 'ranged', 'poison', 2, 2, 1, 1, 1.1, 4, '药水投掷', 'potion', '⚗️'],
    ['r14', '咒术师', 'ranged', 'dark', 3, 3, 1, 0.95, 1.05, 4, '诅咒', 'tome', '📖'],
    ['r15', '星术师', 'ranged', 'light', 5, 5, 1, 1.1, 1.15, 5, '星落', 'orb', '🌟'],
    ['r16', '时空法师', 'ranged', 'none', 5, 5, 1, 1, 1.2, 4, '时间停止', 'orb', '⏳'],
    ['r17', '灵魂法师', 'ranged', 'dark', 3, 3, 1, 1, 1.05, 4, '灵魂吸取', 'orb', '👻'],
    ['r18', '血法师', 'ranged', 'poison', 3, 3, 1, 1.05, 1.05, 4, '血爆', 'orb', '🩸'],
    ['r19', '符文法师', 'ranged', 'fire', 4, 4, 1, 1, 1.1, 4, '符文爆炸', 'tome', '🔯'],
    ['r20', '元素使', 'ranged', 'none', 5, 5, 1, 1.05, 1.05, 4, '元素融合', 'orb', '🎭'],
  ];

  KB.KNIGHTS = [];
  KB.KNIGHT_MAP = {};
  for (const r of RAW) {
    const [id, name, pos, elem, ct, tt, hpX, atkX, ivX, rng, skill, vis, emoji] = r;
    const isMelee = pos === 'melee';
    const hp = Math.round((isMelee ? 220 * (1 + 0.35 * (tt - 1)) : 150 * (1 + 0.30 * (tt - 1))) * hpX);
    const atk = Math.round((isMelee ? 26 * (1 + 0.32 * (tt - 1)) : 34 * (1 + 0.30 * (tt - 1))) * atkX);
    const def = isMelee ? 6 * tt : 3 * tt;
    const def_ = {
      id, name, pos, elem, costTier: ct, powerTier: tt,
      hp, atk, def,
      atkInterval: (isMelee ? 1.25 : 1.5) * ivX,
      rangeCells: isMelee ? 1 : rng,
      cost: C().COSTS[ct - 1],
      skill, skillDef: S[skill], vis, emoji,
      melee: isMelee,
    };
    KB.KNIGHTS.push(def_);
    KB.KNIGHT_MAP[id] = def_;
  }
  KB.knightById = (id) => KB.KNIGHT_MAP[id];
  KB.WHITE_IDS = KB.KNIGHTS.map(k => k.id);

  /* ============ 敌人原型 ============ */
  KB.ARCHETYPES = {
    scraper:   { key: 'scraper', name: '掠夺者', hp: 55, atk: 12, def: 0, speed: 0.55, bounty: 8, cost: 20, kind: 'walk' },
    runner:    { key: 'runner', name: '疾行者', hp: 35, atk: 8, def: 0, speed: 1.0, bounty: 6, cost: 15, kind: 'walk' },
    tank:      { key: 'tank', name: '重装兵', hp: 160, atk: 18, def: 8, speed: 0.35, bounty: 14, cost: 45, kind: 'walk' },
    slinger:   { key: 'slinger', name: '投矛手', hp: 45, atk: 14, def: 2, speed: 0.45, bounty: 12, cost: 30, kind: 'shoot', range: 2.5, atkIv: 1.8 },
    bomber:    { key: 'bomber', name: '爆弹虫', hp: 40, atk: 45, def: 0, speed: 0.8, bounty: 10, cost: 25, kind: 'bomb' },
    healer:    { key: 'healer', name: '巫医', hp: 70, atk: 6, def: 3, speed: 0.4, bounty: 16, cost: 40, kind: 'heal', healPct: 0.04, healIv: 2 },
    shielded:  { key: 'shielded', name: '护盾卫士', hp: 60, atk: 15, def: 6, speed: 0.5, bounty: 16, cost: 40, kind: 'walk', shieldPct: 1.4 },
    spawner:   { key: 'spawner', name: '孵化者', hp: 120, atk: 10, def: 4, speed: 0.3, bounty: 22, cost: 60, kind: 'spawn', spawnIv: 8 },
    elite:     { key: 'elite', name: '精英卫队', hp: 220, atk: 26, def: 12, speed: 0.5, bounty: 26, cost: 80, kind: 'walk' },
  };

  /* ============ Boss 技能池 ============ */
  KB.BOSS_SKILLS = [
    { id: 'roar', name: '咆哮', d: '周期性震慑全场骑士' },
    { id: 'summon', name: '召仆', d: '周期召唤仆从' },
    { id: 'shield', name: '护盾', d: '损失血量阶段获得护盾' },
    { id: 'meteor', name: '陨石', d: '轰击随机格子' },
    { id: 'rage', name: '狂怒', d: '半血后加速强化' },
    { id: 'regen', name: '再生', d: '持续恢复生命' },
  ];
  KB.bossSkillsFor = function (bossIdx) {
    const n = KB.BOSS_SKILLS.length;
    const a = KB.BOSS_SKILLS[bossIdx % n];
    const b = KB.BOSS_SKILLS[(bossIdx * 5 + 2) % n];
    return a === b ? [a] : [a, b];
  };

  /* ============ 8 世界 ============ */
  KB.WORLDS = [
    { name: '晨曦草原', prefix: '草原', elem: 'nature', levels: 15, mobs: ['scraper', 'runner', 'tank'],
      bosses: ['巨角鹿王', '草原狼王', '毒菇巨兽', '古树精', '暗影骑士', '草原龙'],
      pal: { laneA: '#7cb342', laneB: '#689f38', sky: '#bfe7f7', accent: '#ffca28', enemy: '#5d4037' } },
    { name: '冰封要塞', prefix: '冰封', elem: 'ice', levels: 18, mobs: ['scraper', 'runner', 'tank', 'slinger', 'bomber'],
      bosses: ['冰霜巨人', '冰雪女王', '冰晶巨龙', '寒冰巫妖', '霜冻傀儡', '冰封帝王'],
      pal: { laneA: '#b3e5fc', laneB: '#a0d8f0', sky: '#e3f6ff', accent: '#4fc3f7', enemy: '#37474f' } },
    { name: '熔岩深渊', prefix: '熔岩', elem: 'fire', levels: 18, mobs: ['scraper', 'runner', 'tank', 'slinger', 'bomber', 'healer'],
      bosses: ['火焰恶魔', '熔岩巨兽', '炎龙王', '火山巨人', '岩浆元素', '深渊炎魔'],
      pal: { laneA: '#8d6e63', laneB: '#7a5c50', sky: '#3e2723', accent: '#ff7043', enemy: '#bf360c' } },
    { name: '沙漠遗迹', prefix: '沙漠', elem: 'poison', levels: 18, mobs: ['scraper', 'runner', 'tank', 'shielded', 'spawner', 'slinger'],
      bosses: ['沙虫暴君', '木乃伊王', '沙漠蝎后', '金字塔守护者', '沙尘暴元素', '遗迹古神'],
      pal: { laneA: '#e6c988', laneB: '#dbbc72', sky: '#fff3d6', accent: '#ffb300', enemy: '#795548' } },
    { name: '虚空边境', prefix: '虚空', elem: 'dark', levels: 20, mobs: ['scraper', 'runner', 'tank', 'slinger', 'bomber', 'healer', 'shielded', 'spawner', 'elite'],
      bosses: ['虚痕之主', '虚空撕裂者', '虚无吞噬者', '虚空帝王', '虚空古神', '虚空创世者'],
      pal: { laneA: '#453561', laneB: '#3a2c53', sky: '#191231', accent: '#b06cf5', enemy: '#7e57c2' } },
    { name: '天空之城', prefix: '天空', elem: 'light', levels: 18, mobs: ['scraper', 'runner', 'tank', 'slinger', 'healer', 'elite'],
      bosses: ['星陨龙王', '天空巨人', '云兽之王', '风暴元素', '天空神殿守护者', '天空古神'],
      pal: { laneA: '#dcedc8', laneB: '#c5e1a5', sky: '#e8f7ff', accent: '#ffd54f', enemy: '#546e7a' } },
    { name: '深海宫殿', prefix: '深海', elem: 'ice', levels: 18, mobs: ['scraper', 'runner', 'tank', 'bomber', 'healer', 'shielded', 'spawner'],
      bosses: ['深海巨兽', '海妖女王', '深渊海龙', '珊瑚巨人', '潮汐元素', '深海古神'],
      pal: { laneA: '#26a69a', laneB: '#21978c', sky: '#062f36', accent: '#80cbc4', enemy: '#00695c' } },
    { name: '时空错乱', prefix: '混沌', elem: 'none', levels: 20, mobs: ['runner', 'tank', 'slinger', 'bomber', 'healer', 'shielded', 'spawner', 'elite'],
      bosses: ['时间扭曲者', '空间撕裂者', '混沌龙', '时空守护者', '创世神', '抹除者'],
      pal: { laneA: '#5e5470', laneB: '#524963', sky: '#1a1626', accent: '#ff4081', enemy: '#7c4dff' } },
  ];

  // Boss 关卡号(1-based) 计算：6个Boss均布，最后一关必为世界终Boss
  KB.bossLevelIndices = function (world) {
    const L = world.levels, out = [];
    for (let k = 1; k <= 6; k++) out.push(Math.round(k * L / 6));
    for (let i = 1; i < out.length; i++) if (out[i] <= out[i - 1]) out[i] = out[i - 1] + 1;
    out[out.length - 1] = L;
    return out;
  };
  KB.bossIndexOf = function (worldIdx, levelIdx1) { // 返回该关是第几个Boss(0基)或-1
    const arr = KB.bossLevelIndices(KB.WORLDS[worldIdx]);
    const i = arr.indexOf(levelIdx1);
    return i;
  };

  /* ============ 关卡定义生成（确定性，含种子） ============ */
  const levelCache = {};
  KB.getLevelDef = function (worldIdx, levelIdx0) {
    const key = worldIdx + ':' + levelIdx0;
    if (levelCache[key]) return levelCache[key];
    const world = KB.WORLDS[worldIdx];
    const cfg = C();
    const Wk = Math.pow(cfg.WORLD_COEFF, worldIdx);
    const Li = 1 + cfg.LVL_COEFF * levelIdx0;
    const lvl1 = levelIdx0 + 1;
    const bossIdx = KB.bossIndexOf(worldIdx, lvl1);
    const isBoss = bossIdx >= 0;

    // 敌人属性缩放
    const scale = {
      hp: Wk * Li, atk: Wk * Li, def: Math.max(1, Wk * Li * 0.6),
      bounty: 1 + 0.25 * worldIdx,
    };

    // 波次
    const rng = KB.RNG(worldIdx * 1000 + levelIdx0 * 37 + 7);
    const waveCount = 3 + Math.floor(levelIdx0 / 6) + (isBoss ? 1 : 0);
    const waves = [];
    let time = 8;
    for (let w = 0; w < waveCount; w++) {
      const budget = (60 + 22 * levelIdx0) * Wk * (0.55 + 0.18 * w);
      const entries = [];
      if (isBoss && w === waveCount - 1) {
        // Boss 押送波：少量杂兵 + Boss
        entries.push({ arch: 'runner', count: 2 + Math.floor(worldIdx / 2), gap: 1.2, rows: 'any' });
        entries.push({ arch: 'tank', count: 1, gap: 2, rows: 'any' });
        entries.push({ boss: true, bossIdx, row: rng.int(0, cfg.GRID_ROWS - 1) });
      } else {
        let b = budget;
        const pool = world.mobs.slice();
        let guard = 0;
        while (b > 10 && guard++ < 30) {
          const affordable = pool.filter(k => KB.ARCHETYPES[k].cost <= b + 15);
          if (!affordable.length) break;
          const arch = rng.pick(affordable);
          const A = KB.ARCHETYPES[arch];
          const count = Math.max(1, Math.min(8, Math.round(b / A.cost / (rng() < 0.5 ? 1 : 2))));
          b -= count * A.cost;
          entries.push({ arch, count, gap: Math.max(0.8, Math.min(2.5, 18 / count)), rows: 'any' });
        }
        if (!entries.length) entries.push({ arch: 'scraper', count: 3, gap: 1.5, rows: 'any' });
      }
      waves.push({ time, entries });
      time += 22;
    }

    // 奖励
    const base = Math.round((20 + 8 * levelIdx0) * (1 + 0.4 * worldIdx) * 2.5);
    const def_ = {
      worldIdx, levelIdx0, levelIdx1: lvl1, world, isBoss, bossIdx,
      bossName: isBoss ? world.bosses[bossIdx] : null,
      waves, scale,
      reward: {
        first: isBoss ? base * 2 : base,
        replay: Math.max(5, Math.round((isBoss ? base * 2 : base) * 0.3)),
        dropKnight: isBoss,
      },
      energy: { start: cfg.ENERGY_START, regen: cfg.ENERGY_REGEN },
      coreHp: cfg.CORE_HP_BASE + cfg.CORE_HP_PER_WORLD * worldIdx,
    };
    levelCache[key] = def_;
    return def_;
  };

  // 生成一个敌人实例数值（供 battle 使用）
  KB.enemyStats = function (archKey, levelDef, isBossFlag, bossIdx) {
    const A = KB.ARCHETYPES[archKey];
    const s = levelDef.scale;
    if (isBossFlag) {
      const bi = bossIdx || 0;
      const Wk = Math.pow(C().WORLD_COEFF, levelDef.worldIdx);
      const Li = 1 + C().LVL_COEFF * levelDef.levelIdx0;
      return {
        name: levelDef.bossName, hp: Math.round(1400 * Wk * Li * (1 + 0.35 * bi)),
        atk: Math.round(40 * Wk * Li * (1 + 0.25 * bi)), def: Math.round(20 * Wk * Li * 0.6),
        speed: 0.18, bounty: Math.round(150 * (1 + 0.5 * levelDef.worldIdx)),
        kind: 'boss', atkIv: 1.6, range: 1,
      };
    }
    return {
      name: levelDef.world.prefix + A.name,
      hp: Math.round(A.hp * s.hp), atk: Math.round(A.atk * s.atk),
      def: Math.round((A.def || 0) * s.def), speed: A.speed,
      bounty: Math.max(1, Math.round(A.bounty * s.bounty)),
      kind: A.kind, range: A.range || 1, atkIv: A.atkIv || 1.0,
      healPct: A.healPct, healIv: A.healIv, spawnIv: A.spawnIv, shieldPct: A.shieldPct,
    };
  };

  /* ============ 骑士属性计算 ============ */
  KB.StatCalc = {
    // owned: {defId, rarity, level, greatBonus}
    calc(owned) {
      const cfg = C();
      const def = KB.knightById(owned.defId);
      const rm = cfg.RARITY_MULT[owned.rarity] * (owned.greatBonus ? 1 + cfg.FUSION_GREAT_BONUS : 1);
      const lm = 1 + cfg.LEVEL_STEP * (owned.level - 1);
      const bm = 1 + cfg.BASE_STAT_BONUS * ((KB.Player ? KB.Player.state.base.level : 1) - 1);
      const m = rm * lm * bm;
      return {
        def, hp: Math.round(def.hp * m), atk: Math.round(def.atk * m),
        defv: Math.round(def.def * m), atkInterval: def.atkInterval, rangeCells: def.rangeCells,
        cost: def.cost, melee: def.melee, elem: def.elem,
      };
    },
    upCost(owned) {
      const cfg = C();
      const lvl = KB.Player ? KB.Player.state.base.level : 1;
      const disc = Math.min(cfg.BASE_UP_DISCOUNT_CAP, cfg.BASE_UP_DISCOUNT * (lvl - 1));
      return Math.max(1, Math.round(cfg.KNIGHT_UP_COST * owned.level * cfg.RARITY_COST_MULT[owned.rarity] * (1 - disc)));
    },
  };

  /* ============ 基地效果 ============ */
  KB.BaseCfg = {
    upCost(level) { return Math.round(300 * Math.pow(level, 1.6)); },
    effects(baseLevel) {
      const cfg = C();
      let fusionDisc = 0, great = cfg.FUSION_GREAT_CHANCE_BASE;
      for (let i = 0; i < cfg.BASE_FUSION_MILESTONE.length; i++) {
        if (baseLevel >= cfg.BASE_FUSION_MILESTONE[i]) {
          fusionDisc = cfg.BASE_FUSION_DISCOUNT[i];
          great = cfg.FUSION_GREAT_CHANCE_BASE + 0.10 * (i + 1);
        }
      }
      return {
        statMult: 1 + cfg.BASE_STAT_BONUS * (baseLevel - 1),
        energyStart: cfg.ENERGY_START + cfg.BASE_ENERGY_START * (baseLevel - 1),
        energyRegen: cfg.ENERGY_REGEN + cfg.BASE_ENERGY_REGEN * (baseLevel - 1),
        upDiscount: Math.min(cfg.BASE_UP_DISCOUNT_CAP, cfg.BASE_UP_DISCOUNT * (baseLevel - 1)),
        fusionDiscount: fusionDisc,
        greatChance: great,
      };
    },
  };

  /* ============ 抽卡 ============ */
  KB.Gacha = {
    // 返回 {rarity, defId} 依据保底计数
    pull(sincePurple, sinceGold, rng) {
      const cfg = C();
      rng = rng || Math.random;
      let rarity;
      if (sinceGold + 1 >= cfg.GACHA_PITY_GOLD) rarity = 2;
      else if (sincePurple + 1 >= cfg.GACHA_PITY_PURPLE) rarity = 1;
      else {
        const r = rng();
        rarity = r < cfg.GACHA_RATES[2] ? 2 : (r < cfg.GACHA_RATES[2] + cfg.GACHA_RATES[1] ? 1 : 0);
      }
      return { rarity, defId: KB.WHITE_IDS[Math.floor(rng() * KB.WHITE_IDS.length)] };
    },
  };

  /* ============ 融合 ============ */
  KB.Fusion = {
    // a,b: owned knights；返回新骑士(未入档) 或 null
    fuse(a, b) {
      if (a.rarity !== b.rarity || a.rarity >= 2) return null;
      const rarity = a.rarity + 1;
      const defId = KB.math.chance(0.5) ? a.defId : b.defId;
      const level = Math.max(1, Math.floor((a.level + b.level) / 2 * 0.8));
      // 收集父母技能并去重（父母 skills 缺省时回退到底子技能）
      const seen = [];
      const collect = (k) => {
        const list = (k.skills && k.skills.length)
          ? k.skills : [KB.knightById(k.defId).skill];
        for (const s of list) if (!seen.includes(s)) seen.push(s);
      };
      collect(a); collect(b);
      const target = rarity === 1 ? 3 : 4;
      const skills = seen.slice(0, target);
      // 不足则补：先随机觉醒，再随机普通技能
      while (skills.length < target) {
        const aw = KB.AWAKENS.filter(w => !skills.includes(w.name));
        if (aw.length) { skills.push(KB.math.pick(aw).name); continue; }
        const pool = Object.keys(KB.SKILLS).filter(n => !skills.includes(n));
        if (!pool.length) break;
        skills.push(KB.math.pick(pool));
      }
      const usedAwaken = KB.AWAKENS.find(w => skills.includes(w.name));
      return {
        uid: 0, defId, rarity, level,
        skills,
        awakenId: usedAwaken ? usedAwaken.id : null,
        greatBonus: false, bornAt: Date.now(),
      };
    },
    cost(rarity) { return C().FUSION_COST[rarity + 1]; },
  };
})();
