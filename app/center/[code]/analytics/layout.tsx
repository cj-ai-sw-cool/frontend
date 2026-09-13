/**
 * `/center/{code}/analytics` 레이아웃 — win98 셸(`app/analytics/layout.tsx`)을 그대로
 * 다시 내보낸다. 정본 §12.8 "컴포넌트는 옮기지 말고 페이지 파일만 새 경로에서 import" —
 * 셸·폰트·스테이지 크기 계산은 전부 그 파일 한 곳에만 있다(양쪽을 따로 고칠 일이 생기지
 * 않는다).
 */
export { default } from "@/app/analytics/layout";
