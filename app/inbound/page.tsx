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
  PendingReceiptItem,
  ProductImagesResponse,
  ReceiptItemCreatedResponse,
  ScanResponse,
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
import { PendingItemsPanel } from "./_components/pending-items-panel";
import { PrecautionsPanel } from "./_components/precautions-panel";
import { ReceiptInputPanel } from "./_components/receipt-input-panel";
import { VisualInspectionPanel } from "./_components/visual-inspection-panel";
import {
  useAddReceiptItem,
  useArriveAsn,
  useAsnDetail,
  useAsnList,
  useCloseAsn,
  useCompleteReceipt,
  useCreateAsn,
  usePendingItems,
  useSellerGtinStock,
} from "./_data/use-asn";
import {
  useBarcodeScan,
  useConfirmMeasurement,
  useMeasure,
  useProductImages,
  useSellers,
} from "./_data/use-inbound";

/**
 * 입고 등록 화면 — P1 담당 (docs/05-team-plan.md §2)
 *
 * 레이아웃은 사용자가 준 **목업 HTML**(Logistics Terminal v1.0, Windows 98 스킨)을 옮긴 것을
 * 뼈대로, Stage 3(정본 §3.6)에서 **좌측 ASN 열**을 새로 붙였다. 목업에는 없던 열이다 —
 * 정본이 "입고 화면 좌측을 ASN 패널로"라고 못 박아서, 이 화면은 이제 3열이다:
 *   좌측    ASN 목록 + ASN 상세 (신규)
 *   가운데  Automatic Measurement Data + Visual Inspection (기존 그대로)
 *   우측    Barcode Data / 미검수 품목(신규) / Product Manifest / 취급 주의사항 / 검수 입력(신규)
 *           / 촬영 · 등록
 *
 * ⚠️ 좌측 열 폭(300px)·우측 열 폭(380px)은 Stage 3 목업이 없어 새로 잡은 값이다 — 예전
 *    "1390 × 872 정확히 채움" 예산과 달리 이번에는 세 열이 필요해 가운데(Visual Inspection)
 *    칸이 좁아지는 트레이드오프가 생긴다. 화면 체크에서 잘리는 곳이 있으면 조정 대상이다.
 *
 * 호출 순서 (정본 §3.5·§3.6, 기존 §1-1~§1-4 계약은 그대로)
 *   ASN 등록 → 도착 처리 → 미검수 품목 클릭 → 1-1 scan → [NEW 면 1-3 measure → 1-4 confirm]
 *   → 검수 입력(수령·파손·로트·유통기한) → `POST /receipts/{id}/items` → 검수 완료 → 마감
 *   래퍼는 `@/lib/endpoints` 의 `inbound`·`asn` 을 쓴다.
 *
 * 재고는 검수 입력에서만 늘어난다(정본 §3.4 — RECEIVE tx 최대 2건). 1-4 확정은 여전히 치수만
 * 확정하고 재고를 건드리지 않는다.
 *
 * ⚠️ 분류는 **표시 전용**이다 (D-21). 1-2 `POST /inbound/products` 와 1-7 `GET /categories` 가
 *    v0.5 에서 삭제되어, 작업자가 분류를 고르는 UI 도 수기 등록 폼도 만들지 않는다.
 *
 * ⚠️ Stage 2 전환기(T1) — 수량 패널의 화주·로트·유통기한·수량 입력과 `POST /inbound/stock-in`
 *    은 이 화면에서 **사라졌다**. 화주는 ASN이, 로트는 ASN 품목이 정하고, 재고 반영은
 *    `POST /receipts/{id}/items` 하나로 합쳐졌다(정본 §3.1). `PrecautionsPanel` 은 취급
 *    주의사항 체크박스만 남았고, `ReceiptInputPanel` 이 그 자리를 이어받는다.
 *
 * ── 이 파일의 역할: 컨테이너 ──────────────────────────────
 * 데이터를 받는 곳과 화면을 그리는 곳을 나눠 놨다.
 *   `_data/use-inbound.ts`  1-1~1-6 스캔·촬영·확정·제품 이미지
 *   `_data/use-asn.ts`      ASN 등록·도착·검수 입력·완료·마감 (Stage 3)
 *   `_components/*`         받은 값을 그리기만 한다 (fetch 없음, props 만)
 *   `page.tsx` (이 파일)    셋을 이어 붙이고 화면 상태를 들고 있다
 */
