"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ConfirmRequest, ProductImagesResponse } from "@/lib/types";
import { BarcodeScanInput, ScanJudgmentPanel } from "./_components/barcode-scan-input";
import { ConfirmForm } from "./_components/confirm-form";
import { MeasurementPanel } from "./_components/measurement-panel";
import { ProductPhotoPanel } from "./_components/product-photo-panel";
import { StockInPanel } from "./_components/stock-in-panel";
import {
  useBarcodeScan,
  useCategories,
  useConfirmMeasurement,
  useMeasure,
  useProductImages,
  useStockIn,
} from "./_data/use-inbound";

/**
 * 입고 등록 화면 — P1 담당 (docs/05-team-plan.md §2)
 *
 * 레이아웃 — Stitch 샘플 P1(localWork/stitch-sample.html)의 골격을 따른다.
 *   샘플은 같은 화면을 두 상태로 그려 뒀다 — 측정 전 644~1053행 / 측정 후 1054~1436행.
 *   두 구간의 구조는 완전히 같고 값만 다르므로(-- → 45.5 / 30.2 / 20.0 / 12.4),
 *   화면은 하나로 만들고 값이 있고 없고만 갈랐다.
 *
 *   맨 위: 제품 바코드 — 좌우 2단 위에 걸친 전체 폭 바
 *          (샘플은 상단 앱바 안 815~821행이지만 우리 헤더는 화면 3개가 공유하는 껍데기라
 *           입고 전용 입력을 넣을 수 없다. 출고 포장 화면이 토트 바코드에 쓴 규약을 따랐다)
 *   그 아래: 1-1 판정 — 전체 폭. 어느 분기냐가 이후 화면 전체를 가르므로 좌우보다 먼저 읽혀야 한다
 *   그 아래 좌우 2단
 *     좌(샘플 871~948행): 자동 측정 데이터 / 제품 메인·서브 촬영 사진
 *     우(샘플 949~1049행): 제품 정보·분류 / 수기 입력 / 취급 주의사항 / 수량 / 하단 버튼
 *
 * 호출 순서 (docs/02-api-spec.md §5)
 *   1-1 scan → 1-3 measure → [게이트 미통과 시 재촬영 or MANUAL] → 1-4 confirm → 1-5 stock-in
 *   래퍼는 `@/lib/endpoints` 의 `inbound` 를 쓴다.
 *
 * 재고는 1-5 에서만 늘어난다 (D-09) — 1-4 확정은 치수만 확정하고 inventory_tx 를 만들지 않는다.
 * 분류는 이름이 아니라 코드로 주고받는다 (D-13) — 선택지는 1-7 응답이다.
 *
 * ── 이 파일의 역할: 컨테이너 ──────────────────────────────
 * 데이터를 받는 곳과 화면을 그리는 곳을 나눠 놨다(출고 포장 화면과 같은 구조다).
 *   `_data/use-inbound.ts`  데이터를 가져온다 (지금은 mock, 나중에 실제 API)
 *   `_components/*`         받은 값을 그리기만 한다 (fetch 없음, props 만)
 *   `page.tsx` (이 파일)    둘을 이어 붙이고 화면 상태를 들고 있다
 *
 * ⚠️ 이 화면은 **틀만** 만들어 둔 상태다. 분기별 세부 동작은 P1 이 채운다 —
 *    자리마다 TODO(P1) 을 남겼고, 분기 안쪽의 더 구체적인 지시는 각 부품 파일에 있다.
 */
