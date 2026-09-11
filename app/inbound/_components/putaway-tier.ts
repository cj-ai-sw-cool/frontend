import type { PutawayTier } from "@/lib/types";

/** 정렬 규칙(정본 §4.1) 표기 — 위치 패널·이동 목록이 함께 쓴다 */
export const PUTAWAY_TIER_LABEL: Record<PutawayTier, string> = {
  SAME_LOT: "같은 로트",
  SAME_SELLER: "같은 화주",
  EMPTY: "빈 칸",
};
