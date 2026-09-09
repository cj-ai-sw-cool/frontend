"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   바탕화면 장식 — CJ대한통운 트럭에서 내린 택배기사가 상자를 들고 서 있다.
   순수 시각 장식이다. 클릭 동작·소리·다른 화면으로의 이동은 없다.

   ★ 3D 를 쓰지 않고 픽셀 그림으로 그린다. 98 스킨의 나머지와 결이 맞는다.
   ⚠️ 트럭을 x=2 부터 그린다. 운전석을 x=-1 에 두면 앞이 화면 밖으로 잘려 보인다.
   ═══════════════════════════════════════════════════════════════════════════ */

/** 그림 한 칸(px). 이 값의 배수로만 그려야 픽셀 그림으로 보인다 */
const U = 6;
const W = 78 * U;
const H = 54 * U;

/* CJ 색 — 로고에서 뽑은 값 (`shell.tsx` 의 BrandMark 와 같다) */
const CJ_BLUE = "#003087";
const CJ_MID = "#0A3F9E";
const CJ_DARK = "#00205C";

/* 마인크래프트 좀비 — 받은 이미지에서 **픽셀을 세어 뽑은 색**이다.
   ⚠️ 셔츠(#00AFAD)는 거의 안 보인다 — 위에 CJ 안전조끼를 입히기 때문이다. 목덜미와
      허리춤에만 조금 남겨 두어야 조끼를 걸친 것으로 보인다. */
