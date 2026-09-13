"use client";

/**
 * 허브 창 — Stage 11D, 정본 §12.6·§12.8, 브리프 §2 "허브 창 `/hub`".
 *
 * "마스터" 창(`app/analytics/_components/master-window.tsx`)과 같은 골격이다: raised 테두리
 * + 타이틀바 + 탭 바 + 본문. 다른 점은 그 창이 분석 화면 위에 여는 **오버레이**인 반면, 이
 * 창은 `/hub` 라우트 자체의 본문이라 `onClose` 가 없다 — 타이틀바의 "✕" 자리는 홈(`/`)으로
 * 돌아가는 링크다(다른 화면 셸의 "LOGISTICS TERMINAL v1.0" 링크와 같은 탈출구, 브리프 §1).
 *
 * 탭 4개(정본 §12.8): 주문 · 이동 · 글로벌 ATP · 센터. 각 탭은 자기 상태·데이터 훅을 통째로
 * 들고 있다(`orders-tab.tsx` 머리말과 같은 관례) — 여기서는 탭 전환만 담당한다.
 */

import { useState } from "react";
import Link from "next/link";
import { Terminal } from "lucide-react";
import { AtpTab } from "./atp-tab";
import { CentersTab } from "./centers-tab";
import { ControlTab } from "./control-tab";
import { OrdersTab } from "./orders-tab";
import { TransfersTab } from "./transfers-tab";
import { Btn, w98 } from "./win98-ui";

// Stage 11A — "관제"(정본 §13.5 "허브 창에 '관제' 탭") 추가
const TABS = ["주문", "이동", "글로벌 ATP", "센터", "관제"] as const;
type Tab = (typeof TABS)[number];

export function HubWindow() {
  const [tab, setTab] = useState<Tab>("주문");

  return (
    <div className={`${w98.raised} flex h-[900px] w-[1500px] flex-col bg-[color:var(--surface)] p-[2px]`}>
      {/* 타이틀바 */}
      <div
        className={`${w98.raised} ${w98.titleText} flex shrink-0 items-center gap-2 bg-[color:var(--title-navy)] px-2 py-1 text-[color:var(--primary-foreground)]`}
      >
        <Terminal className="size-4" aria-hidden />
        <span className="flex-1">MULTI-CENTER HUB — 다창고 허브</span>
        <Link
          href="/"
          title="시작 화면으로"
          className={`${w98.btn} ${w98.raised} flex size-5 cursor-pointer items-center justify-center`}
        >
          ✕
        </Link>
      </div>

      {/* 탭 바 */}
      <div className="flex shrink-0 gap-1 p-2 pb-0">
        {TABS.map((t) => (
          <Btn key={t} pressed={tab === t} onClick={() => setTab(t)} className="px-4 py-1.5">
            {t}
          </Btn>
        ))}
      </div>

      <div className="min-h-0 flex-1 p-2">
        {tab === "주문" ? (
          <OrdersTab />
        ) : tab === "이동" ? (
          <TransfersTab />
        ) : tab === "글로벌 ATP" ? (
          <AtpTab />
        ) : tab === "센터" ? (
          <CentersTab />
        ) : (
          <ControlTab />
        )}
      </div>
    </div>
  );
}
