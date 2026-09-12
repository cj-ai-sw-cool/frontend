"use client";

/**
 * 출고 포장(win98) 화면의 데이터 훅 — 실제 API 호출 (docs/02-api-spec.md §3).
 *
 * 호출 래퍼는 `@/lib/endpoints` 의 `outbound` / `inbound` 를 쓴다(컴포넌트에서 fetch 직접
 * 호출 금지). 대응 관계: 3-2 useShipmentDetail / 3-3 useOverrideBox / 3-4 useBoxTypes
 *            3-5 useToteScan / 3-8 useCompletePacking
 *            1-6 useProductImages (입고에서 만든 이미지를 출고 화면이 재사용한다)
 *
 * `app/packing/_data/use-shipment-detail.ts` 와 같은 계약을 같은 방식으로 부른다 — 화면
 * 스킨만 다르고 API 대응은 동일하다.
 *
 * 에러는 `lib/api.ts` 가 계약 포맷(§0)을 `ApiError` 로 바꿔 던진다 — 화면은
 * `error.is("OUT_OF_STOCK")` 처럼 코드로 분기한다.
 *
 * 라인 목록(3-1 의 대상 라인을 고르는 조회)은 `use-lines.ts` 에 따로 있다 — 대응 API 가
 * 다른 조회라 여기 섞지 않는다.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { inbound, outbound, packing, queryKeys } from "@/lib/endpoints";

export interface OverrideBoxVariables {
  shipmentId: number;
  boxTypeId: number;
}

export interface ItemScanVariables {
  shipmentId: number;
  gtin: string;
  qty?: number;
}

export interface DamageReportVariables {
  shipmentId: number;
  gtin: string;
  qty: number;
  worker: string;
}

/**
 * 3-2 배송단위 상세.
 * `shipmentId` 가 null 이면 조회하지 않는다(`enabled: false`) — queryKey 는 그 순간에도
 * 안정된 값이 필요해 `-1` 을 채운다(`enabled: false` 라 이 키로 실제 요청은 안 나간다).
 */
export function useShipmentDetail(shipmentId: number | null) {
  return useQuery({
    queryKey: queryKeys.shipment(shipmentId ?? -1),
    queryFn: () => outbound.shipment(shipmentId as number),
    enabled: shipmentId !== null,
  });
}

/**
 * 1-6 제품 원본 이미지 — 작업자가 품목 리스트에서 고른 제품의 사진.
 * `productId` 가 null 이면(=고른 품목이 없으면) 조회하지 않는다.
 * 입고 화면이 만든 API 를 그대로 재사용한다.
 */
export function useProductImages(productId: number | null) {
  return useQuery({
    queryKey: queryKeys.productImages(productId ?? -1),
    queryFn: () => inbound.productImages(productId as number),
    enabled: productId !== null,
  });
}

/**
 * 3-4 박스 종류 목록 — 3-3 박스 오버라이드 드롭다운이 고를 수 있는 목록이다
 * (재고 0 인 박스를 못 고르게 막는 판정도 여기 `stockQty` 로 한다).
 */
export function useBoxTypes() {
  return useQuery({
    queryKey: queryKeys.boxTypes,
    queryFn: () => outbound.boxTypes(),
  });
}

/**
 * 3-5 토트 스캔 — 포장 화면 진입점. 재스캔 멱등(D-14): 활성 할당이 없으면 404
 * `TOTE_NOT_ASSIGNED`.
 *
 * 스캔하면 그 배송단위가 포장 중으로 바뀌므로 라인 목록을 다시 읽게 한다. 상세는 응답이
 * 통째로 돌려주고, `page.tsx` 가 그
 * 결과로 `shipmentId` state 를 세팅해서 `useShipmentDetail` 쿼리가 새로 열린다.
 */
