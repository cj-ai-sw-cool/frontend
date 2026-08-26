/**
 * 라인별 배송 내역(3-1) mock 데이터 — 백엔드가 준비되기 전까지 화면을 굴리기 위한 것.
 *
 * ⚠️ 이 폴더의 값은 전부 "가짜"다. 실제 호출은 `@/lib/endpoints` 의 `outbound.lineShipments`
 *    를 쓰고, 교체 지점은 `app/packing/_data/use-line-shipments.ts` 한 곳뿐이다.
 *
 * 규칙
 * - 모든 mock 은 `@/lib/types` 의 계약 타입으로 타입 표기한다.
 *   → docs/02-api-spec.md 가 바뀌어 타입이 달라지면 여기서 **컴파일 에러**가 난다.
 * - lineId 1 은 docs/02-api-spec.md §3-1 응답 예시 그대로다. shipmentId 501 / 토트 T-0012 는
 *   `_mock/shipment.ts` 의 `MOCK_SHIPMENT_DETAIL` 과 같은 배송단위라 두 mock 이 서로 어긋나지
 *   않는다(같은 배송단위를 두 화면 조각이 각각 다른 값으로 보여주면 안 된다).
 * - D-12 로 이 리스트에는 TOTE_ASSIGNED(대기중)/PACKING(진행중)/PACKED(완료) 세 상태만
 *   나온다 — PLANNED/LOADED 는 범위 밖이다.
 */
import type { ShipmentListItem, ShipmentStatus } from "@/lib/types";

/** lineId → 그 라인의 배송단위 리스트(상태 필터링 전 전체) */
const MOCK_SHIPMENTS_BY_LINE: Record<number, ShipmentListItem[]> = {
  // 라인A — docs/02-api-spec.md §3-1 예시 그대로
  1: [
    { shipmentId: 501, receiptNo: "R-20260819-0007", seqNo: 1, status: "PACKING", toteBarcode: "T-0012" },
    { shipmentId: 502, receiptNo: "R-20260819-0007", seqNo: 2, status: "TOTE_ASSIGNED", toteBarcode: "T-0018" },
    { shipmentId: 498, receiptNo: "R-20260819-0003", seqNo: 1, status: "PACKED", toteBarcode: null },
  ],
  // 라인B — 세 상태를 모두 확인할 수 있는 소규모 합성 데이터
  2: [
    { shipmentId: 601, receiptNo: "R-20260819-0011", seqNo: 1, status: "PACKED", toteBarcode: null },
    { shipmentId: 602, receiptNo: "R-20260819-0012", seqNo: 1, status: "PACKING", toteBarcode: "T-0031" },
    { shipmentId: 603, receiptNo: "R-20260819-0012", seqNo: 2, status: "TOTE_ASSIGNED", toteBarcode: "T-0032" },
  ],
  // 라인C — 2건짜리 최소 데이터(빈 리스트가 아닌 케이스도 확인)
  3: [
    { shipmentId: 701, receiptNo: "R-20260819-0020", seqNo: 1, status: "TOTE_ASSIGNED", toteBarcode: "T-0040" },
    { shipmentId: 702, receiptNo: "R-20260819-0021", seqNo: 1, status: "PACKED", toteBarcode: null },
  ],
};

/**
 * `GET /lines/{lineId}/shipments?status=` mock.
 * status 를 생략하면(undefined) 세 상태 전부를 돌려준다 — 실제 API 와 같은 의미.
 * 등록되지 않은 lineId 는 빈 배열(= "이 라인에는 배송단위가 없다")로 방어한다.
 */
export function mockLineShipments(lineId: number, status?: ShipmentStatus): ShipmentListItem[] {
  const shipments = MOCK_SHIPMENTS_BY_LINE[lineId] ?? [];
  if (status === undefined) return shipments;
  return shipments.filter((shipment) => shipment.status === status);
}
