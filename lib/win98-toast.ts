/**
 * win98 스킨 화면의 알림(sonner) 옵션.
 *
 * 기본 토스트는 둥근 모서리에 흐린 그림자라 이 화면들의 각진 베벨과 어긋난다. 모양은
 * `app/globals.css` 의 `.win98-toast` 규칙이 잡고, 여기서는 표시 시간만 정한다.
 *
 * ⚠️ 화면마다 `_components/win98-ui.tsx` 를 따로 두는 구조지만 이 값은 여기 한 곳에만 둔다.
 *    입고와 출고가 각자 복사해 들고 있으면 표시 시간이 갈라지는데, 같은 알림이 화면마다
 *    다른 시간 떠 있으면 작업자가 화면을 옮길 때마다 기다리는 감각을 다시 익혀야 한다.
 */
export const w98Toast = {
  /** 성공 — 다음 작업을 바로 이어가야 하므로 짧게 지나간다 (사용자 지적) */
  success: { className: "win98-toast", duration: 1600 },
  /** 실패·안내 — 성공보다는 길게 두되 기본 4 초는 화면을 오래 가린다 (사용자 지적) */
  notice: { className: "win98-toast", duration: 2600 },
} as const;
