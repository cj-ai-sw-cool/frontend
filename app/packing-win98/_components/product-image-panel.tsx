"use client";

import { useState, type ReactNode } from "react";
import { Camera } from "lucide-react";
import type { MeasurementImage, ProductImagesResponse } from "@/lib/types";
import { Panel, w98 } from "./win98-ui";

/**
 * 1-6 제품 이미지 — 좌측에서 고른 품목의 **대표 한 장**만 띄운다.
 *
 * 입고 화면의 `Visual Inspection` 과 같은 표현을 쓴다(파인 상자 + 네이비 캡션 줄 +
 * 검정 화면). 두 화면이 한 셸 안에 있으니 사진 자리는 같은 모양이어야 한다.
 *
 * ⚠️ mock 단계에는 이미지 파일이 저장소에 없다. 그래도 `img` 를 그대로 건다 —
 *    이 패널은 실제 서버가 붙었을 때 사진이 뜨는 자리이고, 실패하면 아래 onError 가
 *    받아 경로를 보여 준다(입고 화면은 아예 파일이 없는 mock 전용이라 처리가 다르다).
 * ⚠️ next/image 를 쓰지 않는다. mock 경로는 존재하지 않는 파일이라 이미지 최적화 서버가
 *    매 렌더마다 실패하고, 실제 서버가 붙어도 이미지 출처가 백엔드 도메인이라
 *    next.config 의 remotePatterns 를 먼저 합의해야 한다.
 */
export function ProductImagePanel({
  productName,
  productGtin,
  data,
  isLoading = false,
  className = "",
}: {
  productName: string | null;
  productGtin: string | null;
  data?: ProductImagesResponse;
  isLoading?: boolean;
  className?: string;
}) {
  const [brokenUrls, setBrokenUrls] = useState<string[]>([]);
  const representative = pickRepresentative(data?.images ?? []);

  return (
    <Panel
      title="Product Image — 제품 이미지"
      right={
        data !== undefined ? (
          <span className={`${w98.small} shrink-0 font-normal`}>
            {/* 마스터 = 코리안넷 스냅샷(docs/03-erd.md korean_net_master.image_url).
                작업자가 쓰는 말 그대로 적는다 */}
            {data.source === "MEASUREMENT" ? "입고 측정 원본" : "코리안넷 대표"}
          </span>
        ) : undefined
      }
      className={className}
    >
      <div className={`${w98.sunken} flex min-h-0 flex-1 flex-col bg-[color:var(--surface-bright)] p-1`}>
        {/* ★ 품목을 고르기 전에는 **캡션 줄도 안 그린다.** 빈 화면에 "선택된 품목 없음" 줄과
            카메라 안내까지 겹치면 아무것도 없는 자리가 오히려 복잡해 보인다. 지금은 꺼진
            모니터처럼 까만 화면 하나로 두고, 품목을 고르면 그때 이름·GTIN 이 올라온다. */}
        {productName !== null ? (
          <span
            className={`${w98.small} mb-1 flex shrink-0 items-center justify-between gap-2 bg-[color:var(--primary)] px-1 text-[color:var(--primary-foreground)]`}
          >
            <span className="truncate" title={productName}>
              {productName}
            </span>
            {productGtin !== null ? (
              <span className={`${w98.mono} shrink-0`}>{productGtin}</span>
            ) : null}
          </span>
        ) : null}

        {/* ★ 바탕을 **검정 → 흰색**으로 바꿨다 (사용자 결정). 입고 화면의 Visual Inspection 은
            카메라 화면이라 검정이 맞지만, 여기는 카메라가 아니라 **제품 사진**을 놓는 자리다.
            제품 사진은 대개 흰 배경으로 찍혀 있어서, 검정 판 위에 얹으면 사진의 흰 여백이
            네모난 덩어리로 떠 보인다. 흰 바탕이면 그 경계가 사라져 사진만 남는다.
            ⚠️ 그래서 아래 Notice 의 글자색도 초록(CRT)에서 회색으로 같이 바꿨다 — 흰 바탕에
               형광 초록은 읽히지 않는다. */}
        <div className="relative min-h-0 flex-1 overflow-hidden bg-white">
          <ImageArea
            productName={productName}
            isLoading={isLoading}
            hasResponse={data !== undefined}
            activeUrl={representative?.url ?? null}
            isBroken={representative !== null && brokenUrls.includes(representative.url)}
            onBroken={(url) =>
              setBrokenUrls((prev) => (prev.includes(url) ? prev : [...prev, url]))
            }
          />
        </div>
      </div>
    </Panel>
  );
}

/** 대표 = cameraNo 가 없는 장(마스터 이미지). 없으면 첫 장 */
function pickRepresentative(images: MeasurementImage[]): MeasurementImage | null {
  return images.find((image) => image.cameraNo === null) ?? images[0] ?? null;
}

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
  /* 대기 상태 = 빈 화면. 안내 문구는 왼쪽 목록이 이미 말해 주고 있으므로, 여기까지
     같은 말을 적으면 화면만 어수선해진다. */
  if (productName === null) return null;
  if (isLoading) return <Notice>LOADING…</Notice>;
  if (!hasResponse || activeUrl === null) return <Notice>등록된 제품 이미지가 없습니다</Notice>;
  if (isBroken) {
    return (
      <Notice>
        <span className="block font-bold">이미지를 불러오지 못했습니다</span>
        <span className="mt-1 block break-all">{activeUrl}</span>
      </Notice>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={activeUrl}
      alt={`${productName} 제품 사진`}
      onError={() => onBroken(activeUrl)}
      className="h-full w-full object-contain p-2"
    />
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${w98.mono} ${w98.small} flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-[color:var(--muted-foreground)]`}
    >
      <Camera className="size-8 opacity-40" aria-hidden />
      <span>{children}</span>
    </div>
  );
}
