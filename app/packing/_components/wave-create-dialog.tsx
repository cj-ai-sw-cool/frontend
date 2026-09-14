"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { WaveCreateResponse } from "@/lib/types";
import { Btn, Etched, Field, Sunken, w98 } from "./win98-ui";

/** 오늘 14:00 이 이미 지났으면 내일 14:00, 아니면 오늘 14:00 — 정본 §6.2 기본 마감시각,
 * 브리프 §3 "기본값 = 오늘 14:00 이후면 내일 14:00". `datetime-local` 입력값 형식(초 없음)으로
 * 돌려준다. */
function defaultCutoff(): string {
  const now = new Date();
  const candidate = new Date(now);
  candidate.setHours(14, 0, 0, 0);
  if (candidate <= now) {
    candidate.setDate(candidate.getDate() + 1);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${candidate.getFullYear()}-${pad(candidate.getMonth() + 1)}-${pad(candidate.getDate())}T${pad(
    candidate.getHours(),
  )}:${pad(candidate.getMinutes())}`;
}

/**
 * "주문 투입" 대화 상자 — 정본 §6.7, 브리프 §3 S6.5.
 *
 * ALLOCATED 주문을 마감시각으로 묶어 웨이브를 생성한다(`POST /waves`, 정본 §6.4). 결과(주문
 * 수·배치 수·태스크 수·skipped 목록)를 대화 상자 안에 그대로 남겨 둔다 — 화면 체크 2번
 * (브리프 §4)이 이 결과를 직접 봐야 한다.
 *
 * ASN 등록 대화 상자(`asn-register-dialog.tsx`)와 같은 골격을 쓴다: 폼 상태를 자식에 두어
 * Radix 가 닫힐 때 언마운트로 자동 초기화되게 한다. 다만 여기는 제출 뒤에도 결과를 보여줘야
 * 하므로, 성공 응답이 오면 폼 대신 결과 뷰로 전환한다(닫았다 다시 열면 폼으로 되돌아간다).
 */
export function WaveCreateDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  result,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (cutoffAt: string) => void;
  isSubmitting: boolean;
  result: WaveCreateResponse | null;
  error?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={`${w98.dialogTheme} ${w98.raised} w-[520px] max-w-none gap-0 rounded-none border-0 p-[3px] shadow-[3px_3px_0_0_rgba(0,0,0,0.35)] sm:max-w-none`}
      >
        <DialogHeader
          className={`${w98.titleText} h-6 flex-row items-center gap-1 space-y-0 bg-[color:var(--title-navy)] px-1 text-[color:var(--primary-foreground)]`}
        >
          <DialogTitle className={w98.titleText}>주문 투입 — 웨이브 생성</DialogTitle>
          <DialogDescription className="sr-only">
            마감시각을 입력해 ALLOCATED 주문을 웨이브로 묶고 hard 할당·피킹 배치를 만듭니다.
          </DialogDescription>
        </DialogHeader>

        {result !== null ? (
          <WaveResultView result={result} onClose={() => onOpenChange(false)} />
        ) : (
          <WaveCreateForm
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
            isSubmitting={isSubmitting}
            error={error}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function WaveCreateForm({
  onSubmit,
  onCancel,
  isSubmitting,
  error,
}: {
  onSubmit: (cutoffAt: string) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string | null;
}) {
  const [cutoffAt, setCutoffAt] = useState(defaultCutoff);

  const canSubmit = cutoffAt.trim() !== "";

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(new Date(cutoffAt).toISOString());
  };

  return (
    <>
      <div className="flex flex-col gap-3 p-3">
        <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>
          마감시각이 지난 ALLOCATED 주문을 전부 묶어 hard 할당·카토나이제이션·배치 편성까지
          한 번에 진행합니다.
        </p>
        <label className="flex flex-col gap-0.5">
          <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>마감시각</span>
          <Field
            type="datetime-local"
            mono
            value={cutoffAt}
            onChange={(event) => setCutoffAt(event.target.value)}
            className="h-8 w-full text-[14px]"
          />
        </label>

        {error ? (
          <div
            role="alert"
            className={`${w98.sunken} ${w98.small} bg-[#ffdad6] p-2 font-bold text-[color:var(--status-error)]`}
          >
            {error}
          </div>
        ) : null}
      </div>

      <div className="flex justify-end gap-2 border-t-2 border-[color:var(--surface-dim)] p-2">
        <Btn disabled={!canSubmit || isSubmitting} onClick={submit} className="h-7 w-28 font-bold">
          {isSubmitting ? "생성 중…" : "웨이브 생성"}
        </Btn>
        <Btn onClick={onCancel} className="h-7 w-24">
          취소
        </Btn>
      </div>
    </>
  );
}

