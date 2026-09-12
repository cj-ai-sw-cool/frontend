"use client";

import { ScanBarcode } from "lucide-react";
import type { Line } from "@/lib/types";
import { Btn, Field, Panel, TrayBox, w98 } from "./win98-ui";

/**
 * 3-5 토트 스캔 — 이 화면의 진입점. 목업의 `Barcode Data` 패널을 가로로 눕힌 것이다.
 *
 * 라인 선택 칸(`LINE:`)이 목업의 `TEST:` 셀렉트 자리를 그대로 잇는다(사용자 지시:
 * "TEST 문자를 LINE으로 바꾸고... LINE A~C 있고 활성하고 있는 상태로"). 눌린 탭이 지금
 * 고른 라인이고, 배송 내역 조회(3-1)·다음 토트 발급이 이 값을 함께 쓴다 — 화면에 라인
 * 고르는 곳을 두 곳에 두지 않는다.
 *
 * 재스캔은 멱등이다 (D-14) — 같은 토트를 다시 스캔해도 안전하다.
 * TOTE_NOT_ASSIGNED(404)는 오른쪽 문구 자리에 뜬다.
 *
 * ★ 스캔에 성공하면 같은 자리를 **지금 잡고 있는 배송단위 요약**(라인·분할·토트)이 쓴다.
 *   작업자가 토트를 헷갈리지 않게 하는 것이 목적이고, 안내와 에러가 자리를 나눠 쓰므로
 *   패널 높이가 상태에 따라 흔들리지 않는다.
 *
 * 토트 바코드는 입력란에 직접 쳐서 스캔한다(Enter · Scan). "다음 토트"는 리빈 완성 큐
 * (Stage 8, 정본 §8.3 `GET /packing/queue?lineId=`)의 첫 행을 이 입력란에 채우고 곧바로
 * 조회한다 — LINE 탭에서 고른 라인 기준이다. 큐가 비어 있으면 조회 없이 안내만 보여준다.
 *
 * ★ Stage 9 — 토트를 스캔해 배송단위가 열리면 **같은 입력란**이 품목 스캔으로 모드를
 *   바꾼다(정본 §9.4 "같은 스캔 필드가 모드 전환"). 왼쪽 배지(`토트`/`품목`)가 지금 무엇을
 *   스캔하는 자리인지 알려준다 — 입력란을 두 개로 나누면 작업자가 어느 칸에 찍어야 하는지
 *   매번 헷갈린다. "재스캔"(verified_qty 전부 0)은 품목 모드에서만 의미가 있어 그때만 누를
 *   수 있다.
 */
