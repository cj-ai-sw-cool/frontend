/* ═══════════════════════════════════════════════════════════════════════════
   적재 시뮬레이션 사운드 — 칩튠 배경음과 효과음

   ★ 시뮬레이션이 도는 동안 칩튠이 깔리고, 슬롯에 물건이 들어갈 때마다 짧게 올라가는
     효과음이 난다 (사용자 요청). 화면만으로도 되는 장면이지만, 소리가 붙으면 "돌아가는
     설비"로 읽힌다.

   ⚠️ **남의 곡을 옮겨 적지 않는다.** 요청으로 나온 곡들(슈퍼마리오, 크레이지아케이드)은
      전부 남의 저작물이다. "서비스가 끝났으니 저작권도 없다"는 사실이 아니다 — 음악
      저작권은 서비스 운영과 무관하게 저작자 사후 70년까지 살아 있다. 게다가 이 화면은
      고객사 시연에 쓰인다. 그래서 **성격만 가져와 새로 썼다**: 원하는 것은 그 분위기이지
      그 곡 자체가 아니다.
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
   ★ 한국 캐주얼 아케이드 게임의 배경음 성격으로 맞췄다 (사용자 요청). 그 결을 만드는
     것은 넷이다:
       · **밝은 장조**와 아주 익숙한 진행 — C - Am - F - G. 튀는 화음이 없어야 오래 깔아
         두고 들을 수 있다
       · 통통 튀는 **옥타브 베이스**. 아케이드 배경음의 걸음걸이는 대부분 여기서 나온다
       · **동글동글한 음색** — 톱니파 대신 삼각파를 섞고 필터를 덜 닫는다. 톱니는 날이
         서 있어 귀엽지 않다
       · 빠르지만 **급하지 않은** 템포. 4분음표 160 언저리다

   ★ 선율을 **여덟 마디**로 늘렸다. 네 마디짜리는 30초만 들어도 같은 자리를 도는 것이
     들리는데, 시뮬레이션은 그보다 오래 돈다. 앞 네 마디가 묻고 뒤 네 마디가 답한다.
   ⚠️ 화음·아르페지오·베이스는 **CHORDS 한 곳에서 파생**시킨다. 세 벌을 각각 적어 두면
      코드 하나를 바꿀 때 한 벌만 고쳐져, 베이스만 다른 화음을 짚는 사고가 난다. */

/** 마디마다의 화음 (근음·3음·5음). 여덟 마디가 한 바퀴다 */
const CHORDS = [
  [60, 64, 67],   // C
  [57, 60, 64],   // Am
  [53, 57, 60],   // F
  [55, 59, 62],   // G
  [60, 64, 67],   // C
  [57, 60, 64],   // Am
  [50, 53, 57],   // Dm  ← 뒤 네 마디는 여기서 갈린다. 같은 진행을 두 번 돌면 여덟 마디가
  [55, 59, 62],   // G      아니라 네 마디를 두 번 튼 것이 된다
];

/** 선율 — 8분음표 64칸(여덟 마디). 0 은 쉼표 */
const LEAD = [
  72, 76, 79, 76, 84, 79, 76, 72,   // C
  69, 72, 76, 72, 81, 76, 72, 69,   // Am
  77, 81, 84, 81, 77, 76, 74, 72,   // F
  74, 79, 83, 79, 74, 71, 74, 0,    // G
  72, 76, 79, 76, 84, 79, 76, 72,   // C
  69, 72, 76, 81, 84, 81, 76, 72,   // Am
  74, 77, 81, 77, 84, 81, 77, 74,   // Dm
  83, 79, 74, 79, 83, 84, 79, 0,    // G
];

/** 아르페지오가 화음을 짚는 순서 (근음-3음-5음-3음). 16분음표로 굴린다 */
const ARP_SHAPE = [0, 1, 2, 1];

/** 베이스가 한 마디를 걷는 모양 — 근음에서 옥타브와 5도로 튄다 (반음 단위) */
const BASS_SHAPE = [0, 0, 12, 0, 7, 0, 12, 7];

