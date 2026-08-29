/* ═══════════════════════════════════════════════════════════════════════════
   적재 시뮬레이션 사운드 — 칩튠 배경음과 효과음

   ★ 시뮬레이션이 도는 동안 빠른 칩튠이 깔리고, 슬롯에 물건이 들어갈 때마다 짧게 올라가는
     효과음이 난다 (사용자 요청). 화면만으로도 되는 장면이지만, 소리가 붙으면 "돌아가는
     설비"로 읽힌다.
   ★ **레퍼런스에 맞춰 다시 썼다** (사용자 지적 — 루즈하고 저급 전자음 같다, 그리고
     retro_platformer_bgm 을 참고해 달라). 파형을 분석해 성격만 가져왔다:
       · 템포 190 → 252 → **420** (8분음표 기준. 레퍼런스의 4분음표 225 에 맞춘 값)
       · G 메이저로 옮기고 G - D - Em - C 로 돌린다
       · **밝고 선율 중심**으로 — 킥·스네어를 눌러 두고 리드와 16분 아르페지오를 앞세운다
       · 사각파 하나로 내던 음을 **디튠한 두 오실레이터 + 로우패스 포락선**으로. 필터가
         닫히면서 나는 소리가 값싼 삐 소리와 두꺼운 신스를 가른다
       · 딜레이를 물렸다. 잔향이 없으면 소리가 화면에서 튀어나와 붙어 있는 것처럼 들린다
   ★ 적재 순간 효과음(stow)은 **그대로 둔다** (사용자 확인 — 지금 소리 좋다).

   ⚠️ **남의 곡을 옮겨 적지 않는다.** 요청은 슈퍼마리오 곡이었지만 그건 닌텐도 저작물이고,
      이 화면은 고객사 시연에 쓰인다. 멜로디 자체가 보호 대상이라 음을 그대로 받아 적으면
      음원 파일을 쓰지 않아도 마찬가지다. 그래서 **같은 결의 곡을 새로 썼다**.
   ⚠️ 음원 **파일을 쓰지 않는다.** Web Audio 로 그때그때 만든다:
        · 번들에 mp3 가 안 붙는다 (배포 용량과 첫 로딩)
        · 배속이 숫자 하나(BPM)다 — 파일이면 재생 속도를 바꿀 때 음이 같이 낮아진다
        · 브라우저가 알아서 섞어 주므로 효과음이 배경음을 끊지 않는다
   ⚠️ AudioContext 는 **사용자가 뭔가 누른 뒤에만** 소리를 낸다(자동재생 정책). 그래서
      만들기만 하고 두었다가 start() 에서 resume() 한다 — 시뮬레이션은 버튼으로 시작하므로
      그 클릭이 곧 허락이다.
   ⚠️ 소리를 못 만드는 환경(구형 브라우저·정책 차단)에서도 **화면은 그대로 돌아야 한다.**
      모든 진입점을 try 로 감싸고, 실패하면 조용히 아무 일도 하지 않는다.
   ═══════════════════════════════════════════════════════════════════════════ */

/** 미디 번호 → 주파수 (A4 = 69 = 440Hz) */
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/* ── 곡 ──────────────────────────────────────────────────────────────────────
   8분음표 32칸(네 마디). 0 은 쉼표.
   ★ 사용자가 준 레퍼런스(retro_platformer_bgm_1_5x.wav)를 **분석해서 성격만 맞췄다.**
     그 파일을 그대로 쓰거나 음을 받아 적지 않는다 — 남의 곡이고, 이 화면은 고객사 시연에
     쓰인다. 파형에서 읽은 것은 셋이다:
       · 템포 약 225 BPM (4분음표) → 여기 8분음표 기준으로 420
       · 두드러진 음 D · B · A · G · E · C → **G 메이저**. 그래서 G - D - Em - C 로 돈다
       · 대역 에너지가 저역 12% / 멜로디·고역 77% → **밝고 선율 중심**. 킥과 베이스를
         눌러 두고 리드와 아르페지오를 앞세운 것이 이 숫자다
   ⚠️ 멜로디는 6옥타브를 넘기지 않는다. 더 올리면 사각파가 날카로워져 오래 들으면 피곤하다. */
const LEAD = [
  79, 83, 86, 83, 81, 79, 76, 79,   // G
  78, 81, 86, 81, 79, 78, 74, 78,   // D
  76, 79, 83, 79, 78, 76, 74, 76,   // Em
  72, 76, 79, 83, 81, 79, 76, 74,   // C
];
/* 16분음표 아르페지오 — 한 마디에 열여섯 칸씩, 네 마디치를 그대로 적어 둔다.
   ⚠️ 길이가 **64** 여야 한다. 예전처럼 16칸만 두면 한 마디 만에 한 바퀴를 돌아, 리드가
      코드를 바꿔도 아르페지오는 G 코드를 계속 굴린다. */
