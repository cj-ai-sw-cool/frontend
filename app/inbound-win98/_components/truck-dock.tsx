"use client";

import { useCallback, useEffect, useRef, useState } from "react";


/* ═══════════════════════════════════════════════════════════════════════════
   바탕화면 이스터에그 — CJ대한통운 트럭에서 내린 좀비 택배기사가 상자를 들고 서 있다.
   그 상자를 열면 안에서 금빛이 쏟아지고, 그 빛이 화면을 채우며 **팀 소개
   「멋지조 원정대」** 로 이어진다.

   ★ 예전에는 동굴 속 워든과 3D 마인크래프트 상자였다. 바꾼 이유가 둘이다:
       · 그 상자 모델이 **10.4MB** 라 받는 데 5초 남짓 걸렸다. 연출은 5.2초 만에 끝나서,
         다 받았을 때는 이미 화면이 닫혀 있었다 — 눌러도 아무 일이 없어 보였다.
       · 이 저장소의 3D 창고에 이미 트럭과 마인크래프트 인물들이 있다. 같은 세계의 인물을
         바탕화면에도 세우면 화면들이 한 덩어리로 묶인다 (사용자 요청).
   ★ 피글린으로 세웠다가 **좀비**로 바꿨다 (사용자 요청). CJ대한통운 모자를 씌우고 안전
     조끼를 입혔다 — 좀비가 팔을 앞으로 뻗고 있는 그 자세가 마침 상자를 받쳐 드는 자세다.
   ★ 그래서 **3D 를 쓰지 않고 픽셀 그림으로** 그린다. 내려받을 것이 없어 누르는 즉시
     반응하고, 98 스킨의 나머지와도 결이 맞는다.

   ★ 상자를 누르면 **3D 마인크래프트 상자**가 떠서 뚜껑이 열리고, 그 안에서 **먹물이
     화면 가득 뿌려진** 뒤 팀 소개로 넘어간다 (사용자 요청).
     상자가 열리면 **돼지들이 튀어나오고**, 그것을 다 보여 준 뒤 팀 소개로 넘어간다.
     그 3D 상자는 예전 이스터에그에 있던 것이다. 그때는 모델이 10.4MB 라 다 받기 전에
     연출이 끝났는데, 알고 보니 dev 서버가 뻗어 파일 하나에 5초를 쓰고 있었다 — 지금은
     같은 파일이 0.04초에 온다. 그래도 처음 받는 사람을 위해 **마우스를 올릴 때 미리 받는다.**
   ★ 벗기기·뒤집기·날아오기·먼지·먹물·구겨진 종이까지 만들어 봤다가 전부 걷어냈다.
     남은 것은 **상자가 열리고 돼지가 나오는 것** 하나다. 덧씌운 연출은 하나같이 그
     장면을 가렸다 — 볼 것이 이미 있는데 그 위에 또 무언가를 얹을 이유가 없었다.

   ★ **BGM 은 상자를 누르는 그 순간 튼다** (사용자 요청 — 화면이 나오기 전에 미리 들리게).
     클릭 핸들러가 브라우저에서 소리를 허락받는 유일한 자리라 여기서 틀면 반드시 난다.
   ⚠️ 그런데 주소를 바꿔 넘어가면 문서가 갈려 그 소리가 끊긴다. 그래서 **재생 위치를 함께
      넘긴다**(`?t=`). 넘어간 페이지가 그 지점부터 이어 틀면, 두 문서에 걸쳐 한 곡으로
      들린다 — 같은 파일이라 이미 캐시에 있어 다시 받지도 않는다.
   ⚠️ 그쪽에서 자동재생이 막힐 수 있다. **성공했을 때만** '이미 틀었다' 로 표시해 두었다 —
      막히면 원래 있던 '첫 클릭에 켜기' 가 그대로 받는다. 순서를 뒤집으면 막힌 뒤에도 켜진
      줄 알고 영영 안 튼다.
   ⚠️ 트럭을 x=2 부터 그린다. 예전에는 운전석을 x=-1 에 두어 **앞이 잘려 보였다**
      (사용자 지적) — 화면 밖으로 나간 부분은 잘린 것이지 원근이 아니다.
   ═══════════════════════════════════════════════════════════════════════════ */