export default function InboundPage() {
  /* ── ASN 화면 상태 (좌측 열) ─────────────────────────────── */
  const [statusFilter, setStatusFilter] = useState<AsnStatus | "ALL">("ALL");
  const [selectedAsnId, setSelectedAsnId] = useState<number | null>(null);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  /* ── 스캔·측정 화면 상태 (기존, 1-1~1-4 그대로) ─────────── */
  /** 스캔 입력창에 지금 찍혀 있는 문자열. 작업 중이라 한 자 칠 때마다 바뀐다 */
  const [barcode, setBarcode] = useState("");
  /** **조회를 실행한** 바코드. 우상단 EAN-13 그래픽은 이 값만 그린다 (사용자 결정) */
  const [scannedBarcode, setScannedBarcode] = useState("");
  /** 수동 입력 모달이 열려 있는가. 측정 실패면 아래에서 자동으로 연다 (§1-3) */
  const [isManualOpen, setIsManualOpen] = useState(false);
  /** 1-4 요청의 handling. 기본값은 1-3 응답의 handlingDefaults 에서 깔린다 */
  const [handling, setHandling] = useState<Handling>(EMPTY_HANDLING);
  /**
   * 수동 입력 모달에서 `적용` 한 값. null 이면 **추론값이 이긴 상태**다 (last-write-wins,
   * 상세 규약은 예전 버전 이 자리의 주석 — git 이력 참고).
   */
  const [manual, setManual] = useState<{ dims: Dimensions; weightKg: number | null } | null>(null);

  /* ── 검수 입력 상태 (신규, Stage 3) ──────────────────────
     로트는 ASN 품목이 갖고 온다 — 여기 상태는 확인·정정용이다(정본 §3.1). 미검수 품목을
     클릭하면 runScan 이 이 값들을 그 품목의 값으로 채운다(예정 수량 = 수령 수량 기본값). */
  const [selectedPendingItem, setSelectedPendingItem] = useState<PendingReceiptItem | null>(null);
  const [receivedQty, setReceivedQty] = useState(1);
  const [damagedQty, setDamagedQty] = useState(0);
  const [lotNo, setLotNo] = useState("");
  const [expiresOn, setExpiresOn] = useState("");

  /* ── 데이터 — 1-1~1-6 (use-inbound.ts) ───────────────────── */
  const scan = useBarcodeScan(); // 1-1
  const measure = useMeasure(); // 1-3
  const confirm = useConfirmMeasurement(); // 1-4
  const sellersQuery = useSellers(); // ASN 등록 폼의 화주 select

  /* ── 데이터 — ASN·검수 (use-asn.ts, Stage 3) ─────────────── */
  const asnListQuery = useAsnList(statusFilter === "ALL" ? undefined : { status: statusFilter });
  const asnDetailQuery = useAsnDetail(selectedAsnId);
  const createAsn = useCreateAsn();
  const arriveAsn = useArriveAsn();
  const closeAsn = useCloseAsn();
  const completeReceipt = useCompleteReceipt(selectedAsnId);

  const asnDetail = asnDetailQuery.data;
  /** 이 ASN에서 지금 검수 중인 receipt — 도착 처리로 연 것. 최대 하나만 OPEN 이다(정본 §3.3) */
  const openReceipt = asnDetail?.receipts.find((r) => r.status === "OPEN") ?? null;
  const activeReceiptId = openReceipt?.receiptId ?? null;
  const pendingItemsQuery = usePendingItems(activeReceiptId);
  const addReceiptItem = useAddReceiptItem(selectedAsnId);

  /** 1-1 로 잡힌 상품. UNKNOWN 이면 계약대로 null 이다 */
  const product = scan.data?.product ?? null;
  const measurement = measure.data;
  const isConfirmed = confirm.data !== undefined;

  /** 선택 ASN 화주 기준 GTIN 재고 합 — 1-1 응답의 stockQty(T5) 대신 쓴다(정본 §3.6) */
  const sellerCode = asnDetail?.sellerCode ?? null;
  const sellerStockQuery = useSellerGtinStock(sellerCode, product?.gtin ?? null);
  const stockLabel =
    sellerCode === null
      ? "ASN 미선택"
      : product === null
        ? "--"
        : sellerStockQuery.isLoading
          ? "조회 중…"
          : sellerStockQuery.data === undefined
            ? "--"
            : `${sellerStockQuery.data} (${sellerCode})`;

  /**
   * 1-6 제품 원본 이미지 — **확정 후에만** 켠다.
   * 확정 전에는 1-3 응답의 images 를 쓰고, 확정되면 세션이 닫히므로 이쪽으로 옮긴다.
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
  const isBusy = scan.isPending || measure.isPending || confirm.isPending || addReceiptItem.isPending;

  const busyLabel = measure.isPending
    ? "촬영 중…"
    : confirm.isPending
      ? "치수 확정 중…"
      : addReceiptItem.isPending
        ? "검수 등록 중…"
        : "처리 중…";

  const plan = buildSubmitPlan({
    scanResult: scan.data,
    measurement,
    isConfirmed,
    manual,
    receiptItemResult: addReceiptItem.data,
    activeReceiptId,
    receivedQty,
    damagedQty,
    lotNo,
  });

  /**
   * 게이트 미통과·측정 실패라 "해제 수단 두 갈래"를 제시해야 하는 상태인가 (§1-3).
   * 이 값이 true 면 하단 `촬영`(재촬영)과 우상단 `수동 입력` 양쪽에 같은 강조가 켜진다.
   */
  const isUnlockUrged =
    measurement !== undefined &&
    !isConfirmed &&
    manual === null &&
    (measurement.status === "MEASURE_FAILED" || !measurement.gatePassed);

  /**
   * 재측정도 같은 1-3 이다 (§1-3). 확정 뒤 재촬영은 새 세션을 열고 그 값이 다시 이긴다.
   * `addReceiptItem.data === undefined` 는 이중 검수 등록 방어다(§3.5 에 멱등 규정이 없다).
   */
  const canCapture = product !== null && !isBusy && addReceiptItem.data === undefined;

  /**
   * 측정 패널 위에 뜨는 **행동 안내** 한 줄 — 지금 무엇을 하면 되는가.
   * 경고(게이트 미통과 등)가 있으면 패널이 그쪽을 먼저 보여 준다.
   */
  const measurementNote =
    product === null
      ? ""
      : isConfirmed
        ? "치수 확정됨 — 수령 수량을 확인하고 등록하세요"
        : scan.data?.judgment === "REGISTERED"
          ? "REGISTERED — 촬영 없이 검수 입력으로 넘어갈 수 있습니다"
          : measurement === undefined
            ? "NEW — 촬영으로 치수를 측정하세요"
            : "";

  /**
   * 취급속성을 **지금 고칠 수 있는가.** 1-4 가 나가는 경로인가로 판정한다 — 취급속성은
   * 1-4 confirm 요청에만 실려 나간다(치수가 이미 확정된 상품은 저장될 곳이 없다).
   */
  const canEditHandling =
    product !== null && !isConfirmed && plan.kind === "CONFIRM_THEN_RECEIPT_ITEM";

  /** 왜 잠겼는지 한 줄. 잠기지 않았으면 빈 문자열이라 창에 아무것도 뜨지 않는다 */
  const handlingNote =
    product === null
      ? "바코드를 스캔하면 취급 주의사항을 정할 수 있습니다."
      : isConfirmed
        ? "이미 확정된 상품입니다. 취급 주의사항은 더 이상 바뀌지 않습니다."
        : plan.kind === "RECEIPT_ITEM"
          ? "치수가 이미 확정된 상품이라 취급 주의사항은 저장되지 않습니다 (검수 등록만 나갑니다)."
          : canEditHandling
            ? ""
            : "촬영하거나 수동 입력으로 치수를 넣으면 취급 주의사항을 정할 수 있습니다.";

  /** 검수 입력 칸이 왜 잠겼는지 한 줄 */
  const receiptNote =
    activeReceiptId === null
      ? "ASN을 선택하고 도착 처리해야 검수를 입력할 수 있습니다."
      : product === null
        ? "미검수 품목을 클릭하거나 바코드를 스캔하면 검수 수량을 입력할 수 있습니다."
        : "";
  const receiptFieldsDisabled = activeReceiptId === null || product === null || isBusy;

  /* ── 이벤트 — 스캔 ─────────────────────────────────────── */
  /**
   * 1-1 조회 — **값을 인자로 받는다** (미검수 품목 클릭에서도 같은 함수를 쓴다).
   * `pendingItem` 을 넘기면 성공 시 검수 입력 기본값(수령=예정, 로트·유통기한)을 그 품목의
   * 값으로 채운다. 바코드 입력란에서 직접 조회했으면 null 이다 — 예정 수량을 알 수 없다.
   */
  const runScan = useCallback(
    (value: string, pendingItem: PendingReceiptItem | null = null) => {
      setBarcode(value);
      setScannedBarcode(value.trim());
      scan.mutate(value, {
        onSuccess: () => {
          measure.reset();
          confirm.reset();
          addReceiptItem.reset();
          setIsManualOpen(false);
          setManual(null);
          setHandling(EMPTY_HANDLING);
          setSelectedPendingItem(pendingItem);
          // 기본값은 remainingQty(예정 - 지금까지 수령) — expectedQty 가 아니다. 분할 납품에서
          // 이미 일부 받은 품목이면 이번 도착에 받을 것으로 기대하는 수량이 더 작다.
          setReceivedQty(pendingItem?.remainingQty ?? 1);
          setDamagedQty(0);
          setLotNo(pendingItem?.lotNo ?? "");
          setExpiresOn(pendingItem?.expiresOn ?? "");
        },
      });
    },
    [scan, measure, confirm, addReceiptItem],
  );

  /** 화면을 처음 상태로 되돌린다 — 바코드 칸까지 비운다. ASN 선택은 건드리지 않는다 */
  const clearScreen = useCallback(() => {
    setBarcode("");
    setScannedBarcode("");
    setIsManualOpen(false);
    setManual(null);
    setHandling(EMPTY_HANDLING);
    setSelectedPendingItem(null);
    setReceivedQty(1);
    setDamagedQty(0);
    setLotNo("");
    setExpiresOn("");
    scan.reset();
    measure.reset();
    confirm.reset();
    addReceiptItem.reset();
  }, [scan, measure, confirm, addReceiptItem]);

  /** 입력창에서 Enter · Scan 버튼 — 지금 입력창에 있는 값으로 조회한다 */
  const handleScan = useCallback(() => runScan(barcode), [runScan, barcode]);

  /** 미검수 품목 목록에서 품목 클릭 — 그 GTIN 으로 스캔을 실행한다(정본 §3.6) */
  const handlePendingItemSelect = useCallback(
    (item: PendingReceiptItem) => runScan(item.gtin, item),
    [runScan],
  );

  /** 촬영 = 첫 촬영과 재촬영을 겸한다. 재촬영은 같은 productId 로 1-3 재호출 (§1-3) */
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

  /** `적용` — 값만 기록하고 닫는다. API 는 부르지 않는다(모달 주석 참고) */
  const handleApplyManual = useCallback((dims: Dimensions, weightKg: number | null) => {
    setManual({ dims: sortAxes(dims), weightKg });
    setIsManualOpen(false);
  }, []);

  /**
   * `등록` — 필요한 것만 순차로 부른다.
   *   RECEIPT_ITEM               검수 입력만
   *   CONFIRM_THEN_RECEIPT_ITEM  1-4 confirm 성공 → onSuccess 에서 검수 입력 연쇄
   * 확정이 실패하면 연쇄가 끊겨 검수 입력도 일어나지 않는다.
   */
  const handleSubmit = useCallback(() => {
    if (product === null || plan.kind === "BLOCKED" || activeReceiptId === null) return;

    const runReceiptItem = () => {
      addReceiptItem.mutate(
        {
          receiptId: activeReceiptId,
          body: {
            gtin: product.gtin,
            receivedQty,
            damagedQty,
            lotNo: lotNo.trim(),
            expiresOn: expiresOn.trim() === "" ? null : expiresOn,
          },
        },
        {
          onSuccess: () => {
            toast.success("검수 등록 완료", w98Toast.success);
            clearScreen();
          },
          onError: (error) => {
            if (error instanceof ApiError && error.is("ASN_ITEM_NOT_FOUND")) {
              toast.error("ASN에 없는 상품입니다 — 반송 처리", {
                ...w98Toast.notice,
                description: "이 ASN에 등록되지 않은 GTIN입니다. 오배송으로 보고 반송하세요.",
              });
              return;
            }
            toast.error("검수 등록에 실패했습니다", {
              ...w98Toast.notice,
              description: error.message,
            });
          },
        },
      );
    };

    if (plan.kind === "RECEIPT_ITEM") {
      runReceiptItem();
      return;
    }

    /** 세션 하나를 받아 1-4 → 검수 입력을 잇는다 */
    const runConfirmThenReceiptItem = (sessionId: number) => {
      const body: ConfirmRequest =
        plan.method === "MANUAL" && manual !== null
          ? { method: "MANUAL", dims: manual.dims, weightKg: manual.weightKg, handling }
          : { method: "APPROVE", weightKg: null, handling };

      confirm.mutate(
        { sessionId, body },
        {
          onSuccess: runReceiptItem,
          onError: (error) => {
            const { title, detail } = describeConfirmFailure(error);
            toast.error(title, { ...w98Toast.notice, description: detail });
          },
        },
      );
    };

    if (measurement !== undefined) {
      runConfirmThenReceiptItem(measurement.sessionId);
      return;
    }

    /* 세션이 없다: 1-3 → 1-4 MANUAL → 검수 입력 세 단계 연쇄 (계약 제약, §1-4) */
    if (plan.kind !== "CONFIRM_THEN_RECEIPT_ITEM" || plan.method !== "MANUAL") return;
    measure.mutate(product.productId, {
      onSuccess: (result) => runConfirmThenReceiptItem(result.sessionId),
      onError: (error) =>
        toast.error("측정 세션을 만들지 못해 확정할 수 없습니다", {
          ...w98Toast.notice,
          description: `${error.message} 수기 입력값은 그대로 남아 있습니다. 다시 등록을 누르거나 촬영을 실행하세요.`,
        }),
    });
  }, [
    product,
    plan,
    measurement,
    manual,
    handling,
    receivedQty,
    damagedQty,
    lotNo,
    expiresOn,
    activeReceiptId,
    addReceiptItem,
    confirm,
    measure,
    clearScreen,
  ]);

  /* ── 이벤트 — ASN (좌측 열, Stage 3) ─────────────────────── */
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
          setSelectedAsnId(data.asnId);
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
    completeReceipt.mutate(openReceipt.receiptId, {
      onSuccess: (data) => {
        toast.success(`검수 완료 · ASN ${ASN_STATUS_LABEL[data.asn.status]}`, w98Toast.success);
        clearScreen();
      },
      onError: (error) =>
        toast.error("검수 완료 처리에 실패했습니다", {
          ...w98Toast.notice,
          description: error.message,
        }),
    });
  }, [openReceipt, completeReceipt, clearScreen]);

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
      {/* ── 좌측 300px: ASN 목록 + 상세 (Stage 3 신규) ──────── */}
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

      {/* ── 가운데: 측정 + 사진 (목업 center area, 기존 그대로) ── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        <MeasurementPanel
          data={measurement}
          manualDims={manual?.dims ?? null}
          manualWeightKg={manual?.weightKg ?? null}
          isLoading={measure.isPending}
          error={measure.error?.message ?? null}
          note={measurementNote}
        />

        <VisualInspectionPanel
          images={images}
          isLoading={measure.isPending || productImagesQuery.isLoading}
          sourceLabel={sourceLabel}
          masterImageUrl={product?.imageUrl ?? null}
          productName={product?.name ?? null}
          isProductPending={scan.isPending}
        />
      </div>

      {/* ── 우측 380px: 목업 right sidebar + 신규 두 칸 ──────── */}
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

        {/* 도착 처리 후 뜨는 미검수 품목 목록 — 클릭하면 그 GTIN 으로 스캔한다(Stage 3 신규) */}
        <PendingItemsPanel
          items={pendingItemsQuery.data ?? []}
          isLoading={pendingItemsQuery.isLoading}
          selectedAsnItemId={selectedPendingItem?.asnItemId ?? null}
          onSelect={handlePendingItemSelect}
          disabled={isBusy}
        />

        {/* 1-1 표시값 + 판정(계약 필수 UI ①) + 분류 읽기 전용(계약 필수 UI ③, D-21) */}
        <ManifestPanel result={scan.data} isPending={scan.isPending} stockLabel={stockLabel} />

        {/* 취급 주의사항 — 체크박스만 남았다(T1 삭제, precautions-panel.tsx 참고) */}
        <PrecautionsPanel
          value={handling}
          onChange={setHandling}
          disabled={!canEditHandling}
          note={handlingNote}
          active={canEditHandling}
        />

        {/* 검수 입력 — 예전 수량 패널의 후계(Stage 3 신규, receipt-input-panel.tsx) */}
        <ReceiptInputPanel
          pendingItem={selectedPendingItem}
          receivedQty={receivedQty}
          onReceivedQtyChange={setReceivedQty}
          damagedQty={damagedQty}
          onDamagedQtyChange={setDamagedQty}
          lotNo={lotNo}
          onLotNoChange={setLotNo}
          expiresOn={expiresOn}
          onExpiresOnChange={setExpiresOn}
          disabled={receiptFieldsDisabled}
          note={receiptNote}
        />

        {/* 촬영(1-3) / 등록(1-4 → 검수 입력 연쇄) */}
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
          onSubmit={handleSubmit}
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

