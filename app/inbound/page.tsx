"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { w98Toast } from "./_components/win98-ui";
import { ApiError } from "@/lib/api";
import type {
  AsnStatus,
  ConfirmRequest,
  CreateAsnRequest,
  Dimensions,
  Handling,
  MeasurementResponse,
  ProductImagesResponse,
  ScanResponse,
  StockInResponse,
} from "@/lib/types";
import { ActionButtons } from "./_components/action-buttons";
import { ASN_STATUS_LABEL } from "./_components/asn-list-panel";
import { AsnDetailPanel } from "./_components/asn-detail-panel";
import { AsnListPanel } from "./_components/asn-list-panel";
import { AsnRegisterDialog } from "./_components/asn-register-dialog";
import { BarcodePanel } from "./_components/barcode-panel";
import { ManifestPanel } from "./_components/manifest-panel";
import { ManualInputDialog } from "./_components/manual-input-dialog";
import { MeasurementPanel } from "./_components/measurement-panel";
import { PrecautionsPanel } from "./_components/precautions-panel";
import { VisualInspectionPanel } from "./_components/visual-inspection-panel";
import {
  useArriveAsn,
  useAsnDetail,
  useAsnList,
  useCloseAsn,
  useCompleteReceipt,
  useCreateAsn,
} from "./_data/use-asn";
import {
  useBarcodeScan,
  useConfirmMeasurement,
  useMeasure,
  useProductImages,
  useSellers,
  useStockIn,
} from "./_data/use-inbound";

/**
 * 입고 등록 화면 — P1 담당 (docs/05-team-plan.md §2)
 *
 * 레이아웃은 사용자가 준 **목업 HTML**(Logistics Terminal v1.0, Windows 98 스킨)을 옮긴 것을
 * 뼈대로, Stage 3(정본 §3.6, S3.4)에서 **좌측 ASN 열**을 새로 붙였다. 목업에는 없던 열이다 —
 * 정본이 "입고 화면 좌측을 ASN 패널로"라고 못 박아서, 이 화면은 이제 3열이다:
 *   좌측    ASN 목록 + ASN 상세 (신규, S3.4)
 *   가운데  Automatic Measurement Data + Visual Inspection (기존 그대로)
 *   우측    Barcode Data / Product Manifest / 취급 주의사항 / 촬영 · 등록 (기존 그대로)
 *
 * ⚠️ 이 커밋(S3.4)은 좌측 열만 붙인다 — ASN 도착 후 미검수 품목을 우측 스캔 흐름에 잇고
 *    Stage 2 전환기(T1) 수량 패널을 검수 입력으로 바꾸는 일은 S3.5 가 한다(정본 §3.5). 그래서
 *    가운데·우측 로직은 Stage 2 그대로다 — `POST /inbound/stock-in` 도 아직 살아 있다.
 *
 * ⚠️ 좌측 열 폭(300px)·우측 열 폭(380px)은 Stage 3 목업이 없어 새로 잡은 값이다 — 예전
 *    "1390 × 872 정확히 채움" 예산과 달리 이번에는 세 열이 필요해 가운데(Visual Inspection)
 *    칸이 좁아지는 트레이드오프가 생긴다. 화면 체크에서 잘리는 곳이 있으면 조정 대상이다.
 *
 * 호출 순서 (docs/02-api-spec.md §5, 기존 그대로)
 *   1-1 scan → 1-3 measure → [게이트 미통과 시 재촬영 or 수동 입력] → 1-4 confirm → 1-5 stock-in
 *   래퍼는 `@/lib/endpoints` 의 `inbound`·`asn` 을 쓴다.
 *
 * 재고는 1-5 에서만 늘어난다 (D-09) — 1-4 확정은 치수만 확정하고 inventory_tx 를 만들지 않는다.
 *
 * ⚠️ 분류는 **표시 전용**이다 (D-21). 1-2 `POST /inbound/products` 와 1-7 `GET /categories` 가
 *    v0.5 에서 삭제되어, 작업자가 분류를 고르는 UI 도 수기 등록 폼도 만들지 않는다.
 *
 * ── 이 파일의 역할: 컨테이너 ──────────────────────────────
 * 데이터를 받는 곳과 화면을 그리는 곳을 나눠 놨다(출고 포장 화면과 같은 구조다).
 *   `_data/use-inbound.ts`  1-1~1-6 스캔·촬영·확정·수량 입고·제품 이미지
 *   `_data/use-asn.ts`      ASN 등록·도착·검수 입력·완료·마감 (Stage 3)
 *   `_components/*`         받은 값을 그리기만 한다 (fetch 없음, props 만)
 *   `page.tsx` (이 파일)    셋을 이어 붙이고 화면 상태를 들고 있다
 */
