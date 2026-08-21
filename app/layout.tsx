import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "풀필먼트 검수-포장 판단 시스템",
  description: "입고 치수 측정 · 출고 박스 추천 · 통합 대시보드",
};

/**
 * 앱 껍데기 — 상단 고정 헤더(64px) + 좌측 고정 사이드바(155px) + 본문.
 * 기준 해상도는 **태블릿 가로** 1180×820 ~ 1194×834, 데스크톱(1280px+)도 같은 구조로 커버한다.
 *
 * 치수는 localWork/stitch-sample.html 에서 가져왔다(헤더 64px / 사이드바 155px / 본문 패딩 24px).
 * 생김새도 샘플의 "산업용 터미널 / 브루탈리즘" 을 따른다 — 각진 모서리·2px 검정 테두리는
 * globals.css 의 토큰(--radius / --border)과 components/ui 쪽에서 처리하고,
 * 여기서는 껍데기의 경계선 두께만 샘플에 맞춘다(헤더 하단 border-b-2, 사이드바 우측 border-r-2).
 *
 * ⚠️ 스크롤은 Stitch 와 의도적으로 다르게 잡았다.
 *   Stitch 샘플: `h-[calc(900px-64px)] overflow-hidden` — 900px 짜리 화면 하나를 전제한 고정 캔버스다.
 *   그대로 옮기면 (1) 기기 높이가 820/834/1024 로 제각각이라 900px 가 맞는 기기가 없고,
 *   (2) 품목이 많거나 에러 배너가 뜨면 넘친 내용이 **잘려서 영영 안 보인다.**
 *   창고 작업자가 수량 불일치 경고를 못 보면 오출고로 이어지므로 이건 허용할 수 없다.
 *   → 헤더·사이드바만 `fixed` 로 고정하고, 본문은 뷰포트 높이를 채우되(`100dvh` - 헤더 64px)
 *     `overflow-y-auto` 로 둔다. 평소엔 샘플과 똑같이 보이고 넘칠 때만 본문 안쪽이 스크롤된다.
 *   `dvh`(dynamic viewport height)를 쓰는 이유: 태블릿 브라우저의 주소창이 접히고 펴질 때
 *   `vh` 는 값이 갱신되지 않아 본문 아래가 잘린다.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers>
          {/* 상단 고정 헤더 — Stitch 의 TopAppBar(h-64px, 카드 표면, 하단 구분선).
              구분선은 샘플 433행 `border-b-2 border-on-background` 를 따라 2px 검정이다
              (색은 --border 토큰 기본값이라 클래스로 지정하지 않는다). */}
          <header className="bg-card text-card-foreground fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between gap-4 border-b-2 px-4">
            <Link
              href="/"
              className="font-heading text-base font-semibold tracking-tight"
            >
              풀필먼트 검수-포장 판단 시스템
            </Link>
            {/* 우측 여유 공간 — 추후 사용자 정보·설정 등이 들어간다 */}
            <div className="flex items-center gap-2" />
          </header>

          {/* 좌측 고정 사이드바(155px). 자기 위치를 스스로 잡으므로 여기서는 배치하지 않는다 */}
          <AppNav />

          {/* 고정 요소만큼 자리를 비워 준다. margin 대신 padding 을 쓰는 이유는
              첫 자식의 margin-top 이 body 로 빠져나가는(margin collapsing) 걸 피하기 위해서다. */}
          <div className="pt-16 pl-[155px]">
            {/* `custom-scrollbar` 는 globals.css 에 정의한 16px 각진 스크롤바다.
                전역이 아니라 이 <main> 에만 붙인다 — 좌측 사이드바도 overflow-y-auto 라서
                전역으로 걸면 남색 배경 위에 회색 스크롤바가 얹혀 튄다.
                규칙이 자손까지 훑으므로(`.custom-scrollbar *`) 본문 안쪽의 표 가로 스크롤도 함께 적용된다. */}
            <main className="custom-scrollbar h-[calc(100dvh-4rem)] overflow-y-auto p-6">
              {children}
            </main>
          </div>

          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
