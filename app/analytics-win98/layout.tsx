import type { ReactNode } from "react";
import { Arimo, Roboto_Mono } from "next/font/google";
import { Win98Shell } from "./_components/shell";
import styles from "./_styles/win98.module.css";

/**
 * `/analytics-win98` 전용 레이아웃 — Windows 98 스킨의 분석 화면.
 *
 * ★ 이 라우트는 **완전히 독립**이다 (사용자 결정). 셸(`_components/shell.tsx`), 공용 조각
 *   (`_components/win98-ui.tsx`), 스타일(`_styles/win98.module.css`)을 이웃 라우트
 *   `/inbound-win98` 와 **공유하지 않고 각자 한 벌씩** 갖는다.
 *
 *   ⚠️ 그래서 여기를 고쳐도 옆 화면은 안 바뀐다 — 그게 목적이다(디자인을 화면별로 따로
 *      만지기 위해 라우트 그룹 `app/(win98)/` 를 해체하고 각자 복사해 왔다).
 *   ⚠️ 반대로 **두 화면에 같이 적용할 변경은 양쪽을 다 고쳐야 한다.** 베벨·색·폰트처럼
 *      스킨 전체에 걸린 것을 바꿀 때 한쪽만 고치면 두 화면이 어긋난다. 공유로 되돌리고
 *      싶으면 두 `_components`/`_styles` 를 공용 위치로 다시 올리면 된다.
 *
 * ── 앱 공용 셸을 덮는 방법 ──────────────────────────────────────────────────
 * 이 레이아웃이 렌더되는 자리는 app/layout.tsx 의 `<main>` 안이고, main 은 스테이지 안에서
 * `absolute top-16 left-16` 에 놓인 1536×940 영역이다. 그냥 자식으로 그리면 공용 헤더(64px)와
 * AppNav(64px)를 가릴 수 없다.
 *
 * ★ **`position: fixed` 여야 한다.** main 에는 `overflow-hidden` 이 걸려 있다. 그래서
 *   `absolute` 로 좌상단을 되짚어 나가면(-top-16 -left-16) 좌표는 맞아도 **main 박스 밖이
 *   전부 잘려서** 공용 헤더와 AppNav 가 옆에 그대로 남는다. 실제로 그렇게 보였고, 그게
 *   이 방식으로 되돌린 이유다.
 *
 *   fixed 는 조상의 overflow 에 잘리지 않는다 — 잘리는 기준은 **컨테이닝 블록의 사슬**인데,
 *   fixed 의 컨테이닝 블록은 뷰포트이거나 **transform 이 걸린 가장 가까운 조상**이고 main 은
 *   그 사슬에 없기 때문이다. 여기서 그 조상은 스테이지(components/fixed-stage.tsx)이고,
 *   스테이지는 1600×1004 에 자기도 overflow-hidden 이라 딱 원하는 만큼만 잘라 준다.
 *
 * z-index 60 은 공용 헤더(z-50)·AppNav(z-40)보다 위다. main 은 z-auto 라 스태킹 컨텍스트를
 * 만들지 않으므로 이 값이 그 둘과 같은 층에서 직접 비교된다.
 *
 * ⚠️ 스테이지의 transform 은 **하이드레이션 뒤에** JS 가 얹는다(fixed-stage.tsx 가 이펙트에서
 *    `stage.style.transform` 을 세팅한다). SSR HTML 에는 transform 이 없어 **첫 한 프레임만**
 *    fixed 가 뷰포트 기준으로 잡힌다. 그래서 `inset-0`(뷰포트를 꽉 채움) 대신 좌상단 고정 +
 *    1600×1004 로 박아 둔다 — 그 한 프레임에도 크기가 튀지 않는다.
 * ⚠️ 값 1600/1004 는 components/fixed-stage.tsx 의 STAGE_WIDTH/STAGE_HEIGHT 에서 온다.
 *    그 값이 바뀌면 여기도 같이 바뀌어야 한다.
 *
 * ── 세로 예산 ───────────────────────────────────────────────────────────────
 *   스테이지 1004 − 상단 타이틀바 28 − 하단 태스크바 28 = 948
 *   창 바깥 여백(p-4) 16×2 = 32                        → 창 948 − 32 = 916
 *   창 테두리 p-[2px] 2×2 = 4 · 창 타이틀바 24 · 안쪽 패딩 8×2 = 16
 *                                                      → 화면 영역 = 916 − 44 = 872
 *   가로: 1600 − 32(여백) − 4(테두리) − 16(패딩) − 150(좌측 네비) − 8(gap) = 1390
 *   이 화면은 스크롤이 없다 — 각 화면이 872px 안에서 끝나야 한다.
 */

/**
 * 목업의 두 폰트 — Arimo(본문·버튼·타이틀바), Roboto Mono(모노 라벨·측정값).
 *
 * ★ 모노는 두 번 바꿨다. **Courier Prime → JetBrains Mono → Roboto Mono** (사용자 결정).
 *   ① Courier 계열은 타자기 글꼴이라 획이 가늘고 끝이 세리프로 벌어진다. 56px 짜리
 *      측정값에서는 그 삐침이 그대로 커져서, 굵게 써도 물러 보였다.
 *   ② JetBrains Mono 는 세리프가 없어 단단했지만 **0 안에 점이 있다.** 코드에서는 O 와
 *      구별하려고 넣은 장치인데, 이 화면의 숫자는 전부 값이라 O 와 헷갈릴 일이 없다.
 *      값만 읽는 자리에서는 점이 정보가 아니라 얼룩으로 보인다.
 *   ③ Roboto Mono 는 0 이 슬래시도 점도 없는 그냥 타원이고, 자족(字足) 없이 획이 곧아서
 *      큰 숫자가 깔끔하게 선다. 지금 화면이 원하는 건 코드 폰트가 아니라 계기판 숫자다.
 *
 * ★ **가변 폰트**라 weight 를 지정하지 않는다. Courier Prime 때는 400/700 두 종만 받아 와서
 *   500·600 을 쓰면 브라우저가 합성으로 굵혀 획이 뭉갰는데, 그 제약이 사라졌다.
 *
 * ⚠️ 둘 다 한글 글리프가 없다. 그래서 CSS 스택의 다음 자리에 `Malgun Gothic` 을 둔다
 *    (win98.module.css 의 font-family). 브라우저가 글리프 단위로 폴백하므로 영문은
 *    Arimo/Roboto Mono, 한글은 맑은 고딕이 잡힌다 — 이 화면은 라벨이 대부분 영문이라
 *    목업의 인상이 그대로 남는다.
 * ⚠️ next/font/google 은 빌드 때 폰트를 받아 self-host 한다. 목업처럼 CDN <link> 를 쓰지
 *    않는 이유다(사내망·오프라인에서 글꼴이 깨지면 이 스킨은 정체성을 통째로 잃는다).
 */
const arimo = Arimo({
  variable: "--font-arimo",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-courier",
  subsets: ["latin"],
});

export default function AnalyticsWin98Layout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${arimo.variable} ${robotoMono.variable} ${styles.theme} fixed top-0 left-0 z-60 flex h-[1004px] w-[1600px] flex-col overflow-hidden`}
    >
      <Win98Shell>{children}</Win98Shell>
    </div>
  );
}
