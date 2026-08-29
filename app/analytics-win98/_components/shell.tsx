"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clock as ClockIcon,
  LayoutGrid,
  Minus,
  Server,
  Square,
  Terminal,
  X,
} from "lucide-react";
import { CaveEntrance } from "./cave-entrance";
import { ClockWindow } from "./clock-window";
import { w98, Btn, Etched, TrayBox } from "./win98-ui";
import { Minesweeper } from "@/components/common/minesweeper";

/**
 * 데스크톱 셸 — 목업 HTML 의 header / main / footer 세 덩어리를 그대로 옮긴 것이다.
 *
 *   상단 28px  네이비 타이틀바 + 최소화·최대화·닫기 버튼
 *   가운데     청록 바탕 위에 창 하나(타이틀바 + 좌측 네비 + 본문)
 *   하단 28px  태스크바 — Start · 실행 중인 창 탭 · 시스템 트레이
 *
 * ★ 태스크바의 "실행 중인 창 탭"이 **실제 화면 전환**이다 (판단).
 *   목업에서는 `System Main` 하나가 장식으로 눌려 있었는데, 우리는 화면이 둘이라
 *   그 자리가 그대로 네비게이션이 된다 — win98 에서 창을 오가는 방식 그 자체이고,
 *   장식을 기능으로 바꾼 것이라 목업의 생김새를 하나도 잃지 않는다.
 *
 * ⚠️ 최소화·최대화·닫기와 Start 는 **동작이 없다.** 목업에 있으니 자리는 만들지만
 *    창 관리 기능이 명세에 없다. disabled + aria-hidden + cursor-default 로 두는 것은
 *    앱 공용 헤더(app/layout.tsx)가 같은 상황에서 쓰는 처리 그대로다 —
 *    없는 기능을 있는 것처럼 만들지 않는다.
 *
 * ⚠️ 아이콘 — 목업은 Material Symbols 를 쓰지만 next/font/google 에 그 폰트가 없어
 *    self-host 가 불가능하다(app/layout.tsx 에 같은 사정이 적혀 있다). 기존 의존성인
 *    lucide-react 로 대응시켰고, 목업의 심볼 이름을 각 줄 끝에 적어 뒀다.
 */

type Screen = {
  href: string;
  /** 좌측 네비·태스크바에 보이는 이름 (목업이 영문이라 영문을 쓴다) */
  label: string;
  /** 창 타이틀바에 뜨는 이름 */
  windowTitle: string;
  /** 목차·태스크바에 그릴 아이콘. 아래 픽셀 아이콘 셋 참고 */
  icon: (props: { className?: string }) => ReactNode;
  /**
   * 목차와 태스크바에서 **감춘다.** 목록에서 아예 빼지 않는 이유가 있다 — 이 배열은
   * 지금 어느 화면인지(`active`)와 창 제목을 찾는 데도 쓰인다. 빼 버리면 그 주소로 직접
   * 들어왔을 때 첫 화면으로 잘못 짚어, 창고 화면이 "INBOUND" 라는 제목을 달고 뜬다.
   */
  hidden?: boolean;
};

/* ── 목차 아이콘 ─────────────────────────────────────────────────────────────
   lucide 의 가는 선 아이콘 → **win98 픽셀 아이콘**으로 바꿨다 (사용자 요청, 95/98 기본
   아이콘 세트를 참고).

   ★ 이미지 파일이 아니라 **16×16 격자 위의 SVG** 로 그린다. 이유는 두 가지다:
     ① 이 화면은 스테이지 전체가 `transform: scale()` 로 늘어난다. 비트맵 아이콘을 쓰면
        배율이 딱 정수가 아닐 때 가장자리가 흐려지는데, 도형은 배율과 무관하게 또렷하다.
     ② 같은 아이콘을 목차(28px)와 태스크바(12px) 두 크기로 쓴다. 파일이면 두 벌이 필요하다.
   ★ `shapeRendering="crispEdges"` — 안티에일리어싱을 끈다. 이게 없으면 픽셀 아이콘이
     아니라 그냥 작은 벡터 그림이 된다. 계단이 살아 있어야 그 시절 아이콘으로 보인다.
   ★ 색은 win98 팔레트를 따른다: 골판지 갈색 두 톤, 네이비, 자주, 청록. 선은 전부 순검정
     1px 이다 — 그 시절 아이콘은 모두 검정 외곽선을 둘렀다.
   ⚠️ 좌표를 전부 정수로 둔다. 반 픽셀이 섞이면 crispEdges 가 어느 쪽으로 반올림할지
      브라우저마다 달라 선 굵기가 들쭉날쭉해진다. */