const ARP = [
  67, 71, 74, 71, 67, 71, 74, 71, 67, 71, 74, 71, 67, 71, 74, 71,   // G
  62, 66, 69, 66, 62, 66, 69, 66, 62, 66, 69, 66, 62, 66, 69, 66,   // D
  64, 67, 71, 67, 64, 67, 71, 67, 64, 67, 71, 67, 64, 67, 71, 67,   // Em
  60, 64, 67, 64, 60, 64, 67, 64, 60, 64, 67, 64, 60, 64, 67, 64,   // C
];
/** 베이스는 8분음표. 근음에서 옥타브로 튀는 플랫포머 특유의 걸음이다 */
const BASS = [
  43, 43, 55, 43, 43, 43, 55, 50,
  38, 38, 50, 38, 38, 38, 50, 45,
  40, 40, 52, 40, 40, 40, 52, 47,
  36, 36, 48, 36, 36, 36, 48, 43,
];

/** 분당 박자. 8분음표 기준이라 4분음표로는 이 절반이다 — 레퍼런스의 225 에 맞춘 값 */
const BPM = 420;

export function createSimAudio() {
  let ctx = null;
  let master = null;   // 전체 볼륨
  let bus = null;      // 악기가 물리는 자리 (컴프레서 앞)
  let delaySend = null;
  let noise = null;    // 드럼용 화이트 노이즈 (한 번만 만든다)
  let timer = null;
  let step = 0;
  let nextAt = 0;
  let muted = false;

  const ensure = () => {
    if (ctx) return true;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();

      master = ctx.createGain();
      master.gain.value = 0.2;   // 배경음이다 — 말소리를 덮으면 안 된다

      /* ⚠️ 컴프레서를 하나 물린다. 킥·베이스·선율이 같은 순간에 겹치면 합이 1 을 넘어
         **찢어지는 소리**가 나는데, 값싼 전자음처럼 들리는 원인이 대개 이것이다. */
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 6;
      comp.attack.value = 0.004;
      comp.release.value = 0.14;

      bus = ctx.createGain();
      bus.connect(comp);
      comp.connect(master);
      master.connect(ctx.destination);

      /* 점8분음표 딜레이 — 칩튠에 공간감을 주는 가장 싼 방법이다.
         ⚠️ 되먹임을 0.3 밑으로 둔다. 넘기면 소리가 스스로 자라 뭉갠다.
         ⚠️ 되풀이되는 소리는 로우패스로 **어둡게** 만든다. 같은 밝기로 돌아오면
            잔향이 아니라 박자가 어긋난 두 번째 연주로 들린다. */
      const dly = ctx.createDelay(1.0);
      dly.delayTime.value = (60 / BPM) * 1.5;
      const fb = ctx.createGain();
      fb.gain.value = 0.28;
      const wet = ctx.createGain();
      wet.gain.value = 0.22;
      const damp = ctx.createBiquadFilter();
      damp.type = "lowpass";
      damp.frequency.value = 2600;
      dly.connect(damp); damp.connect(fb); fb.connect(dly);
      dly.connect(wet); wet.connect(bus);
      delaySend = dly;

      /* 노이즈는 1초짜리 하나를 만들어 드럼마다 잘라 쓴다 */
      const len = ctx.sampleRate;
      noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return true;
    } catch {
      return false;   // 소리가 없어도 화면은 돈다 (머리말 참고)
    }
  };

  /**
   * 신스 음 하나. 살짝 어긋나게 맞춘 두 오실레이터를 로우패스에 통과시킨다.
   * ⚠️ 게인을 **0 으로 떨어뜨리지 않고 아주 작은 값까지** 줄인다.
   *    exponentialRampToValueAtTime 은 0 을 못 받는다 — 0 을 주면 소리가 안 난다.
   * ⚠️ 필터를 **닫으면서** 끝낸다. 열어 둔 채 볼륨만 줄이면 끝까지 쨍한 채로 작아져서
   *    딱 그 "저급 전자음"이 된다.
   */
  const synth = (midi, at, dur, opt = {}) => {
    const { types = ["square", "sawtooth"], vol = 0.12, hi = 4200, lo = 700, send = 0 } = opt;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.Q.value = 6;
    f.frequency.setValueAtTime(hi, at);
    f.frequency.exponentialRampToValueAtTime(lo, at + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.006);   // 딱 끊어 시작하면 틱 소리가 난다
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    types.forEach((t, i) => {
      const o = ctx.createOscillator();
      o.type = t;
      o.frequency.value = hz(midi);
      o.detune.value = i === 0 ? -7 : 7;   // 살짝 어긋나야 두께가 생긴다
      o.connect(f);
      o.start(at);
      o.stop(at + dur + 0.03);
    });
    f.connect(g);
    g.connect(bus);
    if (send > 0) {
      const sg = ctx.createGain();
      sg.gain.value = send;
      g.connect(sg);
      sg.connect(delaySend);
    }
  };

  /** 노이즈 한 조각 — 햇과 스네어가 같이 쓴다 */
  const hit = (at, dur, opt) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = opt.type;
    f.frequency.value = opt.freq;
    f.Q.value = opt.Q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(opt.vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(at, Math.random() * 0.5, dur + 0.02);
  };

  /** 킥 — 사인의 음높이를 떨어뜨린다. 이것 하나로 박자가 생긴다 */
  const kick = (at) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(140, at);
    o.frequency.exponentialRampToValueAtTime(46, at + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.32, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    o.connect(g); g.connect(bus);
    o.start(at); o.stop(at + 0.18);
  };

  /* 한 칸(8분음표)을 미리 예약한다.
     ⚠️ setInterval 이 부르는 그 순간에 소리를 내면 안 된다. 타이머는 수십 ms 씩 흔들리는데
        그 흔들림이 그대로 박자 흔들림이 된다. 오디오 시계(ctx.currentTime) 기준으로
        **앞당겨 예약**하고, 타이머는 예약할 때가 됐는지만 확인한다. */
  const pump = () => {
    if (!ctx) return;
    const spb = 60 / BPM;                       // 8분음표 한 칸의 길이
    while (nextAt < ctx.currentTime + 0.25) {   // 0.25초 앞까지 채워 둔다
      const i = step % LEAD.length;
      const at = nextAt;

      /* ⚠️ 베이스에서 -12 를 뺐다. 레퍼런스는 저역이 12% 뿐인데, 한 옥타브 더 내리면
         베이스만 남고 선율이 묻힌다. 음량도 0.2 → 0.12 로 낮춘다. */
      if (LEAD[i]) synth(LEAD[i], at, spb * 0.9, { vol: 0.13, hi: 6200, lo: 1700, send: 0.5 });
      synth(BASS[i], at, spb * 0.95, { types: ["square"], vol: 0.12, hi: 1100, lo: 260 });

      /* 16분음표 아르페지오 — 한 칸에 두 번. 이 층이 곡을 "빠르게" 만든다 */
      for (let h = 0; h < 2; h++) {
        const n = ARP[(step * 2 + h) % ARP.length];
        synth(n + 12, at + h * spb * 0.5, spb * 0.42, { types: ["square"], vol: 0.055, hi: 7000, lo: 3200, send: 0.35 });
      }

      /* 드럼 — 킥은 박자 머리, 스네어는 뒷박, 햇은 16분음표마다 */
      /* ⚠️ 킥·스네어를 눌러 둔다. 레퍼런스는 저역이 4% 밖에 없는 **선율 중심** 곡이라,
         쿵쿵거리는 드럼을 얹으면 참고한 곡과 전혀 다른 것이 된다. 속도는 템포가 낸다. */
      if (i % 8 === 0 || i % 8 === 4) kick(at);
      if (i % 8 === 4) hit(at, 0.11, { type: "bandpass", freq: 2100, Q: 0.8, vol: 0.17 });
      hit(at, 0.024, { type: "highpass", freq: 8600, vol: i % 2 === 0 ? 0.075 : 0.05 });
      hit(at + spb * 0.5, 0.02, { type: "highpass", freq: 8200, vol: 0.035 });

      step += 1;
      nextAt += spb;
    }
  };

  return {
    /** 시뮬레이션 시작 — 사용자가 버튼을 누른 흐름 안에서 불러야 소리가 난다 */
    start() {
      if (muted || !ensure()) return;
      try {
        ctx.resume();
        step = 0;
        nextAt = ctx.currentTime + 0.05;
        clearInterval(timer);
        timer = setInterval(pump, 60);
        pump();
      } catch { /* 소리는 없어도 그만 */ }
    },

    stop() {
      clearInterval(timer);
      timer = null;
      try { ctx?.suspend(); } catch { /* 이미 닫혔을 수 있다 */ }
    },

    /** 슬롯에 들어간 순간 — 짧게 올라가는 아르페지오 */
    stow() {
      if (muted || !ensure() || !ctx) return;
      try {
        ctx.resume();
        const t = ctx.currentTime + 0.01;
        /* 위로 네 음, 마지막을 길게 — 오르다 멈추면 "됐다"로 들린다 */
        [72, 76, 79, 84].forEach((m, i) => {
          synth(m, t + i * 0.05, i === 3 ? 0.36 : 0.09, { vol: 0.17, hi: 7000, lo: 1500, send: 0.6 });
        });
        synth(91, t + 0.15, 0.32, { types: ["triangle"], vol: 0.08, hi: 8000, lo: 4000, send: 0.5 });
      } catch { /* 소리는 없어도 그만 */ }
    },

    get muted() { return muted; },
    setMuted(v) {
      muted = v;
      if (v) this.stop();
    },

    dispose() {
      clearInterval(timer);
      try { ctx?.close(); } catch { /* 이미 닫혔다 */ }
      ctx = null;
      master = null;
      bus = null;
      delaySend = null;
      noise = null;
    },
  };
}
