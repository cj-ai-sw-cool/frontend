/* ═══════════════════════════════════════════════════════════════════════════
   지뢰찾기 — 태스크바 이스터에그

   ★ win98 대시보드의 농담이다. 시작 버튼 옆에 💣 하나가 놓여 있고, 누르면 진짜로 돌아가는
     지뢰찾기가 뜬다. 시연에서 굳이 열 필요는 없지만, 열어 보면 되는 물건이어야 농담이 산다.
   ★ **화면 넷이 함께 쓴다.** 이 저장소는 win98 화면마다 `_components` 를 따로 갖는 것이
     규칙이지만, 이건 특정 화면의 부품이 아니라 태스크바에 얹히는 것이라 네 벌로 복사하면
     같은 게임이 네 개가 된다. 그래서 공용 `components/` 에 둔다.
   ⚠️ 그래서 **어느 화면의 `_styles/win98.module.css` 도 쓰지 않는다.** 화면마다 다른 모듈을
      가리키게 되기 때문이다. 98 의 입체감은 여기서 인라인 스타일로 직접 만든다.
   ⚠️ 창은 `position: fixed` 인데, 기준은 뷰포트가 아니라 **스테이지**(transform 이 걸린 가장
      가까운 조상)다. 그래서 뜨는 자리를 좌표로 박아 둔다 — `inset-0` 같은 걸 쓰면 스테이지의
      transform 이 붙기 전 첫 프레임에 창이 화면 밖으로 튀었다 들어온다.

   ── 규칙 (원작 그대로) ──────────────────────────────────────────────────────
   9x9 에 지뢰 10개. 좌클릭 열기, 우클릭 깃발. 빈 칸을 열면 이어진 빈 칸이 함께 열린다.
   **첫 클릭은 절대 지뢰가 아니다** — 원작이 그렇고, 첫 수에 죽으면 게임이 아니라 추첨이다.
   ═══════════════════════════════════════════════════════════════════════════ */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const COLS = 9, ROWS = 9, MINES = 10;
/* 칸 한 변(px).
   ★ 18 → **26** (사용자 요청 — 조금 더 크게). 판이 9x9 라 이 값 하나가 창 크기를 정한다.
   ⚠️ 글자 크기도 같이 올려야 한다. 칸만 키우면 숫자가 넓은 칸 한가운데에 점처럼 남아,
      커진 게 아니라 성글어진 것으로 보인다. */
const CELL = 26;

/** 98 의 입체감 — 네 변의 밝기 차이. 알파도 그림자도 쓰지 않는다 */
const bevel = (out: boolean, w = 2): React.CSSProperties => ({
  borderStyle: "solid",
  borderWidth: w,
  borderTopColor: out ? "#FFFFFF" : "#808080",
  borderLeftColor: out ? "#FFFFFF" : "#808080",
  borderRightColor: out ? "#808080" : "#FFFFFF",
  borderBottomColor: out ? "#808080" : "#FFFFFF",
});

/** 숫자 색 — 원작 팔레트. 1은 파랑, 2는 초록… 색이 곧 위험도라 순서를 바꾸면 안 된다 */
const NUM_COLOR = ["", "#0000FF", "#008000", "#FF0000", "#000080", "#800000", "#008080", "#000000", "#808080"];

type Cell = { mine: boolean; adj: number; open: boolean; flag: boolean };
type Status = "ready" | "playing" | "won" | "lost";

const idx = (r: number, c: number) => r * COLS + c;
const around = (i: number) => {
  const r = Math.floor(i / COLS), c = i % COLS;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      out.push(idx(nr, nc));
    }
  }
  return out;
};

const emptyBoard = (): Cell[] =>
  Array.from({ length: ROWS * COLS }, () => ({ mine: false, adj: 0, open: false, flag: false }));

/** 첫 클릭 자리와 그 이웃을 빼고 지뢰를 뿌린다 — 첫 수는 늘 빈 칸이 열리게 */
const layMines = (board: Cell[], safe: number) => {
  const banned = new Set([safe, ...around(safe)]);
  let left = MINES;
  while (left > 0) {
    const i = Math.floor(Math.random() * board.length);
    if (banned.has(i) || board[i]!.mine) continue;
    board[i]!.mine = true;
    left -= 1;
  }
  for (let i = 0; i < board.length; i += 1) {
    board[i]!.adj = around(i).filter((n) => board[n]!.mine).length;
  }
};

