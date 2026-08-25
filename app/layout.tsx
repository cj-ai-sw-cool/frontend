import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_KR } from "next/font/google";
import Link from "next/link";
import { CircleUserRound, ScanBarcode, Settings, type LucideIcon } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { FixedStage } from "@/components/fixed-stage";
import { Toaster } from "@/components/ui/sonner";
// package.json 은 **서버 컴포넌트인 이 파일에서만** 읽는다 — 클라이언트로 넘어가는 건
// version 문자열 하나뿐이다(components/app-nav.tsx 주석 참고).
import { version } from "@/package.json";
import { Providers } from "./providers";
import "./globals.css";

/* ── 폰트 ────────────────────────────────────────────────────────────────────
   Geist / Geist Mono 를 걷어내고 디자인 확정본(design.html)의 IBM Plex 조합으로 교체했다.
   확정본의 link 두 줄이 그대로 이 두 로더에 대응한다:
     family=IBM+Plex+Sans:wght@400;500;600;700
     family=IBM+Plex+Sans+KR:wght@400;500;600;700
   실제 스택 조립(-apple-system, Malgun Gothic 폴백 포함)은 globals.css 의 --font-sans 에 있다.

   ⚠️ IBM Plex Sans 는 라틴 전용이라 한글 글리프가 없다. 그래서 KR 을 같은 스택의
      다음 순서에 둔다 — 브라우저가 글리프 단위로 폴백하므로 영문은 Plex Sans,
      한글은 Plex Sans KR 이 자동으로 잡힌다. KR 하나만 쓰면 영문 자간이 미묘하게 달라진다.

   ⚠️ subsets 에 korean 이 없는 게 맞다. next/font 메타데이터상 KR 의 preload 가능
      subset 은 latin/latin-ext 뿐이지만, next/font 는 Google 이 내려주는 @font-face 를
      **전부** 내려받아 self-host 한다(subsets 는 preload 대상만 고르는 값이다).
      한글 woff2 조각도 같이 self-host 되므로 오프라인/사내망에서도 한글이 깨지지 않는다.

   ⚠️ KR 만 preload: false 다 — 성능 때문이고, 실측으로 확인한 사항이다.
      Google 이 내려주는 IBM Plex Sans KR 의 CSS 는 @font-face 가 376개다(한글을 유니코드
      구간별로 잘게 쪼갠 것). 그런데 그 응답에서 한글 조각들에는 subset 주석이 없고
      중간에 딱 한 번 나오는 "latin" subset 주석 뒤로 나머지가 전부 따라붙는다.
      next/font 는 "직전 주석 = 현재 subset" 규칙으로 preload 대상을 고르므로
      (find-font-files-in-css.js), 그 주석 뒤의 한글 조각이 전부 latin 으로 오인돼
      **페이지마다 <link rel=preload> 가 281개** 붙었다(빌드 산출물에서 직접 셌다).
      preload: false 로 두면 self-host 는 그대로 유지되고, 브라우저가 unicode-range 를 보고
      실제로 쓰이는 한글 조각만 필요할 때 받아 간다 — 이게 CJK 폰트의 정상 동작이다.
      영문(IBM Plex Sans)은 latin 4개만 preload 되므로 그대로 둔다. */
const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexSansKr = IBM_Plex_Sans_KR({
  variable: "--font-ibm-plex-sans-kr",
  weight: ["400", "500", "600", "700"],
  preload: false, // 위 ⚠️ 참고. subsets 는 preload 대상을 고르는 값이라 여기서는 의미가 없어 뺐다.
});

export const metadata: Metadata = {
  // 헤더 표시는 디자인 확정본의 LOGISTICS TERMINAL SYSTEM 으로 바뀌었지만,
  // 브라우저 탭·북마크에 뜨는 이름은 팀이 쓰는 한국어 이름을 그대로 유지한다.
  title: "풀필먼트 검수-포장 판단 시스템",
  description: "입고 치수 측정 · 출고 박스 추천 · 통합 대시보드",
};

