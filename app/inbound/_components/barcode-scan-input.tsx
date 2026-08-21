"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Product, ScanResponse } from "@/lib/types";

/**
 * 제품 바코드 스캔 입력 — docs/02-api-spec.md §1-1 `POST /inbound/scans`.
 *
 * 순수 표시용(presentational): 여기서 API 를 부르지 않는다. 값도 결과도 전부 props 다.
 *
 * 왜 본문 안의 가로 한 줄인가
 *   Stitch 샘플에서 바코드 입력은 상단 앱바 안에 있다(818행). 우리 앱의 상단 헤더는
 *   화면 3개가 공유하는 껍데기(app/layout.tsx)라 입고 전용 입력을 넣을 수 없다.
 *   대신 출고 포장 화면이 토트 바코드를 "좌우 2단 위에 걸친 전체 폭 바"로 둔 규약을
 *   그대로 따랐다(app/packing/page.tsx). 두 화면 모두 스캔이 첫 행동이라 자리도 같아야 한다.
 *
 * 왜 form 인가
 *   실제 바코드 스캐너는 "키보드"로 인식된다 — 값을 한 번에 타이핑한 뒤 Enter 를 보낸다.
 *   그래서 버튼 클릭뿐 아니라 Enter(=form submit)도 스캔으로 처리해야 한다.
 *
 * 왜 이렇게 큰가
 *   창고 현장에서 장갑 낀 손으로 쓰는 화면이다. Stitch 샘플의 body-input(20px = text-xl)을
 *   기준으로 입력·버튼 높이를 키웠다.
 */
export function BarcodeScanInput({
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
  /**
   * 스캔 실패 메시지.
   * ⚠️ 1-1 은 못 찾은 바코드도 200 + UNKNOWN 으로 돌려주므로(§1-1) 이 자리는 평소 비어 있다.
   *    네트워크 오류·5xx 같은 진짜 실패만 들어온다.
   */
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
      <Label htmlFor="product-barcode" className="shrink-0 text-lg">
        제품 바코드
      </Label>

      <Input
        id="product-barcode"
        name="productBarcode"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="스캔 또는 직접 입력…"
        autoComplete="off"
        // 화면에 들어오자마자 스캐너 입력을 받을 수 있게 포커스를 준다
        autoFocus
        disabled={isPending}
        aria-invalid={error ? true : undefined}
        aria-describedby="product-barcode-note"
        className="h-12 w-full min-w-0 max-w-[500px] flex-1 text-xl md:text-xl"
      />

      <Button type="submit" size="lg" disabled={!canScan} className="h-12 shrink-0 px-8">
        {isPending ? "조회 중…" : "스캔"}
      </Button>

      <p
        id="product-barcode-note"
        role={error ? "alert" : undefined}
        title={error ?? undefined}
        className={`line-clamp-2 min-w-0 flex-1 text-sm ${
          error ? "font-medium text-status-error" : "text-muted-foreground"
        }`}
      >
        {error ?? "스캐너로 읽거나 직접 입력한 뒤 Enter 를 누르세요."}
      </p>
    </form>
  );
}

/**
 * 1-1 판정 결과 — REGISTERED / NEW / UNKNOWN 세 갈래.
 *
 * ⚠️ **이 컴포넌트는 뼈대만 있다.** 세 분기의 "다음 행동"은 P1 이 채운다.
 *    지금은 각 분기가 무엇을 뜻하고 무엇을 해야 하는지만 화면과 주석에 남겨 뒀다.
 *    분기 판정 자체(어떤 갈래인지)는 서버가 내려주므로 여기서 다시 계산하지 않는다.
 */
