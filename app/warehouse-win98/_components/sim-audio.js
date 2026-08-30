/* ═══════════════════════════════════════════════════════════════════════════
   적재 시뮬레이션 사운드 — 배경음(음원 파일)과 적재 효과음(합성)

   ★ 배경음은 림스키코르사코프 「왕벌의 비행」(1900) **실제 연주 음원**이다 (사용자 요청 —
     합성음이 전자음 같다). 24초짜리 시뮬레이션에 이 곡을 고른 이유는, 처음부터 끝까지
     쉬지 않고 질주해서 **어디를 잘라도 그 성격이 그대로**이기 때문이다. 웅장한 곡은
     쌓아 올릴 시간이 필요한데 24초로는 도입부만 나오고 끝난다.

   ⚠️ **저작권 — 두 겹을 따로 본다.**
        · 곡(작곡): 만료. 림스키코르사코프는 1908년에 죽었다
        · 음원(연주·녹음): **따로 보호된다.** 곡이 만료됐다고 아무 녹음이나 쓸 수 없다
      그래서 이 파일은 **위키미디어(퍼블릭 도메인) 출처**다 (사용자 확인). 출처가 불확실한
      녹음으로 갈아 끼우면 안 된다 — 고객사 시연물이다.
      이전 요청으로 나왔던 슈퍼마리오·크레이지아케이드·반지의 제왕은 **곡 자체가** 살아 있는
      저작물이라 쓰지 않았다. "서비스가 끝났으니 저작권도 없다"는 사실이 아니다.

   ⚠️ 배경음만 파일이고 **적재 효과음은 그대로 합성한다.** 짧은 효과음까지 파일로 두면
      번들이 늘고, 무엇보다 이 소리는 지금 것이 좋다는 확인을 받았다.
   ⚠️ 배경음은 `<audio>` 로 튼다. 1.7MB 를 통째로 디코딩해 Web Audio 그래프에 얹을 이유가
      없다 — 브라우저가 알아서 스트리밍하고, 음량도 `volume` 하나로 끝난다.
   ⚠️ 브라우저는 **사용자가 뭔가 누른 뒤에만** 소리를 낸다(자동재생 정책). 입고 화면에서
      넘어와 시뮬레이션이 자동 시작하는 경로는 그 동작 밖이라 조용히 막힌다 — 그때는 다음
      클릭·키 입력 한 번으로 살아나게 걸어 둔다.
   ⚠️ 소리를 못 내는 환경에서도 **화면은 그대로 돌아야 한다.** 모든 진입점을 try 로 감싸고,
      실패하면 조용히 아무 일도 하지 않는다.
   ═══════════════════════════════════════════════════════════════════════════ */

/** 배경음 파일 (public/ 아래 — 배포 때 그대로 올라간다) */
const BGM_SRC = "/audio/flight-of-the-bumblebee.mp3";
/** 배경음 음량. 말소리를 덮지 않는 선 */
const BGM_VOL = 0.34;

/** 미디 번호 → 주파수 (A4 = 69 = 440Hz) */
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function createSimAudio() {
  let bgm = null;    // HTMLAudioElement
  let ctx = null;    // 효과음용 Web Audio
  let bus = null;
  let muted = false;

  /** 배경음 — 한 번만 만들어 다시 쓴다 */
  const ensureBgm = () => {
    if (bgm) return true;
    try {
      bgm = new Audio(BGM_SRC);
      bgm.loop = true;          // 곡이 73초라 24초 시연에는 안 돌지만, 길어져도 끊기지 않게
      bgm.volume = BGM_VOL;
      bgm.preload = "auto";
      return true;
    } catch {
      return false;
    }
  };

  /** 효과음 — 배경음과 달리 그때그때 만든다 */
  const ensureCtx = () => {
    if (ctx) return true;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 6;
      bus = ctx.createGain();
      bus.gain.value = 0.55;
      bus.connect(comp);
      comp.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  };

  /**
   * 자동재생이 막혔을 때, **다음 사용자 동작 한 번**으로 소리를 살린다.
   * ⚠️ 두 리스너를 서로 지운다. once 만 걸면 클릭으로 살아난 뒤에도 keydown 이 남는다.
   */
  const armResume = () => {
    const go = () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
      try { bgm?.play?.().catch(() => {}); } catch { /* 이미 정리됐을 수 있다 */ }
      try { ctx?.resume(); } catch { /* 위와 같다 */ }
    };
    window.addEventListener("pointerdown", go);
    window.addEventListener("keydown", go);
  };

  /**
   * 효과음 한 음.
   * ⚠️ 게인을 **0 으로 떨어뜨리지 않고 아주 작은 값까지** 줄인다.
   *    exponentialRampToValueAtTime 은 0 을 못 받는다 — 0 을 주면 소리가 안 난다.
   */
  const synth = (midi, at, dur, opt = {}) => {
    const { types = ["square", "triangle"], vol = 0.16, hi = 7000, lo = 1500 } = opt;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.Q.value = 4;
    f.frequency.setValueAtTime(hi, at);
    f.frequency.exponentialRampToValueAtTime(lo, at + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    types.forEach((t, i) => {
      const o = ctx.createOscillator();
      o.type = t;
      o.frequency.value = hz(midi);
      o.detune.value = i === 0 ? -5 : 5;
      o.connect(f);
      o.start(at);
      o.stop(at + dur + 0.03);
    });
    f.connect(g);
    g.connect(bus);
  };

  return {
    /** 시뮬레이션 시작 — 사용자가 버튼을 누른 흐름 안에서 불러야 소리가 난다 */
    start() {
      if (muted || !ensureBgm()) return;
      try {
        bgm.currentTime = 0;
        /* ⚠️ `play()` 는 프라미스다. 막히면 **예외가 아니라 거절**로 온다 — try 로는 못 잡는다.
           거절을 받아 그때 다음 동작 한 번에 살아나게 걸어 둔다. */
        const p = bgm.play();
        if (p && typeof p.catch === "function") p.catch(() => armResume());
      } catch { /* 소리는 없어도 그만 */ }
    },

    stop() {
      try {
        if (bgm) { bgm.pause(); bgm.currentTime = 0; }
      } catch { /* 이미 정리됐을 수 있다 */ }
    },

    /** 슬롯에 들어간 순간 — 짧게 올라가는 아르페지오 (사용자 확인: 이 소리는 그대로 둔다) */
    stow() {
      if (muted || !ensureCtx() || !ctx) return;
      try {
        ctx.resume();
        const t = ctx.currentTime + 0.01;
        /* 위로 네 음, 마지막을 길게 — 오르다 멈추면 "됐다"로 들린다 */
        [72, 76, 79, 84].forEach((m, i) => {
          synth(m, t + i * 0.05, i === 3 ? 0.36 : 0.09);
        });
        synth(91, t + 0.15, 0.32, { types: ["triangle"], vol: 0.08, hi: 8000, lo: 4000 });
      } catch { /* 소리는 없어도 그만 */ }
    },

    get muted() { return muted; },
    setMuted(v) {
      muted = v;
      if (v) this.stop();
    },

    dispose() {
      try {
        if (bgm) { bgm.pause(); bgm.src = ""; }
      } catch { /* 이미 정리됐다 */ }
      bgm = null;
      try { ctx?.close(); } catch { /* 이미 닫혔다 */ }
      ctx = null;
      bus = null;
    },
  };
}
