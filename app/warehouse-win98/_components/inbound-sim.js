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

import { PRODUCT_MODELS } from "./product-models";

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

/* ── 시연용 상품 셋 ────────────────────────────────────────────────────────────
   ★ 입고 화면에서 스캔하는 세 건과 **같은 상품**이다 (시나리오 확정). 회차 순서가 그대로
     적재 순서가 되도록 등급을 골랐다 — 아래 두 제약 때문에 이 조합은 마음대로 못 정한다.

   ⚠️ 제약 ① **크레인이 없는 등급이 둘 있다.** D(대형)과 F(특대형)에는 스태커 크레인을
      세우지 않았다(`CRANE_ZONES`). 그 등급으로 가는 건은 `startNext` 가 건너뛰므로 화면에
      아무 일도 일어나지 않는다. 세 변 합이 **120~140cm(D)** 이거나 **180cm 초과(F)** 면 안 된다.
      실제로 테라 20병(124.0)·24병(135.3), 오뜨 2열2줄 6단(137.0)이 이 함정에 빠진다.

   ⚠️ 제약 ② 로봇은 통로를 **+x 로만** 간다(`routeTo` 주석 참고). 일감이 craneX 오름차순으로
      정렬되므로 **등급을 정하는 순간 적재 순서가 정해진다.** 구역의 통로상 x 는
        A -6.90 · E -0.52 · B +2.18 · C +9.08   (D -6.20, F +5.68 은 크레인 없음)
      이라, A → E → C 로 가면 등록 순서(1·2·3)와 적재 순서가 맞아떨어진다.

   ★ 그래서 이 셋은 동선까지 계산해 고른 조합이다:
       되돌아감 없이 -6.9 → -0.5 → +9.1 로 **통로 16m 를 끝까지** 훑고,
       줄이 **뒷 → 앞 → 뒷** 으로 갈려 카메라가 통로를 가로질러 오간다(한 줄만 가면 단조롭다),
       등급이 **작음 → 가장 큼 → 중간** 이라 "치수가 자리를 정한다"가 보인다.
     셋 다 그 등급의 슬롯 안에 실제로 들어가는 크기이기도 하다.

   ⚠️ 치수는 **단품 실측에 포장 단위를 곱한 값**이다. 상자 치수를 지어내면 "세 변 합이
      144.8cm 라 특수" 라는 설명이 성립하지 않는다. 아래 주석의 셈이 곧 등급의 근거다.
   ⚠️ `sku` 는 **내부 코드**다. 실제 바코드(KAN)를 적으면 남의 상품 번호를 지어내는 것이 되고,
      시연에서 그 번호를 조회하면 다른 물건이 나온다.
   ⚠️ 지금은 상자 모양으로 그린다. 실제 상품 3D 모델은 나중에 얹는다 (사용자 결정) —
      그때도 이 치수는 그대로 쓴다. 모델이 바뀌어도 등급과 동선은 안 흔들려야 한다. */
