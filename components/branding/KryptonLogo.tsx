"use client";
/**
 * KRYPTON AI — Global Brand Identity System
 * 
 * Design philosophy: Three geometric strokes.
 * No decorations. No glow. No nodes. No hexagons.
 * 
 * Inspired by: Stripe, Linear, OpenAI, Anthropic, Apple.
 * The K is recognizable at 16px favicon and 1000px billboard.
 */

import { useState, useId } from "react";

export type LogoVariant = "icon" | "full" | "minimal";

interface KryptonLogoProps {
  size?:      number;
  showText?:  boolean;
  animated?:  boolean;
  variant?:   LogoVariant;
  className?: string;
  style?:     React.CSSProperties;
  onClick?:   () => void;
}

export default function KryptonLogo({
  size      = 32,
  showText  = false,
  animated  = true,
  variant   = "icon",
  className,
  style,
  onClick,
}: KryptonLogoProps) {
  const [hov, setHov] = useState(false);
  const uid = useId().replace(/:/g, "k");

  const hasText = showText || variant === "full";

  // Canvas dimensions
  // Icon = 40×40, text area adds 160px width
  const GAP_W  = 14;
  const TEXT_W  = 160;
  const vbW    = 40 + (hasText ? GAP_W + TEXT_W : 0);
  const totalW = (size / 40) * vbW;

  return (
    <svg
      width={totalW}
      height={size}
      viewBox={`0 0 ${vbW} 40`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        flexShrink:  0,
        cursor:      onClick ? "pointer" : "default",
        transition:  animated ? "transform 0.2s ease, opacity 0.2s ease" : "none",
        transform:   hov && animated ? "scale(1.04)" : "scale(1)",
        ...style,
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      aria-label="Krypton AI"
      role={onClick ? "button" : "img"}
    >
      <defs>
        {/* Gold → Orange gradient — applied to strokes */}
        <linearGradient
          id={`${uid}_g`}
          x1="10" y1="4" x2="32" y2="36"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%"   stopColor="#FFD700"/>
          <stop offset="55%"  stopColor="#FFB000"/>
          <stop offset="100%" stopColor="#FF7A00"/>
        </linearGradient>

        {/* Wordmark text gradient */}
        <linearGradient id={`${uid}_t`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#FFD700"/>
          <stop offset="70%"  stopColor="#FFB000"/>
          <stop offset="100%" stopColor="rgba(255,255,255,0.82)"/>
        </linearGradient>

        {/* Underline accent gradient */}
        <linearGradient id={`${uid}_u`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#FFD700" stopOpacity="0.7"/>
          <stop offset="100%" stopColor="#FF7A00" stopOpacity="0"/>
        </linearGradient>
      </defs>

      {/* ═══════════════════════════════════════ */}
      {/*  THE K — Three precise strokes          */}
      {/*  strokeLinecap="square": architectural  */}
      {/*  All strokes meet at (10, 20)            */}
      {/* ═══════════════════════════════════════ */}

      {/* Vertical stem */}
      <line
        x1="10" y1="4"
        x2="10" y2="36"
        stroke={`url(#${uid}_g)`}
        strokeWidth={hov && animated ? 3.6 : 3.4}
        strokeLinecap="square"
        style={{ transition: "stroke-width 0.2s ease" }}
      />

      {/* Upper arm — rises 45° from center to top-right */}
      <line
        x1="10" y1="20"
        x2="32" y2="4"
        stroke={`url(#${uid}_g)`}
        strokeWidth={hov && animated ? 3.6 : 3.4}
        strokeLinecap="square"
        style={{ transition: "stroke-width 0.2s ease" }}
      />

      {/* Lower arm — descends 45° from center to bottom-right */}
      <line
        x1="10" y1="20"
        x2="32" y2="36"
        stroke={`url(#${uid}_g)`}
        strokeWidth={hov && animated ? 3.6 : 3.4}
        strokeLinecap="square"
        style={{ transition: "stroke-width 0.2s ease" }}
      />

      {/* ═══════════════════════════════════════ */}
      {/*  WORDMARK — KRYPTON + AI               */}
      {/* ═══════════════════════════════════════ */}
      {hasText && (
        <g>
          {/* KRYPTON */}
          <text
            x="54"
            y="23"
            fontFamily="'Baloo 2', 'DM Sans', system-ui, sans-serif"
            fontSize="15"
            fontWeight="800"
            letterSpacing="2.8"
            fill={`url(#${uid}_t)`}
          >
            KRYPTON
          </text>

          {/* AI — subdued, smaller, wider tracking */}
          <text
            x="54"
            y="33"
            fontFamily="'DM Sans', system-ui, sans-serif"
            fontSize="7.5"
            fontWeight="400"
            letterSpacing="5"
            fill="rgba(255,255,255,0.38)"
          >
            ARTIFICIAL INTELLIGENCE
          </text>

          {/* Animated underline */}
          <rect
            x="54" y="36.5"
            width={hov && animated ? 162 : 98}
            height="0.7"
            rx="0.35"
            fill={`url(#${uid}_u)`}
            style={{ transition: "width 0.4s ease" }}
          />
        </g>
      )}
    </svg>
  );
}

/* ── Named convenience exports ──────────────────────────────────── */

/** Icon only — for navbar, favicons, avatars */
export function KryptonIcon({
  size = 32,
  animated = true,
  onClick,
}: {
  size?: number;
  animated?: boolean;
  onClick?: () => void;
}) {
  return <KryptonLogo size={size} showText={false} animated={animated} onClick={onClick} />;
}

/** Full logo — icon + wordmark — for sidebar headers, landing page */
export function KryptonFull({
  size = 32,
  animated = true,
}: {
  size?: number;
  animated?: boolean;
}) {
  return <KryptonLogo size={size} showText={true} animated={animated} />;
}

/** Static wordmark — no animation, for footers and metadata */
export function KryptonWordmark({ size = 28 }: { size?: number }) {
  return <KryptonLogo size={size} variant="full" animated={false} />;
}

/** Minimal — icon only, no hover, for tight spaces */
export function KryptonMinimal({ size = 20 }: { size?: number }) {
  return <KryptonLogo size={size} showText={false} animated={false} />;
}
