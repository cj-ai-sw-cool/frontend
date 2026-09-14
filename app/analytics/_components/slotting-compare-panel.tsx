"use client";

/**
 * 슬로팅 탭 중단 좌 — 전후 비교 막대(거리 m·시간 s) + 차이 % + 등급 분포(정본 §15.9).
 *
 * ⚠️ 막대 너비는 `style={{width}}` 를 쓰지 않는다(UI 규칙 "inline style 금지"). Tailwind
 * 는 소스에 **문자열 그대로** 있는 클래스만 빌드에 포함하므로, 5% 단위 클래스 21개를
 * 배열로 미리 다 적어 두고 인덱스로 고른다(런타임에 문자열을 조립하지 않는다).
 */

import { useCompareResult, useVelocity } from "../_data/use-slotting";
import { Sunken, w98 } from "./win98-ui";
import type { SlottingEvaluateResponse, SlottingGrade } from "@/lib/types";

const BAR_WIDTH_CLASSES = [
  "w-0", "w-[5%]", "w-[10%]", "w-[15%]", "w-[20%]", "w-[25%]", "w-[30%]", "w-[35%]",
  "w-[40%]", "w-[45%]", "w-[50%]", "w-[55%]", "w-[60%]", "w-[65%]", "w-[70%]", "w-[75%]",
  "w-[80%]", "w-[85%]", "w-[90%]", "w-[95%]", "w-full",
] as const;

function barWidthClass(value: number, max: number): string {
  if (max <= 0) return BAR_WIDTH_CLASSES[0];
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return BAR_WIDTH_CLASSES[Math.round(pct / 5)];
}

function BarPair({
  label,
  unit,
  before,
  after,
}: {
  label: string;
  unit: string;
  before: number;
  after: number | null;
}) {
  const max = Math.max(before, after ?? 0, 1);
  return (
    <div className="flex flex-col gap-1">
      <span className={`${w98.small} font-bold`}>{label}</span>
      <div className="flex items-center gap-2">
        <span className={`${w98.small} w-8 text-[color:var(--muted-foreground)]`}>전</span>
        <Sunken className="h-4 flex-1 bg-[color:var(--surface)] p-0">
          <div className={`${barWidthClass(before, max)} h-4 bg-[#3D6FA3]`} />
        </Sunken>
        <span className={`${w98.mono} w-20 text-right text-[12px]`}>
          {before.toLocaleString()}
          {unit}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`${w98.small} w-8 text-[color:var(--muted-foreground)]`}>후</span>
        <Sunken className="h-4 flex-1 bg-[color:var(--surface)] p-0">
          {after !== null ? <div className={`${barWidthClass(after, max)} h-4 bg-[#3D9E7A]`} /> : null}
        </Sunken>
        <span className={`${w98.mono} w-20 text-right text-[12px]`}>
          {after !== null ? `${after.toLocaleString()}${unit}` : "—"}
        </span>
      </div>
    </div>
  );
}

const GRADE_LABEL: Record<SlottingGrade, string> = { A: "A등급", B: "B등급", C: "C등급" };

function GradeDistribution({ center }: { center: string }) {
  const { data: velocity, isLoading } = useVelocity(center);
  if (isLoading || !velocity) {
    return <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>회전율 불러오는 중…</p>;
  }
  /* 라이브 대조 — 등급 분포는 `distribution` 이 이미 전 상품을 센 값으로 준다.
   * `rows` 는 `limit` 까지만 잘려 오므로 그걸 순회해 다시 세면 값이 틀어진다. */
  const { aProducts, bProducts, cProducts, aLineSharePct } = velocity.distribution;
  const counts: Record<SlottingGrade, number> = { A: aProducts, B: bProducts, C: cProducts };

  return (
    <div className="flex flex-col gap-1.5">
      <span className={`${w98.small} font-bold`}>등급 분포</span>
      <div className="grid grid-cols-3 gap-2">
        {(["A", "B", "C"] as const).map((grade) => (
          <Sunken key={grade} className="flex flex-col items-center gap-0.5 py-1.5">
            <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>{GRADE_LABEL[grade]}</span>
            <span className={`${w98.mono} text-[16px] font-bold`}>{counts[grade]}개</span>
          </Sunken>
        ))}
      </div>
      <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>
        A등급이 전체 피킹 라인의 <b className={w98.mono}>{aLineSharePct.toFixed(1)}%</b> 차지
      </span>
    </div>
  );
}

export function SlottingCompareView({
  center,
  activeProposalId,
  evaluateTotals,
}: {
  center: string;
  activeProposalId: number | null;
  evaluateTotals: SlottingEvaluateResponse["totals"] | null;
}) {
  const compare = useCompareResult(activeProposalId);

  /* 제안이 막 생겼을 때는 아직 재평가 전이라 compare 가 없다 — 그래도 "전" 값은
   * 제안 만들기 전에 조회해 둔 현재 평가(evaluateTotals)로 계속 보여준다(그 값을
   * 캐시가 들고 있다, `useEvaluate` 는 `enabled` 가 꺼져도 마지막 data 를 유지한다). */
  const before = compare?.before ?? evaluateTotals;
  const after = compare?.after ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>
        최근 웨이브 20개 기준
        {activeProposalId === null ? " — 제안 없음, 현재 값만" : compare === null ? " — 제안 있음, 재평가 대기" : ""}
      </span>

      {before === null ? (
        <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>평가 불러오는 중…</p>
      ) : (
        <>
          <BarPair label="이동 거리" unit="m" before={before.distanceM} after={after?.distanceM ?? null} />
          <BarPair label="처리 시간" unit="초" before={before.timeSec} after={after?.timeSec ?? null} />
          {compare !== null ? (
            /* 라이브 대조 — diffPct 는 거리가 줄어든 비율(%)이고 **양수가 개선**이다
             * (표본 만들 때 가정과 부호가 반대였다). 개선이면 초록, 악화면 빨강. */
            <span
              className={`${w98.mono} text-[13px] font-bold ${
                compare.diffPct >= 0 ? "text-[color:var(--status-success)]" : "text-[color:var(--status-error)]"
              }`}
            >
              차이 {compare.diffPct > 0 ? "+" : ""}
              {compare.diffPct.toFixed(1)}% 개선 (시간 {compare.timeDiffPct > 0 ? "+" : ""}
              {compare.timeDiffPct.toFixed(1)}%)
            </span>
          ) : null}
        </>
      )}

      <div className={`${w98.etched}`} />
      <GradeDistribution center={center} />
    </div>
  );
}
