"use client";
// components/branding/KryptonLogo.tsx
// Krypton AI — Premium Brand Identity System

import { useState } from "react";

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

let _id = 0;

export default function KryptonLogo({
  size      = 32,
  showText  = false,
  animated  = true,
  variant   = "icon",
  className,
  style,
  onClick,
}: KryptonLogoProps) {
  const [hovered, setHovered] = useState(false);
  const id = `kl${++_id}`;

  const effectiveText = showText || variant === "full";
  const isMinimal     = variant === "minimal";

  // Canvas: icon is 40x40, text area adds ~160px wide
  const TEXT_W   = 165;
  const GAP      = 14;
  const totalW   = effectiveText ? size + (size / 40) * (GAP + TEXT_W) : size;
  const vbW      = 40 + (effectiveText ? GAP + TEXT_W : 0);
  const viewBox  = `0 0 ${vbW} 40`;

  const glowOp  = hovered && animated ? 0.3  : 0.14;

  return (
    <svg
      width={totalW}
      height={size}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        flexShrink: 0,
        cursor:     onClick ? "pointer" : "default",
        transition: "transform 0.25s ease",
        transform:  hovered && animated ? "scale(1.04)" : "scale(1)",
        ...style,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      aria-label="Krypton AI"
    >
      <defs>
        {/* Main gradient — Gold → Amber → Orange */}
        <linearGradient id={`${id}_g1`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#FFD700"/>
          <stop offset="48%"  stopColor="#FFB000"/>
          <stop offset="100%" stopColor="#FF7A00"/>
        </linearGradient>

        {/* Hover gradient — brighter */}
        <linearGradient id={`${id}_g2`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#FFE566"/>
          <stop offset="50%"  stopColor="#FFB000"/>
          <stop offset="100%" stopColor="#FF5500"/>
        </linearGradient>

        {/* Top-left glass shine */}
        <linearGradient id={`${id}_shine`} x1="0.1" y1="0" x2="0.5" y2="1">
          <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.58"/>
          <stop offset="55%"  stopColor="#FFFFFF" stopOpacity="0.07"/>
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0"/>
        </linearGradient>

        {/* Text gradient — Gold → White */}
        <linearGradient id={`${id}_txt`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#FFD700"/>
          <stop offset="55%"  stopColor="#FFB000"/>
          <stop offset="100%" stopColor="rgba(255,255,255,0.85)"/>
        </linearGradient>

        {/* Glow filter */}
        <filter id={`${id}_glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={hovered ? 3 : 2} result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        {/* Sparkle filter */}
        <filter id={`${id}_sp`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.2"/>
        </filter>

        {/* Clip to hexagon */}
        <clipPath id={`${id}_clip`}>
          <path d="M20 3.5L34.8 12V28L20 36.5L5.2 28V12Z"/>
        </clipPath>
      </defs>

      {/* ── Outer ambient glow ── */}
      <path
        d="M20 1L37.3 10.5V29.5L20 39L2.7 29.5V10.5Z"
        fill={`url(#${id}_g1)`}
        opacity={glowOp}
        filter={`url(#${id}_glow)`}
        style={{ transition:"opacity 0.3s ease" }}
      />

      {/* ── Main hexagon ── */}
      <path
        d="M20 3.5L34.8 12V28L20 36.5L5.2 28V12Z"
        fill={hovered && animated ? `url(#${id}_g2)` : `url(#${id}_g1)`}
        style={{ transition:"fill 0.3s ease" }}
      />

      {/* ── Inner ring (depth) ── */}
      <path
        d="M20 6L32.4 13V27L20 34L7.6 27V13Z"
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="0.7"
      />

      {/* ── Top shine ── */}
      <path
        d="M20 3.5L34.8 12V22H5.2V12Z"
        fill={`url(#${id}_shine)`}
      />

      {/* ── Bottom shadow ── */}
      <path
        d="M5.2 24L20 32.5L34.8 24V28L20 36.5L5.2 28Z"
        fill="rgba(0,0,0,0.12)"
      />

      {/* ── K lettermark ── */}
      {!isMinimal && (
        <g clipPath={`url(#${id}_clip)`}>
          <rect x="11" y="12" width="4.5" height="16" rx="0.5" fill="#050505" opacity="0.88"/>
          <path
            d="M15.5 20L23.5 12H29L20 20.5"
            stroke="#050505" strokeWidth="4.5"
            strokeLinecap="round" strokeLinejoin="round"
            fill="none" opacity="0.88"
          />
          <path
            d="M15.5 21L23.5 29H29L20 20.5"
            stroke="#050505" strokeWidth="4.5"
            strokeLinecap="round" strokeLinejoin="round"
            fill="none" opacity="0.88"
          />
        </g>
      )}

      {/* ── Minimal dot ── */}
      {isMinimal && (
        <circle cx="20" cy="20" r="4" fill="#050505" opacity="0.8"/>
      )}

      {/* ── Sparkle dots ── */}
      <g filter={`url(#${id}_sp)`}>
        <circle cx="33" cy="8" r={hovered ? 2.2 : 1.8} fill="#FFE566" opacity={hovered ? 1 : 0.85}>
          {animated && <animate attributeName="r" values="1.6;2.2;1.6" dur="2.5s" repeatCount="indefinite"/>}
        </circle>
        <circle cx="36" cy="15" r="1.2" fill="#FF8C00" opacity={hovered ? 0.9 : 0.7}>
          {animated && <animate attributeName="opacity" values="0.5;0.9;0.5" dur="3s" repeatCount="indefinite"/>}
        </circle>
        <circle cx="7"  cy="33" r="1"   fill="#FFD700" opacity="0.65"/>
        <circle cx="4"  cy="26" r="0.7" fill="#FFFFFF"  opacity="0.45"/>
      </g>

      {/* ══════════════════════════════════ */}
      {/* ── LOGOTYPE TEXT ─────────────── */}
      {/* ══════════════════════════════════ */}
      {effectiveText && (
        <g>
          {/* KRYPTON — bold, gradient, premium */}
          <text
            x="54" y="22"
            fontFamily="'Syne', 'DM Sans', system-ui, sans-serif"
            fontSize="15"
            fontWeight="800"
            letterSpacing="3"
            fill={`url(#${id}_txt)`}
          >
            KRYPTON
          </text>

          {/* AI — smaller, spaced, white-muted */}
          <text
            x="54" y="33"
            fontFamily="'DM Sans', system-ui, sans-serif"
            fontSize="8.5"
            fontWeight="500"
            letterSpacing="5.5"
            fill="rgba(255,255,255,0.52)"
          >
            ARTIFICIAL INTELLIGENCE
          </text>

          {/* Gradient underline accent */}
          <line
            x1="54" y1="37"
            x2={hovered && animated ? "198" : "147"} y2="37"
            stroke={`url(#${id}_txt)`}
            strokeWidth="0.75"
            opacity={hovered ? 0.65 : 0.22}
            style={{ transition:"x2 0.4s ease, opacity 0.3s ease" }}
          />
        </g>
      )}
    </svg>
  );
}

// ── Named convenience exports ──────────────────────────────────────
export function KryptonIcon({ size = 32, animated = true, onClick }: { size?: number; animated?: boolean; onClick?: () => void }) {
  return <KryptonLogo size={size} showText={false} animated={animated} onClick={onClick}/>;
}

export function KryptonFull({ size = 32, animated = true }: { size?: number; animated?: boolean }) {
  return <KryptonLogo size={size} showText={true} animated={animated}/>;
}

export function KryptonWordmark({ size = 28 }: { size?: number }) {
  return <KryptonLogo size={size} variant="full" animated={false}/>;
}
