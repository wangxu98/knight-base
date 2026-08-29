/* ============================================================
 * 骑士基地：世界起源 - save.js
 * localStorage 版本化存档 / 玩家状态操作 API
 * ============================================================ */
'use strict';
(function () {
  const KEY = 'kb_save_v1';

  function defaultState() {
    return {
      version: 1,
      player: { coins: 0, valor: 0, starDust: 0, glory: 0, created: 0, lastSeen: 0 },
      knights: [],            // {uid, defId, rarity, level, skills[], awakenId, greatBonus, bornAt}
      nextUid: 1,
      loadout: [],            // 出战 uid 列表 (≤6)
      progress: {},           // progress[w] = {cleared:bool, stars:{levelIdx0:stars}}
      unlockedWorld: 0,       // 已解锁最大世界(0基)
      base: { level: 1 },
      shop: { sincePurple: 0, sinceGold: 0, totalPulls: 0 },
      guide: { done: false, starter: null },
      settings: { sfx: false },
      stats: { battlesWon: 0, knightsLost: 0, merges: 0 },
    };
  }

  let mem = null;   // localStorage 不可用时的内存降级
  let storageOK = true;

  KB.Save = {
    load() {
      let raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) { storageOK = false; }
      if (raw) {
        try {
          const data = JSON.parse(raw);
          if (data && data.version === 1) { mem = null; return data; }
        } catch (e) { /* 损坏档重置 */ }
      }
      return defaultState();
    },
    flush(state) {
      if (!state) return;
      state.player.lastSeen = Date.now();
      try { localStorage.setItem(KEY, JSON.stringify(state)); }
      catch (e) { storageOK = false; mem = state; }
    },
    wipe() {
      try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
      mem = null;
    },
    storageAvailable() { return storageOK; },
    defaultState,
  };

  /* ---------- 玩家操作 API ---------- */
  KB.Player = {
    state: null,

    init() {
      this.state = KB.Save.load();
      if (!this.state.player.created) this.state.player.created = Date.now();
    },

    markDirty() { this._dirty = true; },
    isDirty() { return !!this._dirty; },
    saved() { this._dirty = false; },

    /* ----- 货币 ----- */
    coins() { return this.state.player.coins; },
    addCoins(n) { this.state.player.coins = Math.max(0, Math.floor(this.state.player.coins + n)); this.markDirty(); },
    trySpend(n) {
      if (this.state.player.coins < n) return false;
      this.state.player.coins -= n; this.markDirty(); return true;
    },

    /* ----- 骑士 ----- */
    knights() { return this.state.knights; },
    byUid(uid) { return this.state.knights.find(k => k.uid === uid) || null; },
    ownCount(defId) { return this.state.knights.filter(k => k.defId === defId).length; },
    hasKnight(defId) { return this.ownCount(defId) > 0; },

    grant(defId, rarity, opts) {
      opts = opts || {};
      const def = KB.knightById(defId);
      if (!def) return null;
      rarity = rarity || 0;
      const k = {
        uid: this.state.nextUid++,
        defId, rarity,
        level: opts.level || 1,
        skills: null, awakenId: null,
        greatBonus: !!opts.greatBonus,
        bornAt: Date.now(),
      };
      if (rarity === 0) k.skills = [def.skill];
      else {
        // 紫/金：父母技在融合时决定；此处（抽卡获得）随机生成
        const other = KB.math.pick(KB.KNIGHTS.filter(x => x.id !== defId)).skill;
        const awaken = KB.math.pick(KB.AWAKENS.filter(w => w.name !== def.skill && w.name !== other));
        k.skills = [def.skill, other, awaken.name];
        k.awakenId = awaken.id;
      }
      this.state.knights.push(k);
      this.markDirty();
      return k;
    },

    removeKnight(uid) {
      const i = this.state.knights.findIndex(k => k.uid === uid);
      if (i >= 0) {
        this.state.knights.splice(i, 1);
        this.state.loadout = this.state.loadout.filter(u => u !== uid);
        this.markDirty();
      }
    },

    fuse(aUid, bUid) {
      const a = this.byUid(aUid), b = this.byUid(bUid);
      if (!a || !b || a === b) return { err: '选择无效' };
      if (a.rarity !== b.rarity) return { err: '品质不同无法融合' };
      if (a.rarity >= 2) return { err: '金卡已是最终形态' };
      const eff = KB.BaseCfg.effects(this.state.base.level);
      const cost = Math.round(KB.Fusion.cost(a.rarity) * (1 - eff.fusionDiscount));
      if (this.state.player.coins < cost) return { err: '骑士币不足', cost };
      const baby = KB.Fusion.fuse(a, b);
      if (!baby) return { err: '融合失败' };
      if (KB.math.chance(eff.greatChance)) baby.greatBonus = true;
      this.trySpend(cost);
      this.removeKnight(aUid);
      this.removeKnight(bUid);
      baby.uid = this.state.nextUid++;
      this.state.knights.push(baby);
      this.markDirty();
      return { ok: true, knight: baby, cost };
    },

    /* ----- 抽卡 ----- */
    gachaPull() {
      const cfg = KB.CONFIG;
      const s = this.state.shop;
      const res = KB.Gacha.pull(s.sincePurple, s.sinceGold);
      if (res.rarity >= 1) s.sincePurple = 0; else s.sincePurple++;
      if (res.rarity >= 2) s.sinceGold = 0; else s.sinceGold++;
      s.totalPulls++;
      const k = this.grant(res.defId, res.rarity);
      this.markDirty();
      return k;
    },

    /* ----- 进度 ----- */
    levelStars(w, i) {
      const pw = this.state.progress[w];
      return (pw && pw.stars && pw.stars[i] !== undefined) ? pw.stars[i] : -1;
    },
    worldCleared(w) {
      const pw = this.state.progress[w];
      return !!(pw && pw.cleared);
    },
    recordResult(w, i, stars, won) {
      const p = this.state.progress;
      if (!p[w]) p[w] = { cleared: false, stars: {} };
      if (won) {
        if (stars > (p[w].stars[i] || -1)) p[w].stars[i] = stars;
        // 世界通关判定：所有关卡都有星级
        const world = KB.WORLDS[w];
        let all = true;
        for (let idx = 0; idx < world.levels; idx++) if (p[w].stars[idx] === undefined) { all = false; break; }
        if (all) p[w].cleared = true;
        if (p[w].cleared && this.state.unlockedWorld < Math.min(w + 1, KB.WORLDS.length - 1)) {
          this.state.unlockedWorld = Math.min(w + 1, KB.WORLDS.length - 1);
        }
      }
      this.markDirty();
    },
    isWorldUnlocked(w) { return w <= this.state.unlockedWorld; },
    totalStars() {
      let t = 0;
      for (const w in this.state.progress) {
        const st = this.state.progress[w].stars || {};
        for (const i in st) t += st[i];
      }
      return t;
    },
    firstClear(w, i) { return this.levelStars(w, i) < 0; },

    /* ----- 出战阵容 ----- */
    loadoutKnights() {
      return this.state.loadout.map(u => this.byUid(u)).filter(Boolean);
    },
    setLoadout(uids) {
      this.state.loadout = uids.slice(0, KB.CONFIG.MAX_LOADOUT).filter(u => this.byUid(u));
      this.markDirty();
    },

    /* ----- 基地 ----- */
    baseLevel() { return this.state.base.level; },
    baseUpCost() { return KB.BaseCfg.upCost(this.state.base.level); },
    tryBaseUp() {
      const cost = this.baseUpCost();
      if (this.state.base.level >= 20) return { err: '已达最高等级' };
      if (!this.trySpend(cost)) return { err: '骑士币不足', cost };
      this.state.base.level++;
      this.markDirty();
      return { ok: true, level: this.state.base.level };
    },

    /* ----- 升级骑士 ----- */
    upgradeKnight(uid) {
      const k = this.byUid(uid);
      if (!k) return { err: '骑士不存在' };
      if (k.level >= KB.CONFIG.LEVEL_MAX) return { err: '已满级' };
      const cost = KB.StatCalc.upCost(k);
      if (!this.trySpend(cost)) return { err: '骑士币不足', cost };
      k.level++;
      this.markDirty();
      return { ok: true, level: k.level, cost };
    },
  };
})();
