/**
 * "시뮬레이션" 탭 여러 파일이 같이 쓰는 라벨·색(Stage 11E). `slotting-proposal-panel.tsx`
 * 의 `KIND_LABEL`·`STATUS_LABEL` 관례 — 화면 파일마다 다시 적으면 한쪽만 고쳤을 때
 * 어긋난다.
 *
 * ⚠️ 색은 하드코딩 hex 를 **Tailwind 임의값 클래스**로만 쓴다(`bg-[#3D6FA3]`, UI 규칙
 * "inline style 금지" — `style={{}}` 만 금지고, 11B `slotting-compare-panel.tsx` 의
 * 막대 색처럼 클래스 문자열은 이미 쓰는 관례다).
 */

import type { LeadtimeSegment, SaturatedResource, SimulationRunStatus } from "@/lib/types";

/** 라이브 응답이 구간마다 한글 `label` 을 같이 준다 — 이 맵은 그 값이 없을 때(표본·
 * 비교 구간 표처럼 label 을 안 주는 자리)만 쓰는 폴백이다. */
export const SEGMENT_LABEL: Record<LeadtimeSegment, string> = {
  RECEIVE_WAIT: "접수 대기",
  WAVE_WAIT: "웨이브 대기",
  PICK_WAIT: "피킹 대기",
  PICK: "피킹",
  REBIN_WAIT: "리빈 대기",
  REBIN: "리빈",
  PACK_WAIT: "포장 대기",
  PACK: "포장",
  SHIP_WAIT: "출고 대기",
};

/** 작업/대기 구분 — 라이브 응답(`SimulationLeadtimeRow.kind`)에 실제로 있다(2026-09-16
 * 확인, 처음엔 없다고 들었다) — 이 함수는 그 값이 없는 자리(비교 구간 표 등)의 폴백이다. */
export function segmentKindOf(segment: LeadtimeSegment): "WAIT" | "WORK" {
  return segment.endsWith("_WAIT") ? "WAIT" : "WORK";
}

/** 작업(WORK) = 파랑, 대기(WAIT) = 주황 — 11B 전후 비교 막대(파랑/초록)와 같은 문법으로
 * "색이 뜻을 나른다"를 유지하되, 여기서는 전후가 아니라 작업/대기를 가른다 */
export const SEGMENT_COLOR_CLASS: Record<"WAIT" | "WORK", string> = {
  WORK: "bg-[#3D6FA3]",
  WAIT: "bg-[#D98A3D]",
};

/** 위와 같은 색의 SVG `fill` 값 — Tailwind `bg-*` 클래스는 `background-color` 라 SVG
 * `<rect>` 에는 못 쓴다(`currentColor` 로 우회하려면 `text-*` 클래스가 필요해 오히려
 * 복잡해진다), 그래서 차트 SVG 는 이 hex 를 속성으로 직접 준다(`style` prop 이 아니라
 * SVG 속성이라 "inline style 금지" 규칙에 걸리지 않는다). */
export const SEGMENT_FILL: Record<"WAIT" | "WORK", string> = {
  WORK: "#3D6FA3",
  WAIT: "#D98A3D",
};

export const RUN_STATUS_LABEL: Record<SimulationRunStatus, string> = {
  QUEUED: "대기",
  RUNNING: "실행 중",
  STOPPED: "정지됨",
  DONE: "완료",
  FAILED: "실패",
};

/** 라이브 대조: 단수형(`PACK_STATION`·`PICKER`·`REBINNER` 확인, `TOTE`·`REBIN_SLOT`
 * 은 같은 규칙으로 미룬 추정) */
export const RESOURCE_LABEL: Record<SaturatedResource, string> = {
  TOTE: "토트",
  REBIN_SLOT: "리빈 슬롯",
  PACK_STATION: "포장대",
  PICKER: "피커",
  REBINNER: "리빈 작업자",
  NONE: "없음",
};
