"use client";

/**
 * 🔌 API 교체 지점 — 이 파일 하나만 고치면 화면 전체가 실제 API 로 넘어간다.
 *
 * 지금은 `../_mock/shipment.ts` 의 가짜 데이터를 돌려주지만, 반환 형태를
 * **TanStack Query 와 똑같이** 맞춰 놨다. 그래서 백엔드가 준비되면 각 훅의 몸통만
 * 아래처럼 바꾸면 되고, `_components/` 와 `page.tsx` 는 한 줄도 수정할 필요가 없다.
 *
 *   조회(query)  { data, isLoading, error }
 *     return useQuery({
 *       queryKey: queryKeys.shipment(shipmentId),
 *       queryFn: () => outbound.shipment(shipmentId),
 *       enabled: shipmentId !== null,
 *     });
 *
 *   변경(mutation)  { mutate, isPending, error, data, reset }
 *     return useMutation({ mutationFn: (barcode: string) => outbound.scanTote(barcode) });
 *     // 성공 후 캐시 무효화가 필요하면 onSuccess 에서
 *     //   queryClient.invalidateQueries({ queryKey: queryKeys.shipment(id) })
 *     //   queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary })
 *
 * 호출 래퍼는 `@/lib/endpoints` 의 `outbound` / `inbound` 를 쓴다
 * (컴포넌트에서 fetch 직접 호출 금지).
 * 대응 관계: 3-2 useShipmentDetail / 3-3 useOverrideBox / 3-4 useBoxTypes
 *            3-5 useToteScan / 3-8 useCompletePacking
 *            1-6 useProductImages (입고에서 만든 이미지를 출고 화면이 재사용한다)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import type {
  BoxOverrideResponse,
  BoxType,
  CompleteResponse,
  ProductImagesResponse,
  ShipmentDetail,
} from "@/lib/types";
import {
  MOCK_BOX_TYPES,
  MOCK_PRODUCT_IMAGES,
  MOCK_SHIPMENT_DETAIL,
  MOCK_TOTE_BARCODE_TO_SHIPMENT_ID,
} from "../_mock/shipment";

/** mock 응답 지연(ms) — 로딩 상태가 화면에서 실제로 보이도록 조금 늦춘다 */
const MOCK_LATENCY_MS = 350;

/* ── 반환 형태 정의 ──────────────────────────────────────── */

/** TanStack Query `useQuery` 반환값 중 이 화면이 쓰는 부분만 추린 것 */
export interface QueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
}

/** TanStack Query `useMutation` 반환값 중 이 화면이 쓰는 부분만 추린 것 */
export interface MutationResult<TVariables, TData> {
  mutate: (variables: TVariables, options?: MutateOptions<TData>) => void;
  isPending: boolean;
  error: Error | null;
  data: TData | undefined;
  reset: () => void;
}

export interface MutateOptions<TData> {
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
}

/* ── mock 실행기 ─────────────────────────────────────────── */

/**
 * `value` 를 지연 후 돌려주는 가짜 query.
 * `value` 는 모듈 상수이거나 useMemo 로 안정화된 값이어야 한다(매 렌더 재실행 방지).
 * mock 은 실패하지 않으므로 error 는 항상 null 이다 — 실제 useQuery 로 바꾸면 채워진다.
 */
function useMockQuery<T>(enabled: boolean, value: T | undefined): QueryResult<T> {
  /**
   * 지연이 끝난 뒤 "도착한" 결과. `source` 가 지금 요청 대상(value)과 다르면 아직 오는 중이다.
   * isLoading 을 별도 state 로 두지 않고 렌더에서 파생시키는 이유:
   * effect 안에서 동기적으로 setState 하면 렌더가 한 번 더 돌아 lint 규칙
   * `react-hooks/set-state-in-effect` 에 걸린다.
   */
  const [resolved, setResolved] = useState<{ source: T | undefined } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => setResolved({ source: value }), MOCK_LATENCY_MS);
    return () => clearTimeout(timer);
  }, [enabled, value]);

  const isSettled = enabled && resolved !== null && resolved.source === value;

  return {
    data: isSettled ? value : undefined,
    isLoading: enabled && !isSettled,
    error: null,
  };
}

/**
 * `run` 을 지연 후 실행하는 가짜 mutation.
 * `run` 이 throw 하면 error 로 잡힌다 — 실제 API 의 4xx/5xx 자리다.
 * `run` 은 모듈 레벨 함수(항등 안정)를 넘긴다.
 */
function useMockMutation<TVariables, TData>(
  run: (variables: TVariables) => TData,
): MutationResult<TVariables, TData> {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<TData | undefined>(undefined);

  // 언마운트 후 setState 를 막는다
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const mutate = useCallback(
    (variables: TVariables, options?: MutateOptions<TData>) => {
      setIsPending(true);
      setError(null);
      setTimeout(() => {
        if (!mountedRef.current) return;
        try {
          const result = run(variables);
          setData(result);
          setIsPending(false);
          options?.onSuccess?.(result);
        } catch (thrown) {
          const failure =
            thrown instanceof Error ? thrown : new Error(String(thrown));
          setData(undefined);
          setError(failure);
          setIsPending(false);
          options?.onError?.(failure);
        }
      }, MOCK_LATENCY_MS);
    },
    [run],
  );

  const reset = useCallback(() => {
    setIsPending(false);
    setError(null);
    setData(undefined);
  }, []);

  return { mutate, isPending, error, data, reset };
}

/* ── mock 동작 정의 (실제 API 로 바꾸면 통째로 사라진다) ──── */

