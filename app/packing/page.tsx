import { redirect } from "next/navigation";

/**
 * `/packing` — Stage 11D(정본 §12.8) 전 경로. 센터 축이 생기면서 화면은
 * `/center/{code}/packing` 로 옮겼고, 여기는 기본 센터(`C1`)로 보내는 리다이렉트만 남는다.
 * 실제 화면 구현은 옮기지 않았다 — `_components/packing-page.tsx` 가 그대로 들고 있고,
 * 새 경로(`app/center/[code]/packing/page.tsx`)가 그걸 그대로 import 한다.
 */
export default function PackingRedirect() {
  redirect("/center/C1/packing");
}
