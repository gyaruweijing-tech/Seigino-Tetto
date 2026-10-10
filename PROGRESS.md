# PROGRESS.md — 作業の記憶

Claude Code が次のセッションで読み直すためのメモ。
仕様は `docs/SPEC.md`、**いま何がどうなっているか・次に何をしたいか**はこのファイル。

---

## 1. いまの状態（2026-09-17 時点）

遊べる最小構成が動いている。main にマージ済み。

| 項目 | 状態 |
|---|---|
| ゲーム本体 | 完成（タイトル → ゲーム → ゲームオーバー） |
| 判定ロジック | +1 / -1 / 見のがし / ミス3回終了 すべて実装・検証済み |
| 途中で股を開く標的 | 実装済み |
| 難易度カーブ | 実装済み（時間で速さ・密度・標的率が上がる） |
| 足が飛ぶ演出 | 実装済み（切断面は白丸、血なし） |
| 効果音 | Web Audio API で合成（音声ファイルなし） |
| ハイスコア | localStorage |
| 公開 | Vercel 連携はユーザー側で作業中 |

### ファイル構成

```
index.html                    Phaser 3 を CDN から読む。縦持ち警告もここ（CSSのみ）
src/main.js                   画面サイズ・フォント・ハイスコア読み書き・Phaser起動
src/audio.js                  効果音を Web Audio API で合成（Sfx.slash/pon/miss/gameover）
src/scenes/TitleScene.js      全アセットの preload ＋ drawTrainInterior()（車内描画の共通関数）
src/scenes/GameScene.js       本体。冒頭の CFG に調整用の定数が全部ある
src/scenes/GameOverScene.js   スコア・ハイスコア表示
assets/*.svg                  自作SVG
assets/reference/             参照画像の置き場（まだ空）
```

### いじる場所の目安

- **難しすぎ／簡単すぎ** → `src/scenes/GameScene.js` 冒頭の `CFG`
- **絵を変えたい** → `assets/*.svg`（読み込みサイズは `TitleScene.preload()` で指定）
- **音を変えたい** → `src/audio.js`
- **車内の背景** → `TitleScene.js` の `drawTrainInterior()`

### 設計で決めたこと（迷ったら思い出す）

- **主人公と標的は重ねない。** 主人公 `HERO_X: 225` の少し先 `SLASH_X: 350` が「目の前」。
  主人公が標的を隠さないので、脚の開き具合が読める。
- **「途中で開く標的」の判定は、切った瞬間に開いているかで決まる。**
  開く前に切ると「人ちがい」で -1。だから焦って早撃ちすると損をする ＝ 見極めが意味を持つ。
  開き具合は時間ではなく **距離** で決まる（`OPEN_START_D` → `OPEN_FULL_D`）。速さが上がっても不公平にならない。
- **乗客の最小間隔 `GAP_MIN: 170` は、切れる範囲 `SLASH_HALF: 70` の2倍より大きく保つ。**
  そうしないと2人同時に射程に入って、どっちが切られたか分からなくなる。

---

## 2. 次にやりたいこと

### 32×32 スプライトシートでキャラを動かす（本人からのリクエスト）

> 1コマ 32×32 ピクセル、横3コマ × 縦4段のスプライトシート。矢印キーで歩かせる。

これは **RPGツクール形式** と呼ばれる、昔から使われている定番のキャラ画像の並べ方。
1枚の画像（96×128px）に12コマが入っていて、縦の段が向き、横の並びが歩くコマ。

```
        コマ0    コマ1    コマ2       ←左足→止まり→右足 の3コマで歩いて見える
段0  ↓ 正面向き  □ □ □
段1  ← 左向き    □ □ □
段2  → 右向き    □ □ □
段3  ↑ 後ろ向き  □ □ □
```

Phaser 3 での扱い方（これが「実際のゲーム作りで使われているやり方」）:

```js
// 読み込み：1枚の画像を32×32の格子に切り分ける
this.load.spritesheet('chara', 'assets/chara.png', { frameWidth: 32, frameHeight: 32 });

// 向きごとに歩くアニメを定義（frameRate=1秒間に何コマ、repeat:-1=ずっと繰り返し）
this.anims.create({
  key: 'walk-down',
  frames: this.anims.generateFrameNumbers('chara', { start: 0, end: 2 }),
  frameRate: 8, repeat: -1
});
// walk-left は start:3,end:5 / walk-right は 6,8 / walk-up は 9,11

// 矢印キー
this.cursors = this.input.keyboard.createCursorKeys();
// update() の中で cursors.left.isDown などを見て、速度とアニメを切り替える
```

ドット絵をぼかさない設定（これを忘れると32×32が滲む）:

```js
// main.js の config に足す
render: { pixelArt: true }
// さらに拡大表示するなら sprite.setScale(3) など整数倍にする
```

**注意：これは「大股びらき男をキル」に足す機能ではない。**
このゲームは自動で歩く・タップだけ、という仕様なので、矢印キー移動を足すと `docs/SPEC.md` の
「機能を増やさない」に反する。**別の練習用ページ（別リポジトリか別ブランチ）でやる。**

### 絵柄・演出を「ちゃんとした手法」で良くしていく

本人の言葉：「無理やりやるんじゃなくて、実際にゲーム作りで使われている技術をつかって」。
やるとしたら、効果が大きい順に：

1. **スプライトシート／テクスチャアトラス** — いまは SVG を1枚ずつ読んでいる。
   複数の絵を1枚にまとめると読み込みが速く、コマ送りのアニメも作れる。
2. **カットアウト方式のままアニメを足す** — いまのやり方（胴体・脚・頭を別パーツにして回す）は
   *カットアウトアニメーション* という立派な手法。呼吸で上下する、脚が少し揺れる、などを
   足すだけで生き物っぽくなる。切断があるので、この方式は今のゲームには合っている。
3. **イージング** — 動きの緩急。Phaser の tween に `ease: 'Back.easeOut'` などを入れる。
   等速の動きは安っぽく見えるので、ここの効果は大きい。
4. **多重スクロール（パララックス）** — 窓の外の景色を、車内より速く流す。奥行きが出る。
5. **画面の手ごたえ** — 切った瞬間の一瞬停止（ヒットストップ）、軽い画面揺れ。
   揺れは `this.cameras.main.shake()` で実装済み。ヒットストップは未実装。

---

## 3. 作業環境のメモ（ハマったこと）

- **git の author は noreply アドレスを使う。**
  `262595551+gyaruweijing-tech@users.noreply.github.com`。
  生のメールアドレスだと GitHub に push を拒否される（email privacy restrictions）。
  → `git config user.email` に設定済み。
- **Vercel の設定**：Import 時に Framework Preset = **Other**、
  Build Command と Output Directory は **空のまま**。ルートの `index.html` がそのまま配信される。
- **ブラウザでの動作確認のやり方**（このサンドボックス内）：
  `python3 -m http.server` でローカル配信 → Playwright ＋
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` で開く。
  ただし **CDN（jsdelivr）はサンドボックスから遮断されている**ので、
  `npm i phaser` で取ってきた `phaser.min.js` を Playwright の `page.route()` で差し込む。
- **デバッグ用に `window.game` を公開してある**（`src/main.js`）。
  ブラウザのコンソールから `game.scene.getScene('Game')` でシーンの中身を覗ける。
  自動テストでもこれを使って、標的を好きな位置に置いて判定を検証した。
