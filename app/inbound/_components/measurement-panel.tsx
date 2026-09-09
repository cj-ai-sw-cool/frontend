"use client";

import { Radio } from "lucide-react";
import type { Dimensions, MeasurementResponse } from "@/lib/types";

/**
 * 자동 측정 데이터 — docs/02-api-spec.md §1-3 `POST /inbound/measurements`.
 * 디자인 확정본 좌측 컬럼 첫 패널(body.html 74~108행), 높이 283px 고정.
 *
 * 순수 표시용(presentational): API 를 부르지 않는다. 촬영 실행도 부모가 한다.
 *
 * 아이콘 대응표 (확정본 Material Symbols → lucide-react)
 *   sensors → Radio
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
 *
 * ── 세로 예산 (283px) ───────────────────────────────────────────────────
 *   p-panel-padding 16×2                    32
 *   헤더 행 h-8                              32
 *   헤더 mb-2(8) + 칸 영역 pt-2(8)            16
 *   네 칸                                    203  ← flex-1 이 먹는 나머지
 *   합 283. 칸 하나는 (920 - 32 - 16×3) / 4 = 210px 폭이다.
 *
 * ── ★ 계약 필수 UI ②: confidence + 게이트 사유가 여기 있는 이유 ──────────
 *   확정본에는 신뢰도도 게이트 사유도 없다(확정본은 성공 상태 하나만 그린 목업이다).
 *   둘 다 **측정 결과에 딸린 정보**라 측정 패널 밖에 두면 "무엇에 대한 신뢰도인지"가
 *   끊긴다. 그래서 확정본의 MEASURED 배지를 확장하는 방향으로 넣었다:
 *     통과   → 배지가 `MEASURED · 93%` 로 늘어난다 (세로 0px 추가)
 *     미통과 → 배지 색이 오류색으로 바뀌고, 헤더 행의 **가운데 빈 자리**에 사유가 붙는다
 *   사유를 별도 줄이 아니라 헤더 행 안에 넣은 것이 핵심이다 — 줄을 추가하면 상태에 따라
 *   네 칸의 높이가 203 → 175 로 흔들리는데, 숫자 68px 이 들어앉은 칸이 상태마다 크기가
 *   달라지면 눈이 값을 못 좇는다. 헤더 행은 어차피 h2 와 배지 사이가 비어 있었다.
 *
 * ── ★ 이 패널은 "자동 측정" 값만 그린다 (사용자 결정) ────────────────────
 *   수기 입력이 이긴 상태에서는 네 칸이 **전부 `--`** 가 된다. 수기값을 여기 대신 그리지
 *   않는다 — 패널 제목이 "자동 측정 데이터"인데 사람이 친 숫자를 그리면 라벨이 거짓말이 된다.
 *   `--` 자체가 **"자동 측정값은 지금 무효"** 라는 신호다.
 *
 *   우선권은 last-write-wins 다(page.tsx 의 manualDims 주석):
 *     촬영(1-3) 성공 → 수기값을 버린다 → 이 패널이 추론값을 그린다
 *     수기 적용       → 추론 표시를 죽인다 → 이 패널이 `--` 가 된다
 *
 *   ⚠️ 그렇다고 작업자가 자기가 친 숫자를 **아무 데서도 못 보면 안 된다.** 두 군데서 본다:
 *     ① 헤더 행의 한 줄 — 수기값과 "DB 입력 시 저장된다"는 사실을 같이 적는다.
 *        칸이 아니라 줄이라 "자동 측정" 라벨과 섞이지 않고, 세로도 0px 먹는다.
 *     ② 수동 입력 모달을 다시 열면 친 값이 그대로 남아 있다(page.tsx 가 들고 있다).
 */