/** 입고 — 상자 안으로 들어가는 화살표 */
function InboundIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={className} aria-hidden>
      <path d="M6 1h4v5h2L8 10 4 6h2z" fill="#1a7a1a" stroke="#000000" />
      <path d="M1 11h14v4H1z" fill="#c8a06a" stroke="#000000" />
      <path d="M2 11h12v1H2z" fill="#e8d0a0" />
    </svg>
  );
}

/** 출고 포장 — 테이프로 봉한 상자 */
function PackingIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={className} aria-hidden>
      <path d="M2 5h12v10H2z" fill="#c8a06a" stroke="#000000" />
      <path d="M2 5l2-3h8l2 3z" fill="#e8d0a0" stroke="#000000" />
      <path d="M7 2h2v13H7z" fill="#f2ece0" stroke="#8a7318" />
    </svg>
  );
}

/** 분석 — 막대 그래프 */
function AnalyticsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={className} aria-hidden>
      <path d="M2 2v12h13" fill="none" stroke="#000000" />
      <path d="M4 9h2v5H4z" fill="#000080" stroke="#000000" />
      <path d="M7 6h2v8H7z" fill="#a000a0" stroke="#000000" />
      <path d="M10 3h2v11h-2z" fill="#008080" stroke="#000000" />
    </svg>
  );
}

/** 창고 — 선반 3단에 상자가 얹힌 모습 */
function WarehouseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={className} aria-hidden>
      {/* 선반 기둥 둘 + 칸 셋 */}
      <path d="M2 2h1v12H2z" fill="#8a7318" stroke="#000000" />
      <path d="M13 2h1v12h-1z" fill="#8a7318" stroke="#000000" />
      <path d="M2 6h12v1H2z" fill="#8a7318" stroke="#000000" />
      <path d="M2 10h12v1H2z" fill="#8a7318" stroke="#000000" />
      {/* 칸마다 놓인 상자 */}
      <path d="M4 3h3v3H4z" fill="#c8a06a" stroke="#000000" />
      <path d="M9 4h3v2H9z" fill="#c8a06a" stroke="#000000" />
      <path d="M4 8h4v2H4z" fill="#c8a06a" stroke="#000000" />
      <path d="M10 7h3v3h-3z" fill="#c8a06a" stroke="#000000" />
    </svg>
  );
}

const SCREENS: Screen[] = [
  {
    href: "/inbound-win98",
    label: "Inbound",
    windowTitle: "INBOUND REGISTRATION — 입고 등록",
    icon: InboundIcon, // 목업: inventory_2
  },
  {
    href: "/packing-win98",
    label: "Packing",
    windowTitle: "OUTBOUND PACKING — 출고 포장",
    icon: PackingIcon, // 목업: desktop_windows
  },
  {
    /* 창고 — 슬롯 점유를 2D 지도와 3D 로 본다.
       ★ **목차에서 뺐다** (사용자 결정). 분석 화면의 실시간 창고 맵을 누르면 같은 3D 가
         전체 화면으로 열리므로, 같은 곳으로 가는 문이 둘일 이유가 없다. 주소로는 그대로
         열린다 — 화면 자체를 지운 것이 아니라 목차에서만 감춘 것이다.
       ⚠️ 이 화면만 three.js 를 쓴다. 3D 판이 `display:none` 일 때도 시뮬레이션은 계속
          돌아야 2D 지도가 실시간이라, 안 보이는 판도 DOM 에 남겨 둔다
          (`_components/warehouse-slot-3d.jsx` 주석 참고). */
    hidden: true,
    href: "/warehouse-win98",
    label: "Warehouse",
    windowTitle: "WAREHOUSE — 슬롯 창고 현황",
    icon: WarehouseIcon,
  },
  {
    /* 분석 — **아직 비어 있는 화면**이다(자리와 생김새만 잡아 둔 뼈대).
       그래도 목록에 넣는 이유: 잠긴 버튼으로 두면 "언젠가 생긴다"는 뜻이 되는데, 실제로는
       이미 열 수 있는 화면이고 안에서 스스로 `준비 중` 이라고 말한다. 그쪽이 정직하다. */
    href: "/analytics-win98",
    label: "Storage",
    windowTitle: "ANALYTICS — 분석",
    icon: AnalyticsIcon, // 목업: analytics
  },
];

