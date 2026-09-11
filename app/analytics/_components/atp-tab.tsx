"use client";

/**
 * "가용재고" 탭 — Stage 5, 정본 §5.7·§5.8, 브리프 §3 S5.4.
 *
 * 마스터 창(`master-window.tsx`)의 세 번째 탭. 화주를 고르면 그 화주의 SKU 별
 * 현재고(BIN)/할당/금지선 제외/ATP 를 표로 보여주고, 금지선 일수(`min_shelf_life_days`,
 * 정본 §5.1)를 이 자리에서 바로 고친다 — 화면 체크 1·5(브리프 §4)가 이 탭으로 돈다.
 *
 * 화주 목록은 `use-master.ts` 의 `useSellers` 를 그대로 쓴다(화주 탭과 같은 조회, 새로
 * 만들 이유가 없다). 표 셀(Th/Td)도 화주·로케이션 탭과 같은 모양을 `master-window.tsx` 에서
 * 가져와 쓴다.
 */

import { useState } from "react";
import { toast } from "sonner";
import { useSellers } from "../_data/use-master";
import { useSellerAtp, useUpdateSeller } from "../_data/use-atp";
import { Btn, Field, Select, Sunken, w98 } from "./win98-ui";
import { Td, Th } from "./master-window";

const PAGE_SIZE = 50;

export function AtpTab() {
  const [sellerCode, setSellerCode] = useState("");
  const [page, setPage] = useState(0);
  const [minShelfLifeDaysInput, setMinShelfLifeDaysInput] = useState("");

  const { data: sellerList } = useSellers();
  const selectedSeller = sellerList?.find((s) => s.code === sellerCode) ?? null;

  const atpQuery = useSellerAtp(sellerCode === "" ? null : sellerCode, { page, size: PAGE_SIZE });
  const updateSeller = useUpdateSeller();

  /* 화주를 바꾸면 입력칸을 그 화주의 현재 값으로 되돌린다. 렌더 중 조정(React 공식 권장
   * 패턴) — effect 로 하면 한 프레임 늦게 갱신돼 이전 화주의 값이 잠깐 보인다. */
  const [syncedSellerCode, setSyncedSellerCode] = useState("");
  if (sellerCode !== syncedSellerCode) {
    setSyncedSellerCode(sellerCode);
    setMinShelfLifeDaysInput(selectedSeller !== null ? String(selectedSeller.minShelfLifeDays) : "");
  }

  const parsedDays = Number(minShelfLifeDaysInput);
  const canSave =
    selectedSeller !== null &&
    Number.isFinite(parsedDays) &&
    parsedDays >= 0 &&
    parsedDays !== selectedSeller.minShelfLifeDays;

  const handleSave = () => {
    if (!canSave || selectedSeller === null) return;
    updateSeller.mutate(
      { code: selectedSeller.code, body: { minShelfLifeDays: parsedDays } },
      {
        onSuccess: () => toast.success("금지선 일수 저장 완료", { className: "win98-toast", duration: 1600 }),
        onError: (error) =>
          toast.error("저장에 실패했습니다", {
            className: "win98-toast",
            duration: 2600,
            description: error.message,
          }),
      },
    );
  };

  const atpPage = atpQuery.data;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-end gap-2">
        <label className={`${w98.small} flex flex-col gap-0.5`}>
          화주
          <Select
            value={sellerCode}
            onChange={(e) => {
              setSellerCode(e.target.value);
              setPage(0);
            }}
            className="h-7 w-40"
          >
            <option value="">화주 선택</option>
            {(sellerList ?? []).map((seller) => (
              <option key={seller.code} value={seller.code}>
                {seller.code} · {seller.name}
              </option>
            ))}
          </Select>
        </label>

        <label className={`${w98.small} flex flex-col gap-0.5`}>
          출고 금지선(일)
          <Field
            type="number"
            min={0}
            value={minShelfLifeDaysInput}
            onChange={(e) => setMinShelfLifeDaysInput(e.target.value)}
            disabled={selectedSeller === null}
            className="h-7 w-24"
            mono
          />
        </label>

        <Btn
          onClick={handleSave}
          disabled={!canSave || updateSeller.isPending}
          className="h-7 px-3 font-bold"
        >
          {updateSeller.isPending ? "저장 중…" : "저장"}
        </Btn>

        {selectedSeller !== null ? (
          <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>
            잔여 유통기한이 이보다 짧은 로트는 ATP 에서 빠집니다(정본 §5.1)
          </span>
        ) : null}
      </div>

      <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="sticky top-0 bg-[color:var(--surface)]">
            <tr>
              <Th>GTIN</Th>
              <Th>상품명</Th>
              <Th>현재고(BIN)</Th>
              <Th>할당</Th>
              <Th>금지선 제외</Th>
              <Th>ATP</Th>
            </tr>
          </thead>
          <tbody>
            {sellerCode === "" ? (
              <tr>
                <td colSpan={6} className="p-3 text-[color:var(--muted-foreground)]">
                  화주를 먼저 고르세요.
                </td>
              </tr>
            ) : atpQuery.isLoading ? (
              <tr>
                <td colSpan={6} className="p-3 text-[color:var(--muted-foreground)]">
                  가용재고를 불러오는 중…
                </td>
              </tr>
            ) : atpQuery.error ? (
              <tr>
                <td colSpan={6} className="p-3 text-[color:var(--status-error)]">
                  가용재고를 불러오지 못했습니다 — {atpQuery.error.message}
                </td>
              </tr>
            ) : atpPage?.content.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-3 text-[color:var(--muted-foreground)]">
                  이 화주의 SKU 가 없습니다.
                </td>
              </tr>
            ) : (
              atpPage?.content.map((row) => (
                <tr key={row.gtin} className="border-t border-[color:var(--border)]">
                  <Td mono>{row.gtin}</Td>
                  <Td>{row.name}</Td>
                  <Td mono>{row.onHand.toLocaleString()}</Td>
                  <Td mono>{row.allocated.toLocaleString()}</Td>
                  <Td mono>{row.blockedByShelfLife.toLocaleString()}</Td>
                  <Td mono>
                    <b className={row.atp === 0 ? "text-[color:var(--status-error)]" : ""}>
                      {row.atp.toLocaleString()}
                    </b>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Sunken>

      {atpPage !== undefined && atpPage.totalPages > 1 ? (
        <div className="flex shrink-0 items-center justify-between gap-1">
          <Btn onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page <= 0} className="h-6 px-2 text-[12px]">
            ◀ 이전
          </Btn>
          <span className={`${w98.small} ${w98.mono} text-[color:var(--muted-foreground)]`}>
            {atpPage.number + 1} / {atpPage.totalPages}
          </span>
          <Btn
            onClick={() => setPage((p) => p + 1)}
            disabled={page + 1 >= atpPage.totalPages}
            className="h-6 px-2 text-[12px]"
          >
            다음 ▶
          </Btn>
        </div>
      ) : null}
    </div>
  );
}
