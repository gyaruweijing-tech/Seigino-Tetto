/* ========== 調整用の定数（ここだけ触れば難易度が変わる） ========== */
const CFG = {
  RAMP_SEC: 100,          // この秒数かけて「開始時」から「最大」まで難しくなる

  SPEED_START: 110,        // 歩く速さ px/秒
  SPEED_MAX: 200,

  GAP_START: 300,         // 乗客どうしの間隔 px（小さいほど密）
  GAP_MIN: 170,
  GAP_JITTER: 70,         // 間隔のばらつき

  TARGET_RATIO_START: 0.40, // 乗客のうち標的の割合
  TARGET_RATIO_MAX: 0.55,
  LATE_RATIO_START: 0.20,   // 標的のうち「途中で開く」割合
  LATE_RATIO_MAX: 0.80,

  HERO_X: 225,            // 主人公の立ち位置
  SLASH_X: 350,           // 目の前＝切れる位置
  SLASH_HALF: 70,         // 切れる範囲（±px）

  OPEN_START_D: 90,       // 途中で開く標的が開き始める距離（SLASH_Xまで）
  OPEN_FULL_D: -30,       // 開ききる距離（負＝通り過ぎ側）
  OPEN_THRESHOLD: 0.5,    // これ以上開いていれば「標的」と判定

  HIP_Y: 300,             // 乗客の腰の高さ
  FLOOR_Y: 520,           // 主人公の足元
  LEG_CLOSED: 0.06,       // 閉じた脚の角度(rad)
  LEG_OPEN: 0.62,         // 開いた脚の角度(rad)

  MAX_MISS: 3,
  LEG_GRAVITY: 1500,      // 飛んだ足の落下
  LEG_VX: 330,
  LEG_VY: -560
};

const VARIANTS = ['a', 'b', 'c'];
const KIND = { NORMAL: 0, TARGET: 1, LATE: 2 };

