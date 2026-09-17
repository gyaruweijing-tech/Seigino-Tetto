/* 画面サイズなどの基本設定 */
const GAME_W = 960;
const GAME_H = 540;
const FONT = '"Hiragino Maru Gothic ProN", "Yu Gothic", "Meiryo", sans-serif';
const HIGHSCORE_KEY = 'oomata_highscore';

function loadHighScore() {
  try { return parseInt(localStorage.getItem(HIGHSCORE_KEY) || '0', 10) || 0; }
  catch (e) { return 0; }
}
function saveHighScore(v) {
  try { localStorage.setItem(HIGHSCORE_KEY, String(v)); } catch (e) {}
}

window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#e9e4da',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true },
  scene: [TitleScene, GameScene, GameOverScene]
});
