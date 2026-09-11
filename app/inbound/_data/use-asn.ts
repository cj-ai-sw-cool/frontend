"use client";

/**
 * 입고 화면의 ASN·검수 데이터 훅 (Stage 3, docs/02-system/02-data-model.md §3.5).
 *
 * `use-inbound.ts` 가 1-1~1-6(스캔·촬영·확정·제품 이미지)을 맡고, 이 파일은 ASN 등록·도착·
 * 검수 입력·완료·마감을 맡는다 — 둘 다 `@/lib/endpoints` 의 래퍼만 쓴다(fetch 직접 호출 금지).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { asn, inventory, queryKeys } from "@/lib/endpoints";
import type { AddReceiptItemRequest, AsnQuery, CreateAsnRequest } from "@/lib/types";

/** ASN 목록 — 좌측 열 상태 필터 탭 */
export function useAsnList(params?: AsnQuery) {
  return useQuery({
    queryKey: queryKeys.asns(params),
    queryFn: () => asn.list(params),
  });
}

/** ASN 상세 — 선택한 ASN 하나. id 가 null 이면 쉬어 있는다 */
export function useAsnDetail(id: number | null) {
  return useQuery({
    queryKey: queryKeys.asn(id ?? -1),
    queryFn: () => asn.get(id as number),
    enabled: id !== null,
  });
}

/** ASN 등록 — 성공하면 목록을 무효화한다 */
export function useCreateAsn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAsnRequest) => asn.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["asns"] });
    },
  });
}

/**
 * 도착 처리 — ARRIVED(첫 도착) 또는 RECEIVING(재도착), receipt OPEN 을 새로 연다.
 * 성공하면 그 ASN 상세와 목록을 무효화한다 — 상태·receipt 목록이 바뀐다.
 */
export function useArriveAsn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => asn.arrive(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.asn(id) });
      void queryClient.invalidateQueries({ queryKey: ["asns"] });
    },
  });
}

/** 이 receipt 에서 아직 검수 입력 안 된 ASN 품목 — 바코드 패널 아래 미검수 품목 목록 */
export function usePendingItems(receiptId: number | null) {
  return useQuery({
    queryKey: queryKeys.pendingItems(receiptId ?? -1),
    queryFn: () => asn.pendingItems(receiptId as number),
    enabled: receiptId !== null,
  });
}

/**
 * 검수 입력 — receipt_item 등록 + RECEIVE tx. 성공하면 그 receipt 의 미검수 목록과 ASN 상세를
 * 다시 불러온다(수령 누계·미달이 바뀐다).
 */
export function useAddReceiptItem(asnId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ receiptId, body }: { receiptId: number; body: AddReceiptItemRequest }) =>
      asn.addItem(receiptId, body),
    onSuccess: (_data, { receiptId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.pendingItems(receiptId) });
      if (asnId !== null) void queryClient.invalidateQueries({ queryKey: queryKeys.asn(asnId) });
    },
  });
}

/** receipt 완료 — ASN 상태 판정(CLOSED / PARTIALLY_RECEIVED) */
export function useCompleteReceipt(asnId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (receiptId: number) => asn.completeReceipt(receiptId),
    onSuccess: () => {
      if (asnId !== null) void queryClient.invalidateQueries({ queryKey: queryKeys.asn(asnId) });
      void queryClient.invalidateQueries({ queryKey: ["asns"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary });
    },
  });
}

/** 수동 마감 — PARTIALLY_RECEIVED → CLOSED */
export function useCloseAsn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => asn.close(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.asn(id) });
      void queryClient.invalidateQueries({ queryKey: ["asns"] });
    },
  });
}

/**
 * 선택 ASN 화주 기준 GTIN 재고 합 — 1-1 응답의 `product.stockQty`(T5) 대신 쓴다(정본 §3.6).
 * `GET /stock?seller&gtin` 는 상태(AVAILABLE/HOLD/DAMAGED)를 가리지 않고 행을 주므로 합쳐서 하나의
 * 숫자로 만든다. sellerCode·gtin 이 없으면 조회하지 않는다.
 */
export function useSellerGtinStock(sellerCode: string | null, gtin: string | null) {
  return useQuery({
    queryKey: ["stock", "seller-gtin", sellerCode ?? "", gtin ?? ""] as const,
    queryFn: async () => {
      const page = await inventory.stock({ seller: sellerCode ?? undefined, gtin: gtin ?? undefined });
      return page.content.reduce((sum, row) => sum + row.qty, 0);
    },
    enabled: sellerCode !== null && sellerCode !== "" && gtin !== null && gtin !== "",
  });
}
