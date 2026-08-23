"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * 고정 스테이지 — 1600×1004 캔버스를 뷰포트 폭에 맞춰 **축소만** 한다.
 *
 * 디자인 확정본(design.html)이 문서 맨 아래 <script> 로 하던 fit() 을 그대로 옮긴 것이다.
 * 원본:
 *   var s = Math.min(1, (document.documentElement.clientWidth - 24) / 1600);
 *   stage.style.transform = 'scale(' + s + ')';
 *   frame.style.width  = Math.round(1600 * s) + 'px';
 *   frame.style.height = Math.round(1004 * s) + 'px';
 *
 * ── 왜 frame 의 크기까지 JS 로 잡아 주나 ────────────────────────────────────
 * transform: scale() 은 **그리기만** 줄이고 요소가 차지하는 레이아웃 박스는
 * 1600×1004 그대로 남긴다. 그래서 스테이지만 축소하면 그 아래로 1600px 짜리
 * 가로 스크롤과 1004px 짜리 빈 세로 공간이 그대로 남는다.
 * 축소된 실제 크기(1600×s, 1004×s)를 감싸는 frame 에 직접 박아 넣어야
 * 레터박스 여백이 정확히 맞고 페이지가 밀리지 않는다.
 *
 * ── 왜 Math.min(1, ...) 인가 ───────────────────────────────────────────────
 * 축소만 하고 확대는 하지 않는다. 1600px 보다 넓은 화면에서 캔버스를 늘리면
 * 2px 테두리가 3~4px 로 두꺼워지고 글자도 같이 불어나 브루탈리즘 룩이 뭉갠다.
 * 넓은 화면에서는 원본 크기 그대로 두고 좌우에 레터박스를 남기는 쪽이 맞다.
 *
 * ── 폭뿐 아니라 높이도 본다 — 원본 fit() 과 다른 유일한 지점 ───────────────
 * 원본 design.html 의 fit() 은 **폭만** 본다. 그건 원본이 위아래로 스크롤되는
 * 데모 페이지라서 스테이지가 화면보다 길어도 스크롤해서 보면 그만이기 때문이다.
 * 우리는 전제가 다르다 — app/layout.tsx 가 "화면 전체가 항상 보인다"를 근거로
 * 본문 스크롤을 없앴다. 폭만 보면 그 근거가 거짓이 된다:
 *   1366x768 뷰포트에서 폭 기준 scale 은 0.839 라 스테이지 높이가 842px 이 되는데
 *   쓸 수 있는 높이는 744px 뿐이라 아래 98px 이 그냥 잘린다. 16:9 모니터
 *   (1366x768 / 1440x900 / 1920x1080)에서 브라우저 크롬까지 빼면 전부 잘린다.
 *   팀이 개발·시연에 쓰는 화면이 정확히 그 부류다.
 * 그래서 min() 에 높이 항을 하나 더 넣어 **폭과 높이 중 더 빡빡한 쪽**에 맞춘다.
 * 대가는 넓고 낮은 화면에서 좌우 레터박스가 생긴다는 것이다(예: 1920x950 뷰포트면
 * 높이가 먼저 걸려 스테이지가 1475px 폭으로 축소되고 좌우에 여백이 남는다).
 * 잘려서 안 보이는 것보다 여백이 낫다 — 이 트레이드오프는 확인받고 택했다.
 *
 * 부수 효과로 세로 스크롤바 진동도 사라진다. 이전에는 폭만 봤기 때문에
 * 스테이지 높이가 뷰포트보다 아주 조금 큰 구간(뷰포트 폭 ~1600, 높이 ~1020 부근)에서
 * "세로 스크롤바 등장 -> clientWidth 감소 -> 축소 -> 넘침 해소 -> 스크롤바 소멸 ->
 * 다시 확대" 가 반복됐다. 이제 scale 이 (clientHeight - 24) / 1004 이하로 묶이므로
 * 문서 전체 높이가 clientHeight 를 넘지 않아 세로 스크롤바 자체가 생기지 않는다
 * (body 상하 padding 12px + 12px = 24px 을 빼 둔 것이 정확히 그 계산이다).
 * 아래 fit() 안에서 clientWidth 를 쓰는 이유와 같은 종류의 문제였다.
 *
 * ── 첫 페인트의 깜빡임에 대하여 ────────────────────────────────────────────
 * 서버에서는 뷰포트 폭을 알 수 없으므로 SSR HTML 은 scale 없이(=1) 나가고,
 * 하이드레이션 직후 이 useEffect 가 첫 fit() 을 돌린다. 좁은 화면에서는 그 사이
 * 한 프레임 정도 원본 크기로 보였다가 줄어든다. 원본 design.html 도 같은 구조이고
 * (문서 끝 <script>), 이걸 없애려면 <head> 에 blocking inline script 를 넣어야 한다 —
 * 사내 터미널 화면이라 그 정도 비용을 들일 이유가 없다고 봤다.
 * 대신 frame 에 overflow-hidden 을 걸어 두어, 그 한 프레임 동안에도 넘친 부분이
 * 페이지 전체 가로 스크롤을 만들지는 않게 했다.
 */

