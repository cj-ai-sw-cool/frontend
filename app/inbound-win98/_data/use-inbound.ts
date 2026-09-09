"use client";

/**
 * 입고(win98) 화면의 데이터 훅 — 실제 API 호출 (docs/02-api-spec.md §1).
 *
 * 호출 래퍼는 `@/lib/endpoints` 의 `inbound` 를 쓴다(컴포넌트에서 fetch 직접 호출 금지).
 * 대응 관계: 1-1 useBarcodeScan / 1-3 useMeasure / 1-4 useConfirmMeasurement
 *            1-5 useStockIn / 1-6 useProductImages
 *
 * 에러는 `lib/api.ts` 가 계약 포맷(§0)을 `ApiError` 로 바꿔 던진다 — 화면은
 * `error.is("GATE_NOT_PASSED")` 처럼 코드로 분기한다(page.tsx 의 describeConfirmFailure).
 *
 * ⚠️ 1-2 `POST /inbound/products` 와 1-7 `GET /categories` 훅은 **없다.**
 *    두 계약이 v0.5 에서 삭제됐다 (D-21). 미등록 바코드는 1-1 에서 "코리안넷 마스터에 없는
 *    상품"으로 안내하고 흐름을 종료하므로 임시 마스터를 만들 이유가 없고, 분류는 1-1 응답의
 *    categoryL/categoryM 을 표시만 하므로 목록 조회도 필요 없다.
 *
 * 여기에만 있는 것은 시연용 바코드 발급 하나다.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { demo, inbound, queryKeys } from "@/lib/endpoints";
import type { ConfirmRequest, DemoNextBarcode, DemoStatus } from "@/lib/types";

export interface ConfirmVariables {
  sessionId: number;
  body: ConfirmRequest;
}

export interface StockInVariables {
  productId: number;
  qty: number;
}

/**
 * 1-1 바코드 스캔 — 입고 화면 진입점. 3분기 판정을 그대로 돌려준다.
 *
 * 계약상 이 API 는 **에러를 내지 않는다.** 마스터에 없는 바코드도 200 + `UNKNOWN` 이다
 * (§1-1). 그래서 화면은 UNKNOWN 을 성공 응답으로 받아 안내 문구로 분기한다.
 */
export function useBarcodeScan() {
  return useMutation({
    mutationFn: (barcode: string) => inbound.scan(barcode.trim()),
  });
}

/**
 * 1-3 촬영·추론 — 동기 호출, 기대 3초·상한 8초. 재촬영도 같은 훅을 다시 부른다
 * (서버가 이전 미확정 세션을 DISCARDED 처리하고 새 세션을 연다).
 *
 * 실패(TIMEOUT)는 HTTP 에러가 아니라 `status: "MEASURE_FAILED"` 로 온다 — 프론트 분기를
 * 단순하게 두려는 계약의 의도(§1-3)라, 여기서도 성공 응답으로 흘려보낸다.
 */
export function useMeasure() {
  return useMutation({
    mutationFn: (productId: number) => inbound.measure(productId),
  });
}

/**
 * 1-4 측정 확정 — APPROVE / MANUAL.
 *
 * 확정에 성공하면 제품 사진의 출처가 1-3 응답에서 1-6 으로 바뀌므로 해당 캐시를 무효화한다.
 * 재확정(같은 화면에서 촬영→확정을 반복)해도 최신 세션 사진이 다시 조회된다.
 *
 * 계약이 정한 실패: 409 `GATE_NOT_PASSED`(게이트 미통과 세션에 APPROVE),
 * 409 `SESSION_ALREADY_CONFIRMED`(확정·폐기된 세션), 404 `SESSION_NOT_FOUND`,
 * 400 `VALIDATION_ERROR`(무게 미확정 등).
 *
 * ⚠️ 치수 축 규약(D-18): 서버는 MANUAL 로 받은 dims 도 **가로·세로를 스왑 정렬해서 저장**한다
 *    (`widthCm >= lengthCm` 불변식, 높이는 건드리지 않음). 그런데 1-4 응답에는 dims 가 없어서
 *    화면이 정렬 결과를 되받을 수 없다 — 수기 입력 폼 옆의 안내 문구가 작업자에게 이 사실을
 *    알리는 유일한 수단이다.
 */
export function useConfirmMeasurement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, body }: ConfirmVariables) => inbound.confirm(sessionId, body),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.productImages(data.productId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary });
    },
  });
}

/**
 * 1-5 수량 입고 — 촬영분 포함 전체 수량. 재고 증가의 **유일한** 경로다 (D-09).
 * 1-4 확정은 재고를 건드리지 않으므로, 촬영에 쓴 실물 1개도 여기 수량에 포함해 한 번에 넣는다.
 */
export function useStockIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, qty }: StockInVariables) => inbound.stockIn(productId, qty),
    onSuccess: () => {
      // 대시보드의 입고 집계가 바뀐다
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary });
    },
  });
}

/**
 * 1-6 제품 원본 이미지 — **확정 후** 사진의 출처다.
 * 확정 전에는 1-3 응답의 `images` 를 그대로 쓰고, 확정 뒤에는 세션이 닫히므로 이쪽으로 옮긴다.
 * (출고 포장 화면도 같은 API 를 쓴다 — `app/packing-win98/_data/use-shipment-detail.ts`)
 *
 * `page.tsx` 는 1-4 확정에 성공한 뒤에만 이 훅을 켠다(그 전에는 productId 자리에 null 을 준다).
 */
export function useProductImages(productId: number | null) {
  return useQuery({
    queryKey: queryKeys.productImages(productId ?? -1),
    queryFn: () => inbound.productImages(productId as number),
    enabled: productId !== null,
  });
}

/**
 * 다음 시연 바코드 발급 (`POST /admin/demo/inbound/next-barcode`).
 *
 * 시연장에 스캐너가 없어 화면의 버튼이 이 API 로 바코드를 받아 스캔 칸을 채운다.
 * 다 쓰면 서버가 204 를 주므로 결과가 `null` 이다 — 에러가 아니라 "더 줄 게 없다"이다.
 */
export function useNextDemoBarcode() {
  return useMutation<DemoNextBarcode | null, Error, void>({
    mutationFn: () => demo.nextBarcode(),
  });
}

/**
 * 시연 상태 조회 (`GET /admin/demo/status`).
 *
 * 입고 세 건이 다 끝났는지 볼 때 쓴다 — 다 끝났으면 화면이 창고 적재 시뮬레이션으로 넘어간다.
 *
 * ⚠️ 조회인데 `useQuery` 가 아니라 `useMutation` 이다. 화면에 늘 떠 있어야 하는 값이 아니라
 *    **입고가 한 건 끝난 그 순간에만** 궁금한 값이라서다. 쿼리로 두면 캐시된 옛 값을 보고
 *    판정하거나, 안 쓰는 동안에도 폴링이 돈다.
 * ⚠️ 같은 판정을 `useNextDemoBarcode` 로 하면 안 된다. 그쪽은 바코드를 **소비**해서,
 *    확인하는 것만으로 다음 상품 하나를 건너뛴다.
 */
export function useDemoStatus() {
  return useMutation<DemoStatus, Error, void>({
    mutationFn: () => demo.status(),
  });
}
