/* 効果音は Web Audio API で合成する（音声ファイルは使わない） */
const Sfx = (function () {
  let ctx = null;

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function env(gain, t0, attack, decay, peak) {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  function tone(type, f0, f1, dur, peak, delay) {
    if (!ctx) return;
    const t0 = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
    env(g, t0, 0.008, dur, peak);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, peak, f0, f1) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(f0, t0);
    bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain();
    env(g, t0, 0.005, dur, peak);
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(t0);
  }

  return {
    unlock: unlock,
    // 居合切り「シャキーン」
    slash: function () { noise(0.22, 0.30, 7000, 1800); tone('triangle', 2600, 900, 0.20, 0.10); },
    // 足が飛ぶ「ポンッ」
    pon: function () { tone('sine', 300, 1300, 0.12, 0.34); tone('sine', 900, 1700, 0.08, 0.14, 0.02); },
    // ミス
    miss: function () { tone('square', 220, 90, 0.30, 0.18); },
    // ゲームオーバー
    gameover: function () {
      tone('square', 520, 500, 0.18, 0.16, 0.00);
      tone('square', 400, 380, 0.18, 0.16, 0.16);
      tone('square', 300, 280, 0.22, 0.16, 0.32);
      tone('square', 180, 90, 0.60, 0.18, 0.52);
    }
  };
})();