const SKIN = "#4A7434";        // 살 — 이끼 낀 초록
const SKIN_MID = "#3F652C";    // 그늘
const SKIN_DARK = "#375227";   // 더 진한 그늘
const SHIRT = "#00AFAD";       // 셔츠 — 청록
const SHIRT_DARK = "#009899";
const PANTS = "#463AA6";       // 바지 — 남보라
const PANTS_DARK = "#302873";
const SHOE = "#6B6B6B";        // 신발 — 회색

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
        {/* 그림자 — 트럭과 택배기사가 바닥에 붙어 보이게 한다 */}
        <P x={4} y={40} w={42} h={1} fill="#22272E" opacity={0.55} />
        <P x={50} y={40} w={13} h={1} fill="#22272E" opacity={0.5} />

        {/* ═══ 트럭 ═══════════════════════════════════════════════
            차체가 왼쪽, 뒷문이 오른쪽이다. 택배기사가 그 뒷문에서 내려 선다 */}
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
        <P x={10} y={15} w={32} h={9} fill={CJ_MID} />
        <P x={10} y={24} w={32} h={11} fill={CJ_BLUE} />
        <P x={10} y={35} w={32} h={2} fill={CJ_DARK} />
        {/* 옆면 흰 띠 + 로고 */}
        <P x={12} y={19} w={28} h={8} fill="#FFFFFF" />
        <P x={12} y={27} w={28} h={1} fill="#D6DCE4" />
        <text
          x={13.4 * U}
          y={25.2 * U}
          fill={CJ_BLUE}
          style={{ font: `700 ${4.2 * U}px 'Malgun Gothic', sans-serif`, letterSpacing: "0.02em" }}
        >
          CJ대한통운
        </text>
        {/* 판을 이어 붙인 자국 */}
        {[18, 26, 34].map((x) => (
          <P key={x} x={x} y={28} w={1} h={7} fill={CJ_DARK} opacity={0.45} />
        ))}

        {/* 바퀴 — 타이어 + 휠 */}
        <P x={12} y={36} w={6} h={4} fill="#15181C" />
        <P x={14} y={37} w={2} h={2} fill="#6E757D" />
        <P x={33} y={36} w={6} h={4} fill="#15181C" />
        <P x={35} y={37} w={2} h={2} fill="#6E757D" />

        {/* 뒷문 — 한 짝이 바깥으로 열려 있다 */}
        <P x={42} y={13} w={2} h={24} fill={CJ_DARK} />
        <P x={44} y={12} w={2} h={26} fill={CJ_MID} />
        <P x={44} y={12} w={2} h={1} fill="#7FA6DA" />
        {/* 열린 문 안쪽 어둠 */}
        <P x={40} y={15} w={2} h={20} fill="#0D1116" />

        {/* ═══ 좀비 택배기사 — CJ 모자·조끼 ═══════════════════════
            ★ **머리를 크게** 잡은 2등신이다 — 같은 색·같은 옷이라도 머리가 전체의 40%를
              넘으면 무서운 것이 귀여워진다. 도트 캐릭터가 귀여운 이유는 색이 아니라 비율이다.
            ⚠️ 눈은 움푹 팬 검은 띠 대신 동그란 점으로 그린다. 흰 반짝임을 한 칸 넣으면
               눈이 살아 있는 것으로 보인다 — 그 한 칸이 없으면 단추다.
            ⚠️ 팔을 앞으로 뻗은 채 둔다. 그 자세가 마침 상자를 받쳐 드는 자세다.
               상자를 나중에 그리므로 팔이 상자 뒤로 들어가 안고 있는 것처럼 보인다. */}
        {/* 신발 */}
        <P x={52} y={38} w={4} h={2} fill={SHOE} />
        <P x={57} y={38} w={4} h={2} fill={SHOE} />
        {/* 다리 — 짧고 통통하게 */}
        <P x={52} y={33} w={4} h={5} fill={PANTS} />
        <P x={52} y={36} w={4} h={2} fill={PANTS_DARK} />
        <P x={57} y={33} w={4} h={5} fill={PANTS} />
        <P x={57} y={36} w={4} h={2} fill={PANTS_DARK} />
        {/* 몸통 — 셔츠가 목덜미와 허리춤에만 보인다 */}
        <P x={51} y={26} w={11} h={7} fill={SHIRT} />
        <P x={51} y={31} w={11} h={2} fill={SHIRT_DARK} />
        {/* CJ 안전조끼 */}
        <P x={51} y={27} w={11} h={5} fill="#1E82C8" />
        <P x={51} y={27} w={11} h={1} fill="#3FA0E4" />
        <P x={52} y={28} w={1} h={4} fill="#DC3B2C" />
        <P x={60} y={28} w={1} h={4} fill="#F2B01E" />
        <P x={56} y={27} w={1} h={5} fill="#12466E" />

        {/* 머리 — 크고 네모나게 */}
        <P x={49} y={14} w={15} h={12} fill={SKIN} />
        <P x={49} y={23} w={15} h={3} fill={SKIN_MID} />
        <P x={49} y={14} w={15} h={1} fill="#5C8C42" />
        {/* 눈 — 동그란 점 + 흰 반짝임 */}
        <P x={52} y={18} w={3} h={3} fill="#16250F" />
        <P x={52} y={18} w={1} h={1} fill="#FFFFFF" />
        <P x={58} y={18} w={3} h={3} fill="#16250F" />
        <P x={58} y={18} w={1} h={1} fill="#FFFFFF" />
        {/* 볼 — 한 칸씩 진하게. 있으면 얼굴이 둥글어 보인다 */}
        <P x={50} y={21} w={2} h={1} fill={SKIN_DARK} />
        <P x={61} y={21} w={2} h={1} fill={SKIN_DARK} />
        {/* 입 — 작게 한 칸 */}
        <P x={55} y={22} w={3} h={1} fill={SKIN_DARK} />

        {/* CJ대한통운 모자 — 챙이 앞으로 나와 있다 */}
        <P x={48} y={10} w={17} h={4} fill={CJ_BLUE} />
        <P x={48} y={10} w={17} h={1} fill={CJ_MID} />
        <P x={46} y={13} w={21} h={1} fill={CJ_DARK} />
        <P x={54} y={11} w={5} h={2} fill="#FFFFFF" />
        <P x={55} y={11} w={3} h={1} fill={CJ_BLUE} />

        {/* 팔 — 상자를 받치고 앞으로 뻗었다 (상자가 뒤에 그려져 팔을 덮는다) */}
        <P x={46} y={28} w={5} h={4} fill={SKIN} />
        <P x={46} y={31} w={5} h={1} fill={SKIN_MID} />
        <P x={62} y={28} w={5} h={4} fill={SKIN} />
        <P x={62} y={31} w={5} h={1} fill={SKIN_MID} />

        {/* ═══ 상자 (정적 장식) ═══════════════════════════════════ */}
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
