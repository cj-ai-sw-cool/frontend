import { redirect } from "next/navigation";

/**
 * `/packing` 인덱스 — 실제 화면은 `/packing/[lineId]`(이 폴더의 `[lineId]/page.tsx`)에 있다.
 *
 * `DEFAULT_LINE_ID = 1` 은 "지금 로그인한 작업자가 어느 라인 소속인가"를 아직 정하지
 * 못해서 두는 임시값이다 — 라인 선택 UI나 인증 연동이 생기기 전까지는 첫 라인으로 보낸다.
 * D-12 가 "라인은 3개"라고 확정했고, 대시보드 mock(`app/dashboard/_mock/dashboard.ts`)의
 * `lineId: 1` = "라인A" 관례를 그대로 따른다.
 */
const DEFAULT_LINE_ID = 1;

export default function PackingIndexPage() {
  redirect(`/packing/${DEFAULT_LINE_ID}`);
}
