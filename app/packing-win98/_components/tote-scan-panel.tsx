"use client";

import { ScanBarcode } from "lucide-react";
import { Btn, Field, Panel, TrayBox } from "./win98-ui";

/**
 * 3-5 토트 스캔 — 이 화면의 진입점. 목업의 `Barcode Data` 패널을 가로로 눕힌 것이다.
 *
 * 재스캔은 멱등이다 (D-14) — 같은 토트를 다시 스캔해도 안전하다.
 * TOTE_NOT_ASSIGNED(404)는 오른쪽 문구 자리에 뜬다.
 *
 * ★ 스캔에 성공하면 같은 자리를 **지금 잡고 있는 배송단위 요약**(라인·분할·토트)이 쓴다.
 *   작업자가 토트를 헷갈리지 않게 하는 것이 목적이고, 안내와 에러가 자리를 나눠 쓰므로
 *   패널 높이가 상태에 따라 흔들리지 않는다.
 */
export function ToteScanPanel({
  value,
  onChange,
  onScan,
  isPending,
  error,
  summary,
}: {
  value: string;
  onChange: (value: string) => void;
  onScan: () => void;
  isPending: boolean;
  error?: string | null;
  /** 스캔에 성공했을 때만 채워진다 */
  summary: { lineName: string; seqNo: number; toteBarcode: string | null } | null;
}) {
  const canScan = value.trim().length > 0 && !isPending;

  return (
    <Panel title="Tote Barcode — 토트 스캔" className="shrink-0" bodyClassName="flex-row items-center gap-3">
      <form
        className="flex shrink-0 items-center gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canScan) return;
          onScan();
        }}
      >
        <Field
          id="tote-barcode"
          name="toteBarcode"
          mono
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="예: T-0012"
          autoComplete="off"
          autoFocus
          disabled={isPending}
          aria-label="토트 바코드"
          aria-invalid={error ? true : undefined}
          /* ★ 28 → **40px**, 글자 15 → 17px (사용자 지적 — 너무 작았다).
                 스캐너가 쏜 값이 들어오는 칸이라, 작업자가 눈으로 확인하는 유일한 자리다. */
          className="h-10 w-64 text-[17px]"
        />
        <Btn
          disabled={!canScan}
          onClick={onScan}
          className="flex h-10 items-center gap-1.5 px-4 text-[15px] font-bold"
        >
          <ScanBarcode className="size-5" aria-hidden />
          {isPending ? "조회 중…" : "Scan"}
        </Btn>
      </form>

      {/* 실패 · 요약이 같은 자리를 쓴다. 스캔 전에는 비워 둔다 — 높이는 고정폭 컨테이너가 잡는다.
          ⚠️ 잘라 버리지 않고 title 로 전문을 남긴다 — 창고에서 경고를 놓치면 오출고가 된다. */}
      {error ? (
        <p
          role="alert"
          title={error}
          className="min-w-0 flex-1 truncate text-[15px] text-[color:var(--status-error)]"
        >
          {error}
        </p>
      ) : summary === null ? (
        <div className="min-w-0 flex-1" />
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TrayBox size="lg">라인 {summary.lineName}</TrayBox>
          <TrayBox size="lg">분할 {summary.seqNo}</TrayBox>
          <TrayBox size="lg" className="min-w-0">
            <span className="truncate">토트 {summary.toteBarcode ?? "—"}</span>
          </TrayBox>
        </div>
      )}
    </Panel>
  );
}
