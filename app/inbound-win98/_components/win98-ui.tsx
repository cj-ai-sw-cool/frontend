"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import styles from "../_styles/win98.module.css";

/**
 * win98 스킨의 공용 조각들.
 *
 * 목업 HTML 에서 같은 마크업이 반복되던 것들(패널 = raised + 제목 + etched 구분선,
 * 버튼 = win98-btn + win98-raised, 체크박스 = 숨긴 input + 가짜 상자)을 한 곳으로 모았다.
 * 화면 파일에서 베벨 클래스를 직접 조합하지 않게 하는 것이 목적이다 — 조합 규칙이 흩어지면
 * 어느 칸은 raised, 어느 칸은 sunken 이 되는 사고가 난다.
 *
 * ⚠️ 이 파일에는 **모양만** 있다. 데이터도 계약도 모른다.
 */

/** CSS Module 클래스를 화면 파일에서도 쓸 수 있게 열어 둔다 (베벨을 직접 걸어야 하는 자리용) */
export const w98 = {
  theme: styles.theme,
  desktop: styles.desktop,
  dialogTheme: styles.dialogTheme,
  raised: styles.raised,
  raisedActive: styles.raisedActive,
  sunken: styles.sunken,
  etched: styles.etched,
  btn: styles.btn,
  input: styles.input,
  mono: styles.mono,
  small: styles.small,
  titleText: styles.titleText,
  scroll: styles.scroll,
  camBlack: styles.camBlack,
  camGreen: styles.camGreen,
  camFrame: styles.camFrame,
  marquee: styles.marquee,
  marqueeInner: styles.marqueeInner,
  marqueeBlock: styles.marqueeBlock,
  blink: styles.blink,
  wardenRise: styles.wardenRise,
  wardenBlink: styles.wardenBlink,
  wardenPulse: styles.wardenPulse,
  checkboxLabel: styles.checkboxLabel,
  checkboxBox: styles.checkboxBox,
} as const;

/* ── 패널 ────────────────────────────────────────────────────────────────────
   목업의 반복 구조 그대로: 튀어나온 판 + 제목 + etched 구분선 + 내용. */
export function Panel({
  title,
  right,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  /** 제목 줄 오른쪽에 놓을 것 (상태 배지·아이콘 등) */
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`${styles.raised} flex flex-col bg-[color:var(--surface)] p-2 ${className}`}>
      {/* ⚠️ `min-h-5` — 제목 줄에 한글이 섞이면 titleText 의 16px 줄 높이로는 윗부분이 잘린다.
          (한글 폴백 글꼴의 글리프가 라틴보다 위아래로 크다) */}
      <h2 className={`${styles.titleText} mb-1 flex min-h-5 items-center justify-between gap-2`}>
        <span className="truncate">{title}</span>
        {right}
      </h2>
      <div className={`${styles.etched} mb-2`} />
      <div className={`flex min-h-0 flex-1 flex-col ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** 파인 표시 칸 — 값을 "읽는" 자리에 쓴다(측정값·사진·표) */
export function Sunken({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${styles.sunken} bg-[color:var(--surface-bright)] ${className}`}>
      {children}
    </div>
  );
}

export function Etched({ className = "" }: { className?: string }) {
  return <div className={`${styles.etched} ${className}`} />;
}

/* ── 버튼 ──────────────────────────────────────────────────────────────────── */
export function Btn({
  children,
  pressed = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  /** 토글 상태로 눌려 있는가 (탭·선택 항목). 클릭 순간의 눌림은 CSS 가 처리한다 */
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      className={`${styles.btn} ${pressed ? styles.raisedActive : styles.raised} ${
        pressed ? "bg-[color:var(--surface-variant)]" : ""
      } ${className}`}
    >
      {children}
    </button>
  );
}

/* ── 입력란 ────────────────────────────────────────────────────────────────── */
export function Field({
  className = "",
  mono = false,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  return (
    <input
      {...props}
      className={`${styles.input} ${styles.sunken} ${mono ? styles.mono : ""} ${className}`}
    />
  );
}

/* ── 체크박스 ──────────────────────────────────────────────────────────────
   목업 그대로 — 진짜 input 은 숨기고 옆의 상자를 그린다. input 을 지우지 않는 이유는
   키보드·스크린리더가 그대로 동작해야 하기 때문이다(라벨이 input 을 감싸고 있다). */
export function Checkbox({
  label,
  checked,
  onToggle,
  disabled = false,
  neon = false,
}: {
  label: ReactNode;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /**
   * 켜졌을 때 **검은 바탕 + 네온 글씨**로 바꿀 것인가 (사용자 결정).
   * win98 기본 체크박스는 켜져도 글자가 그대로라, 세 줄 중 무엇이 켜졌는지 ✓ 표시를
   * 하나씩 확인해야 했다. 배경째로 바뀌면 눈이 한 번에 잡는다.
   */
  neon?: boolean;
}) {
  return (
    <label className={`${styles.checkboxLabel} ${neon && checked ? styles.checkedNeon : ""}`}>
      <input
        type="checkbox"
        className="hidden"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
      />
      <div className={`${styles.checkboxBox} ${styles.sunken}`} />
      <span>{label}</span>
    </label>
  );
}

/* ── 상태 표시 (태스크바 트레이 · 패널 우측) ────────────────────────────────
   목업 트레이의 파인 작은 칸. 문구만 바뀐다. */
export function TrayBox({
  children,
  className = "",
  tone = "normal",
}: {
  children: ReactNode;
  className?: string;
  tone?: "normal" | "error";
}) {
  return (
    <div
      className={`${styles.sunken} ${styles.mono} ${styles.small} flex h-6 items-center gap-2 bg-[color:var(--surface)] px-2 ${
        tone === "error" ? "text-[color:var(--status-error)]" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
