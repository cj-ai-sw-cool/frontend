/**
 * 화면 3개 정의 — docs/01-mvp.md §3, 담당은 docs/05-team-plan.md §2.
 * 서버·클라이언트 양쪽에서 쓰므로 "use client" 모듈에 두지 않는다.
 */
export const NAV = [
  {
    href: "/inbound",
    label: "입고 등록",
    owner: "P1",
    description: "바코드 스캔 → 촬영·추론 → 측정 확정 → 수량 입고",
  },
  {
    href: "/packing",
    label: "출고 포장",
    owner: "P2",
    description: "토트 스캔 → 박스 추천 확인 → 포장 완료",
  },
  {
    href: "/dashboard",
    label: "통합 대시보드",
    owner: "P3",
    description: "라인별 처리량·진행 현황, 입고 현황 집계",
  },
] as const;

export type NavItem = (typeof NAV)[number];
