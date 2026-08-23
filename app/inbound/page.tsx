"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import type {
  ConfirmRequest,
  Dimensions,
  Handling,
  MeasurementResponse,
  ProductImagesResponse,
  ScanResponse,
  StockInResponse,
} from "@/lib/types";
import { ActionButtons } from "./_components/action-buttons";
import { BarcodeScanRow } from "./_components/barcode-scan-row";
import { HandlingPanel } from "./_components/handling-panel";
import { ManualInputDialog } from "./_components/manual-input-dialog";
import { MeasurementPanel } from "./_components/measurement-panel";
import { ProductInfoPanel } from "./_components/product-info-panel";
import { ProductPhotoPanel } from "./_components/product-photo-panel";
import { QuantityPanel } from "./_components/quantity-panel";
import {
  useBarcodeScan,
  useConfirmMeasurement,
  useMeasure,
  useProductImages,
  useStockIn,
} from "./_data/use-inbound";

/**
 * 입고 등록 화면 — P1 담당 (docs/05-team-plan.md §2)
 *
 * 레이아웃은 **디자인 확정본**(라이브: p1-terminal.vercel.app)을 그대로 옮긴 것이다.
 * 이전 Stitch 샘플 기준 레이아웃(전체 폭 바코드 바 + 판정 카드 + 1.8:1 2단)은 폐기됐다 —
 * 그 비율 산정은 "본문 폭이 뷰포트에 따라 변한다"는 전제 위에 있었는데, 앱 셸이
 * 1600×1004 고정 스테이지로 바뀌면서 전제 자체가 사라졌다(app/layout.tsx). 지금 본문은
 * **정확히 1445×940px** 이고 스크롤이 없다. 넘치면 잘린다.
 *
 * ── 세로·가로 예산 (검산) ────────────────────────────────────────────────
 *   main 안쪽 = 1445 - 24 × 940 - 24 = 1421 × 916   (p-grid-gap 12px 은 layout.tsx 가 이미 준다)
 *   가로: 좌 920 + gap 12 + 우 flex-1(489) = 1421
 *   좌 920 세로: 283 + 12 + 366 + 12 + 243 = 916 ✓
 *   우 489 세로: 96 + 12 + [flex-1] + 12 + 188 + 12 + 84 + 12 + 216 = 916
 *                → flex-1(제품 정보) = 916 - 608 - 48 = 284 ✓
 *   각 패널이 자기 높이를 스스로 들고 있고(h-[...] + shrink-0), 늘어나는 칸은 제품 정보
 *   하나뿐이다. 그래서 어떤 상태에서도 세로 합이 916 을 넘지 않는다.
 *
 * 호출 순서 (docs/02-api-spec.md §5)
 *   1-1 scan → 1-3 measure → [게이트 미통과 시 재촬영 or 수동 입력] → 1-4 confirm → 1-5 stock-in
 *   래퍼는 `@/lib/endpoints` 의 `inbound` 를 쓴다.
 *
 * 재고는 1-5 에서만 늘어난다 (D-09) — 1-4 확정은 치수만 확정하고 inventory_tx 를 만들지 않는다.
 *
 * ⚠️ 분류는 **표시 전용**이다 (D-21). 1-2 `POST /inbound/products` 와 1-7 `GET /categories` 가
 *    v0.5 에서 삭제되어, 작업자가 분류를 고르는 UI 도 수기 등록 폼도 만들지 않는다.
 *    UNKNOWN 은 안내 후 흐름 종료다. 관련 TODO(P1) 세 개(수기 등록 폼 / useCreateProduct /
 *    이름→코드 역조회)는 전부 소멸했다.
 *
 * ── 이 파일의 역할: 컨테이너 ──────────────────────────────
 * 데이터를 받는 곳과 화면을 그리는 곳을 나눠 놨다(출고 포장 화면과 같은 구조다).
 *   `_data/use-inbound.ts`  데이터를 가져온다 (지금은 mock, 나중에 실제 API)
 *   `_components/*`         받은 값을 그리기만 한다 (fetch 없음, props 만)
 *   `page.tsx` (이 파일)    둘을 이어 붙이고 화면 상태를 들고 있다
 */
