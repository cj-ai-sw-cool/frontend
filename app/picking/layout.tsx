import type { ReactNode } from "react";
import { Arimo, Roboto_Mono } from "next/font/google";
import { Win98Shell } from "./_components/shell";
import styles from "./_styles/win98.module.css";

/**
 * `/picking` 전용 레이아웃 — Windows 98 스킨의 피킹 화면(Stage 7, 브리프 §3 S7.4).
 *
 * ★ 이 라우트는 **완전히 독립**이다 (기존 화면과 같은 관례). 셸(`_components/shell.tsx`),
 *   공용 조각(`_components/win98-ui.tsx`), 스타일(`_styles/win98.module.css`)을 이웃
 *   라우트(`/inbound`, `/packing`)와 **공유하지 않고 각자 한 벌씩** 갖는다. `/packing` 의
 *   최신 사본을 그대로 복사해 왔다(장식 조각 — `truck-dock.tsx`/`clock-window.tsx` — 포함).
 *
 *   ⚠️ 그래서 여기를 고쳐도 옆 화면은 안 바뀐다 — 그게 목적이다.
 *   ⚠️ 반대로 **베벨·색·폰트처럼 스킨 전체에 걸린 변경**은 세 화면을 다 고쳐야 어긋나지 않는다.
 *
 * ── 앱 공용 셸을 덮는 방법 · z-index · fixed 이유 ────────────────────────────
 * `/packing`·`/inbound` 레이아웃과 완전히 같다 — 그쪽 주석 참고(components/fixed-stage.tsx,
 * STAGE_WIDTH/STAGE_HEIGHT 1600×1004).
 *
 * ── 세로 예산 ───────────────────────────────────────────────────────────────
 *   스테이지 1004 − 상단 타이틀바 28 − 하단 태스크바 28 = 948
 *   창 바깥 여백(p-4) 16×2 = 32                        → 창 948 − 32 = 916
 *   창 테두리 p-[2px] 2×2 = 4 · 창 타이틀바 24 · 안쪽 패딩 8×2 = 16
 *                                                      → 화면 영역 = 916 − 44 = 872
 *   가로: 1600 − 32(여백) − 4(테두리) − 16(패딩) − 150(좌측 네비) − 8(gap) = 1390
 *   이 화면은 스크롤이 없다 — 각 화면이 872px 안에서 끝나야 한다(브리프 §3 "overflow 0").
 *
 * ★ 피킹 화면은 이 1390×872 영역 **전체를 쓰지 않는다** — PDA(휴대 단말) 폭을 가정한
 *   중앙 480px 카드 열 하나만 놓는다(브리프 §3). 나머지는 여백이다 — 명세가 그렇게 정했다
 *   (작업자가 실제로 드는 손 단말은 그 폭이라, 넓은 창에 그대로 늘리면 실제 화면과 달라진다).
 */

/** 목업의 두 폰트 — 다른 win98 화면과 같은 값(각 레이아웃 주석 참고, 이 화면은 자체 결정 없음) */
const arimo = Arimo({
  variable: "--font-arimo",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-courier",
  subsets: ["latin"],
});

export default function PickingWin98Layout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${arimo.variable} ${robotoMono.variable} ${styles.theme} fixed top-0 left-0 z-60 flex h-[1004px] w-[1600px] flex-col overflow-hidden`}
    >
      <Win98Shell>{children}</Win98Shell>
    </div>
  );
}