/** 그림 한 칸(px). 이 값의 배수로만 그려야 픽셀 그림으로 보인다 */
const U = 6;
const W = 78 * U;
const H = 54 * U;

/** 좀비가 든 상자의 뚜껑이 젖혀지는 시간(ms) — 3D 상자가 뜨는 신호다 */
const OPEN_MS = 200;
/* ── 넘어가는 연출 ─────────────────────────────────────────────────────────
   ★ 3D 마인크래프트 상자와 돼지를 **걷어냈다** (사용자 요청 — 그냥 빼고, 노란 화면
     나온 다음 번쩍하는 느낌으로 바로 팀 소개로).
   ★ 남은 것은 세 박자뿐이다 — 금빛이 차오르고 · 번쩍하고 · 넘어간다.
     상자를 띄우던 때는 10.4MB 모델을 기다려야 해서 타이밍이 그때그때 달랐는데,
     이제 기다릴 것이 없어 **항상 같은 속도**로 넘어간다. 시연에서는 그게 낫다.
   ⚠️ 합이 곧 클릭에서 다음 화면까지의 시간이다. 늘리면 그만큼 멍하니 기다린다. */
/** 금빛이 화면을 채우는 시간(ms) */
const GOLD_MS = 320;
/** 흰빛이 번쩍하는 시간(ms) — 짧아야 "번쩍" 이지, 길면 그냥 흰 화면이다 */
const FLASH_MS = 180;

/** 상자를 열면 **이 페이지로 아예 넘어간다** (사용자 요청).
 *
 * ★ iframe 으로 덮지 않는다. 발표가 이 뒤로도 HTML 로 이어지므로(소개 다음 장), 앱 안에
 *   가둬 두면 그다음 장으로 넘어갈 길이 없다. 주소를 바꿔 **화면을 통째로 넘긴다** —
 *   전체 화면이 되고, 그다음은 그쪽 HTML 이 알아서 이어 간다.
 * ⚠️ 넘어간 뒤에는 이 앱의 소리가 남지 않는다(문서가 바뀐다). 그래서 여기서 곡을 틀지
 *    않고, **소개 페이지가 제 곡을 켜게** 둔다 — 그 페이지에 뜨자마자 트는 코드를 넣어
 *    두었다(`public/team5/index.html`). 여기서 틀면 0.9초 뒤 이동하며 잘려 더 어색하다. */
const TEAM_URL = "/team5/index.html";
/** 상자를 누르는 그 순간 트는 곡. 넘어갈 페이지가 쓰는 것과 **같은 파일**이다 */
/* ★ 팀 소개 화면이 트는 것과 **같은 파일**이어야 한다 (사용자 지적 — 노래가 렉걸린다).
     예전에는 여기만 `bgm-highlight.mp3` 를 봤는데, 넘어간 쪽은 `bgm.mp3` 를 본다.
     내용은 같아도 **주소가 다르면 캐시가 따로**라, 화면이 바뀌는 순간 134KB 를 처음부터
     다시 받았다. 곡이 이어지는 그 자리에서 정확히 끊긴 이유다. */
const BGM_SRC = "/team5/assets/bgm.mp3";

/* CJ 색 — 로고에서 뽑은 값 (`shell.tsx` 의 BrandMark 와 같다) */
const CJ_BLUE = "#003087";
const CJ_MID = "#0A3F9E";
const CJ_DARK = "#00205C";

/* 마인크래프트 좀비 — 받은 이미지에서 **픽셀을 세어 뽑은 색**이다 (사용자 요청).
   눈으로 고른 초록이 아니라 그 스킨의 색이라, 아는 사람은 바로 알아본다.
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

/* 소개 페이지에서 그대로 가져온 금빛 — 전환이 그 화면의 바탕색으로 이어지게 한다 */
const GOLD = "#c9a458";
const GOLD_LIGHT = "#ffe08a";

type Phase = "idle" | "gold" | "flash";

/** 픽셀 한 덩어리 */
function P({ x, y, w, h, fill, opacity }: {
  x: number; y: number; w: number; h: number; fill: string; opacity?: number;
}) {
  return <rect x={x * U} y={y * U} width={w * U} height={h * U} fill={fill} opacity={opacity} />;
}

