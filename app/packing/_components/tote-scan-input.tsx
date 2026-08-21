"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * 토트 바코드 스캔 입력 — docs/02-api-spec.md §3-5 `POST /totes/scan`.
 *
 * 순수 표시용(presentational): 여기서 API 를 부르지 않는다. 값도 결과도 전부 props 다.
 *
 * 왜 가로 한 줄인가
 *   Stitch 샘플 P2(localWork/stitch-sample.html 486~494행)에서 토트 바코드는 좌우 2단
 *   위에 걸친 **전체 폭 전용 바**다(높이 80px, 안쪽 입력 48px). 화면에 들어와서 가장 먼저
 *   하는 행동이라 다른 패널 안에 묻히면 안 된다. 그래서 라벨·입력·버튼을 한 줄로 눕혔다.
 *   입력 폭 상한(500px)도 샘플 488행을 따랐다 — 바코드는 짧아서 더 넓어도 의미가 없고,
 *   남는 자리는 오른쪽 안내/경고 문구가 쓴다.
 *
 * 왜 <form> 인가
 *   실제 바코드 스캐너는 "키보드"로 인식된다 — 값을 한 번에 타이핑한 뒤 Enter 를 보낸다.
 *   그래서 버튼 클릭뿐 아니라 Enter(=form submit)도 스캔으로 처리해야 한다.
 *   <form onSubmit> 하나로 두 경로가 모두 잡힌다.
 *
 * 왜 이렇게 큰가
 *   창고 현장에서 장갑 낀 손으로 쓰는 화면이다. Stitch 샘플의 body-input(20px = text-xl)을
 *   기준으로 입력·버튼 높이를 키웠다.
 */
export function ToteScanInput({
  value,
  onChange,
  onScan,
  isPending,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  /** 스캔 실행 — 버튼 클릭 또는 Enter */
  onScan: () => void;
  isPending: boolean;
  /** 스캔 실패 메시지 (예: 404 TOTE_NOT_ASSIGNED) */
  error?: string | null;
}) {
  const canScan = value.trim().length > 0 && !isPending;

  return (
    <form
      className="flex min-w-0 flex-1 items-center gap-3"
      onSubmit={(event) => {
        // 스캐너가 보낸 Enter 로 페이지가 새로고침되지 않도록 막는다
        event.preventDefault();
        if (!canScan) return;
        onScan();
      }}
    >
      <Label htmlFor="tote-barcode" className="shrink-0 text-lg">
        토트 바코드
      </Label>

      <Input
        id="tote-barcode"
        name="toteBarcode"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="예: T-0012"
        autoComplete="off"
        // 화면에 들어오자마자 스캐너 입력을 받을 수 있게 포커스를 준다
        autoFocus
        disabled={isPending}
        aria-invalid={error ? true : undefined}
        aria-describedby="tote-barcode-note"
        className="h-12 w-full min-w-0 max-w-[500px] flex-1 text-xl md:text-xl"
      />

      <Button type="submit" size="lg" disabled={!canScan} className="h-12 shrink-0 px-8">
        {isPending ? "조회 중…" : "스캔"}
      </Button>

      {/*
        안내와 실패 메시지가 같은 자리를 나눠 쓴다. 바 높이(80px)를 지키려고 두 줄에서
        자르되, 잘라 버리는 게 아니라 title 로 전문을 남긴다 — 창고에서 경고를 놓치면
        오출고로 이어지므로 내용을 없애지는 않는다.
      */}
      <p
        id="tote-barcode-note"
        role={error ? "alert" : undefined}
        title={error ?? undefined}
        className={`line-clamp-2 min-w-0 flex-1 text-sm ${
          error ? "font-medium text-status-error" : "text-muted-foreground"
        }`}
      >
        {error ??
          "스캐너로 읽거나 직접 입력한 뒤 Enter 를 누르세요. 같은 토트를 다시 스캔해도 안전합니다."}
      </p>
    </form>
  );
}
