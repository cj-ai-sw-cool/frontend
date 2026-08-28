/* ═══════════════════════════════════════════════════════════════════════════
   입고 적재 시뮬레이션
   `createInboundSim(THREE, deps)` 하나만 내보낸다 (등급 판정 함수는 따로).

   무엇을 보여 주나
     포탈에서 로봇이 **입고 물품 세 개를 한 번에 싣고** 나온다 → 치수로 등급이 정해진다 →
     로봇이 등급 구역을 차례로 돌며 **한 개씩** 크레인에 넘긴다 → 크레인이 슬롯에 넣는다 →
     다 비우면 로봇이 포탈로 돌아간다.

   ★ 이 흐름의 **등급 판정은 진짜다.** 세 변의 합으로 A~F 를 가르는 규칙(README 의 슬롯
     규격)을 그대로 계산하고, 그 결과가 로봇이 가는 순서를 정한다. 시연에서 "왜 저기로
     가느냐"에 답할 수 있어야 이 장면이 값을 갖는다.

   ⚠️ **`applyDay` 가 덮어쓰지 못하게 슬롯을 예약해 둔다.** 날짜 슬라이더를 움직이면
      `applyDay` 가 구역의 모든 인스턴스 행렬을 다시 쓰는데, 그러면 방금 넣은 상자가
      그 자리에서 사라진다. 예약한 칸은 그 루프가 건너뛴다 — 창고 쪽 `applyDay` 의
      `skip?.includes(i)` 가 그것이다. 한쪽만 고치면 다시 지워진다.
   ⚠️ 예약 칸은 **점유 순위가 가장 늦은 칸**으로 고른다. 그런 칸은 사용률이 최고인 날에도
      비어 있어서, 예약 때문에 원래 있던 재고가 사라지는 일이 없다.
   ⚠️ 브라우저 스토리지를 쓰지 않는다 (창고 컴포넌트의 원래 제약을 그대로 지킨다).
   ═══════════════════════════════════════════════════════════════════════════ */

/** 세 변의 합(cm) 상한 → 등급. README 의 슬롯 규격에서 온 값이다 */
const GRADE_CAPS = [
  { id: "xs", code: "A", name: "극소형", cap: 80 },
  { id: "s", code: "B", name: "소형", cap: 100 },
  { id: "m", code: "C", name: "중형", cap: 120 },
  { id: "l", code: "D", name: "대형", cap: 140 },
  { id: "xl", code: "E", name: "특수", cap: 180 },
  { id: "cold", code: "F", name: "특대형", cap: Infinity },
];

/**
 * 치수(mm)로 등급을 정한다.
 * ⚠️ 세 변의 **합**으로 가른다. 부피가 아니다 — 물류 등급은 상자를 쌓고 옮기는 규격이라,
 *    길쭉한 물건과 뭉툭한 물건이 같은 부피여도 다른 칸에 들어간다.
 */
export function gradeForMm(lengthMm, widthMm, heightMm) {
  const sumCm = (lengthMm + widthMm + heightMm) / 10;
  return GRADE_CAPS.find((g) => sumCm <= g.cap) ?? GRADE_CAPS[GRADE_CAPS.length - 1];
}

/* 시연용 상품 셋 — 등급이 **A(극소형) → E(특수) → C(중형)** 순으로 갈리게 골랐다
   (사용자 지정).
   ★ 이 순서가 시연에서 잘 읽힌다: 작은 것 → 가장 큰 것 → 중간. 등급이 오르내려야 "치수가
     자리를 정한다"가 보인다. 셋 다 같은 방향으로 커지면 그냥 줄 세운 것으로 보인다.
   ★ 세 등급 모두 크레인이 있는 구역이다. 크레인이 없는 구역(D·F)으로 가는 물건은 넘어가서
     화면에 아무 일도 일어나지 않는다 — 시연용 목록은 그 셋 안에서 고른다.
   ⚠️ 치수는 실제 포장 규격이다. 지어낸 숫자를 쓰면 "세 변 합이 141cm 라 특수" 라는 설명이
      성립하지 않는다. 아래 주석의 합이 곧 등급의 근거다. */
