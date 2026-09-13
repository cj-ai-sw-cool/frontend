"use client";

/**
 * "마스터" 창 — 화주·존·로케이션(Stage 1)을 보고 등록하는 win98 창.
 *
 * 분석 화면의 네 번째 화면 예산(872px)에는 이미 세 패널(흐름·지도·월간)이 꽉 차 있어서,
 * "3D 전체 ▶"와 같은 방식으로 **전체 화면 오버레이**로 연다 — 스테이지 전체(1600×1004)를
 * 덮고 ESC 나 닫기 버튼으로 되돌아간다.
 *
 * 탭 셋: 화주 / 로케이션 / 가용재고. 로케이션 탭의 행을 클릭하면 이 창을 닫고 3D 전체
 * 화면으로 넘어가면서 그 존으로 카메라를 옮기고 강조한다 — "3D 전체 ▶" 버튼과 같은
 * 전환이라 화면 위에 화면을 겹치지 않는다.
 *
 * ⚠️ **존·랙 단위 강조까지만 한다.** 3D 쪽 `flyTo`/`setHighlight` 가 지금 받는 값은
 *    구역 하나(zone/grade id)뿐이고 랙 번호는 받지 않는다 — 랙을 더 좁혀 보여주는 카메라
 *    프레이밍은 이 스테이지 범위 밖이다(칸 단위 강조는 Stage 2 점유 연동 때 같이).
 *    자세한 내용은 인수인계 보고 "결정 필요" 절 참고.
 *
 * "가용재고" 탭은 Stage 5(정본 §5.7·§5.8, 브리프 §3 S5.4)에서 추가했다 — 자기 상태·데이터
 * 훅을 통째로 든 독립 컴포넌트(`atp-tab.tsx`)라 여기서는 탭 전환만 담당한다.
 */