/** 분당 박자. 8분음표 기준이라 4분음표로는 이 절반(160)이다 */
const BPM = 320;

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
      fb.gain.value = 0.26;
      const wet = ctx.createGain();
      wet.gain.value = 0.2;
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
   * 신스 음 하나. 살짝 어긋나게 맞춘 오실레이터들을 로우패스에 통과시킨다.
   * ⚠️ 게인을 **0 으로 떨어뜨리지 않고 아주 작은 값까지** 줄인다.
   *    exponentialRampToValueAtTime 은 0 을 못 받는다 — 0 을 주면 소리가 안 난다.
   * ⚠️ 필터를 **닫으면서** 끝낸다. 열어 둔 채 볼륨만 줄이면 끝까지 쨍한 채로 작아져서
   *    딱 그 "저급 전자음"이 된다.
   */
  const synth = (midi, at, dur, opt = {}) => {
    const { types = ["square", "triangle"], vol = 0.12, hi = 4200, lo = 700, send = 0, det = 5 } = opt;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.Q.value = 5;
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
      o.detune.value = i === 0 ? -det : det;   // 살짝 어긋나야 두께가 생긴다
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

  /**
   * 자동재생이 막혔을 때, **다음 사용자 동작 한 번**으로 소리를 살린다.
   *
   * 입고 화면에서 넘어와 시뮬레이션이 자동으로 시작하는 경우가 그렇다 — 그 시작은 사용자가
   * 누른 흐름 안이 아니라서 브라우저가 AudioContext 를 조용히 막아 둔다. 막힌 줄 모르고
   * 계속 예약만 하면 영영 소리가 안 난다.
   * ⚠️ 두 리스너를 서로 지운다. `once` 만 걸면 클릭으로 살아난 뒤에도 keydown 이 남는다.
   */
  const armResume = () => {
    const go = () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
      try { ctx?.resume(); } catch { /* 이미 닫혔을 수 있다 */ }
    };
    window.addEventListener("pointerdown", go);
    window.addEventListener("keydown", go);
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
    o.frequency.setValueAtTime(150, at);
    o.frequency.exponentialRampToValueAtTime(48, at + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.34, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.15);
    o.connect(g); g.connect(bus);
    o.start(at); o.stop(at + 0.17);
  };

  /* 한 칸(8분음표)을 미리 예약한다.
     ⚠️ setInterval 이 부르는 그 순간에 소리를 내면 안 된다. 타이머는 수십 ms 씩 흔들리는데
        그 흔들림이 그대로 박자 흔들림이 된다. 오디오 시계(ctx.currentTime) 기준으로
        **앞당겨 예약**하고, 타이머는 예약할 때가 됐는지만 확인한다. */
  const pump = () => {
    if (!ctx) return;
    const spb = 60 / BPM;                       // 8분음표 한 칸의 길이
    while (nextAt < ctx.currentTime + 0.25) {   // 0.25초 앞까지 채워 둔다
      const i = step % LEAD.length;                     // 선율 안에서의 자리 (0~63)
      const beat = i % 8;                               // 마디 안에서의 자리 (0~7)
      const chord = CHORDS[(i >> 3) % CHORDS.length];   // 여덟 칸마다 한 마디
      const at = nextAt;

      /* 선율 — 스타카토로 짧게 끊는다. 길게 늘이면 통통 튀는 맛이 사라진다 */
      if (LEAD[i]) {
        synth(LEAD[i], at, spb * 0.82, { vol: 0.13, hi: 6800, lo: 2200, send: 0.45 });
        /* 뒤 네 마디에만 한 옥타브 아래를 얇게 겹친다 — 선율이 두 번째로 돌 때 조금
           두꺼워지면 "반복"이 아니라 "전개"로 들린다.
           ⚠️ 3도 화음이 아니라 **옥타브**다. 3도는 화음마다 온음/반음이 달라져서, 한
              칸으로 밀면 어떤 마디에서는 어긋난 음이 된다. 옥타브는 언제나 맞는다. */
        if (i >= 32) synth(LEAD[i] - 12, at, spb * 0.8, { types: ["triangle"], vol: 0.05, hi: 3000, lo: 1200 });
      }

      /* 베이스 — 근음에서 옥타브·5도로 튀는 걸음. 이 곡의 걸음걸이다 */
      synth(chord[0] - 12 + BASS_SHAPE[beat], at, spb * 0.72, {
        types: ["square"], vol: 0.13, hi: 1300, lo: 300, det: 0,
      });

      /* 16분음표 아르페지오 — 한 칸에 두 번. 화음을 계속 굴려 속도를 만든다 */
      for (let h = 0; h < 2; h++) {
        const n = chord[ARP_SHAPE[(step * 2 + h) % ARP_SHAPE.length]];
        synth(n + 12, at + h * spb * 0.5, spb * 0.4, {
          types: ["square"], vol: 0.05, hi: 6500, lo: 3000, send: 0.3, det: 0,
        });
      }

      /* 드럼 — 킥은 1·3박, 스네어는 2·4박, 햇은 16분음표마다.
         ⚠️ 가볍게 둔다. 이 곡의 주인공은 선율이라, 쿵쿵거리는 드럼을 얹으면 아케이드
            배경음이 아니라 클럽 음악이 된다. */
      if (beat === 0 || beat === 4) kick(at);
      if (beat === 2 || beat === 6) hit(at, 0.1, { type: "bandpass", freq: 2200, Q: 0.9, vol: 0.16 });
      hit(at, 0.022, { type: "highpass", freq: 8800, vol: beat % 2 === 0 ? 0.07 : 0.045 });
      hit(at + spb * 0.5, 0.018, { type: "highpass", freq: 8800, vol: 0.034 });

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
        /* 자동 시작이면 여기서 막힌다 — 다음 동작 한 번에 살리도록 걸어 둔다 (위 주석) */
        if (ctx.state !== "running") armResume();
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

    /** 슬롯에 들어간 순간 — 짧게 올라가는 아르페지오 (사용자 확인: 이 소리는 그대로 둔다) */
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
