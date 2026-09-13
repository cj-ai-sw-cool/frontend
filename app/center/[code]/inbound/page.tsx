import InboundPage from "@/app/inbound/_components/inbound-page";

/**
 * 센터 축 경로의 실제 화면 — 컴포넌트는 옮기지 않고 그대로 import 한다(정본 §12.8).
 * 화면 안에서 쓰는 센터 코드는 `useCenter()`(`lib/center.ts`)가 이 라우트의 `[code]`
 * 세그먼트를 `useParams()` 로 직접 읽으므로, 여기서 prop 으로 내려줄 필요가 없다.
 */
export default function CenterInboundPage() {
  return <InboundPage />;
}
