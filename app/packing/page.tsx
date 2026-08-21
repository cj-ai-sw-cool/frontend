"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Placeholder } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { BoxType } from "@/lib/types";
import { BoxRecommendationPanel } from "./_components/box-recommendation-panel";
import { OrderDetailPanel } from "./_components/order-detail-panel";
import { PackCompleteButton } from "./_components/pack-complete-button";
import { ProductImagePanel } from "./_components/product-image-panel";
import { ToteScanInput } from "./_components/tote-scan-input";
import {
  useBoxTypes,
  useCompletePacking,
  useOverrideBox,
  useProductImages,
  useShipmentDetail,
  useToteScan,
} from "./_data/use-shipment-detail";

/**
 * 출고 포장 화면 — P2 담당 (docs/05-team-plan.md §2)
 *
 * 레이아웃 — Stitch 샘플 P2(localWork/stitch-sample.html 273~643행)의 골격을 따른다
 *   상단: 라인별 배송 내역 — 배송단위 리스트를 상태별로 (docs/02-api-spec.md §3-1, D-12)
 *   그 아래: 토트 바코드 — 전체 폭 전용 바 (샘플 486~494행). 화면의 진입 행동이라 독립시킨다
 *   그 아래 좌우 2단 (샘플 496~622행)
 *     좌: 품목 리스트 (제품 / 계획 수량 / 실수량 / 포장시 취급 주의)
 *     우: 제품 이미지 → 박스 추천 → 포장 완료
 *
 * 재고 현황은 이 화면에서 **제거됐다 (D-19)** — 제품 재고·박스 재고 목록 둘 다.
 *   판단에 실제로 쓰이는 추천 박스의 재고만 박스 추천 패널에 남는다(3-2 `recommendedBox.stockQty`).
 *
 * 호출 순서 (docs/02-api-spec.md §5)
 *   3-5 scanTote → (제품 클릭) 1-6 images → [불일치 시 프론트 표시만, D-06]
 *   → [필요 시] 3-3 overrideBox → 3-8 complete
 *   래퍼는 `@/lib/endpoints` 의 `outbound` 를 쓴다.
 *
 * ⚠️ 미정 — `lineId` 를 어디서 얻을지 정해야 한다. 라우트 파라미터(`/packing/[lineId]`)로 둘지,
 *    화면 안 셀렉터로 둘지에 따라 라우팅이 달라진다. P2 가 정하고 04-decisions.md 에 기록할 것.
 *    → 이번 작업에서는 결론을 내리지 않았으므로 라우트를 건드리지 않고 `/packing` 그대로 뒀다.
 *      3-1 라인별 배송 내역도 그래서 아직 Placeholder 다.
 *
 * ── 이 파일의 역할: 컨테이너 ──────────────────────────────
 * 데이터를 받는 곳과 화면을 그리는 곳을 나눠 놨다.
 *   `_data/use-shipment-detail.ts`  데이터를 가져온다 (지금은 mock, 나중에 실제 API)
 *   `_components/*`                 받은 값을 그리기만 한다 (fetch 없음, props 만)
 *   `page.tsx` (이 파일)            둘을 이어 붙이고 화면 상태를 들고 있다
 * 그래서 백엔드가 준비되면 `_data/use-shipment-detail.ts` 한 파일만 고치면 되고,
 * 이 파일과 `_components/` 는 그대로 둔다.
 */