export function MeasurementPanel({
  data,
  manualDims,
  manualWeightKg,
  isLoading,
  error,
}: {
  /** 1-3 응답. 아직 촬영 전이면 undefined */
  data?: MeasurementResponse;
  /**
   * 수기 입력이 이긴 상태의 치수. null 이면 추론값이 이긴 상태다.
   * ⚠️ 이 값은 **칸에 그려지지 않는다** — 네 칸을 `--` 로 만들고 헤더 행 한 줄로만 알린다
   *    (위 주석 ★ 참고). 축 정렬(D-18)은 page.tsx 가 이미 끝낸 상태로 넘어온다.
   */
  manualDims?: Dimensions | null;
  /** 수기 무게. 비웠으면 null — 그때는 세션 저울값이 쓰인다 (§1-4) */
  manualWeightKg?: number | null;
  isLoading: boolean;
  /** 촬영 호출 자체가 실패했을 때(네트워크·5xx). MEASURE_FAILED 는 여기가 아니라 data 로 온다 */
  error?: string | null;
}) {
  const isManualWinning = manualDims != null;
  // 수기가 이기면 자동 측정값은 무효다 — 추론값도 저울값도 그리지 않는다
  const inferred = !isManualWinning && data?.status === "INFERRED" ? data : null;
  const weightKg = isManualWinning ? undefined : data?.weightKg;

  const notice = describeNotice({ data, error, manualDims, manualWeightKg });

  return (
    <section className="bg-accent p-panel-padding flex h-[283px] shrink-0 flex-col border-2">
      <div className="mb-2 flex h-8 shrink-0 items-center gap-4">
        <h2 className="text-sub-action-md shrink-0 font-bold tracking-wider">자동 측정 데이터</h2>

        {/* 상태 사유 — 헤더 행의 남는 폭을 쓴다(위 주석 ② 참고).
            ⚠️ 실제로 DB 입력을 잠그는 근거가 이 값이다 (§1-3). 잠금 해제는 두 가지뿐 —
               재촬영(1-3 재호출) 또는 수기 확정(1-4 MANUAL). 실제 방어선은 서버다:
               미통과 세션에 APPROVE 하면 409 GATE_NOT_PASSED 가 온다. */}
        <p
          role={notice.tone === "error" ? "alert" : undefined}
          title={notice.text === "" ? undefined : notice.text}
          className={`text-label-sm min-w-0 flex-1 truncate font-medium ${
            notice.tone === "error" ? "text-status-error" : "text-foreground"
          }`}
        >
          {notice.text}
        </p>

        <StatusBadge data={data} isManualWinning={isManualWinning} isLoading={isLoading} />
      </div>

      {/* 네 칸 — 확정본 82~107행. 값이 없으면 "--" 를 그린다(확정본 측정 전 상태와 같다) */}
      <div className="flex min-h-0 flex-1 gap-4 pt-2">
        <MeasurementCell label="가로" value={formatCm(inferred?.inferred.widthCm)} unit="cm" />
        <MeasurementCell label="세로" value={formatCm(inferred?.inferred.lengthCm)} unit="cm" />
        <MeasurementCell label="높이" value={formatCm(inferred?.inferred.heightCm)} unit="cm" />
        <MeasurementCell label="무게" value={formatKg(weightKg)} unit="kg" />
      </div>
    </section>
  );
}

/**
 * 헤더 행 가운데의 한 줄. 빈 문자열이면 자리만 남고 아무것도 안 그린다.
 *
 * 우선순위가 곧 "지금 작업자에게 제일 중요한 사실"이다.
 *   ① 수기가 이김 → 네 칸이 `--` 인 이유와 **친 값 자체**를 알린다. 오류가 아니라 중립색이다.
 *                   이 줄이 없으면 작업자는 방금 친 숫자를 화면 어디서도 못 본다.
 *   ② 문제        → 게이트 미통과·측정 실패·호출 실패
 */
