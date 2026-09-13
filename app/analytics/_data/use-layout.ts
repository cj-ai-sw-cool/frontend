"use client";

/**
 * 3D·2D 레이아웃 데이터 훅 (Stage 11, 정본 §11.0 "3D·2D 계약").
 *
 * 호출 래퍼는 `@/lib/endpoints` 의 `master.layout`/`master.bayBins` 만 쓴다. 백엔드가
 * 이 화면과 같은 시각에 `feat/stage11-scale`에서 만들어지는 중이라(브리프 머리말)
 * 2026-09-13 시점엔 두 엔드포인트가 없을 수 있다 — 실패하면(네트워크 에러·404 전부)
 * `lib/mocks/layout.ts` 표본으로 대신 그린다. 백엔드 노트에 라이브 예시가 올라오면
 * 이 fallback 을 지운다(브리프 노트 "라이브 검증 대기").
 */

import { useQuery } from "@tanstack/react-query";
import { master, queryKeys } from "@/lib/endpoints";
import { mockBinsForBay, mockLayout } from "@/lib/mocks/layout";
import type { Bin, LayoutResponse, Location, LocationsQuery } from "@/lib/types";

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

/** 베이 클릭 시에만 켠다(`enabled`) — 우측 패널·3D 칸 펼침이 같이 쓴다 */
export function useBayBins(bayId: number | null) {
  const query = useQuery<Bin[]>({
    queryKey: queryKeys.bayBins(bayId ?? -1),
    queryFn: () => master.bayBins(bayId as number),
    enabled: bayId !== null,
    retry: false,
  });

  const usingMock = bayId !== null && query.isError;
  return {
    data: query.data ?? (usingMock ? mockBinsForBay(bayId as number) : undefined),
    isLoading: query.isLoading && !usingMock,
    usingMock,
  };
}

/**
 * 로케이션 탭 3단(존→통로→베이) 필터 — `GET /locations` 가 아직 `aisleId`·`bayId` 를
 * 받지 않을 수 있어(브리프 §3 S11.4, `LocationsQuery` 주석 참고) `zone` 만으로 받은
 * 페이지를 코드 접두로 한 번 더 거른다. 코드 형식은 `{존}-{통로:2}-{베이:2}-…`
 * (정본 §11.0 "주소") 라 접두 `{zone}-{aisleNo:2}-{bayNo:2}` 로 자른다.
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

/** 로케이션 탭이 보낼 쿼리 — 위 주석대로 `aisleId`/`bayId` 는 백엔드가 받아 주면 그대로
 * 쓰고, 아니어도 무해하게 무시된다(위 `filterLocationsByPrefix` 가 실제 필터를 한다) */
export function buildLocationsQuery(zoneCode: string | null, aisleId: number | null, bayId: number | null): LocationsQuery | null {
  if (!zoneCode) return null;
  return {
    zone: zoneCode,
    aisleId: aisleId ?? undefined,
    bayId: bayId ?? undefined,
    type: "BIN",
    size: 5000,
  };
}