export default function InboundPage() {
  /* ── 화면 상태 (서버 데이터가 아닌 것만 여기서 관리) ────── */
  /** 스캔 입력창에 찍힌 문자열 */
  const [barcode, setBarcode] = useState("");
  /** 수기 입력 칸이 열려 있는가. 측정 실패면 아래에서 자동으로 연다 (§1-3) */
  const [isManualOpen, setIsManualOpen] = useState(false);
  /** 입고할 수량 — 촬영에 쓴 실물을 포함한 전체 수량이다 (D-09) */
  const [qty, setQty] = useState(1);

  /* ── 데이터 ────────────────────────────────────────────── */
  const scan = useBarcodeScan(); // 1-1
  const measure = useMeasure(); // 1-3
  const confirm = useConfirmMeasurement(); // 1-4
  const stockIn = useStockIn(); // 1-5
  const categoriesQuery = useCategories(); // 1-7

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

  /* ── 3분기 판정 (1-1) ──────────────────────────────────────
     입고 업무의 핵심 분기다. 어느 갈래인지는 서버가 정하므로 화면에서 다시 계산하지 않는다.
       REGISTERED (마스터 O + 치수 O) → 촬영 없이 수량 입력 UI 를 열고 1-5
       NEW        (마스터 O + 치수 X) → 촬영·추론(1-3) 으로 진입
       UNKNOWN    (마스터 X)          → 1-2 임시 마스터 생성 후 NEW 와 같은 흐름

     TODO(P1): 분기별 **동작**을 채운다. 여기서는 "무엇을 열고 잠글지"의 뼈대만 잡았다.
       · REGISTERED: 촬영·확정 영역을 잠그고 수량 패널로 포커스를 옮길지, 재촬영 경로를 남길지.
       · NEW: 스캔 직후 자동으로 1-3 을 부를지, 지금처럼 촬영 버튼을 눌러야 나가게 둘지.
         (자동이면 작업자가 물건을 촬영함에 넣기 전에 찍힌다 — 그래서 지금은 수동이다)
       · UNKNOWN: 1-2 수기 등록 폼. 훅부터 없다 — `_data/use-inbound.ts` 에
         useCreateProduct 를 먼저 추가해야 한다. 입력 필드와 진입 방식은
         `_components/barcode-scan-input.tsx` 의 UNKNOWN 분기 주석에 적어 뒀다.
     각 분기가 화면에서 무슨 뜻인지는 ScanJudgmentPanel 이 그린다. */
  const judgment = scan.data?.judgment;

  /**
   * 수량 입고(1-5)를 열어도 되는 시점.
   * 계약이 정한 두 갈래만 반영했다 — REGISTERED 는 치수가 이미 확정돼 바로,
   * 그 밖에는 1-4 확정에 성공한 뒤다.
   *
   * TODO(P1): 확정 없이 입고를 허용할 경우가 있는지 정한다. 02 §1-5 는 dimStatus 를
   *   전제하지 않아서 계약만으로는 판단할 수 없다. 허용한다면 여기 조건을 넓히고,
   *   금지한다면 그대로 두되 04-decisions.md 에 근거를 남길 것.
   */
  const canStockIn = judgment === "REGISTERED" || isConfirmed;

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

  /* ── 이벤트 ────────────────────────────────────────────── */
  const handleScan = useCallback(() => {
    scan.mutate(barcode, {
      onSuccess: () => {
        // 새 바코드를 잡으면 이전 상품의 화면 상태를 전부 버린다
        measure.reset();
        confirm.reset();
        stockIn.reset();
        setIsManualOpen(false);
        setQty(1);
      },
    });
  }, [barcode, scan, measure, confirm, stockIn]);

  /** 촬영 = 첫 촬영과 재촬영을 겸한다. 재촬영은 같은 productId 로 1-3 재호출 (§1-3) */
  const handleMeasure = useCallback(() => {
    if (product === null) return;
    // 재촬영하면 새 세션이 열리므로 이전 확정 결과는 이 화면과 무관해진다
    confirm.reset();
    measure.mutate(product.productId, {
      onSuccess: (result) => {
        // §1-3 이 정한 동작: 측정 실패면 수동 입력 fallback 을 자동으로 연다
        setIsManualOpen(result.status === "MEASURE_FAILED");
      },
    });
  }, [product, measure, confirm]);

  const handleConfirm = useCallback(
    (request: ConfirmRequest) => {
      if (measurement === undefined) return;
      confirm.mutate({ sessionId: measurement.sessionId, body: request });
    },
    [measurement, confirm],
  );

  const handleStockIn = useCallback(() => {
    if (product === null) return;
    stockIn.mutate(
      { productId: product.productId, qty },
      {
        onSuccess: (result) => {
          toast.success(`입고 완료 — ${product.name} 현재 재고 ${result.stockQty}개`);
          // TODO(P1): 입고 후 화면을 어디까지 비울지 정한다. 출고 포장 화면은 완료 시
          //   전부 비우고 다음 토트를 받지만, 입고는 같은 상품을 나눠 넣는 경우가 있어
          //   비우면 오히려 방해가 될 수 있다. 지금은 아무것도 비우지 않는다.
        },
      },
    );
  }, [product, qty, stockIn]);

  /* ── 표시 ──────────────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="입고 등록"
        description="바코드 스캔 → 촬영·추론 → 측정 확정 → 수량 입고"
      />

      {/* 제품 바코드 — 좌우 2단 위에 걸친 전체 폭 바 (출고 포장 화면과 같은 규약).
          Card 의 기본 세로 배치·안쪽 여백을 눕히고 좌우 여백만 남겨, 안쪽 48px 입력 +
          상하 16px 여백 = 샘플 상단 바와 같은 80px 가 되게 했다.
          높이를 고정값이 아니라 최소값으로 둔 이유: 스캔 실패 문구가 길어질 때 바가 늘어나야
          경고가 잘리지 않는다.
          1-1 진입점. 못 찾은 바코드도 200 + UNKNOWN 이라 이 바의 에러 자리는 평소 비어 있다. */}
      <Card className="min-h-20 shrink-0 flex-row items-center gap-4 px-4 py-0">
        <BarcodeScanInput
          value={barcode}
          onChange={setBarcode}
          onScan={handleScan}
          isPending={scan.isPending}
          error={scan.error?.message ?? null}
        />
      </Card>

      {/* 1-1 판정 — 전체 폭으로 뺐다. 샘플에는 대응 패널이 없다(샘플은 분기를 그리지 않는다).
          좌우 어느 컬럼에도 넣지 않은 이유: 어느 갈래냐가 촬영을 할지 말지까지 가르므로
          두 컬럼보다 먼저 읽혀야 한다. */}
      <Card>
        <CardHeader>
          <CardTitle>바코드 판정</CardTitle>
        </CardHeader>
        <CardContent>
          <ScanJudgmentPanel result={scan.data} isPending={scan.isPending} />
        </CardContent>
      </Card>

      {/* 좌우 2단 — 기준 해상도는 태블릿 가로(1180×820 ~ 1194×834).
          Tailwind 브레이크포인트는 "뷰포트 폭" 기준인데 사이드바(155px)와 본문 패딩(24px×2)이
          앞에서 폭을 먹는다. 그래서 본문이 실제로 쓰는 폭은 `뷰포트 - 203px` 다.
            뷰포트 1180(iPad Air 가로) → 본문 977px, 2단 간격 16 을 빼면 배분 대상 961px
            뷰포트 1600(샘플 캔버스)   → 본문 1397px, 같은 방식으로 1381px

          비율은 샘플의 970:438(≈2.21:1, 69:31)을 그대로 쓰지 않고 1.8:1(≈64:36)로 넓혔다.
            · 샘플대로면 1180px 에서 우측이 298px 이고, 카드 안쪽은 좌우 여백 16×2 를 빼 266px.
              대분류·중분류가 한 줄에 둘이라(간격 12) 셀렉트 하나가 127px 인데, 좌우 여백과
              펼침 화살표가 40px 남짓을 먹어 글자 자리는 87px — 16px 글자로 다섯 자 남짓이다.
              1-7 이 주는 이름이 "생활용품"만 돼도 이미 아슬아슬하다.
            · 1.8:1 이면 우측 343px → 안쪽 311px → 셀렉트 149px → 글자 자리 109px(예닐곱 자).
            · 좌측은 618px 로 줄지만 자동 측정 4칸이 각 137px 이라(안쪽 586 − 간격 36 을 4등분)
              30px 숫자 + 단위가 그대로 들어간다. 사진 서브 2칸도 각 287px 로 여유가 있다.
            · 넓힌 진짜 이유는 우측이 샘플보다 담는 게 많아서다 — 샘플 우측에 없는
              (1) 저장 경로 미정으로 잠긴 특이사항·등급 칸, (2) 가로·세로 자동 정렬 안내(D-18),
              (3) 확정/실패 알림, (4) 촬영분 포함 안내(D-09) 가 전부 이 컬럼에 있다.
              1600px 로 되돌리면 우측이 493px 로 샘플(438px)보다 55px 넓어지는데, 위 네 가지가
              차지하는 몫이라고 보면 된다.
          2단 진입점 1100px 는 출고 포장 화면과 같은 값이다 — 1024px 에서 갈랐다간 본문이
          821px 뿐이라 한 칸이 400px 대로 찌그러진다.
          최소폭을 0 으로 잡아 두는 것은 안쪽 내용이 넓어질 때 칸이 비율을 무시하고 밀려나는
          것을 막기 위해서다. */}
      <div className="grid gap-4 min-[1100px]:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        {/* ── 좌 (샘플 871~948행) ─────────────────────────── */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>자동 측정 데이터</CardTitle>
            </CardHeader>
            <CardContent>
              {/* 1-3. 가로·세로·높이는 추론값이고 무게는 저울 실측값이라 게이트와 무관하다.
                  게이트 미통과 사유·측정 실패 안내도 이 패널이 그린다. */}
              <MeasurementPanel
                data={measurement}
                isLoading={measure.isPending}
                error={measure.error?.message ?? null}
              />
            </CardContent>
          </Card>

          {/* 샘플은 메인(913~929행)과 서브(930~947행)를 별도 패널로 그리지만, 우리는 한 부품이
              둘 다 그린다 — 계약이 주는 것은 카메라 번호가 붙은 사진 한 배열이고, 어느 장이
              메인인지는 배열 순서로만 정해지기 때문이다. 카드를 둘로 가르면 같은 배열을 두 번
              넘겨야 한다. */}
          <Card>
            <CardHeader>
              <CardTitle>제품 촬영 사진</CardTitle>
            </CardHeader>
            <CardContent>
              {/* 확정 전에는 1-3 의 images, 확정 후에는 1-6 응답이다(위 images 계산 참고).
                  ⚠️ mock 단계에는 이미지 파일이 없어 회색 자리표시가 대신 그려진다. */}
              <ProductPhotoPanel
                images={images}
                isLoading={measure.isPending || productImagesQuery.isLoading}
                sourceLabel={sourceLabel}
              />
            </CardContent>
          </Card>
        </div>

        {/* ── 우 (샘플 949~1049행) ────────────────────────── */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>제품 정보 · 취급속성 · 측정 확정</CardTitle>
            </CardHeader>
            <CardContent>
              {/* 1-4 확정(APPROVE / MANUAL) + 1-1 표시값 + 1-7 분류 드롭다운.
                  key 를 상품·세션 기준으로 주는 이유: 이 폼은 기본값을 defaultValues 로만
                  잡으므로, 새 스캔이나 새 촬영이 오면 통째로 다시 마운트돼야 기본값이 갱신된다.
                  같은 세션 안에서는 리렌더가 몇 번 일어나도 작업자 입력이 지워지지 않는다. */}
              <ConfirmForm
                key={`${product?.productId ?? "none"}:${measurement?.sessionId ?? "none"}`}
                product={product}
                measurement={measurement}
                categories={categoriesQuery.data ?? EMPTY_CATEGORIES}
                isCategoriesLoading={categoriesQuery.isLoading}
                isManualOpen={isManualOpen}
                onToggleManual={setIsManualOpen}
                onConfirm={handleConfirm}
                onRemeasure={handleMeasure}
                isConfirming={confirm.isPending}
                isMeasuring={measure.isPending}
                confirmResult={confirm.data}
                confirmError={confirm.error}
              />
            </CardContent>
          </Card>

          {/* 수량 입고 — 샘플은 이 패널(1026~1037행)을 하단 버튼(1039~1048행) **위**에 두지만,
              우리는 하단 버튼이 확정 폼(1-4)에 속해 있어서 그 아래로 내렸다.
              호출 순서가 1-4 → 1-5 라 화면 순서도 그대로 두는 편이 읽기 쉽다. */}
          <Card>
            <CardHeader>
              <CardTitle>수량 입고</CardTitle>
            </CardHeader>
            <CardContent>
              {/* 1-5. 재고가 늘어나는 유일한 지점이고, 촬영에 쓴 실물도 이 수량에 포함된다 (D-09) */}
              <StockInPanel
                product={product}
                qty={qty}
                onQtyChange={setQty}
                onStockIn={handleStockIn}
                canStockIn={canStockIn}
                isPending={stockIn.isPending}
                result={stockIn.data}
                error={stockIn.error}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** 1-6 응답의 source 를 사람 말로 — 사진이 촬영 원본인지 마스터 대체인지 알려 준다 */
const IMAGE_SOURCE_LABEL: Record<ProductImagesResponse["source"], string> = {
  MEASUREMENT: "측정 원본",
  MASTER_FALLBACK: "마스터 대체 이미지",
};

/** 분류 목록이 오기 전 넘길 빈 배열 — 매 렌더 새 배열을 만들지 않도록 모듈 상수로 둔다 */
const EMPTY_CATEGORIES: never[] = [];
