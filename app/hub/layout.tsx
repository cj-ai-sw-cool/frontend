import type { ReactNode } from "react";
import { Arimo, Roboto_Mono } from "next/font/google";
import styles from "./_styles/win98.module.css";

/**
 * `/hub` 전용 레이아웃 — Stage 11D(정본 §12.8) 허브 창. 화면 셋(`app/inbound`·`app/packing`·
 * `app/analytics`)과 같은 독립 원칙을 그대로 따른다 — 셸 이스터에그·좌측 목차·태스크바가
 * 필요 없는 **단일 창**이라 `Win98Shell` 은 쓰지 않고, 그 골격 중 "청록 데스크톱 배경 위에
 * 창 하나"만 가져온다(`_components/hub-window.tsx`). 스킨(`_styles`·`_components/win98-ui.tsx`)
 * 은 다른 화면과 공유하지 않고 이 라우트 전용 사본이다 — 같은 이유는 `app/inbound/layout.tsx`
 * 머리말 참고.
 *
 * fixed + z-60 + 1600×1004 고정 스테이지인 이유, 폰트 두 개(Arimo/Roboto Mono)를 쓰는
 * 이유는 전부 `app/inbound/layout.tsx` 와 같다 — 그 파일 주석을 그대로 참고.
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

export default function HubLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${arimo.variable} ${robotoMono.variable} ${styles.theme} fixed top-0 left-0 z-60 flex h-[1004px] w-[1600px] flex-col overflow-hidden`}
    >
      <main className={`${styles.desktop} relative flex h-full w-full items-center justify-center p-6`}>
        {children}
      </main>
    </div>
  );
}
