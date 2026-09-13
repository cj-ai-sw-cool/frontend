"use client";

/**
 * 3D·2D 레이아웃 데이터 훅 (Stage 11, 정본 §11.0 "3D·2D 계약").
 *
 * 호출 래퍼는 `@/lib/endpoints` 의 `master.layout`/`master.bayBins` 만 쓴다. 백엔드는
 * `feat/stage11-scale`(2026-09-13 배포, 백엔드 노트 §4)에 라이브로 붙어 있다 —
 * `lib/mocks/layout.ts` 표본은 이제 일시적 실패(네트워크 끊김·서버 재시작 등)에 대비한
 * 방어적 fallback으로만 남긴다.
 */

import { useQuery } from "@tanstack/react-query";
import { master, queryKeys } from "@/lib/endpoints";
import { mockBinsForBay, mockLayout } from "@/lib/mocks/layout";
import type { BayBinsResponse, Bin, LayoutResponse, Location, LocationsQuery } from "@/lib/types";

export function useLayout() {
  const query = useQuery<LayoutResponse>({
    queryKey: queryKeys.layout,
    queryFn: () => master.layout(),
    retry: false,
    staleTime: 5 * 60_000,
  });

  const usingMock = query.isError;
  return {
    data: query.data ?? (usingMock ? mockLayout : undefined),
    isLoading: query.isLoading && !usingMock,
    usingMock,
  };
}

/** 베이 클릭 시에만 켠다(`enabled`) — 우측 패널·3D 칸 펼침이 같이 쓴다. `GET
 * /bays/{id}/bins` 는 베이 메타를 두른 객체를 돌려준다 — 칸 배열은 `.bins` 에 있다
 * (2026-09-13 라이브 검증, `BayBinsResponse` 주석). 이 훅은 그 배열만 꺼내 준다. */
export function useBayBins(bayId: number | null) {
  const query = useQuery<BayBinsResponse>({
    queryKey: queryKeys.bayBins(bayId ?? -1),
    queryFn: () => master.bayBins(bayId as number),
    enabled: bayId !== null,
    retry: false,
  });

  const usingMock = bayId !== null && query.isError;
  const bins: Bin[] | undefined = query.data?.bins ?? (usingMock ? mockBinsForBay(bayId as number) : undefined);
  return {
    data: bins,
    isLoading: query.isLoading && !usingMock,
    usingMock,
  };
}

/**
 * 로케이션 탭 3단(존→통로→베이) 필터 — `GET /locations` 가 이제 `aisle`·`aisleId`·
 * `bayId` 를 실제로 걸러준다(2026-09-13 백엔드 노트 §4.5로 확정, `LocationsQuery`
 * 주석 참고). 그래도 코드 접두 재필터를 남겨 둔다 — 방어적 이중 장치일 뿐 비용이
 * 거의 없고(이미 좁혀 받은 목록 재검사), 서버 필터 변경에도 화면이 흔들리지 않는다.
 * 코드 형식 `{존}-{통로:2}-{베이:2}-…`(정본 §11.0 "주소") 라 접두
 * `{zone}-{aisleNo:2}-{bayNo:2}` 로 자른다.
 */
export function filterLocationsByPrefix(
  page: { content: Location[] } | undefined,
  zoneCode: string | null,
  aisleNo: number | null,
  bayNo: number | null,
): Location[] {
  if (!page) return [];
  if (!zoneCode) return page.content;
  let prefix = zoneCode;
  if (aisleNo !== null) prefix += `-${String(aisleNo).padStart(2, "0")}`;
  if (aisleNo !== null && bayNo !== null) prefix += `-${String(bayNo).padStart(2, "0")}`;
  return page.content.filter((loc) => loc.code.startsWith(prefix));
}

/** 로케이션 탭이 보낼 쿼리 — `aisle`(통로 번호, `zone` 과 함께여야 함)과 `aisleId`·
 * `bayId`(`GET /layout` 이 준 진짜 id)를 전부 보낸다. 백엔드는 이제 이 값으로 실제
 * 걸러준다(노트 §4.5) — 위 `filterLocationsByPrefix` 는 남겨 두되 이중 확인일 뿐이다. */
export function buildLocationsQuery(
  zoneCode: string | null,
  aisleNo: number | null,
  aisleId: number | null,
  bayId: number | null,
): LocationsQuery | null {
  if (!zoneCode) return null;
  return {
    zone: zoneCode,
    aisle: aisleNo ?? undefined,
    aisleId: aisleId ?? undefined,
    bayId: bayId ?? undefined,
    type: "BIN",
    size: 2000,
  };
}