import { useMemo, useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api";
import type { Medium } from "@/lib/types";
import { buildLocationsQuery, filterLocationsByPrefix, useLayout } from "../_data/use-layout";
import { useCreateSeller, useLocations, useSellers } from "../_data/use-master";
import { AtpTab } from "./atp-tab";
import { IcqaTab } from "./icqa-tab";
import { buildLayoutIndex, zoneBinCount } from "./layout/layout-geometry";
import { Btn, Etched, Field, Sunken, w98 } from "./win98-ui";

/** `warehouse-slot-3d.jsx` 가 `onReady` 로 넘기는 api 핸들. 이 파일은 모양만 안다 */
export interface WarehouseApi {
  setHighlight: (id: string | null) => void;
  flyTo: (id: string) => void;
  resetView: () => void;
}

const TABS = ["화주", "로케이션", "가용재고", "실사"] as const;
type Tab = (typeof TABS)[number];

const MEDIUM_LABEL: Record<Medium, string> = {
  SHELF: "선반",
  PALLET_RACK: "파렛트 랙",
  PALLET_FLOOR: "파렛트 바닥",
};

export function MasterWindow({
  onClose,
  onLocateZone,
}: {
  onClose: () => void;
  /** 로케이션 행을 클릭했을 때 그 존으로 3D 를 옮기며 강조한다 — page.tsx 가 전달 */
  onLocateZone: (zoneCode: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("화주");

  return (
    <div className="fixed top-0 left-0 z-[210] flex h-[1004px] w-[1600px] items-center justify-center bg-[rgba(8,12,18,.72)]">
      <div className={`${w98.raised} flex h-[820px] w-[1180px] flex-col bg-[color:var(--surface)] p-[2px]`}>
        {/* 타이틀바 */}
        <div
          className={`${w98.raised} ${w98.titleText} flex shrink-0 items-center gap-2 bg-[color:var(--title-navy)] px-2 py-1 text-[color:var(--primary-foreground)]`}
        >
          <span className="flex-1">마스터 — 화주 · 로케이션</span>
          <button
            type="button"
            onClick={onClose}
            title="닫기 (ESC)"
            className={`${w98.btn} ${w98.raised} flex size-5 cursor-pointer items-center justify-center`}
          >
            ✕
          </button>
        </div>

        {/* 탭 */}
        <div className="flex shrink-0 gap-1 p-2 pb-0">
          {TABS.map((t) => (
            <Btn key={t} pressed={tab === t} onClick={() => setTab(t)} className="px-4 py-1.5">
              {t}
            </Btn>
          ))}
        </div>

        <div className="min-h-0 flex-1 p-2">
          {tab === "화주" ? (
            <SellerTab />
          ) : tab === "로케이션" ? (
            <LocationTab onLocateZone={onLocateZone} />
          ) : tab === "가용재고" ? (
            <AtpTab />
          ) : (
            <IcqaTab />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 화주 탭 ─────────────────────────────────────────────────────────────── */

function SellerTab() {
  const { data, isLoading, error } = useSellers();
  const createSeller = useCreateSeller();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const submit = () => {
    if (!code.trim() || !name.trim()) return;
    createSeller.mutate(
      { code: code.trim(), name: name.trim() },
      {
        onSuccess: () => {
          setCode("");
          setName("");
        },
      },
    );
  };

  const createFailure = createSeller.error ? describeSellerFailure(createSeller.error) : null;

  return (
    <div className="flex h-full min-h-0 gap-2">
      <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="sticky top-0 bg-[color:var(--surface)]">
            <tr>
              <Th>코드</Th>
              <Th>이름</Th>
              <Th>상태</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={3} className="p-3 text-[color:var(--muted-foreground)]">
                  화주 목록을 불러오는 중…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={3} className="p-3 text-[color:var(--status-error)]">
                  화주 목록을 불러오지 못했습니다.
                </td>
              </tr>
            ) : data?.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-3 text-[color:var(--muted-foreground)]">
                  등록된 화주가 없습니다.
                </td>
              </tr>
            ) : (
              data?.map((seller) => (
                <tr key={seller.id} className="border-t border-[color:var(--border)]">
                  <Td mono>{seller.code}</Td>
                  <Td>{seller.name}</Td>
                  <td className="p-2">
                    <span
                      style={{
                        color:
                          seller.status === "ACTIVE"
                            ? "var(--status-success)"
                            : "var(--muted-foreground)",
                      }}
                    >
                      {seller.status === "ACTIVE" ? "사용" : "중지"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Sunken>

      {/* 등록 폼 */}
      <div className={`${w98.raised} flex w-[260px] shrink-0 flex-col gap-2 bg-[color:var(--surface)] p-2`}>
        <span className={w98.titleText}>화주 등록</span>
        <Etched />

        <label className="flex flex-col gap-1 text-[12px]">
          코드
          <Field
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="SEL-D"
            maxLength={20}
          />
        </label>

        <label className="flex flex-col gap-1 text-[12px]">
          이름
          <Field
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="화주 이름"
            maxLength={100}
          />
        </label>

        {createFailure ? (
          <span className="text-[12px]" style={{ color: "var(--status-error)" }}>
            {createFailure}
          </span>
        ) : null}

        <Btn
          onClick={submit}
          disabled={createSeller.isPending || !code.trim() || !name.trim()}
          className="mt-1 py-1.5 font-bold"
        >
          {createSeller.isPending ? "등록 중…" : "등록"}
        </Btn>
      </div>
    </div>
  );
}

function describeSellerFailure(error: Error): string {
  if (error instanceof ApiError && error.is("CONFLICT")) {
    return "이미 있는 화주 코드입니다. 다른 코드를 입력하세요.";
  }
  return error.message || "화주 등록에 실패했습니다.";
}

/* ── 로케이션 탭 ─────────────────────────────────────────────────────────────
   Stage 11(11.0) 개정 — 존 7개 "랙 번호" 2단을 버리고 존 → 통로 → 베이 3단 필터로
   바꾼다(브리프 §3 S11.4). 목록은 `GET /layout`(`use-layout.ts`)에서 채운다 — 존
   목록은 `GET /zones` 도 같은 모양이라 쓸 수 있지만, 통로·베이가 `GET /layout` 에만
   있으므로 세 단 다 같은 응답 하나로 채운다(요청 한 번). */

function LocationTab({ onLocateZone }: { onLocateZone: (zoneCode: string) => void }) {
  const { data: layout, isLoading: layoutLoading, usingMock } = useLayout();
  const index = useMemo(() => (layout ? buildLayoutIndex(layout) : null), [layout]);

  const [zoneCode, setZoneCode] = useState<string | null>(null);
  const [aisleId, setAisleId] = useState<number | null>(null);
  const [bayId, setBayId] = useState<number | null>(null);

  const aisles = useMemo(
    () => (zoneCode ? (index?.aislesByZone.get(zoneCode) ?? []) : []),
    [index, zoneCode],
  );
  const bays = useMemo(
    () => (aisleId !== null ? (index?.baysByAisle.get(aisleId) ?? []) : []),
    [index, aisleId],
  );
  const selectedAisle = aisleId !== null ? (index?.aisleById.get(aisleId) ?? null) : null;
  const selectedBay = bayId !== null ? (index?.bayById.get(bayId) ?? null) : null;

  const query = buildLocationsQuery(zoneCode, aisleId, bayId) ?? {};
  const { data: page, isLoading: locLoading, error: locError } = useLocations(query);
  const locations = useMemo(
    () => filterLocationsByPrefix(page, zoneCode, selectedAisle?.no ?? null, selectedBay?.no ?? null),
    [page, zoneCode, selectedAisle, selectedBay],
  );

  const selectZone = (code: string) => {
    setZoneCode(code);
    setAisleId(null);
    setBayId(null);
  };
  const selectAisle = (id: number) => {
    setAisleId(id);
    setBayId(null);
  };

  return (
    <div className="relative flex h-full min-h-0 gap-2">
      {usingMock ? (
        <span className="absolute top-1 right-1 z-10 rounded bg-[color:var(--status-error)] px-1.5 py-0.5 text-[10px] font-bold text-white">
          /layout 표본
        </span>
      ) : null}

      {/* 1단 — 존 */}
      <Sunken className={`${w98.scroll} min-h-0 w-[220px] shrink-0 overflow-y-auto`}>
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="sticky top-0 bg-[color:var(--surface)]">
            <tr>
              <Th>존</Th>
              <Th>매체</Th>
              <Th>칸 수</Th>
            </tr>
          </thead>
          <tbody>
            {layoutLoading ? (
              <tr>
                <td colSpan={3} className="p-3 text-[color:var(--muted-foreground)]">
                  존 목록을 불러오는 중…
                </td>
              </tr>
            ) : (
              layout?.zones.map((z) => (
                <tr
                  key={z.code}
                  onClick={() => selectZone(z.code)}
                  className={`cursor-pointer border-t border-[color:var(--border)] ${
                    z.code === zoneCode ? "bg-[color:var(--surface-variant)] font-bold" : ""
                  }`}
                >
                  <Td mono>{z.code}</Td>
                  <Td>{MEDIUM_LABEL[z.medium] ?? z.medium}</Td>
                  <Td mono>{(index ? zoneBinCount(z.code, index) : 0).toLocaleString()}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Sunken>

      {/* 2단 — 통로 */}
      <Sunken className={`${w98.scroll} flex min-h-0 w-[120px] shrink-0 flex-col gap-1 overflow-y-auto p-1.5`}>
        {!zoneCode ? (
          <span className="p-1 text-[12px] text-[color:var(--muted-foreground)]">존을 먼저 고르세요</span>
        ) : (
          aisles.map((a) => (
            <Btn key={a.id} pressed={a.id === aisleId} onClick={() => selectAisle(a.id)} className="py-1 text-[12px]">
              통로 {String(a.no).padStart(2, "0")}
            </Btn>
          ))
        )}
      </Sunken>

      {/* 3단 — 베이 */}
      <Sunken className={`${w98.scroll} flex min-h-0 w-[130px] shrink-0 flex-col gap-1 overflow-y-auto p-1.5`}>
        {aisleId === null ? (
          <span className="p-1 text-[12px] text-[color:var(--muted-foreground)]">통로를 먼저 고르세요</span>
        ) : (
          bays.map((b) => (
            <Btn key={b.id} pressed={b.id === bayId} onClick={() => setBayId(b.id)} className="py-1 text-[12px]">
              베이 {String(b.no).padStart(2, "0")}
            </Btn>
          ))
        )}
      </Sunken>

      {/* 4단 — 로케이션(칸) 표 */}
      <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
        {!zoneCode ? (
          <span className="block p-3 text-[13px] text-[color:var(--muted-foreground)]">
            존 · 통로 · 베이를 고르면 칸 목록이 나옵니다.
          </span>
        ) : (
          <table className="w-full border-collapse text-left text-[13px]">
            <thead className="sticky top-0 bg-[color:var(--surface)]">
              <tr>
                <Th>단</Th>
                <Th>위치</Th>
                <Th>코드</Th>
                <Th>역할</Th>
                <Th>상태</Th>
              </tr>
            </thead>
            <tbody>
              {locLoading ? (
                <tr>
                  <td colSpan={5} className="p-3 text-[color:var(--muted-foreground)]">
                    로케이션을 불러오는 중…
                  </td>
                </tr>
              ) : locError ? (
                <tr>
                  <td colSpan={5} className="p-3 text-[color:var(--status-error)]">
                    로케이션 목록을 불러오지 못했습니다.
                  </td>
                </tr>
              ) : locations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-3 text-[color:var(--muted-foreground)]">
                    조건에 맞는 칸이 없습니다.
                  </td>
                </tr>
              ) : (
                locations
                  .slice()
                  .sort((a, b) => (a.levelNo ?? 0) - (b.levelNo ?? 0) || (a.positionNo ?? 0) - (b.positionNo ?? 0))
                  .map((loc) => (
                    <tr
                      key={loc.id}
                      onClick={() => onLocateZone(zoneCode)}
                      title="클릭하면 3D 로 이 존을 보여줍니다"
                      className="cursor-pointer border-t border-[color:var(--border)] hover:bg-[color:var(--surface-variant)]"
                    >
                      <Td mono>{loc.levelNo}</Td>
                      <Td mono>{loc.positionNo}</Td>
                      <Td mono>{loc.code}</Td>
                      <Td>{loc.role === "PICK_FACE" ? "피킹면" : loc.role === "RESERVE" ? "예비" : "—"}</Td>
                      <Td>{loc.status === "ACTIVE" ? "사용" : "차단"}</Td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        )}
      </Sunken>
    </div>
  );
}

/* Th/Td 는 아래 ATP 탭(`atp-tab.tsx`, Stage 5)도 그대로 재사용한다 — 표 셀 모양이 탭마다
 * 갈리면 같은 창 안에서 표가 서로 달라 보인다. */
export function Th({ children }: { children: ReactNode }) {
  return <th className={`${w98.titleText} border-b border-[color:var(--border)] p-2`}>{children}</th>;
}

export function Td({ children, mono = false }: { children: ReactNode; mono?: boolean }) {
  return <td className={`p-2 ${mono ? w98.mono : ""}`}>{children}</td>;
}