export function Minesweeper() {
  const [open, setOpen] = useState(false);
  const [board, setBoard] = useState<Cell[]>(emptyBoard);
  const [status, setStatus] = useState<Status>("ready");
  const [time, setTime] = useState(0);
  /* 창을 끌어 옮긴 거리. 뜨는 자리는 좌표로 박혀 있고(위 주의 참고) 여기에 더한다 */
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  /* 끌고 있는 중인가. **상태로** 들고 있어야 아래 effect 가 그때만 리스너를 붙인다 */
  const [dragging, setDragging] = useState(false);
  const grab = useRef({ x: 0, y: 0 });

  const reset = useCallback(() => {
    setBoard(emptyBoard());
    setStatus("ready");
    setTime(0);
  }, []);

  /* 시계 — 게임이 도는 동안만. 창을 닫아도 멈춘다 */
  useEffect(() => {
    if (status !== "playing" || !open) return;
    const id = setInterval(() => setTime((t) => Math.min(999, t + 1)), 1000);
    return () => clearInterval(id);
  }, [status, open]);

  /* 끌어 옮기기 — 제목줄을 누른 동안만 창(window)에서 듣는다.
     ⚠️ 창 밖으로 마우스가 나가도 따라와야 하므로 리스너는 `window` 에 붙인다. 제목줄에
        붙이면 조금만 빨리 끌어도 커서가 제목줄을 벗어나 창이 그 자리에 멈춰 선다. */
  useEffect(() => {
    if (!dragging) return undefined;
    const move = (e: PointerEvent) => {
      setDrag({ x: e.clientX - grab.current.x, y: e.clientY - grab.current.y });
    };
    const up = () => setDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging]);

  const dig = (i: number) => {
    if (status === "won" || status === "lost") return;
    if (board[i]!.flag) return;

    const next = board.map((c) => ({ ...c }));
    if (status === "ready") {
      layMines(next, i);
      setStatus("playing");
    }
    if (next[i]!.mine) {
      for (const c of next) if (c.mine) c.open = true;
      setBoard(next);
      setStatus("lost");
      return;
    }

    /* 빈 칸이면 이어진 빈 칸까지 함께 연다.
       ⚠️ 재귀 대신 스택으로 돈다. 9x9 면 재귀도 버티지만, 판을 키우는 순간 콜 스택이 넘친다 */
    const stack = [i];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      const cell = next[cur]!;
      if (cell.open || cell.flag) continue;
      cell.open = true;
      if (cell.adj === 0) stack.push(...around(cur));
    }

    /* ⚠️ 이겼는지를 **`setBoard` 앞에서** 판정한다. 넘겨준 뒤에 같은 배열을 또 고치면
       리액트가 이미 들고 있는 상태를 몰래 바꾸는 것이 되어, 다시 그리지 않거나 한 박자
       늦게 그린다. 남은 칸이 전부 지뢰면 이긴 것이고, 그때 지뢰마다 깃발을 꽂아 준다. */
    const won = next.every((c) => c.mine || c.open);
    if (won) for (const c of next) if (c.mine) c.flag = true;
    setBoard(next);
    if (won) setStatus("won");
  };

  const mark = (i: number) => {
    if (status === "won" || status === "lost" || board[i]!.open) return;
    const next = board.map((c) => ({ ...c }));
    next[i]!.flag = !next[i]!.flag;
    setBoard(next);
  };

  const flags = board.filter((c) => c.flag).length;
  const face = status === "lost" ? "😵" : status === "won" ? "😎" : "🙂";

  /** 카운터 — 원작의 빨간 7세그먼트. 세 자리로 0 을 채운다 */
  const led = (n: number) => (
    <span
      style={{ ...bevel(false, 1), background: "#000", color: "#FF0000", padding: "2px 5px" }}
      className="font-mono text-[19px] leading-none font-bold tabular-nums"
    >
      {String(Math.max(0, Math.min(999, n))).padStart(3, "0")}
    </span>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="지뢰찾기"
        aria-label="지뢰찾기"
        style={bevel(!open)}
        className="flex h-6 items-center px-2 text-[13px] leading-none"
      >
        💣
      </button>

      {open && (
        <div
          /* ⚠️ 자리를 좌표로 박는다 (위 주의 참고). 대시보드 화면 위쪽을 가리지 않게
             오른쪽 아래, 태스크바 바로 위에 뜬다 */
          style={{
            position: "fixed",
            left: 1136 + drag.x,
            top: 508 + drag.y,
            zIndex: 300,
            background: "#C0C0C0",
            ...bevel(true),
          }}
          className="p-[3px] select-none"
        >
          {/* 제목줄 */}
          <div
            onPointerDown={(e) => {
              grab.current = { x: e.clientX - drag.x, y: e.clientY - drag.y };
              setDragging(true);
            }}
            style={{ background: "#000080" }}
            className="flex cursor-move items-center justify-between px-1.5 py-[3px] text-[14px] font-bold text-white"
          >
            <span>💣 지뢰찾기</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="닫기"
              style={{ background: "#C0C0C0", color: "#000", ...bevel(true, 1) }}
              className="ml-2 h-[18px] w-[18px] text-[11px] leading-none font-bold"
            >
              ✕
            </button>
          </div>

          {/* 계기판 — 남은 지뢰 · 표정 · 시계 */}
          <div style={{ ...bevel(false), marginTop: 3 }} className="flex items-center justify-between px-1.5 py-1.5">
            {led(MINES - flags)}
            <button
              type="button"
              onClick={reset}
              aria-label="새 판"
              style={bevel(true)}
              className="h-[34px] w-[34px] text-[19px] leading-none"
            >
              {face}
            </button>
            {led(time)}
          </div>

          {/* 판 */}
          <div
            style={{ ...bevel(false), marginTop: 3, width: COLS * CELL + 4 }}
            onContextMenu={(e) => e.preventDefault()}
            className="grid"
          >
            <div className="grid" style={{ gridTemplateColumns: `repeat(${COLS}, ${CELL}px)` }}>
              {board.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => dig(i)}
                  onContextMenu={(e) => { e.preventDefault(); mark(i); }}
                  style={{
                    width: CELL,
                    height: CELL,
                    background: c.open && c.mine ? "#FF0000" : "#C0C0C0",
                    color: NUM_COLOR[c.adj],
                    /* 열린 칸은 **입체감을 없애고 얇은 선만** 남긴다. 원작에서 열린 칸이
                       평평해 보이는 건 그 때문이고, 그래서 판이 한눈에 읽힌다 */
                    ...(c.open
                      ? { borderStyle: "solid", borderWidth: 1, borderColor: "#808080" }
                      : bevel(true)),
                  }}
                  className="p-0 text-[17px] leading-none font-bold"
                >
                  {c.open ? (c.mine ? "💥" : c.adj > 0 ? c.adj : "") : c.flag ? "🚩" : ""}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-1.5 px-1 pb-[2px] text-[12px] leading-none text-[#404040]">
            좌클릭 열기 · 우클릭 깃발
          </div>
        </div>
      )}
    </>
  );
}
