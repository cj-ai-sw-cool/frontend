import type { PutawayTier } from "@/lib/types";

/** 정렬 규칙(정본 §4.1) 표기 — 위치 패널·이동 목록이 함께 쓴다 */
export const PUTAWAY_TIER_LABEL: Record<PutawayTier, string> = {
  SAME_LOT: "같은 로트",
  SAME_SELLER: "같은 화주",
  EMPTY: "빈 칸",
};

/**
 * 로케이션 코드 `{센터}-{존}-{통로:2}-{베이:2}-{단:2}-{위치:2}` 분해(정본 §12.2 "로케이션
 * 코드", 예 "C2-AMBS-04-13-02-03"). Stage 11D 에서 5단(`{존}-{통로}-{베이}-{단}-{위치}`)
 * 앞에 센터 접두가 붙어 6단이 됐다(정본 §12.2, 브리프 §1 "6단(센터 접두)으로"). `/putaway/
 * recommend` 는 이 값을 분해해서 주지만(`PutawayMove.aisleNo` 등, 백엔드가 이 API를
 * 맞춰 고치는 중 — 노트 "라이브 검증 대기"), "다른 칸" 입력으로 사용자가 직접 고른 칸은
 * `GET /locations/{code}/capacity` 가 분해값을 안 줘서 여기서 문자열을 쪼갠다. BIN 이
 * 아닌 코드(C1-RCV-01 등)가 들어오면 `null` — 추천·다른 칸 모두 BIN 만 다루므로(§4.3
 * "location.type = BIN") 실전에서는 걸릴 일이 없는 방어적 처리다.
 */
export function parsePutawayLocationCode(code: string): {
  centerCode: string;
  zoneCode: string;
  aisleNo: number;
  bayNo: number;
  levelNo: number;
  positionNo: number;
} | null {
  const parts = code.split("-");
  if (parts.length !== 6) return null;
  const [centerCode, zoneCode, aisle, bay, level, position] = parts;
  const aisleNo = Number(aisle);
  const bayNo = Number(bay);
  const levelNo = Number(level);
  const positionNo = Number(position);
  if (![aisleNo, bayNo, levelNo, positionNo].every(Number.isFinite)) return null;
  return { centerCode, zoneCode, aisleNo, bayNo, levelNo, positionNo };
}