export const DEMO_ITEMS = [
  /* 회차 1 — 게이트 통과.
     단품 10.0×9.9×9.9 를 3×2 로 담은 6개입 케이스
     30.0 + 19.8 + 9.9 = 59.7cm  ≤ 80  → A 극소형 (x -6.90, 뒷줄) */
  { sku: "NDL-KGR-06", name: "농심 누들핏 카구리맛 40.5g 6개입", l: 300, w: 198, h: 99, model: "kaguri" },
  /* 회차 2 — 게이트 미통과(종횡비 8.1) → 수기 확정으로 넘어온 건.
     ★ 사람이 확정한 건도 창고에는 똑같이 들어간다는 것이 이 한 장면으로 보인다.
     단품 25.2×31.6×3.9 를 2열 2줄 8단으로 쌓은 32개입 케이스
     50.4 + 63.2 + 31.2 = 144.8cm  ≤ 180  → E 특수 (x -0.52, 앞줄) */
  { sku: "ORN-OTT-32", name: "오리온 오뜨 치즈 12p 32개입", l: 504, w: 632, h: 312, model: "otte" },
  /* 회차 3 — 게이트 통과.
     단품 10.2×10.3×31.8 을 4×3 으로 담은 12병 케이스
     40.8 + 30.9 + 31.8 = 103.5cm  ≤ 120  → C 중형 (x +9.08, 뒷줄) */
  { sku: "HJR-TER-12", name: "하이트진로 테라 1600mL 12병", l: 408, w: 309, h: 318, model: "terra" },
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
 *   makeAGV: () => { grp: object },
 *   onStatus: (s: {note?: string, step?: number, ...} | null) => void,   // 자막 내용 (위 `setStatus` 참고)
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
  /* 짐 하나 = **그룹 하나**. 그 안에 골판지 상자와(있다면) 상품 모델이 함께 들어가고,
     둘 중 하나만 보인다.
     ★ 상자를 바로 쓰지 않는 이유: 상품 모델은 **제 크기로** 서 있으므로 `scale` 을 못 쓴다.
       그룹을 한 겹 두면 바깥은 자리만 잡고, 크기는 안쪽이 각자 알아서 갖는다.
     ⚠️ 모델은 **처음 쓸 때 만든다.** 시연 품목이 바뀌면 안 쓰는 모델을 미리 만들어 둔 값이
        그대로 남는다 — 캔버스 텍스처까지 딸려 있어 공짜가 아니다. */
  const cargoes = DEMO_ITEMS.map(() => {
    const g = new THREE.Group();
    const box = new THREE.Mesh(cargoGeo, cargoMat);
    box.castShadow = true;   // 실려 가는 짐도 (위 로봇과 같은 이유)
    g.add(box);
    g.visible = false;
    g.userData.box = box;
    scene.add(g);
    return g;
  });
  const DECK_Y = 0.78; // AGV 상판 높이

  /* ── 속도 ──
     ★ 올렸다 → 내렸다 → **다시 올렸다** (사용자 요청). 처음에 빠르게 했다가 화면이
       정신없다고 되돌렸는데, 어지러움의 원인은 속도가 아니라 **카메라가 매 순간 방향을
       바꾸는 것**이었다(아래 `state.az` 주석). 그쪽을 고정하고 도입부·감쇠를 다듬은 뒤로는
       이 속도에서도 화면이 안 흔들린다.
     ⚠️ 그래도 실제 창고 속도(1~1.5m/s)보다 네다섯 배 빠르다. 30m 를 실제 속도로 가면
        20초가 넘고, 그동안 화면이 아무 말도 하지 않는다.
     ⚠️ 속도를 더 올릴 거면 **카메라 감쇠도 같이** 봐야 한다(창고 쪽 `filmAz`/`camPos`).
        짐만 빨라지면 카메라가 뒤처진 채 끌려가고, 그 어긋남이 곧 어지러움이다. */
  const BOT_SPEED = 6.2;
  const CRANE_TRAVEL = 6.2;
  const CRANE_HOIST = 3.6;
  const CRANE_FORK = 4.4;
  const GRAB_TIME = 0.15;
  /* ── 슬롯에 넣는 동작만 따로 느리게 ─────────────────────────────────────
     ★ 넣는 장면이 **0.4초 만에 끝나 있었다** (사용자 지적 — 마지막 물건이 제대로 안 잡힌다).
       포크가 1m 를 4.4m/s 로 뻗으니 0.23초, 놓는 데 0.15초. 카메라 감쇠가 90% 따라잡는 데
       1.15초인데 동작이 0.4초에 끝나면, 카메라가 도착하기도 전에 상황이 끝나 있다.
     ★ 그래서 **이 구간만** 느리게 한다. 통로 주행이나 P&D 집기까지 늦추면 시연 전체가
       늘어진다 — 느려야 하는 것은 "물건이 칸에 들어가는 그 순간" 하나다.
     ⚠️ `AIM` 은 포크가 뻗기 **전에** 멈춰 서는 시간이다. 카메라가 자리를 잡을 틈을 주지
        않으면, 느리게 뻗어도 화면은 여전히 따라오는 중이다. */
  const STORE_AIM = 0.8;        // 겨냥 — 멈춰 서서 카메라를 기다린다
  const STORE_FORK = 0.85;      // 넣는 포크 속도 (m/s) — 1m 에 약 1.2초
  const STORE_HOLD = 0.9;       // 놓고 나서 그대로 보여 주는 시간
  const STORE_BACK = 1.9;       // 빼는 포크 속도 — 넣을 때보다는 빠르게

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
  const state = { az: 0, pol: 0.62, dist: 15, minY: 8, corridorFirst: false };
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
  /* ★ 멀리서 보여 주던 도입부를 **뺐다** (사용자 요청 — 처음부터 바로 로봇 시점).
     `HOLD` 이 0 이라 아래 `pushing` 이 늘 참이고, 도입부 내내 1인칭 값이 쓰인다. 남긴
     0.9초는 **카메라가 제자리를 잡는 시간**이다 — 0 으로 두면 전 화면의 카메라 자리에서
     로봇 뒤까지 한 프레임에 순간이동한다. */
  const INTRO_HOLD = 0, INTRO_PUSH = 0.9;

  /* ── 통로 주행 = 로봇 1인칭 ────────────────────────────────────────────
     ★ 위에서 내려다보며 따라가던 것을 **로봇 눈높이**로 내렸다 (사용자 요청 — 몰입감).
       통로를 지나는 동안은 랙이 양옆으로 스쳐 지나가는 것이 보여야 "창고를 가로지른다"가
       느껴진다. 15m 위에서 보면 지도 위의 점이 움직이는 것과 다르지 않다.
     ── 값의 근거 (궤도 모델 `camPos = focus + dist·(sinP·sinA, cosP, sinP·cosA)`) ──
       로봇 뒤 1.1m · 눈높이 **2.4m** 에서 앞쪽 7m 를 본다 (초점 높이 1.1m)
         오프셋 = (-8.1, +1.3, 0) → dist √(8.1²+1.3²) = 8.20, pol acos(1.3/8.20) = 1.412
         z 오프셋이 0 이므로 az 는 -π/2 (로봇 뒤 = -x)
       ★ 눈높이를 1.9 → 2.4 로 올렸다 (사용자 요청). 로봇이 바닥에 붙어 있어서 1.9 에서는
         화면 아래쪽 절반이 바닥이었다. 조금 올리면 통로 끝과 랙 위쪽까지 들어온다.
       ★ 꼬리(뒤 + 앞)를 8.1 → **6.7m** 로 줄였다 (사용자 요청 — 시점을 오른쪽으로).
         카메라가 로봇보다 8m 나 뒤에 있으면, 적재를 마치고 출발할 때 아직 **지나온 구역**
         위에 걸쳐 있게 된다. 짧을수록 다음 자리로 옮겨 가는 길도 짧아진다.
     ⚠️ `az` 는 일감마다 정하던 `travelAz` 를 쓰지 않고 **-π/2 로 못 박는다.** 통로를
        비스듬히 보면 1인칭이 아니라 옆에서 따라가는 그림이 된다.
     ⚠️ 로봇은 통로 한가운데(z = 0)를 지나고 통로 반폭이 1.6m 라, 눈높이로 내려도 랙을
        뚫지 않는다. `minY` 를 1.85 까지 낮출 수 있는 이유가 이것뿐이다 — 통로를 벗어난
        구간에서 같은 값을 쓰면 선반을 관통한다. */
  const POV = { az: -Math.PI / 2, pol: 1.379, dist: 6.83, minY: 2.3 };
  const POV_AHEAD = 6.0, POV_LOOK_Y = 1.1;
  /* 골목을 빠져나오는 동안 카메라를 통로에 먼저 올려 두는 시간(초).
     ★ 적재를 마치고 다음 물건으로 갈 때, 카메라가 **골목에서 통로로 나오는 것과 x 로
       8m 옮기는 것을 동시에** 했다. 그 대각선이 사이에 있는 구역의 랙을 관통했다
       (사용자 지적 — 선반을 지나친다). 사람이라면 골목을 먼저 빠져나와 통로를 타고
       걸어간다. `corridorFirst` 가 참인 동안은 창고 쪽에서 x 이동을 막아 둔다. */
  const EXIT_HOLD = 0.9;
  let exitT = 0;

  /* 마지막에 카메라가 향할 곳 — 출고 구역이다. 창고 쪽에서 좌표를 받는다 */
  const outroAt = deps.outboundAt ? new THREE.Vector3(...deps.outboundAt) : null;

  let jobs = [];
  let jobIndex = -1;
  /* 지금 로봇을 떠나 크레인 쪽에 가 있는 짐.
     ★ 예전에는 인계하는 순간 짐을 감추고, P&D 와 포크 위에는 **크레인이 들고 다니는 일반
       상자**를 켰다. 그래서 로봇 위에서는 카구리·오뜨·테라가 보이다가 크레인으로 넘어가는
       순간 골판지 상자로 바뀌었다 (사용자 지적). 지금은 **같은 물건**이 로봇 → P&D →
       포크 → 슬롯으로 옮겨 다닌다.
     ⚠️ `restack` 이 이 짐을 건드리면 안 된다. 그 함수는 로봇 위의 짐만 정리하는데,
        크레인에 가 있는 것까지 감춰 버린다. */
  let handed = null;
  const tmpV = new THREE.Vector3();
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
    for (let i = 0; i < jobs.length; i += 1) {
      if (cargoes[i] === handed) continue;   // 크레인 쪽에 가 있는 것은 그대로 둔다
      cargoes[i].visible = false;
    }
    for (const i of left) {
      const h = jobs[i].item.h / 1000;
      const c = cargoes[i];
      c.visible = true;
      c.position.set(bot.grp.position.x, y + h / 2, bot.grp.position.z);
      c.rotation.y = bot.grp.rotation.y;
      y += h + 0.012;
    }
  };

  /* 화면 자막에 실을 내용.
     ★ 예전에는 **한 줄짜리 문자열**을 넘겼다. 상품명·치수·세 변 합·목적지가 한 줄에 붙어
       있어서 글자를 키우면 화면 밖으로 나갔고, 어디까지가 상품명인지도 안 보였다. 조각을
       나눠 넘기면 받는 쪽이 줄을 나누고 크기를 달리 줄 수 있다.
     ⚠️ 문자열을 그대로 넘기지 않는다 — 자막의 생김새는 **화면 쪽 일**이다. 여기서 `mm`,
        `cm`, 화살표를 박아 두면 자막을 고칠 때마다 시뮬레이션 코드를 건드리게 된다. */
  const setStatus = () => {
    const j = job();
    if (j === null) {
      onStatus(null);
      return;
    }
    onStatus({
      step: jobIndex + 1,
      total: jobs.length,
      name: j.item.name,
      l: j.item.l, w: j.item.w, h: j.item.h,
      sumCm: (j.item.l + j.item.w + j.item.h) / 10,
      grade: `${j.grade.code} ${j.grade.name}`,
      slot: j.slot ? `${j.slot.col}열 ${j.slot.level}단` : null,
    });
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
      onStatus({ note: "적재 완료 — Enter 를 눌러 창고 화면으로" });
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
    exitT = EXIT_HOLD;   // 골목에서 나오는 동안 통로를 먼저 탄다 (위 `EXIT_HOLD` 참고)
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
        const cg = cargoes[i];
        if (it === undefined) { cg.visible = false; continue; }
        const make = it.model ? PRODUCT_MODELS[it.model] : null;
        if (make) {
          if (!cg.userData.model) {
            const m = make(THREE);
            m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
            cg.add(m);
            cg.userData.model = m;
          }
          cg.userData.model.visible = true;
          cg.userData.box.visible = false;
        } else {
          /* ⚠️ 상자는 **상자만** 키운다. 그룹을 키우면 나중에 붙는 모델까지 같이 늘어난다 */
          cg.userData.box.visible = true;
          cg.userData.box.scale.set(it.l / 1000, it.h / 1000, it.w / 1000);
          if (cg.userData.model) cg.userData.model.visible = false;
        }
      }

      /* ⚠️ 지난번에 크레인에 매달린 채 끝났을 수 있다. 부모를 씬으로 되돌리지 않으면
         새 주기의 짐이 포크에 붙은 채로 시작한다 */
      if (handed) { scene.add(handed); handed = null; }
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
      onStatus({ note: "입고 문 — 상품 3건 도착" });
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
        /* 시선을 **로봇 앞쪽**에 둔다 — 주행 중과 같은 규칙이라 출발할 때 시점이 안 튄다 */
        focus.set(HOME[0] + POV_AHEAD, POV_LOOK_Y, HOME[2]);
        timer -= dt;
        const pushing = timer <= INTRO_PUSH;
        /* ⚠️ 밀고 들어가는 끝점을 **1인칭 값과 같게** 둔다. 도입부 전용 값을 따로 두면
           로봇이 출발하는 순간 카메라가 한 번 더 튄다 — 그 한 번이 도입부를 망친다. */
        state.az = pushing ? POV.az : introAz;
        state.pol = pushing ? POV.pol : 0.95;   // 멀리서는 눈높이에 가깝게 내려다본다
        state.dist = pushing ? POV.dist : 30;   // 30 ≈ 전체 보기 — 트럭과 야적장이 다 들어온다
        state.minY = pushing ? POV.minY : 12;
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
        /* 1인칭 — 시선은 **로봇이 아니라 로봇이 가는 앞쪽**에 둔다 (위 `POV` 주석 참고).
           ⚠️ 짐이나 로봇을 초점으로 잡으면 카메라가 그 뒤에 붙어 따라가는 그림이 된다.
              앞을 봐야 통로가 다가오고, 그래야 타고 있는 느낌이 난다. */
        focus.set(bot.grp.position.x + POV_AHEAD, POV_LOOK_Y, bot.grp.position.z);
        if (exitT > 0) exitT -= dt;
        /* 아직 골목에서 나오는 중이면 창고 쪽에 **x 는 붙들라**고 알린다 */
        state.corridorFirst = exitT > 0;
        state.az = POV.az;
        state.pol = POV.pol;
        state.dist = POV.dist;
        state.minY = POV.minY;
      } else if (c !== null) {
        c.carried.getWorldPosition(focus);
        if (!c.carried.visible) focus.setY(focus.y + 0.2);

        /* ── 넘겨받기부터 적재까지 — **한 시점으로 이어 간다** ──────────────
           ★ 예전에는 넘겨주는 순간 12m 뒤로 물러나 로봇과 크레인을 한 화면에 담았다가,
             적재할 때 다시 골목으로 들어갔다. 그 왕복이 컷처럼 끊겨서 "들어갈 때만 잠깐
             보이는" 화면이 됐다 (사용자 지적). 지금은 물러나지 않는다 — 로봇 뒤에서
             그대로 **골목 안으로 미끄러져 들어가** 적재가 끝날 때까지 거기 머문다.
           ★ 그래서 값이 세 단계로만 좁혀진다. 카메라가 한 방향으로 계속 다가가므로
             장면이 끊기지 않는다:
               넘겨받는 중 (P&D)  뒤 4.6 · 위 1.3 · 옆 0.70
               올라가는 중        뒤 3.6 · 위 0.90 · 옆 0.60
               넣는 순간          뒤 2.4 · 위 0.45 · 옆 0.55
           ── 궤도 모델 역산 ──  dist = |off|,  az = atan2(ox, oz),  pol = acos(oy / dist)

           ⚠️ x 로 **포크가 뻗는 반대쪽(-dir)** 으로 비껴선다. 같은 쪽에 서면 상자를 밀어
              넣는 그 앞을 카메라가 막는다.
           ⚠️ 비끼는 폭은 0.7m 까지다. 골목 폭이 1.7m 라 한가운데에서 0.85m 를 넘으면 랙을
              뚫는다.
           ⚠️ 초점(`focus`)은 포크 위의 상자다. 포크가 뻗으면 초점이 랙 쪽으로 밀리고
              오프셋이 초점 기준이라 카메라도 같이 밀린다 — 반대쪽으로 비끼는 값이 그
              밀림을 상쇄하는 몫도 한다.
           ⚠️ 통로 건너편으로 넘어가지 않게 물러나는 거리를 자른다. 크레인이 통로 가까이
              있을 때 그대로 물러나면 반대편 랙에 박힌다. */
        const atPD = phase === "handoff" || phase === "toPD" || phase === "pdExtend"
          || phase === "pdGrab" || phase === "pdRetract";
        /* ⚠️ `storeAim` 부터 가까운 값을 쓴다. 뻗기 시작할 때 비로소 당기면, 카메라가
           다가오는 중에 이미 상자가 칸으로 들어가 있다 */
        const near = phase === "storeAim" || phase === "storeExtend" || phase === "release";
        const back = (j?.crane?.zone?.row ?? 0) === 0;
        const dir = j?.slot?.dir ?? 1;

        /* ── x: **골목 한가운데**에 선다 ──
           ★ 마지막 물건(C 중형)에서 앞 선반에 시야가 가렸다 (사용자 지적). 원인은 오프셋을
             **짐 기준**으로 준 것이었다. 포크가 뻗으면 짐이 랙 쪽으로 1m 가까이 밀려 나가고,
             거기서 다시 0.6m 만 비끼면 카메라가 골목 중심선에서 벗어나 랙 끝단 뒤로 들어간다.
             골목이 짧을수록(C 는 5.6m, A 는 7.8m) 그 어긋남이 바로 가림으로 나타난다.
           ★ 그래서 카메라 x 를 **크레인이 다니는 축(`craneX`)** 에 못 박는다. 짐이 어디로
             밀려 나가든 카메라는 골목 한가운데를 지킨다 — 오프셋은 짐 기준이므로 그 차이를
             빼서 준다. */
        const wantZ = atPD ? 4.6 : near ? 2.4 : 3.6;
        const ox = (c.craneX - dir * 0.5) - focus.x;

        /* ── z: **골목 안**을 우선한다 ──
           ⚠️ 통로까지 물러나면 랙 **끝단**이 시야를 좁힌다 — 골목 입구가 1.7m 짜리 창이 되어
              그 틀 안으로만 보인다. 골목 안에 남을 수 있으면 그렇게 하고, 그러기엔 너무
              가까워질 때(2.2m 미만)만 통로로 나간다.
           ⚠️ 그래도 통로 건너편으로는 못 넘어간다. 넘어가면 반대편 랙에 박힌다. */
        const mouth = back ? (c.zone.zStart + c.zone.len) : c.zone.zStart;
        const inAisle = back ? (mouth - 0.2) - focus.z : focus.z - (mouth + 0.2);
        const toCorridor = back ? 1.5 - focus.z : focus.z + 1.5;
        const limit = inAisle >= 2.2 ? inAisle : toCorridor;
        const oz = (back ? 1 : -1) * Math.max(1.8, Math.min(wantZ, limit));
        const oy = atPD ? 1.30 : near ? 0.45 : 0.90;

        state.dist = Math.hypot(ox, oy, oz);
        state.az = Math.atan2(ox, oz);
        state.pol = Math.acos(oy / state.dist);
        /* 상자가 아래 칸으로 갈 때는 카메라도 따라 내려가야 한다. 바닥을 뚫지 않을
           만큼만 남긴다 */
        state.minY = 1.1;
      }

      state.corridorFirst = false;

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
        /* 짐을 **P&D 위로 옮긴다.** 감췄다가 다른 상자를 켜는 것이 아니라, 같은 물건이
           자리를 옮긴다.
           ⚠️ 두 물건의 **높이가 다르다.** `depBox` 자리를 그대로 쓰면 낮은 짐은 공중에
              뜨고 높은 짐은 받침을 파고든다. 받침 윗면을 구해 거기에 얹는다. */
        handed = cargoes[jobIndex];
        c.depBox.getWorldPosition(tmpV);
        const depH = c.depBox.geometry.parameters.height;
        handed.position.set(tmpV.x, tmpV.y - depH / 2 + j.item.h / 2000, tmpV.z);
        handed.rotation.set(0, 0, 0);
        handed.visible = true;
        j.done = true;
        restack();
        c.depBox.visible = false;     // 자리를 진짜 물건이 대신한다
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
          /* 포크에 **자식으로 매단다.** 좌표를 매 프레임 따라 붙이면 포크가 뻗고 오르는
             동안 한 박자씩 늦어 손에서 떨어져 보인다.
             ⚠️ 크레인이 들고 다니던 일반 상자(`carried`)는 계속 감춰 둔다. 켜 두면 진짜
                물건과 같은 자리에서 겹친다. */
          if (handed) {
            c.fork.add(handed);
            handed.position.set(0, j.item.h / 2000 + 0.02, 0);
            handed.rotation.set(0, 0, 0);
          }
          c.carried.visible = false;
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
          phase = "storeAim";
          timer = STORE_AIM;
        }
        return;
      }

      /* 겨냥 — 칸 앞에 멈춰 서서 카메라가 자리를 잡을 틈을 준다 (위 `STORE_AIM` 참고) */
      if (phase === "storeAim") {
        timer -= dt;
        if (timer <= 0) phase = "storeExtend";
        return;
      }

      if (phase === "storeExtend") {
        const reach = j.slot.dir * c.reach;
        c.fork.position.x = moveTo(c.fork.position.x, reach, STORE_FORK, dt);
        if (Math.abs(c.fork.position.x - reach) < 0.02) { phase = "release"; timer = STORE_HOLD; }
        return;
      }

      if (phase === "release") {
        timer -= dt;
        if (timer <= 0) {
          c.carried.visible = false;
          /* 들고 온 물건을 치우고 씬으로 돌려놓는다.
             ⚠️ 부모를 안 되돌리면 다음 주기에 그 짐이 **포크에 매달린 채** 로봇 위로
                옮겨 간다 — 크레인이 움직일 때마다 같이 끌려다닌다. */
          if (handed) {
            scene.add(handed);
            handed.visible = false;
            handed = null;
          }
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
        c.fork.position.x = moveTo(c.fork.position.x, 0, STORE_BACK, dt);
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
      // 상품 모델이 들고 있는 캔버스 텍스처는 씬 정리에 안 걸린다 — 따로 버린다
      for (const cg of cargoes) cg.userData.model?.userData.dispose?.();
    },
  };
}