export function TruckDock() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [hover, setHover] = useState(false);
  const opening = phase !== "idle";
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /* 뚜껑이 열렸나. 열린 뒤부터 돼지를 보여 줄 시간을 센다 */




  /** 지금 흐르고 있는 재생 위치를 달고 넘어간다 — 넘어간 쪽이 그 지점부터 이어 튼다 */
  const goTeam = useCallback(() => {
    let at = 0;
    try { at = audioRef.current?.currentTime ?? 0; } catch { /* 읽기만 실패 */ }
    /* ⚠️ `router.push` 가 아니라 **주소를 직접 바꾼다.** 이 주소는 Next 라우트가 아니라
       `public/` 에 그대로 놓인 정적 HTML 이라, 클라이언트 라우팅으로는 못 간다.
       eslint 규칙이 내부 링크를 라우터로 보내라고 하지만 여기는 해당이 없다. */
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `${TEAM_URL}?t=${at.toFixed(2)}`;
  }, []);

  /* ★ 마우스를 올린 순간 **다음 페이지를 미리 받아 둔다** (사용자 지적 — 이동이 느리다).
       금빛이 덮이는 0.2초 안에 넘어가야 하는데, 그때 배경 그림(355KB)과 글꼴을 처음부터
       받으면 금빛 화면이 멍하니 남는다. 누르기 직전에 받아 두면 이동이 즉시다.
     ⚠️ 화면이 뜰 때 받지 않는다. 이스터에그 하나 때문에 모두가 그 값을 치를 이유가 없다.
     ⚠️ 한 번만 받는다. `ref` 로 표시해 둔다 — 상태로 두면 다시 그려지며 또 부른다. */
  const warmed = useRef(false);
  const warm = useCallback(() => {
    if (warmed.current) return;
    warmed.current = true;
    /* ⚠️ 마인크래프트 상자 모델(10.4MB)을 **뺐다** (사용자 지적 — 노래가 렉걸린다).
          연출에서 상자를 걷어냈는데 미리 받는 목록에는 남아 있어서, 마우스를 올리는
          순간 10MB 를 받느라 정작 필요한 음악·배경이 뒤로 밀렸다. */
    for (const u of [TEAM_URL, "/team5/assets/bg.jpg", "/team5/assets/quest-serif.woff", BGM_SRC]) {
      void fetch(u).catch(() => undefined);
    }
  }, []);

  /* 금빛 → 번쩍 → 이동. 한 단계씩만 예약한다 — 한 번에 다 걸어 두면 도중에 멈출 수 없다 */
  useEffect(() => {
    if (phase === "gold") {
      const t = window.setTimeout(() => setPhase("flash"), GOLD_MS);
      return () => window.clearTimeout(t);
    }
    if (phase === "flash") {
      /* ⚠️ 번쩍이 **가장 밝을 때** 넘긴다. 다 사그라든 뒤에 넘기면 금빛 화면이 한 번 더
         비쳤다가 바뀌어서, 번쩍이 전환을 가려 주지 못하고 따로 논다. */
      const t = window.setTimeout(goTeam, FLASH_MS);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [phase, goTeam]);

  const openBox = useCallback(() => {
    warm();
    /* ⚠️ "동작 줄이기" 를 켠 사용자에게는 빛·전환을 밀어붙이지 않는다. 그래도 소개는
       봐야 하므로 연출만 건너뛰고 바로 넘긴다. */
    /* ⚠️ **여기서 튼다.** 이 함수가 클릭 핸들러라 브라우저가 소리를 허락하는 유일한
       자리다 — 한 단계라도 미루면(setTimeout·화면 전환 뒤) 막힌다.
       ⚠️ 다 차려 놓고 **마지막에** 손잡이에 넣는다. ref 에서 꺼낸 값을 고치면 lint 가
          막는다(`react-hooks/immutability`) — 순서만 바꾸면 될 일이다. */
    try {
      const a = new Audio(BGM_SRC);
      a.loop = true;
      a.volume = 0.75;
      void a.play().catch(() => undefined);
      audioRef.current = a;
    } catch { /* 소리는 없어도 그만 */ }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      goTeam();
      return;
    }
    setPhase("gold");
  }, [goTeam, warm]);









  /* ⚠️ **가운데**에 놓는다. 오른쪽 아래에 뒀더니 창을 끌어 내렸을 때 그 자리가 바로 창에
     가려져 아무것도 안 보였다 (사용자 지적). 이 이스터에그는 창을 치워야 보이는 물건이라,
     창이 비켜난 자리에 서 있어야 한다. */
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        shapeRendering="crispEdges"
        className="pointer-events-auto select-none"
        aria-hidden
      >

        {/* ── 바닥 — 야적장 아스팔트에 노란 주차선 ── */}
        <P x={0} y={40} w={78} h={14} fill="#39404A" />
        <P x={0} y={40} w={78} h={1} fill="#4C5560" />
        <P x={0} y={41} w={78} h={1} fill="#333A43" />
        {[4, 22, 40, 58].map((x) => (
          <P key={x} x={x} y={47} w={9} h={1} fill="#C8A21E" opacity={0.55} />
        ))}
        {/* 그림자 — 트럭과 피글린이 바닥에 붙어 보이게 한다 */}
        <P x={4} y={40} w={42} h={1} fill="#22272E" opacity={0.55} />
        <P x={50} y={40} w={13} h={1} fill="#22272E" opacity={0.5} />

        {/* ═══ 트럭 ═══════════════════════════════════════════════
            차체가 왼쪽, 뒷문이 오른쪽이다. 피글린이 그 뒷문에서 내려 선다 */}
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
            ★ **머리를 크게** 잡은 2등신이다 (사용자 지적 — 사람 비율로 그렸더니 징그럽다).
              같은 색·같은 옷이라도 머리가 전체의 40%를 넘으면 무서운 것이 귀여워진다.
              도트 캐릭터가 귀여운 이유는 색이 아니라 비율이다.
            ⚠️ 눈을 **움푹 팬 검은 띠에서 동그란 점으로** 바꿨다. 원래 좀비 스킨의 그 띠가
               징그러움의 대부분이었다. 흰 반짝임을 한 칸 넣으면 눈이 살아 있는 것으로
               보인다 — 그 한 칸이 없으면 단추다.
            ⚠️ 팔을 앞으로 뻗은 채 둔다. 좀비의 그 자세가 마침 상자를 받쳐 드는 자세다.
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

        {/* 상자에서 위로 솟는 빛 — 뚜껑이 열리는 동안만 짧게 */}
        {opening && (
          <g style={{ animation: `td-ray ${OPEN_MS}ms ease-out forwards`, transformOrigin: `${56 * U}px ${29 * U}px` }}>
            <polygon
              points={`${54.4 * U},${29 * U} ${57.6 * U},${29 * U} ${64 * U},${-2 * U} ${48 * U},${-2 * U}`}
              fill={GOLD_LIGHT}
              opacity={0.5}
            />
            <polygon
              points={`${55.2 * U},${29 * U} ${56.8 * U},${29 * U} ${59 * U},${-2 * U} ${53 * U},${-2 * U}`}
              fill="#FFFFFF"
              opacity={0.85}
            />
          </g>
        )}

        {/* ═══ 상자 (누르는 자리) ═══════════════════════════════════
            ⚠️ 클릭 판을 그림보다 넉넉하게 잡는다. 픽셀 그림 그대로면 모서리에서 자꾸
               빗나가는데, 이스터에그는 찾기 어려운 것이지 누르기 어려운 것이 아니다. */}
        <g
          onClick={openBox}
          onPointerEnter={() => { setHover(true); warm(); }}
          onPointerLeave={() => setHover(false)}
          style={{ cursor: "pointer" }}
          role="button"
          tabIndex={0}
          aria-label="상자 열기 — 팀 소개"
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openBox(); }}
        >
          <rect x={45 * U} y={25 * U} width={22 * U} height={14 * U} fill="transparent" />

          {/* 뚜껑 — 열리면 뒤로 젖혀진다 */}
          <g
            style={{
              transformOrigin: `${56 * U}px ${29 * U}px`,
              transform: opening ? "rotate(-104deg)" : "none",
              transition: `transform ${OPEN_MS}ms cubic-bezier(.34,1.3,.64,1)`,
            }}
          >
            <P x={48} y={27} w={16} h={2} fill="#D8B98A" />
            <P x={48} y={29} w={16} h={1} fill="#B8965F" />
          </g>

          {/* 몸통 */}
          <P x={48} y={29} w={16} h={9} fill={hover ? "#D2A874" : "#C9A16B"} />
          <P x={48} y={29} w={16} h={1} fill="#E0BE8C" />
          <P x={48} y={37} w={16} h={1} fill="#A47F4C" />
          {/* 골판지 결 */}
          {[50, 54, 58, 62].map((x) => (
            <P key={x} x={x} y={31} w={1} h={6} fill="#B8905C" opacity={0.45} />
          ))}
          {/* 오네 표시 */}
          <P x={49} y={32} w={5} h={4} fill="#FFFFFF" opacity={0.92} />
          <P x={50} y={33} w={3} h={1} fill="#2E9BFF" />
          <P x={50} y={34} w={2} h={1} fill="#1B5CE0" />

          {/* ★ 금빛 실틈 — 누르기 전에도 "저 안에 뭔가 있다" 가 읽히게 하는 신호.
                이스터에그가 **찾을 수 있는** 것이 되려면 이런 표가 하나는 있어야 한다 */}
          {!opening && (
            <g style={{ animation: "td-hint 2.4s ease-in-out infinite" }}>
              <P x={49} y={29} w={14} h={1} fill={GOLD_LIGHT} />
              <P x={51} y={30} w={3} h={1} fill={GOLD} opacity={0.7} />
              <P x={58} y={30} w={3} h={1} fill={GOLD} opacity={0.7} />
            </g>
          )}
          {hover && <P x={47} y={26} w={18} h={13} fill={GOLD_LIGHT} opacity={0.14} />}
        </g>
      </svg>

      {/* ── 금빛이 화면을 채운다 ──
          ★ 검은 암전이 아니다. 다음 화면(원정대 두루마리)이 금빛 양피지라, 그 색으로 덮으면
            장면이 끊기지 않고 **그대로 이어진다** (사용자 지적 — 연결이 어색하다).
          ⚠️ `pointerEvents: none` — 덮개일 뿐이라 클릭을 먹으면 안 된다. */}
      {/* ── 금빛이 화면을 채운다 ──
          ⚠️ 검은 암전이 아니다. 다음 화면(원정대 두루마리)이 금빛이라 이 색으로 덮으면
             장면이 끊기지 않고 그대로 이어진다.
          ⚠️ 상자에서 퍼져 나가듯 **가운데가 밝다**. 통짜 한 색이면 화면에 판을 덮은
             것으로 보이지, 상자에서 빛이 터진 것으로 안 보인다. */}
      {opening && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9998, pointerEvents: "none",
            background: `radial-gradient(circle at 50% 52%, ${GOLD_LIGHT} 0%, #f0cf86 46%, ${GOLD} 100%)`,
            animation: `td-gold ${GOLD_MS}ms ease-in forwards`,
            opacity: 0,
          }}
        />
      )}

      {/* ── 번쩍 ──
          ⚠️ 흰빛이 **차오르지 않고 곧바로 최대**로 뜬다. 서서히 밝아지면 번쩍이 아니라
             화면이 하얘지는 것이다. 그 정점에서 페이지가 바뀐다. */}
      {phase === "flash" && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none", background: "#FFFFFF",
            animation: `td-flash ${FLASH_MS}ms ease-out forwards`,
          }}
        />
      )}

      <style>{`
        @keyframes td-hint  { 0%,100% { opacity: .35 } 50% { opacity: 1 } }
        @keyframes td-ray   { 0% { transform: scaleY(0) scaleX(.4); opacity: 0 }
                              100% { transform: scaleY(1) scaleX(1); opacity: 1 } }
        @keyframes td-gold  { 0% { opacity: 0 } 70% { opacity: 1 } 100% { opacity: 1 } }
        @keyframes td-flash { 0% { opacity: .85 } 35% { opacity: 1 } 100% { opacity: .9 } }
      `}</style>
    </div>
  );
}
