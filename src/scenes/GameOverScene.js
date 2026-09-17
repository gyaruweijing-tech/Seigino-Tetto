class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }

  init(data) { this.score = (data && data.score) || 0; }

  create() {
    drawTrainInterior(this);

    const prev = loadHighScore();
    const isNew = this.score > prev;
    const high = isNew ? this.score : prev;
    if (isNew) saveHighScore(this.score);

    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x1a1a1a, 0.55).setOrigin(0, 0);

    this.add.text(GAME_W / 2, 110, 'ゲームオーバー', {
      fontFamily: FONT, fontSize: '64px', color: '#fff5e0',
      stroke: '#1a1a1a', strokeThickness: 12
    }).setOrigin(0.5);

    this.add.text(GAME_W / 2, 215, 'スコア  ' + this.score, {
      fontFamily: FONT, fontSize: '52px', color: '#fff5e0',
      stroke: '#1a1a1a', strokeThickness: 10
    }).setOrigin(0.5);

    this.add.text(GAME_W / 2, 290, 'ハイスコア  ' + high, {
      fontFamily: FONT, fontSize: '36px', color: isNew ? '#ffd84a' : '#fff5e0',
      stroke: '#1a1a1a', strokeThickness: 8
    }).setOrigin(0.5);

    if (isNew) {
      const n = this.add.text(GAME_W / 2, 340, 'ハイスコア更新！', {
        fontFamily: FONT, fontSize: '32px', color: '#ffd84a',
        stroke: '#1a1a1a', strokeThickness: 8
      }).setOrigin(0.5);
      this.tweens.add({ targets: n, scale: { from: 1.15, to: 1 }, duration: 500, yoyo: true, repeat: -1 });
    }

    const tap = this.add.text(GAME_W / 2, 440, 'タップでもう一回', {
      fontFamily: FONT, fontSize: '40px', color: '#fff5e0',
      stroke: '#1a1a1a', strokeThickness: 10
    }).setOrigin(0.5);
    this.tweens.add({ targets: tap, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });

    this.time.delayedCall(700, () => {
      this.input.once('pointerdown', () => this.scene.start('Game'));
    });
  }
}
