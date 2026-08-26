"use client";

import { BarChart3, Boxes, Clock3, TriangleAlert } from "lucide-react";
import { Panel, Sunken, w98 } from "./_components/win98-ui";

/**
 * 분석 화면 (win98 스킨) — **아직 비어 있다.** 자리와 생김새만 잡아 둔 뼈대다 (사용자 요청).
 *
 * ★ 지금 채우지 않는 이유: 이 화면은 **P3 담당**이고(docs/05-team-plan.md §2), 어떤 수치를
 *   무슨 API 로 가져올지가 아직 정해지지 않았다. 숫자를 지어내 채우면 시연 중에 "저 값은
 *   어디서 온 거냐"는 질문에 답할 수 없고, 나중에 진짜 값이 붙을 때 오히려 걷어내야 한다.
 *   그래서 **모든 칸이 `--` 이고 `준비 중` 이라고 스스로 말한다.**
 *
 * ⚠️ 여기 적힌 항목 이름(처리량·평균 처리시간·오류율…)은 **가정이다.** 계약이 정해지면
 *    그때 맞춰 바꾼다. 자리를 잡아 두는 것이 목적이지 항목을 확정하는 것이 아니다.
 *
 * 셸(데스크톱·태스크바·창 크롬·좌측 네비)은 이 라우트의 layout.tsx 가 그린다.
 * 다른 두 화면과 마찬가지로 **코드를 공유하지 않는다** — 각자 한 벌씩 갖는다.
 *
 * ── 세로·가로 예산 ──────────────────────────────────────────────────────────
 *   화면 영역 = 1390 × 872 (layout.tsx 주석 참고)
 *   세로: 요약 카드 120 + gap 8 + 본문 flex-1 = 872
 *   가로: 좌 flex-1 + gap 8 + 우 420
 */
export default function AnalyticsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* ── 위: 요약 카드 넷 ─────────────────────────────────────────────── */}
      <div className="grid h-[120px] shrink-0 grid-cols-4 gap-2">
        {SUMMARY.map((card) => (
          <Panel key={card.label} title={card.title} className="min-h-0">
            <Sunken className="flex min-h-0 flex-1 flex-col justify-center px-3 py-2">
              <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>
                {card.label}
              </span>
              <span className={`${w98.mono} text-[30px] leading-9 font-bold tabular-nums`}>--</span>
            </Sunken>
          </Panel>
        ))}
      </div>

      {/* ── 아래: 그래프 + 목록 ──────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 gap-2">
        <Panel title="Throughput — 시간대별 처리량" className="min-h-0 flex-1">
          <Placeholder icon={<BarChart3 className="size-10 opacity-30" aria-hidden />}>
            그래프 자리
          </Placeholder>
        </Panel>

        <div className="flex w-[420px] shrink-0 flex-col gap-2">
          <Panel title="Line Status — 라인별 현황" className="min-h-0 flex-1">
            <Placeholder icon={<Boxes className="size-10 opacity-30" aria-hidden />}>
              라인 목록 자리
            </Placeholder>
          </Panel>
          <Panel title="Alerts — 이상 항목" className="h-[220px] shrink-0">
            <Placeholder icon={<TriangleAlert className="size-10 opacity-30" aria-hidden />}>
              경고 목록 자리
            </Placeholder>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** 요약 카드 — 이름은 **가정**이다. 계약이 정해지면 바꾼다 */
const SUMMARY: { title: string; label: string }[] = [
  { title: "Packed", label: "오늘 포장 완료" },
  { title: "Inbound", label: "오늘 입고 건수" },
  { title: "Avg. Time", label: "평균 처리시간" },
  { title: "Mismatch", label: "수량 불일치" },
];

/**
 * 빈 칸 — 무엇이 들어올 자리인지 말하고, **아직 없다는 것도 같이 말한다.**
 * win98 의 마퀴 막대를 같이 두는 이유: 진행률을 모를 때 쓰던 표현이라 "준비 중"과 맞는다.
 */
function Placeholder({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Sunken className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6">
      {icon}
      <span className={`${w98.mono} ${w98.small} text-[color:var(--muted-foreground)] uppercase`}>
        {children}
      </span>
      <div className={`${w98.marquee} w-1/2`}>
        <div className={w98.marqueeInner}>
          {[0, 1, 2, 3, 4].map((index) => (
            <span key={index} className={w98.marqueeBlock} />
          ))}
        </div>
      </div>
      <span className={`${w98.small} flex items-center gap-1 text-[color:var(--muted-foreground)]`}>
        <Clock3 className="size-3.5" aria-hidden />
        준비 중 — 담당 P3
      </span>
    </Sunken>
  );
}