export default function InboundPage() {
  /* ── 화면 상태 (서버 데이터가 아닌 것만 여기서 관리) ────── */
  /** 스캔 입력창에 지금 찍혀 있는 문자열. 작업 중이라 한 자 칠 때마다 바뀐다 */
  const [barcode, setBarcode] = useState("");
  /**
   * **조회를 실행한** 바코드. 우상단 EAN-13 그래픽은 이 값만 그린다 (사용자 결정).
   * 입력란 값과 일부러 나눠 둔 상태다 — 근거는 `_components/barcode-scan-row.tsx` 상단 주석.
   * 성공 여부와 무관하게 "실행한 값"이라 1-1 을 보내는 시점에 박는다. UNKNOWN 이나
   * 네트워크 실패로 끝나도 방금 무엇을 조회했는지가 그래픽에 그대로 남아야 하기 때문이다.
   */
  const [scannedBarcode, setScannedBarcode] = useState("");
  /** 수동 입력 모달이 열려 있는가. 측정 실패면 아래에서 자동으로 연다 (§1-3) */
  const [isManualOpen, setIsManualOpen] = useState(false);
  /** 입고할 수량 — 촬영에 쓴 실물을 포함한 전체 수량이다 (D-09) */
  const [qty, setQty] = useState(1);
  /** 1-4 요청의 handling. 기본값은 1-3 응답의 handlingDefaults 에서 깔린다 */
  const [handling, setHandling] = useState<Handling>(EMPTY_HANDLING);
  /**
   * 수동 입력 모달에서 `적용` 한 값. null 이면 아직 수기 경로가 아니다.
   * 이 값이 채워지면 `DB 입력` 이 **MANUAL 경로로 해제**된다 — 게이트 미통과·측정 실패의
   * 두 해제 수단 중 하나다(§1-3). `weightKg: null` 은 "세션 저울값을 그대로 쓴다"는 뜻이다.
   */
  const [manual, setManual] = useState<{ dims: Dimensions; weightKg: number | null } | null>(null);

  /* ── 데이터 ────────────────────────────────────────────── */
  const scan = useBarcodeScan(); // 1-1
  const measure = useMeasure(); // 1-3
  const confirm = useConfirmMeasurement(); // 1-4
  const stockIn = useStockIn(); // 1-5

  /** 1-1 로 잡힌 상품. UNKNOWN 이면 계약대로 null 이다 */
  const product = scan.data?.product ?? null;
  const measurement = measure.data;
  const isConfirmed = confirm.data !== undefined;

  /**
   * 1-6 제품 원본 이미지 — **확정 후에만** 켠다.
   * 확정 전에는 1-3 응답의 images 를 쓰고, 확정되면 세션이 닫히므로 이쪽으로 옮긴다.
   * 두 응답 모두 MeasurementImage 배열이라 사진 패널은 바뀌지 않는다.
   */
  const productImagesQuery = useProductImages(
    isConfirmed && product !== null ? product.productId : null,
  );

  /* ── 사진 (1-3 → 확정 후 1-6) ──────────────────────────── */
  const images = isConfirmed
    ? (productImagesQuery.data?.images ?? [])
    : measurement?.status === "INFERRED"
      ? measurement.images
      : [];

  const sourceLabel =
    productImagesQuery.data === undefined
      ? null
      : IMAGE_SOURCE_LABEL[productImagesQuery.data.source];

  /* ── 무엇을 누를 수 있는가 ──────────────────────────────── */
  const isBusy = scan.isPending || measure.isPending || confirm.isPending || stockIn.isPending;

  const plan = buildSubmitPlan({
    scanResult: scan.data,
    measurement,
    isConfirmed,
    manual,
    stockInResult: stockIn.data,
  });

  /**
   * 게이트 미통과·측정 실패라 "해제 수단 두 갈래"를 제시해야 하는 상태인가 (§1-3).
   * 이 값이 true 면 하단 `촬영`(재촬영)과 우상단 `수동 입력` 양쪽에 같은 강조가 켜진다 —
   * 두 곳이 동시에 빛나는 것이 "길이 둘"이라는 표현 그 자체다.
   * 수기 치수를 이미 적용했으면(manual !== null) 갈래가 정해진 것이므로 끈다.
   */
  const isUnlockUrged =
    measurement !== undefined &&
    !isConfirmed &&
    manual === null &&
    (measurement.status === "MEASURE_FAILED" || !measurement.gatePassed);

  /** 재측정도 같은 1-3 이다 (§1-3). 확정·입고가 끝난 뒤에는 새 바코드부터 시작한다 */
  const canCapture = product !== null && !isBusy && !isConfirmed && stockIn.data === undefined;
  /** 1-4 MANUAL 은 sessionId 가 있어야 성립하므로, 촬영 전에는 수동 입력을 열지 않는다 */
  const canManualInput = measurement !== undefined && !isConfirmed && !isBusy;

  /* ── 이벤트 ────────────────────────────────────────────── */
  const handleScan = useCallback(() => {
    // 조회를 "실행한" 값을 여기서 확정한다 — 응답을 기다리지 않는다(위 상태 주석 참고)
    setScannedBarcode(barcode.trim());
    scan.mutate(barcode, {
      onSuccess: () => {
        // 새 바코드를 잡으면 이전 상품의 화면 상태를 전부 버린다
        measure.reset();
        confirm.reset();
        stockIn.reset();
        setIsManualOpen(false);
        setManual(null);
        setHandling(EMPTY_HANDLING);
        setQty(1);
      },
    });
  }, [barcode, scan, measure, confirm, stockIn]);

  /** 촬영 = 첫 촬영과 재촬영을 겸한다. 재촬영은 같은 productId 로 1-3 재호출 (§1-3) */
  const handleCapture = useCallback(() => {
    if (product === null) return;
    // 재촬영하면 새 세션이 열리므로 이전 확정 결과와 수기 입력값은 이 화면과 무관해진다
    confirm.reset();
    setManual(null);
    measure.mutate(product.productId, {
      onSuccess: (result) => {
        // 취급속성 기본값은 서버의 category_attribute_map 에서 온다 (§1-3)
        setHandling(result.status === "INFERRED" ? result.handlingDefaults : EMPTY_HANDLING);
        // §1-3 이 정한 동작: 측정 실패면 수동 입력 fallback 을 자동으로 연다
        setIsManualOpen(result.status === "MEASURE_FAILED");
      },
    });
  }, [product, measure, confirm]);

  const handleApplyManual = useCallback((dims: Dimensions, weightKg: number | null) => {
    setManual({ dims, weightKg });
    setIsManualOpen(false);
  }, []);

  /**
   * `DB 입력` 하나가 필요한 것만 순차로 부른다 (버튼 합침 결정 — action-buttons.tsx 주석).
   *   STOCK_IN               1-5 만
   *   CONFIRM_THEN_STOCK_IN  1-4 confirm 성공 → onSuccess 에서 1-5 연쇄
   * 확정이 실패하면 연쇄가 끊겨 입고도 일어나지 않는다 — `dimStatus=NONE` 인 채 재고만
   * 늘어나는 경로는 없다.
   */
  const handleDbSubmit = useCallback(() => {
    if (product === null || plan.kind === "BLOCKED") return;

    const runStockIn = () => {
      stockIn.mutate(
        { productId: product.productId, qty },
        {
          onSuccess: (result) => {
            toast.success(`입고 완료 — ${product.name} 현재 재고 ${result.stockQty}개`);
            // TODO(P1): 입고 후 화면을 어디까지 비울지 정한다. 출고 포장 화면은 완료 시
            //   전부 비우고 다음 토트를 받지만, 입고는 같은 상품을 나눠 넣는 경우가 있어
            //   비우면 오히려 방해가 될 수 있다. 지금은 아무것도 비우지 않고, 대신
            //   `DB 입력` 을 잠가 중복 입고만 막는다(buildSubmitPlan 첫 분기).
          },
          onError: (error) => toast.error("입고에 실패했습니다", { description: error.message }),
        },
      );
    };

    if (plan.kind === "STOCK_IN") {
      runStockIn();
      return;
    }

    if (measurement === undefined) return; // 타입 좁히기용 — plan 이 이미 보장한다
    const body: ConfirmRequest =
      plan.method === "MANUAL" && manual !== null
        ? { method: "MANUAL", dims: manual.dims, weightKg: manual.weightKg, handling }
        : // 세션 저울값을 쓰라는 뜻으로 null 을 보낸다 (§1-4 — 생략/null 이면 measured_weight_kg)
          { method: "APPROVE", weightKg: null, handling };

    confirm.mutate(
      { sessionId: measurement.sessionId, body },
      {
        onSuccess: runStockIn,
        onError: (error) => {
          const { title, detail } = describeConfirmFailure(error);
          toast.error(title, { description: detail });
        },
      },
    );
  }, [product, plan, measurement, manual, handling, qty, stockIn, confirm]);

  /* ── 표시 ──────────────────────────────────────────────── */
  return (
    <div className="gap-grid-gap flex h-full">
      {/* ── 좌 920px (확정본 72~144행) ─────────────────────── */}
      <div className="gap-grid-gap flex w-[920px] shrink-0 flex-col">
        {/* 1-3. 가로·세로·높이는 추론값이고 무게는 저울 실측값이라 게이트와 무관하다.
            신뢰도·게이트 사유도 이 패널이 그린다(계약 필수 UI ②). */}
        <MeasurementPanel
          data={measurement}
          isLoading={measure.isPending}
          error={measure.error?.message ?? null}
        />

        {/* 확정 전에는 1-3 의 images, 확정 후에는 1-6 응답이다(위 images 계산 참고).
            ⚠️ mock 단계에는 이미지 파일이 없어 회색 자리표시가 대신 그려진다.
            메인·서브 두 패널을 한 부품이 그린다 — 계약이 주는 건 배열 하나뿐이라
            어느 장이 메인인지가 배열 순서로만 정해지기 때문이다. */}
        <ProductPhotoPanel
          images={images}
          isLoading={measure.isPending || productImagesQuery.isLoading}
          sourceLabel={sourceLabel}
        />
      </div>

      {/* ── 우 489px (확정본 146~240행) ────────────────────── */}
      <div className="gap-grid-gap flex min-w-0 flex-1 flex-col">
        {/* 1-1 진입점. 못 찾은 바코드도 200 + UNKNOWN 이라 이 행의 에러 자리는 평소 비어 있다 */}
        <BarcodeScanRow
          value={barcode}
          scannedValue={scannedBarcode}
          onChange={setBarcode}
          onScan={handleScan}
          isPending={scan.isPending}
          error={scan.error?.message ?? null}
          canManualInput={canManualInput}
          onOpenManual={() => setIsManualOpen(true)}
          isManualUrged={isUnlockUrged}
        />

        {/* 1-1 표시값 + 판정 배지(계약 필수 UI ①) + 분류 읽기 전용(계약 필수 UI ③, D-21) */}
        <ProductInfoPanel result={scan.data} isPending={scan.isPending} />

        {/* 1-4 요청의 handling. 확정 경로가 아니면 나갈 곳이 없어 잠근다 */}
        <HandlingPanel
          value={handling}
          onChange={setHandling}
          disabled={product === null || isConfirmed || measurement === undefined}
        />

        {/* 1-5 의 qty. ★ 상품이 잡히면 항상 활성이다 — 확정 여부를 보지 않는다(수량 게이트 제거) */}
        <QuantityPanel qty={qty} onQtyChange={setQty} disabled={product === null} />

        {/* 촬영(1-3) / DB 입력(1-4 → 1-5 연쇄) */}
        <ActionButtons
          captureLabel={measurement === undefined ? "촬영" : "재촬영"}
          canCapture={canCapture}
          isCapturing={measure.isPending}
          isCaptureUrged={isUnlockUrged}
          onCapture={handleCapture}
          canSubmit={plan.kind !== "BLOCKED" && !isBusy}
          isSubmitting={confirm.isPending || stockIn.isPending}
          submitHint={plan.hint}
          onSubmit={handleDbSubmit}
        />
      </div>

      {/* 확정본 242~287행. Radix Dialog 라 여기 자리에는 DOM 이 생기지 않는다(포탈) */}
      <ManualInputDialog
        open={isManualOpen}
        onOpenChange={setIsManualOpen}
        measurement={measurement}
        onApply={handleApplyManual}
      />
    </div>
  );
}

