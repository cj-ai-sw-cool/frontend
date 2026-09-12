"use client";

import type { RebinSessionDetail, RebinSlotStatus } from "@/lib/types";
import { Panel, Sunken, w98 } from "./win98-ui";

/** 슬롯 상태 → 화면 표기 — 정본 §8.2 스키마(ACTIVE/COMPLETED/RELEASED) */
const REBIN_SLOT_STATUS_LABEL: Record<RebinSlotStatus, string> = {
  ACTIVE: "진행중",
  COMPLETED: "완성",
  RELEASED: "해제",
};

/**
 * 리빈 벽 — `GET /rebin/sessions?pickBatchId=` 세션이 있을 때 보여준다(정본 §8.4, 브리프
 * §3 S8.3 "리빈 벽 표(슬롯·수령번호·품목별 have/need·상태, 잉여 목록)"). `batch-detail-
 * panel.tsx`가 "피킹 지시" 탭과 나란히 놓는다.
 */
export function RebinWallPanel({
  session,
  className = "",
}: {
  session: RebinSessionDetail;
  className?: string;
}) {
  return (
    <Panel
      title="리빈 벽"
      right={
        <span className={`${w98.small} shrink-0 text-[color:var(--muted-foreground)]`}>
          {session.worker} · {session.toteLocationCode}
        </span>
      }
      className={`min-h-0 flex-1 ${className}`}
      bodyClassName="min-h-0 gap-2"
    >
      <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
        <table className="w-full border-collapse text-left text-[12px]">
          <thead className="sticky top-0 bg-[color:var(--surface)]">
            <tr>
              <th className="p-1.5">슬롯</th>
              <th className="p-1.5">수령번호</th>
              <th className="p-1.5">품목 (수령/필요)</th>
              <th className="p-1.5">상태</th>
            </tr>
          </thead>
          <tbody>
            {session.slots.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-1.5 text-[color:var(--muted-foreground)]">
                  슬롯이 없습니다.
                </td>
              </tr>
            ) : (
              session.slots.map((slot) => (
                <tr key={slot.slotCode} className="border-t border-[color:var(--border)] align-top">
                  <td className={`${w98.mono} p-1.5 font-bold`}>{slot.slotCode}</td>
                  <td className={`${w98.mono} p-1.5`}>{slot.receiptNo}</td>
                  <td className="p-1.5">
                    <ul className="flex flex-col gap-0.5">
                      {slot.items.map((item) => (
                        <li key={item.gtin} className={w98.mono}>
                          {item.name} {item.have}/{item.need}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="p-1.5">{REBIN_SLOT_STATUS_LABEL[slot.status]}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Sunken>

      <span className={`${w98.small} shrink-0 font-bold`}>
        잉여 {session.leftovers.length > 0 ? `(${session.leftovers.length}건)` : "— 없음"}
      </span>
      {session.leftovers.length > 0 ? (
        <Sunken className={`${w98.scroll} h-20 shrink-0 overflow-y-auto p-1`}>
          <ul className="flex flex-col gap-0.5">
            {session.leftovers.map((leftover, index) => (
              <li key={index} className={`${w98.small} ${w98.mono}`}>
                {leftover.gtin} · {leftover.lotNo} · {leftover.qty}
              </li>
            ))}
          </ul>
        </Sunken>
      ) : null}
    </Panel>
  );
}
