"use client";

import { useEffect, useRef, type ReactNode } from "react";

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

/** 레터박스 여백 — app/layout.tsx 의 body 좌우 padding(12px)과 반드시 같아야 한다.
    원본 fit() 의 `clientWidth - 24` 가 이 값의 좌우 합이다. */
const BODY_PADDING = 12;

export function FixedStage({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    const stage = stageRef.current;
    if (frame === null || stage === null) return;

    const fit = () => {
      // window.innerWidth 가 아니라 documentElement.clientWidth 를 쓰는 이유:
      // innerWidth 는 세로 스크롤바 폭을 포함해서, 스크롤바가 생기는 순간
      // "축소 → 스크롤바 사라짐 → 확대 → 스크롤바 생김" 진동이 일어난다.
      const scale = Math.min(1, (document.documentElement.clientWidth - BODY_PADDING * 2) / STAGE_WIDTH);
      stage.style.transform = `scale(${scale})`;
      frame.style.width = `${Math.round(STAGE_WIDTH * scale)}px`;
      frame.style.height = `${Math.round(STAGE_HEIGHT * scale)}px`;
    };

    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div ref={frameRef} className="mx-auto overflow-hidden">
      <div
        ref={stageRef}
        // origin-top-left: 축소 기준점이 가운데(기본값)면 frame 에 박아 둔 크기와
        // 어긋나 위쪽이 잘린다. 좌상단 고정이라야 frame 크기 계산과 정확히 맞는다.
        // shadow: 원본 custom.css 의 `box-shadow:0 2px 24px rgba(0,0,0,.28)` 그대로 —
        // 레터박스 회색 위에서 스테이지가 "장비 화면"처럼 떠 보이게 한다.
        className="bg-background relative h-[1004px] w-[1600px] origin-top-left overflow-hidden shadow-[0_2px_24px_rgba(0,0,0,0.28)]"
      >
        {children}
      </div>
    </div>
  );
}