function WaveResultView({
  result,
  onClose,
}: {
  result: WaveCreateResponse;
  onClose: () => void;
}) {
  /* Stage 11(11.4) "빈 웨이브 금지" 결정 — 마감 지난 ALLOCATED 주문이 0건이면 백엔드가
   * 웨이브 행 자체를 만들지 않고 `waveId: null` 로 돌려준다(정본 §11.4). 실패가 아니라
   * "만들 게 없었다"는 정상 응답이라 에러 배너가 아니라 결과 화면 한 장으로 보여준다. */
  if (result.waveId === null) {
    return (
      <>
        <div className="flex flex-col gap-3 p-3">
          <p className={`${w98.small} font-bold`}>대상 주문 없음</p>
          <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>
            마감시각이 지난 ALLOCATED 주문이 없어 웨이브를 만들지 않았습니다. 마감시각을
            늦추거나, 주문을 먼저 투입한 뒤 다시 시도하세요.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t-2 border-[color:var(--surface-dim)] p-2">
          <Btn onClick={onClose} className="h-7 w-24 font-bold">
            닫기
          </Btn>
        </div>
      </>
    );
  }

  /* Stage 11B(§15.8) 웨이브 용량 분할 — 마감 대상이 유휴 토트 수를 넘으면 웨이브가
   * 여러 개("-2"·"-3" 접미) 생긴다. `waves` 가 2건 이상이면 목록으로 보여주고, 1건
   * 이하(또는 옛 백엔드처럼 `waves` 필드 자체가 없으면)는 기존 단일 통계 그대로 —
   * `waveId`/`waveNo`/`orderCount`/`batchCount`/`taskCount` 가 `waves[0]` 과 같은 값으로
   * 남아 있다는 정본 §15.8 호환 규칙 덕분에 분기를 최소로 둘 수 있다. */
  const multiWave = (result.waves?.length ?? 0) > 1;
  const noToteCount = result.skippedCounts?.NO_TOTE ?? 0;

  return (
    <>
      <div className="flex flex-col gap-3 p-3">
        {multiWave ? (
          <>
            <p className={`${w98.small}`}>
              웨이브 <b className={w98.mono}>{result.waves?.length}개</b> 생성 완료 — 토트 용량을
              넘어 나눠졌습니다
            </p>
            <Sunken className={`${w98.scroll} max-h-40 overflow-y-auto`}>
              <table className="w-full border-collapse text-left text-[12px]">
                <thead className="sticky top-0 bg-[color:var(--surface)]">
                  <tr>
                    <th className="border-b-2 border-[color:var(--border)] p-1.5 font-bold">웨이브</th>
                    <th className="border-b-2 border-[color:var(--border)] p-1.5 font-bold">주문</th>
                    <th className="border-b-2 border-[color:var(--border)] p-1.5 font-bold">배치</th>
                  </tr>
                </thead>
                <tbody>
                  {result.waves?.map((w) => (
                    <tr key={w.waveId} className="border-t border-[color:var(--border)]">
                      <td className={`${w98.mono} p-1.5`}>{w.waveNo}</td>
                      <td className={`${w98.mono} p-1.5`}>{w.orders}</td>
                      <td className={`${w98.mono} p-1.5`}>{w.batches}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Sunken>
          </>
        ) : (
          <>
            <p className={`${w98.small}`}>
              <b className={w98.mono}>{result.waveNo}</b> 생성 완료
            </p>
            <div className="grid grid-cols-3 gap-2">
              <ResultStat label="주문" value={result.orderCount} />
              <ResultStat label="배치" value={result.batchCount} />
              <ResultStat label="태스크" value={result.taskCount} />
            </div>
          </>
        )}

        {/* Stage 11B(§15.8) — 호출 하나는 유휴 토트가 허용하는 만큼만 웨이브 하나를 만든다
         * (백엔드 노트 §1.10 "브리프의 '웨이브 3개' 는 만들 수 없다"). 나머지는 ALLOCATED
         * 로 남아 다음 호출이 담아간다 — 토트는 포장 완료 때만 돌아오므로 이번 호출 안에서
         * 바로 두 번째 웨이브가 서지 않는다(라이브 대조). `skippedCounts.NO_TOTE` 가 그
         * 대기 건수다. */}
        {noToteCount > 0 ? (
          <p className={`${w98.small} font-bold text-[color:var(--status-error)]`}>
            토트 부족으로 다음 웨이브 대기 {noToteCount}건
          </p>
        ) : null}

        <Etched />

        <span className={`${w98.small} font-bold`}>
          skipped {result.skipped.length > 0 ? `(${result.skipped.length}건)` : "— 없음"}
        </span>
        {result.skipped.length > 0 ? (
          <Sunken className={`${w98.scroll} h-32 overflow-y-auto p-1.5`}>
            <ul className="flex flex-col gap-1">
              {result.skipped.map((skipped, index) => (
                <li key={index} className={`${w98.small} border-t border-[color:var(--border)] pt-1`}>
                  <span className={w98.mono}>
                    {skipped.receiptNo} ·{" "}
                    <b className="text-[color:var(--status-error)]">{skipped.reason}</b>
                  </span>
                  {skipped.detail !== undefined ? (
                    <span className={`${w98.mono} block text-[11px] text-[color:var(--muted-foreground)]`}>
                      {Object.entries(skipped.detail)
                        .map(([key, value]) => `${key}=${String(value)}`)
                        .join(" · ")}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Sunken>
        ) : null}
      </div>

      <div className="flex justify-end gap-2 border-t-2 border-[color:var(--surface-dim)] p-2">
        <Btn onClick={onClose} className="h-7 w-24 font-bold">
          닫기
        </Btn>
      </div>
    </>
  );
}

function ResultStat({ label, value }: { label: string; value: number }) {
  return (
    <Sunken className="flex flex-col items-center gap-0.5 py-1.5">
      <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>{label}</span>
      <span className={`${w98.mono} text-[18px] font-bold`}>{value}</span>
    </Sunken>
  );
}