/** 디자인 확정본의 캔버스 크기. 이 값이 바뀌면 app/layout.tsx 의 본문 영역 치수도 같이 바뀐다 */
const STAGE_WIDTH = 1600;
const STAGE_HEIGHT = 1004;

/** 레터박스 여백 — app/layout.tsx 의 body padding(12px)과 반드시 같아야 한다.
    상하좌우가 같은 값이라 폭 계산과 높이 계산에 똑같이 2배로 들어간다.
    원본 fit() 의 `clientWidth - 24` 가 이 값의 좌우 합이다. */
const BODY_PADDING = 12;

/* ── 스테이지 사각형을 CSS 변수로 공개한다 ─────────────────────────────────
   스테이지 밖에 있으면서 **스테이지 기준**으로 자리를 잡아야 하는 요소가 있다.
   지금은 토스트가 그렇다: 축소되면 안 되니 스테이지 밖에 두는데(app/layout.tsx 의
   Toaster 주석 참고), "화면 중앙"의 기준은 뷰포트가 아니라 작업자가 보고 있는
   스테이지 중앙이어야 한다. 레터박스가 좌우 400px 넘게 남는 화면에서는 둘이 크게 다르다.

   ⚠️ 실제로 어긋나는 축은 **세로**다. frame 이 mx-auto 라 가로는 뷰포트 중앙과
      스테이지 중앙이 일치하지만, 세로는 body 가 위쪽부터 채우므로 폭이 scale 을
      결정하는 화면에서 스테이지 아래에 빈 공간이 남는다. 그래도 네 값을 다 내보내는 건
      "가로는 어차피 같다"는 가정이 바깥 레이아웃 변경에 조용히 깨지기 때문이다.

   값을 <html> 에 얹으므로 소비자는 순수 CSS 로 계산할 수 있고, 컨텍스트나 클라이언트
   컴포넌트를 하나 더 만들 필요가 없다(Toaster 는 app/layout.tsx 안에 그대로 둔다).
   하이드레이션 전에는 변수가 없으므로 소비자는 반드시 var(..., 폴백) 형태로 써야 한다. */
const STAGE_RECT_VARS = {
  left: "--stage-left",
  top: "--stage-top",
  width: "--stage-width",
  height: "--stage-height",
} as const;

/* ── 포탈 목적지 ─────────────────────────────────────────────────────────────
   Radix 의 Dialog/Select 는 내용을 포탈로 body 직속에 붙인다. 그런데 스테이지는
   transform: scale() 로 축소돼 있으므로, body 에 붙은 오버레이는 **축소가 안 걸린 채**
   100% 크기로 그려진다. 1180px 화면(scale 0.72)에서 드롭다운 글자가 뒤 화면보다 약 20%
   크고, 테두리도 2px vs 1.4px 로 달라 브루탈리즘 격자가 어긋난다.
   디자인 확정본도 수동 입력 팝업을 스테이지 **안**에 두므로, 포탈 목적지를 스테이지
   엘리먼트로 지정해 오버레이도 같이 축소되게 한다.

   ⚠️ ref 가 아니라 state 로 들고 있는 이유: ref 는 값이 채워져도 재렌더를 일으키지 않아
      컨텍스트 소비자가 계속 null 을 보게 된다. ref 콜백에 setState 를 그대로 넘겨
      DOM 노드가 붙는 커밋에서 한 번 재렌더시킨다.

   ⚠️ null 인 구간이 존재한다 — 서버 렌더와, 클라이언트 첫 렌더(ref 콜백 커밋 전)다.
      이때 Radix 는 container 가 없으면 document.body 로 폴백하므로 깨지지는 않는다.
      Dialog/Select 내용은 열려야 마운트되고 여는 건 사용자 입력이라, 실제로는 언제나
      하이드레이션이 끝난 뒤 = stage 가 채워진 뒤에 붙는다.
      예외는 `defaultOpen` 처럼 첫 페인트부터 열려 있는 경우다. 그때는 body 로 먼저 붙었다가
      stage 가 채워지는 순간 container 가 바뀌면서 포탈이 **한 번 리마운트**된다
      (React 의 createPortal 은 container 가 바뀌면 서브트리를 다시 만든다).
      지금 화면 3개 중 defaultOpen 을 쓰는 곳은 없어서 실사용 경로는 아니다.

   ⚠️ Toaster 는 일부러 이 배선에서 제외했다(app/layout.tsx 에서 스테이지 밖에 둔다).
      알림은 화면 축소와 무관하게 항상 원본 크기로 읽혀야 한다. */
