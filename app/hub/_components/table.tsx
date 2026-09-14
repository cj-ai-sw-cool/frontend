import type { ReactNode } from "react";
import { parseServerInstant } from "@/lib/events-time";
import { w98 } from "./win98-ui";

/** 4개 탭 표가 함께 쓰는 셀 — `app/analytics/_components/master-window.tsx` 의
 * `Th`/`Td`(화주·로케이션 탭)와 같은 모양이다. 화면마다 각자 사본을 두는 관례(`app/inbound/
 * layout.tsx` 머리말)를 이 파일 하나로 따른다 — 허브 창 안 탭 4개가 공유한다. */
export function Th({ children }: { children: ReactNode }) {
  return <th className={`${w98.titleText} border-b border-[color:var(--border)] p-2 text-left`}>{children}</th>;
}

export function Td({ children, mono = false }: { children: ReactNode; mono?: boolean }) {
  return <td className={`p-2 ${mono ? w98.mono : ""}`}>{children}</td>;
}

/** 서버 시각(오프셋 없는 `LocalDateTime`) → KST 표시 문자열(`lib/events-time.ts` 규칙
 * 재사용, "화주" 탭 브리프 §2 "시각은 lib/events-time.ts KST 규칙 재사용"). */
export function formatKst(iso: string | null | undefined): string {
  const ms = parseServerInstant(iso);
  if (ms === null) return "—";
  return new Date(ms).toLocaleString("ko-KR", { hour12: false });
}
