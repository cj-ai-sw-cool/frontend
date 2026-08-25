"use client";

import { type ReactNode, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { MeasurementImage, ProductImagesResponse } from "@/lib/types";

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
 * ── 대표 한 장만 그린다 (사용자 결정, 2026-08-23) ─────────
 * 예전에는 1-6 이 카메라별로 여러 장을 주면 아래에 `카메라 1`·`카메라 2` 전환 버튼을 깔고
 * 장을 바꿔 볼 수 있게 했다. 그 판단은 **뒤집혔다** — 포장대에서 필요한 건 "이 물건이 맞나"를
 * 한눈에 대조하는 것 하나뿐이고, 각도별 사진을 넘겨 보는 행동은 포장 흐름에 없다.
 * 버튼 줄(34px + 간격 12)이 사라진 만큼 패널 높이도 함께 줄였다(page.tsx 의 세로 예산 참고).
 *
 * 그래서 `activeIndex` 상태와 전환 버튼을 삭제하고 `pickRepresentative()` 로 대체했다.
 * 여러 장을 받아도 **버리는 게 아니라 안 그리는 것**이라, 나중에 각도별 보기가 다시 필요해지면
 * 이 함수와 버튼 줄만 되살리면 된다(계약·훅은 그대로다).
 *
 * ⚠️ 1-6 호출은 **유지된다.** "코리안넷 대표 이미지"는 계약상 `source: "MASTER_FALLBACK"`
 *    응답으로만 오고(docs/02-api-spec.md §1-6), 3-2 배송단위 상세의 `items` 에는 이미지 필드가
 *    없다. 즉 1-6 을 끊으면 이 패널에 그릴 것이 아예 없어진다. 측정 원본이 있는 상품은
 *    지금도 측정 원본 첫 장이 대표가 된다.
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
   * 로드에 실패한 url 목록. 장이 아니라 **url 단위**로 기록한다 —
   * 품목을 바꿔 다른 사진이 들어왔을 때 앞선 실패가 따라오지 않게.
   */
  const [brokenUrls, setBrokenUrls] = useState<string[]>([]);

  const representative = pickRepresentative(data?.images ?? []);

  return (
    /* 부모(Card)가 높이를 정해 준다. 여기서는 남는 높이를 사진 자리가 전부 먹는다 */
    <div className="flex h-full flex-col gap-3">
      {/* 상태 요약 줄은 삭제했다 (2026-08-25, 사용자 요청) — 상품명은 이제 부모의
          "제품 이미지" CardHeader 우측(page.tsx)에서 보여주므로 패널 안에서 다시
          그리면 중복이다. 소스 라벨("입고 측정 원본"/"코리안넷 대표 이미지")은
          바코드 뱃지 아래 줄로 옮겼다 — 아래 뱃지 블록 참고. 그만큼 사진 자리(flex-1)가
          더 넓어지는 건 의도된 결과다. */}

      {/* 사진 자리 — 샘플처럼 2px 테두리 안쪽에 한 장을 크게.
          `min-h-0` 이 없으면 flex 자식의 기본 min-height:auto 때문에 패널 높이를 밀어낸다 */}
      <div className="relative min-h-0 flex-1 overflow-hidden border-2 bg-muted">
        {productGtin !== null ? (
          // 샘플 561행의 우상단 SKU 뱃지에 대응. 사진과 바코드를 함께 봐야 대조가 된다.
          // 2026-08-25: 아래 줄에 소스 라벨을 추가해 2줄 뱃지로 바꿨다 — 상태 요약 줄이
          // 없어지면서 소스 정보("입고 측정 원본"/"코리안넷 대표 이미지")를 흡수한 자리다.
          <span className="absolute top-2 right-2 z-10 flex flex-col items-end gap-0.5 border bg-foreground px-2 py-1 text-background">
            <span className="font-mono text-xs">{productGtin}</span>
            {data !== undefined ? (
              <span className="text-[10px]">
                {/* 마스터 = 코리안넷 스냅샷(docs/03-erd.md korean_net_master.image_url).
                    작업자가 쓰는 말 그대로 적는다 */}
                {data.source === "MEASUREMENT" ? "입고 측정 원본" : "코리안넷 대표 이미지"}
              </span>
            ) : null}
          </span>
        ) : null}

        <ImageArea
          productName={productName}
          isLoading={isLoading}
          hasResponse={data !== undefined}
          activeUrl={representative?.url ?? null}
          isBroken={
            representative !== null && brokenUrls.includes(representative.url)
          }
          onBroken={(url) =>
            setBrokenUrls((prev) => (prev.includes(url) ? prev : [...prev, url]))
          }
        />
      </div>
    </div>
  );
}

/**
 * 여러 장이 와도 화면에 그릴 **대표 한 장**을 고른다.
 *   ① `cameraNo === null` 인 장 — 계약상 코리안넷 마스터 대표 이미지다(§1-6 MASTER_FALLBACK)
 *   ② 없으면 배열의 첫 장 — 측정 원본(카메라 번호가 붙은 사진)의 첫 카메라
 * 서버가 순서를 바꿔도 ①이 먼저라, "대표 이미지가 있으면 대표 이미지"라는 규칙이 유지된다.
 */
function pickRepresentative(images: MeasurementImage[]): MeasurementImage | null {
  return images.find((image) => image.cameraNo === null) ?? images[0] ?? null;
}

/**
 * 사진 자리 안쪽만 담당한다 — 상태가 네 갈래라 부모에서 분리했다.
 *   ① 고른 품목 없음  ② 불러오는 중  ③ 등록된 이미지 없음  ④ 있음(로드 실패 포함)
 */
function ImageArea({
  productName,
  isLoading,
  hasResponse,
  activeUrl,
  isBroken,
  onBroken,
}: {
  productName: string | null;
  isLoading: boolean;
  hasResponse: boolean;
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

  if (!hasResponse || activeUrl === null) {
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
