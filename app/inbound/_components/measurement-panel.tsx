"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { MeasurementResponse } from "@/lib/types";

/**
 * 자동 측정 데이터 — docs/02-api-spec.md §1-3 `POST /inbound/measurements`.
 * Stitch 샘플 P1 화면 좌측 상단 "자동 측정 데이터" 패널에 대응한다
 * (측정 전 874~912행 / 측정 후 1284~1302행 — 같은 패널의 두 상태다).
 *
 * 순수 표시용(presentational): API 를 부르지 않는다. 촬영 실행도 부모가 한다.
 *
 * 네 칸의 성격이 서로 다르다 — 그래서 무게를 게이트와 엮지 않는다
 *   가로·세로·높이 : 외부 추론 모델의 출력 → `confidence` / `gatePassed` 의 대상
 *   무게           : 저울 연동 **실측값** → 추론이 아니므로 게이트와 무관 (§1-3)
 *   그래서 추론이 실패(MEASURE_FAILED)해도 무게는 응답에 실릴 수 있고, 그 경우에도 값을 그린다.
 *
 * 치수 축 규약 (D-18)
 *   `heightCm` 은 카메라 기하에서 따로 산출한 실제 높이라 정렬 대상이 아니고,
 *   나머지 두 변은 **긴 쪽이 가로(widthCm), 짧은 쪽이 세로(lengthCm)** 로 서버가 스왑 정렬해
 *   저장한다(불변식 `widthCm >= lengthCm`). 그래서 이 패널의 "가로 / 세로" 라벨은
 *   촬영할 때 물건을 어느 방향으로 놓았는지와 무관하게 항상 같은 뜻을 가진다.
 *   화면에서 다시 정렬하거나 검증하지 않는다 — 이미 정렬된 값이 온다.
 *
 * 단위 (D-03): 길이 cm 소수 1자리, 무게 kg 소수 3자리.
 */