/** 3-5 `POST /totes/scan` — 활성 할당이 없으면 404 TOTE_NOT_ASSIGNED */
function runToteScan(barcode: string): ShipmentDetail {
  const normalized = barcode.trim().toUpperCase();
  const shipmentId: number | undefined = MOCK_TOTE_BARCODE_TO_SHIPMENT_ID[normalized];
  if (shipmentId === undefined) {
    throw new ApiError(404, {
      code: "TOTE_NOT_ASSIGNED",
      message: `활성 할당이 없는 토트입니다 (${normalized}). 토트를 다시 확인해 주세요.`,
    });
  }
  // 재스캔 멱등 — 이미 PACKING 이면 전이 없이 상세만 돌려준다 (D-14)
  return MOCK_SHIPMENT_DETAIL;
}

export interface OverrideBoxVariables {
  shipmentId: number;
  boxTypeId: number;
}

/** 3-3 `PUT /shipments/{id}/box` */
function runOverrideBox({
  shipmentId,
  boxTypeId,
}: OverrideBoxVariables): BoxOverrideResponse {
  return {
    shipmentId,
    // 계약상 recommendedBox 는 null 일 수 있다. mock 에서는 항상 값이 있다.
    recommendedBoxId: MOCK_SHIPMENT_DETAIL.recommendedBox?.boxTypeId ?? boxTypeId,
    finalBoxId: boxTypeId,
  };
}

/**
 * 3-8 `POST /shipments/{id}/complete`
 *
 * ⚠️ mock 은 더 이상 409 OUT_OF_STOCK 을 흉내 내지 않는다 (D-19).
 *   예전에는 제품 재고 mock 과 주문 수량을 비교해 부족분을 만들어 냈지만, D-19 로 제품 재고가
 *   이 화면에서 빠지면서 비교할 데이터가 없어졌다. 억지로 되살리면 화면에 보이지도 않는
 *   데이터를 mock 안에서만 유지해야 해서 지웠다.
 *
 *   판정 자체는 원래 서버 몫이다 — 실제 서버는 단일 트랜잭션에서 제품 재고와 박스 재고를
 *   차감하며 검사한다(docs/02-api-spec.md §3-8). 화면 쪽 처리는 이미 다 붙어 있어서
 *   실제 API 로 바꾸면 그대로 동작한다:
 *     `_components/pack-complete-button.tsx` 가 OUT_OF_STOCK / INVALID_STATE 를 갈라 안내한다.
 *   지금 그 표시를 눈으로 확인하고 싶으면 아래에 ApiError 를 한 줄 던져 보면 된다.
 */
function runCompletePacking(shipmentId: number): CompleteResponse {
  return {
    shipmentId,
    status: "PACKED",
    packedAt: new Date().toISOString(),
    line: { lineId: MOCK_SHIPMENT_DETAIL.line.lineId, packedCount: 13 },
  };
}

/* ── 화면이 쓰는 훅 ──────────────────────────────────────── */

/**
 * 3-2 배송단위 상세.
 * `shipmentId` 가 null 이면 조회하지 않는다 (useQuery 의 `enabled: false` 와 같은 의미).
 */
export function useShipmentDetail(shipmentId: number | null): QueryResult<ShipmentDetail> {
  const value = useMemo<ShipmentDetail | undefined>(
    () =>
      shipmentId === MOCK_SHIPMENT_DETAIL.shipmentId ? MOCK_SHIPMENT_DETAIL : undefined,
    [shipmentId],
  );
  return useMockQuery(shipmentId !== null, value);
}

/**
 * 1-6 제품 이미지 — 작업자가 품목 리스트에서 고른 제품의 사진.
 * `productId` 가 null 이면(=고른 품목이 없으면) 조회하지 않는다.
 *
 * 실제 API 로 바꿀 때:
 *   return useQuery({
 *     queryKey: queryKeys.productImages(productId),
 *     queryFn: () => inbound.productImages(productId),
 *     enabled: productId !== null,
 *   });
 * (`queryKeys.productImages` 와 `inbound.productImages` 는 `@/lib/endpoints` 에 이미 있다.)
 */
export function useProductImages(
  productId: number | null,
): QueryResult<ProductImagesResponse> {
  // useMockQuery 는 value 의 참조 동일성으로 "도착 여부"를 판정한다.
  // MOCK_PRODUCT_IMAGES 는 모듈 상수라 같은 id 면 항상 같은 객체가 나온다.
  const value = useMemo<ProductImagesResponse | undefined>(
    () => (productId === null ? undefined : MOCK_PRODUCT_IMAGES[productId]),
    [productId],
  );
  return useMockQuery(productId !== null, value);
}

/**
 * 3-4 박스 종류 목록.
 *
 * D-19 로 "재고 현황" 영역은 사라졌지만 이 훅은 **남는다** — 3-3 박스 오버라이드
 * 드롭다운이 고를 수 있는 박스 목록으로 쓰기 때문이다(재고 0 인 박스를 못 고르게 막는
 * 판정도 여기 `stockQty` 로 한다).
 */
export function useBoxTypes(): QueryResult<BoxType[]> {
  return useMockQuery(true, MOCK_BOX_TYPES);
}

/** 3-5 토트 스캔 — 포장 화면 진입점 */
export function useToteScan(): MutationResult<string, ShipmentDetail> {
  return useMockMutation(runToteScan);
}

/** 3-3 박스 오버라이드 */
export function useOverrideBox(): MutationResult<OverrideBoxVariables, BoxOverrideResponse> {
  return useMockMutation(runOverrideBox);
}

/** 3-8 포장 완료 — 되돌릴 수 없다 */
export function useCompletePacking(): MutationResult<number, CompleteResponse> {
  return useMockMutation(runCompletePacking);
}
