"use client";

/**
 * 허브 "글로벌 ATP" 탭 — 정본 §12.4·§12.6, 브리프 §2 "화주 Select → `GET /hub/atp?seller=`
 * SKU 행마다 센터 3개 막대(비율) + 이동 중 회색 조각 + 합계".
 *
 * 막대는 `total`(센터별 ATP 합) 기준 비율이다 — `inTransit`(이동 중, 정본 §12.4 "어느
 * 센터 ATP에도 잡히지 않는다")은 그 합에 포함되지 않으므로 막대 끝에 회색 조각으로
 * 따로 붙인다(전체 길이 = total + inTransit 기준 비율).
 */

import { useState } from "react";
import { useGlobalAtp, useHubCenters, useSellers } from "../_data/use-hub";
import { Field, Select, Sunken, w98 } from "./win98-ui";
import type { GlobalAtpRow } from "@/lib/types";

/** 센터 막대 색 — win98 팔레트의 네이비·자주·청록(셸 목차 아이콘과 같은 톤, `shell.tsx`
 * 의 `InboundIcon`/`AnalyticsIcon` 참고). 이동 중은 회색으로 "재고 아님"을 표시한다 */
const CENTER_COLOR: Record<string, string> = {
  C1: "#000080",
  C2: "#a000a0",
  C3: "#008080",
};
const IN_TRANSIT_COLOR = "#9a9a9a";

export function AtpTab() {
  const { data: centers } = useHubCenters();
  const sellersQuery = useSellers();
  const [sellerCode, setSellerCode] = useState("");
  const [gtinFilter, setGtinFilter] = useState("");

  const { data: rows, isLoading, usingMock } = useGlobalAtp(
    sellerCode === "" ? null : { seller: sellerCode, gtin: gtinFilter.trim() || undefined },
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center gap-2">
        <Select
          value={sellerCode}
          disabled={sellersQuery.isLoading}
          onChange={(e) => setSellerCode(e.target.value)}
          className="w-48"
        >
          <option value="">{sellersQuery.isLoading ? "불러오는 중…" : "화주를 선택하세요"}</option>
          {sellersQuery.data?.map((s) => (
            <option key={s.id} value={s.code}>
              {s.code} · {s.name}
            </option>
          ))}
        </Select>
        <Field
          mono
          value={gtinFilter}
          onChange={(e) => setGtinFilter(e.target.value)}
          placeholder="GTIN 검색(선택)"
          className="h-7 w-48 text-[13px]"
        />
        <span className={`${w98.small} ml-auto flex items-center gap-3`}>
          {(centers ?? []).map((c) => (
            <span key={c.code} className="flex items-center gap-1">
              <span className="inline-block size-2.5" style={{ background: CENTER_COLOR[c.code] ?? "#666" }} />
              {c.code}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="inline-block size-2.5" style={{ background: IN_TRANSIT_COLOR }} />
            이동 중
          </span>
        </span>
      </div>

      <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto p-2`}>
        {sellerCode === "" ? (
          <span className="p-1 text-[13px] text-[color:var(--muted-foreground)]">
            화주를 선택하면 SKU별 글로벌 ATP를 보여줍니다.
          </span>
        ) : isLoading ? (
          <span className="p-1 text-[13px] text-[color:var(--muted-foreground)]">조회 중…</span>
        ) : rows === undefined || rows.length === 0 ? (
          <span className="p-1 text-[13px] text-[color:var(--muted-foreground)]">조건에 맞는 SKU가 없습니다.</span>
        ) : (
          <div className="flex flex-col gap-2">
            {usingMock ? (
              <span className="w-fit bg-[color:var(--status-error)] px-1.5 py-0.5 text-[11px] font-bold text-white">
                /hub/atp 표본
              </span>
            ) : null}
            {rows.map((row) => (
              <AtpRowBar key={row.gtin} row={row} />
            ))}
          </div>
        )}
      </Sunken>
    </div>
  );
}

function AtpRowBar({ row }: { row: GlobalAtpRow }) {
  const denom = row.total + row.inTransit;
  const pct = (n: number) => (denom > 0 ? (n / denom) * 100 : 0);

  return (
    <div className={`${w98.raised} p-1.5`}>
      <div className="mb-1 flex items-center justify-between text-[13px]">
        <span>
          {row.productName} <span className={w98.mono}>({row.gtin})</span>
        </span>
        <span className={`${w98.mono} font-bold`}>
          합계 {row.total.toLocaleString()}
          {row.inTransit > 0 ? (
            <span className="ml-1 font-normal text-[color:var(--muted-foreground)]">
              (이동 중 {row.inTransit.toLocaleString()})
            </span>
          ) : null}
        </span>
      </div>
      <div className={`${w98.sunken} flex h-5 w-full overflow-hidden`}>
        {row.byCenter.map((c) => (
          <div
            key={c.center}
            title={`${c.center} ATP ${c.atp}`}
            style={{ width: `${pct(c.atp)}%`, background: CENTER_COLOR[c.center] ?? "#666" }}
          />
        ))}
        {row.inTransit > 0 ? (
          <div
            title={`이동 중 ${row.inTransit}`}
            style={{ width: `${pct(row.inTransit)}%`, background: IN_TRANSIT_COLOR }}
          />
        ) : null}
      </div>
    </div>
  );
}