/* ── 헤더 우측 아이콘 3개 ────────────────────────────────────────────────────
   ⚠️ **동작이 없다.** 디자인 확정본에 있으니 자리는 만들지만, 스캐너 연동·설정 화면·
      계정 메뉴는 어느 것도 아직 명세가 없다. 없는 기능을 있는 것처럼 만들지 않기 위해
      disabled + aria-hidden + cursor-default 로 둔다:
        disabled       탭 순서에서 빠지고 클릭도 먹지 않는다
        aria-hidden    스크린리더가 버튼이라고 읽어 주지 않는다(누를 게 없으므로)
        cursor-default 커서가 손가락으로 바뀌지 않아 "눌러도 되나?"를 유발하지 않는다
      기능이 정해지면 이 배열에 onClick/href 를 붙이고 위 3개 속성을 걷어내면 된다.

   ⚠️ 아이콘 라이브러리 — 확정본은 Material Symbols 를 쓰고 FILL 축(0/1)으로
      활성/비활성을 구분하지만, Next 16.3.1 의 next/font/google 에는 Material Symbols
      자체가 없어서 self-host 가 불가능하다(상세는 인수인계 보고 참고). 결정이 날 때까지
      기존 의존성인 lucide-react 를 그대로 쓴다. 확정본과의 대응은 각 줄 끝에 적어 뒀다. */
const HEADER_ACTIONS: { icon: LucideIcon; label: string }[] = [
  { icon: ScanBarcode, label: "바코드 스캔" }, // 확정본: material-symbols barcode_scanner
  { icon: Settings, label: "설정" }, // 확정본: material-symbols settings
  { icon: CircleUserRound, label: "계정" }, // 확정본: material-symbols account_circle
];