function describeNotice({
  data,
  error,
  manualDims,
  manualWeightKg,
}: {
  data: MeasurementResponse | undefined;
  error: string | null | undefined;
  manualDims?: Dimensions | null;
  manualWeightKg?: number | null;
}): { tone: "error" | "info"; text: string } {
  if (manualDims != null) {
    const { widthCm, lengthCm, heightCm } = manualDims;
    // 헤더 행에 남는 폭이 450px 남짓이라 짧게 쓴다. 잘려도 title 로 전문이 뜬다.
    const weight = manualWeightKg == null ? "무게 저울값" : `${formatKg(manualWeightKg)} kg`;
    return {
      tone: "info",
      text: `수기 ${formatCm(widthCm)} / ${formatCm(lengthCm)} / ${formatCm(heightCm)} cm · ${weight} — DB 입력 시 저장`,
    };
  }
  return { tone: "error", text: describeProblem(data, error) };
}

/**
 * TODO(P1): 사유 코드 → 한국어 라벨 맵을 붙인다.
 *   02 에는 코드 목록이 없고 계약은 string[] 뿐이라 지금은 코드를 그대로 보여준다.
 *   AI/백엔드와 코드 목록이 정해지면 app/packing/_components/order-detail-panel.tsx 의
 *   HANDLING_LABEL 처럼 "아는 코드는 한국어, 모르는 코드는 원문" 방식으로 만들 것.
 */
function describeProblem(
  data: MeasurementResponse | undefined,
  error: string | null | undefined,
): string {
  if (error) return error;
  if (data === undefined) return "";
  if (data.status === "MEASURE_FAILED") {
    // 계약이 정한 화면 동작: 실패 시 수동 입력 fallback 을 **자동으로 연다** (§1-3).
    // 실제로 여는 것은 부모(page.tsx)이고, 이 패널은 이유만 알린다.
    return `측정 실패 (${data.failReason}) — 재촬영하거나 수동 입력으로 확정하세요`;
  }
  if (!data.gatePassed) {
    return `게이트 미통과 — ${data.gateFailReasons.join(" · ")} · 재촬영 또는 수동 입력으로 해제`;
  }
  return "";
}

/**
 * 확정본 77~80행의 MEASURED 배지. 다섯 갈래를 한 배지로 압축한다.
 * 통과 상태에서 신뢰도를 뒤에 붙이는 것이 계약 필수 UI ② 의 절반이다(파일 상단 주석).
 *
 * ⚠️ 색은 전부 토큰이다. 오류 상태의 글자색으로 `text-primary-foreground`(#ffffff)를 쓰는 게
 *    어색해 보이지만, 우리 팔레트에 "오류 배경 위 글자" 슬롯이 없어서 흰색 토큰 중
 *    의미가 가장 가까운 것을 골랐다. 하드코딩(#fff)하면 팔레트 전환이 이 자리만 안 먹는다.
 */
function StatusBadge({
  data,
  isManualWinning,
  isLoading,
}: {
  data?: MeasurementResponse;
  isManualWinning: boolean;
  isLoading: boolean;
}) {
  const { tone, label } = describeStatus(data, isManualWinning, isLoading);
  return (
    <span
      className={`text-label-sm flex h-8 shrink-0 items-center gap-2 border px-4 ${
        tone === "ok"
          ? "bg-primary text-primary-foreground"
          : tone === "error"
            ? "bg-status-error text-primary-foreground"
            : "bg-card text-muted-foreground"
      }`}
    >
      <Radio className="size-[18px]" aria-hidden />
      {label}
    </span>
  );
}

function describeStatus(
  data: MeasurementResponse | undefined,
  isManualWinning: boolean,
  isLoading: boolean,
): { tone: "ok" | "error" | "idle"; label: string } {
  if (isLoading) return { tone: "idle", label: "MEASURING…" };
  // 수기가 이기면 자동 측정 상태(신뢰도·게이트)는 더 이상 이 화면의 판단 근거가 아니다.
  // 배지가 계속 `MEASURED · 93%` 라고 말하면 `--` 인 칸과 정면으로 어긋난다.
  if (isManualWinning) return { tone: "ok", label: "MANUAL · 수기 입력" };
  if (data === undefined) return { tone: "idle", label: "STANDBY" };
  if (data.status === "MEASURE_FAILED") return { tone: "error", label: "FAILED" };
  // 신뢰도는 모델이 줄 때만 배지에 붙인다. 없을 때 0 으로 접으면 게이트를 통과한 측정이
  // `MEASURED · 0%` 로 보여 반대로 읽힌다 (D-24).
  const percent = data.confidence == null ? "" : ` ${(data.confidence * 100).toFixed(0)}%`;
  if (!data.gatePassed) return { tone: "error", label: `GATE${percent || " 미통과"}` };
  return { tone: "ok", label: `MEASURED${percent && ` ·${percent}`}` };
}