export default function InboundPage() {
  /* ── ASN 화면 상태 (좌측 열, Stage 3 신규) ──────────────── */
  const [statusFilter, setStatusFilter] = useState<AsnStatus | "ALL">("ALL");
  const [selectedAsnId, setSelectedAsnId] = useState<number | null>(null);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

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
  /**
   * Stage 2 T1 — 1-5 요청에 화주·로트번호가 필수로 붙었다(정본 §2.5). 화주는 기본값이
   * 없다(선택 필수, §2.6) — 등록 버튼은 이 값과 로트번호가 채워져야 눌린다.
   * // Stage 2 transitional (T1): replaced in Stage 3 (ASN 검수가 대체) — S3.5 가 없앤다
   */
  const [sellerCode, setSellerCode] = useState("");
  const [lotNo, setLotNo] = useState("");
  /** 빈 문자열이면 "선택 안 함" — 서버로는 null 로 보낸다 (handleDbSubmit 참고) */
  const [expiresOn, setExpiresOn] = useState("");
  /** 1-4 요청의 handling. 기본값은 1-3 응답의 handlingDefaults 에서 깔린다 */
  const [handling, setHandling] = useState<Handling>(EMPTY_HANDLING);
  /**
   * 수동 입력 모달에서 `적용` 한 값. null 이면 **추론값이 이긴 상태**다.
   * `weightKg: null` 은 "세션 저울값을 그대로 쓴다"는 뜻이다 (§1-4).
   *
   * ── ★ 우선권: 마지막에 한 것이 이긴다 (사용자 결정) ─────────────────────
   *   촬영(1-3) 성공 → 이 값을 **비운다**  → 추론값이 이긴다
   *   수기 `적용`    → 이 값을 **채운다**  → 수기값이 이기고 측정 패널이 `--` 가 된다
   *   그래서 순서가 곧 결과다:
   *     수기 → 촬영 → DB 입력  = 촬영값 저장 (촬영이 수기를 지웠다)
   *     촬영 → 수기 → DB 입력  = 수기값 저장 (수기가 추론 표시를 죽였다)
   */
  const [manual, setManual] = useState<{ dims: Dimensions; weightKg: number | null } | null>(null);

  /* ── 데이터 — 1-1~1-6 (기존, use-inbound.ts) ─────────────── */
  const scan = useBarcodeScan(); // 1-1
  const measure = useMeasure(); // 1-3
  const confirm = useConfirmMeasurement(); // 1-4
  const stockIn = useStockIn(); // 1-5
  const sellersQuery = useSellers(); // Stage 2 T1 — 화주 select. ASN 등록 폼도 재사용한다

  /* ── 데이터 — ASN·검수 (신규, use-asn.ts, Stage 3) ───────── */
  const asnListQuery = useAsnList(statusFilter === "ALL" ? undefined : { status: statusFilter });
  const asnDetailQuery = useAsnDetail(selectedAsnId);
  const createAsn = useCreateAsn();
  const arriveAsn = useArriveAsn();
  const closeAsn = useCloseAsn();
  const completeReceipt = useCompleteReceipt(selectedAsnId);

  const asnDetail = asnDetailQuery.data;
  /** 이 ASN에서 지금 검수 중인 receipt — 도착 처리로 연 것. 최대 하나만 OPEN 이다(정본 §3.3) */
  const openReceipt = asnDetail?.receipts.find((r) => r.status === "OPEN") ?? null;

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

  /**
   * `DB 입력` 이 최대 3단계(1-3 → 1-4 → 1-5)를 연쇄하므로, 지금 어느 단계인지를 버튼이
   * 직접 말한다. 통째로 "처리 중…" 하나로 두면 그게 어느 단계인지 알 수 없다.
   */
  const busyLabel = measure.isPending
    ? "촬영 중…"
    : confirm.isPending
      ? "치수 확정 중…"
      : stockIn.isPending
        ? "입고 중…"
        : "처리 중…";

  const plan = buildSubmitPlan({
    scanResult: scan.data,
    measurement,
    isConfirmed,
    manual,
    stockInResult: stockIn.data,
    sellerCode,
    lotNo,
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

  /**
   * 재측정도 같은 1-3 이다 (§1-3).
   * ⚠️ `stockIn.data === undefined` 는 이중 입고 방어다(§1-5 에 멱등 규정이 없다).
   */
  const canCapture = product !== null && !isBusy && stockIn.data === undefined;

  /**
   * 측정 패널 위에 뜨는 **행동 안내** 한 줄 — 지금 무엇을 하면 되는가.
   * 경고(게이트 미통과 등)가 있으면 패널이 그쪽을 먼저 보여 준다.
   */
  const measurementNote =
    product === null
      ? ""
      : isConfirmed
        ? "치수 확정됨 — 수량을 확인하고 등록하세요"
        : scan.data?.judgment === "REGISTERED"
          ? "REGISTERED — 촬영 없이 수량만 입고할 수 있습니다"
          : measurement === undefined
            ? "NEW — 촬영으로 치수를 측정하세요"
            : "";

  /**
   * 취급속성을 **지금 고칠 수 있는가.** 판정 기준은 "1-4 가 나가는 경로인가"다 — 취급속성은
   * 1-4 confirm 요청에만 실려 나간다.
   */
  const canEditHandling =
    product !== null && !isConfirmed && plan.kind === "CONFIRM_THEN_STOCK_IN";

  /** 왜 잠겼는지 한 줄. 잠기지 않았으면 빈 문자열이라 창에 아무것도 뜨지 않는다 */
  const precautionsNote =
    product === null
      ? "바코드를 스캔하면 수량과 취급 주의사항을 정할 수 있습니다."
      : isConfirmed
        ? "이미 확정된 상품입니다. 취급 주의사항은 더 이상 바뀌지 않습니다."
        : plan.kind === "STOCK_IN"
          ? "치수가 이미 확정된 상품이라 취급 주의사항은 저장되지 않습니다 (1-5 만 나갑니다). 수량은 그대로 쓸 수 있습니다."
          : canEditHandling
            ? ""
            : "촬영하거나 수동 입력으로 치수를 넣으면 취급 주의사항을 정할 수 있습니다. 수량은 지금도 됩니다.";

  /* ── 이벤트 — 스캔 (기존 1-1~1-5 그대로) ─────────────────── */
  const runScan = useCallback(
    (value: string) => {
      setBarcode(value);
      setScannedBarcode(value.trim());
      scan.mutate(value, {
        onSuccess: () => {
          measure.reset();
          confirm.reset();
          stockIn.reset();
          setIsManualOpen(false);
          setManual(null);
          setHandling(EMPTY_HANDLING);
          setQty(1);
          setSellerCode("");
          setLotNo("");
          setExpiresOn("");
        },
      });
    },
    [scan, measure, confirm, stockIn],
  );

  /** 화면을 처음 상태로 되돌린다 — 바코드 칸까지 비운다 */
  const clearScreen = useCallback(() => {
    setBarcode("");
    setScannedBarcode("");
    setIsManualOpen(false);
    setManual(null);
    setHandling(EMPTY_HANDLING);
    setQty(1);
    setSellerCode("");
    setLotNo("");
    setExpiresOn("");
    scan.reset();
    measure.reset();
    confirm.reset();
    stockIn.reset();
  }, [scan, measure, confirm, stockIn]);

  const handleScan = useCallback(() => runScan(barcode), [runScan, barcode]);

  const handleCapture = useCallback(() => {
    if (product === null) return;
    confirm.reset();
    measure.mutate(product.productId, {
      onSuccess: (result) => {
        setManual(null);
        setHandling(result.status === "INFERRED" ? result.handlingDefaults : EMPTY_HANDLING);
        setIsManualOpen(result.status === "MEASURE_FAILED");
      },
    });
  }, [product, measure, confirm]);

  const handleApplyManual = useCallback((dims: Dimensions, weightKg: number | null) => {
    setManual({ dims: sortAxes(dims), weightKg });
    setIsManualOpen(false);
  }, []);

  const handleDbSubmit = useCallback(() => {
    if (product === null || plan.kind === "BLOCKED") return;

    const runStockIn = () => {
      stockIn.mutate(
        {
          productId: product.productId,
          qty,
          sellerCode: sellerCode.trim(),
          lotNo: lotNo.trim(),
          expiresOn: expiresOn.trim() === "" ? null : expiresOn,
        },
        {
          onSuccess: () => {
            toast.success("입고 완료", w98Toast.success);
            clearScreen();
          },
          onError: (error) =>
            toast.error("입고에 실패했습니다", { ...w98Toast.notice, description: error.message }),
        },
      );
    };

    if (plan.kind === "STOCK_IN") {
      runStockIn();
      return;
    }

    const runConfirmThenStockIn = (sessionId: number) => {
      const body: ConfirmRequest =
        plan.method === "MANUAL" && manual !== null
          ? { method: "MANUAL", dims: manual.dims, weightKg: manual.weightKg, handling }
          : { method: "APPROVE", weightKg: null, handling };

      confirm.mutate(
        { sessionId, body },
        {
          onSuccess: runStockIn,
          onError: (error) => {
            const { title, detail } = describeConfirmFailure(error);
            toast.error(title, { ...w98Toast.notice, description: detail });
          },
        },
      );
    };

    if (measurement !== undefined) {
      runConfirmThenStockIn(measurement.sessionId);
      return;
    }

    if (plan.kind !== "CONFIRM_THEN_STOCK_IN" || plan.method !== "MANUAL") return;
    measure.mutate(product.productId, {
      onSuccess: (result) => runConfirmThenStockIn(result.sessionId),
      onError: (error) =>
        toast.error("측정 세션을 만들지 못해 확정할 수 없습니다", {
          ...w98Toast.notice,
          description: `${error.message} 수기 입력값은 그대로 남아 있습니다. 다시 DB 입력을 누르거나 촬영을 실행하세요.`,
        }),
    });
  }, [
    product,
    plan,
    measurement,
    manual,
    handling,
    qty,
    sellerCode,
    lotNo,
    expiresOn,
    stockIn,
    confirm,
    measure,
    clearScreen,
  ]);

  /* ── 이벤트 — ASN (좌측 열, Stage 3 신규) ─────────────────── */
  const handleSelectAsn = useCallback(
    (id: number) => {
      setSelectedAsnId(id);
      clearScreen();
    },
    [clearScreen],
  );

  const handleCreateAsn = useCallback(
    (body: CreateAsnRequest) => {
      createAsn.mutate(body, {
        onSuccess: (data) => {
          toast.success("ASN 등록 완료", w98Toast.success);
          setIsRegisterOpen(false);
          setSelectedAsnId(data.id);
        },
        onError: (error) =>
          toast.error("ASN 등록에 실패했습니다", { ...w98Toast.notice, description: error.message }),
      });
    },
    [createAsn],
  );

  const handleArrive = useCallback(() => {
    if (selectedAsnId === null) return;
    arriveAsn.mutate(selectedAsnId, {
      onSuccess: () => toast.success("도착 처리 완료", w98Toast.success),
      onError: (error) =>
        toast.error("도착 처리에 실패했습니다", { ...w98Toast.notice, description: error.message }),
    });
  }, [selectedAsnId, arriveAsn]);

  const handleCompleteReceipt = useCallback(() => {
    if (openReceipt === null) return;
    completeReceipt.mutate(openReceipt.id, {
      onSuccess: (data) => {
        toast.success(`검수 완료 · ASN ${ASN_STATUS_LABEL[data.asnStatus]}`, w98Toast.success);
      },
      onError: (error) =>
        toast.error("검수 완료 처리에 실패했습니다", {
          ...w98Toast.notice,
          description: error.message,
        }),
    });
  }, [openReceipt, completeReceipt]);

  const handleCloseAsn = useCallback(() => {
    if (selectedAsnId === null) return;
    closeAsn.mutate(selectedAsnId, {
      onSuccess: () => toast.success("ASN 마감 완료", w98Toast.success),
      onError: (error) =>
        toast.error("마감에 실패했습니다", { ...w98Toast.notice, description: error.message }),
    });
  }, [selectedAsnId, closeAsn]);

  /* ── 표시 ──────────────────────────────────────────────── */
  return (
    <div className="relative flex min-h-0 flex-1 gap-2">
      {/* ── 좌측 300px: ASN 목록 + 상세 (Stage 3 신규, S3.4) ── */}
      <div className="flex w-[300px] shrink-0 flex-col gap-2">
        <AsnListPanel
          items={asnListQuery.data?.content ?? []}
          isLoading={asnListQuery.isLoading}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          selectedId={selectedAsnId}
          onSelect={handleSelectAsn}
          onRegister={() => setIsRegisterOpen(true)}
        />
        <AsnDetailPanel
          detail={asnDetail}
          isLoading={asnDetailQuery.isLoading}
          onArrive={handleArrive}
          isArriving={arriveAsn.isPending}
          onCompleteReceipt={handleCompleteReceipt}
          isCompletingReceipt={completeReceipt.isPending}
          onClose={handleCloseAsn}
          isClosing={closeAsn.isPending}
        />
      </div>

      {/* ── 가운데: 측정 + 사진 (목업 center area) ────────── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        {/* 1-3. 가로·세로·높이는 추론값이고 무게는 저울 실측값이라 게이트와 무관하다.
            신뢰도·게이트 사유도 이 패널이 그린다(계약 필수 UI ②). */}
        <MeasurementPanel
          data={measurement}
          manualDims={manual?.dims ?? null}
          manualWeightKg={manual?.weightKg ?? null}
          isLoading={measure.isPending}
          error={measure.error?.message ?? null}
          note={measurementNote}
        />

        {/* 확정 전에는 1-3 의 images, 확정 후에는 1-6 응답이다(위 images 계산 참고) */}
        <VisualInspectionPanel
          images={images}
          isLoading={measure.isPending || productImagesQuery.isLoading}
          sourceLabel={sourceLabel}
          masterImageUrl={product?.imageUrl ?? null}
          productName={product?.name ?? null}
          isProductPending={scan.isPending}
        />
      </div>

      {/* ── 우측 380px: 목업 right sidebar ───────────────────
          ⚠️ 408 → **380px** — 좌측에 ASN 열(300px)이 새로 생기면서 폭 예산을 다시 나눴다. */}
      <div className="flex w-[380px] shrink-0 flex-col gap-2">
        {/* 1-1 진입점. 못 찾은 바코드도 200 + UNKNOWN 이라 에러 자리는 평소 비어 있다 */}
        <BarcodePanel
          value={barcode}
          scannedValue={scannedBarcode}
          onChange={setBarcode}
          onScan={handleScan}
          isPending={scan.isPending}
          error={scan.error?.message ?? null}
        />

        {/* 1-1 표시값 + 판정(계약 필수 UI ①) + 분류 읽기 전용(계약 필수 UI ③, D-21) */}
        <ManifestPanel result={scan.data} isPending={scan.isPending} />

        {/* Stage 2 T1 그대로 — 화주·로트·유통기한·수량. S3.5 가 검수 입력으로 바꾼다 */}
        <PrecautionsPanel
          value={handling}
          onChange={setHandling}
          disabled={!canEditHandling}
          qty={qty}
          onQtyChange={setQty}
          qtyDisabled={product === null}
          sellers={sellersQuery.data}
          sellersLoading={sellersQuery.isLoading}
          sellerCode={sellerCode}
          onSellerCodeChange={setSellerCode}
          lotNo={lotNo}
          onLotNoChange={setLotNo}
          expiresOn={expiresOn}
          onExpiresOnChange={setExpiresOn}
          note={precautionsNote}
          active={canEditHandling}
        />

        {/* 촬영(1-3) / 등록(1-4 → 1-5 연쇄) */}
        <ActionButtons
          captureLabel={measurement === undefined ? "촬영" : "재촬영"}
          canCapture={canCapture}
          isCapturing={measure.isPending}
          isCaptureUrged={isUnlockUrged}
          onCapture={handleCapture}
          canSubmit={plan.kind !== "BLOCKED" && !isBusy}
          isSubmitting={isBusy}
          submitBusyLabel={busyLabel}
          submitHint={plan.hint}
          onSubmit={handleDbSubmit}
        />
      </div>

      {/* Radix Dialog 라 여기 자리에는 DOM 이 생기지 않는다(스테이지로 포탈) */}
      <ManualInputDialog
        open={isManualOpen}
        onOpenChange={setIsManualOpen}
        measurement={measurement}
        applied={manual}
        onApply={handleApplyManual}
      />
      <AsnRegisterDialog
        open={isRegisterOpen}
        onOpenChange={setIsRegisterOpen}
        sellers={sellersQuery.data}
        sellersLoading={sellersQuery.isLoading}
        onSubmit={handleCreateAsn}
        isSubmitting={createAsn.isPending}
        error={createAsn.error?.message ?? null}
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
 * ⚠️ S3.4 커밋에서는 Stage 2 로직 그대로다 — 검수 흐름 접합은 S3.5 가 한다.
 */
function buildSubmitPlan({
  scanResult,
  measurement,
  isConfirmed,
  manual,
  stockInResult,
  sellerCode,
  lotNo,
}: {
  scanResult: ScanResponse | undefined;
  measurement: MeasurementResponse | undefined;
  isConfirmed: boolean;
  manual: { dims: Dimensions; weightKg: number | null } | null;
  stockInResult: StockInResponse | undefined;
  sellerCode: string;
  lotNo: string;
}): SubmitPlan {
  if (stockInResult !== undefined) {
    return {
      kind: "BLOCKED",
      hint: `입고 완료 · 현재 재고 ${stockInResult.stockQty}개 — 새 바코드를 스캔하세요`,
    };
  }

  if (scanResult?.product != null && (sellerCode.trim() === "" || lotNo.trim() === "")) {
    return { kind: "BLOCKED", hint: "화주와 로트번호를 입력하세요" };
  }

  if (scanResult?.product == null) {
    return {
      kind: "BLOCKED",
      hint:
        scanResult?.judgment === "UNKNOWN"
          ? "코리안넷 마스터에 없는 상품 — 입고 대상이 아닙니다"
          : "",
    };
  }

  if (manual !== null) {
    if (measurement !== undefined && manual.weightKg == null && measurement.weightKg == null) {
      return { kind: "BLOCKED", hint: "무게가 없습니다 — 수동 입력에서 무게를 채우세요" };
    }
    return {
      kind: "CONFIRM_THEN_STOCK_IN",
      method: "MANUAL",
      hint:
        measurement === undefined
          ? "수기값 저장 · 1-3 세션 확보 → 1-4 MANUAL → 1-5 입고"
          : "수기값 저장 · 1-4 MANUAL → 1-5 입고",
    };
  }

  if (isConfirmed) return { kind: "STOCK_IN", hint: "치수 확정됨 · 1-5 입고" };
  if (scanResult.judgment === "REGISTERED" && measurement === undefined) {
    return { kind: "STOCK_IN", hint: "치수가 이미 확정된 상품 · 1-5 입고만 나갑니다" };
  }

  if (measurement === undefined) {
    return { kind: "BLOCKED", hint: "치수를 측정하세요 (1-3)" };
  }

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
 * 치수 축 정렬 — D-18.
 * 서버는 `widthCm < lengthCm` 이면 **가로·세로를 스왑해서 저장**한다(높이는 건드리지 않는다).
 * 1-4 응답에는 dims 가 없어 정렬 결과를 되받을 수단이 없으므로, 화면이 저장 전 직접 돌린다.
 */
function sortAxes(dims: Dimensions): Dimensions {
  const { widthCm, lengthCm, heightCm } = dims;
  return widthCm >= lengthCm ? dims : { widthCm: lengthCm, lengthCm: widthCm, heightCm };
}

/**
 * 1-4 실패 안내.
 * 계약이 정한 실패는 409 `GATE_NOT_PASSED` / 409 `SESSION_ALREADY_CONFIRMED` /
 * 400 `VALIDATION_ERROR` 다. 코드별로 작업자가 할 행동이 다르므로 메시지를 가른다.
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
