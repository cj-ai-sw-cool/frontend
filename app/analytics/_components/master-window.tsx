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
import type { Zone } from "@/lib/types";
import { useCreateSeller, useLocations, useSellers, useZones } from "../_data/use-master";
import { AtpTab } from "./atp-tab";
import { Btn, Etched, Field, Sunken, w98 } from "./win98-ui";

/** `warehouse-slot-3d.jsx` 가 `onReady` 로 넘기는 api 핸들. 이 파일은 모양만 안다 */
export interface WarehouseApi {
  setHighlight: (id: string | null) => void;
  flyTo: (id: string) => void;
  resetView: () => void;
}

const TABS = ["화주", "로케이션", "가용재고"] as const;
type Tab = (typeof TABS)[number];

const TEMP_ZONE_LABEL: Record<string, string> = {
  AMBIENT: "상온",
  CHILLED: "냉장",
  FROZEN: "냉동",
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
          ) : (
            <AtpTab />
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

/* ── 로케이션 탭 ─────────────────────────────────────────────────────────── */

/** 존의 랙 수 — 데이터 모델 §1.2: 쌍(pair) p 는 랙 2p-1·2p, 단독은 1..singles */
function rackCount(zone: Zone): number {
  return zone.rackPairs > 0 ? zone.rackPairs * 2 : zone.rackSingles;
}

function LocationTab({ onLocateZone }: { onLocateZone: (zoneCode: string) => void }) {
  const { data: zones, isLoading: zonesLoading, error: zonesError } = useZones();
  const [zoneCode, setZoneCode] = useState<string | null>(null);
  const [rack, setRack] = useState<number | null>(null);

  const zone = useMemo(() => zones?.find((z) => z.code === zoneCode) ?? null, [zones, zoneCode]);
  const racks = useMemo(() => (zone ? Array.from({ length: rackCount(zone) }, (_, i) => i + 1) : []), [zone]);

  const { data: page, isLoading: locLoading, error: locError } = useLocations({
    zone: zoneCode ?? undefined,
    rack: rack ?? undefined,
    type: "BIN",
    // 한 존 최대 칸 수(A, 2,288)보다 넉넉히 잡아 페이지 없이 한 번에 보여준다.
    size: 3000,
  });

  const selectZone = (code: string) => {
    setZoneCode(code);
    setRack(null);
  };

  return (
    <div className="flex h-full min-h-0 gap-2">
      {/* 1단 — 존 목록 */}
      <Sunken className={`${w98.scroll} min-h-0 w-[260px] shrink-0 overflow-y-auto`}>
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="sticky top-0 bg-[color:var(--surface)]">
            <tr>
              <Th>존</Th>
              <Th>온도</Th>
              <Th>칸 수</Th>
            </tr>
          </thead>
          <tbody>
            {zonesLoading ? (
              <tr>
                <td colSpan={3} className="p-3 text-[color:var(--muted-foreground)]">
                  존 목록을 불러오는 중…
                </td>
              </tr>
            ) : zonesError ? (
              <tr>
                <td colSpan={3} className="p-3 text-[color:var(--status-error)]">
                  존 목록을 불러오지 못했습니다.
                </td>
              </tr>
            ) : (
              zones?.map((z) => (
                <tr
                  key={z.code}
                  onClick={() => selectZone(z.code)}
                  className={`cursor-pointer border-t border-[color:var(--border)] ${
                    z.code === zoneCode ? "bg-[color:var(--surface-variant)] font-bold" : ""
                  }`}
                >
                  <Td mono>{z.code} · {z.name}</Td>
                  <Td>{TEMP_ZONE_LABEL[z.tempZone] ?? z.tempZone}</Td>
                  <Td mono>{z.locationCount.toLocaleString()}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Sunken>

      {/* 2단 — 랙 목록 */}
      <Sunken className={`${w98.scroll} flex min-h-0 w-[140px] shrink-0 flex-col gap-1 overflow-y-auto p-1.5`}>
        {!zone ? (
          <span className="p-1 text-[12px] text-[color:var(--muted-foreground)]">
            존을 먼저 고르세요
          </span>
        ) : (
          racks.map((r) => (
            <Btn key={r} pressed={r === rack} onClick={() => setRack(r)} className="py-1 text-[12px]">
              랙 {r}
            </Btn>
          ))
        )}
      </Sunken>

      {/* 3단 — 로케이션 표 */}
      <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
        {!zone || rack === null ? (
          <span className="block p-3 text-[13px] text-[color:var(--muted-foreground)]">
            존과 랙을 고르면 로케이션 목록이 나옵니다.
          </span>
        ) : (
          <table className="w-full border-collapse text-left text-[13px]">
            <thead className="sticky top-0 bg-[color:var(--surface)]">
              <tr>
                <Th>단</Th>
                <Th>열</Th>
                <Th>코드</Th>
                <Th>치수(cm)</Th>
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
              ) : (
                page?.content
                  .slice()
                  .sort((a, b) => (a.levelNo ?? 0) - (b.levelNo ?? 0) || (a.colNo ?? 0) - (b.colNo ?? 0))
                  .map((loc) => (
                    <tr
                      key={loc.id}
                      onClick={() => onLocateZone(zone.code)}
                      title="클릭하면 3D 로 이 존을 보여줍니다"
                      className="cursor-pointer border-t border-[color:var(--border)] hover:bg-[color:var(--surface-variant)]"
                    >
                      <Td mono>{loc.levelNo}</Td>
                      <Td mono>{loc.colNo}</Td>
                      <Td mono>{loc.code}</Td>
                      <Td mono>
                        {loc.widthCm} × {loc.lengthCm} × {loc.heightCm}
                      </Td>
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