export function ScanJudgmentPanel({
  result,
  isPending,
}: {
  /** 1-1 응답. 아직 스캔 전이면 undefined */
  result?: ScanResponse;
  isPending: boolean;
}) {
  if (isPending) {
    return <Notice>바코드를 조회하는 중입니다…</Notice>;
  }

  if (result === undefined) {
    return <Notice>바코드를 스캔하면 판정 결과가 표시됩니다 (1-1)</Notice>;
  }

  switch (result.judgment) {
    /* ── 마스터 O + 치수 O ─────────────────────────────────
       촬영이 필요 없다. 계약(§1-1)이 정한 다음 행동은 "수량 입력 UI 를 열고 1-5 호출". */
    case "REGISTERED":
      return (
        <JudgmentBody
          tone="success"
          label="등록됨"
          summary="치수가 이미 확정된 상품입니다. 촬영 없이 수량만 입고하면 됩니다."
          product={result.product}
        >
          {/* TODO(P1): REGISTERED 분기의 화면 동작을 채운다.
              · 촬영/측정 확정 영역을 잠그고(치수가 이미 CONFIRMED 라 다시 찍을 이유가 없다)
                수량 입고 패널로 포커스를 옮긴다.
              · 굳이 다시 찍고 싶을 때를 위한 "재촬영" 경로를 남길지는 P1 판단이다
                (§1-3 은 같은 productId 로 1-3 을 다시 부르면 재측정이라고만 정한다).
              · 호출할 API: 1-5 POST /inbound/stock-in {productId, qty} */}
          <Todo>수량 입고 패널로 바로 이어지는 동선 (1-5)</Todo>
        </JudgmentBody>
      );

    /* ── 마스터 O + 치수 X ─────────────────────────────────
       서버가 이 시점에 product 를 upsert 해 둔 상태다. 촬영 흐름으로 들어간다. */
    case "NEW":
      return (
        <JudgmentBody
          tone="info"
          label="신규 (치수 없음)"
          summary="마스터에는 있지만 치수가 없습니다. 촬영·추론으로 치수를 확정해야 합니다."
          product={result.product}
        >
          {/* TODO(P1): NEW 분기의 화면 동작을 채운다.
              · 촬영 버튼을 눌러야 1-3 이 나가게 할지, 스캔 직후 자동으로 나가게 할지 정한다.
                (자동이면 작업자가 물건을 촬영함에 넣기 전에 찍힐 수 있다 — 그래서 지금은 수동이다)
              · 신규상품 입고 대시보드 진입이 별도 화면인지 이 화면의 상태인지도 아직 미정이다
                (§1-1 본문의 "신규상품 입고 대시보드로 진입"). 결정하면 04-decisions.md 에 남길 것.
              · 호출할 API: 1-3 POST /inbound/measurements {productId} */}
          <Todo>촬영 진입 동선 · 신규상품 입고 대시보드 연결 (1-3)</Todo>
        </JudgmentBody>
      );

    /* ── 마스터 X ─────────────────────────────────────────
       `product` 가 null 이다. 시연 시나리오상 발생하지 않는 스캐너 오독 방어 경로(§1-1). */
    case "UNKNOWN":
      return (
        <JudgmentBody
          tone="warning"
          label="미등록 바코드"
          summary="마스터에 없는 바코드입니다. 임시 마스터를 수기로 등록한 뒤 촬영합니다."
          product={null}
        >
          {/* TODO(P1): UNKNOWN 분기의 수기 등록 폼을 만든다.
              · 입력 필드는 계약이 정해 뒀다 — CreateProductRequest {gtin, name, mediumCategoryCode}.
                gtin 은 방금 스캔한 값을 그대로 채우면 된다.
              · 분류는 이름이 아니라 **코드**로 보낸다 (D-13). 드롭다운 선택지는 1-7 응답이고,
                이 화면은 이미 useCategories() 로 받아 두고 있다 — confirm-form.tsx 의
                대분류/중분류 셀렉트와 같은 목록을 재사용하면 된다.
              · 폼은 components/ui/dialog.tsx 로 띄우는 편이 자연스럽다(본문 자리를 뺏지 않는다).
              · 성공하면 응답 Product 를 1-1 결과 자리에 끼워 넣어 NEW 와 같은 흐름으로 잇는다.
              · 훅은 아직 없다 — _data/use-inbound.ts 에 useCreateProduct 를 추가할 것.
              · 호출할 API: 1-2 POST /inbound/products */}
          <Todo>수기 등록 폼 — gtin · 제품 이름 · 중분류 코드 (1-2)</Todo>
        </JudgmentBody>
      );
  }
}

/** 세 분기가 같은 자리·같은 구조를 쓰도록 껍데기를 하나로 묶었다 */
function JudgmentBody({
  tone,
  label,
  summary,
  product,
  children,
}: {
  tone: "success" | "info" | "warning";
  label: string;
  summary: string;
  /** UNKNOWN 이면 null — 계약 그대로 받는다 */
  product: Product | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={tone === "warning" ? "destructive" : "default"}>{label}</Badge>
        <span className="text-sm text-muted-foreground">{summary}</span>
      </div>

      {product !== null ? <ProductSummary product={product} /> : null}

      {children}
    </div>
  );
}

/** 1-1 응답의 `product` — 샘플이 말하는 "1단 표시 데이터" 그 자체다 (§1-1) */
function ProductSummary({ product }: { product: Product }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-2 bg-muted p-3 text-sm">
      <dt className="text-muted-foreground">제품</dt>
      <dd className="truncate font-medium" title={product.name}>
        {product.name}
      </dd>

      <dt className="text-muted-foreground">바코드</dt>
      <dd className="font-mono">{product.gtin}</dd>

      <dt className="text-muted-foreground">분류</dt>
      <dd>
        {product.categoryL} · {product.categoryM}
      </dd>

      <dt className="text-muted-foreground">치수</dt>
      <dd>{product.dimStatus === "CONFIRMED" ? "확정됨" : "미확정"}</dd>

      <dt className="text-muted-foreground">현재 재고</dt>
      <dd className="tabular-nums">{product.stockQty}개</dd>
    </dl>
  );
}

/** 아직 안 만든 자리 — 담당자가 채우면 지운다 (components/common 의 Placeholder 축소판) */
function Todo({ children }: { children: React.ReactNode }) {
  return (
    <p className="border border-dashed p-3 text-sm text-muted-foreground">
      <span className="font-medium">P1 작업 예정</span> — {children}
    </p>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="border border-dashed p-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
