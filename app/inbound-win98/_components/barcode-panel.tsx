"use client";

import { Keyboard } from "lucide-react";
import { Ean13Barcode } from "./ean-13-barcode";
import { Btn, Field, Panel, Sunken, w98 } from "./win98-ui";

/**
 * 1-1 진입점 — 목업의 `Barcode Data` 패널. 이 화면의 시작이다.
 * 못 찾은 바코드도 200 + UNKNOWN 이라(§1-1) 이 패널의 에러 자리는 평소 비어 있다.
 *
 * 목업의 키보드 버튼은 다음 시연 바코드를 받아 칸을 채우고 곧바로 조회한다. 시연장에
 * 스캐너가 없어 이 버튼이 스캐너를 대신한다. 다 쓰면 서버가 204 를 주고 버튼이 잠긴다.
 *
 * ★ 입력란 아래 EAN-13 그래픽은 목업에 없다. 그래도 남긴 이유: 조회한 값을 사람이 눈으로
 *   대조하는 유일한 수단이라(스캐너가 오독하면 여기서만 드러난다) 없애면 기능이 사라진다.
 */
export function BarcodePanel({
  value,
  scannedValue,
  onChange,
  onScan,
  isPending,
  error,
  onNextBarcode,
  isNextPending,
  hasNextBarcode,
}: {
  value: string;
  scannedValue: string;
  onChange: (value: string) => void;
  onScan: () => void;
  isPending: boolean;
  error?: string | null;
  /** 다음 시연 바코드를 받아 칸을 채우고 조회까지 실행한다 */
  onNextBarcode: () => void;
  isNextPending: boolean;
  /** 아직 남은 시연 상품이 있는지. 다 쓰면 버튼을 잠근다 */
  hasNextBarcode: boolean;
}) {
  const canScan = value.trim().length > 0 && !isPending;
  const isBusy = isPending || isNextPending;

  return (
    <Panel title="Barcode Data" className="shrink-0">
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
          placeholder="바코드"
          autoComplete="off"
          inputMode="numeric"
          autoFocus
          disabled={isBusy}
          aria-label="제품 바코드"
          aria-invalid={error ? true : undefined}
          className="h-10 min-w-0 flex-1 text-[22px] tabular-nums tracking-wide"
        />

        {/* 다음 시연 바코드 — 스캐너 자리다. 받은 값으로 곧바로 1-1 까지 실행한다.
            한 번 더 Enter 를 치게 만들면 스캐너를 흉내 내는 목적이 반감된다. */}
        <Btn
          disabled={isBusy || !hasNextBarcode}
          onClick={onNextBarcode}
          title={
            hasNextBarcode
              ? "다음 시연 상품의 바코드를 불러옵니다"
              : "입고 시연 상품을 모두 사용했습니다"
          }
          aria-label="다음 바코드 불러오기"
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
