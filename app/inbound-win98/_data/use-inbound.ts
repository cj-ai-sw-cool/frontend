"use client";

/**
 * 🔌 API 교체 지점 — 이 파일 하나만 고치면 입고 화면 전체가 실제 API 로 넘어간다.
 *
 * 지금은 `../_mock/inbound.ts` 의 가짜 데이터를 돌려주지만, 반환 형태를
 * **TanStack Query 와 똑같이** 맞춰 놨다. 그래서 백엔드가 준비되면 각 훅의 몸통만
 * 아래처럼 바꾸면 되고, `_components/` 와 `page.tsx` 는 한 줄도 수정할 필요가 없다.
 * (출고 화면의 `app/packing/_data/use-shipment-detail.ts` 와 같은 규약이다.)
 *
 *   조회(query)  { data, isLoading, error }
 *     return useQuery({
 *       queryKey: queryKeys.categories,
 *       queryFn: () => inbound.categories(),
 *     });
 *
 *   변경(mutation)  { mutate, isPending, error, data, reset }
 *     return useMutation({ mutationFn: (barcode: string) => inbound.scan(barcode) });
 *     // 성공 후 캐시 무효화가 필요하면 onSuccess 에서
 *     //   queryClient.invalidateQueries({ queryKey: queryKeys.productImages(productId) })
 *     //   queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary })
 *
 * 호출 래퍼는 `@/lib/endpoints` 의 `inbound` 를 쓴다(컴포넌트에서 fetch 직접 호출 금지).
 * 대응 관계: 1-1 useBarcodeScan / 1-3 useMeasure / 1-4 useConfirmMeasurement
 *            1-5 useStockIn / 1-6 useProductImages
 *
 * ⚠️ 1-2 `POST /inbound/products` 와 1-7 `GET /categories` 훅은 **만들지 않는다.**
 *    두 계약이 v0.5 에서 삭제됐다 (D-21). 미등록 바코드는 1-1 에서 "코리안넷 마스터에 없는
 *    상품"으로 안내하고 흐름을 종료하므로 임시 마스터를 만들 이유가 없고, 분류는 1-1 응답의
 *    categoryL/categoryM 을 표시만 하므로 목록 조회도 필요 없다.
 *    이전 개정의 `useCreateProduct` TODO(P1)는 이 결정으로 **소멸**했다.
 *    ⚠️ `lib/types.ts` 의 `Category` 와 `lib/endpoints.ts` 의 categories/createProduct 래퍼는
 *       팀 공유 파일이라 그대로 둔다 — 여기서 **호출만 끊었다.** 제거는 팀에 알린 뒤 따로 한다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import type {
  ConfirmRequest,
  ConfirmResponse,
  MeasurementResponse,
  ProductImagesResponse,
  ScanResponse,
  StockInResponse,
} from "@/lib/types";
import {
  MOCK_MEASUREMENT_BY_PRODUCT_ID,
  MOCK_PRODUCT_IMAGES,
  MOCK_SCAN_BY_BARCODE,
  MOCK_SCAN_UNKNOWN,
  MOCK_SESSION_GATE_PASSED,
  MOCK_SESSION_TO_PRODUCT_ID,
  mockConfirmResponse,
  mockStockInResponse,
} from "../_mock/inbound";

/** mock 응답 지연(ms) — 로딩 상태가 화면에서 실제로 보이도록 조금 늦춘다 */
const MOCK_LATENCY_MS = 350;

/**
 * 1-3 은 실제로 "카메라 3대 촬영 + 저울 수집 + 외부 추론 호출"을 한 응답으로 처리한다.
 * 기대 3초, 상한 8초 (docs/02-api-spec.md §1-3). 촬영 버튼을 누른 뒤 화면이 몇 초간
 * 기다리는 게 정상이라는 걸 mock 에서도 느낄 수 있도록 다른 호출보다 길게 잡았다.
 */
const MOCK_MEASURE_LATENCY_MS = 1200;

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
  latencyMs: number = MOCK_LATENCY_MS,
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
          const failure = thrown instanceof Error ? thrown : new Error(String(thrown));
          setData(undefined);
          setError(failure);
          setIsPending(false);
          options?.onError?.(failure);
        }
      }, latencyMs);
    },
    [run, latencyMs],
  );

  const reset = useCallback(() => {
    setIsPending(false);
    setError(null);
    setData(undefined);
  }, []);

  return { mutate, isPending, error, data, reset };
}

/* ── mock 동작 정의 (실제 API 로 바꾸면 통째로 사라진다) ──── */

/**
 * 1-1 `POST /inbound/scans` — 3분기 판정.
 *
 * 계약상 이 API 는 **에러를 내지 않는다.** 마스터에 없는 바코드도 200 + `UNKNOWN` 이다
 * (docs/02-api-spec.md §1-1). 그래서 여기서도 throw 하지 않는다 —
 * "못 찾음"을 에러로 그리면 화면이 UNKNOWN 분기(수기 등록)로 갈 수 없다.
 */
function runScan(barcode: string): ScanResponse {
  const normalized = barcode.trim();
  return MOCK_SCAN_BY_BARCODE[normalized] ?? MOCK_SCAN_UNKNOWN;
}

