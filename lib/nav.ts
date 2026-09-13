/**
 * 화면 4개 정의 — Windows 98 스킨 화면이 완성본이다(Stage 0 정리, docs/tasks/
 * 2026-09-09-stage0-frontend-cleanup-handoff.md §2 S0.2). 서버·클라이언트 양쪽에서
 * 쓰므로 "use client" 모듈에 두지 않는다.
 *
 * ⚠️ 화면별 `_components` 는 서로 공유하지 않는다 — 화면마다 셸·스타일·공용 조각을
 *    각자 한 벌씩 갖는다(각 layout.tsx 주석 참고).
 *
 * 창고 3D 단독 라우트는 제거됐다(Stage 1, docs/tasks/2026-09-09-stage1-master-
 * handoff.md §3 S1.4a). 분석 화면이 같은 3D 컴포넌트를 "3D 전체 ▶"로 이미 렌더하므로
 * 단독 화면은 중복이었다.
 */
export const NAV = [
  {
    href: "/center/C1/inbound",
    label: "입고",
    description: "ASN 검수 → 측정 → 수량 입고",
  },
  {
    href: "/center/C1/packing",
    label: "출고 포장",
    description: "토트 스캔 → 박스 추천 → 포장 완료",
  },
  {
    href: "/center/C1/analytics",
    label: "분석",
    description: "창고 지도 · 입출고 흐름 · 규격별 재고",
  },
  {
    /* Stage 11D — 센터 축 밖의 독립 라우트(정본 §12.8). 주문 라우팅·센터 간 이동·글로벌
     * ATP·센터 요약을 한 창에서 본다(브리프 §2). */
    href: "/hub",
    label: "다창고 허브",
    description: "주문 라우팅 · 센터 간 이동 · 글로벌 ATP · 센터 요약",
  },
] as const;

export type NavItem = (typeof NAV)[number];