export function MeasurementPanel({
  data,
  isLoading,
  error,
}: {
  /** 1-3 응답. 아직 촬영 전이면 undefined */
  data?: MeasurementResponse;
  isLoading: boolean;
  /** 촬영 호출 자체가 실패했을 때(네트워크·5xx). MEASURE_FAILED 는 여기가 아니라 data 로 온다 */
  error?: string | null;
}) {
  const inferred = data?.status === "INFERRED" ? data : null;
  const failed = data?.status === "MEASURE_FAILED" ? data : null;

  return (
    <div className="space-y-3">
      {/* 상태 배지 — 샘플의 우상단 "MEASURED" 표시(877~880행) 자리 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusBadge data={data} isLoading={isLoading} />
        {inferred !== null ? (
          <span className="text-sm text-muted-foreground tabular-nums">
            신뢰도 {(inferred.confidence * 100).toFixed(0)}%
          </span>
        ) : null}
      </div>

      {/* 네 칸 — 샘플 882~911행. 값이 없으면 "--" 를 그린다(샘플 측정 전 상태와 같다) */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 min-[560px]:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 min-[560px]:grid-cols-4">
          <MeasurementCell label="가로" value={formatCm(inferred?.inferred.widthCm)} unit="cm" />
          <MeasurementCell label="세로" value={formatCm(inferred?.inferred.lengthCm)} unit="cm" />
          <MeasurementCell label="높이" value={formatCm(inferred?.inferred.heightCm)} unit="cm" />
          <MeasurementCell label="무게" value={formatKg(data?.weightKg)} unit="kg" />
        </div>
      )}

      {/* 게이트 판정 — 승인 가능 여부를 가르는 값이라 눈에 띄어야 한다 */}
      {inferred !== null && !inferred.gatePassed ? (
        <div
          role="alert"
          className="border-2 border-status-error/40 bg-status-error/10 p-3 text-sm text-status-error"
        >
          <p className="font-medium">신뢰도 게이트 미통과 — 승인할 수 없습니다</p>
          <p className="mt-1">
            {/* ⚠️ 화면이 승인 버튼을 잠그는 근거가 이 값이다 (§1-3).
                잠금 해제는 두 가지뿐 — 재촬영(1-3 재호출) 또는 수기 확정(1-4 MANUAL).
                실제 방어선은 서버다: 미통과 세션에 APPROVE 하면 409 GATE_NOT_PASSED 가 온다. */}
            해제하려면 <span className="font-medium">재촬영</span>하거나{" "}
            <span className="font-medium">수기 확정</span>하세요.
          </p>
          <ul className="mt-2 flex flex-wrap gap-1">
            {inferred.gateFailReasons.map((reason) => (
              // TODO(P1): 사유 코드 → 한국어 라벨 맵을 붙인다.
              //   02 에는 코드 목록이 없고 계약은 string[] 뿐이라 지금은 코드를 그대로 보여준다.
              //   AI/백엔드와 코드 목록이 정해지면 app/packing/_components/order-detail-panel.tsx 의
              //   HANDLING_LABEL 처럼 "아는 코드는 한국어, 모르는 코드는 원문" 방식으로 만들 것.
              <li key={reason}>
                <Badge variant="destructive" className="font-mono">
                  {reason}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* 측정 실패 — HTTP 에러가 아니라 상태값이다 (§1-3) */}
      {failed !== null ? (
        <div
          role="alert"
          className="border-2 border-status-error/40 bg-status-error/10 p-3 text-sm text-status-error"
        >
          <p className="font-medium">
            측정에 실패했습니다 (<span className="font-mono">{failed.failReason}</span>)
          </p>
          <p className="mt-1">
            {/* 계약이 정한 화면 동작: 실패 시 수동 입력 fallback 을 **자동으로 연다** (§1-3).
                실제로 여는 것은 부모(page.tsx)이고, 이 패널은 이유만 알린다. */}
            수기 입력 칸이 자동으로 열렸습니다. 치수를 직접 입력해 확정하거나 재촬영하세요.
          </p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-medium text-status-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** 샘플 877~880행의 상태 표시. 네 갈래를 한 배지로 압축한다 */
function StatusBadge({
  data,
  isLoading,
}: {
  data?: MeasurementResponse;
  isLoading: boolean;
}) {
  if (isLoading) return <Badge variant="secondary">측정 중…</Badge>;
  if (data === undefined) return <Badge variant="outline">촬영 대기</Badge>;
  if (data.status === "MEASURE_FAILED") return <Badge variant="destructive">측정 실패</Badge>;
  if (!data.gatePassed) return <Badge variant="destructive">게이트 미통과</Badge>;
  return <Badge>측정 완료</Badge>;
}

/**
 * 값 한 칸 — 샘플 884~889행 구조 그대로(좌상단 작은 라벨 + 가운데 큰 숫자 + 단위).
 * 숫자를 크게 두는 이유는 샘플 measurement-xl(32px)과 같다: 멀리서도 읽혀야 한다.
 */
function MeasurementCell({
  label,
  value,
  unit,
}: {
  label: string;
  /** 이미 포맷된 문자열. 값이 없으면 "--" */
  value: string;
  unit: string;
}) {
  const isEmpty = value === EMPTY;

  return (
    <div className="relative flex min-h-24 flex-col items-center justify-center border-2 bg-card p-2">
      <span className="absolute top-2 left-2 text-xs font-semibold text-muted-foreground">
        {label}
      </span>
      <span className="flex items-baseline gap-1">
        <span
          className={`text-3xl leading-none font-bold tabular-nums ${
            isEmpty ? "text-muted-foreground" : ""
          }`}
        >
          {value}
        </span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </span>
    </div>
  );
}

/** 샘플의 측정 전 상태(887행)가 쓰는 표기 그대로 */
const EMPTY = "--";

/** 길이는 cm 소수 1자리 (D-03) */
function formatCm(value: number | undefined): string {
  return value === undefined ? EMPTY : value.toFixed(1);
}

/**
 * 무게는 kg 소수 3자리 (D-03).
 * 샘플은 12.4 처럼 한 자리로 그렸지만, 계약 예시가 0.520kg 이라 한 자리로 자르면
 * 작은 상품의 무게가 0.5 로 뭉개진다. 계약 정밀도를 따른다.
 * `null` 은 "저울 미수신"이라 값 없음과 같은 표기로 둔다 (§1-3).
 */
function formatKg(value: number | null | undefined): string {
  return value === undefined || value === null ? EMPTY : value.toFixed(3);
}
