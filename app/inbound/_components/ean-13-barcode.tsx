"use client";

/**
 * EAN-13 바코드 그래픽 — 디자인 확정본 우상단 96px 행의 위쪽 44px 자리다.
 * (확정본 body.html 150~183행: `<svg viewBox="0 0 107 44" preserveAspectRatio="none">`)
 *
 * ⚠️ **장식이 아니다.** 확정본의 SVG 는 고정된 막대 그림이지만, 우리는 아래 입력란에 찍힌
 *    숫자를 실제로 EAN-13 으로 인코딩해서 그린다. 스캐너로 찍든 손으로 치든 같은 값이
 *    같은 막대로 나오므로, 작업자가 "지금 화면이 들고 있는 바코드"를 눈으로 대조할 수 있다.
 *    그림을 진짜로 만들어 두면 시연 중 스캐너 오독을 사람이 잡아낼 수 있다는 게 근거다.
 *
 * ── EAN-13 구조 (95 모듈) ────────────────────────────────────────────────
 *   좌 가드 101 (3)
 *   좌 6자리 × 7모듈 = 42 — **첫 자리(d1)가 이 6자리의 L/G 패턴을 정한다**
 *   센터 가드 01010 (5)
 *   우 6자리 × 7모듈 = 42 — 전부 R 코드
 *   우 가드 101 (3)
 *   d1 자체는 막대로 그려지지 않는다. L/G 배열이 d1 을 "간접 인코딩"하는 것이 EAN-13 이
 *   UPC-A(12자리) 위에 한 자리를 더 얹은 방식이고, 그래서 첫 자리를 바꾸면 막대 폭이
 *   아니라 좌측 6자리의 패턴이 통째로 뒤집힌다.
 *
 * ── viewBox 를 107 로 두는 이유 ──────────────────────────────────────────
 *   95 모듈 좌우에 6모듈씩 여백(quiet zone)을 붙여 107 이다. 확정본 SVG 의 viewBox 폭이
 *   정확히 107 이고 첫 막대가 x=6 에서 시작하므로, 같은 좌표계를 쓰면 확정본과 픽셀이 맞는다.
 *   실제 규격의 quiet zone 은 좌 11 / 우 7 모듈이지만, 여기서는 **화면 표시용**이라
 *   확정본 좌표계를 우선했다(종이에 인쇄해 스캔할 물건이 아니다).
 *
 * ── preserveAspectRatio="none" ──────────────────────────────────────────
 *   확정본 그대로다. 우측 컬럼 폭(≈290px)에 맞춰 가로로 늘어나되 높이는 44px 로 고정된다.
 *   막대 **비율**이 왜곡되지만 모든 막대가 같은 배율로 늘어나므로 상대 폭은 보존된다.
 *
 * ── 유효하지 않은 입력 ───────────────────────────────────────────────────
 *   · 13자리 숫자가 아니면 → 아무것도 그리지 않고 안내 문구만 둔다(EMPTY).
 *     반쯤 그린 막대는 "읽을 수 있는 바코드"처럼 보여서 오히려 위험하다.
 *   · 13자리인데 체크디짓이 안 맞으면 → **막대는 그대로 그리되 흐리게** 하고 경고를 붙인다.
 *     ⚠️ 체크디짓 불일치로 스캔 자체를 막지 않는다 — 판정은 서버(1-1)가 한다.
 *        화면이 먼저 거부하면 마스터에 실재하는 상품을 화면이 임의로 잘라내게 된다.
 */

/** 홀수 패리티. EAN-13 좌측 6자리 중 'L' 자리에 쓴다 */
const L_CODES = [
  "0001101", "0011001", "0010011", "0111101", "0100011",
  "0110001", "0101111", "0111011", "0110111", "0001011",
];

/** 짝수 패리티(= R 코드를 뒤집은 것). 좌측 6자리 중 'G' 자리에 쓴다 */
const G_CODES = [
  "0100111", "0110011", "0011011", "0100001", "0011101",
  "0111001", "0000101", "0010001", "0001001", "0010111",
];

/** 우측 6자리 전용. L 코드의 비트 반전이라 항상 막대(1)로 시작한다 */
const R_CODES = [
  "1110010", "1100110", "1101100", "1000010", "1011100",
  "1001110", "1010000", "1000100", "1001000", "1110100",
];

