"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { w98Toast } from "./_components/win98-ui";
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
import { BarcodePanel } from "./_components/barcode-panel";
import { ManifestPanel } from "./_components/manifest-panel";
import { ManualInputDialog } from "./_components/manual-input-dialog";
import { MeasurementPanel } from "./_components/measurement-panel";
import { PrecautionsPanel } from "./_components/precautions-panel";
import { VisualInspectionPanel } from "./_components/visual-inspection-panel";
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
 * 레이아웃은 사용자가 준 **목업 HTML**(Logistics Terminal v1.0, Windows 98 스킨)을 옮긴 것이다.
 * 셸(데스크톱·태스크바·창 크롬·좌측 네비)은 이 라우트 그룹의 layout.tsx 가 그린다.
 *
 * 목업 본문 구조 그대로다:
 *   가운데  Automatic Measurement Data (파인 상자 4개) + Visual Inspection (메인 65% + 서브 35%)
 *   우측    Barcode Data / Product Manifest / 취급 주의사항 / 촬영 · 등록
 *            (취급 주의사항은 한때 떠다니는 창이었다가 이 자리로 돌아왔다)
 *
 * ⚠️ 목업에 있으나 우리 계약에 없는 값(DEST·ROUTING·PRIORITY, `NO ANOMALIES DETECTED`,
 *    무게 상한 초과)은 **지어내지 않았다.** 각 컴포넌트 주석에 무엇으로 갈아 끼웠는지 적어 뒀다.
 *
 * ── 세로·가로 예산 (검산) ────────────────────────────────────────────────
 *   화면 영역 = 1390 × 872  (layout.tsx 주석의 계산 참고)
 *   가로: 가운데 flex-1(1042) + gap 8 + 우측 340 = 1390
 *   가운데 세로: 측정 패널(내용 높이 ≈ 176) + gap 8 + 사진 패널 flex-1 = 872
 *   우측 세로: 바코드 ≈ 110 + 매니페스트 152 + 취급 ≈ 176 + 액션 100 + gap — 남는 자리는
 *             액션 위 `mt-auto` 가 흡수한다(버튼이 항상 바닥에 붙는다)
 *   ⚠️ 이 화면은 스크롤이 없다. 넘치면 잘린다.
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
  /**
   * Stage 2 T1 — 1-5 요청에 화주·로트번호가 필수로 붙었다(정본 §2.5). 화주는 기본값이
   * 없다(선택 필수, §2.6) — 등록 버튼은 이 값과 로트번호가 채워져야 눌린다.
   * // Stage 2 transitional (T1): replaced in Stage 3 (ASN 검수가 대체)
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
   *   ⚠️ 이전 개정은 이 값을 "게이트 미통과·측정 실패의 해제 수단"으로만 봤다. 뒤집힌 게
   *      아니라 **넓어졌다** — 이제 정상 경로에서도 언제든 쓸 수 있고, 이미 확정된 상품의
   *      치수를 고치는 수단이기도 하다. 촬영이 메인이지만 촬영이 불가할 수도 있기 때문이다.
   *   ⚠️ 여기 담기는 dims 는 **축 정렬(D-18)을 이미 끝낸** 값이다 — sortAxes 참고.
   */
  const [manual, setManual] = useState<{ dims: Dimensions; weightKg: number | null } | null>(null);

  /* ── 데이터 ────────────────────────────────────────────── */
  const scan = useBarcodeScan(); // 1-1
  const measure = useMeasure(); // 1-3
  const confirm = useConfirmMeasurement(); // 1-4
  const stockIn = useStockIn(); // 1-5
  const sellersQuery = useSellers(); // Stage 2 T1 — 화주 select

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
   * 상한 시간은 라벨에 쓰지 않는다 — 실측 0.8초라 숫자가 실제와 어긋난다.
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
   * ⚠️ `!isConfirmed` 를 **뺐다.** last-write-wins 를 택한 이상 "확정 후에는 다시 못 찍는다"가
   *    앞뒤가 안 맞는다 — 수기는 언제든 되는데 촬영만 막으면, 촬영이 메인 기능이라는 전제와
   *    정면으로 어긋난다. 확정 뒤 재촬영은 새 세션을 열고(이전 미확정 세션은 서버가 DISCARDED
   *    처리한다) 그 값이 다시 이긴다.
   * ⚠️ `stockIn.data === undefined` 는 **남겼다.** 이건 확정이 아니라 **이중 입고** 방어다
   *    (§1-5 에 멱등 규정이 없다). 입고까지 끝난 뒤에 치수를 고치려면 새 바코드부터다 —
   *    되돌리기 경로를 새로 만드는 것은 이번 범위 밖이라 PM 보고 항목으로 남긴다.
   */
  const canCapture = product !== null && !isBusy && stockIn.data === undefined;

  /**
   * 측정 패널 위에 뜨는 **행동 안내** 한 줄 — 지금 무엇을 하면 되는가.
   * 원래 `Product Manifest` 마지막 줄이었는데, 데이터에 묻혀 안 읽혀서 다음 동작(촬영) 바로
   * 위로 옮겼다. 경고(게이트 미통과 등)가 있으면 패널이 그쪽을 먼저 보여 준다.
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
   * 취급속성을 **지금 고칠 수 있는가.**
   *
   * ★ 판정 기준을 "촬영했는가" 에서 **"1-4 가 나가는 경로인가"** 로 바꿨다 (사용자 지적:
   *   버튼이 안 눌린다). 취급속성은 1-4 confirm 요청에만 실려 나간다 — 1-5 만 나가는
   *   경로(치수가 이미 확정된 상품)에서는 아무리 눌러도 저장될 곳이 없다.
   *   반대로 **수동 입력으로 치수를 넣은 상태**는 촬영을 안 했어도 1-4 가 나가므로 열려야
   *   하는데, 예전 규칙(`measurement === undefined`)은 그 경우를 잠그고 있었다.
   */
  const canEditHandling =
    product !== null && !isConfirmed && plan.kind === "CONFIRM_THEN_STOCK_IN";

  /**
   * 왜 잠겼는지 한 줄. **잠금과 고장을 구별해 주는 유일한 장치**다.
   * 잠기지 않았으면 빈 문자열이라 창에 아무것도 뜨지 않는다.
   */
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

  /* ── 이벤트 ────────────────────────────────────────────── */
  /**
   * 1-1 조회 — **값을 인자로 받는다.**
   *
   * ⚠️ 예전에는 `barcode` 상태를 직접 읽었는데, 그러면 TEST DATA 버튼처럼 "값을 넣고 곧바로
   *    조회"하는 경로에서 한 박자 늦은 값이 나간다(setState 는 즉시 반영되지 않는다).
   *    인자로 받으면 입력창에서 Enter 를 치든 테스트 값을 꽂든 같은 함수를 쓸 수 있다.
   */
  const runScan = useCallback(
    (value: string) => {
      setBarcode(value);
      // 조회를 "실행한" 값을 여기서 확정한다 — 응답을 기다리지 않는다(위 상태 주석 참고)
      setScannedBarcode(value.trim());
      scan.mutate(value, {
        onSuccess: () => {
          // 새 바코드를 잡으면 이전 상품의 화면 상태를 전부 버린다
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

  /**
   * 화면을 처음 상태로 되돌린다 — 바코드 칸까지 비운다.
   * 새 바코드를 잡을 때(runScan)와 입고를 마쳤을 때 같은 자리를 쓴다.
   */
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

  /** 입력창에서 Enter · Scan 버튼 — 지금 입력창에 있는 값으로 조회한다 */
  const handleScan = useCallback(() => runScan(barcode), [runScan, barcode]);

  /** 촬영 = 첫 촬영과 재촬영을 겸한다. 재촬영은 같은 productId 로 1-3 재호출 (§1-3) */
  const handleCapture = useCallback(() => {
    if (product === null) return;
    // 재촬영하면 새 세션이 열리므로 이전 확정 결과는 이 화면과 무관해진다
    confirm.reset();
    measure.mutate(product.productId, {
      onSuccess: (result) => {
        // ★ last-write-wins — 촬영이 성공했으므로 수기값을 버린다(위 manual 상태 주석)
        setManual(null);
        // 취급속성 기본값은 서버의 category_attribute_map 에서 온다 (§1-3)
        setHandling(result.status === "INFERRED" ? result.handlingDefaults : EMPTY_HANDLING);
        // §1-3 이 정한 동작: 측정 실패면 수동 입력 fallback 을 자동으로 연다
        setIsManualOpen(result.status === "MEASURE_FAILED");

        /* ⚠️ 예전에는 여기서 취급 주의사항 **창을 띄웠다.** 이제 그 칸이 오른쪽 열에
           붙박이로 있어서 띄울 것이 없다 — 대신 `canEditHandling` 이 참이 되면서 그 칸의
           제목 줄이 빨갛게 바뀐다. "지금이다"를 말하는 방법이 뜨는 것에서 색으로 옮겨 갔다.
           ⚠️ 조건(신규 + 측정 성공)은 `canEditHandling` 안에 그대로 살아 있다. 여기서
              사라진 것은 창을 여는 동작뿐이고, 언제 만질 수 있는가는 안 바뀌었다. */
      },
    });
  }, [product, measure, confirm]);

  /**
   * `적용` — 값만 기록하고 닫는다. API 는 부르지 않는다(모달 주석 참고).
   * ★ 축 정렬(D-18)을 **여기서 한 번** 한다: 저장 전 정렬과 화면 표시가 같은 값이 되도록
   *   경계에서 한 번만 돌린다. 여러 군데서 정렬하면 언젠가 어긋난다.
   */
  const handleApplyManual = useCallback((dims: Dimensions, weightKg: number | null) => {
    setManual({ dims: sortAxes(dims), weightKg });
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
            // 한 건이 끝나면 처음 상태로 돌아간다 (사용자 결정). 다음 상품의 바코드를
            // 바로 받을 수 있어야 하고, 남아 있는 값이 다음 건의 것으로 오해되면 안 된다.
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

    /** 세션 하나를 받아 1-4 → 1-5 를 잇는다. 세션이 어디서 왔는지는 여기서 신경 쓰지 않는다 */
    const runConfirmThenStockIn = (sessionId: number) => {
      const body: ConfirmRequest =
        plan.method === "MANUAL" && manual !== null
          ? { method: "MANUAL", dims: manual.dims, weightKg: manual.weightKg, handling }
          : // 세션 저울값을 쓰라는 뜻으로 null 을 보낸다 (§1-4 — 생략/null 이면 measured_weight_kg)
            { method: "APPROVE", weightKg: null, handling };

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

    /* ── 세션이 없다: 1-3 → 1-4 MANUAL → 1-5 세 단계 연쇄 ──────────────────
       계약 제약이다 — 1-4 는 sessionId 를 경로 파라미터로 받고, 그 세션은 1-3 만 만든다.
       그래서 촬영이 물리적으로 불가해도 1-3 을 한 번은 불러야 수기 확정이 성립한다.
       ⚠️ 여기서 setManual(null) 을 하지 않는다. handleCapture 의 촬영은 "작업자가 찍겠다고
          누른 것"이라 수기값을 지우는 게 맞지만, 이 1-3 은 **수기값을 저장하기 위한**
          세션 확보다. 지우면 방금 친 값이 사라지고 APPROVE 로 새어 나간다. */
    if (plan.kind !== "CONFIRM_THEN_STOCK_IN" || plan.method !== "MANUAL") return;
    measure.mutate(product.productId, {
      // ⚠️ MEASURE_FAILED 도 성공 경로다 — HTTP 에러가 아니라 상태값이고 sessionId 가
      //    실려 온다(§1-3). 오히려 촬영이 불가한 상황의 정상 경로다. 흐름을 끊지 않는다.
      onSuccess: (result) => runConfirmThenStockIn(result.sessionId),
      // 진짜 실패(네트워크·5xx)면 세션이 없어 확정이 불가능하다. 수기값은 그대로 두고
      // 이유만 알린다 — 다시 누르면 곧 재시도이고, 촬영 버튼으로 가도 된다.
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

  /* ── 표시 ──────────────────────────────────────────────── */
  return (
    <div className="relative flex min-h-0 flex-1 gap-2">
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

        {/* 확정 전에는 1-3 의 images, 확정 후에는 1-6 응답이다(위 images 계산 참고).
            메인·서브 세 칸을 한 부품이 그린다 — 계약이 주는 건 배열 하나뿐이라
            어느 장이 메인인지가 배열 순서로만 정해지기 때문이다. */}
        {/* ★ 마스터 이미지(§1-1 `product.imageUrl`)를 여기로 넘긴다. 원래는 우측 열의
            `Product Manifest` 안에 있었는데, 그 자리를 촬영 직후 뜨는 취급 주의사항 창에
            내주면서 이리로 왔다 (사용자 결정).
            ⚠️ `images`(§1-3/§1-6 촬영본)와 **합치지 않고 따로 넘긴다.** 출처가 다른 값을
               한 배열에 섞으면 "몇 번째가 촬영본인가"가 화면 사정에 따라 달라진다. */}
        <VisualInspectionPanel
          images={images}
          isLoading={measure.isPending || productImagesQuery.isLoading}
          sourceLabel={sourceLabel}
          masterImageUrl={product?.imageUrl ?? null}
          productName={product?.name ?? null}
          isProductPending={scan.isPending}
        />
      </div>

      {/* ── 우측 408px: 목업 right sidebar ───────────────────
          ★ 340 → **408px** (사용자 결정 — 바코드·명세 칸이 좁았다).
            늘어난 68px 은 가운데 열이 내주고, 가운데에서 유일하게 늘어나는 칸이
            Visual Inspection 이라 결국 사진 칸이 그만큼 좁아진다. 그게 의도다 —
            사진은 지금 화면에서 가장 큰데 가장 덜 읽히는 칸이다.
          ⚠️ 세로도 같은 비율(-5.9%)로 줄여야 사진이 찌그러져 보이지 않는다. 그쪽은
             측정 박스 높이(measurement-panel.tsx 의 min-h)를 키워서 맞췄다. */}
      <div className="flex w-[408px] shrink-0 flex-col gap-2">
        {/* 1-1 진입점. 못 찾은 바코드도 200 + UNKNOWN 이라 에러 자리는 평소 비어 있다 */}
        <BarcodePanel
          value={barcode}
          scannedValue={scannedBarcode}
          onChange={setBarcode}
          onScan={handleScan}
          isPending={scan.isPending}
          error={scan.error?.message ?? null}
        />

        {/* 1-1 표시값 + 판정(계약 필수 UI ①) + 분류 읽기 전용(계약 필수 UI ③, D-21).
            ★ **남는 세로를 전부 이 칸이 먹는다** (사용자 결정). 나중에 제품 정보에 사진
              업로드가 붙을 예정이라 여기가 가장 크게 자라야 할 칸이기 때문이다.
              그래서 아래 취급 주의사항·버튼은 자기 높이만 갖고 바닥에 붙어 있고,
              늘어나는 칸은 우측 열에서 이것 하나뿐이다. */}
        {/* 취급 주의사항을 여는 버튼이 제목 줄에 있었는데, 그 칸이 아래에 붙박이로
            들어오면서 열고 닫을 것이 없어졌다 */}
        <ManifestPanel result={scan.data} isPending={scan.isPending} />

        {/* ★ 떠다니는 창에서 **붙박이 칸**으로 바꿨다 (사용자 결정 — 이 자리에 넣기).
            창일 때는 촬영 직후 화면 가운데에 떠서 측정값·사진을 덮었는데, 그 둘을 보면서
            정해야 하는 값이라 정작 봐야 할 것을 가리고 있었다. 세로를 내줄 여유는 마스터
            이미지가 이 열을 떠나 Visual Inspection 으로 가면서 생겼다.
            ⚠️ 넘기는 값은 창일 때와 **똑같다.** 1-4 의 handling 과 1-5 의 qty 는 그대로
               page.tsx 가 들고 있고, 이 칸은 그리기만 한다 — 계약으로 나가는 값은 안 바뀐다. */}
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
  sellerCode,
  lotNo,
}: {
  scanResult: ScanResponse | undefined;
  measurement: MeasurementResponse | undefined;
  isConfirmed: boolean;
  manual: { dims: Dimensions; weightKg: number | null } | null;
  stockInResult: StockInResponse | undefined;
  /** Stage 2 T1 — 둘 다 채워야 등록이 나간다(정본 §2.6, 화주 기본값 없음) */
  sellerCode: string;
  lotNo: string;
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

  if (scanResult?.product != null && (sellerCode.trim() === "" || lotNo.trim() === "")) {
    /* ★ 화주·로트번호 체크를 **상품 확인 다음, 나머지 게이트보다 먼저** 둔다 (Stage 2 T1).
       치수·게이트 상태와 무관하게 1-5 는 이 둘 없이 나갈 수 없으므로, 다른 이유로 잠긴
       것처럼 보이지 않게 가장 먼저 이 이유부터 말한다. */
    return { kind: "BLOCKED", hint: "화주와 로트번호를 입력하세요" };
  }

  if (scanResult?.product == null) {
    // UNKNOWN 은 안내 후 종료다 — 등록 폼도 분류 선택도 없다 (D-21, §1-1)
    return {
      kind: "BLOCKED",
      /* ★ 스캔 전에는 하단 안내를 **비운다** (사용자 결정).
         "바코드를 스캔하세요" 는 이미 제품 정보 칸 가운데에서 깜빡이며 말하고 있다.
         같은 문장을 화면 오른쪽 하단에서 한 번 더 말하면 안내가 아니라 잡음이다.
         ⚠️ UNKNOWN 문구는 남긴다 — 그건 "왜 진행할 수 없는지"를 설명하는 유일한 자리이고,
            깜빡이는 안내와 내용이 다르다. */
      hint:
        scanResult?.judgment === "UNKNOWN"
          ? "코리안넷 마스터에 없는 상품 — 입고 대상이 아닙니다"
          : "",
    };
  }

  /* ★ 수기값이 이긴 상태가 **제일 먼저**다 (last-write-wins).
     REGISTERED 든 이미 확정됐든, 수기로 고쳤으면 그 값을 저장해야 한다 —
     "기존 데이터도 수기로 수정할 수 있어야 한다"가 사용자 요구다.
     §1-4 는 MANUAL 을 게이트·상태와 무관하게 항상 허용하므로 계약상으로도 걸리는 게 없다. */
  if (manual !== null) {
    // 세션이 있는데 양쪽 다 무게가 없으면 확정이 400 이다 (§1-4). 미리 잡아 준다.
    // 세션이 없으면 1-3 이 저울값을 실어 올 수 있으므로 여기서 막지 않는다.
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

  // 이번 화면에서 방금 확정했거나(1-4 성공), 애초에 치수가 확정된 상품(REGISTERED)
  if (isConfirmed) return { kind: "STOCK_IN", hint: "치수 확정됨 · 1-5 입고" };
  /* ★ 치수가 이미 확정된 상품이라도, **방금 촬영한 세션이 있으면** 확정을 거친다 (사용자 지적:
     촬영했는데 취급 주의사항이 안 눌린다).
     예전에는 REGISTERED 면 무조건 1-5 만 보냈는데, 그러면 작업자가 누른 `촬영` 이 아무것도
     하지 않은 셈이 된다 — 새로 잰 치수도, 그때 같이 정한 취급속성도 어디에도 저장되지 않는다.
     세션이 있으면 1-4 APPROVE 로 그 값을 확정하고 1-5 로 넘어가는 것이 맞다.
     ⚠️ 촬영을 안 했으면(measurement === undefined) 예전 그대로 1-5 만 나간다 — 확정할 세션이
        없으므로 1-4 를 부를 수도 없다(§1-4 는 sessionId 를 경로 파라미터로 받는다). */
  if (scanResult.judgment === "REGISTERED" && measurement === undefined) {
    return { kind: "STOCK_IN", hint: "치수가 이미 확정된 상품 · 1-5 입고만 나갑니다" };
  }

  /* 여기부터 NEW — 촬영·확정을 거쳐야 한다 */
  if (measurement === undefined) {
    return { kind: "BLOCKED", hint: "치수를 측정하세요 (1-3)" };
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

/**
 * TEST DATA — `_mock/inbound.ts` 가 실제로 알고 있는 바코드 네 개.
 *
 * mock 을 열어 보지 않고도 네 갈래(게이트 통과 / 신규 / 신뢰도 미달 / 측정 타임아웃)를
 * 전부 눌러 볼 수 있게 화면에 노출한다. 값과 시나리오는 `_mock/inbound.ts` 상단의
 * 시나리오 표에서 왔다 — **그 표가 바뀌면 여기도 같이 고쳐야 한다.**
 *
 * ⚠️ 실제 API 로 배선할 때 이 상수와 BarcodePanel 의 TEST DATA 줄을 함께 지운다.
 *    지어낸 값을 실서버 화면에 남겨 두면 안 된다.
 */

/** 촬영 전·새 스캔 직후의 취급속성. 1-3 이 오면 handlingDefaults 로 덮인다 */
const EMPTY_HANDLING: Handling = { refrigerate: false, fragile: false, irregular: false };

/**
 * 치수 축 정렬 — D-18.
 * 서버는 `widthCm < lengthCm` 이면 **가로·세로를 스왑해서 저장**한다(높이는 건드리지 않는다).
 * 그런데 1-4 응답에는 dims 가 없어서(§1-4 는 productId/dimStatus/dimMethod 만 준다) 정렬
 * 결과를 되받을 수단이 없다. 그래서 화면이 **같은 규칙을 저장 전에 직접** 돌린다 —
 * 그래야 68px 칸·헤더 줄·모달 기본값·실제 DB 값이 전부 같은 숫자가 된다.
 *
 * ⚠️ 검증으로 막지 않는다. 자동 정렬이 결정이다 — 물리적으로 같은 값이라 작업자가 판단할
 *    여지가 없고, 시연 중에 검증 실패 화면을 띄울 이유가 없다.
 * ⚠️ 추론값(1-3)에는 돌리지 않는다. 서버가 이미 정렬해서 내려주므로(§1-3 불변식) 두 번
 *    돌릴 필요가 없고, 두 번 돌려도 결과는 같지만 "어디서 정렬하는가"를 한 곳으로 묶어 둔다.
 */
function sortAxes(dims: Dimensions): Dimensions {
  const { widthCm, lengthCm, heightCm } = dims;
  return widthCm >= lengthCm
    ? dims
    : { widthCm: lengthCm, lengthCm: widthCm, heightCm };
}

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
