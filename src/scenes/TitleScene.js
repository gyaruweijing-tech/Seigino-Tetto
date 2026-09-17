class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  preload() {
    const svg = (key, path, w, h) => this.load.svg(key, path, { width: w, height: h });
    svg('car_wall', 'assets/car_wall.svg', 240, 300);
    svg('seat', 'assets/seat.svg', 240, 120);
    svg('hero', 'assets/hero.svg', 150, 275);
    svg('hero_slash', 'assets/hero_slash.svg', 150, 275);
    ['a', 'b', 'c'].forEach(k => {
      svg('body_' + k, 'assets/passenger_body_' + k + '.svg', 100, 105);
      svg('leg_' + k, 'assets/passenger_leg_' + k + '.svg', 28, 94);
      svg('head_' + k, 'assets/passenger_head_' + k + '.svg', 78, 78);
      svg('head_shock_' + k, 'assets/passenger_head_shock_' + k + '.svg', 78, 78);
    });
  }

  create() {
    drawTrainInterior(this);

    // 見本：ふつうの乗客と標的をタイトルに並べる
    makePassengerVisual(this, 760, 'a', 'a', false).setDepth(6);
    makePassengerVisual(this, 900, 'b', 'b', true).setDepth(6);
    const hero = this.add.image(185, 520, 'hero').setOrigin(0.5, 1);
    this.tweens.add({ targets: hero, y: 513, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add.rectangle(0, 46, GAME_W, 190, 0x1a1a1a, 0.5).setOrigin(0, 0).setDepth(4);
    this.add.text(GAME_W / 2, 92, '大股びらき男をキル', {
      fontFamily: FONT, fontSize: '72px', color: '#fff5e0',
      stroke: '#1a1a1a', strokeThickness: 14
    }).setOrigin(0.5).setDepth(5);

    this.add.text(GAME_W / 2, 158, '電車の平和は、お前の一閃にかかっている', {
      fontFamily: FONT, fontSize: '24px', color: '#fff5e0'
    }).setOrigin(0.5).setDepth(5);

    const hi = this.add.text(GAME_W / 2, 208, 'ハイスコア  ' + loadHighScore(), {
      fontFamily: FONT, fontSize: '32px', color: '#ffd84a',
      stroke: '#1a1a1a', strokeThickness: 8
    }).setOrigin(0.5);
    hi.setDepth(5);

    const tap = this.add.text(GAME_W / 2, 470, 'タップでスタート', {
      fontFamily: FONT, fontSize: '40px', color: '#fff5e0',
      stroke: '#1a1a1a', strokeThickness: 10
    }).setOrigin(0.5).setDepth(5);
    this.tweens.add({ targets: tap, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });

    this.input.once('pointerdown', () => {
      Sfx.unlock();
      Sfx.slash();
      this.scene.start('Game');
    });
  }
}

/* 車内（壁・窓・座席・床）を描く。全シーンで共用 */
function drawTrainInterior(scene) {
  scene.add.tileSprite(0, 0, GAME_W, 300, 'car_wall').setOrigin(0, 0);
  scene.add.tileSprite(0, 300, GAME_W, 120, 'seat').setOrigin(0, 0);
  const g = scene.add.graphics();
  g.fillStyle(0xcdbd9c, 1).fillRect(0, 420, GAME_W, 120);
  g.lineStyle(6, 0x1a1a1a, 1).lineBetween(0, 420, GAME_W, 420);
  g.fillStyle(0xbfae8c, 1);
  for (let x = -40; x < GAME_W + 80; x += 80) g.fillRect(x, 424, 40, 116);
}

/* タイトル用の飾り乗客（動かない） */
function makePassengerVisual(scene, x, bodyKey, headKey, open) {
  const c = scene.add.container(x, 300);
  const legL = scene.add.image(-20, -8, 'leg_' + bodyKey).setOrigin(0.5, 0.07);
  const legR = scene.add.image(20, -8, 'leg_' + bodyKey).setOrigin(0.5, 0.07);
  legL.rotation = open ? 0.62 : 0.06;
  legR.rotation = open ? -0.62 : -0.06;
  const body = scene.add.image(0, 0, 'body_' + bodyKey).setOrigin(0.5, 1);
  const head = scene.add.image(0, -95, 'head_' + headKey).setOrigin(0.5, 1);
  c.add([legL, legR, body, head]);
  return c;
}