/* ── 등록 한 번이 무엇을 부를지 ───────────────────────────── */

type SubmitPlan =
  /** 검수 입력만 부른다 — 치수가 이미 확정된 상품 */
  | { kind: "RECEIPT_ITEM"; hint: string }
  /** 1-4 confirm 성공 뒤 검수 입력을 연쇄로 부른다 */
  | { kind: "CONFIRM_THEN_RECEIPT_ITEM"; method: "APPROVE" | "MANUAL"; hint: string }
  /** 지금은 누를 수 없다. hint 가 그 이유다 */
  | { kind: "BLOCKED"; hint: string };

/**
 * 확정(1-4)과 검수 입력을 버튼 하나로 합친 뒤, "지금 무엇이 나가야 하는가"를 한 곳에서 정한다.
 * 순수 함수라 화면 상태만 보고 판정하며 API 를 부르지 않는다.
 *
 * ⚠️ Stage 2 의 `sellerCode`/`lotNo`(화주 선택 게이트) 자리를 이제 `activeReceiptId`(ASN 도착
 *    처리 여부)가 대신한다 — 화주는 더 이상 화면에서 고르지 않고 선택한 ASN이 정하기 때문이다.
 */
function buildSubmitPlan({
  scanResult,
  measurement,
  isConfirmed,
  manual,
  receiptItemResult,
  activeReceiptId,
  receivedQty,
  damagedQty,
  lotNo,
}: {
  scanResult: ScanResponse | undefined;
  measurement: MeasurementResponse | undefined;
  isConfirmed: boolean;
  manual: { dims: Dimensions; weightKg: number | null } | null;
  receiptItemResult: ReceiptItemCreatedResponse | undefined;
  activeReceiptId: number | null;
  receivedQty: number;
  damagedQty: number;
  lotNo: string;
}): SubmitPlan {
  /* 이미 넣었다 — 두 번 누르면 재고가 두 번 는다.
     ⚠️ 계약(§3.5)에 멱등 규정이 없어 서버가 막아 주지 않는다. 그래서 화면이 막는다. */
  if (receiptItemResult !== undefined) {
    return {
      kind: "BLOCKED",
      hint: `검수 등록 완료 · 수령 ${receiptItemResult.receivedQty}개(파손 ${receiptItemResult.damagedQty}) — 새 바코드를 스캔하세요`,
    };
  }

  if (scanResult?.product != null && activeReceiptId === null) {
    /* ★ ASN·도착 게이트를 상품 확인 다음, 나머지 게이트보다 먼저 둔다 — 치수·게이트 상태와
       무관하게 검수 입력은 열린 receipt 없이 나갈 수 없다(정본 §3.5). */
    return { kind: "BLOCKED", hint: "ASN을 선택하고 도착 처리하세요" };
  }

  if (
    scanResult?.product != null &&
    (receivedQty < 0 || damagedQty > receivedQty || lotNo.trim() === "")
  ) {
    /* ⚠️ 수령 0 은 막지 않는다 — 서버가 명시적으로 허용한다(ReceiptItemRequest: "예정에 있었지만
       이번 도착에 한 개도 안 온 품목을 기록할 수 있어야 한다"). 막을 것은 음수·파손>수령·빈 로트뿐. */
    return { kind: "BLOCKED", hint: "수령 수량·파손 수량·로트번호를 확인하세요" };
  }

  if (scanResult?.product == null) {
    // UNKNOWN 은 안내 후 종료다 — 등록 폼도 분류 선택도 없다 (D-21, §1-1)
    return {
      kind: "BLOCKED",
      hint:
        scanResult?.judgment === "UNKNOWN"
          ? "코리안넷 마스터에 없는 상품 — 입고 대상이 아닙니다"
          : "",
    };
  }

  /* ★ 수기값이 이긴 상태가 **제일 먼저**다 (last-write-wins) */
  if (manual !== null) {
    if (measurement !== undefined && manual.weightKg == null && measurement.weightKg == null) {
      return { kind: "BLOCKED", hint: "무게가 없습니다 — 수동 입력에서 무게를 채우세요" };
    }
    return {
      kind: "CONFIRM_THEN_RECEIPT_ITEM",
      method: "MANUAL",
      hint:
        measurement === undefined
          ? "수기값 저장 · 1-3 세션 확보 → 1-4 MANUAL → 검수 등록"
          : "수기값 저장 · 1-4 MANUAL → 검수 등록",
    };
  }

  // 이번 화면에서 방금 확정했거나(1-4 성공), 애초에 치수가 확정된 상품(REGISTERED)
  if (isConfirmed) return { kind: "RECEIPT_ITEM", hint: "치수 확정됨 · 검수 등록" };
  if (scanResult.judgment === "REGISTERED" && measurement === undefined) {
    return { kind: "RECEIPT_ITEM", hint: "치수가 이미 확정된 상품 · 검수 등록만 나갑니다" };
  }

  /* 여기부터 NEW — 촬영·확정을 거쳐야 한다 */
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

  return { kind: "CONFIRM_THEN_RECEIPT_ITEM", method: "APPROVE", hint: "1-4 승인 → 검수 등록" };
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
        detail: "다시 확정할 수 없습니다. 새로 촬영하거나 검수 입력으로 넘어가세요.",
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
