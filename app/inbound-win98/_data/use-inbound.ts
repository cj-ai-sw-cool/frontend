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
import type { DemoNextBarcode } from "@/lib/types";

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