/**
 * 앱 껍데기 — 1600×1004 **고정 스테이지** 위에
 * 상단 헤더(64px) + 좌측 사이드바(155px) + 본문(1445×940)을 절대 배치한다.
 *
 * 치수·색·타이포는 전부 디자인 확정본(design.html, 라이브: p1-terminal.vercel.app)에서 왔다.
 * 생김새는 "산업용 터미널 / 브루탈리즘" — 각진 모서리·2px 검정 테두리는 globals.css 의
 * 토큰(--radius / --border)이 처리하고, 여기서는 껍데기의 경계선 두께만 지정한다
 * (헤더 하단 border-b-2, 사이드바 우측 border-r-2 는 app-nav.tsx).
 *
 * ⚠️ 스크롤 방식에 대한 이전 판단은 **뒤집혔다.**
 *   이전 결정: "Stitch 샘플의 고정 캔버스(h-[calc(900px-64px)] overflow-hidden)를 그대로
 *   쓰면 기기 높이가 820/834/1024 로 제각각이라 넘친 내용이 잘려서 영영 안 보이고,
 *   창고 작업자가 수량 불일치 경고를 못 보면 오출고로 이어진다. 그러니 헤더·사이드바만
 *   fixed 로 두고 본문은 100dvh 안에서 overflow-y-auto 로 스크롤시킨다."
 *
 *   그 판단의 전제는 "고정 캔버스 = 잘림" 이었는데, 그 전제가 틀렸다.
 *   확정본은 단순 고정 캔버스가 아니라 **scale-to-fit** 이다 — 캔버스 전체를
 *   transform: scale() 로 통째로 줄인다. 줄어들 뿐 잘리지 않으므로 화면 어느 구석의
 *   경고도 항상 보인다. 잘림 위험이 사라진 이상, 스크롤을 허용해 레이아웃이 기기마다
 *   달라지게 두는 것보다 "모든 단말에서 픽셀 단위로 같은 화면"이 훨씬 낫다 —
 *   현장 교육과 문제 재현이 쉬워지고, 화면 캡처가 디자인과 1:1 로 맞는다.
 *   (해상도가 낮으면 글자가 같이 작아진다는 비용은 남는다. 그건 기기 선정 문제로 넘긴다 —
 *    1180px 폭 태블릿 기준 scale 약 0.72 로 label-sm 16px 이 11.6px 이 되는데 읽을 만하다.)
 *
 *   ⚠️ 위 "잘리지 않는다"는 **공짜로 참인 문장이 아니다.** scale 계산이 폭만 보면
 *   거짓이 된다 — 원본 design.html 의 fit() 이 그렇게 되어 있고, 그대로 옮겼을 때
 *   1366x768 / 1440x900 같은 16:9 화면에서 스테이지 아래쪽이 실제로 잘렸다.
 *   지금은 components/fixed-stage.tsx 의 fit() 이 폭과 높이를 함께 보고 더 빡빡한 쪽에
 *   맞춘다. 이 문장을 참으로 만들어 주는 게 그 높이 항이므로, 둘은 같이 움직여야 한다 —
 *   fit() 에서 높이 항을 빼면 이 결정의 근거가 무너진다.
 *
 *   따라서 본문은 이제 스크롤하지 않는다(overflow-hidden). 화면 안에 다 들어가는 것이
 *   요구사항이고, 넘치면 그건 화면 설계를 고쳐야 한다는 신호다.
 *
 * ⚠️ transform 이 걸린 조상 안에서는 position: fixed 가 뷰포트가 아니라 그 조상을
 *   기준으로 잡힌다. 원본 custom.css 는 이걸 `#stage .fixed{ position:absolute }` 로
 *   눌러 놨지만, 여기서는 브라우저 동작에 기대지 않고 헤더·사이드바를 처음부터
 *   absolute 로 쓴다. 읽는 사람이 "왜 fixed 인데 스테이지 기준이지?"를 고민할 일이 없다.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  /* 개발 전용 팔레트 전환 패널을 **동적으로** 들여온다.
     정적 import 로 두면 프로덕션에서도 빠지지 않는다 — 실제로 빼 보고 확인했다.
     패널이 "use client" 모듈이라, 서버 컴포넌트가 그걸 import 하는 순간 죽은 JSX 와
     무관하게 **클라이언트 엔트리**가 하나 만들어지고 청크가 HTML 에 실린다
     (조건부 렌더만으로는 34KB 짜리 청크가 그대로 로드됐다).
     아래처럼 NODE_ENV 분기 안에서 await import 하면 프로덕션에서는 그 분기 자체가
     정적으로 죽어 참조가 사라진다. */
  const DevPanel =
    process.env.NODE_ENV === "production"
      ? null
      : (await import("@/components/palette-dev-panel")).PaletteDevPanel;

  return (
    <html lang="ko" className={`${ibmPlexSans.variable} ${ibmPlexSansKr.variable} antialiased`}>
      {/* 스테이지 **바깥**(레터박스)은 앱 팔레트가 아니라 "장비를 올려 둔 책상"이다.
          원본 custom.css 의 body 값 그대로 — 라이트 #e7e5e4/#44403c, 다크 #1c1917/#a8a29e.
          앱 토큰(--background 등)을 쓰지 않고 하드코딩한 건 의도적이다: 팔레트를 갈아끼워도
          이 중립 회색은 따라 움직이면 안 된다(스테이지가 배경에 묻히면 화면 경계가 사라진다).
          padding 12px 은 components/fixed-stage.tsx 의 BODY_PADDING 과 같은 값이어야 한다. */}
      <body className="bg-[#e7e5e4] p-3 text-[#44403c] dark:bg-[#1c1917] dark:text-[#a8a29e]">
        <Providers>
          <FixedStage>
            {/* 상단 헤더(64px). 확정본 TopAppBar —
                bg-surface-container + border-b-2 + 좌우 padding 16px(panel-padding). */}
            <header className="bg-card text-card-foreground px-panel-padding absolute top-0 left-0 z-50 flex h-16 w-full items-center justify-between border-b-2">
              {/* 로고+타이틀은 홈(/)으로 가는 링크로 유지한다(기존 동작 보존).
                  확정본에서는 링크가 아니지만, 홈이 화면 3개의 진입점이라 없애면 갈 길이 막힌다. */}
              <Link href="/" className="flex items-center gap-4">
                {/* AWESOME 로고 — 확정본 인라인 SVG 원본 그대로.
                    네이비 사각형(#003087) + 2px 검정 스트로크 + 흰 삼각형 + 앰버 바(#FCB40D).
                    브랜드 색이라 토큰화하지 않는다 — 팔레트가 바뀌어도 로고는 고정이다. */}
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 48 48"
                  fill="none"
                  className="block shrink-0"
                  role="img"
                  aria-label="AWESOME"
                >
                  <rect x="1" y="1" width="46" height="46" fill="#003087" stroke="#000000" strokeWidth="2" />
                  <path d="M24 8 L40 40 L8 40 Z M24 20 L30 32 L18 32 Z" fill="#FFFFFF" fillRule="evenodd" />
                  <rect x="15" y="31" width="18" height="5" fill="#FCB40D" />
                </svg>
                <span className="text-action-lg font-bold">LOGISTICS TERMINAL SYSTEM</span>
              </Link>

              <div className="flex items-center gap-4">
                {HEADER_ACTIONS.map(({ icon: Icon, label }) => (
                  <button
                    key={label}
                    type="button"
                    disabled
                    aria-hidden
                    // 확정본: hc-border-thin(1px 검정) + bg-surface-container-lowest(흰색).
                    // 테두리 색은 globals.css 의 `* { border-border }` 가 이미 검정으로 깔아 준다.
                    className="bg-card flex cursor-default items-center justify-center border p-2"
                  >
                    <Icon className="size-6" />
                  </button>
                ))}
              </div>
            </header>

            {/* 좌측 사이드바(155px). 자기 위치를 스스로 잡으므로 여기서는 배치하지 않는다 */}
            <AppNav version={version} />

            {/* 본문 — 스테이지에서 헤더(64px)와 사이드바(155px)를 뺀 나머지.
                1445 = 1600 - 155, 940 = 1004 - 64. 확정본의 content-w / layout-h 와 같은 값이다.
                배경은 확정본의 bg-surface-dim 인데, 우리 토큰에서는 그게 --background 다.
                custom-scrollbar 는 main 자신이 아니라 **자손**의 스크롤 영역
                (표 가로 스크롤 등)을 위해 남겨 둔다 — globals.css 주석 참고. */}
            <main className="custom-scrollbar bg-background p-grid-gap absolute top-16 left-[155px] h-[940px] w-[1445px] overflow-hidden">
              {children}
            </main>
          </FixedStage>

          {/* Toaster 는 스테이지 밖에 둔다 — 안에 넣으면 scale 이 같이 먹어서
              좁은 화면에서 알림 글자까지 줄어든다. 알림은 항상 원본 크기로 보여야 한다.

              위치는 **스테이지 중앙**이다. 원래 기본값(우하단)이라 입고 화면의 하단
              버튼 위에 겹쳐서 작업을 방해했다. 그런데 스테이지 밖에 있는 탓에
              sonner 가 말하는 "중앙"은 뷰포트 중앙이고, 작업자가 보는 스테이지 중앙과
              레터박스만큼 어긋난다(데스크톱에서 좌우 400px 이상). 그래서 좌표를
              components/fixed-stage.tsx 가 내보내는 --stage-* 변수로 다시 잡는다 —
              실제 계산은 globals.css 의 [data-sonner-toaster].stage-toaster 규칙에 있다.

              ⚠️ className 은 components/ui/sonner.tsx 의 기본값("toaster group")을
                 **덮어쓴다**(그 파일이 {...props} 를 뒤에 펼치기 때문). 그래서 기본값을
                 그대로 옮겨 적고 stage-toaster 만 덧붙였다. 그 파일은 팀 공용이라
                 이번 범위에서 수정하지 않는다.
              ⚠️ style 은 넘기지 않는다 — 같은 이유로 sonner.tsx 가 심어 둔
                 --normal-bg 같은 토큰 연결이 통째로 날아간다. */}
          <Toaster position="top-center" className="toaster group stage-toaster" />

          {/* 개발 전용 팔레트 전환 패널. Toaster 와 같은 이유로 스테이지 밖이다.
              프로덕션에서는 위 동적 import 분기가 죽어 DevPanel 이 null 이다. */}
          {DevPanel === null ? null : <DevPanel />}
        </Providers>
      </body>
    </html>
  );
}