/** 첫 자리(d1) → 좌측 6자리의 L/G 배열. 이 표가 EAN-13 을 UPC-A 와 가르는 지점이다 */
const PARITY_BY_FIRST_DIGIT = [
  "LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG",
  "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL",
];

/** 확정본 SVG 와 같은 좌표계 — 좌우 여백 6 + 본체 95 = 107 */
const QUIET_ZONE = 6;
const VIEWBOX_WIDTH = 107;
const VIEWBOX_HEIGHT = 44;

/** 검은 막대 하나. 같은 색이 연속된 모듈은 rect 하나로 합친다(확정본 SVG 도 그렇게 되어 있다) */
interface Bar {
  x: number;
  width: number;
}

export type Ean13Render =
  /** 13자리 숫자가 아니다 — 그릴 게 없다 */
  | { kind: "EMPTY" }
  | { kind: "VALID"; bars: Bar[] }
  /** 막대는 그리되 흐리게. `expected` 는 계산된 올바른 체크디짓이다 */
  | { kind: "CHECKSUM_MISMATCH"; bars: Bar[]; expected: string };

/** 앞 12자리로 체크디짓을 계산한다 — 홀수 자리 ×1, 짝수 자리 ×3 (GS1 표준) */
export function ean13CheckDigit(first12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

/** 모듈 문자열("101101…")을 막대 목록으로. 1 이 연속된 구간을 rect 하나로 묶는다 */
function toBars(modules: string): Bar[] {
  const bars: Bar[] = [];
  let run = 0;
  for (let i = 0; i <= modules.length; i += 1) {
    if (modules[i] === "1") {
      run += 1;
      continue;
    }
    if (run > 0) bars.push({ x: QUIET_ZONE + i - run, width: run });
    run = 0;
  }
  return bars;
}

export function encodeEan13(raw: string): Ean13Render {
  const digits = raw.trim();
  if (!/^\d{13}$/.test(digits)) return { kind: "EMPTY" };

  const parity = PARITY_BY_FIRST_DIGIT[Number(digits[0])];

  let modules = "101"; // 좌 가드
  for (let i = 1; i <= 6; i += 1) {
    const table = parity[i - 1] === "L" ? L_CODES : G_CODES;
    modules += table[Number(digits[i])];
  }
  modules += "01010"; // 센터 가드
  for (let i = 7; i <= 12; i += 1) {
    modules += R_CODES[Number(digits[i])];
  }
  modules += "101"; // 우 가드

  const bars = toBars(modules);
  const expected = ean13CheckDigit(digits.slice(0, 12));
  return expected === digits[12]
    ? { kind: "VALID", bars }
    : { kind: "CHECKSUM_MISMATCH", bars, expected };
}

/**
 * 순수 표시용. 값 하나만 받아 그린다 — 상태도 API 도 없다.
 *
 * ⚠️ 색은 `fill="currentColor"` 다. 하드코딩하면 팔레트를 갈아끼울 때 이 막대만 검정으로
 *    남는다(확정본은 `fill="#1b1c1c"` 로 박아 뒀지만 우리는 토큰을 따라가야 한다).
 */
export function Ean13Barcode({ value }: { value: string }) {
  const render = encodeEan13(value);

  if (render.kind === "EMPTY") {
    return (
      <div className="border-outline-variant flex h-full w-full items-center justify-center border border-dashed">
        <span className="text-label-sm text-muted-foreground">
          13자리를 입력하면 바코드가 그려집니다
        </span>
      </div>
    );
  }

  const dimmed = render.kind === "CHECKSUM_MISMATCH";

  return (
    <div className="relative h-full w-full">
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`바코드 ${value}`}
        className={`text-foreground block h-full w-full ${dimmed ? "opacity-30" : ""}`}
      >
        <g fill="currentColor">
          {render.bars.map((bar) => (
            <rect key={bar.x} x={bar.x} y={0} width={bar.width} height={VIEWBOX_HEIGHT} />
          ))}
        </g>
      </svg>

      {dimmed ? (
        // 스캔을 막지는 않는다 — 그래픽만 흐려지고 판정은 서버 몫이다(파일 상단 주석 참고)
        <span className="text-label-sm text-status-error absolute inset-0 flex items-center justify-center font-medium">
          체크디짓 불일치 (끝자리 {render.expected} 예상)
        </span>
      ) : null}
    </div>
  );
}
