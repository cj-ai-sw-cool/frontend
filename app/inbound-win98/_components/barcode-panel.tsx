"use client";

import { useState } from "react";
import { Keyboard } from "lucide-react";
import { Ean13Barcode } from "./ean-13-barcode";
import { Btn, Etched, Field, Panel, Sunken, w98 } from "./win98-ui";

/**
 * 1-1 진입점 — 목업의 `Barcode Data` 패널. 이 화면의 시작이다.
 * 못 찾은 바코드도 200 + UNKNOWN 이라(§1-1) 이 패널의 에러 자리는 평소 비어 있다.
 *
 * 목업은 입력란 + 키보드 아이콘 버튼 하나다. 그 버튼을 **수동 입력(치수 수기 입력)** 에
 * 배정했다 — 이 화면에서 키보드로 값을 넣는 행동이 그것 하나뿐이고(§1-3 의 해제 수단),
 * 목업 아이콘이 키보드라 뜻도 맞는다.
 *
 * ★ 입력란 아래 EAN-13 그래픽은 목업에 없다. 그래도 남긴 이유: 조회한 값을 사람이 눈으로
 *   대조하는 유일한 수단이라(스캐너가 오독하면 여기서만 드러난다) 없애면 기능이 사라진다.
 *   파인 상자 안에 얇게 눕혀서 목업의 인상을 해치지 않게 뒀다.
 */
export function BarcodePanel({
  value,
  scannedValue,
  onChange,
  onScan,
  isPending,
  error,
  canManualInput,
  onOpenManual,
  isManualUrged,
  testCases,
  onPickTest,
}: {
  value: string;
  scannedValue: string;
  onChange: (value: string) => void;
  onScan: () => void;
  isPending: boolean;
  error?: string | null;
  canManualInput: boolean;
  onOpenManual: () => void;
  isManualUrged: boolean;
  /** mock 이 알고 있는 시나리오 목록 (page.tsx 의 TEST_BARCODES) */
  testCases: { label: string; barcode: string }[];
  /** 고른 값을 입력창에 넣고 곧바로 1-1 을 실행한다 */
  onPickTest: (barcode: string) => void;
}) {
  const canScan = value.trim().length > 0 && !isPending;
  /** TEST DATA 셀렉트가 지금 가리키는 항목. 첫 항목으로 시작한다 */
  const [testIndex, setTestIndex] = useState(0);
  const picked = testCases[testIndex];

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
            아니다(UX 규칙 `input-labels`). */}
        <Field
          id="product-barcode"
          name="productBarcode"
          mono
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="스캔 또는 입력 후 Enter"
          autoComplete="off"
          inputMode="numeric"
          autoFocus
          disabled={isPending}
          aria-label="제품 바코드"
          aria-invalid={error ? true : undefined}
          className="h-7 min-w-0 flex-1 text-[15px] tabular-nums"
        />
        {/* 수동 입력 — 게이트 미통과·측정 실패일 때 눌린 상태로 강조한다. 그때 이 버튼이
            "해제 수단 두 갈래" 중 하나이기 때문이다(다른 하나는 하단 Capture, §1-3).
            ⚠️ win98 에는 링·글로우가 없다. 강조 수단이 베벨뿐이라 `pressed` 로 표현한다. */}
        <Btn
          disabled={!canManualInput}
          pressed={isManualUrged}
          onClick={onOpenManual}
          title="치수를 직접 입력합니다 (1-4 MANUAL)"
          aria-label="수동 입력"
          className="flex h-7 shrink-0 items-center justify-center px-2"
        >
          <Keyboard className="size-4" aria-hidden />
        </Btn>
      </form>

      {/* 조회한 값의 EAN-13 그래픽. 조회 중·실패면 같은 자리를 문구가 쓴다 —
          높이가 고정이라 어떤 상태에서도 아래 패널이 흔들리지 않는다. */}
      <Sunken className="mt-1 flex h-8 items-center px-1">
        {error ? (
          <p
            role="alert"
            title={error}
            className={`${w98.small} truncate text-[color:var(--status-error)]`}
          >
            {error}
          </p>
        ) : isPending ? (
          <p className={`${w98.small} truncate text-[color:var(--muted-foreground)]`}>
            조회 중…
          </p>
        ) : (
          <div className="h-full min-w-0 flex-1">
            <Ean13Barcode value={scannedValue} />
          </div>
        )}
      </Sunken>

      {/* ── TEST DATA ────────────────────────────────────────────────────────
          mock 이 알고 있는 바코드를 화면에서 바로 꽂아 볼 수 있게 한 줄 붙였다.
          목업에는 없는 줄이다 — **시연·테스트 편의를 위한 것**이고, 그래서 라벨을
          `TEST DATA` 로 명시해 실제 작업 흐름과 눈으로 구분되게 뒀다.
          ⚠️ 실제 API 로 배선할 때 이 블록과 page.tsx 의 TEST_BARCODES 를 함께 지운다.
          ⚠️ 값을 고르면 입력창에 넣고 **곧바로 조회까지** 실행한다(onPickTest = runScan).
             한 번 더 Enter 를 치게 만들면 테스트 편의라는 목적이 반감된다. */}
      <Etched className="my-1.5" />
      <div className="flex items-center gap-1">
        <span className={`${w98.small} shrink-0 text-[color:var(--muted-foreground)]`}>TEST:</span>
        <select
          aria-label="테스트 바코드 시나리오"
          value={String(testIndex)}
          disabled={isPending}
          onChange={(event) => setTestIndex(Number(event.target.value))}
          className={`${w98.input} ${w98.sunken} ${w98.small} h-6 min-w-0 flex-1`}
        >
          {testCases.map((testCase, index) => (
            <option key={testCase.barcode} value={String(index)}>
              {testCase.label} · {testCase.barcode}
            </option>
          ))}
        </select>
        <Btn
          disabled={isPending || picked === undefined}
          onClick={() => {
            if (picked === undefined) return;
            onPickTest(picked.barcode);
          }}
          title={picked === undefined ? undefined : `${picked.barcode} 로 조회합니다`}
          className={`${w98.small} h-6 shrink-0 px-2`}
        >
          Load
        </Btn>
      </div>
    </Panel>
  );
}