/* ── DB 입력 한 번이 무엇을 부를지 ───────────────────────── */

type SubmitPlan =
  /** 1-5 만 부른다 — 치수가 이미 확정된 상품 */
  | { kind: "STOCK_IN"; hint: string }
  /** 1-4 confirm 성공 뒤 1-5 를 연쇄로 부른다 */
  | { kind: "CONFIRM_THEN_STOCK_IN"; method: "APPROVE" | "MANUAL"; hint: string }
  /** 지금은 누를 수 없다. hint 가 그 이유다 */
  | { kind: "BLOCKED"; hint: string };

/**
 * 확정(1-4)과 입고(1-5)를 버튼 하나로 합친 뒤, "지금 무엇이 나가야 하는가"를 한 곳에서 정한다.
 * 순수 함수라 화면 상태만 보고 판정하며 API 를 부르지 않는다.
 *
 * ⚠️ 이것이 이전 `canStockIn = judgment === "REGISTERED" || isConfirmed` 게이트를 대체한다.
 *    게이트를 없앤 게 아니라 **수량 칸에서 버튼으로 옮긴 것**이다. 잠기는 조건 자체는
 *    오히려 늘었다(무게 미확정·게이트 미통과·측정 실패가 전부 여기서 걸린다).
 */
function buildSubmitPlan({
  scanResult,
  measurement,
  isConfirmed,
  manual,
  stockInResult,
}: {
  scanResult: ScanResponse | undefined;
  measurement: MeasurementResponse | undefined;
  isConfirmed: boolean;
  manual: { dims: Dimensions; weightKg: number | null } | null;
  stockInResult: StockInResponse | undefined;
}): SubmitPlan {
  /* 이미 넣었다 — 두 번 누르면 재고가 두 번 는다.
     ⚠️ 계약(§1-5)에 멱등 규정이 없어 서버가 막아 주지 않는다. 그래서 화면이 막는다.
     TODO(P1): 백엔드에 멱등 키를 요청할지, 화면 잠금으로 둘지 정하면 여기를 고친다. */
  if (stockInResult !== undefined) {
    return {
      kind: "BLOCKED",
      hint: `입고 완료 · 현재 재고 ${stockInResult.stockQty}개 — 새 바코드를 스캔하세요`,
    };
  }

  if (scanResult?.product == null) {
    // UNKNOWN 은 안내 후 종료다 — 등록 폼도 분류 선택도 없다 (D-21, §1-1)
    return {
      kind: "BLOCKED",
      hint:
        scanResult?.judgment === "UNKNOWN"
          ? "코리안넷 마스터에 없는 상품 — 입고 대상이 아닙니다"
          : "바코드를 스캔하세요 (1-1)",
    };
  }

  // 이번 화면에서 방금 확정했거나(1-4 성공), 애초에 치수가 확정된 상품(REGISTERED)
  if (isConfirmed) return { kind: "STOCK_IN", hint: "치수 확정됨 · 1-5 입고" };
  if (scanResult.judgment === "REGISTERED") {
    return { kind: "STOCK_IN", hint: "치수가 이미 확정된 상품 · 1-5 입고만 나갑니다" };
  }

  /* 여기부터 NEW — 촬영·확정을 거쳐야 한다 */
  if (measurement === undefined) {
    return { kind: "BLOCKED", hint: "촬영이 필요합니다 — 왼쪽 촬영 버튼 (1-3)" };
  }

  // 수기 치수를 적용했으면 게이트와 무관하게 MANUAL 로 확정할 수 있다 (§1-4 는 항상 허용)
  if (manual !== null) {
    if (manual.weightKg == null && measurement.weightKg == null) {
      return { kind: "BLOCKED", hint: "무게가 없습니다 — 수동 입력에서 무게를 채우세요" };
    }
    return {
      kind: "CONFIRM_THEN_STOCK_IN",
      method: "MANUAL",
      hint: "수기 치수 적용됨 · 1-4 MANUAL → 1-5 입고",
    };
  }

  /* ★ 해제 수단은 두 가지뿐이다 — 재촬영(1-3 재호출) 또는 수기 확정(1-4 MANUAL). §1-3 */
  if (measurement.status === "MEASURE_FAILED") {
    return {
      kind: "BLOCKED",
      hint: `측정 실패 (${measurement.failReason}) — 재촬영하거나 수동 입력으로 확정하세요`,
    };
  }
  if (!measurement.gatePassed) {
    return {
      kind: "BLOCKED",
      hint: `게이트 미통과 (${measurement.gateFailReasons.join(" · ")}) — 재촬영 또는 수동 입력`,
    };
  }

  // 무게는 게이트와 무관하지만 확정에는 필요하다 (§1-4 — 없으면 400 VALIDATION_ERROR)
  if (measurement.weightKg == null) {
    return { kind: "BLOCKED", hint: "저울값 미수신 — 수동 입력에서 무게를 채우세요" };
  }

  return { kind: "CONFIRM_THEN_STOCK_IN", method: "APPROVE", hint: "1-4 승인 → 1-5 입고" };
}

