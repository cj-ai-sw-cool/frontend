"use client";

/**
 * win98 화면이 쓰는 데이터 훅.
 *
 * 예전에는 이 파일이 mock 사본을 들고 있었다. 확정본 화면(`app/inbound`)이 실제 API 로
 * 넘어간 뒤에도 여기만 가짜 데이터를 돌려주고 있어서, 같은 흐름인데 두 화면의 동작이
 * 갈렸다. 이제 훅은 한 곳에만 두고 여기서는 그대로 내보낸다 — 계약이 바뀌면 한 번만 고친다.
 *
 * 여기에만 있는 것은 시연용 바코드 발급 하나다. 확정본 화면에는 이 버튼이 없다.
 */

import { useMutation } from "@tanstack/react-query";
import { demo } from "@/lib/endpoints";
import type { DemoNextBarcode, DemoStatus } from "@/lib/types";

export {
  useBarcodeScan,
  useConfirmMeasurement,
  useMeasure,
  useProductImages,
  useStockIn,
} from "@/app/inbound/_data/use-inbound";
export type { ConfirmVariables, StockInVariables } from "@/app/inbound/_data/use-inbound";

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
