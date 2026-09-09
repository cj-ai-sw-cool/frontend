"use client";

import { Keyboard } from "lucide-react";
import { Ean13Barcode } from "./ean-13-barcode";
import { Btn, Field, Panel, Sunken, w98 } from "./win98-ui";

/**
 * 1-1 진입점 — 목업의 `Barcode Data` 패널. 이 화면의 시작이다.
 * 못 찾은 바코드도 200 + UNKNOWN 이라(§1-1) 이 패널의 에러 자리는 평소 비어 있다.
 *
 * 바코드는 입력란에 직접 쳐서 조회한다(Enter · Scan) — 아래 EAN-13 그래픽이 조회한
 * 값을 사람이 눈으로 대조하는 수단이다.
 *
 * 키보드 버튼은 시연용 바코드 자동 발급이 쓰던 자리다. 후계 기능(ASN 미검수 품목
 * 선택, Stage 3)이 들어올 때까지 자리만 남기고 비활성화했다.
 */
export function BarcodePanel({
  value,
  scannedValue,
  onChange,
  onScan,
  isPending,
  error,
}: {
  value: string;
  scannedValue: string;
  onChange: (value: string) => void;
  onScan: () => void;
  isPending: boolean;
  error?: string | null;
}) {
  const canScan = value.trim().length > 0 && !isPending;
  const isBusy = isPending;

  return (
    <Panel title="바코드" className="shrink-0">
      <form
        className="flex gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canScan) return;
          onScan();
        }}
      >
        {/* ★ 보이는 라벨은 패널 제목(`Barcode Data`)이 대신한다. 스크린리더용 이름은
            aria-label 로 유지한다 — 라벨을 화면에서 없앤 것이지 접근 가능한 이름을 없앤 게
            아니다(UX 규칙 `input-labels`).
            ★ 글자를 15 → 22px 로 키웠다 (사용자 지적). 이 칸의 숫자가 화면에서 가장 먼저
              읽혀야 하는 값인데 아래 TEST 줄과 크기가 비슷해 묻혀 있었다. */}
        <Field
          id="product-barcode"
          name="productBarcode"
          mono
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          inputMode="numeric"
          autoFocus
          disabled={isBusy}
          aria-label="제품 바코드"
          aria-invalid={error ? true : undefined}
          className="h-10 min-w-0 flex-1 text-[22px] tabular-nums tracking-wide"
        />

        {/* 시연용 바코드 자동 발급 버튼이 있던 자리 — 후계 기능 대기 중이라 비활성이다 */}
        <Btn
          disabled
          title="Stage 3: ASN 미검수 품목으로 대체"
          aria-label="다음 바코드 불러오기 — 준비 중"
          className="flex h-10 shrink-0 items-center justify-center px-2.5"
        >
          <Keyboard className="size-5" aria-hidden />
        </Btn>
      </form>

      {/* 조회한 값의 EAN-13 그래픽. 조회 중·실패면 같은 자리를 문구가 쓴다 —
          높이가 고정이라 어떤 상태에서도 아래 패널이 흔들리지 않는다. */}
      <Sunken className="mt-1 flex h-10 items-center px-1">
        {error ? (
          <p
            role="alert"
            title={error}
            className={`${w98.small} truncate text-[color:var(--status-error)]`}
          >
            {error}
          </p>
        ) : isBusy ? (
          <p className={`${w98.small} truncate text-[color:var(--muted-foreground)]`}>
            조회 중…
          </p>
        ) : (
          <div className="h-full min-w-0 flex-1">
            <Ean13Barcode value={scannedValue} />
          </div>
        )}
      </Sunken>
    </Panel>
  );
}
