"use client";

import { type ReactNode, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProductImagesResponse } from "@/lib/types";

/**
 * 제품 이미지 — docs/02-api-spec.md §1-6 `GET /products/{id}/images`.
 * Stitch 샘플 P2 화면(273~643행)의 우측 상단 "제품 이미지" 패널에 대응한다.
 *
 * 왜 출고 화면에 입고(1-6) API 가 나오나
 *   포장 작업자는 토트에 담긴 물건이 주문서의 그 물건이 맞는지 눈으로 확인해야 한다.
 *   입고 때 촬영한 원본 사진이 그 대조본이라 출고 화면에서 그대로 재사용한다.
 *
 * 순수 표시용(presentational): API 를 부르지 않는다. 어떤 품목이 선택됐는지도
 * 부모(page.tsx)가 들고 있고 여기는 결과만 받는다.
 *
 * ⚠️ mock 단계에서는 이미지 파일이 실제로 없다(`../_mock/shipment.ts` 주석 참고).
 *    그래서 img 로드는 항상 실패하고 아래 onError 대체 표시가 그려진다.
 *    실제 서버가 붙으면 같은 코드가 그대로 진짜 사진을 띄운다.
 */
export function ProductImagePanel({
  productName,
  productGtin,
  data,
  isLoading = false,
}: {
  /** 선택된 품목 이름. null 이면 아직 고른 품목이 없다는 뜻 */
  productName: string | null;
  /** 선택된 품목의 바코드 — 샘플의 우상단 SKU 뱃지 자리 */
  productGtin: string | null;
  /** 1-6 응답. 아직 안 왔거나 품목을 안 골랐으면 undefined */
  data?: ProductImagesResponse;
  isLoading?: boolean;
}) {
  /**
   * 로드에 실패한 url 목록. 이미지마다 따로 기록해야 카메라를 바꿨을 때
   * 멀쩡한 사진까지 같이 대체 표시로 넘어가지 않는다.
   */
  const [brokenUrls, setBrokenUrls] = useState<string[]>([]);
  /** 여러 장일 때 지금 보고 있는 장 번호(0-based) */
  const [activeIndex, setActiveIndex] = useState(0);

  const images = data?.images ?? [];
  // 품목을 바꾸면 장 번호가 범위를 벗어날 수 있다. state 를 되돌리는 대신 렌더에서 보정한다
  // (effect 안에서 setState 하면 렌더가 한 번 더 돌아 lint 규칙에 걸린다).
  const safeIndex = activeIndex < images.length ? activeIndex : 0;
  const active = images[safeIndex];

  return (
    <div className="flex h-full flex-col gap-3">
      {/* 상태 요약 줄 — 어떤 품목의, 어디서 온 사진인지 */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
        <span className="truncate font-medium" title={productName ?? undefined}>
          {productName ?? "선택된 품목 없음"}
        </span>
        {data !== undefined ? (
          <span className="shrink-0 text-xs text-muted-foreground">
            {data.source === "MEASUREMENT" ? "입고 측정 원본" : "마스터 대체 이미지"}
          </span>
        ) : null}
      </div>

      {/* 사진 자리 — 샘플처럼 2px 테두리 안쪽에 한 장을 크게 */}
      <div className="relative min-h-[180px] flex-1 overflow-hidden border-2 bg-muted">
        {productGtin !== null ? (
          // 샘플 561행의 우상단 SKU 뱃지에 대응. 사진과 바코드를 함께 봐야 대조가 된다
          <span className="absolute top-2 right-2 z-10 border bg-foreground px-2 py-1 font-mono text-xs text-background">
            {productGtin}
          </span>
        ) : null}

        <ImageArea
          productName={productName}
          isLoading={isLoading}
          hasResponse={data !== undefined}
          imageCount={images.length}
          activeUrl={active?.url ?? null}
          isBroken={active !== undefined && brokenUrls.includes(active.url)}
          onBroken={(url) =>
            setBrokenUrls((prev) => (prev.includes(url) ? prev : [...prev, url]))
          }
        />
      </div>

      {/* 카메라가 여러 대면 장을 바꿔 볼 수 있게 한다 (1-6 의 cameraNo) */}
      {images.length > 1 ? (
        <div className="flex shrink-0 flex-wrap gap-2">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              aria-pressed={index === safeIndex}
              onClick={() => setActiveIndex(index)}
              className="border-2 px-3 py-1 text-sm aria-pressed:bg-accent aria-pressed:font-medium"
            >
              {image.cameraNo === null ? "대표" : `카메라 ${image.cameraNo}`}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * 사진 자리 안쪽만 담당한다 — 상태가 네 갈래라 부모에서 분리했다.
 *   ① 고른 품목 없음  ② 불러오는 중  ③ 등록된 이미지 없음  ④ 있음(로드 실패 포함)
 */
function ImageArea({
  productName,
  isLoading,
  hasResponse,
  imageCount,
  activeUrl,
  isBroken,
  onBroken,
}: {
  productName: string | null;
  isLoading: boolean;
  hasResponse: boolean;
  imageCount: number;
  activeUrl: string | null;
  isBroken: boolean;
  onBroken: (url: string) => void;
}) {
  if (productName === null) {
    return <Notice>왼쪽 품목을 누르면 그 제품의 사진이 표시됩니다 (1-6)</Notice>;
  }

  if (isLoading) {
    return <Skeleton className="h-full w-full" />;
  }

  if (!hasResponse || imageCount === 0 || activeUrl === null) {
    return <Notice>등록된 제품 이미지가 없습니다</Notice>;
  }

  if (isBroken) {
    // 회색 바탕(bg-muted)이 그대로 보이는 자리 — 사진 대신 왜 안 보이는지를 적는다
    return (
      <Notice>
        <span className="block font-medium">이미지를 불러오지 못했습니다</span>
        <span className="mt-1 block font-mono text-xs break-all">{activeUrl}</span>
      </Notice>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element --
       next/image 를 쓰지 않는다. mock 경로는 존재하지 않는 파일이라 이미지 최적화 서버가
       매 렌더마다 실패하고, 실제 서버가 붙어도 이미지 출처가 백엔드 도메인이라
       next.config 의 remotePatterns 를 먼저 합의해야 한다. 그 결정 전까지는 평범한 img 로 둔다. */
    <img
      src={activeUrl}
      alt={`${productName} 제품 사진`}
      onError={() => onBroken(activeUrl)}
      className="h-full w-full object-contain p-2"
    />
  );
}

/** 사진 대신 보여줄 안내 문구 — 네 갈래 상태가 같은 자리·같은 크기를 쓰도록 */
function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
      <span>{children}</span>
    </div>
  );
}
