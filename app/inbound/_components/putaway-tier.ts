import type { PutawayTier } from "@/lib/types";

/** 정렬 규칙(정본 §4.1) 표기 — 위치 패널·이동 목록이 함께 쓴다 */
export const PUTAWAY_TIER_LABEL: Record<PutawayTier, string> = {
  SAME_LOT: "같은 로트",
  SAME_SELLER: "같은 화주",
  EMPTY: "빈 칸",
};

/**
 * 로케이션 코드 `{존}-{랙:2}-{단:2}-{열:2}` 분해(정본 §1.1, 예 "A-03-02-14").
 * `/putaway/recommend` 는 이 값을 이미 분해해서 주지만(`PutawayMove.zoneCode` 등,
 * 2026-09-11 백엔드 라이브 보고), "다른 칸" 입력으로 사용자가 직접 고른 칸은
 * `GET /locations/{code}/capacity` 가 분해값을 안 줘서 여기서 문자열을 쪼갠다.
 * BIN 이 아닌 코드(RCV-01 등)가 들어오면 `null` — 추천·다른 칸 모두 BIN 만 다루므로
 * (§4.3 "location.type = BIN") 실전에서는 걸릴 일이 없는 방어적 처리다.
 */
export function parsePutawayLocationCode(
  code: string,
): { zoneCode: string; rackNo: number; levelNo: number; colNo: number } | null {
  const parts = code.split("-");
  if (parts.length !== 4) return null;
  const [zoneCode, rack, level, col] = parts;
  const rackNo = Number(rack);
  const levelNo = Number(level);
  const colNo = Number(col);
  if (!Number.isFinite(rackNo) || !Number.isFinite(levelNo) || !Number.isFinite(colNo)) return null;
  return { zoneCode, rackNo, levelNo, colNo };
}