class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    drawTrainInterior(this);

    this.passengers = [];
    this.flyingLegs = [];
    this.elapsed = 0;
    this.score = 0;
    this.miss = 0;
    this.distToNext = 260;
    this.over = false;

    this.hero = this.add.image(CFG.HERO_X, CFG.FLOOR_Y, 'hero').setOrigin(0.5, 1).setDepth(20);
    this.heroBob = 0;

    this.slashFx = this.add.graphics().setDepth(25).setVisible(false);

    // HUD（上部に帯を敷いて読みやすくする）
    this.add.rectangle(0, 0, GAME_W, 74, 0x1a1a1a, 0.55).setOrigin(0, 0).setDepth(38);
    this.scoreText = this.add.text(GAME_W - 26, 8, '0', {
      fontFamily: FONT, fontSize: '50px', color: '#fff5e0',
      stroke: '#1a1a1a', strokeThickness: 8
    }).setOrigin(1, 0).setDepth(40);

    this.missMarks = [];
    for (let i = 0; i < CFG.MAX_MISS; i++) {
      const m = this.add.text(30 + i * 52, 10, '✕', {
        fontFamily: FONT, fontSize: '46px', color: '#ffffff',
        stroke: '#1a1a1a', strokeThickness: 8
      }).setOrigin(0, 0).setDepth(40).setAlpha(0.28);
      this.missMarks.push(m);
    }

    this.popupLayer = this.add.container(0, 0).setDepth(45);

    this.input.on('pointerdown', () => this.doSlash());
  }

  /* --- 難易度：経過時間で緩やかに変化 --- */
  ramp(a, b) {
    const t = Math.min(1, this.elapsed / CFG.RAMP_SEC);
    return a + (b - a) * t;
  }

  spawnPassenger() {
    const v = Phaser.Utils.Array.GetRandom(VARIANTS);
    const headV = Phaser.Utils.Array.GetRandom(VARIANTS);

    let kind = KIND.NORMAL;
    if (Math.random() < this.ramp(CFG.TARGET_RATIO_START, CFG.TARGET_RATIO_MAX)) {
      kind = (Math.random() < this.ramp(CFG.LATE_RATIO_START, CFG.LATE_RATIO_MAX))
        ? KIND.LATE : KIND.TARGET;
    }

    const c = this.add.container(GAME_W + 90, CFG.HIP_Y).setDepth(10);
    const legL = this.add.image(-20, -8, 'leg_' + v).setOrigin(0.5, 0.07);
    const legR = this.add.image(20, -8, 'leg_' + v).setOrigin(0.5, 0.07);
    const body = this.add.image(0, 0, 'body_' + v).setOrigin(0.5, 1);
    const head = this.add.image(0, -95, 'head_' + headV).setOrigin(0.5, 1);
    c.add([legL, legR, body, head]);

    const p = {
      c, legL, legR, body, head,
      variant: v, headVariant: headV, kind,
      open: kind === KIND.TARGET ? 1 : 0,
      cut: false, judged: false, hopT: 0
    };
    this.applyLegs(p);
    this.passengers.push(p);
  }

  applyLegs(p) {
    const a = CFG.LEG_CLOSED + (CFG.LEG_OPEN - CFG.LEG_CLOSED) * p.open;
    if (p.legL.active) p.legL.rotation = a;
    if (p.legR.active) p.legR.rotation = -a;
  }

  isOpenNow(p) { return p.open >= CFG.OPEN_THRESHOLD; }
  isTargetKind(p) { return p.kind === KIND.TARGET || p.kind === KIND.LATE; }

  /* --- タップ：目の前の乗客を居合切り --- */
  doSlash() {
    if (this.over) return;
    Sfx.unlock();
    Sfx.slash();

    this.hero.setTexture('hero_slash');
    this.time.delayedCall(170, () => { if (this.hero) this.hero.setTexture('hero'); });
    this.showSlashFx();

    let hit = null, best = 1e9;
    for (const p of this.passengers) {
      if (p.cut) continue;
      const d = Math.abs(p.c.x - CFG.SLASH_X);
      if (d <= CFG.SLASH_HALF && d < best) { best = d; hit = p; }
    }
    if (!hit) return; // 空振り：ペナルティなし

    this.cutPassenger(hit);

    if (this.isTargetKind(hit) && this.isOpenNow(hit)) {
      this.score += 1;
      this.popup(hit.c.x, '+1', '#2f7d3a');
      Sfx.pon();
    } else {
      this.score -= 1;
      this.popup(hit.c.x, '-1  人ちがい！', '#c0392b');
      Sfx.pon();
      this.addMiss();
    }
    this.scoreText.setText(String(this.score));
  }

  showSlashFx() {
    const g = this.slashFx;
    g.clear().setVisible(true).setAlpha(1);
    g.lineStyle(10, 0xffffff, 1);
    g.lineBetween(CFG.SLASH_X - 90, 190, CFG.SLASH_X + 70, 400);
    g.lineStyle(4, 0x1a1a1a, 0.6);
    g.lineBetween(CFG.SLASH_X - 90, 190, CFG.SLASH_X + 70, 400);
    this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.setVisible(false) });
  }

  /* --- 切られた乗客：片足がポンッと飛ぶ（血は出さない） --- */
  cutPassenger(p) {
    p.cut = true;
    p.judged = true;
    p.open = 1;
    this.applyLegs(p);

    const worldX = p.c.x + p.legL.x;
    const worldY = p.c.y + p.legL.y;
    const leg = this.add.image(worldX, worldY, 'leg_' + p.variant)
      .setOrigin(0.5, 0.07).setDepth(30);
    leg.rotation = p.legL.rotation;
    this.flyingLegs.push({
      img: leg,
      vx: CFG.LEG_VX + Math.random() * 120,
      vy: CFG.LEG_VY - Math.random() * 90,
      vr: 12 + Math.random() * 6
    });
    p.legL.destroy();

    // 切断面は白い丸で表現
    const cut = this.add.circle(-20, 2, 15, 0xfff5e0)
      .setStrokeStyle(5, 0x1a1a1a);
    p.c.add(cut);

    // 「えっ…」という顔 → 片足でぴょんぴょん
    p.head.setTexture('head_shock_' + p.headVariant);
    p.hopT = 0.0001;
    this.tweens.add({ targets: p.c, angle: { from: -6, to: 6 }, duration: 70, yoyo: true, repeat: 3, onComplete: () => { p.c.angle = 0; } });
  }

  popup(x, text, color) {
    const t = this.add.text(x, 210, text, {
      fontFamily: FONT, fontSize: '36px', color: color,
      stroke: '#fff5e0', strokeThickness: 8
    }).setOrigin(0.5);
    this.popupLayer.add(t);
    this.tweens.add({ targets: t, y: 150, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }

  addMiss() {
    this.miss += 1;
    const m = this.missMarks[Math.min(this.miss, CFG.MAX_MISS) - 1];
    m.setAlpha(1).setColor('#e03b2f');
    this.tweens.add({ targets: m, scale: { from: 1.8, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    this.cameras.main.shake(140, 0.006);
    if (this.miss < CFG.MAX_MISS) Sfx.miss();
    if (this.miss >= CFG.MAX_MISS) this.gameOver();
  }

  gameOver() {
    this.over = true;
    Sfx.gameover();
    this.input.removeAllListeners('pointerdown');
    this.time.delayedCall(900, () => {
      this.scene.start('GameOver', { score: this.score });
    });
  }

  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    if (!this.over) this.elapsed += dt;

    const speed = this.over ? 0 : this.ramp(CFG.SPEED_START, CFG.SPEED_MAX);

    // 主人公は歩いているように上下に揺れる
    this.heroBob += dt * (speed / 16);
    this.hero.y = CFG.FLOOR_Y - Math.abs(Math.sin(this.heroBob)) * 7;

    // 乗客の出現
    if (!this.over) {
      this.distToNext -= speed * dt;
      if (this.distToNext <= 0) {
        this.spawnPassenger();
        const gap = this.ramp(CFG.GAP_START, CFG.GAP_MIN);
        this.distToNext = gap + (Math.random() - 0.5) * CFG.GAP_JITTER;
      }
    }

    for (let i = this.passengers.length - 1; i >= 0; i--) {
      const p = this.passengers[i];
      p.c.x -= speed * dt;

      // 途中で開く標的：近づくとゆっくり開き始める
      if (p.kind === KIND.LATE && !p.cut) {
        const d = p.c.x - CFG.SLASH_X;
        const r = (CFG.OPEN_START_D - d) / (CFG.OPEN_START_D - CFG.OPEN_FULL_D);
        p.open = Phaser.Math.Clamp(r, 0, 1);
        this.applyLegs(p);
      }

      // 片足でぴょんぴょん逃げる
      if (p.hopT) {
        p.hopT += dt;
        p.c.y = CFG.HIP_Y - Math.abs(Math.sin(p.hopT * 11)) * 16;
        p.c.x -= 40 * dt;
      }

      // 標的を切らずに通り過ぎた
      if (!p.judged && p.c.x < CFG.SLASH_X - CFG.SLASH_HALF) {
        p.judged = true;
        if (this.isTargetKind(p)) {
          this.popup(p.c.x, '見のがし…', '#c0392b');
          this.addMiss();
        }
      }

      if (p.c.x < -160) { p.c.destroy(); this.passengers.splice(i, 1); }
    }

    // 飛んでいく足
    for (let i = this.flyingLegs.length - 1; i >= 0; i--) {
      const f = this.flyingLegs[i];
      f.vy += CFG.LEG_GRAVITY * dt;
      f.img.x += (f.vx - speed) * dt;
      f.img.y += f.vy * dt;
      f.img.rotation += f.vr * dt;
      if (f.img.y > GAME_H + 160 || f.img.x > GAME_W + 160 || f.img.x < -160) {
        f.img.destroy();
        this.flyingLegs.splice(i, 1);
      }
    }
  }
}