export const DEMO_ITEMS = [
  // 41.2 + 27.5 + 5.8 = 74.5cm  ≤ 80  → A 극소형
  { sku: "CJ-8801007-0426", name: "햇반 210g × 6입", l: 412, w: 275, h: 58 },
  // 59.0 + 39.5 + 43.0 = 141.5cm  ≤ 180  → E 특수
  { sku: "CJ-8801007-9931", name: "비비고 왕교자 8입 케이스", l: 590, w: 395, h: 430 },
  // 48.0 + 36.0 + 21.0 = 105.0cm  ≤ 120  → C 중형
  { sku: "CJ-8801045-1220", name: "사골곰탕 500g × 12 케이스", l: 480, w: 360, h: 210 },
];

/** 값을 목표까지 속도 제한을 지키며 옮긴다 */
const moveTo = (v, target, speed, dt) =>
  v + Math.max(-speed * dt, Math.min(speed * dt, target - v));

/** 각도 차이를 -π~π 로 접는다 — 359° 와 1° 가 358° 떨어진 것으로 계산되지 않게 */
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * @param {object} THREE
 * @param {{
 *   scene: object, gradeMeshes: object, cranes: object[],
 *   portalPos: number[], zeroMatrix: object,
 *   clearCorridor: (busy: boolean) => void,
 *   makeAGV: () => { grp: object }, onStatus: (line: string | null) => void,
 * }} deps
 */
