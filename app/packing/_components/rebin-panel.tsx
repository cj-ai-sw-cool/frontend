"use client";

import { ApiError } from "@/lib/api";
import type { RebinSessionDetail } from "@/lib/types";
import { Btn, Panel, w98 } from "./win98-ui";
import { RebinWallPanel } from "./rebin-wall-panel";

/**
 * 리빈 탭의 본문 — 세션 없음(404) 이면 "리빈 자동 처리" 버튼, 있으면 리빈 벽 표(정본 §8.4,
 * 브리프 §3 S8.3). `batch-detail-panel.tsx`가 DONE 배치에서만 이 컴포넌트를 보여준다.
 *
 * `useRebinSession`(정본 §8.1 "세션 없음 → 404")의 404 는 에러가 아니라 "아직 처리 안 함"
 * 이라는 정상 상태다 — 그래서 `error` 를 그대로 화면 에러로 보여주지 않고 상태 코드로
 * 갈라서 읽는다(`ApiError.status === 404`).
 */
export function RebinPanel({
  session,
  isLoading,
  error,
  onOpenSimulate,
  className = "",
}: {
  session: RebinSessionDetail | null;
  isLoading: boolean;
  error: Error | null;
  onOpenSimulate: () => void;
  className?: string;
}) {
  if (session !== null) {
    return <RebinWallPanel session={session} className={className} />;
  }

  if (isLoading) {
    return (
      <Panel title="리빈" className={`min-h-0 flex-1 ${className}`}>
        <p className={`${w98.small} p-2 text-[color:var(--muted-foreground)]`}>불러오는 중…</p>
      </Panel>
    );
  }

  const sessionMissing = error instanceof ApiError && error.status === 404;

  if (!sessionMissing) {
    return (
      <Panel title="리빈" className={`min-h-0 flex-1 ${className}`}>
        <p className={`${w98.small} p-2 text-[color:var(--status-error)]`}>
          {error?.message ?? "리빈 정보를 불러오지 못했습니다."}
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="리빈" className={`min-h-0 flex-1 ${className}`} bodyClassName="items-start gap-2 p-2">
      <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>
        이 배치는 아직 리빈 세션이 없습니다. 자동 처리를 실행하면 배치 토트의 물건을 주문별
        슬롯으로 나누고, 완성된 주문을 배송단위 토트로 옮깁니다.
      </p>
      <Btn onClick={onOpenSimulate} className="h-7 px-3 text-[13px] font-bold">
        리빈 자동 처리
      </Btn>
    </Panel>
  );
}