/**
 * 값 한 칸 — 확정본 84~88행 구조(좌상단 라벨 + 가운데 큰 숫자 + 숫자 아래 단위).
 *
 * ── ★ 확정본에서 의도적으로 이탈한 지점 (사용자 결정) ────────────────────
 *   확정본은 라벨 16px / 숫자 68px / 단위 20px 이다. 우리는 **24 / 68 / 28** 로 올린다.
 *   근거는 위계 사다리다: 16 ‹ 20 은 둘 다 "작은 글씨"로 뭉쳐 보여 라벨과 단위가 서로
 *   구분되지 않고, 68px 숫자와의 낙차가 커서 중간 단계가 비어 버린다.
 *   `24 ‹ 28 ‹ 68` 로 두면 라벨(무엇) → 단위(무엇의 단위) → 값(얼마)이 각각 다른 층으로
 *   읽힌다. 창고에서 서서 보는 화면이라 중간 층이 실제로 필요하다.
 *   숫자 68px 은 확정본 그대로다 — 이 화면에서 가장 멀리서 읽혀야 하는 값이다.
 *
 *   토큰이 아니라 임의값(text-[24px] 등)을 쓴 이유: 확정본의 타이포 스케일 4종
 *   (action-lg 32 / sub-action-md 24 / label-sm 16 / measurement-xl 32)에 28px 이 없고,
 *   68px 도 없다. 이번 작업에서 globals.css 를 열 수 없어 토큰을 추가하지 못했다 —
 *   PM 보고 항목이다.
 *
 * 칸 크기는 210×203px 이다. 가장 긴 표시값은 무게의 다섯 글자(`0.520`)인데,
 * tabular-nums 기준 68px 숫자 4개 + 소수점이 약 183px 라 210px 안에 들어온다.
 * overflow-hidden 을 걸어 둔 건 그 계산이 폰트 폴백으로 틀어져도 격자가 안 깨지게 하려는 것이다.
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
    <div className="bg-card relative flex min-w-0 flex-1 flex-col items-center justify-center overflow-hidden border-2">
      <span className="text-muted-foreground absolute top-2 left-2 text-[24px] leading-[28px] font-semibold">
        {label}
      </span>
      <span
        className={`text-[68px] leading-[72px] font-bold tabular-nums ${
          isEmpty ? "text-muted-foreground" : "text-foreground"
        }`}
      >
        {value}
      </span>
      <span className="text-muted-foreground text-[28px] leading-[32px] font-semibold">{unit}</span>
    </div>
  );
}

/** 확정본의 측정 전 상태가 쓰는 표기 그대로 */
const EMPTY = "--";

/** 길이는 cm 소수 1자리 (D-03) */
function formatCm(value: number | undefined): string {
  return value === undefined ? EMPTY : value.toFixed(1);
}

/**
 * 무게는 kg 소수 3자리 (D-03).
 * 확정본도 0.520 처럼 세 자리로 그린다 — 계약 예시가 0.520kg 이라 한 자리로 자르면
 * 작은 상품의 무게가 0.5 로 뭉개진다.
 * `null` 은 "저울 미수신"이라 값 없음과 같은 표기로 둔다 (§1-3).
 */
function formatKg(value: number | null | undefined): string {
  return value === undefined || value === null ? EMPTY : value.toFixed(3);
}
