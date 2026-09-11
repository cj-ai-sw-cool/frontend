"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   바탕화면 장식 — A.LTS 트럭이 도크에 서 있고 뒷문 옆에 내린 상자 하나가 놓여 있다.
   순수 시각 장식이다. 클릭 동작·소리·다른 화면으로의 이동은 없다.

   ★ 3D 를 쓰지 않고 픽셀 그림으로 그린다. 98 스킨의 나머지와 결이 맞는다.
   ⚠️ 트럭을 x=2 부터 그린다. 운전석을 x=-1 에 두면 앞이 화면 밖으로 잘려 보인다.
   ⚠️ Stage 4(S4.4) 에서 여기 서 있던 좀비 택배기사 캐릭터를 뺐다 — 정적 장식만 남긴다
      (브리프 §3 S4.4). 상자는 캐릭터가 들고 있던 자리에 그대로 두어 "막 내려놓은 상자"로
      읽힌다. 캐릭터 전용 색상(피부·셔츠·바지·신발)도 같이 지웠다 — 다른 어디서도 쓰지
      않는 상수였다.
   ═══════════════════════════════════════════════════════════════════════════ */

/** 그림 한 칸(px). 이 값의 배수로만 그려야 픽셀 그림으로 보인다 */
const U = 6;
const W = 78 * U;
const H = 54 * U;

/* A.LTS 색 — 로고에서 뽑은 값 (`shell.tsx` 의 BrandMark 와 같다) */
const ALTS_BLUE = "#003087";
const ALTS_MID = "#0A3F9E";
const ALTS_DARK = "#00205C";

const GOLD = "#c9a458";
const GOLD_LIGHT = "#ffe08a";

/** 픽셀 한 덩어리 */
function P({ x, y, w, h, fill, opacity }: {
  x: number; y: number; w: number; h: number; fill: string; opacity?: number;
}) {
  return <rect x={x * U} y={y * U} width={w * U} height={h * U} fill={fill} opacity={opacity} />;
}

export function TruckDock() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        shapeRendering="crispEdges"
        className="pointer-events-none select-none"
        aria-hidden
      >
        {/* ── 바닥 — 야적장 아스팔트에 노란 주차선 ── */}
        <P x={0} y={40} w={78} h={14} fill="#39404A" />
        <P x={0} y={40} w={78} h={1} fill="#4C5560" />
        <P x={0} y={41} w={78} h={1} fill="#333A43" />
        {[4, 22, 40, 58].map((x) => (
          <P key={x} x={x} y={47} w={9} h={1} fill="#C8A21E" opacity={0.55} />
        ))}
        {/* 그림자 — 트럭과 상자가 바닥에 붙어 보이게 한다 */}
        <P x={4} y={40} w={42} h={1} fill="#22272E" opacity={0.55} />
        <P x={50} y={40} w={13} h={1} fill="#22272E" opacity={0.5} />

        {/* ═══ 트럭 ═══════════════════════════════════════════════
            차체가 왼쪽, 뒷문이 오른쪽이다 */}
        {/* 앞 범퍼·전조등 — x=2 부터 시작해 앞이 잘리지 않는다 (머리말 참고) */}
        <P x={2} y={33} w={2} h={4} fill="#8C97A4" />
        <P x={2} y={30} w={2} h={2} fill="#FFE7A8" />

        {/* 운전석 */}
        <P x={3} y={20} w={7} h={2} fill="#EEF2F7" />
        <P x={3} y={22} w={7} h={13} fill="#DCE3EB" />
        <P x={3} y={35} w={7} h={2} fill="#A9B3BF" />
        <P x={4} y={23} w={5} h={5} fill="#2B3A4A" />
        <P x={4} y={23} w={5} h={1} fill="#4C6178" />

        {/* 적재함 — 위는 밝고 아래로 갈수록 어둡게 */}
        <P x={10} y={13} w={32} h={2} fill="#EEF2F7" />
        <P x={10} y={15} w={32} h={9} fill={ALTS_MID} />
        <P x={10} y={24} w={32} h={11} fill={ALTS_BLUE} />
        <P x={10} y={35} w={32} h={2} fill={ALTS_DARK} />
        {/* 옆면 흰 띠 + 로고 */}
        <P x={12} y={19} w={28} h={8} fill="#FFFFFF" />
        <P x={12} y={27} w={28} h={1} fill="#D6DCE4" />
        <text
          x={16.5 * U}
          y={25.2 * U}
          fill={ALTS_BLUE}
          style={{ font: `700 ${4.2 * U}px 'Malgun Gothic', sans-serif`, letterSpacing: "0.02em" }}
        >
          A.LTS
        </text>
        {/* 판을 이어 붙인 자국 */}
        {[18, 26, 34].map((x) => (
          <P key={x} x={x} y={28} w={1} h={7} fill={ALTS_DARK} opacity={0.45} />
        ))}

        {/* 바퀴 — 타이어 + 휠 */}
        <P x={12} y={36} w={6} h={4} fill="#15181C" />
        <P x={14} y={37} w={2} h={2} fill="#6E757D" />
        <P x={33} y={36} w={6} h={4} fill="#15181C" />
        <P x={35} y={37} w={2} h={2} fill="#6E757D" />

        {/* 뒷문 — 한 짝이 바깥으로 열려 있다 */}
        <P x={42} y={13} w={2} h={24} fill={ALTS_DARK} />
        <P x={44} y={12} w={2} h={26} fill={ALTS_MID} />
        <P x={44} y={12} w={2} h={1} fill="#7FA6DA" />
        {/* 열린 문 안쪽 어둠 */}
        <P x={40} y={15} w={2} h={20} fill="#0D1116" />

        {/* ═══ 상자 (정적 장식) — 뒷문 옆에 내려놓은 자리 ═══════════ */}
        <g aria-hidden>
          {/* 뚜껑 */}
          <P x={48} y={27} w={16} h={2} fill="#D8B98A" />
          <P x={48} y={29} w={16} h={1} fill="#B8965F" />

          {/* 몸통 */}
          <P x={48} y={29} w={16} h={9} fill="#C9A16B" />
          <P x={48} y={29} w={16} h={1} fill="#E0BE8C" />
          <P x={48} y={37} w={16} h={1} fill="#A47F4C" />
          {/* 골판지 결 */}
          {[50, 54, 58, 62].map((x) => (
            <P key={x} x={x} y={31} w={1} h={6} fill="#B8905C" opacity={0.45} />
          ))}
          {/* 운송 표시 */}
          <P x={49} y={32} w={5} h={4} fill="#FFFFFF" opacity={0.92} />
          <P x={50} y={33} w={3} h={1} fill="#2E9BFF" />
          <P x={50} y={34} w={2} h={1} fill="#1B5CE0" />

          {/* 금빛 실틈 — 화면에 생기를 주는 은은한 반짝임 */}
          <g style={{ animation: "td-hint 2.4s ease-in-out infinite" }}>
            <P x={49} y={29} w={14} h={1} fill={GOLD_LIGHT} />
            <P x={51} y={30} w={3} h={1} fill={GOLD} opacity={0.7} />
            <P x={58} y={30} w={3} h={1} fill={GOLD} opacity={0.7} />
          </g>
        </g>
      </svg>

      <style>{`
        @keyframes td-hint { 0%,100% { opacity: .35 } 50% { opacity: 1 } }
      `}</style>
    </div>
  );
}
