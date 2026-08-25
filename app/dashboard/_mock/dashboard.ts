/**
 * 통합 대시보드 화면 mock 데이터 — 백엔드가 준비되기 전까지 화면을 굴리기 위한 것.
 *
 * ⚠️ 이 폴더의 값은 전부 "가짜"다. 실제 호출은 `@/lib/endpoints` 의 `dashboard` 를 쓰고,
 *    교체 지점은 `app/dashboard/_data/use-dashboard.ts` 한 곳뿐이다.
 *
 * 규칙
 * - 모든 mock 은 `@/lib/types` 의 계약 타입으로 타입 표기한다(docs/02-api-spec.md §2-1 이
 *   바뀌어 타입이 달라지면 여기서 컴파일 에러가 난다).
 * - 기본 모양은 docs/02-api-spec.md §2-1 예시(라인A/SEOUL/ACTIVE/12/3, inbound 8/2) 그대로다.
 * - 상태 색상 분기(ACTIVE/PAUSED, docs/03-erd.md 193행)를 눈으로 확인할 수 있게 라인을
 *   3개로 늘렸다: 라인A(SEOUL·ACTIVE), 라인B(BUSAN·ACTIVE), 라인C(DAEGU·PAUSED).
 */
import type { DashboardSummary } from "@/lib/types";

/* ── 2-1 대시보드 요약 초기값 ─────────────────────────────── */

export const INITIAL_DASHBOARD_SUMMARY: DashboardSummary = {
  lines: [
    // 계약 예시(§2-1) 그대로
    { lineId: 1, name: "라인A", regionCode: "SEOUL", status: "ACTIVE", packedCount: 12, inProgressCount: 3 },
    // 다른 지역 · 값이 다른 두 번째 가동 라인
    { lineId: 2, name: "라인B", regionCode: "BUSAN", status: "ACTIVE", packedCount: 27, inProgressCount: 5 },
    // PAUSED 라인 — 이미 쌓인 누적 처리량은 있지만(멈추기 전 작업분), 진행 중인 건 없다
    { lineId: 3, name: "라인C", regionCode: "DAEGU", status: "PAUSED", packedCount: 45, inProgressCount: 0 },
  ],
  inbound: { todayConfirmed: 8, pendingNew: 2 },
};

/* ── 실시간 갱신 시뮬레이션 ───────────────────────────────── *
 * 이 화면의 mock 은 다른 두 화면(`inbound`/`packing`)의 mock 과 성격이 다르다 — 저기는
 * 매번 같은 고정값을 돌려주지만, 여기는 **폴링(5초)마다 값이 실제로 조금씩 바뀌어야** 한다
 * (대시보드의 "실시간 갱신"이 핵심 요구사항이라서다). 이 저장소에서 처음 쓰는 패턴이라
 * 아래에 규칙을 명시적으로 남긴다.
 *
 *   packedCount / inbound.todayConfirmed
 *     하루 누적값이라 절대 감소하지 않는다. 매 호출 60% 확률로 그대로, 32% 확률로 +1,
 *     8% 확률로 +2 만큼만 늘린다(`randomAccumulate`) — 매번 오르면 5초마다 큰 폭으로
 *     뛰어 보여 "실시간 집계"라기보다 "요란한 카운터"처럼 보인다.
 *   inProgressCount / inbound.pendingNew
 *     그때그때 큐 상태라 오르내릴 수 있다. 매 호출 ±1 로 랜덤하게 흔들되(`randomWalkStep`)
 *     0 밑으로는 절대 내려가지 않게 클램프하고, 너무 크게 튀지 않도록 상한
 *     (`IN_PROGRESS_MAX`/`PENDING_NEW_MAX`)도 둔다.
 *   status(ACTIVE/PAUSED)
 *     이 시뮬레이션에서 바꾸지 않는다 — 변동 요소가 아니다.
 *   PAUSED 라인(라인C)
 *     진행 중인 작업이 없으니 값이 거의 안 움직이는 게 자연스럽다. 따로 막지는 않는다 —
 *     초기 inProgressCount 를 0으로 둬서, 0 밑 클램프가 걸리는 랜덤워크가 자연스럽게
 *     0 근처에서만 오가게 했다.
 */

/** 진행 중 큐가 한 번에 너무 크게 튀지 않도록 둔 상한 */
const IN_PROGRESS_MAX = 10;
const PENDING_NEW_MAX = 15;

/** 직전 호출의 결과. 다음 `nextDashboardSummary()` 호출이 이 값을 이어받아 갱신한다 */
let currentSummary: DashboardSummary = cloneSummary(INITIAL_DASHBOARD_SUMMARY);

/**
 * 폴링 한 번에 대응하는 "다음 상태"를 계산해 돌려주고, 그 상태를 모듈 레벨에 저장해
 * 다음 호출이 이어받게 한다. 위 규칙 참고.
 */
export function nextDashboardSummary(): DashboardSummary {
  currentSummary = {
    lines: currentSummary.lines.map((line) => ({
      ...line,
      packedCount: line.packedCount + randomAccumulate(),
      inProgressCount: clamp(line.inProgressCount + randomWalkStep(), 0, IN_PROGRESS_MAX),
    })),
    inbound: {
      todayConfirmed: currentSummary.inbound.todayConfirmed + randomAccumulate(),
      pendingNew: clamp(currentSummary.inbound.pendingNew + randomWalkStep(), 0, PENDING_NEW_MAX),
    },
  };
  return currentSummary;
}

function cloneSummary(summary: DashboardSummary): DashboardSummary {
  return {
    lines: summary.lines.map((line) => ({ ...line })),
    inbound: { ...summary.inbound },
  };
}

/** 하루 누적값용 — 감소 없이 0(60%) / +1(32%) / +2(8%) 중 하나만 돌려준다 */
function randomAccumulate(): number {
  const roll = Math.random();
  if (roll < 0.08) return 2;
  if (roll < 0.4) return 1;
  return 0;
}

/** 큐 상태용 — -1/0/+1 을 거의 고르게 돌려준다. 0 밑·상한 클램프는 호출부가 한다 */
function randomWalkStep(): number {
  const roll = Math.random();
  if (roll < 0.3) return -1;
  if (roll < 0.7) return 0;
  return 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