export function Win98Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const active = SCREENS.find((screen) => pathname.startsWith(screen.href)) ?? SCREENS[0];

  /** 시계 팝업이 열려 있는가. 태스크바 트레이의 시계를 누르면 토글된다 */
  const [isClockOpen, setIsClockOpen] = useState(false);

  /* 창 위치 — 창을 **진짜 창처럼 끌어서 옮길 수 있게** 한다 (사용자 요청).
     레이아웃은 건드리지 않고 `transform: translate()` 만 얹는다. width/height/left/top 을
     바꾸면 매 프레임 레이아웃이 다시 계산돼 안쪽 표·사진 칸까지 전부 재배치된다
     (UX 규칙 `transform-performance`). */
  const [windowOffset, setWindowOffset] = useState({ x: 0, y: 0 });
  const [isMovingWindow, setIsMovingWindow] = useState(false);
  const moveRef = useRef<{ x: number; y: number } | null>(null);

  return (
    <>
      {/* ── 상단 타이틀바 28px (목업 <header>) ───────────────────────────── */}
      <header
        className={`${w98.titleText} flex h-7 w-full shrink-0 items-center justify-between bg-[color:var(--title-navy)] px-1 text-[color:var(--primary-foreground)] uppercase`}
      >
        <div className="flex items-center gap-2 tracking-wider">
          <Terminal className="size-4" aria-hidden />
          {/* 홈(/)으로 나가는 유일한 출구다 — 이 셸이 앱 공용 헤더를 가리기 때문에
              링크가 없으면 다른 화면으로 갈 길이 막힌다 */}
          <Link href="/" title="시작 화면으로">
            LOGISTICS TERMINAL v1.0
          </Link>
        </div>

        <div className="flex gap-1">
          {[Minus, Square, X].map((Icon, index) => (
            <button
              key={index}
              type="button"
              disabled
              aria-hidden
              className={`${w98.btn} ${w98.raised} flex size-5 cursor-default items-center justify-center`}
            >
              <Icon className="size-3" />
            </button>
          ))}
        </div>
      </header>

      {/* ── 가운데: 청록 바탕 위의 창 (목업 <main>) ────────────────────────
          ⚠️ `overflow-hidden` — 창을 끌어서 밖으로 밀면 바탕(데스크톱) 경계에서 잘린다.
             없으면 옮긴 창이 태스크바·상단바 위로 삐져나온다. 실제 화면 가장자리와 같은 동작이다. */}
      <main className={`${w98.desktop} relative flex min-h-0 w-full flex-1 overflow-hidden p-4`}>
        {/* 바탕화면 이스터에그. 창 뒤에 깔려 있어서 창을 끌어 내려야 보인다.
            ⚠️ 창보다 **먼저** 그린다 — 같은 스태킹 컨텍스트에서는 뒤에 온 형제가 위에 덮인다.
            ⚠️ main 에 `relative` 를 붙인 이유가 이것 하나다(이 절대 배치의 기준점). */}
        <CaveEntrance />

        <div
          className={`${w98.raised} flex min-h-0 w-full flex-col bg-[color:var(--surface)] p-[2px]`}
          style={{
            transform: `translate(${windowOffset.x}px, ${windowOffset.y}px)`,
            // 끄는 동안에는 전환 효과가 없어야 손을 따라온다. 제자리로 돌릴 때만 스르륵 움직인다
            transition: isMovingWindow ? "none" : "transform 120ms ease-out",
          }}
        >
          {/* 창 타이틀바 — **여기를 잡고 끈다** */}
          <div
            onPointerDown={(event) => {
              // 타이틀바 위의 버튼을 눌렀을 때는 창이 끌려오면 안 된다
              if ((event.target as HTMLElement).closest("button") !== null) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              moveRef.current = { x: event.clientX, y: event.clientY };
              setIsMovingWindow(true);
            }}
            onPointerMove={(event) => {
              const start = moveRef.current;
              if (start === null) return;
              const dx = event.clientX - start.x;
              const dy = event.clientY - start.y;
              moveRef.current = { x: event.clientX, y: event.clientY };
              setWindowOffset((prev) => ({
                /* 완전히 밖으로 내보내지 않는다 — 다시 잡을 수 있어야 하므로 타이틀바가
                   항상 바탕 안에 남게 묶는다. win98 도 창을 화면 밖으로 반쯤 밀 수는 있지만
                   제목 표시줄까지 사라지지는 않는다. */
                x: clamp(prev.x + dx, -MOVE_LIMIT.x, MOVE_LIMIT.x),
                y: clamp(prev.y + dy, -MOVE_LIMIT.y, MOVE_LIMIT.y),
              }));
            }}
            onPointerUp={() => {
              moveRef.current = null;
              setIsMovingWindow(false);
            }}
            onPointerCancel={() => {
              moveRef.current = null;
              setIsMovingWindow(false);
            }}
            /* 두 번 누르면 제자리로 — 창을 어디 두었는지 잊었을 때의 탈출구다.
               win98 의 더블클릭(최대화)과 자리가 같아서 손이 자연스럽게 간다. */
            onDoubleClick={() => setWindowOffset({ x: 0, y: 0 })}
            title="끌어서 창을 옮기세요 · 두 번 누르면 제자리"
            className={`${w98.raised} ${w98.titleText} flex shrink-0 cursor-move items-center gap-1 bg-[color:var(--title-navy)] px-1 py-1 text-[color:var(--primary-foreground)] select-none`}
            style={{ touchAction: "none" }}
          >
            <Terminal className="size-3.5" aria-hidden />
            <span>{active.windowTitle}</span>
            {windowOffset.x !== 0 || windowOffset.y !== 0 ? (
              <span className={`${w98.small} ml-auto pr-1 font-normal opacity-70`}>
                두 번 누르면 제자리
              </span>
            ) : null}
          </div>

          {/* 창 내용 — 좌측 네비 + 화면 */}
          <div className="flex min-h-0 flex-1 gap-2 p-2">
            <SideNav activeHref={active.href} />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
          </div>
        </div>
      </main>

      {/* ── 하단 태스크바 28px (목업 <footer>) ───────────────────────────── */}
      <footer
        className={`flex h-7 w-full shrink-0 items-center justify-between border-t-2 border-white bg-[color:var(--surface)] px-2`}
      >
        <div className="flex h-full items-center gap-2">
          <Btn disabled aria-hidden className={`${w98.titleText} flex h-6 items-center gap-1 px-3`}>
            <LayoutGrid className="size-3.5 text-[color:var(--primary)]" aria-hidden />
            Start
          </Btn>

          {/* 이스터에그 — 진짜로 돌아가는 지뢰찾기. 화면 넷이 같은 것을 쓴다
              (`components/common/minesweeper.tsx` 머리말 참고) */}
          <Minesweeper />

          <div className={`${w98.sunken} mx-1 h-5 w-[2px]`} aria-hidden />

          {/* 실행 중인 창 = 화면 전환 */}
          <nav aria-label="열려 있는 창" className="flex h-full items-center gap-1">
            {SCREENS.filter((s) => !s.hidden).map((screen) => {
              const isActive = screen.href === active.href;
              return (
                <Link
                  key={screen.href}
                  href={screen.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`${w98.btn} ${isActive ? w98.raisedActive : w98.raised} ${w98.small} flex h-6 max-w-[170px] items-center gap-1 overflow-hidden px-3 font-bold whitespace-nowrap ${
                    isActive ? "bg-[color:var(--surface-variant)]" : ""
                  }`}
                >
                  <screen.icon className="size-3 shrink-0" />
                  <span className="truncate">{screen.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* 시스템 트레이 */}
        <div className="flex h-full items-center gap-2">
          <TrayBox>
            <Server className="size-3" aria-hidden />
            Network: Active
          </TrayBox>
          {/* ⚠️ 목업의 `System Ready` 는 고정 문구다. 실제 상태를 물어볼 API 가 없어서
                 문구를 그대로 뒀다 — 지어낸 값을 띄우지 않는다. */}
          <TrayBox className="px-3">System Ready</TrayBox>
          <TrayClock isOpen={isClockOpen} onToggle={() => setIsClockOpen((prev) => !prev)} />
        </div>
      </footer>

      {/* 시계 팝업 — 트레이의 시계를 눌러야 열린다. 닫혀 있으면 DOM 에 없다 */}
      {isClockOpen ? <ClockWindow onClose={() => setIsClockOpen(false)} /> : null}
    </>
  );
}

/**
 * 창을 끌 수 있는 범위. 타이틀바가 바탕 안에 남을 만큼만 허용한다.
 *
 * ⚠️ 세로를 640 까지 늘렸다 — 바탕 **한가운데**에 있는 동굴 입구를 보려면 그만큼은 내려가야
 *    한다(바탕 높이 ≈ 916, 그림 높이 224 라 그림의 아래끝이 y≈570 이다). 300 에서는 아무리
 *    끌어도 그림이 드러나지 않아서 이스터에그가 존재하지 않는 것과 같았다.
 */
const MOVE_LIMIT = { x: 700, y: 640 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/* ── 좌측 네비 ───────────────────────────────────────────────────────────────
   목업의 `<nav class="w-32 ... win98-raised p-padding-sm pt-padding-md gap-padding-xs">` 를
   그대로 옮긴 것이다. 값 대응:
     w-32            → w-32 (128px)
     p-padding-sm    → p-1  (4px)
     pt-padding-md   → pt-2 (8px)
     gap-padding-xs  → gap-0.5 (2px)
     항목            → win98-btn + raised, 아이콘 + 라벨, gap-2 · p-1 · 왼쪽 정렬
     활성 항목       → win98-raised-active + bg-surface-variant + font-bold

   ⚠️ 목업의 머리글 div 에는 `win98-etched` 가 **직접** 걸려 있는데, 그 클래스는 `height: 0`
      이라 글자가 들어가면 칸이 무너진다(목업 CSS 의 실수로 보인다). 그래서 구분선을
      머리글 **아래 별도 줄**로 뺐다 — 보이는 결과는 목업 스크린샷과 같다.

   ⚠️ 항목 이름은 목업의 Dashboard / Inventory / Analytics 대신 **실제 화면 이름**이다.
      이 목차는 장식이 아니라 진짜로 화면을 오가는 수단이라, 없는 화면 이름을 달면 눌렀을 때
      갈 곳이 없다. 세 번째 자리도 목업 이름(Analytics)을 버리고 하는 일로 바꿨다 — 입고 → 보관 → 포장이라
      세 탭이 물류 흐름 순서가 된다. 이 화면의 중심이 실시간 창고 맵과 3D 창고 입구라서다 — 이 스킨에 아직
      대시보드가 없어서 잠근 자리이기 때문이다. */
function SideNav({ activeHref }: { activeHref: string }) {
  return (
    <nav
      aria-label="주요 화면"
      className={`${w98.raised} flex w-32 shrink-0 flex-col gap-1.5 bg-[color:var(--surface)] p-1 pt-2`}
    >
      {/* ⚠️ 목업에 있던 `User: ADMIN` 줄을 **없앴다** (사용자 결정 — 깔끔하게).
             로그인·계정 명세가 아직 없어서 표시만 옮겨 둔 자리였는데, 값이 늘 ADMIN 으로
             고정이라 정보가 아니라 장식이었다. 실제 계정이 붙으면 그때 여기에 넣으면 된다.
             ⚠️ 여백도 같이 줄였다(mb-4 pb-2 → mb-3 pb-1). 한 줄이 빠졌는데 그 줄이
                차지하던 여백을 그대로 두면 로고 아래가 휑하게 뜬다. */}
      <div className="mb-3 flex flex-col pb-1">
        <BrandMark />
        <Etched className="mt-2" />
      </div>

      {SCREENS.filter((s) => !s.hidden).map((screen) => {
        const isActive = screen.href === activeHref;
        return (
          <Link
            key={screen.href}
            href={screen.href}
            aria-current={isActive ? "page" : undefined}
            /* 항목을 세 번에 걸쳐 키웠다 (사용자 지적 — "세로로 길게길게, 가독성 좋게").
               p-1(4px)+15px → px-2 py-2.5+17px → px-2 py-4+18px → **아이콘을 글자 위로
               올린 세로 배치 + py-5**. 한 칸이 약 92px 이다.

               ★ 가로 배치를 버린 이유는 높이가 아니라 **글자가 잘려서**다. 아이콘과 글자가
                 한 줄에 서면 w-32 안에서 글자가 쓸 수 있는 폭이 70px 남짓이라 `Storage` 가
                 `Analyt…` 로 잘렸다. 세로로 쌓으면 글자가 칸 폭을 통째로 쓰므로 잘릴 일이
                 없다 — "가독성"에서 제일 먼저 고칠 것은 크기가 아니라 잘림이었다.
               ⚠️ 그래서 `truncate` 도 뗐다. 폭이 충분한데 truncate 를 남겨 두면, 나중에
                  항목 이름이 조금만 길어져도 소리 없이 잘린다.
               ⚠️ 가로(w-32)는 그대로 둔다. 넓히면 그만큼 오른쪽 작업 영역이 줄어드는데,
                  이 목록은 세 개뿐이라 폭이 아니라 높이가 눌리는 면적을 만든다. */
            className={`${w98.btn} ${isActive ? w98.raisedActive : w98.raised} flex w-full flex-col items-center justify-center gap-1.5 px-1 py-5 text-center text-[17px] ${
              isActive ? "bg-[color:var(--surface-variant)] font-bold" : ""
            }`}
          >
            <screen.icon className="size-7 shrink-0" />
            <span>{screen.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/* ── 로고 ────────────────────────────────────────────────────────────────────
   `AWESOME LOGISTICS TERMINAL` — 좌측 목차 맨 위, 예전에 `Terminal` 이라고만 적혀 있던 자리.

   ★ **이미지가 아니라 인라인 SVG 로 다시 그렸다.** 받은 로고가 압축된 화면 캡처라 그대로
     쓰면 가장자리가 뭉개지고, 배율이 바뀌는 스테이지 위에서는 그게 그대로 커진다. 도형이
     단순해서(사각형 + 삼각형 둘) 다시 그리는 편이 짧고, 색을 테마 토큰으로 잡을 수 있다.
   ★ 네이비는 새 색이 아니라 이 스킨의 **타이틀바 색**(`--title-navy`)이다. 로고의 남색과
     거의 같아서, 새 색을 들이지 않고도 로고가 화면에 원래 있던 것처럼 앉는다.
   ⚠️ 흰 삼각형은 `fillRule="evenodd"` 로 가운데를 뚫는다. 큰 삼각형과 작은 삼각형을 한
      path 에 넣으면 겹친 부분이 비어서 테두리만 남는다 — 획으로 그리면 배율에 따라
      두께가 흔들리는데, 이 방식은 도형이라 항상 같은 비율로 커진다.
   ★ 화면에는 **마크 + `A.LTS` 만** 둔다 (사용자 결정). 한때 `AWESOME` 과
     `LOGISTICS TERMINAL` 을 두 줄로 쌓아 봤는데, 목차 폭이 128px 뿐이라 8px 까지 줄여야
     들어갔다. 그 크기의 글자는 읽으라고 있는 게 아니라 자리만 차지한다 — 줄임말 하나면
     같은 폭에서 19px 로 크게 설 수 있고, 로고는 원래 그렇게 쓰는 물건이다.
   ⚠️ 그래서 가로 배치다. 마크 32px + 글자 약 48px = 80px 이라 120px 안에 여유 있게 든다. */
function BrandMark() {
  return (
    /* ⚠️ `aria-label` 은 줄임말이 아니라 **전체 이름**이다. 화면에는 `A.LTS` 만 두더라도
          읽어 주는 쪽에는 무엇의 줄임말인지가 가야 한다. */
    <div role="img" aria-label="AWESOME LOGISTICS TERMINAL" className="flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" fill="var(--title-navy)" />
        <path
          d="M16 4 L29 28 L3 28 Z M16 13 L23.5 26 L8.5 26 Z"
          fill="#ffffff"
          fillRule="evenodd"
        />
        <path d="M16 16 L21.5 26 L10.5 26 Z" fill="var(--brand-gold)" />
      </svg>
      <span className="text-[19px] leading-6 font-bold tracking-[0.04em]">A.LTS</span>
    </div>
  );
}

/* ── 시계 ────────────────────────────────────────────────────────────────────
   ⚠️ 서버에서 시각을 렌더하면 하이드레이션에서 값이 어긋난다(서버 시각 ≠ 클라이언트 시각).
      그래서 첫 렌더는 자리표시(`--:--`)로 두고 마운트 뒤에 채운다. 1분마다 갱신한다. */
function TrayClock({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const update = () =>
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
      );
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, []);

  /* 트레이 시계를 **누를 수 있게** 만들었다 (사용자 요청) — 누르면 아날로그 시계 팝업이 뜬다.
     win98 에서도 트레이 시계를 두 번 누르면 날짜·시간 창이 떴으므로 자리가 맞다.
     ⚠️ 파인 면(TrayBox)이 아니라 눌리는 버튼이라 베벨이 반대다. 열려 있으면 눌린 상태로 둔다. */
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isOpen}
      aria-label="시계 열기"
      title="시계"
      className={`${w98.btn} ${isOpen ? w98.raisedActive : w98.raised} ${w98.mono} ${w98.small} flex h-6 items-center gap-1.5 tabular-nums ${
        isOpen ? "bg-[color:var(--surface-variant)]" : ""
      }`}
    >
      <ClockIcon className="size-3.5" aria-hidden />
      {time ?? "--:-- --"}
    </button>
  );
}
