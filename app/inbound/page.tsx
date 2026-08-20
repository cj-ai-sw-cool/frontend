import { PageHeader, Placeholder } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * 입고 등록 화면 — P1 담당 (docs/05-team-plan.md §2)
 *
 * 레이아웃 (docs/01-mvp.md §3)
 *   좌: 신입고 상품 이미지
 *   우: 비전 추론값 {길이·너비·높이} + 작업자 입력 {파손주의·냉장필요·대분류·중분류·등급}
 *
 * 호출 순서 (docs/02-api-spec.md §5)
 *   1-1 scan → 1-3 measure → [게이트 미통과 시 재촬영 or MANUAL] → 1-4 confirm → 1-5 stock-in
 *   래퍼는 `@/lib/endpoints` 의 `inbound` 를 쓴다.
 */
export default function InboundPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="입고 등록"
        description="바코드 스캔 → 촬영·추론 → 측정 확정 → 수량 입고"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">상품 이미지</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* TODO(P1): 1-1 스캔 입력 + 3분기 판정(REGISTERED/NEW/UNKNOWN) 분기 */}
            <Placeholder>바코드 스캔 입력 · 1단 표시 데이터 (1-1)</Placeholder>
            {/* TODO(P1): 1-3 응답의 images 3장, 확정 후에는 1-6 fallback */}
            <Placeholder>카메라 3대 촬영 이미지 (1-3 / 1-6)</Placeholder>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">추론 결과 · 작업자 입력</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* TODO(P1): inferred 치수 + weightKg + confidence + gateFailReasons.
                gatePassed=false 면 승인 버튼 비활성화 (docs 02 §1-3) */}
            <Placeholder>치수·무게·confidence·게이트 사유 (1-3)</Placeholder>
            {/* TODO(P1): react-hook-form + zod. 분류는 1-7 코드 드롭다운 (D-13) */}
            <Placeholder>취급속성 입력 · 승인/재촬영/수기 확정 (1-4)</Placeholder>
            {/* TODO(P1): 촬영분 포함 전체 수량 (D-09) */}
            <Placeholder>수량 입고 (1-5)</Placeholder>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