export default function PackingPage() {
  /* ── 화면 상태 (서버 데이터가 아닌 것만 여기서 관리) ────── */
  /** 스캔 입력창에 찍힌 문자열 */
  const [barcode, setBarcode] = useState("");
  /** 스캔에 성공해 현재 작업 중인 배송단위. null 이면 아직 진입 전 */
  const [shipmentId, setShipmentId] = useState<number | null>(null);
  /** productId → 작업자가 센 실수량. 비어 있으면 주문 수량과 같다고 본다 (D-06, 화면 전용) */
  const [actualQty, setActualQty] = useState<Record<number, number>>({});
  /** 작업자가 고른 박스. 3-3 응답이 반영되기 전까지의 낙관적 표시값 */
  const [selectedBoxTypeId, setSelectedBoxTypeId] = useState<number | null>(null);
  /** 품목 리스트에서 고른 제품. 우측 "제품 이미지" 패널이 이걸 따라간다 (1-6) */
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  /* ── 데이터 ────────────────────────────────────────────── */
  const scan = useToteScan(); // 3-5
  const shipmentQuery = useShipmentDetail(shipmentId); // 3-2
  const boxTypesQuery = useBoxTypes(); // 3-4 — 박스 오버라이드 드롭다운의 선택지
  const productImagesQuery = useProductImages(selectedProductId); // 1-6
  const overrideBox = useOverrideBox(); // 3-3
  const completePacking = useCompletePacking(); // 3-8

  const shipment = shipmentQuery.data;
  const boxes = useMemo<BoxType[]>(() => boxTypesQuery.data ?? [], [boxTypesQuery.data]);

  /**
   * 화면에 보여줄 최종 박스.
   * 작업자가 방금 고른 값(selectedBoxTypeId)이 있으면 그것을, 없으면 서버가 준 finalBox 를 쓴다.
   * 실제 API 로 바꾸면 3-3 성공 후 캐시가 무효화되면서 서버값이 정답이 되고,
   * selectedBoxTypeId 는 응답이 오기 전 잠깐 쓰이는 낙관적 값으로만 남는다.
   */
  const finalBox = useMemo<BoxType | null>(() => {
    if (selectedBoxTypeId !== null) {
      const picked = boxes.find((box) => box.boxTypeId === selectedBoxTypeId);
      if (picked !== undefined) return picked;
    }
    return shipment?.finalBox ?? null;
  }, [selectedBoxTypeId, boxes, shipment]);

  /**
   * 지금 이미지 패널에 띄울 품목.
   * 배송단위가 바뀌면 selectedProductId 를 비우지만, 그 사이 렌더에서도 어긋난 id 가
   * 남지 않도록 items 안에서 다시 찾는다 — 없으면 "고른 품목 없음" 상태가 된다.
   */
  const selectedItem = useMemo(
    () =>
      shipment?.items.find((item) => item.productId === selectedProductId) ?? null,
    [shipment, selectedProductId],
  );

  /* ── 이벤트 ────────────────────────────────────────────── */
  const handleScan = useCallback(() => {
    scan.mutate(barcode, {
      onSuccess: (detail) => {
        // 새 토트를 잡으면 이전 배송단위의 화면 상태를 전부 버린다
        setShipmentId(detail.shipmentId);
        setActualQty({});
        setSelectedBoxTypeId(null);
        setSelectedProductId(null);
        overrideBox.reset();
        completePacking.reset();
      },
    });
  }, [barcode, scan, overrideBox, completePacking]);

  const handleActualQtyChange = useCallback((productId: number, qty: number) => {
    setActualQty((prev) => ({ ...prev, [productId]: qty }));
  }, []);

  const handleOverride = useCallback(
    (boxTypeId: number) => {
      if (shipment === undefined) return;
      setSelectedBoxTypeId(boxTypeId);
      overrideBox.mutate({ shipmentId: shipment.shipmentId, boxTypeId });
    },
    [shipment, overrideBox],
  );

  const handleComplete = useCallback(() => {
    if (shipment === undefined) return;
    completePacking.mutate(shipment.shipmentId, {
      onSuccess: (result) => {
        toast.success(
          `포장 완료 — ${shipment.line.name} 처리량 ${result.line.packedCount}건`,
        );
        // 다음 토트를 바로 받을 수 있도록 화면을 비운다
        setShipmentId(null);
        setBarcode("");
        setActualQty({});
        setSelectedBoxTypeId(null);
        setSelectedProductId(null);
        scan.reset();
      },
    });
  }, [shipment, completePacking, scan]);

  /* ── 표시 ──────────────────────────────────────────────── */
  const isScanning = scan.isPending || shipmentQuery.isLoading;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="출고 포장"
        description="토트 스캔 → 품목 확인 → 박스 추천 확인 → 포장 완료"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">라인별 배송 내역</CardTitle>
        </CardHeader>
        <CardContent>
          {/* TODO(P2): 3-1 GET /lines/{lineId}/shipments?status=
              배송단위 리스트를 대기중(TOTE_ASSIGNED)/진행중(PACKING)/완료(PACKED) 로 표시 (D-12).
              주문 단위 그룹 상세(A안)는 추후 확장이므로 지금은 리스트만.
              상태 탭은 components/ui/tabs.tsx 사용.
              ⚠️ lineId 출처(라우트 파라미터 vs 화면 셀렉터)가 정해져야 착수할 수 있다. */}
          <Placeholder>라인 선택 · 상태별 배송단위 리스트 (3-1)</Placeholder>
        </CardContent>
      </Card>

      {/* 토트 바코드 — 좌우 2단 위에 걸친 전체 폭 바 (샘플 486~494행).
          Card 의 기본 세로 배치·안쪽 여백을 눕히고 좌우 여백만 남겨, 안쪽 48px 입력 + 상하
          16px 여백 = 샘플과 같은 80px 가 되게 했다.
          높이를 고정값이 아니라 최소값으로 둔 이유: 스캔 실패 문구가 길어질 때 바가 늘어나야
          경고가 잘리지 않는다. 평소(안내 한 줄)에는 정확히 80px 로 보인다.
          3-5 진입점. 재스캔은 멱등 (D-14). TOTE_NOT_ASSIGNED(404) 는 바 오른쪽에 표시된다. */}
      <Card className="min-h-20 shrink-0 flex-row items-center gap-4 px-4 py-0">
        <ToteScanInput
          value={barcode}
          onChange={setBarcode}
          onScan={handleScan}
          isPending={isScanning}
          error={scan.error?.message ?? null}
        />

        {/* 지금 어떤 배송단위를 잡고 있는지 — 작업자가 토트를 헷갈리지 않도록.
            안내 문구와 자리를 나눠 쓴다(스캔에 성공한 상태에는 에러 문구가 없다). */}
        {shipment !== undefined ? (
          <ShipmentSummary
            lineName={shipment.line.name}
            seqNo={shipment.seqNo}
            toteBarcode={shipment.tote?.barcode ?? null}
          />
        ) : null}
      </Card>

      {/* 좌우 2단 — 기준 해상도는 태블릿 가로(1180×820 ~ 1194×834).
          Tailwind 브레이크포인트는 "뷰포트 폭" 기준인데 사이드바(155px)와 본문 패딩(24px×2)이
          앞에서 폭을 먹는다. 그래서 본문이 실제로 쓰는 폭은 `뷰포트 - 203px` 다.
            뷰포트 1024(`lg`) → 본문 821px   ← lg 를 그대로 쓰면 2단 진입이 너무 이르다
            뷰포트 1100       → 본문  897px
            뷰포트 1180(iPad Air 가로) → 본문 977px
            뷰포트 1280(데스크톱)      → 본문 1077px
          `lg` 대신 1100px 에서 2단으로 바꾼 이유: 821px 를 반으로 가르면 한 칸 ~400px 인데,
          좌측 품목 테이블이 그 폭에서 찌그러진다.

          비율은 1:1 이다 — 샘플을 그대로 환산한 값이다.
            샘플 main 폭 1600 − 사이드바 155 = 1445, 좌우 패딩 16×2 를 빼면 안쪽 1413.
            좌 691 + 간격 12 + 우 710 = 1413 → 691:710 ≈ 49:51, 즉 실질 1:1.
          `minmax(0,...)` 는 테이블이 넓어질 때 칸이 비율을 무시하고 밀려나는 걸 막는다. */}
      <div className="grid gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* 좌 — 품목 리스트 (샘플 498~552행) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">품목</CardTitle>
          </CardHeader>
          <CardContent>
            {/* 3-2 items + 파생 취급속성. 실수량 입력·불일치 표시는 프론트 상태로만 (D-06) */}
            {shipmentQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : shipment === undefined ? (
              <Placeholder>토트를 스캔하면 품목이 표시됩니다 (3-2)</Placeholder>
            ) : (
              <OrderDetailPanel
                items={shipment.items}
                actualQty={actualQty}
                onActualQtyChange={handleActualQtyChange}
                selectedProductId={selectedProductId}
                onSelectProduct={setSelectedProductId}
              />
            )}
          </CardContent>
        </Card>

        {/* 우 — 제품 이미지 / 박스 추천 / 포장 완료 (샘플 554~621행).
            샘플은 900px 고정 캔버스라 세 칸을 374:279:180 으로 잘라 쓰지만, 우리 본문은
            높이가 기기마다 다르고 스크롤을 허용한다(app/layout.tsx 의 결정). 그래서 비율로
            자르지 않고 내용 높이대로 쌓되, 이미지 패널에만 최소 높이를 줘서 찌그러지지 않게 한다. */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">제품 이미지</CardTitle>
            </CardHeader>
            <CardContent>
              {/* 1-6. 좌측에서 고른 품목의 입고 촬영본을 띄운다.
                  ⚠️ mock 단계에는 이미지 파일이 없어 회색 자리표시가 대신 그려진다. */}
              <div className="min-h-64">
                <ProductImagePanel
                  productName={selectedItem?.name ?? null}
                  productGtin={selectedItem?.gtin ?? null}
                  data={productImagesQuery.data}
                  isLoading={productImagesQuery.isLoading}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">박스 추천</CardTitle>
            </CardHeader>
            <CardContent>
              {/* 3-2 recommendedBox / finalBox / fillerRecommended 표시 + 3-3 오버라이드.
                  추천 박스의 재고(recommendedBox.stockQty)는 여기 남는다 — D-19 이 지운 것은
                  전체 재고 목록이지, 판단에 쓰이는 이 값이 아니다. */}
              {shipment === undefined ? (
                <Placeholder>토트를 스캔하면 추천 박스가 표시됩니다 (3-2 / 3-3)</Placeholder>
              ) : (
                <BoxRecommendationPanel
                  recommendedBox={shipment.recommendedBox}
                  finalBox={finalBox}
                  fillerRecommended={shipment.fillerRecommended}
                  availableBoxes={boxes}
                  onOverride={handleOverride}
                  isPending={overrideBox.isPending}
                  error={overrideBox.error?.message ?? null}
                />
              )}
            </CardContent>
          </Card>

          {/* 하단 액션 — 샘플 608~619행의 버튼 자리. 샘플처럼 패널로 감싸지 않고 버튼 자체를
              놓는다(포장 완료가 이 화면에서 가장 큰 요소여야 한다).
              옆의 "재피킹" 버튼도 여기 함께 들어간다 — D-20 로 화면에 두기로 확정됐고,
              호출할 API 는 없다(D-06). 그래서 컴포넌트에 넘길 props 도 없다.
              3-8. OUT_OF_STOCK·INVALID_STATE(409) 방어. 성공 시 대시보드 캐시 무효화. */}
          <PackCompleteButton
            onComplete={handleComplete}
            disabled={shipment === undefined}
            isPending={completePacking.isPending}
            error={completePacking.error}
          />
        </div>
      </div>
    </div>
  );
}

/** 지금 어떤 배송단위를 잡고 있는지 한 줄로 — 토트 바 오른쪽 끝에 붙는다 */
function ShipmentSummary({
  lineName,
  seqNo,
  toteBarcode,
}: {
  lineName: string;
  seqNo: number;
  toteBarcode: string | null;
}) {
  return (
    <dl className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-0.5 border-2 bg-muted px-3 py-1.5 text-sm">
      <div className="flex gap-2">
        <dt className="text-muted-foreground">라인</dt>
        <dd className="font-medium">{lineName}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="text-muted-foreground">분할</dt>
        <dd className="font-medium tabular-nums">{seqNo}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="text-muted-foreground">토트</dt>
        <dd className="font-mono font-medium">{toteBarcode ?? "—"}</dd>
      </div>
    </dl>
  );
}
