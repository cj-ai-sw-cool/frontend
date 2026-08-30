/* ═══════════════════════════════════════════════════════════════════════════
   적재 시뮬레이션 사운드 — 배경음(음원 파일)과 적재 효과음(합성)

   ★ 배경음은 **사용자가 직접 만든 음원**이다 (`public/audio/sim-bgm.mp3`).

   ⚠️ **저작권 — 두 겹을 따로 본다.** 곡(작곡)과 음원(연주·녹음)은 별개로 보호되므로,
      곡이 만료됐다고 아무 녹음이나 쓸 수 없고 남의 녹음이면 곡이 만료돼도 못 쓴다.
      이 파일은 사용자가 만든 것이라 둘 다 문제없다 (본인 확인).
      ⚠️ **다른 파일로 갈아 끼울 때 이 확인을 다시 해야 한다.** 고객사 시연물이라 출처가
         불확실한 음원은 넣지 않는다. 이전 요청으로 나왔던 슈퍼마리오·크레이지아케이드·
         반지의 제왕은 곡 자체가 살아 있는 저작물이라 쓰지 않았다 — "서비스가 끝났으니
         저작권도 없다"는 사실이 아니다.

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
const BGM_SRC = "/audio/sim-bgm.mp3";
/** 배경음 음량. 말소리를 덮지 않는 선 */
const BGM_VOL = 0.34;
/* ★ 도입부를 건너뛰고 **하이라이트부터** 튼다 (사용자 요청). 시뮬레이션이 24초뿐이라
     잔잔한 도입부에 그 시간을 다 쓰면 곡이 시작되기도 전에 화면이 끝난다.
   ⚠️ 이 숫자는 **귀로 맞춰야 한다.** 곡마다 하이라이트가 시작하는 자리가 다르고, 파형만
      봐서는 "여기서부터가 좋다"를 알 수 없다. 음원을 바꾸면 이 값도 같이 봐야 한다. */
const BGM_START = 12;
/* ★ 1.2배속 (사용자 요청).
   ⚠️ 브라우저는 기본으로 **음높이를 지킨다**(`preservesPitch`). 배속을 올려도 음이 안
      올라간다는 뜻이다 — 테이프 빨리 감는 소리를 원하면 그 값을 false 로 두면 된다. */
const BGM_RATE = 1.2;

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
      bgm.volume = BGM_VOL;
      bgm.playbackRate = BGM_RATE;
      bgm.preload = "auto";
      /* ⚠️ `loop = true` 를 쓰지 않는다. 그건 **0초로** 되감아서, 한 바퀴 돈 뒤에는 건너뛴
         도입부가 다시 나온다. 끝나면 하이라이트 자리로 되돌려 다시 튼다.
         (곡 151초를 1.2배속으로 돌면 126초라 24초 시연에서 여기까지 올 일은 없지만,
          시연이 길어지거나 화면을 켜 둔 채 두었을 때를 위해 맞춰 둔다) */
      bgm.addEventListener("ended", () => {
        try {
          bgm.currentTime = BGM_START;
          bgm.play().catch(() => {});
        } catch { /* 이미 정리됐을 수 있다 */ }
      });
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
        bgm.currentTime = BGM_START;
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