export function ToteScanPanel({
  mode,
  value,
  onChange,
  onScan,
  isPending,
  error,
  summary,
  replenishPending,
  lines,
  linesLoading,
  selectedLineId,
  onSelectLine,
  onNextTote,
  isNextTotePending,
  queueMessage,
  onRescan,
  isRescanPending,
}: {
  /** 지금 이 입력란이 스캔하는 대상 — 배송단위가 없으면 토트, 있으면 품목(정본 §9.4) */
  mode: "tote" | "item";
  value: string;
  onChange: (value: string) => void;
  onScan: () => void;
  isPending: boolean;
  error?: string | null;
  /** 스캔에 성공했을 때만 채워진다 */
  summary: { lineName: string; seqNo: number; toteBarcode: string | null } | null;
  /** 보충 배치 처리 대기 중이면 참(정본 §9.3·§9.4 "보충 대기" 배지) */
  replenishPending: boolean;
  lines: Line[];
  linesLoading: boolean;
  selectedLineId: number | null;
  onSelectLine: (lineId: number) => void;
  /** "다음 토트" 버튼 — 정본 §8.4 "nextTote 후계" */
  onNextTote: () => void;
  isNextTotePending: boolean;
  /** 큐가 비었을 때만 채워진다(예: "대기 중인 토트 없음") — 스캔 실패(`error`)와는 다른
   * 자리를 쓰지 않는다. 같은 안내 슬롯을 나눠 쓰므로 패널 높이가 흔들리지 않는다 */
  queueMessage: string | null;
  /** "재스캔" 버튼 — 품목 모드에서만 누를 수 있다(정본 §9.4) */
  onRescan: () => void;
  isRescanPending: boolean;
}) {
  const isBusy = isPending || isNextTotePending || isRescanPending;
  const isManualEntry = value.trim().length > 0;
  const canPressScan = !isBusy && isManualEntry;
  const canPressNextTote = !isBusy && selectedLineId !== null;
  const canPressRescan = !isBusy && mode === "item";

  return (
    <Panel title="토트 스캔" className="shrink-0" bodyClassName="flex-row items-center gap-3">
      <form
        className="flex shrink-0 items-center gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          if (!isManualEntry || isBusy) return;
          onScan();
        }}
      >
        {/* 모드 배지 — 지금 입력란이 토트를 찾는 중인지, 품목을 대조하는 중인지 */}
        <span
          className={`${w98.small} shrink-0 font-bold text-[color:var(--muted-foreground)]`}
        >
          {mode === "tote" ? "토트" : "품목"}
        </span>
        <Field
          id="tote-barcode"
          name="toteBarcode"
          mono
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          autoFocus
          disabled={isBusy}
          aria-label={mode === "tote" ? "토트 바코드" : "품목 바코드"}
          aria-invalid={error ? true : undefined}
          /* ★ 28 → **40px**, 글자 15 → 17px (사용자 지적 — 너무 작았다).
                 스캐너가 쏜 값이 들어오는 칸이라, 작업자가 눈으로 확인하는 유일한 자리다. */
          className="h-10 w-64 text-[17px]"
        />
        <Btn
          disabled={!canPressScan}
          onClick={onScan}
          title="입력한 바코드로 조회합니다"
          className="flex h-10 items-center gap-1.5 px-4 text-[15px] font-bold"
        >
          <ScanBarcode className="size-5" aria-hidden />
          {isPending ? "조회 중…" : "Scan"}
        </Btn>
      </form>

      {/* "다음 토트" — 리빈 완성 큐(Stage 8, 정본 §8.4)의 첫 행을 받아 온다. 라인을 아직
          안 골랐으면 누를 수 없다(큐가 라인별이라 대상이 없다) */}
      <Btn
        disabled={!canPressNextTote}
        onClick={onNextTote}
        title={
          selectedLineId === null
            ? "먼저 LINE 을 고르세요"
            : "이 라인의 다음 토트를 스캔 입력에 채웁니다"
        }
        className="flex h-10 shrink-0 items-center px-4 text-[15px] font-bold"
      >
        {isNextTotePending ? "조회 중…" : "다음 토트"}
      </Btn>

      {/* "재스캔" — verified_qty 전부 0(정본 §9.3·§9.4). 토트 모드에서는 되돌릴 배송단위가
          없어 누를 수 없다 */}
      <Btn
        disabled={!canPressRescan}
        onClick={onRescan}
        title={mode === "tote" ? "먼저 토트를 스캔하세요" : "이 배송단위의 스캔 기록을 지웁니다"}
        className="flex h-10 shrink-0 items-center px-4 text-[15px] font-bold"
      >
        {isRescanPending ? "처리 중…" : "재스캔"}
      </Btn>

      {/* LINE 선택 — 목업의 `TEST:` 셀렉트 자리를 그대로 잇는다. 배송 내역 조회와 다음 토트
          발급이 여기서 고른 라인을 함께 쓴다. 운영 중이 아닌 라인도 목록에 남기되 고를 수 없게
          둔다 — 사라지면 세 줄이 두 줄로 줄어 헷갈린다. */}
      <div
        className={`${w98.sunken} flex shrink-0 items-center gap-1.5 bg-[color:var(--surface)] px-1.5 py-1.5`}
      >
        <span className="shrink-0 text-[14px] text-[color:var(--muted-foreground)]">LINE:</span>
        {linesLoading ? (
          <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>불러오는 중…</span>
        ) : lines.length === 0 ? (
          <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>라인 없음</span>
        ) : (
          <select
            aria-label="포장 라인"
            value={selectedLineId === null ? "" : String(selectedLineId)}
            disabled={isPending}
            onChange={(event) => onSelectLine(Number(event.target.value))}
            className={`${w98.input} ${w98.sunken} h-9 w-56 min-w-0 text-[14px]`}
          >
            {lines.map((line) => (
              <option
                key={line.lineId}
                value={String(line.lineId)}
                disabled={line.status !== "ACTIVE"}
              >
                {line.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 실패 · 큐 안내 · 요약이 같은 자리를 쓴다. 스캔 전에는 비워 둔다 — 높이는 고정폭
          컨테이너가 잡는다. ⚠️ 잘라 버리지 않고 title 로 전문을 남긴다 — 창고에서 경고를
          놓치면 오출고가 된다. */}
      {error ? (
        <p
          role="alert"
          title={error}
          className="min-w-0 flex-1 truncate text-[15px] text-[color:var(--status-error)]"
        >
          {error}
        </p>
      ) : queueMessage ? (
        <p className="min-w-0 flex-1 truncate text-[15px] text-[color:var(--muted-foreground)]">
          {queueMessage}
        </p>
      ) : summary === null ? (
        <div className="min-w-0 flex-1" />
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TrayBox size="lg">{summary.lineName}</TrayBox>
          {/* 한 주문이 박스 여러 개로 나뉠 때 몇 번째 박스인지 — "분할 {n}" 은 내부 용어라
              사용자에게는 뜻이 안 드러난다("사용자에게 보이는 말로는 어색하다", 검토 지적). */}
          <TrayBox size="lg">{summary.seqNo}번째 박스</TrayBox>
          <TrayBox size="lg" className="min-w-0">
            <span className="truncate">토트 {summary.toteBarcode ?? "—"}</span>
          </TrayBox>
          {/* 보충 배치가 아직 안 끝났으면 포장완료가 막힌다(정본 §9.3·§9.4) — 그 이유를
              여기서 바로 보여준다 */}
          {replenishPending ? (
            <TrayBox size="lg" tone="error">
              보충 대기
            </TrayBox>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
