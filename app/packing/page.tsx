import { PageHeader, Placeholder } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * 출고 포장 화면 — P2 담당 (docs/05-team-plan.md §2)
 *
 * 레이아웃
 *   상단: 라인별 배송 내역 — 배송단위 리스트를 상태별로 (docs/02-api-spec.md §3-1, D-12)
 *   좌: 배송 주문서 상세 (제품 종류·개수·취급 정보)   — docs/01-mvp.md §3
 *   우 상단: 추천 박스 / 우 하단: 제품 재고 현황, 창고 현황
 *
 * 호출 순서 (docs/02-api-spec.md §5)
 *   3-5 scanTote → (제품 클릭) 1-6 images → [불일치 시 프론트 표시만, D-06]
 *   → [필요 시] 3-3 overrideBox → 3-8 complete
 *   래퍼는 `@/lib/endpoints` 의 `outbound` 를 쓴다.
 *
 * ⚠️ 미정 — `lineId` 를 어디서 얻을지 정해야 한다. 라우트 파라미터(`/packing/[lineId]`)로 둘지,
 *    화면 안 셀렉터로 둘지에 따라 라우팅이 달라진다. P2 가 정하고 04-decisions.md 에 기록할 것.
 */
export default function PackingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="출고 포장"
        description="토트 스캔 → 박스 추천 확인 → 포장 완료"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">라인별 배송 내역</CardTitle>
        </CardHeader>
        <CardContent>
          {/* TODO(P2): 3-1 GET /lines/{lineId}/shipments?status=
              배송단위 리스트를 대기중(TOTE_ASSIGNED)/진행중(PACKING)/완료(PACKED) 로 표시 (D-12).
              주문 단위 그룹 상세(A안)는 추후 확장이므로 지금은 리스트만.
              상태 탭은 components/ui/tabs.tsx 사용. */}
          <Placeholder>라인 선택 · 상태별 배송단위 리스트 (3-1)</Placeholder>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">배송단위 상세</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* TODO(P2): 3-5 토트 스캔 진입. 재스캔은 멱등 (D-14).
                TOTE_NOT_ASSIGNED(404) 분기 처리 */}
            <Placeholder>토트 바코드 스캔 (3-5)</Placeholder>
            {/* TODO(P2): items + 파생 취급속성. 실수량 입력·불일치 표시는 프론트 상태로만 (D-06) */}
            <Placeholder>품목 리스트 · 실수량 입력 · 불일치 표시 (3-2)</Placeholder>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">추천 박스</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* TODO(P2): recommendedBox / finalBox / fillerRecommended 표시 + 3-3 오버라이드 */}
              <Placeholder>추천 박스 · 오버라이드 (3-2 / 3-3)</Placeholder>
              {/* TODO(P2): 3-8. OUT_OF_STOCK·INVALID_STATE(409) 방어. 성공 시 대시보드 캐시 무효화 */}
              <Placeholder>포장 완료 (3-8)</Placeholder>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">재고 현황</CardTitle>
            </CardHeader>
            <CardContent>
              {/* TODO(P2): 3-4 박스 재고 */}
              <Placeholder>박스 재고 (3-4) · 창고 현황</Placeholder>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