/* ── 조각 ────────────────────────────────────────────────── */

/** 1-6 응답의 source 를 사람 말로 — 사진이 촬영 원본인지 마스터 대체인지 알려 준다 */
const IMAGE_SOURCE_LABEL: Record<ProductImagesResponse["source"], string> = {
  MEASUREMENT: "측정 원본",
  MASTER_FALLBACK: "마스터 대체 이미지",
};

/** 촬영 전·새 스캔 직후의 취급속성. 1-3 이 오면 handlingDefaults 로 덮인다 */
const EMPTY_HANDLING: Handling = { refrigerate: false, fragile: false, irregular: false };

/**
 * 1-4 실패 안내.
 * 계약이 정한 실패는 409 `GATE_NOT_PASSED` / 409 `SESSION_ALREADY_CONFIRMED` /
 * 400 `VALIDATION_ERROR` 다. 코드별로 작업자가 할 행동이 다르므로 메시지를 가른다.
 * 판별은 `lib/api.ts` 의 `ApiError.is()` 를 쓴다 — 문자열 비교를 흩뿌리지 않기 위해서.
 *
 * ⚠️ 알림을 화면 안 카드가 아니라 toast 로 띄우는 이유: 본문이 940px 고정에 스크롤이 없어
 *    상태에 따라 늘어나는 알림 상자를 놓을 자리가 없다. Toaster 는 스테이지 밖에 있어
 *    (app/layout.tsx) 축소도 안 걸리고 항상 원본 크기로 읽힌다.
 */
function describeConfirmFailure(error: Error): { title: string; detail: string } {
  if (error instanceof ApiError) {
    if (error.is("GATE_NOT_PASSED")) {
      return {
        title: "게이트 미통과 세션은 승인할 수 없습니다",
        detail: "재촬영해서 신뢰도를 높이거나, 수동 입력으로 확정하세요.",
      };
    }
    if (error.is("SESSION_ALREADY_CONFIRMED")) {
      return {
        title: "이미 확정된 세션입니다",
        detail: "다시 확정할 수 없습니다. 새로 촬영하거나 수량 입고로 넘어가세요.",
      };
    }
    if (error.is("VALIDATION_ERROR")) {
      return {
        title: "입력값을 확정할 수 없습니다",
        detail: `${error.message} 무게가 비어 있으면 확정할 수 없습니다.`,
      };
    }
  }
  return { title: "측정 확정에 실패했습니다", detail: error.message };
}
