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
    // 목업 HTML(Logistics Terminal v1.0)을 옮긴 Windows 98 스킨 화면이다.
    // ⚠️ `lib/nav.ts` 는 **화면 담당이 공유하는 파일**이다(frontend/README.md 참고).
    //    여기에 항목을 세 줄 늘렸으니 MR 에서 그 사실을 짚어 둘 것.
    //    ⚠️ 아래 /packing-win98 과 **코드를 공유하지 않는다** — 화면별로 디자인을 따로
    //       만지려고 셸·스타일·공용 조각을 각자 한 벌씩 갖는다(각 layout.tsx 주석 참고).
    href: "/inbound-win98",
    label: "w98 입고",
    owner: "P1",
    description: "Windows 98 스킨 (원본은 /inbound)",
  },
  {
    // ⚠️ **원본 /packing 은 P2 담당이라 건드리지 않았다.** 이쪽은 따로 만든 화면이다.
    href: "/packing-win98",
    label: "w98 출고",
    owner: "P1",
    description: "Windows 98 스킨 (원본은 /packing)",
  },
  {
    // ⚠️ 아직 **내용이 없는 뼈대**다 — 자리와 생김새만 잡아 뒀다.
    href: "/analytics-win98",
    label: "w98 분석",
    owner: "P1",
    description: "Windows 98 스킨 (내용 준비 중)",
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