/**
 * 1-3 `POST /inbound/measurements` — 촬영·추론.
 *
 * 실패(TIMEOUT)도 HTTP 에러가 아니라 `status: "MEASURE_FAILED"` 로 온다.
 * 그래서 여기서도 throw 하지 않고 응답 객체로 돌려준다 — 프론트 분기를 단순하게 두려는
 * 계약의 의도(§1-3)를 mock 에서도 지킨다.
 *
 * 재촬영도 같은 함수다: 같은 productId 로 다시 부르면 서버가 이전 미확정 세션을
 * DISCARDED 처리하고 새 세션을 연다. mock 은 세션을 들고 있지 않으므로 같은 값이 다시 온다.
 */
function runMeasure(productId: number): MeasurementResponse {
  const measurement = MOCK_MEASUREMENT_BY_PRODUCT_ID[productId];
  if (measurement === undefined) {
    // mock 표에 없는 상품 — 촬영은 됐지만 추론이 안 붙은 상태로 본다
    return { sessionId: 900 + productId, status: "MEASURE_FAILED", failReason: "TIMEOUT", weightKg: null };
  }
  return measurement;
}

export interface ConfirmVariables {
  sessionId: number;
  body: ConfirmRequest;
}

/**
 * 1-4 `POST /inbound/measurements/{sessionId}/confirm` — 승인 / 수기입력.
 *
 * mock 이 흉내 내는 계약 규칙은 하나다: **게이트 미통과 세션에 APPROVE 하면 409.**
 * 화면이 이미 승인 버튼을 잠그지만, 서버도 같은 판정을 한다는 걸 보여 두려고 남겼다
 * (버튼 잠금은 UX 이고, 실제 방어선은 서버다).
 *
 * ⚠️ 흉내 내지 않은 것
 *   · `SESSION_ALREADY_CONFIRMED`(409) — mock 은 세션 상태를 들고 있지 않아 재확정을
 *     구분할 수 없다. 실제 API 로 바꾸면 그대로 올라온다.
 *   · 무게 미확정 시 400 `VALIDATION_ERROR` — mock 세션은 전부 저울값을 갖고 있다.
 *
 * ⚠️ 치수 축 규약(D-18): 서버는 MANUAL 로 받은 dims 도 **가로·세로를 스왑 정렬해서 저장**한다
 *    (`widthCm >= lengthCm` 불변식, 높이는 건드리지 않음). 그런데 1-4 응답에는 dims 가 없어서
 *    화면이 정렬 결과를 되받을 수 없다 — 그래서 수기 입력 폼 옆의 안내 문구가 작업자에게
 *    이 사실을 알리는 유일한 수단이다. `_components/confirm-form.tsx` 참고.
 */
function runConfirm({ sessionId, body }: ConfirmVariables): ConfirmResponse {
  const productId = MOCK_SESSION_TO_PRODUCT_ID[sessionId];
  if (productId === undefined) {
    throw new ApiError(404, {
      code: "PRODUCT_NOT_FOUND",
      message: `측정 세션을 찾을 수 없습니다 (session ${sessionId}).`,
    });
  }

  if (body.method === "APPROVE" && MOCK_SESSION_GATE_PASSED[sessionId] !== true) {
    throw new ApiError(409, {
      code: "GATE_NOT_PASSED",
      message: "신뢰도 게이트 미통과 세션은 승인할 수 없습니다. 재촬영하거나 수기로 확정하세요.",
      detail: { reasons: ["LOW_CONFIDENCE"] },
    });
  }

  return mockConfirmResponse(productId, body.method);
}

export interface StockInVariables {
  productId: number;
  qty: number;
}

/**
 * 1-5 `POST /inbound/stock-in` — 수량 입고.
 * 재고 증가의 **유일한** 경로다 (D-09). 1-4 확정은 재고를 건드리지 않으므로,
 * 촬영에 쓴 실물 1개도 여기 수량에 포함해서 한 번에 넣는다.
 */
function runStockIn({ productId, qty }: StockInVariables): StockInResponse {
  return mockStockInResponse(productId, qty);
}

/* ── 화면이 쓰는 훅 ──────────────────────────────────────── */

/** 1-1 바코드 스캔 — 입고 화면 진입점. 3분기 판정을 그대로 돌려준다 */
export function useBarcodeScan(): MutationResult<string, ScanResponse> {
  return useMockMutation(runScan);
}

/** 1-3 촬영·추론 — 동기 호출, 최대 8초. 재촬영도 같은 훅을 다시 부른다 */
export function useMeasure(): MutationResult<number, MeasurementResponse> {
  return useMockMutation(runMeasure, MOCK_MEASURE_LATENCY_MS);
}

/** 1-4 측정 확정 — APPROVE / MANUAL */
export function useConfirmMeasurement(): MutationResult<ConfirmVariables, ConfirmResponse> {
  return useMockMutation(runConfirm);
}

/** 1-5 수량 입고 — 촬영분 포함 전체 수량 (D-09) */
export function useStockIn(): MutationResult<StockInVariables, StockInResponse> {
  return useMockMutation(runStockIn);
}

/**
 * 1-6 제품 원본 이미지 — **확정 후** 사진의 출처다.
 * 확정 전에는 1-3 응답의 `images` 를 그대로 쓰고, 확정 뒤에는 세션이 닫히므로 이쪽으로 옮긴다.
 * (출고 포장 화면도 같은 API 를 쓴다 — `app/packing/_data/use-shipment-detail.ts`)
 *
 * `page.tsx` 는 1-4 확정에 성공한 뒤에만 이 훅을 켠다(그 전에는 productId 자리에 null 을 준다).
 * 사진 패널은 `MeasurementImage[]` 를 받으므로 1-3 의 images 와 이 응답을 그대로 갈아끼운다.
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