export function useToteScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (barcode: string) => outbound.scanTote(barcode),
    onSuccess: () => {
      // 스캔하면 그 배송단위가 포장 중으로 바뀐다. 라인 목록을 다시 읽지 않으면 방금 스캔한
      // 건이 목록에서 계속 대기중으로 보인다.
      void queryClient.invalidateQueries({ queryKey: queryKeys.lines });
    },
  });
}

/**
 * "다음 토트" 버튼(Stage 8, 정본 §8.3·§8.4) — `GET /packing/queue?lineId=`의 첫 행을
 * 스캔 입력에 넣어 준다. 조회 자체가 화면 상태를 바꾸지 않아(주문·배치처럼 무효화할
 * 캐시가 없다) 그냥 뮤테이션으로 둔다 — 버튼을 누른 순간만 조회하면 된다.
 */
export function useNextTote() {
  return useMutation({
    mutationFn: (lineId: number) => packing.queue(lineId),
  });
}

/** 3-3 박스 오버라이드 — 성공하면 배송단위 상세 캐시를 무효화해 서버값(finalBox)을 정답으로 되돌린다. */
export function useOverrideBox() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ shipmentId, boxTypeId }: OverrideBoxVariables) =>
      outbound.overrideBox(shipmentId, boxTypeId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.shipment(variables.shipmentId),
      });
    },
  });
}

/**
 * 3-8 포장 완료 — 되돌릴 수 없다. 서버가 단일 트랜잭션에서 제품 재고와 박스 재고를 차감하며
 * 검사한다(§3-8) — 409 `OUT_OF_STOCK` / `INVALID_STATE` 방어는 `_components/pack-actions.tsx`
 * 가 담당한다.
 *
 * 성공 시 배송단위 상태와 대시보드 처리량 집계가 둘 다 바뀐다. 대시보드 캐시는 이 화면의
 * 범위 밖이라(2차 단계) 여기서는 배송단위 캐시만 무효화한다.
 */
export function useCompletePacking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (shipmentId: number) => outbound.complete(shipmentId),
    onSuccess: (_data, shipmentId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shipment(shipmentId) });
      // 완료되면 목록에서도 완료로 내려가야 한다
      void queryClient.invalidateQueries({ queryKey: queryKeys.lines });
    },
  });
}

/**
 * 낱개 스캔 대조(Stage 9, 정본 §9.3) — 품목 표의 "스캔/필요"·진행이 이 값을 쓴다.
 * 성공 응답에 최신 누계가 오지만 `ShipmentDetail` 과 모양이 달라(품목이 `gtin` 기준
 * 평평한 배열) 화면 상태로 옮기지 않고, 배송단위 상세를 무효화해 같은 소스(3-2)로
 * 다시 읽는다 — 실수량 표시가 두 갈래로 갈라지지 않는다.
 */
export function useScanItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ shipmentId, gtin, qty }: ItemScanVariables) =>
      packing.scan(shipmentId, { gtin, qty }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shipment(variables.shipmentId) });
    },
  });
}

/** "재스캔" 버튼(정본 §9.3·§9.4) — 이 배송단위의 verified_qty 를 전부 0으로 되돌린다 */
export function useRescan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (shipmentId: number) => packing.rescan(shipmentId),
    onSuccess: (_data, shipmentId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shipment(shipmentId) });
    },
  });
}

/**
 * 파손 신고(정본 §9.3) — 품목 행의 "파손 신고" 버튼. 성공하면 보충 배치가 열리거나
 * (웨이브 탭에 새 배치가 뜬다) 주문이 취소된다(라인 목록·주문 탭에도 영향) — 관련 캐시를
 * 함께 무효화한다.
 */
export function useDamageReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ shipmentId, gtin, qty, worker }: DamageReportVariables) =>
      packing.damage(shipmentId, { gtin, qty, worker }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shipment(variables.shipmentId) });
      void queryClient.invalidateQueries({ queryKey: ["waves"] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.lines });
    },
  });
}