const StageContainerContext = createContext<HTMLElement | null>(null);

/**
 * 포탈(Dialog/Select 등)이 붙어야 할 스테이지 DOM 노드.
 * FixedStage 바깥이거나 아직 마운트 전이면 null 이고, 이때 Radix 는 body 로 폴백한다.
 */
export function useStageContainer(): HTMLElement | null {
  return useContext(StageContainerContext);
}

export function FixedStage({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  // 같은 DOM 노드를 state 로도 들고 있는다 — 위 ⚠️ 참고(ref 만으로는 컨텍스트 소비자가
  // 재렌더를 못 받는다). 조작은 stageRef 로, 배포는 stageEl 로 역할을 나눈다.
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);

  // ref 콜백은 반드시 안정적이어야 한다. 매 렌더마다 새 함수를 넘기면 React 가
  // 떼었다 붙이면서 setStageEl(null) -> 재렌더 -> 다시 부착 이 반복된다.
  const attachStage = useCallback((node: HTMLDivElement | null) => {
    stageRef.current = node;
    setStageEl(node);
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    const stage = stageRef.current;
    // stageEl 은 "스테이지 노드가 붙은 뒤 이 이펙트를 다시 돌린다"는 트리거 역할이고,
    // 실제 조작 대상은 stageRef.current 다. 둘은 같은 노드를 가리킨다 —
    // state 값의 속성을 직접 쓰면 react-hooks/immutability 가 (당연히) 막는다.
    if (frame === null || stage === null || stageEl === null) return;

    const fit = () => {
      // window.innerWidth/innerHeight 가 아니라 documentElement.client* 를 쓰는 이유:
      // inner* 는 스크롤바 두께를 포함해서, 스크롤바가 생기는 순간
      // "축소 → 스크롤바 사라짐 → 확대 → 스크롤바 생김" 진동이 일어난다.
      const root = document.documentElement;
      const scale = Math.min(
        1, // 확대 금지
        (root.clientWidth - BODY_PADDING * 2) / STAGE_WIDTH,
        (root.clientHeight - BODY_PADDING * 2) / STAGE_HEIGHT, // 잘림 금지 — 위 주석 참고
      );
      stage.style.transform = `scale(${scale})`;
      frame.style.width = `${Math.round(STAGE_WIDTH * scale)}px`;
      frame.style.height = `${Math.round(STAGE_HEIGHT * scale)}px`;

      // 축소된 스테이지가 화면에서 실제로 차지하는 사각형을 CSS 변수로 내보낸다.
      // 스테이지 **밖**에 있으면서 스테이지 기준으로 자리를 잡아야 하는 것들
      // (지금은 토스트)이 이 값을 쓴다. 자세한 건 위 STAGE_RECT_VARS 주석 참고.
      // 프레임을 직접 재는 이유: 위 계산을 다시 해서 맞추면 body padding·mx-auto 같은
      // 바깥 레이아웃이 바뀔 때 조용히 어긋난다. 실측이 스스로 교정된다.
      const rect = frame.getBoundingClientRect();
      root.style.setProperty(STAGE_RECT_VARS.left, `${rect.left}px`);
      root.style.setProperty(STAGE_RECT_VARS.top, `${rect.top}px`);
      root.style.setProperty(STAGE_RECT_VARS.width, `${rect.width}px`);
      root.style.setProperty(STAGE_RECT_VARS.height, `${rect.height}px`);
    };

    fit();
    window.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
      // 스테이지가 사라지면 변수도 걷는다. 남겨 두면 스테이지 없는 화면에서
      // 옛날 좌표를 참조하는 요소가 엉뚱한 자리에 붙는다.
      const root = document.documentElement;
      for (const name of Object.values(STAGE_RECT_VARS)) root.style.removeProperty(name);
    };
  }, [stageEl]);

  return (
    <div ref={frameRef} className="mx-auto overflow-hidden">
      <div
        ref={attachStage}
        // origin-top-left: 축소 기준점이 가운데(기본값)면 frame 에 박아 둔 크기와
        // 어긋나 위쪽이 잘린다. 좌상단 고정이라야 frame 크기 계산과 정확히 맞는다.
        // shadow: 원본 custom.css 의 `box-shadow:0 2px 24px rgba(0,0,0,.28)` 그대로 —
        // 레터박스 회색 위에서 스테이지가 "장비 화면"처럼 떠 보이게 한다.
        className="bg-background relative h-[1004px] w-[1600px] origin-top-left overflow-hidden shadow-[0_2px_24px_rgba(0,0,0,0.28)]"
      >
        <StageContainerContext.Provider value={stageEl}>{children}</StageContainerContext.Provider>
      </div>
    </div>
  );
}
