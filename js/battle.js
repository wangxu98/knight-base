/* ============================================================
 * 骑士基地：世界起源 - battle.js
 * 骑士防线塔防引擎：5×9 格 / 实体系统 / 波次调度 /
 * 拖拽放置与合并 / 技能原语执行 / Boss / 10星判定
 * ============================================================ */
'use strict';
(function () {
  const M = KB.math;
  const CFG = KB.CONFIG;

  /* ================= 战斗构造 ================= */
  KB.Battle = function (opts) {
    const level = opts.levelDef;
    const baseEff = KB.BaseCfg.effects(KB.Player.state.base.level);

    const B = {
      level, worldIdx: level.worldIdx, levelIdx0: level.levelIdx0,
      phase: 'ready', phaseT: 0, time: 0, speed: 1, paused: false, pauseMenu: null,
      energy: baseEff.energyStart, energyRegen: baseEff.energyRegen,
      coreHp: level.coreHp, coreMaxHp: level.coreHp,
      potions: CFG.POTION_COUNT, itemsUsed: 0, knightsLost: 0,
      enemies: [], units: [], summons: [], projectiles: [], effects: [], floaters: [], particles: [], banners: [],
      grid: [], rows: CFG.GRID_ROWS, cols: CFG.GRID_COLS,
      waveIdx: -1, waveDone: 0, totalWaves: level.waves.length,
      drag: null, shake: 0, onEnd: opts.onEnd || function () {},
      rng: KB.RNG((level.worldIdx + 1) * 77717 + (level.levelIdx0 + 3) * 131),
      layout: null, touchState: null, ended: false, endT: 0,
    };
    for (let r = 0; r < B.rows; r++) { B.grid[r] = []; for (let c = 0; c < B.cols; c++) B.grid[r][c] = null; }

    /* ---- 卡槽（出战骑士快照） ---- */
    B.cards = [];
    const loadout = opts.loadout || [];
    for (const owned of loadout) {
      const st = KB.StatCalc.calc(owned);
      B.cards.push({
        owned, def: st.def, stats: st,
        cost: st.cost, cd: 0, cdMax: CFG.CARD_CD[st.def.costTier - 1],
      });
    }

    /* ---- 生成波次生成队列（绝对时间） ---- */
    B.spawnQueue = [];
    for (let w = 0; w < level.waves.length; w++) {
      const wave = level.waves[w];
      for (const ent of wave.entries) {
        if (ent.boss) {
          B.spawnQueue.push({ t: wave.time, boss: true, bossIdx: ent.bossIdx, row: ent.row });
        } else {
          for (let i = 0; i < ent.count; i++) {
            const row = ent.rows === 'any' ? B.rng.int(0, B.rows - 1) : ent.rows;
            B.spawnQueue.push({ t: wave.time + i * ent.gap, arch: ent.arch, row });
          }
        }
      }
    }
    B.spawnQueue.sort((a, b) => a.t - b.t);
    B.spawnPtr = 0;

    /* ================= 布局 ================= */
    B.computeLayout = function () {
      const Main = KB.Main;
      const W = Main.viewW, H = Main.viewH, safe = Main.safe;
      const hudH = 58, trayH = Math.max(96, Math.min(128, H * 0.16));
      const availW = W - safe.l - safe.r - 16;
      const availH = H - safe.t - safe.b - hudH - trayH - 12;
      let cell = Math.floor(Math.min(availW / (B.cols + 0.9), availH / B.rows));
      cell = Math.max(40, Math.min(120, cell));
      const coreW = Math.floor(cell * 0.9);
      const boardW = B.cols * cell + coreW, boardH = B.rows * cell;
      const bx = Math.floor(safe.l + (W - safe.l - safe.r - boardW) / 2) + coreW;
      const by = Math.floor(safe.t + hudH + (availH - boardH) / 2);
      B.layout = {
        cell, coreW, boardX: bx, boardY: by, boardW, boardH, hudH, trayH,
        coreX: bx - coreW / 2, trayY: H - safe.b - trayH,
      };
    };
    B.cellCenter = function (row, col) {
      const L = B.layout;
      return { x: L.boardX + col * L.cell + L.cell / 2, y: L.boardY + row * L.cell + L.cell / 2 };
    };
    B.cellAt = function (x, y) {
      const L = B.layout;
      const col = Math.floor((x - L.boardX) / L.cell), row = Math.floor((y - L.boardY) / L.cell);
      if (row < 0 || row >= B.rows || col < 0 || col >= B.cols) return null;
      return { row, col };
    };
    B.cellRight = function (col) { return B.layout.boardX + (col + 1) * B.layout.cell; };
    B.cellLeft = function (col) { return B.layout.boardX + col * B.layout.cell; };

    /* ================= 特效工具 ================= */
    B.floater = function (x, y, text, color, big) {
      B.floaters.push({ x, y, text, color: color || '#fff', t: 0, dur: 0.8, big: !!big });
      if (B.floaters.length > 40) B.floaters.shift();
    };
    B.burst = function (x, y, color, n) {
      for (let i = 0; i < (n || 8); i++) {
        const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 90;
        B.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, color, t: 0, dur: 0.5 + Math.random() * 0.3, r: 2 + Math.random() * 3 });
      }
      if (B.particles.length > 240) B.particles.splice(0, B.particles.length - 240);
    };
    B.banner = function (text, dur, color) {
      B.banners.push({ text, t: 0, dur: dur || 1.6, color: color || '#fff' });
    };

    /* ================= 骑士单位 ================= */
    B.placeUnit = function (card, row, col) {
      const st = card.stats;
      const u = {
        kind: 'unit', uid: card.owned.uid, def: st.def, card,
        row, col, mergeLv: 1,
        maxHp: st.hp, hp: st.hp, atk: st.atk, defv: st.defv,
        atkInterval: st.atkInterval, rangeCells: st.rangeCells,
        elem: st.def.elem, melee: st.def.melee,
        atkTimer: 0, attackCount: 0, lastTarget: null, engagedSet: {},
        atkBuff: 0, atkBuffUntil: 0, aspdBuff: 0, aspdBuffUntil: 0,
        stackAtk: 0, stackCount: 0,
        stunUntil: 0, dead: false, hitFlash: 0,
        passives: { dodge: 0, critBoost: 0, pierceDef: 0, aspdBoost: 0, dmgReduce: 0, lifesteal: 0, cdCut: 0 },
        rotating: null, rotIdx: 0,
        runtimeSkills: [],
      };
      expandSkills(u, card.owned.skills || [st.def.skill]);
      B.grid[row][col] = u;
      B.units.push(u);
      B.burst(B.cellCenter(row, col).x, B.cellCenter(row, col).y, '#8ecdf5', 10);
      return u;
    };

    function expandSkills(u, names) {
      for (const name of names || []) {
        if (KB.SKILLS[name]) {
          const rec = KB.SKILLS[name];
          const inst = {
            name, rec, cd: 0,
            cdMax: rec.trigger === 'everyCd' ? rec.cd * (1 - u.passives.cdCut) : 0,
            nth: 0, alt: 0, fired: false,
          };
          // 被动类直接生效
          if (rec.trigger === 'passive') applyPassives(u, rec.prims);
          else u.runtimeSkills.push(inst);
        } else {
          const w = KB.AWAKENS.find(a => a.name === name);
          if (w) applyPassives(u, w.prims);
        }
      }
    }

    function applyPassives(u, prims) {
      for (const p of prims) {
        switch (p.t) {
          case 'dodge': u.passives.dodge += p.v; break;
          case 'critBoost': u.passives.critBoost += p.v; break;
          case 'pierceDef': u.passives.pierceDef += p.v; break;
          case 'aspdBoost': u.passives.aspdBoost += p.v; break;
          case 'atkBoost': u.atk *= 1 + p.v; break;
          case 'defBoost': u.defv += p.v; break;
          case 'dmgReduce': u.passives.dmgReduce = Math.min(0.6, u.passives.dmgReduce + p.v); break;
          case 'lifesteal': u.passives.lifesteal += p.v; break;
          case 'cdCut': u.passives.cdCut += p.v; break;
          case 'rotateElem': u.rotating = p.elems; break;
        }
      }
    }

    B.mergeUnit = function (target, mergeFromGhost) {
      target.mergeLv = Math.min(CFG.MERGE_MAX, target.mergeLv + 1);
      const m = Math.pow(CFG.MERGE_MULT, target.mergeLv - 1);
      const st = target.card.stats;
      target.maxHp = Math.round(st.hp * m); target.hp = target.maxHp;
      target.atk = Math.round(st.atk * m);
      target.defv = Math.round(st.defv * m);
      const cc = B.cellCenter(target.row, target.col);
      B.burst(cc.x, cc.y, '#ffd54f', 14);
      B.floater(cc.x, cc.y - 18, 'Lv.' + target.mergeLv, '#ffd54f', true);
      KB.Player.state.stats.merges++;
    };

    /* ================= 敌人 ================= */
    B.spawnEnemy = function (archKey, row, bossFlag, bossIdx) {
      const st = KB.enemyStats(archKey, B.level, bossFlag, bossIdx);
      const world = KB.WORLDS[B.worldIdx];
      const e = {
        arch: archKey, name: st.name, kind: st.kind, row,
        x: B.layout.boardX + B.cols * B.layout.cell + 30,
        hp: st.hp, maxHp: st.hp, shield: st.shieldPct ? Math.round(st.hp * st.shieldPct) : 0,
        atk: st.atk, def: st.def, speed: st.speed, baseSpeed: st.speed,
        bounty: st.bounty, atkIv: st.atkIv, atkTimer: 0, range: st.range || 1,
        healPct: st.healPct, healIv: st.healIv, healTimer: 0,
        spawnIv: st.spawnIv, spawnTimer: 0,
        stunned: 0, slowPct: 0, slowUntil: 0, dots: [], markPct: 0, markUntil: 0,
        atkDebuff: 0, atkDebuffUntil: 0,
        boss: !!bossFlag, bossSkills: bossFlag ? KB.bossSkillsFor(bossIdx) : null,
        bossPhase: 0, raged: false, meteorT: 0, roarT: 0, summonT: 0,
        r: bossFlag ? B.layout.cell * 0.42 : B.layout.cell * 0.26,
        phase: Math.random() * Math.PI * 2, pal: world.pal,
        alive: true, blocking: null,
      };
      if (world.elem === 'none' && !bossFlag) e.elemVar = ['fire', 'ice', 'thunder', 'dark', 'light'][B.rng.int(0, 4)];
      B.enemies.push(e);
      return e;
    };

    /* ================= 伤害结算 ================= */
    function unitAtk(u) {
      let a = u.atk * (1 + u.stackAtk);
      if (u.atkBuffUntil > B.time) a *= 1 + u.atkBuff;
      return a;
    }
    function enemyAtk(e) {
      let a = e.atk;
      if (e.atkDebuffUntil > B.time) a *= 1 - e.atkDebuff;
      if (e.raged) a *= 1.2;
      return a;
    }

    B.dealDamage = function (e, atk, o) {
      if (!e.alive) return 0;
      o = o || {};
      let dmg = atk * (o.mult || 1);
      const pierce = o.pierceDef || 0;
      const defv = Math.max(0, e.def * (1 - pierce));
      dmg *= 1 - defv / (defv + CFG.DEF_K);
      const elem = o.elem && o.elem !== 'none' ? o.elem : null;
      const eElem = e.elemVar || (KB.WORLDS[B.worldIdx].elem !== 'none' ? KB.WORLDS[B.worldIdx].elem : null);
      if (elem && eElem) dmg *= KB.elemMult(elem, eElem);
      const critChance = CFG.CRIT_CHANCE + (o.critBoost || 0);
      let crit = false;
      if (Math.random() < critChance) { dmg *= CFG.CRIT_MULT; crit = true; }
      dmg *= M.rand(CFG.DMG_VAR[0], CFG.DMG_VAR[1]);
      if (e.markUntil > B.time) dmg *= 1 + e.markPct;
      dmg = Math.max(1, Math.round(dmg));
      // 护盾优先
      if (e.shield > 0) {
        const absorb = Math.min(e.shield, dmg);
        e.shield -= absorb; dmg -= absorb;
        if (absorb > 0) B.floater(e.x, e.y - e.r * 0.8, '-' + absorb, '#82b1ff');
      }
      if (dmg > 0) {
        e.hp -= dmg;
        B.floater(e.x + M.rand(-6, 6), e.y - e.r, (crit ? '暴' : '') + dmg, crit ? '#ffeb3b' : '#fff', crit);
        if (o.source) {
          const u = o.source;
          if (u.passives.lifesteal > 0 && u.hp > 0) healUnit(u, dmg * u.passives.lifesteal);
        }
      }
      if (e.hp <= 0) killEnemy(e, o.source);
      return dmg;
    };

    function killEnemy(e, killer) {
      if (!e.alive) return;
      e.alive = false;
      B.energy = Math.min(CFG.ENERGY_CAP, B.energy + e.bounty);
      B.floater(e.x, e.y - e.r - 8, '+' + e.bounty, '#ffd54f');
      B.burst(e.x, e.y, e.boss ? '#ff8a65' : e.pal.accent, e.boss ? 26 : 8);
      if (e.boss) { B.shake = 0.5; B.banner('首领击破！', 1.4, '#ffd54f'); }
      if (killer) {
        for (const s of killer.runtimeSkills) {
          if (s.rec.trigger === 'onKill') applyPrims(killer, s.rec.prims, e, null);
        }
      }
    }

    function healUnit(u, amount) {
      if (u.dead || u.hp <= 0) return;
      const before = u.hp;
      u.hp = Math.min(u.maxHp, u.hp + amount);
      const gain = Math.round(u.hp - before);
      if (gain >= 1) B.floater(B.cellCenter(u.row, u.col).x, B.cellCenter(u.row, u.col).y - 20, '+' + gain, '#69f0ae');
    }

    B.damageUnit = function (u, rawAtk, o) {
      o = o || {};
      if (u.dead) return;
      if (u.passives.dodge > 0 && Math.random() < u.passives.dodge) {
        B.floater(B.cellCenter(u.row, u.col).x, B.cellCenter(u.row, u.col).y - 16, '闪避', '#82b1ff');
        return;
      }
      let dmg = rawAtk * (1 - u.passives.dmgReduce);
      const defv = u.defv;
      dmg *= 1 - defv / (defv + CFG.DEF_K);
      dmg *= M.rand(CFG.DMG_VAR[0], CFG.DMG_VAR[1]);
      dmg = Math.max(1, Math.round(dmg));
      u.hp -= dmg; u.hitFlash = 0.15;
      B.floater(B.cellCenter(u.row, u.col).x + M.rand(-5, 5), B.cellCenter(u.row, u.col).y - 14, '-' + dmg, '#ff8a80');
      if (u.hp <= 0) {
        u.dead = true;
        B.grid[u.row][u.col] = null;
        const cc = B.cellCenter(u.row, u.col);
        B.burst(cc.x, cc.y, '#ef5350', 12);
        B.knightsLost++;
      }
    };

    /* ================= 技能原语执行 ================= */
    // 在攻击或触发时执行一组原语
    // ctx: {target, mult, riders[], extraHits, projectile:bool}
    function applyPrims(u, prims, target, attackCtx) {
      for (const p of prims) {
        switch (p.t) {
          case 'dmgMult': if (attackCtx) attackCtx.mult *= p.v; break;
          case 'extraHits':
            if (attackCtx) { attackCtx.extraHits = (attackCtx.extraHits || 0) + p.n; attackCtx.extraMult = p.mult || 0.7; }
            break;
          case 'splash':
            if (attackCtx) attackCtx.splash = p;
            else {
              // 主动技（everyCd）：以自身前方为中心溅射
              aoeDamage(B.cellRight(u.col) + p.r * B.layout.cell * 0.4, u.row, p.r, unitAtk(u) * p.mult, u, { elem: uAttackElem(u), crossRow: (p.rows || 0) > 0 });
            }
            break;
          case 'dot': if (target && target.alive !== false) target.dots.push({ dps: p.dps * unitAtk(u), until: B.time + p.dur }); break;
          case 'slow': if (target) { target.slowPct = Math.max(target.slowPct, p.pct); target.slowUntil = B.time + p.dur; } break;
          case 'stun':
            if (target) { const d = target.boss ? p.dur / 2 : p.dur; target.stunned = Math.max(target.stunned, B.time + d); }
            break;
          case 'knock':
            if (target && !target.boss) {
              target.x = Math.min(B.layout.boardX + B.cols * B.layout.cell, target.x + p.cells * B.layout.cell);
            }
            break;
          case 'selfBuff':
            u.atkBuff = p.atkPct; u.atkBuffUntil = B.time + p.dur;
            u.aspdBuff = p.aspdPct; u.aspdBuffUntil = B.time + p.dur;
            break;
          case 'stackBuff':
            if (u.stackCount < p.max) { u.stackCount++; u.stackAtk += p.atkPct; }
            break;
          case 'healSelf': if (attackCtx) attackCtx.healSelf = (attackCtx.healSelf || 0) + p.v; break;
          case 'healAlly': if (attackCtx) attackCtx.healAlly = (attackCtx.healAlly || 0) + p.v; break;
          case 'debuff': if (target) { target.atkDebuff = Math.max(target.atkDebuff, p.atkPct); target.atkDebuffUntil = B.time + p.dur; } break;
          case 'mark': if (target) { target.markPct = Math.max(target.markPct, p.takenPct); target.markUntil = B.time + p.dur; } break;
          case 'chain': if (attackCtx) attackCtx.chain = p; break;
          case 'corpseBoom':
            if (target) aoeDamage(target.x, target.row, p.r, unitAtk(u) * p.mult, u, { elem: uAttackElem(u) });
            break;
          case 'delayedAoe': {
            let x, row;
            if (p.rows === 2) { row = M.randInt(0, B.rows - 1); x = B.layout.boardX + M.randInt(1, B.cols - 2) * B.layout.cell; }
            else if (target) { row = target.row; x = target.x; }
            else { row = u.row; x = B.cellRight(u.col) + B.layout.cell; }
            B.effects.push({ type: 'aoe', x, y: B.layout.boardY + row * B.layout.cell + B.layout.cell / 2, row, r: p.r, mult: p.mult, atk: unitAtk(u), delay: p.delay, t: 0, source: u, elem: uAttackElem(u) });
            break;
          }
          case 'summon': {
            const cc = B.cellCenter(u.row, u.col);
            B.summons.push({
              kind: p.kind, row: u.row, col: u.col,
              x: cc.x + B.layout.cell * 0.28, hp: Math.round(u.maxHp * p.hpPct), maxHp: Math.round(u.maxHp * p.hpPct),
              atk: Math.round(u.atk * p.atkPct), atkIv: p.kind === 'turret' ? 0.7 : 1.0, atkTimer: 0,
              ttl: p.life > 0 ? B.time + p.life : 0, blocker: p.kind !== 'turret',
              dead: false, phase: Math.random() * 6,
            });
            break;
          }
          case 'freeze': {
            for (const e of B.enemies) {
              if (!e.alive) continue;
              e.stunned = Math.max(e.stunned, B.time + (e.boss ? p.dur / 2 : p.dur));
            }
            B.banner('⏳ 时间停止！', 1.2, '#82b1ff');
            break;
          }
          case 'auraDot': {
            const cx = B.cellRight(u.col);
            for (const e of B.enemies) {
              if (!e.alive || e.row !== u.row) continue;
              if (Math.abs(e.x - cx) <= p.r * B.layout.cell + e.r) {
                e.hp -= p.dps * unitAtk(u) * 0.5;
                if (e.hp <= 0) killEnemy(e, u);
              }
            }
            break;
          }
          case 'healRow': {
            for (const a of B.units) if (!a.dead && a.row === u.row) healUnit(a, a.maxHp * p.v);
            break;
          }
          case 'alternating': {
            const list = (u._altFlip = !u._altFlip) ? p.a : p.b;
            applyPrims(u, list, target, attackCtx);
            break;
          }
        }
      }
    }

    function uAttackElem(u) {
      if (u.rotating) return u.rotating[u.rotIdx % u.rotating.length];
      return u.elem;
    }

    function aoeDamage(x, row, rCells, atk, source, o) {
      const px = rCells * B.layout.cell;
      for (const e of B.enemies) {
        if (!e.alive) continue;
        if (Math.abs(e.row - row) > ((o && o.crossRow) ? 1 : 0)) continue;
        if (Math.abs(e.x - x) <= px + e.r) B.dealDamage(e, atk, { mult: 1, source, elem: o && o.elem });
      }
    }

    /* ================= 骑士攻击逻辑 ================= */
    // 找本行前方射程内最近敌人；第0列近战可跨行攻击驻核敌人（城门守卫）
    B.findTarget = function (u) {
      const L = B.layout;
      const myX = B.cellCenter(u.row, u.col).x;
      let best = null, bestD = 1e9;
      for (const e of B.enemies) {
        if (!e.alive) continue;
        if (u.melee) {
          // 近战：敌人进入本格右缘（城门守卫可跨行打驻核敌人）
          const rowOK = e.row === u.row || (u.col === 0 && e.atCore);
          if (rowOK && e.x - e.r <= B.cellRight(u.col) + 6 && e.x + e.r >= B.cellLeft(u.col) - L.cell * 0.5) {
            const d = Math.abs(e.x - myX) + Math.abs(e.row - u.row) * 0.5;
            if (d < bestD) { bestD = d; best = e; }
          }
        } else {
          if (e.row === u.row && e.x >= B.cellLeft(u.col) - L.cell && e.x <= myX + u.rangeCells * L.cell + e.r) {
            const d = e.x - myX;
            if (d < bestD) { bestD = d; best = e; }
          }
        }
      }
      return best;
    };

    B.performAttack = function (u, target) {
      const ctx = { mult: 1, extraHits: 0, healSelf: 0, healAlly: 0, splash: null, chain: null };
      u.attackCount++;
      // 触发器
      for (const s of u.runtimeSkills) {
        const rec = s.rec;
        if (rec.trigger === 'onAttack') applyPrims(u, rec.prims, target, ctx);
        else if (rec.trigger === 'onNth') { s.nth++; if (s.nth >= rec.n) { s.nth = 0; applyPrims(u, rec.prims, target, ctx); } }
        else if (rec.trigger === 'onEngageOnce') {
          if (u.lastTarget !== target) { u.lastTarget = target; applyPrims(u, rec.prims, target, ctx); }
        }
        else if (rec.trigger === 'onHpBelow') {
          if (!s.fired && u.hp / u.maxHp < rec.p) { s.fired = true; applyPrims(u, rec.prims, target, ctx); }
        }
      }
      if (u.rotating) u.rotIdx++;
      const elem = uAttackElem(u);
      const atk = unitAtk(u);
      const o = { source: u, elem, critBoost: u.passives.critBoost, pierceDef: u.passives.pierceDef };

      if (u.melee) {
        hitEnemy(target, atk, ctx.mult, o, ctx);
        for (let i = 0; i < ctx.extraHits; i++) hitEnemy(target, atk, ctx.extraMult || 0.7, o, ctx);
        if (ctx.splash) resolveSplash(target, atk, ctx.splash, o, u);
      } else {
        fireProjectile(u, target, atk, ctx, o);
      }
    };

    function hitEnemy(e, atk, mult, o, ctx) {
      if (!e || !e.alive) return;
      const dmg = B.dealDamage(e, atk, Object.assign({ mult }, o));
      if (ctx) {
        if (ctx.healSelf) healUnit(o.source, dmg * ctx.healSelf);
        if (ctx.healAlly) {
          let worst = null;
          for (const a of B.units) if (!a.dead && a.row === o.source.row && (!worst || a.hp / a.maxHp < worst.hp / worst.maxHp)) worst = a;
          if (worst) healUnit(worst, dmg * ctx.healAlly);
        }
      }
    }

    function resolveSplash(target, atk, sp, o, u) {
      const cross = (sp.rows || 0) > 0;
      for (const e of B.enemies) {
        if (!e.alive || e === target) continue;
        if (Math.abs(e.row - target.row) > (cross ? 1 : 0)) continue;
        if (Math.abs(e.x - target.x) <= sp.r * B.layout.cell + e.r) B.dealDamage(e, atk, { mult: sp.mult, source: u, elem: o.elem });
      }
    }

    function fireProjectile(u, target, atk, ctx, o) {
      const cc = B.cellCenter(u.row, u.col);
      const spriteMap = { bow: 'arrow', crossbow: 'bolt', catapult: 'rock', gun: 'bullet', staff: 'fire', orb: 'orb', tome: 'orb', potion: 'potion' };
      const pr = {
        x: cc.x + B.layout.cell * 0.2, y: cc.y - 10,
        target, homing: true,
        speed: 420,
        sprite: spriteMap[u.def.vis] || 'orb',
        color: KB.CONFIG.ELEMENTS[o.elem] || '#fff176',
        payload: { atk, ctx: Object.assign({}, ctx), o: Object.assign({}, o), source: u },
      };
      const t0 = target;
      const ang = Math.atan2(t0.y - pr.y, t0.x - pr.x);
      pr.vx = Math.cos(ang) * pr.speed; pr.vy = Math.sin(ang) * pr.speed;
      B.projectiles.push(pr);
      for (let i = 0; i < ctx.extraHits; i++) {
        const pr2 = Object.assign({}, pr, {
          payload: { atk, ctx: { mult: ctx.extraMult || 0.6 }, o: Object.assign({}, o), source: u },
          vy: pr.vy + M.rand(-60, 60),
        });
        B.projectiles.push(pr2);
      }
    }

    function projectileHit(pr, e) {
      const P = pr.payload;
      B.dealDamage(e, P.atk, { mult: P.ctx.mult, source: P.source, elem: P.o.elem, critBoost: P.o.critBoost, pierceDef: P.o.pierceDef });
      if (P.ctx.healSelf) healUnit(P.source, P.atk * P.ctx.healSelf);
      if (P.ctx.healAlly) {
        let worst = null;
        for (const a of B.units) if (!a.dead && a.row === P.source.row && (!worst || a.hp / a.maxHp < worst.hp / worst.maxHp)) worst = a;
        if (worst) healUnit(worst, P.atk * P.ctx.healAlly);
      }
      if (P.ctx.splash) resolveSplash(e, P.atk, P.ctx.splash, P.o, P.source);
      if (P.ctx.chain) {
        let mult = 1, from = e;
        const hit = new Set([e]);
        for (let i = 0; i < P.ctx.chain.n; i++) {
          let next = null, nd = 1e9;
          for (const t of B.enemies) {
            if (!t.alive || hit.has(t)) continue;
            const d = Math.abs(t.x - from.x) + Math.abs(t.row - from.row) * B.layout.cell;
            if (d < B.layout.cell * 2.2 && d < nd) { nd = d; next = t; }
          }
          if (!next) break;
          mult *= P.ctx.chain.falloff;
          B.effects.push({ type: 'bolt', x1: from.x, y1: from.y, x2: next.x, y2: next.y, t: 0, dur: 0.15, color: '#ffd54f' });
          B.dealDamage(next, P.atk, { mult, source: P.source, elem: P.o.elem });
          hit.add(next); from = next;
        }
      }
    }

    /* ================= 更新 ================= */
    B.update = function (dt) {
      B.time += dt;
      if (B.phase === 'ready') {
        B.phaseT += dt;
        if (B.phaseT >= 1.1) { B.phase = 'playing'; B.banner('第 ' + (B.levelIdx0 + 1) + ' 关 · ' + B.level.world.name, 1.4); }
        return;
      }
      if (B.phase !== 'playing') {
        updateFx(dt);
        // 结算延迟用模拟时间（受加速影响，且无头可测）
        if (!B.ended && (B.phase === 'won' || B.phase === 'lost')) {
          B.endT += dt;
          if (B.endT >= 0.9) { B.ended = true; B.onEnd(B.result); }
        }
        return;
      }

      // 勇气币
      B.energy = Math.min(CFG.ENERGY_CAP, B.energy + B.energyRegen * dt);
      // 卡片冷却
      for (const c of B.cards) if (c.cd > 0) c.cd = Math.max(0, c.cd - dt);

      // 波次横幅
      for (let w = 0; w < B.level.waves.length; w++) {
        if (B.time >= B.level.waves[w].time - 3 && B.waveIdx < w) {
          B.waveIdx = w;
          const isBossWave = B.level.waves[w].entries.some(x => x.boss);
          B.banner(isBossWave ? '⚠️ Boss 来袭' : '第 ' + (w + 1) + ' / ' + B.totalWaves + ' 波', isBossWave ? 1.8 : 1.1, isBossWave ? '#ff8a80' : '#fff');
          if (isBossWave) B.shake = 0.4;
        }
      }

      // 生成
      while (B.spawnPtr < B.spawnQueue.length && B.time >= B.spawnQueue[B.spawnPtr].t) {
        const s = B.spawnQueue[B.spawnPtr++];
        if (s.boss) {
          B.spawnEnemy(null, s.row, true, s.bossIdx);
        } else {
          B.spawnEnemy(s.arch, s.row);
        }
      }

      updateEnemies(dt);
      updateUnits(dt);
      updateSummons(dt);
      updateProjectiles(dt);
      updateEffects(dt);
      updateFx(dt);

      // 胜负
      if (B.spawnPtr >= B.spawnQueue.length && B.enemies.length === 0) {
        B.phase = 'won';
        B.result = B.computeResult();
        B.banner('✅ 关卡完成！', 1.6, '#69f0ae');
      } else if (B.coreHp <= 0) {
        B.phase = 'lost';
        B.result = B.computeResult();
        B.shake = 0.6;
        B.banner('❌ 基地核心失守', 1.6, '#ff8a80');
      }
    };

    function updateEnemies(dt) {
      const L = B.layout;
      const coreLine = L.boardX - L.coreW * 0.45;
      for (const e of B.enemies) {
        if (!e.alive) continue;
        // DoT
        for (let i = e.dots.length - 1; i >= 0; i--) {
          const d = e.dots[i];
          if (d.until < B.time) { e.dots.splice(i, 1); continue; }
          e.hp -= d.dps * dt;
          if (e.hp <= 0) { killEnemy(e, null); break; }
        }
        if (!e.alive) continue;
        // Boss 技能
        if (e.boss) updateBoss(e, dt);
        if (!e.alive) continue;
        // 再生
        if (e.boss && e.bossSkills.some(s => s.id === 'regen')) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.005 * dt);

        const stunned = e.stunned > B.time;
        const slowed = e.slowUntil > B.time ? e.slowPct : 0;
        e.speed = e.baseSpeed * (1 - slowed) * (e.raged ? 1.3 : 1);

        // 巫医治疗
        if (e.kind === 'heal') {
          e.healTimer += dt;
          if (e.healTimer >= e.healIv) {
            e.healTimer = 0;
            for (const t of B.enemies) {
              if (t.alive && t !== e && Math.abs(t.x - e.x) < L.cell * 1.6 && Math.abs(t.row - e.row) <= 1) {
                t.hp = Math.min(t.maxHp, t.hp + t.maxHp * e.healPct);
                B.effects.push({ type: 'heal', x: t.x, y: t.y, t: 0, dur: 0.4 });
              }
            }
          }
        }
        // 孵化者
        if (e.kind === 'spawn') {
          e.spawnTimer += dt;
          if (e.spawnTimer >= e.spawnIv) {
            e.spawnTimer = 0;
            const minions = B.enemies.filter(t => t.alive && t.minionOf === e).length;
            if (minions < 3) {
              const m = B.spawnEnemy('runner', e.row);
              m.minionOf = e; m.x = e.x + L.cell * 0.5;
            }
          }
        }

        // 找阻挡物（骑士/召唤物）
        const blocker = findBlocker(e);
        e.blocking = blocker;

        if (e.kind === 'shoot' && !stunned && e.x - e.r > coreLine + 4) {
          // 远程敌：射程内有目标则停下射击（含接触距离）
          const t = findRangedTarget(e);
          if (t) {
            e.atkTimer += dt;
            if (e.atkTimer >= e.atkIv) { e.atkTimer = 0; enemyShoot(e, t); }
            // 边走边射（减速推进），避免与够不着的近战僵持
            e.x -= e.speed * L.cell * dt * 0.35;
            continue;
          }
        }

        if (blocker && !stunned) {
          // 攻击阻挡物
          e.atkTimer += dt;
          if (e.atkTimer >= e.atkIv) {
            e.atkTimer = 0;
            if (e.kind === 'bomb') {
              // 自爆
              const dmg = enemyAtk(e) * 2.2;
              if (blocker.kind === 'unit') B.damageUnit(blocker, dmg);
              else blocker.hp -= dmg;
              // 溅射相邻
              for (const u of B.units) {
                if (!u.dead && u !== blocker && Math.abs(u.row - e.row) <= 1 && Math.abs(B.cellRight(u.col) - e.x) < L.cell) B.damageUnit(u, enemyAtk(e));
              }
              B.burst(e.x, e.y, '#ffab40', 18); B.shake = 0.25;
              killEnemy(e, null);
              continue;
            }
            const dmg = enemyAtk(e);
            if (blocker.kind === 'unit') {
              B.damageUnit(blocker, dmg);
              if (e.boss && e.bossSkills.some(s => s.id === 'smash')) {
                for (const u2 of B.units) if (!u2.dead && u2.row === e.row && u2 !== blocker && Math.abs(B.cellRight(u2.col) - e.x) < L.cell * 1.2) B.damageUnit(u2, dmg * 0.5);
              }
            } else { blocker.hp -= dmg; if (blocker.hp <= 0) blocker.dead = true; }
          }
        } else if (!stunned) {
          // 前进
          if (!e.atCore) e.x -= e.speed * L.cell * dt;
        }

        // 抵达核心：停下持续攻击核心（自爆兵一次性爆炸）
        // 注：e.x 被钳制为 coreLine+e.r 后，(e.x-e.r)<=coreLine 可能因浮点误差恒为 false，
        // 因此一旦 atCore 置位就永久生效，避免敌人卡死在城门
        if (e.atCore || e.x - e.r <= coreLine) {
          e.x = coreLine + e.r;
          e.atCore = true;
          if (e.kind === 'bomb') {
            B.coreHp -= enemyAtk(e) * 2;
            B.shake = Math.max(B.shake, 0.3);
            B.burst(e.x, e.y, '#ffab40', 16);
            e.alive = false;
            continue;
          }
          // 城门磨蚀：驻留核心的敌人被持续损耗（无赏金）
          e.hp -= e.maxHp * CFG.CORE_GRIND_RATE * dt;
          if (e.hp <= 0) {
            e.alive = false;
            B.burst(e.x, e.y, '#90a4ae', 10);
            continue;
          }
          e.atkTimer += dt;
          if (e.atkTimer >= e.atkIv) {
            e.atkTimer = 0;
            const dmg = enemyAtk(e);
            B.coreHp -= dmg;
            B.shake = Math.max(B.shake, 0.25);
            B.floater(e.x + 14, e.y - 14, '-' + Math.round(dmg), '#ff8a80');
          }
        }
      }
      // 清理
      for (let i = B.enemies.length - 1; i >= 0; i--) if (!B.enemies[i].alive) B.enemies.splice(i, 1);
      // 清理死亡召唤物
      for (let i = B.summons.length - 1; i >= 0; i--) {
        const s = B.summons[i];
        if (s.dead || s.hp <= 0 || (s.ttl > 0 && B.time > s.ttl)) B.summons.splice(i, 1);
      }
    }

    // 远程敌索敌：同行、位于自身左侧、射程内最近的目标
    function findRangedTarget(e) {
      const L = B.layout;
      const reach = e.x - e.range * L.cell;
      let best = null, bx = -1e9;
      for (const u of B.units) {
        if (u.dead || u.row !== e.row) continue;
        const cx = B.cellCenter(u.row, u.col).x;
        if (cx <= e.x + 4 && cx >= reach && B.cellRight(u.col) > bx) { bx = B.cellRight(u.col); best = u; }
      }
      for (const s of B.summons) {
        if (s.dead || !s.blocker || s.row !== e.row) continue;
        if (s.x <= e.x + 4 && s.x >= reach && s.x > bx) { bx = s.x; best = s; }
      }
      return best;
    }

    function findBlocker(e) {
      const L = B.layout;
      let best = null, bestRight = -1;
      for (const u of B.units) {
        if (u.dead || u.row !== e.row) continue;
        const right = B.cellRight(u.col);
        if (right >= e.x - e.r - 4 && right > bestRight && e.x > B.cellLeft(u.col) - L.cell * 0.6) { bestRight = right; best = u; }
      }
      for (const s of B.summons) {
        if (s.dead || !s.blocker || s.row !== e.row) continue;
        if (s.x >= e.x - e.r - 6 && s.x > bestRight) { bestRight = s.x; best = s; }
      }
      return best;
    }

    function enemyShoot(e, t) {
      const tx = t.kind === 'unit' ? B.cellCenter(t.row, t.col).x : t.x;
      const ty = t.kind === 'unit' ? B.cellCenter(t.row, t.col).y : t.y;
      B.projectiles.push({
        x: e.x, y: e.y, vx: -(300), vy: (ty - e.y) / Math.max(0.2, Math.abs(tx - e.x) / 300),
        speed: 300, sprite: 'spear', homing: false,
        payload: { atk: enemyAtk(e), ctx: { mult: 1 }, o: {}, enemy: true, targetUnit: t },
      });
    }

    function updateBoss(e, dt) {
      for (const s of e.bossSkills) {
        if (s.id === 'roar') {
          e.roarT += dt;
          if (e.roarT >= 12) {
            e.roarT = 0;
            for (const u of B.units) if (!u.dead) u.stunUntil = Math.max(u.stunUntil, B.time + 1);
            B.banner('📢 ' + e.name + ' 的咆哮！', 1, '#ce93d8'); B.shake = 0.35;
          }
        } else if (s.id === 'summon') {
          e.summonT += dt;
          if (e.summonT >= 8) {
            e.summonT = 0;
            for (let i = 0; i < 2; i++) {
              const m = B.spawnEnemy('runner', M.randInt(0, B.rows - 1));
              m.x = e.x + B.layout.cell * 0.6; m.minionOf = e;
            }
          }
        } else if (s.id === 'meteor') {
          e.meteorT += dt;
          if (e.meteorT >= 10) {
            e.meteorT = 0;
            const occupied = B.units.filter(u => !u.dead);
            if (occupied.length) {
              const t = occupied[M.randInt(0, occupied.length - 1)];
              const cc = B.cellCenter(t.row, t.col);
              B.effects.push({
                type: 'bossAoe', x: cc.x, y: cc.y, row: t.row, col: t.col, r: 0.5,
                atk: enemyAtk(e) * 2, delay: 1, t: 0,
              });
            }
          }
        } else if (s.id === 'shield') {
          const pct = e.hp / e.maxHp;
          const idx = pct < 0.25 ? 3 : pct < 0.5 ? 2 : pct < 0.75 ? 1 : 0;
          if (idx > e.bossPhase) {
            e.bossPhase = idx;
            e.shield += Math.round(e.maxHp * 0.15);
            B.banner('🛡 ' + e.name + ' 获得护盾！', 1, '#82b1ff');
          }
        } else if (s.id === 'rage') {
          if (!e.raged && e.hp / e.maxHp < 0.5) {
            e.raged = true;
            B.banner('🔥 ' + e.name + ' 进入狂怒！', 1.2, '#ff8a65');
          }
        }
      }
    }

    function updateUnits(dt) {
      for (const u of B.units) {
        if (u.dead) continue;
        if (u.hp <= 0) { u.dead = true; B.grid[u.row][u.col] = null; B.knightsLost++; continue; }
        if (u.hitFlash > 0) u.hitFlash -= dt;
        const stunned = u.stunUntil > B.time;
        if (stunned) continue;
        // 光环技能
        for (const s of u.runtimeSkills) {
          if (s.rec.trigger === 'aura') {
            s.cd += dt;
            if (s.cd >= (s.rec.iv || 0.5)) { s.cd = 0; applyPrims(u, s.rec.prims, null, null); }
          } else if (s.rec.trigger === 'everyCd') {
            s.cd += dt;
            if (s.cd >= s.cdMax) { s.cd = 0; applyPrims(u, s.rec.prims, null, null); }
          }
        }
        // 攻击
        const target = B.findTarget(u);
        if (!target) continue;
        u.atkTimer += dt * (u.aspdBuffUntil > B.time ? 1 + u.aspdBuff : 1) * (1 + u.passives.aspdBoost);
        if (u.atkTimer >= u.atkInterval) {
          u.atkTimer = 0;
          B.performAttack(u, target);
        }
      }
      for (let i = B.units.length - 1; i >= 0; i--) if (B.units[i].dead) B.units.splice(i, 1);
    }

    function updateSummons(dt) {
      const L = B.layout;
      for (const s of B.summons) {
        if (s.dead || s.hp <= 0) continue;
        if (s.ttl > 0 && B.time > s.ttl) { s.dead = true; continue; }
        s.atkTimer += dt;
        if (s.atkTimer >= s.atkIv) {
          // 攻击最近敌人
          let best = null, bd = 1e9;
          for (const e of B.enemies) {
            if (!e.alive || e.row !== s.row) continue;
            const reach = s.kind === 'turret' ? 3 * L.cell : L.cell * 0.5;
            const d = e.x - s.x;
            if (d > -L.cell && d <= reach + e.r && d < bd) { bd = d; best = e; }
          }
          if (best) {
            s.atkTimer = 0;
            if (s.kind === 'turret') {
              B.projectiles.push({
                x: s.x, y: B.layout.boardY + s.row * L.cell + L.cell / 2 - 8, homing: true, target: best,
                speed: 400, sprite: 'bullet', color: '#fff',
                payload: { atk: s.atk, ctx: { mult: 1 }, o: {}, source: null },
              });
            } else {
              B.dealDamage(best, s.atk, { mult: 1 });
            }
          }
        }
      }
    }

    function updateProjectiles(dt) {
      for (const p of B.projectiles) {
        if (p.homing && p.target && p.target.alive) {
          const ang = Math.atan2(p.target.y - p.y, p.target.x - p.x);
          p.vx = Math.cos(ang) * p.speed; p.vy = Math.sin(ang) * p.speed;
        }
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.life = (p.life || 0) + dt;
        // 命中判定
        if (p.payload.enemy) {
          // 敌方投射物打骑士
          for (const u of B.units) {
            if (u.dead) continue;
            const cc = B.cellCenter(u.row, u.col);
            if (Math.abs(p.x - cc.x) < B.layout.cell * 0.4 && Math.abs(p.y - cc.y) < B.layout.cell * 0.5) {
              B.damageUnit(u, p.payload.atk);
              p.life = 99;
              break;
            }
          }
          for (const s of B.summons) {
            if (s.dead) continue;
            if (Math.abs(p.x - s.x) < B.layout.cell * 0.4 && Math.abs(p.y - (B.layout.boardY + s.row * B.layout.cell + B.layout.cell / 2)) < B.layout.cell * 0.5) {
              s.hp -= p.payload.atk; p.life = 99; break;
            }
          }
        } else {
          for (const e of B.enemies) {
            if (!e.alive) continue;
            if (M.dist(p.x, p.y, e.x, e.y) < e.r + 6) {
              projectileHit(p, e);
              p.life = 99;
              break;
            }
          }
        }
        if (p.x < -40 || p.x > KB.Main.viewW + 40 || p.y < -40 || p.y > KB.Main.viewH + 40) p.life = 99;
      }
      for (let i = B.projectiles.length - 1; i >= 0; i--) if (B.projectiles[i].life >= 99) B.projectiles.splice(i, 1);
    }

    function updateEffects(dt) {
      for (let i = B.effects.length - 1; i >= 0; i--) {
        const f = B.effects[i];
        f.t += dt;
        if (f.type === 'aoe' && f.t >= f.delay) {
          for (const e of B.enemies) {
            if (!e.alive) continue;
            if (Math.abs(e.row - f.row) <= 1 && Math.abs(e.x - f.x) <= f.r * B.layout.cell + e.r) {
              B.dealDamage(e, f.atk, { mult: f.mult, source: f.source, elem: f.elem });
            }
          }
          B.burst(f.x, f.y, '#ff8a65', 14);
          B.effects.splice(i, 1);
        } else if (f.type === 'bossAoe' && f.t >= f.delay) {
          for (const u of B.units) {
            if (u.dead) continue;
            if (Math.abs(u.row - f.row) <= 0 && u.col === f.col) B.damageUnit(u, f.atk);
            else if (Math.abs(u.row - f.row) <= 1 && Math.abs(u.col - f.col) <= 1) B.damageUnit(u, f.atk * 0.4);
          }
          for (const s of B.summons) if (!s.dead && s.row === f.row) s.hp -= f.atk * 0.5;
          B.burst(f.x, f.y, '#ff5252', 20); B.shake = 0.3;
          B.effects.splice(i, 1);
        } else if (f.type === 'bolt' || f.type === 'heal') {
          if (f.t >= f.dur) B.effects.splice(i, 1);
        }
      }
    }

    function updateFx(dt) {
      for (let i = B.floaters.length - 1; i >= 0; i--) {
        const f = B.floaters[i];
        f.t += dt; f.y -= 34 * dt;
        if (f.t > f.dur) B.floaters.splice(i, 1);
      }
      for (let i = B.particles.length - 1; i >= 0; i--) {
        const p = B.particles[i];
        p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 180 * dt;
        if (p.t > p.dur) B.particles.splice(i, 1);
      }
      for (let i = B.banners.length - 1; i >= 0; i--) {
        B.banners[i].t += dt;
        if (B.banners[i].t > B.banners[i].dur) B.banners.splice(i, 1);
      }
      if (B.shake > 0) B.shake -= dt;
    }

    /* ================= 渲染 ================= */
    B.draw = function (ctx, time) {
      const L = B.layout || (B.computeLayout(), B.layout);
      const W = KB.Main.viewW, H = KB.Main.viewH, safe = KB.Main.safe;
      const pal = KB.WORLDS[B.worldIdx].pal;
      ctx.save();
      if (B.shake > 0) ctx.translate(M.rand(-4, 4) * B.shake * 2, M.rand(-4, 4) * B.shake * 2);

      /* --- 背景 --- */
      ctx.fillStyle = pal.sky;
      ctx.fillRect(-10, -10, W + 20, H + 20);
      // 远景装饰：星星/云
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      for (let i = 0; i < 14; i++) {
        const sx = (i * 173 + B.worldIdx * 61) % W, sy = (i * 97 + 31) % (L.boardY - 10);
        ctx.fillRect(sx, sy, 2, 2);
      }

      /* --- 棋盘 --- */
      const bg = KB.art.boardBg(B.worldIdx, L.cell, L.cell, B.rows, B.cols, L.coreW);
      ctx.drawImage(bg, L.boardX - L.coreW, L.boardY);

      /* --- 基地核心 --- */
      const corePct = M.clamp(B.coreHp / B.coreMaxHp, 0, 1);
      KB.art.drawCore(ctx, L.coreX, L.boardY + L.boardH / 2 - 10, L.coreW, L.cell * 2.4, corePct, time);

      /* --- 拖拽高亮 --- */
      if (B.drag) {
        const cell = B.cellAt(B.drag.x, B.drag.y);
        if (cell) {
          const ok = B.dropResult(B.drag, cell).valid;
          ctx.fillStyle = ok === 'place' ? 'rgba(80,220,120,.4)'
            : ok === 'merge' ? 'rgba(255,180,60,.45)'
              : 'rgba(255,80,80,.35)';
          M.roundRect(ctx, L.boardX + cell.col * L.cell + 2, L.boardY + cell.row * L.cell + 2, L.cell - 4, L.cell - 4, 8);
          ctx.fill();
        }
      }

      /* --- 召唤物（底层） --- */
      for (const s of B.summons) {
        if (s.dead) continue;
        const cy = L.boardY + s.row * L.cell + L.cell / 2;
        ctx.save();
        ctx.globalAlpha = s.ttl > 0 ? M.clamp((s.ttl - B.time) / 1.5, 0.35, 1) : 1;
        ctx.fillStyle = s.kind === 'skeleton' ? '#eceff1' : s.kind === 'turret' ? '#78909c' : s.kind === 'clone' ? '#b39ddb' : '#a5d6a7';
        if (s.kind === 'turret') {
          M.roundRect(ctx, s.x - 12, cy - 6, 24, 16, 4); ctx.fill();
          ctx.fillRect(s.x - 3, cy - 16, 6, 12);
        } else {
          ctx.beginPath(); ctx.arc(s.x, cy - 6, L.cell * 0.18, 0, Math.PI * 2); ctx.fill();
        }
        // 小血条
        ctx.fillStyle = 'rgba(0,0,0,.5)';
        ctx.fillRect(s.x - 14, cy - L.cell * 0.32, 28, 4);
        ctx.fillStyle = '#66bb6a';
        ctx.fillRect(s.x - 14, cy - L.cell * 0.32, 28 * M.clamp(s.hp / s.maxHp, 0, 1), 4);
        ctx.restore();
      }

      /* --- 骑士 --- */
      for (const u of B.units) {
        if (u.dead) continue;
        const cc = B.cellCenter(u.row, u.col);
        const sz = L.cell * 0.92;
        const spr = KB.art.knightSprite(u.def.id, u.card.owned.rarity, Math.round(sz));
        const bob = Math.sin(time * 3 + u.col) * 2;
        ctx.save();
        if (u.hitFlash > 0) { ctx.globalAlpha = 0.55 + Math.sin(time * 40) * 0.3; }
        if (B.drag && B.drag.unit === u) ctx.globalAlpha = 0.35;
        ctx.drawImage(spr, cc.x - sz / 2, cc.y - sz / 2 - 4 + bob, sz, sz);
        ctx.restore();
        // 血条
        if (u.hp < u.maxHp) {
          ctx.fillStyle = 'rgba(0,0,0,.5)';
          ctx.fillRect(cc.x - sz * 0.3, cc.y - sz / 2 - 8, sz * 0.6, 4);
          ctx.fillStyle = u.hp / u.maxHp > 0.4 ? '#66bb6a' : '#ef5350';
          ctx.fillRect(cc.x - sz * 0.3, cc.y - sz / 2 - 8, sz * 0.6 * M.clamp(u.hp / u.maxHp, 0, 1), 4);
        }
        // 合并等级星
        for (let i = 0; i < u.mergeLv - 1; i++) {
          KB.ui.drawStar(ctx, cc.x - 8 + i * 16, cc.y + sz / 2 - 6, 6, '#ffd54f');
        }
        // 眩晕标记
        if (u.stunUntil > B.time) {
          ctx.fillStyle = '#ce93d8';
          ctx.font = Math.round(L.cell * 0.3) + 'px ' + KB.ui.FONT;
          ctx.textAlign = 'center';
          ctx.fillText('💫', cc.x, cc.y - sz / 2 - 12);
        }
      }

      /* --- 敌人 --- */
      for (const e of B.enemies) {
        if (!e.alive) continue;
        e.y = L.boardY + e.row * L.cell + L.cell / 2;
        KB.art.drawEnemy(ctx, e, time);
      }

      /* --- 投射物 --- */
      for (const p of B.projectiles) KB.art.drawProjectile(ctx, p);

      /* --- 施法特效 --- */
      for (const f of B.effects) {
        if (f.type === 'aoe' || f.type === 'bossAoe') {
          const warn = f.type === 'bossAoe' || f.delay > 0.8;
          const rr = (f.r || 0.5) * L.cell + L.cell * 0.3;
          ctx.strokeStyle = f.type === 'bossAoe' ? 'rgba(255,80,80,.9)' : 'rgba(255,170,80,.9)';
          ctx.fillStyle = f.type === 'bossAoe' ? 'rgba(255,80,80,.18)' : 'rgba(255,170,80,.15)';
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          if (warn) {
            const p = M.clamp(f.t / f.delay, 0, 1);
            ctx.beginPath(); ctx.arc(f.x, f.y, rr * p, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,220,80,.3)'; ctx.fill();
          }
        } else if (f.type === 'bolt') {
          ctx.strokeStyle = f.color; ctx.lineWidth = 2.5;
          ctx.globalAlpha = 1 - f.t / f.dur;
          ctx.beginPath();
          ctx.moveTo(f.x1, f.y1);
          ctx.lineTo((f.x1 + f.x2) / 2 + M.rand(-6, 6), (f.y1 + f.y2) / 2 + M.rand(-6, 6));
          ctx.lineTo(f.x2, f.y2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (f.type === 'heal') {
          ctx.fillStyle = 'rgba(105,240,174,.9)';
          ctx.font = '14px ' + KB.ui.FONT;
          ctx.textAlign = 'center';
          ctx.fillText('✚', f.x, f.y - f.t * 40);
        }
      }

      /* --- 粒子/伤害数字 --- */
      for (const p of B.particles) {
        ctx.globalAlpha = M.clamp(1 - p.t / p.dur, 0, 1);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      for (const f of B.floaters) {
        const a = M.clamp(1 - f.t / f.dur, 0, 1);
        ctx.globalAlpha = a;
        ctx.font = KB.ui.font(f.big ? 17 : 13, 'bold');
        ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
        ctx.strokeText(f.text, f.x, f.y);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.globalAlpha = 1;

      ctx.restore(); // shake

      B.drawHud(ctx, W, H, safe, time);
      B.drawTray(ctx, W, H, safe, time);
      B.drawBanners(ctx, W, H);
      if (B.drag && B.drag.type === 'card') B.drawGhost(ctx);
      if (B.drag && B.drag.type === 'unit') B.drawGhost(ctx);
      if (B.paused) B.drawPauseMenu(ctx, W, H);
    };

    /* --- 拖拽落点判定 --- */
    B.dropResult = function (drag, cell) {
      if (drag.type === 'card') {
        const card = B.cards[drag.cardIdx];
        if (!card) return { valid: null };
        if (B.energy < card.cost) return { valid: null, reason: '勇气币不足' };
        if (card.cd > 0) return { valid: null, reason: '冷却中' };
        const occupant = B.grid[cell.row][cell.col];
        if (!occupant) return { valid: 'place', card, cell };
        if (occupant.def.id === card.def.id && occupant.mergeLv < CFG.MERGE_MAX) return { valid: 'merge', card, cell, occupant };
        return { valid: null };
      } else if (drag.type === 'unit') {
        const u = drag.unit;
        if (u.row === cell.row && u.col === cell.col) return { valid: null };
        const occupant = B.grid[cell.row][cell.col];
        if (!occupant) return { valid: 'move', unit: u, cell };
        if (occupant.def.id === u.def.id && occupant.mergeLv === u.mergeLv && occupant.mergeLv < CFG.MERGE_MAX && occupant !== u) {
          return { valid: 'merge', unit: u, cell, occupant };
        }
        return { valid: null };
      }
      return { valid: null };
    };

    /* ================= HUD ================= */
    B.drawHud = function (ctx, W, H, safe, time) {
      const L = B.layout;
      const y = safe.t + 4;
      const U = KB.ui;
      // 顶部玻璃条
      U.glass(ctx, safe.l + 6, y, W - safe.l - safe.r - 12, 50, 14, { top: 'rgba(19,26,52,.82)', bottom: 'rgba(8,12,28,.78)' });

      // 勇气币（能量）
      U.drawCoin(ctx, safe.l + 36, y + 25, 15, '#ffd54f', '勇');
      ctx.font = U.font(20, 'bold');
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const energyTxt = String(Math.floor(B.energy));
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.fillText(energyTxt, safe.l + 59, y + 26.5);
      ctx.fillStyle = B.energy >= 50 ? '#ffe9a8' : '#ffab91';
      ctx.fillText(energyTxt, safe.l + 58, y + 25);
      ctx.font = U.font(11);
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.fillText('+' + B.energyRegen.toFixed(1) + '/秒', safe.l + 62 + ctx.measureText('9999').width, y + 26);

      // 波次进度（菱形刻度）
      const waveTotal = B.totalWaves;
      const wx0 = W / 2 - (waveTotal * 15) / 2;
      for (let i = 0; i < waveTotal; i++) {
        const dx = wx0 + i * 15 + 6, dy = y + 17;
        ctx.beginPath();
        ctx.moveTo(dx, dy - 5); ctx.lineTo(dx + 5, dy); ctx.lineTo(dx, dy + 5); ctx.lineTo(dx - 5, dy);
        ctx.closePath();
        if (i === B.waveIdx) {
          ctx.fillStyle = '#ffd54f'; ctx.fill();
          ctx.strokeStyle = 'rgba(255,213,79,.4)'; ctx.lineWidth = 3; ctx.stroke();
        } else if (i < B.waveIdx) { ctx.fillStyle = '#69f0ae'; ctx.fill(); }
        else { ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fill(); }
      }
      ctx.font = U.font(11);
      ctx.fillStyle = 'rgba(255,255,255,.62)';
      ctx.textAlign = 'center';
      ctx.fillText('波次 ' + Math.max(0, B.waveIdx + 1) + '/' + waveTotal + ' · 敌人 ' + B.enemies.length, W / 2, y + 38);

      // 核心血量（渐变 + 描边）
      const cxRight = W - safe.r - 236;
      ctx.font = U.font(11, 'bold');
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.textAlign = 'right';
      ctx.fillText('❤ 核心', cxRight - 6, y + 25);
      const pct = M.clamp(B.coreHp / B.coreMaxHp, 0, 1);
      M.roundRect(ctx, cxRight, y + 17, 74, 15, 7.5);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1;
      M.roundRect(ctx, cxRight + .5, y + 17.5, 73, 14, 7); ctx.stroke();
      if (pct > 0) {
        const cc = pct > .5 ? '#66bb6a' : pct > .25 ? '#ffa726' : '#ef5350';
        const cg = ctx.createLinearGradient(cxRight, y, cxRight + 74, y);
        cg.addColorStop(0, cc); cg.addColorStop(1, U.shade(cc, .3));
        ctx.fillStyle = cg;
        M.roundRect(ctx, cxRight, y + 17, Math.max(15, 74 * pct), 15, 7.5); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.25)';
        M.roundRect(ctx, cxRight + 1.5, y + 18.5, Math.max(12, 74 * pct - 3), 4, 2); ctx.fill();
      }

      // 按钮组：药水/加速/暂停（圆形玻璃钮）
      B._btns = B._btns || {};
      const defs = [
        { id: 'potion', x: W - safe.r - 158, icon: '🧪', sub: String(B.potions), color: B.potions > 0 ? '#6a3fb5' : '#3c4a58' },
        { id: 'speed', x: W - safe.r - 106, icon: B.speed === 1 ? '▶' : '⏩', sub: '×' + B.speed, color: '#2f6d1e' },
        { id: 'pause', x: W - safe.r - 54, icon: '⏸', sub: '', color: '#31435c' },
      ];
      for (const d of defs) {
        const bx = d.x, by = y + 6, bw2 = 46, bh2 = 38;
        // 投影 + 渐变底 + 光泽
        ctx.fillStyle = 'rgba(3,6,16,.45)';
        M.roundRect(ctx, bx + 1, by + 3, bw2, bh2, 12); ctx.fill();
        const bgr = ctx.createLinearGradient(0, by, 0, by + bh2);
        bgr.addColorStop(0, U.shade(d.color, .25));
        bgr.addColorStop(1, U.shade(d.color, -.15));
        ctx.fillStyle = B._pressBtn === d.id ? 'rgba(255,255,255,.3)' : bgr;
        M.roundRect(ctx, bx, by, bw2, bh2, 12); ctx.fill();
        if (B._pressBtn !== d.id) {
          ctx.fillStyle = 'rgba(255,255,255,.12)';
          M.roundRect(ctx, bx + 2, by + 2, bw2 - 4, bh2 * .42, 10); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1;
        M.roundRect(ctx, bx + .5, by + .5, bw2 - 1, bh2 - 1, 11.5); ctx.stroke();
        ctx.font = '16px ' + U.FONT;
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(d.icon, bx + bw2 / 2, d.sub ? by + 15 : by + 19);
        if (d.sub) {
          ctx.font = U.font(10, 'bold');
          ctx.fillStyle = 'rgba(255,255,255,.85)';
          ctx.fillText(d.sub, bx + bw2 / 2, by + 30);
        }
        B._btns[d.id] = { x: bx, y: by, w: bw2, h: bh2 };
      }

      // Boss 血条（带饰角与护盾层）
      const boss = B.enemies.find(e => e.boss && e.alive);
      if (boss) {
        const bw = Math.min(440, W * 0.6);
        const bx2 = (W - bw) / 2, by2 = safe.t + 62, bh2 = 24;
        ctx.fillStyle = 'rgba(4,7,18,.68)';
        M.roundRect(ctx, bx2 - 3, by2 - 3, bw + 6, bh2 + 6, 14); ctx.fill();
        ctx.strokeStyle = 'rgba(255,120,120,.35)'; ctx.lineWidth = 1.5;
        M.roundRect(ctx, bx2 - 3, by2 - 3, bw + 6, bh2 + 6, 14); ctx.stroke();
        M.roundRect(ctx, bx2, by2, bw, bh2, 11);
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fill();
        // 护盾层（下层）
        if (boss.shield > 0) {
          M.roundRect(ctx, bx2, by2, Math.max(22, bw * M.clamp((boss.hp + boss.shield) / boss.maxHp, 0, 1)), bh2, 11);
          ctx.fillStyle = 'rgba(130,177,255,.75)'; ctx.fill();
        }
        // 血量层
        const hpW = Math.max(22, bw * M.clamp(boss.hp / boss.maxHp, 0, 1));
        const hg = ctx.createLinearGradient(bx2, by2, bx2, by2 + bh2);
        hg.addColorStop(0, '#ff6b5e'); hg.addColorStop(1, '#b71c1c');
        ctx.fillStyle = hg;
        M.roundRect(ctx, bx2, by2, hpW, bh2, 11); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.22)';
        M.roundRect(ctx, bx2 + 2, by2 + 2, Math.max(10, hpW - 4), 6, 3); ctx.fill();
        // 名称
        ctx.font = U.font(13, 'bold');
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 3;
        ctx.strokeText('👑 ' + boss.name, W / 2, by2 + bh2 / 2 + 1);
        ctx.fillStyle = '#ffe0e0';
        ctx.fillText('👑 ' + boss.name, W / 2, by2 + bh2 / 2 + 1);
      }
    };

    /* ================= 卡槽 ================= */
    B.drawTray = function (ctx, W, H, safe, time) {
      const L = B.layout, U = KB.ui;
      const y = L.trayY;
      const th = L.trayH + safe.b;
      // 玻璃底坞：渐变底 + 顶部金线 + 柔光
      const g = ctx.createLinearGradient(0, y, 0, y + th);
      g.addColorStop(0, 'rgba(18,24,48,.94)');
      g.addColorStop(1, 'rgba(7,10,22,.97)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y, W, th);
      const gl = ctx.createLinearGradient(0, y, 0, y + 26);
      gl.addColorStop(0, 'rgba(255,213,79,.16)');
      gl.addColorStop(1, 'rgba(255,213,79,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(0, y, W, 26);
      ctx.fillStyle = 'rgba(255,213,79,.5)';
      ctx.fillRect(0, y, W, 1.5);
      ctx.fillStyle = 'rgba(150,172,255,.1)';
      ctx.fillRect(0, y + 1.5, W, 1);
      // 关卡信息（左）+ 计时（右）
      ctx.font = KB.ui.font(11, 'bold');
      ctx.fillStyle = 'rgba(210,222,255,.72)';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const lvName = B.level.world.name + ' ' + (B.levelIdx0 + 1) + (B.level.isBoss ? ' · BOSS' : '');
      ctx.fillText(lvName, safe.l + 12, y + 15);
      ctx.textAlign = 'right';
      ctx.fillStyle = B.time > 180 ? '#ffab91' : 'rgba(210,222,255,.72)';
      ctx.fillText('⏱ ' + M.fmtTime(B.time), W - safe.r - 12, y + 15);

      const n = B.cards.length;
      if (!n) {
        ctx.font = KB.ui.font(13);
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ctx.textAlign = 'center';
        ctx.fillText('未携带骑士', W / 2, y + L.trayH / 2 + 4);
        return;
      }
      const ch = L.trayH - 26;
      const cw = Math.min(84, (W - safe.l - safe.r - 20) / n - 8);
      const totalW = n * (cw + 8) - 8;
      const x0 = (W - totalW) / 2;
      const cy = y + 20;
      B._cardRects = [];
      for (let i = 0; i < n; i++) {
        const card = B.cards[i];
        const x = x0 + i * (cw + 8);
        B._cardRects[i] = { x, y: cy, w: cw, h: ch };
        const affordable = B.energy >= card.cost && card.cd <= 0;
        const dragging = B.drag && B.drag.type === 'card' && B.drag.cardIdx === i;
        const rc = CFG.RARITY_COLOR[card.owned.rarity] || '#b8c4d8';
        ctx.save();
        if (!affordable) ctx.globalAlpha = 0.5;
        if (dragging) ctx.globalAlpha = 0.3;
        // 投影
        ctx.fillStyle = 'rgba(0,0,0,.45)';
        M.roundRect(ctx, x + 1.5, cy + 3, cw, ch, 10);
        ctx.fill();
        // 卡面
        const face = KB.art.cardFace(card.def.id, card.owned.rarity, Math.round(cw), Math.round(ch));
        ctx.drawImage(face, x, cy, cw, ch);
        // 顶部光泽（裁剪到卡内）
        ctx.save();
        M.roundRect(ctx, x, cy, cw, ch, 10);
        ctx.clip();
        const gloss = ctx.createLinearGradient(0, cy, 0, cy + ch * 0.55);
        gloss.addColorStop(0, 'rgba(255,255,255,.13)');
        gloss.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gloss;
        ctx.fillRect(x, cy, cw, ch * 0.55);
        ctx.restore();
        // 稀有度描边：可用时呼吸微光
        const edgeA = affordable ? 0.55 + 0.3 * Math.sin(time * 3 + i * 1.7) : 0.3;
        ctx.strokeStyle = rc; ctx.lineWidth = 1.5; ctx.globalAlpha *= edgeA + 0.2;
        M.roundRect(ctx, x + .75, cy + .75, cw - 1.5, ch - 1.5, 9);
        ctx.stroke();
        ctx.globalAlpha = dragging ? 0.3 : (!affordable ? 0.5 : 1);
        // 费用角标
        KB.ui.drawCoin(ctx, x + 13, cy + ch - 12, 11, '#ffd54f', '');
        ctx.font = KB.ui.font(11, 'bold');
        ctx.fillStyle = '#5d4037'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(card.cost), x + 13, cy + ch - 12);
        // 等级角标（局内合并等级显示在场上单位，卡上显示骑士等级）
        if (card.owned.level > 1) {
          ctx.font = KB.ui.font(9, 'bold');
          ctx.fillStyle = 'rgba(0,0,0,.55)';
          ctx.fillText('Lv' + card.owned.level, x + cw - 15, cy + 10);
          ctx.fillStyle = '#fff';
          ctx.fillText('Lv' + card.owned.level, x + cw - 16, cy + 9);
        }
        // 冷却：暗幕自上而下消退 + 扫光线 + 秒数
        if (card.cd > 0) {
          const pct = card.cd / card.cdMax;
          const chh = (ch - 2) * pct;
          ctx.fillStyle = 'rgba(5,8,18,.74)';
          M.roundRect(ctx, x + 1, cy + 1, cw - 2, chh, 8);
          ctx.fill();
          if (chh > 4) {
            ctx.fillStyle = 'rgba(150,180,255,.55)';
            ctx.fillRect(x + 3, cy + chh - 1.5, cw - 6, 1.5);
          }
          ctx.font = KB.ui.font(14, 'bold');
          ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
          ctx.fillText(Math.ceil(card.cd) + 's', x + cw / 2, cy + ch / 2);
        }
        ctx.restore();
      }
    };

    /* ================= 拖拽幽灵 ================= */
    B.drawGhost = function (ctx) {
      const d = B.drag;
      const L = B.layout;
      ctx.save();
      ctx.globalAlpha = 0.85;
      if (d.type === 'card') {
        const card = B.cards[d.cardIdx];
        const sz = L.cell * 0.95;
        const spr = KB.art.knightSprite(card.def.id, card.owned.rarity, Math.round(sz));
        ctx.drawImage(spr, d.x - sz / 2, d.y - sz / 2, sz, sz);
        // 费用
        KB.ui.drawCoin(ctx, d.x + sz / 2 - 6, d.y - sz / 2 + 6, 12, '#ffd54f', '');
        ctx.font = KB.ui.font(11, 'bold');
        ctx.fillStyle = '#5d4037'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(card.cost), d.x + sz / 2 - 6, d.y - sz / 2 + 6);
      } else if (d.type === 'unit') {
        const sz = L.cell * 0.95;
        const spr = KB.art.knightSprite(d.unit.def.id, d.unit.card.owned.rarity, Math.round(sz));
        ctx.drawImage(spr, d.x - sz / 2, d.y - sz / 2, sz, sz);
      }
      ctx.restore();
    };

    /* ================= 横幅 ================= */
    B.drawBanners = function (ctx, W, H) {
      for (const b of B.banners) {
        const a = Math.min(1, b.t / .2, (b.dur - b.t) / .35);
        ctx.globalAlpha = M.clamp(a, 0, 1);
        ctx.font = KB.ui.font(26, 'bold');
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.lineWidth = 5;
        ctx.strokeText(b.text, W / 2, H * 0.3);
        ctx.fillStyle = b.color;
        ctx.fillText(b.text, W / 2, H * 0.3);
      }
      ctx.globalAlpha = 1;
      if (B.phase === 'ready') {
        const a = Math.min(1, B.phaseT / .25);
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.fillRect(0, 0, W, H);
        ctx.font = KB.ui.font(30, 'bold');
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText(B.level.world.name + ' · 第 ' + (B.levelIdx0 + 1) + ' 关', W / 2, H / 2 - 20);
        if (B.level.isBoss) {
          ctx.font = KB.ui.font(20, 'bold');
          ctx.fillStyle = '#ff8a80';
          ctx.fillText('Boss：' + B.level.bossName, W / 2, H / 2 + 22);
        }
        ctx.globalAlpha = 1;
      }
    };

    /* ================= 暂停菜单 ================= */
    B.drawPauseMenu = function (ctx, W, H) {
      const U = KB.ui;
      ctx.fillStyle = 'rgba(2,4,10,.62)';
      ctx.fillRect(0, 0, W, H);
      const w = Math.min(340, W * 0.86), h = 264;
      const x = (W - w) / 2, y = (H - h) / 2;
      U.glass(ctx, x, y, w, h, 20, { edge: 'rgba(150,172,255,.32)' });
      // 金色顶部饰线 + 标题
      const gold = ctx.createLinearGradient(x, 0, x + w, 0);
      gold.addColorStop(0, 'rgba(255,213,79,0)');
      gold.addColorStop(0.5, 'rgba(255,213,79,.9)');
      gold.addColorStop(1, 'rgba(255,213,79,0)');
      ctx.fillStyle = gold;
      ctx.fillRect(x + 24, y + 54, w - 48, 2);
      ctx.font = KB.ui.font(21, 'bold');
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('游戏暂停', W / 2, y + 32);
      ctx.font = KB.ui.font(9, 'bold');
      ctx.fillStyle = 'rgba(255,213,79,.75)';
      ctx.fillText('P A U S E D', W / 2, y + 50);
      const items = [['继续游戏', '#2e7d32'], ['重新开始', '#ef6c00'], ['退出关卡', '#c62828']];
      B._pauseRects = [];
      items.forEach((it, i) => {
        const by = y + 72 + i * 58;
        const bx = x + 36, bw = w - 72, bh = 46;
        // 投影 + 渐变按钮 + 顶部光泽 + 描边
        ctx.fillStyle = 'rgba(0,0,0,.4)';
        M.roundRect(ctx, bx + 1.5, by + 3, bw, bh, 12);
        ctx.fill();
        const bg = ctx.createLinearGradient(0, by, 0, by + bh);
        bg.addColorStop(0, U.shade(it[1], 0.24));
        bg.addColorStop(1, U.shade(it[1], -0.18));
        ctx.fillStyle = bg;
        M.roundRect(ctx, bx, by, bw, bh, 12);
        ctx.fill();
        const hg = ctx.createLinearGradient(0, by, 0, by + bh * 0.45);
        hg.addColorStop(0, 'rgba(255,255,255,.22)');
        hg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hg;
        M.roundRect(ctx, bx + 1.5, by + 1.5, bw - 3, bh * 0.45, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1;
        M.roundRect(ctx, bx + .5, by + .5, bw - 1, bh - 1, 11.5);
        ctx.stroke();
        ctx.font = KB.ui.font(16, 'bold');
        ctx.fillStyle = '#fff';
        ctx.fillText(it[0], W / 2, by + bh / 2 + 1);
        B._pauseRects.push({ i, x: bx, y: by, w: bw, h: bh });
      });
    };

    /* ================= 触控 ================= */
    B.onTouch = function (type, x, y) {
      if (B.paused) {
        if (type === 'up') {
          for (const r of (B._pauseRects || [])) {
            if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
              if (r.i === 0) B.paused = false;
              else if (r.i === 1) { B.paused = false; B.onEnd({ restart: true }); }
              else B.onEnd({ quit: true });
              return true;
            }
          }
        }
        return true;
      }
      if (B.phase !== 'playing' && B.phase !== 'ready') return true;

      const L = B.layout;

      // HUD 按钮
      if (type === 'up' && B._btns) {
        for (const id in B._btns) {
          const r = B._btns[id];
          if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
            if (id === 'pause') { B.paused = true; return true; }
            if (id === 'speed') { B.speed = B.speed === 1 ? 2 : 1; return true; }
            if (id === 'potion') {
              if (B.potions > 0) {
                B.potions--; B.itemsUsed++;
                B.energy = Math.min(CFG.ENERGY_CAP, B.energy + CFG.POTION_ENERGY);
                B.banner('🧪 勇气 +' + CFG.POTION_ENERGY, 1, '#b388ff');
              } else KB.ui.toast('药水已用完');
              return true;
            }
          }
        }
      }

      // 拖拽中
      if (B.drag) {
        if (type === 'move') { B.drag.x = x; B.drag.y = y; return true; }
        if (type === 'up' || type === 'cancel') {
          const d = B.drag; B.drag = null;
          if (type === 'cancel') return true;
          const cell = B.cellAt(x, y);
          if (!cell) return true; // 拖回=取消
          const res = B.dropResult(d, cell);
          if (res.valid === 'place') {
            B.energy -= res.card.cost;
            res.card.cd = res.card.cdMax;
            B.placeUnit(res.card, cell.row, cell.col);
          } else if (res.valid === 'merge') {
            if (d.type === 'card') {
              B.energy -= res.card.cost;
              res.card.cd = res.card.cdMax;
            } else {
              // 场上单位合并：免费，移除被拖单位
              B.grid[d.unit.row][d.unit.col] = null;
              const idx = B.units.indexOf(d.unit);
              if (idx >= 0) B.units.splice(idx, 1);
            }
            B.mergeUnit(res.occupant);
          } else if (res.valid === 'move') {
            B.grid[d.unit.row][d.unit.col] = null;
            d.unit.row = cell.row; d.unit.col = cell.col;
            B.grid[cell.row][cell.col] = d.unit;
          }
          return true;
        }
        return true;
      }

      // 开始拖拽
      if (type === 'down') {
        // 卡槽
        if (B._cardRects) {
          for (let i = 0; i < B._cardRects.length; i++) {
            const r = B._cardRects[i];
            if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
              const card = B.cards[i];
              if (card.cd > 0) { KB.ui.toast('冷却中 ' + Math.ceil(card.cd) + 's'); return true; }
              if (B.energy < card.cost) { KB.ui.toast('勇气币不足'); return true; }
              B.drag = { type: 'card', cardIdx: i, x, y };
              return true;
            }
          }
        }
        // 场上单位
        const cell = B.cellAt(x, y);
        if (cell) {
          const u = B.grid[cell.row][cell.col];
          if (u && !u.dead) {
            B.drag = { type: 'unit', unit: u, x, y, from: cell };
            return true;
          }
        }
      }
      return true;
    };

    /* ================= 10星判定 ================= */
    B.computeResult = function () {
      const won = B.phase === 'won';
      const coreHpPct = M.clamp(B.coreHp / B.coreMaxHp, 0, 1);
      const flags = {
        win: won,
        noItems: B.itemsUsed === 0,
        fast: B.time <= CFG.STAR_TIME_LIMIT,
        noLoss: B.knightsLost === 0,
        coreFull: coreHpPct >= 0.999,
      };
      let stars = 0;
      if (won) stars = 1 + (flags.noItems ? 2 : 0) + (flags.fast ? 2 : 0) + (flags.noLoss ? 2 : 0) + (flags.coreFull ? 3 : 0);
      return {
        win: won, stars, flags, time: B.time,
        knightsLost: B.knightsLost, coreHpPct, itemsUsed: B.itemsUsed,
      };
    };

    return B;
  };
})();