export function createInboundSim(THREE, deps) {
  const { scene, gradeMeshes, cranes, portalPos, zeroMatrix, makeAGV, onStatus,
          clearCorridor } = deps;

  /* ── 예약 슬롯 ────────────────────────────────────────────────────────
     구역마다 크레인 통로 쪽 랙에서 **점유 순위가 가장 늦은 칸**을 몇 개 빼 둔다. */
  const reserved = new Map(); // gradeId → number[] (인스턴스 번호)
  const slotInfo = new Map(); // 인스턴스 번호 → { z, y, dir, col, level }
  const RESERVE_PER_ZONE = 3;

  for (const c of cranes) {
    const gm = gradeMeshes[c.id];
    const g = c.g;
    const per = g.levels * g.cols;
    const candidates = [];
    for (const rackIdx of [c.iA, c.iB]) {
      for (let k = 0; k < g.levels; k += 1) {
        for (let j = 1; j < g.cols - 1; j += 1) {
          const i = rackIdx * per + k * g.cols + j;
          candidates.push({ i, rank: gm.rank[i], rackIdx, k, j });
        }
      }
    }
    candidates.sort((a, b) => b.rank - a.rank);
    const taken = candidates.slice(0, RESERVE_PER_ZONE);
    reserved.set(c.id, taken.map((s) => s.i));
    for (const s of taken) {
      slotInfo.set(s.i, {
        z: c.zone.zStart + (s.j + 0.5) * g.w,
        y: s.k * c.pitch + 0.04,
        dir: s.rackIdx === c.iA ? -1 : 1,
        col: s.j + 1,
        level: s.k + 1,
      });
      gm.im.setMatrixAt(s.i, zeroMatrix); // 처음에는 비워 둔다
    }
    gm.im.instanceMatrix.needsUpdate = true;
  }

  /* ── 배송 로봇 ────────────────────────────────────────────────────────
     기존 순환 AGV 두 대는 건드리지 않는다. 그들의 경로에 끼어들면 시뮬레이션이 끝난 뒤에도
     제자리로 못 돌아가고, 2D 지도에 보이는 위치까지 어긋난다. */
  const bot = makeAGV();
  /* 포탈 바로 앞이 출발점이자 도착점이다.
     ⚠️ 포탈은 +x(창고 안쪽)를 보고 서 있으므로 조금 안쪽으로 잡는다. 포탈 자리에 딱
        맞추면 로봇이 흑요석 틀 안에 박힌 채로 나타난다. */
  const HOME = [portalPos[0] + 1.2, 0, portalPos[2]];

  bot.grp.position.set(...HOME);
  bot.grp.rotation.y = Math.PI / 2;
  /* 처음부터 보인다 — 시뮬레이션을 안 돌려도 포탈 앞에 서 있는 로봇이 "여기서 시작한다"를
     말한다. 눌러야 나타나면 그 전까지는 아무 단서가 없다 */
  /* 배송 로봇도 그림자를 드리운다 — 시뮬레이션에서 가장 오래 보는 것이라 여기서
     빠지면 로봇만 떠서 간다 */
  bot.grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(bot.grp);

  /* ── 로봇이 싣고 나오는 짐 ────────────────────────────────────────────
     ★ 세 개를 **한 번에** 싣고 나온다 (사용자 요청). 한 건씩 왕복하면 같은 길을 세 번
       보게 되는데, 시연에서 그 반복은 지루하다. 쌓아서 나오면 "이만큼 들어왔다"가 한눈에
       보이고, 하나씩 줄어드는 것으로 진행도 읽힌다.
     ⚠️ 상자마다 크기가 다르므로 **아래부터 쌓아 올린 높이**를 따로 계산한다. 같은 간격으로
        띄우면 큰 상자가 작은 상자를 파고든다. */
  const cargoMat = new THREE.MeshLambertMaterial({ color: 0xc59a63 });
  const cargoGeo = new THREE.BoxGeometry(1, 1, 1);
  const cargoes = DEMO_ITEMS.map(() => {
    const m = new THREE.Mesh(cargoGeo, cargoMat);
    m.castShadow = true;   // 실려 가는 짐도 (위 로봇과 같은 이유)
    m.visible = false;
    scene.add(m);
    return m;
  });
  const DECK_Y = 0.78; // AGV 상판 높이

  /* ── 속도 ──
     ★ 한 번 크게 올렸다가 **다시 낮췄다** (사용자 지적 — 화면이 정신없다). 빠른 것이
       답이 아니었다. 실제로 어지러웠던 것은 속도보다 **카메라가 매 순간 방향을 바꾸는 것**
       이었고(아래 `state.az` 주석), 그쪽을 고정하고 나니 이 정도 속도가 오히려 또렷하다.
     ⚠️ 그래도 실제 창고 속도(1~1.5m/s)보다는 서너 배 빠르다. 30m 를 실제 속도로 가면
        20초가 넘고, 그동안 화면이 아무 말도 하지 않는다. */
  const BOT_SPEED = 4.4;
  const CRANE_TRAVEL = 4.4;
  const CRANE_HOIST = 2.6;
  const CRANE_FORK = 3.2;
  const GRAB_TIME = 0.22;

  /* ── 카메라가 볼 것 ──
     `focus` 는 볼 지점, `cam` 은 그 지점을 **어느 방향에서 얼마나 떨어져** 볼지다.
     ★ 값만 정하고 옮기는 일은 창고 쪽이 한다. 장면이 바뀌면 값이 바뀌고, 그 사이는 감쇠가
       이어 준다 — 컷이 아니라 카메라가 걸어서 옮겨 가는 그림이 된다. */
  const focus = new THREE.Vector3(...HOME);
  /* 각도·거리를 **여기서** 정한다. 지금 무엇을 하는 중인지 아는 쪽은 시뮬레이션이고,
     카메라 코드가 단계 이름을 알 필요는 없다.
     ⚠️ `pol` 은 위에서 잰 각이다. 작을수록 위에서 내려다본다. */
  /* `minY` 는 카메라가 내려갈 수 있는 **바닥 높이**다.
     ★ 각을 낮추면(=`pol` 을 키우면) 훨씬 현장 같아 보이지만, 낮아진 카메라가 랙을 뚫는다.
       통로 안(중앙 작업 통로)은 비어 있어 낮아도 되고, 구역 통로 옆은 양쪽이 랙이라 안 된다.
       그래서 장면마다 최소 높이를 따로 준다. */
  const state = { az: 0, pol: 0.62, dist: 15, minY: 8 };
  /* 이동 구간에서 쓸 각도. **일감이 정해질 때 한 번 잡고 그대로 둔다.**
     ★ 예전에는 매 프레임 진행 방향에서 다시 구했다. 로봇이 조금만 방향을 틀어도 카메라가
       따라 돌았고, 그 끊임없는 회전이 화면을 정신없게 만든 진짜 원인이었다. 통로를 따라
       곧게 가는 구간에서는 각도가 바뀔 이유가 없다. */
  let travelAz = -Math.PI / 2;
  /* 도입부에서 붙들고 있을 각. 시작할 때 **지금 사용자가 보고 있던 각**을 받아 둔다 —
     여기서 임의의 각을 잡으면 버튼을 누르는 순간 화면이 홱 돌고, 그 다음에야 밀고
     들어간다. 보던 자리에서 그대로 이어져야 "들어간다"로 읽힌다. */
  let introAz = -Math.PI / 2;
  /* 도입부 길이 — 멀리서 붙들기 / 밀고 들어가기 (초).
     ⚠️ `PUSH` 는 창고 쪽 카메라 감쇠(k ≈ 1.0, 90% 에 2.3초)보다 짧게 잡는다. 다 붙은
        뒤에 출발시키면 멈춰 선 화면을 한참 보게 된다 — 아직 밀고 들어가는 중에
        로봇이 떠나야 그 둘이 한 동작으로 이어진다. */
  const INTRO_HOLD = 1.3, INTRO_PUSH = 1.2;

  /* 마지막에 카메라가 향할 곳 — 출고 구역이다. 창고 쪽에서 좌표를 받는다 */
  const outroAt = deps.outboundAt ? new THREE.Vector3(...deps.outboundAt) : null;

  let jobs = [];
  let jobIndex = -1;
  let phase = "idle";
  let timer = 0;
  let legs = [];
  const filled = new Set();

  const job = () => jobs[jobIndex] ?? null;

  /** 남은 짐을 로봇 위에 다시 쌓는다 — 하나 내려놓을 때마다 부른다.
      ★ **나중에 내릴 것을 아래에, 지금 내릴 것을 맨 위에** 쌓는다. 순서대로 쌓으면 첫
        상자가 바닥에 깔려서, 그것을 꺼내는 장면이 밑에서 뽑아내는 모양이 된다.
      ⚠️ `done` 인 것만 감춘다. 예전에는 `i <= jobIndex` 도 감췄는데, 그러면 **지금 싣고
         가는 상자가 출발하자마자 사라졌다** — 카메라가 따라갈 대상이 없어지는 원인이었다. */
  const restack = () => {
    const left = [];
    for (let i = jobs.length - 1; i >= 0; i -= 1) {
      if (!jobs[i].done) left.push(i);   // 뒤 순번이 먼저 담긴다 = 아래에 깔린다
    }
    let y = DECK_Y;
    for (let i = 0; i < jobs.length; i += 1) cargoes[i].visible = false;
    for (const i of left) {
      const h = jobs[i].item.h / 1000;
      const c = cargoes[i];
      c.visible = true;
      c.position.set(bot.grp.position.x, y + h / 2, bot.grp.position.z);
      c.rotation.y = bot.grp.rotation.y;
      y += h + 0.012;
    }
  };

  const setStatus = () => {
    const j = job();
    if (j === null) {
      onStatus(null);
      return;
    }
    const where = j.slot ? ` → ${j.grade.code}구역 ${j.slot.col}열 ${j.slot.level}단` : " → 갈 곳 없음";
    onStatus(
      `${jobIndex + 1}/${jobs.length}  ${j.item.name}  ${j.item.l}×${j.item.w}×${j.item.h}mm` +
      `  세 변 합 ${((j.item.l + j.item.w + j.item.h) / 10).toFixed(1)}cm${where}`,
    );
  };

  /** 로봇이 갈 길 — **중앙 작업 통로(z = 0)를 따라 앞으로만** 간다.
   *
   *  ★ 예전에는 옆 통로로 돌아 랙 사이까지 파고들었다. 그 길은 랙을 관통했고, 배달마다
   *    들어갔다 되짚어 나오느라 화면이 정신없었다. 지금은 **한 줄로 곧게** 간다:
   *    포탈(통로 서쪽 끝) → A 앞 → E 앞 → C 앞. 여섯 구역이 전부 이 통로에 면해 있고,
   *    P&D 도 통로 입구에 있으므로 통로만 타면 어디든 닿는다.
   *  ⚠️ 그래서 일감을 **craneX 오름차순으로 정렬**한다. 그래야 되돌아가는 구간이 없다.
   *     지금 시연 셋(A -9.28 → E -0.52 → C 9.08)은 이미 그 순서다.
   *  ⚠️ 멈추는 자리는 P&D 의 x 다. z 는 통로 한가운데(0)에 그대로 둔다 — 통로에 선 채로
   *     넘겨준다. 통로 입구까지 1m 남짓이라 화면에서는 옆에 대 준 것으로 보인다. */
  const routeTo = (crane) => [[crane.craneX + crane.dropOff, 0]];

  const startNext = () => {
    jobIndex += 1;
    const j = job();
    if (j === null) {
      /* ★ 다 비웠다 — 로봇을 돌려보내는 대신 **카메라를 출고 쪽으로 돌리고 멈춘다**
         (사용자 요청). 시연에서 여기가 이어지는 자리다: 적재가 끝나면 출고 포스기를
         보여 주고, 발표자가 Enter 를 눌러 그 화면으로 들어간다.
         ⚠️ 로봇은 마지막 구역 앞에 그대로 세워 둔다. 되돌아가는 20초는 볼 것이 없는데,
            그 사이에 카메라만 출고를 비추면 화면 구석에서 로봇이 혼자 달리는 그림이 된다. */
      phase = "outro";
      timer = 2.6;
      legs = [];
      onStatus("적재 완료 — Enter 를 눌러 창고 화면으로");
      return;
    }
    if (j.crane === null || j.target === null) {
      /* ⚠️ 크레인이 없는 등급(C·D·F)이거나 예약 칸이 다 찼으면 그 건은 넘긴다. 갈 곳이
         없는데 로봇을 보내면 화면 밖으로 나가거나 제자리에서 멈춘다. */
      j.done = true;
      setStatus();
      timer = 0.5;
      phase = "skip";
      return;
    }
    legs = routeTo(j.crane);
    /* 목표 구역의 **반대편**에서 본다 — 같은 쪽에 서면 그 구역의 랙이 시야를 막는다.
       로봇은 통로를 +x 로만 가므로 뒤쪽은 늘 -x 다(각으로는 -π/2). */
    travelAz = -Math.PI / 2 + (j.crane.zone.row === 0 ? 0.5 : -0.5);
    phase = "deliver";
    setStatus();
  };

  return {
    /** `applyDay` 가 건너뛸 인스턴스 번호 (구역별) */
    reserved,
    /** 카메라가 볼 지점 (읽기 전용) */
    focus,
    /** 통로를 지나는 배송 로봇의 x. 작업자가 이걸 보고 마주치기 전에 돌아선다 */
    get botX() {
      return bot.grp.position.x;
    },
    /** 카메라가 뒤따라갈 때의 진행 방향과 그 여부 */
    cam: state,
    get running() {
      return phase !== "idle";
    },

    /** 시뮬레이션을 지금 끝내고 카메라와 통로를 창고 쪽에 돌려준다.
     *
     *  ★ 적재가 끝나면 `outro` 가 그 자리에서 멈추는데, 그때도 `running` 은 참이다 —
     *    카메라를 계속 붙들고 있어야 화면이 출고 쪽을 비춘 채 서 있기 때문이다. 그래서
     *    빠져나오려면 **누군가 끝났다고 말해 주어야** 한다 (창고 화면의 Enter).
     *  ⚠️ 로봇은 **그 자리에 둔다.** 집으로 돌려보내면 화면이 창고로 물러나는 바로 그
     *     순간에 로봇만 통로를 가로질러 날아가는 그림이 된다. 다음 `start()` 가 어차피
     *     포탈 앞에 다시 세운다. */
    finish() {
      if (phase === "idle") return;
      phase = "idle";
      legs = [];
      state.chase = false;
      clearCorridor(false);   // 통로를 돌려준다 (위 `clearCorridor` 주의 참고)
      for (const cg of cargoes) cg.visible = false;
      onStatus(null);
    },

    /** @param fromAz 지금 궤도 카메라가 서 있는 각 (도입부가 이어받는다) */
    start(items = DEMO_ITEMS, fromAz = null) {
      filled.clear();
      // 다시 돌리면 지난번에 넣은 것부터 치운다 — 예약 칸이 세 개뿐이라 금방 찬다
      for (const c of cranes) {
        const gm = gradeMeshes[c.id];
        for (const i of reserved.get(c.id) ?? []) gm.im.setMatrixAt(i, zeroMatrix);
        gm.im.instanceMatrix.needsUpdate = true;
      }

      const built = items.slice(0, cargoes.length).map((item) => {
        const grade = gradeForMm(item.l, item.w, item.h);
        const crane = cranes.find((c) => c.id === grade.id) ?? null;
        const free = crane ? (reserved.get(crane.id) ?? []).filter((i) => !filled.has(i)) : [];
        const target = free[0] ?? null;
        if (target !== null) filled.add(target); // 미리 잡아 둔다 — 두 건이 같은 칸을 노리지 않게
        return { item, grade, crane, target, slot: target === null ? null : slotInfo.get(target), done: false };
      });
      filled.clear(); // 위 예약은 자리 잡기용이었다. 실제로 채운 것만 다시 담는다

      /* 통로를 따라 **앞으로만** 가도록 서쪽부터 차례로 (위 `routeTo` 주의 참고).
         ⚠️ 갈 곳 없는 건(크레인 없는 등급)은 뒤로 몬다. 가운데 끼워 두면 그 자리에서
            0.5초 멈췄다 가는 빈 박자가 생긴다 */
      built.sort((a, b) => {
        if ((a.crane === null) !== (b.crane === null)) return a.crane === null ? 1 : -1;
        return (a.crane?.craneX ?? 0) - (b.crane?.craneX ?? 0);
      });
      jobs = built;

      for (let i = 0; i < cargoes.length; i += 1) {
        const it = jobs[i]?.item;
        if (it === undefined) { cargoes[i].visible = false; continue; }
        cargoes[i].scale.set(it.l / 1000, it.h / 1000, it.w / 1000);
      }

      bot.grp.position.set(...HOME);
      bot.grp.rotation.y = Math.PI / 2;   // 창고 안쪽(+x)을 보고 선다
      bot.grp.visible = true;
      jobIndex = -1;
      restack();
      /* ★ 통로를 **비운다.** 작업자(피글린)와 순환 AGV 가 같은 중앙 통로를 쓰고 있어서,
         배송 로봇이 지나갈 때 서로를 뚫고 지나갔다. 시뮬레이션이 도는 동안만 그들을
         통로 밖으로 물려 두면 그 겹침이 없어진다 — 실제 현장에서도 자동 반송이 지나갈 때는
         사람이 비켜선다.
         ⚠️ 멈추는 것이 아니라 **비켜서는** 것이다. 멈춰 세우면 창고가 죽은 것처럼 보이고,
            2D 지도에서도 점들이 얼어붙는다. */
      clearCorridor(true);

      /* ★ 포탈로 들어갔다 나오는 연출은 **뺐다** (사용자 지적). 로봇은 늘 포탈 앞에 서
         있다가 짐을 싣고 바로 출발한다 — 나타났다 사라지는 것이 오히려 "어디서 왔지"를
         만들었다.
         ★ 대신 **카메라로** 도입부를 만든다 (사용자 요청): 트럭까지 보이는 먼 자리에서
           입고 문을 잡고, 거기서 밀고 들어가며 로봇이 출발한다. 로봇을 움직여 만드는
           도입부가 아니라 **시선을 옮겨** 만드는 도입부라, 장면에 군더더기가 안 붙는다. */
      introAz = fromAz ?? travelAz;
      phase = "intro";
      timer = INTRO_HOLD + INTRO_PUSH;
      onStatus("입고 문 — 상품 3건 도착");
    },

    update(dt) {
      if (phase === "idle") return;

      if (phase === "intro") {
        /* 도입부 — 멀리서 입고 문을 잡았다가 밀고 들어간다.
           ⚠️ 시선은 처음부터 **입고 문**에 둔다. 멀리 있을 때 창고 한가운데를 보다가
              옮기면, 밀고 들어가는 동작에 옆으로 미끄러지는 동작이 겹쳐 어지럽다.
              시선을 먼저 문에 앉히고 거리만 좁히는 편이 훨씬 또렷하다.
           ⚠️ 거리·각만 바꾸고 **끝나는 자리를 이동 구간과 똑같이** 맞춘다(15 / 0.62).
              도입부 전용 값을 따로 두면 출발하는 순간 카메라가 한 번 더 튄다. */
        focus.set(HOME[0], DECK_Y + 0.4, HOME[2]);
        timer -= dt;
        const pushing = timer <= INTRO_PUSH;
        state.az = pushing ? travelAz : introAz;
        state.pol = pushing ? 0.62 : 0.95;   // 멀리서는 눈높이에 가깝게 내려다본다
        state.dist = pushing ? 15 : 30;      // 30 ≈ 전체 보기 — 트럭과 야적장이 다 들어온다
        state.minY = pushing ? 8 : 12;
        if (timer <= 0) startNext();
        return;
      }

      const j = job();
      const c = j?.crane ?? null;
      const driving = phase === "deliver" || phase === "exit";

      /* ── 카메라 ─────────────────────────────────────────────────────
         ★ **높이 떠서 따라가다, 적재할 때만 천천히 내려앉는다** (사용자 요청).
             이동 중 — 위에서 넓게. 어디로 가는지와 창고 전체가 같이 보인다
             적재 중 — 천천히 내려와 랙 정면을 비스듬히. 어느 칸에 들어가는지가 요점이다
             다음 물품 — 다시 천천히 올라가 넓은 그림으로 돌아간다
           오르내리는 동작 자체는 **값만 바꾸면** 창고 쪽 감쇠가 만들어 준다. 여기서는 각
           장면의 목표 자세만 적는다.
         ★ 화면이 어지러웠던 진짜 원인은 속도가 아니라 **카메라가 매 순간 방향을 바꾸는 것**
           이었다. 이동 중 각도(`travelAz`)는 일감마다 한 번만 정하고 그대로 둔다 — 로봇이
           통로를 곧게 가는 동안 카메라가 돌아야 할 이유가 없다.
         ⚠️ 어느 장면이든 카메라는 **랙보다 높거나 통로 밖**에 선다. 통로 폭이 1.7m 라
            그 안에 눈높이로 세우면 반드시 선반을 뚫는다. */
      if (driving) {
        /* 지금 배달 중인 그 상자를 본다 — 로봇 가운데가 아니다.
           ⚠️ 상자가 없을 때(복귀 중)는 로봇을 본다. 없는 것을 따라가면 카메라가 원점으로
              끌려간다. */
        const box = cargoes[jobIndex];
        if (box !== undefined && box.visible) focus.copy(box.position);
        else focus.set(bot.grp.position.x, DECK_Y + 0.3, bot.grp.position.z);

        state.az = travelAz;   // 일감마다 한 번 정해 둔 값 (위 주석 참고)
        state.pol = 0.62;      // 작을수록 위에서 본다 — 넓게 내려다보는 자세
        state.dist = 15;
        state.minY = 8;
      } else if (c !== null) {
        c.carried.getWorldPosition(focus);
        if (!c.carried.visible) focus.setY(focus.y + 0.2);

        const atPD = phase === "handoff" || phase === "toPD" || phase === "pdExtend"
          || phase === "pdGrab" || phase === "pdRetract";
        if (atPD) {
          /* 내려앉기 시작 — 아직은 통로 밖에서 로봇과 포크를 같이 담는다 */
          state.az = travelAz;
          state.pol = 0.86;
          state.dist = 9.5;
          state.minY = 5.5;
        } else {
          /* 랙 정면 — 포크가 뻗는 **반대편**에 선다. 같은 쪽에 서면 크레인 몸통이 슬롯을
             가려서 정작 상자가 들어가는 것이 안 보인다.
             ⚠️ z 쪽으로 조금 비껴 선다(0.55). 정면으로 딱 마주 보면 랙이 평면으로 보여
                깊이가 사라진다 — 비스듬해야 "안으로 들어간다"가 읽힌다.
             ⚠️ 여기가 가장 낮게 내려오는 자리다. 그래도 랙 꼭대기(3.3m)보다는 위에 둔다. */
          const dir = j?.slot?.dir ?? 1;
          state.az = Math.atan2(-dir, 0.55);
          const near = phase === "storeExtend" || phase === "release";
          state.pol = near ? 1.02 : 0.94;
          state.dist = near ? 5.6 : 7.0;
          state.minY = 4.2;
        }
      }

      if (phase === "outro") {
        /* 출고 구역을 비추며 천천히 물러난다. 다 물러나면 그 자리에서 멈춘다 —
           `running` 은 참으로 남겨 두어 카메라를 계속 붙들고 있는다. */
        if (outroAt !== null) focus.copy(outroAt);
        state.az = Math.atan2(-1, 0.55);   // 출고 구역 바깥(통로 쪽)에서 본다
        state.pol = 0.98;
        state.dist = 16;
        state.minY = 6;
        if (timer > 0) timer -= dt;
        return;
      }

      if (phase === "skip") {
        timer -= dt;
        if (timer <= 0) startNext();
        return;
      }

      if (driving) {
        const [tx, tz] = legs[0];
        const p = bot.grp.position;
        const dx = tx - p.x;
        const dz = tz - p.z;
        /* 진행 방향을 본다. 옆으로 미끄러지듯 가면 바퀴 달린 것으로 안 보인다.
           ⚠️ 목표에 거의 닿았을 때는 방향을 갱신하지 않는다 — 남은 거리가 0 에 가까우면
              `atan2` 가 잡음에 흔들려 로봇이 제자리에서 팽이처럼 돈다. */
        if (Math.hypot(dx, dz) > 0.06) {
          const want = Math.atan2(dx, dz);
          const delta = wrapAngle(want - bot.grp.rotation.y);
          bot.grp.rotation.y += delta * Math.min(1, dt * 7);
        }
        p.x = moveTo(p.x, tx, BOT_SPEED, dt);
        p.z = moveTo(p.z, tz, BOT_SPEED, dt);
        restack();

        if (Math.abs(p.x - tx) < 0.03 && Math.abs(p.z - tz) < 0.03) {
          legs.shift();
          if (legs.length === 0) {
            if (phase === "exit") {
              phase = "idle";
              clearCorridor(false);   // 통로를 돌려준다 (위 `clearCorridor` 주의 참고)
              /* 로봇은 **그대로 서 있는다.** 감추면 다음에 돌릴 때 허공에서 나타나는데,
                 포탈 앞에 세워 두면 "저기서 출발하는구나"가 한눈에 보인다 */
              bot.grp.rotation.y = Math.PI / 2;
              for (const cg of cargoes) cg.visible = false;
              state.chase = false;
              onStatus(null);
              return;
            }
            phase = "handoff";
            timer = GRAB_TIME;
          }
        }
        return;
      }

      if (phase === "handoff") {
        timer -= dt;
        if (timer > 0) return;
        cargoes[jobIndex].visible = false;
        j.done = true;
        restack();
        c.depBox.visible = true;      // P&D 위에 놓였다
        /* ⚠️ 크레인의 평소 반출 사이클을 **멈춰 세운다.** 안 그러면 크레인이 슬롯을 향해
           가던 중에 이 주문이 끼어들어 두 동작이 서로 좌표를 덮어쓴다. */
        c.st.phase = "sim";
        c.fork.position.x = 0;
        phase = "toPD";
        return;
      }

      if (phase === "toPD") {
        c.crane.position.z = moveTo(c.crane.position.z, c.dropZ, CRANE_TRAVEL, dt);
        c.carriage.position.y = moveTo(c.carriage.position.y, 0.34, CRANE_HOIST, dt);
        if (Math.abs(c.crane.position.z - c.dropZ) < 0.02 && Math.abs(c.carriage.position.y - 0.34) < 0.02) {
          phase = "pdExtend";
        }
        return;
      }

      if (phase === "pdExtend") {
        c.fork.position.x = moveTo(c.fork.position.x, c.dropOff, CRANE_FORK, dt);
        if (Math.abs(c.fork.position.x - c.dropOff) < 0.02) { phase = "pdGrab"; timer = GRAB_TIME; }
        return;
      }

      if (phase === "pdGrab") {
        timer -= dt;
        if (timer <= 0) {
          c.depBox.visible = false;
          c.carried.visible = true;
          phase = "pdRetract";
        }
        return;
      }

      if (phase === "pdRetract") {
        c.fork.position.x = moveTo(c.fork.position.x, 0, CRANE_FORK, dt);
        if (Math.abs(c.fork.position.x) < 0.02) phase = "toSlot";
        return;
      }

      if (phase === "toSlot") {
        c.crane.position.z = moveTo(c.crane.position.z, j.slot.z, CRANE_TRAVEL, dt);
        c.carriage.position.y = moveTo(c.carriage.position.y, j.slot.y, CRANE_HOIST, dt);
        if (Math.abs(c.crane.position.z - j.slot.z) < 0.02 && Math.abs(c.carriage.position.y - j.slot.y) < 0.02) {
          phase = "storeExtend";
        }
        return;
      }

      if (phase === "storeExtend") {
        const reach = j.slot.dir * c.reach;
        c.fork.position.x = moveTo(c.fork.position.x, reach, CRANE_FORK, dt);
        if (Math.abs(c.fork.position.x - reach) < 0.02) { phase = "release"; timer = GRAB_TIME; }
        return;
      }

      if (phase === "release") {
        timer -= dt;
        if (timer <= 0) {
          c.carried.visible = false;
          /* 슬롯에 실제로 상자가 생긴다 — 예약해 둔 칸의 행렬을 되살린다 */
          const gm = gradeMeshes[c.id];
          gm.im.setMatrixAt(j.target, gm.mats[j.target]);
          gm.im.instanceMatrix.needsUpdate = true;
          filled.add(j.target);
          phase = "storeRetract";
        }
        return;
      }

      if (phase === "storeRetract") {
        c.fork.position.x = moveTo(c.fork.position.x, 0, CRANE_FORK, dt);
        if (Math.abs(c.fork.position.x) < 0.02) {
          // 크레인을 평소 사이클로 돌려보낸다
          c.st.phase = "pause";
          c.st.timer = 1.2;
          c.st.tgt = null;
          startNext();
        }
      }
    },

    dispose() {
      cargoGeo.dispose();
      cargoMat.dispose();
    },
  };
}
