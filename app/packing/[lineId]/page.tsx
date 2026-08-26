"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { notFound, useParams } from "next/navigation";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Placeholder } from "@/components/common/page-header";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { queryKeys } from "@/lib/endpoints";
import type { BoxType, ShipmentStatus } from "@/lib/types";
import { BoxRecommendationPanel } from "../_components/box-recommendation-panel";
import { LineShipmentsPanel } from "../_components/line-shipments-panel";
import { OrderDetailPanel } from "../_components/order-detail-panel";
import { PackCompleteButton } from "../_components/pack-complete-button";
import { ProductImagePanel } from "../_components/product-image-panel";
import { ToteScanInput } from "../_components/tote-scan-input";
import { useLineShipments } from "../_data/use-line-shipments";
import {
  useBoxTypes,
  useCompletePacking,
  useOverrideBox,
  useProductImages,
  useShipmentDetail,
  useToteScan,
} from "../_data/use-shipment-detail";

/**
 * 출고 포장 화면 — P2 담당 (docs/05-team-plan.md §2)
 *
 * ── 세로 예산: 916px 안에 전부 들어가야 한다 ─────────────
 * 앱 셸이 1600×1004 고정 스테이지로 바뀌면서(f5277a9·94e0808) 본문 가용 영역이
 * **1445×940 `overflow-hidden`** 이 됐다. 바깥에서 `p-grid-gap`(12) 이 이미 걸려 있어
 * 이 화면이 실제로 쓰는 자리는 **1421×916** 이다.
 *
 * ⚠️ 예전 전제("높이는 기기마다 다르니 넘치면 페이지가 스크롤된다")는 **뒤집혔다.**
 *    지금은 넘치면 스크롤이 아니라 **잘린다** — 실제로 라인별 배송 내역과 하단 액션이
 *    화면 밖으로 잘려 나가 보이지 않았다. 창고 화면에서 잘린 경고는 오출고로 이어지므로
 *    "넘치면 스크롤되겠지"에 기대지 않는다.
 *    → 패널이 **자기 높이를 직접 들고**, 넘치는 내용은 **그 패널 안에서** 스크롤한다.
 *      페이지 자체는 절대 스크롤되지 않는다.
 *
 * 세로 916 = 토트 바 80 + 12 + 2단 824
 *   좌 691 : 품목 572 + 12 + 라인별 배송 내역 240                  = 824
 *   우 718 : 제품 이미지 380 + 12 + 박스 추천 356 + 12 + 액션 64   = 824
 *     우측에서 늘어나는 칸은 **제품 이미지 하나뿐**이다(`flex-1`). 액션 칸은 버튼 높이(64)만
 *     쓰다가 3-8 이 실패하면 경고만큼(최대 120 + 12) 위로 자라고, 그만큼 이미지가 줄어든다.
 *     어느 상태에서도 합은 824 이고, **버튼 하단은 항상 좌측 `라인별 배송 내역` 패널 하단과 같은 선**이다.
 * 가로 1421 = 좌 691 + 12 + 우 718
 *   좌 691 은 Stitch 샘플 P2(localWork/stitch-sample.html 496행)의 고정 폭 그대로이고,
 *   우측은 남는 자리를 전부 쓴다. 샘플에선 710 이었는데 바깥 여백이 16→12 로 줄어
 *   8px 넓어진 것뿐이라 비율(≈49:51)은 같다.
 *
 * 패널 안 스크롤을 넣은 곳과 이유
 *   품목 리스트   — 품목 수가 정해져 있지 않다. 표만 스크롤하고 **수량 불일치 경고 배너는
 *                   위에 고정**한다(경고가 스크롤로 밀려나면 놓친다).
 *   박스 추천     — 오버라이드·충전재·오류 문구가 상황에 따라 붙었다 떨어졌다 한다.
 *   포장 완료 경고 — 409 실패 안내는 `max-h`+스크롤로 자라는 폭을 묶는다(잘라 없애지 않는다).
 *   라인별 배송 내역 — 상태 탭(전체/완료/진행중/준비중)은 고정하고 그 안 표만 스크롤한다
 *                   (`_components/line-shipments-panel.tsx`) — 탭까지 스크롤로 밀려나면
 *                   지금 어떤 상태를 보고 있는지 잃어버린다.
 *
 * 재고 현황은 이 화면에서 **제거됐다 (D-19)** — 제품 재고·박스 재고 목록 둘 다.
 *   판단에 실제로 쓰이는 추천 박스의 재고만 박스 추천 패널에 남는다(3-2 `recommendedBox.stockQty`).
 *
 * 호출 순서 (docs/02-api-spec.md §5)
 *   3-5 scanTote → (제품 클릭) 1-6 images → [불일치 시 프론트 표시만, D-06]
 *   → [필요 시] 3-3 overrideBox → 3-8 complete
 *   래퍼는 `@/lib/endpoints` 의 `outbound` 를 쓴다.
 *   1-6 은 계속 호출한다 — 다만 화면에는 **대표 한 장만** 그린다(카메라 전환 삭제).
 *   자세한 근거는 `_components/product-image-panel.tsx` 주석 참고.
 *
 * `lineId` 출처는 라우트 파라미터로 확정했다 — 화면 안 셀렉터가 아니라 `/packing/[lineId]`
 * 로 라우팅한다. 이 파일이 그 라우트의 페이지이고, `/packing`(인덱스)은 임시 기본 라인으로
 * 리다이렉트만 한다(`app/packing/page.tsx` 참고). `useParams` 로 문자열을 읽어 숫자로 파싱하고,
 * **양의 정수가 아니면**(`NaN`, 소수, 0, 음수 전부) `notFound()` 로 404 처리한다 — 잘못된
 * 라인으로 계속 진행하면 3-1 리스트가 조용히 빈 화면이 되어 원인을 알기 어렵다.
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
  /* ── 라우트 파라미터 ─────────────────────────────────────── */
  const params = useParams<{ lineId: string }>();
  const lineId = Number(params.lineId);
  // `-1`/`0`/`1.5` 처럼 숫자로는 파싱되지만 실제 라인 id 일 수 없는 값도 함께 막는다.
  if (!Number.isInteger(lineId) || lineId <= 0) notFound();

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
  /** 라인별 배송 내역(3-1) 상태 탭 필터. undefined 면 "전체"(세 상태 모두) */
  const [shipmentStatusFilter, setShipmentStatusFilter] = useState<ShipmentStatus | undefined>(
    undefined,
  );

  /* ── 데이터 ────────────────────────────────────────────── */
  const queryClient = useQueryClient();
  const scan = useToteScan(); // 3-5
  const shipmentQuery = useShipmentDetail(shipmentId); // 3-2
  const boxTypesQuery = useBoxTypes(); // 3-4 — 박스 오버라이드 드롭다운의 선택지
  const productImagesQuery = useProductImages(selectedProductId); // 1-6
  const overrideBox = useOverrideBox(); // 3-3
  const completePacking = useCompletePacking(); // 3-8
  const lineShipmentsQuery = useLineShipments(lineId, shipmentStatusFilter); // 3-1

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
        // 토트 스캔은 배송단위를 TOTE_ASSIGNED → PACKING 으로 옮긴다 — 3-1 리스트도 갱신.
        // 스캔된 토트가 지금 보고 있는 라인(route lineId)이 아니라 **응답이 알려주는 실제
        // 소속 라인**(detail.line.lineId)의 리스트를 무효화한다 — 원칙적으로 다른 라인의
        // 토트가 스캔될 수도 있다.
        invalidateLineShipments(queryClient, detail.line.lineId);
      },
    });
  }, [barcode, scan, overrideBox, completePacking, queryClient]);

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
        // 포장 완료는 배송단위를 PACKING → PACKED 로 옮긴다 — 3-1 리스트도 갱신.
        // route lineId 가 아니라 방금 완료된 배송단위의 실제 소속 라인
        // (shipment.line.lineId)을 쓴다 — 지금 보고 있는 라인과 항상 같다는 보장이 없다.
        invalidateLineShipments(queryClient, shipment.line.lineId);
      },
    });
  }, [shipment, completePacking, scan, queryClient]);

  /* ── 표시 ──────────────────────────────────────────────── */
  const isScanning = scan.isPending || shipmentQuery.isLoading;

  return (
    /* 916 = 940(본문 높이) − 12×2(바깥 p-grid-gap). 여기서 padding 을 또 주면 안 된다.
       높이를 `h-full` 이 아니라 실측값으로 박는 이유: 부모가 높이를 확정해 주지 않는 렌더
       경로가 하나라도 있으면 flex-1 자식들이 통째로 0 으로 접힌다. 스테이지 크기는 고정이라
       실측값이 흔들릴 일이 없다. */
    <div className="flex h-[916px] flex-col gap-grid-gap">
      {/* 토트 바코드 — 좌우 2단 위에 걸친 전체 폭 바 (샘플 486~494행), 높이 80.
          Card 의 기본 세로 배치·안쪽 여백을 눕히고 좌우 여백만 남겨, 안쪽 48px 입력 + 상하
          16px 여백 = 샘플과 같은 80px 가 되게 했다.
          예전에는 스캔 실패 문구가 길어질 때 바가 늘어나도록 min-h 로 뒀지만, 지금은 늘어난
          만큼 아래 2단이 잘리므로 **고정 높이(h-20)** 다. 문구가 길어질 때 잘리지 않게 하는 일은
          바의 높이가 아니라 ToteScanInput 안쪽에서 처리한다(line-clamp + title 전문 보존).
          3-5 진입점. 재스캔은 멱등 (D-14). TOTE_NOT_ASSIGNED(404) 는 바 오른쪽에 표시된다. */}
      <Card className="h-20 shrink-0 flex-row items-center gap-4 px-4 py-0">
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

      {/* 좌우 2단 — 높이 824(=916 − 토트 바 80 − 간격 12).
          예전에는 `min-[1100px]` 브레이크포인트로 1단↔2단을 갈랐다. 그 판단은 **뒤집혔다** —
          화면이 뷰포트를 직접 쓰지 않고 1600×1004 스테이지를 통째로 scale() 로 줄여 넣기
          때문에(components/fixed-stage.tsx), 작은 기기에서는 폭이 좁아지는 게 아니라 전체가
          작아진다. 즉 레이아웃이 바뀔 일이 없어서 브레이크포인트 자체가 의미를 잃었다.
          `min-w-0` 은 그대로 필요하다 — 긴 제품명이 좌측 단을 밀어내지 못하게 막는다. */}
      <div className="flex min-h-0 flex-1 gap-grid-gap">
        {/* 좌 691 — 품목 572 + 라인별 배송 내역 240 */}
        <div className="flex w-[691px] shrink-0 flex-col gap-grid-gap">
          {/* 품목 — 남는 높이 전부(572). 좌측 단에서 유일하게 늘어나는 칸이다 */}
          <Card className="min-h-0 flex-1">
            <CardHeader>
              <CardTitle className="text-base">품목</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-hidden">
              {/* 3-2 items + 파생 취급속성. 실수량 입력·불일치 표시는 프론트 상태로만 (D-06).
                  스크롤은 이 안(OrderDetailPanel)에서 표만 따로 한다 — 경고 배너는 고정이다. */}
              {shipmentQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : shipment === undefined ? (
                <FillArea>
                  <Placeholder>토트를 스캔하면 품목이 표시됩니다 (3-2)</Placeholder>
                </FillArea>
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

          <Card className="h-[240px]">
            <CardHeader>
              <CardTitle className="text-base">라인별 배송 내역</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-hidden">
              {/* 3-1 GET /lines/{lineId}/shipments?status= — 대기중(TOTE_ASSIGNED)/
                  진행중(PACKING)/완료(PACKED) 상태 탭으로 표시 (D-12). 주문 단위 그룹
                  상세(A안)는 추후 확장이라 지금은 리스트만, 행은 클릭할 수 없다.
                  스크롤은 LineShipmentsPanel 안(탭 내용)에서만 한다 — 여기는 overflow-hidden
                  으로 이중 스크롤을 막는다(품목 카드와 같은 패턴).
                  isError 를 따로 가른다 — 안 가르면 data 가 undefined 라 `?? []`로 빈 배열이
                  되고, 그 결과 LineShipmentsPanel 이 "표시할 배송단위가 없습니다"를 그려서
                  진짜로 빈 라인과 조회 실패를 구분할 수 없게 된다(`box-recommendation-panel.tsx`
                  의 role="alert" + text-status-error 관례를 그대로 따른다). */}
              {lineShipmentsQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : lineShipmentsQuery.isError ? (
                <div
                  role="alert"
                  className="flex h-full items-center justify-center text-center text-sm text-status-error"
                >
                  배송 내역을 불러오지 못했습니다
                </div>
              ) : (
                <LineShipmentsPanel
                  shipments={lineShipmentsQuery.data?.shipments ?? []}
                  status={shipmentStatusFilter}
                  onStatusChange={setShipmentStatusFilter}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* 우 718 — 제품 이미지 380(가변) / 박스 추천 356 / 액션 64(가변) (샘플 554~621행).
            샘플은 900px 캔버스를 374:279:180 비율로 잘랐지만, 우리 세 칸은 담는 내용이 달라
            비율 대신 **필요한 높이**로 잡았다.
              이미지 380 : 사진 자리 306(예전 274 + 상태 줄 20·간격 12 — 상태 줄을 지우면서 흡수) +
                           카드 여백 74. 셋 중 유일하게 높이를 안 박은 칸이라, 액션이 줄어든 만큼을
                           그대로 **사진 자리**가 먹는다
              박스 356   : 박스 이름·내치수·재고 + 충전재 경고 + 박스 변경 셀렉트가 다 들어가는 최소치
              액션 64    : 버튼 행 하나. 예전에는 여기에 상시 안내 문구가 있어 144 를 썼는데
                           문구가 삭제되면서(사용자 요청) 버튼만 남았다. 그 80 이 사진 자리로 갔다.
            버튼 아래에 빈 자리를 남기지 않는 게 이번 배치의 핵심이다 — 액션이 마지막 칸이고
            그 마지막 자식이 버튼 행이라, 버튼 하단이 좌측 `라인별 배송 내역` 패널 하단(y=824)과 맞는다. */}
        <div className="flex min-w-0 flex-1 flex-col gap-grid-gap">
          <Card className="min-h-0 flex-1">
            <CardHeader>
              <CardTitle className="text-base">제품 이미지</CardTitle>
              {/* 선택된 품목명을 제목과 같은 줄 우측에 (2026-08-25, 사용자 요청).
                  패널 내부의 상태 요약 줄을 없애고 그 몫을 헤더로 올렸다 — 상세는
                  product-image-panel.tsx 주석 참고. 긴 이름이 제목을 밀어내지 않도록
                  truncate + max-w 로 묶는다. */}
              <CardAction>
                <span
                  className="block max-w-[200px] truncate text-sm text-muted-foreground"
                  title={selectedItem?.name ?? undefined}
                >
                  {selectedItem?.name ?? "선택된 품목 없음"}
                </span>
              </CardAction>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-hidden">
              {/* 1-6. 좌측에서 고른 품목의 사진을 **대표 한 장만** 띄운다(카메라 전환 삭제).
                  ⚠️ mock 단계에는 이미지 파일이 없어 회색 자리표시가 대신 그려진다. */}
              <ProductImagePanel
                productName={selectedItem?.name ?? null}
                productGtin={selectedItem?.gtin ?? null}
                data={productImagesQuery.data}
                isLoading={productImagesQuery.isLoading}
              />
            </CardContent>
          </Card>

          <Card className="h-[356px]">
            <CardHeader>
              <CardTitle className="text-base">박스 추천</CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto">
              {/* 3-2 recommendedBox / finalBox / fillerRecommended 표시 + 3-3 오버라이드.
                  추천 박스의 재고(recommendedBox.stockQty)는 여기 남는다 — D-19 이 지운 것은
                  전체 재고 목록이지, 판단에 쓰이는 이 값이 아니다.
                  오버라이드하면 "원래 추천" 줄이 한 줄 늘어난다. 그때 잘리지 않도록
                  이 칸은 고정 높이 + 안쪽 스크롤이다. */}
              {shipment === undefined ? (
                <FillArea>
                  <Placeholder>토트를 스캔하면 추천 박스가 표시됩니다 (3-2 / 3-3)</Placeholder>
                </FillArea>
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
              3-8. OUT_OF_STOCK·INVALID_STATE(409) 방어. 성공 시 대시보드 캐시 무효화.
              높이를 주지 않는다(`shrink-0` + 내용 높이) — 평소 버튼 64, 실패 시 경고만큼 위로
              자란다. 늘어난 만큼은 위 제품 이미지(`flex-1`)가 내주므로 합은 824 로 고정이다. */}
          <div className="shrink-0">
            <PackCompleteButton
              onComplete={handleComplete}
              disabled={shipment === undefined}
              isPending={completePacking.isPending}
              error={completePacking.error}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 3-1 라인별 배송 내역 캐시를 무효화한다.
 *
 * `queryKeys.lineShipments(lineId)` 는 `["lines", lineId, "shipments", "ALL"]` 을 돌려주는데
 * (status 생략 시 4번째 칸이 `"ALL"`), status 로 갈라진 그 4번째 칸까지 그대로 넘기면
 * `invalidateQueries` 의 기본 prefix 매칭이 `status="ALL"` 쿼리만 지우고 완료/진행중/준비중
 * 탭의 캐시는 남겨 둔다. 그래서 앞 3칸(`slice(0, 3)`)만 prefix 로 써서 네 탭을 한 번에
 * 무효화한다 — `["lines", lineId, "shipments"]` 를 손으로 다시 적지 않고 `queryKeys` 가
 * 만드는 키 모양에서 그대로 파생시킨다(키 모양이 바뀌면 여기도 같이 컴파일 에러가 나야 한다).
 */
function invalidateLineShipments(queryClient: QueryClient, lineId: number): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.lineShipments(lineId).slice(0, 3) });
}

/**
 * 고정 높이 패널을 꽉 채우는 자리표시 영역.
 *
 * 공용 `Placeholder`(components/common/page-header.tsx)는 `min-h-32` 라서, 166~498px 짜리
 * 패널 안에 넣으면 위쪽에 작게 몰리고 아래가 텅 빈다. 공용 컴포넌트는 입고·대시보드도 함께
 * 쓰므로 여기서 고치지 않고, 자식에게 높이만 주입한다.
 */
function FillArea({ children }: { children: ReactNode }) {
  return <div className="h-full [&>*]:h-full">{children}</div>;
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
