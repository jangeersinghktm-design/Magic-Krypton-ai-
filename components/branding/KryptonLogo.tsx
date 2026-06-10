"use client";
// components/branding/KryptonLogo.tsx
// Krypton AI — Premium Brand Identity System
// Single source of truth for all logo usage across the platform

import { useState } from "react";

export type LogoVariant = "icon" | "full" | "minimal";

interface KryptonLogoProps {
  size?:      number;      // icon height in px (default: 32)
  showText?:  boolean;     // show "KRYPTON AI" text (default: false)
  animated?:  boolean;     // enable hover glow + gradient animation (default: true)
  variant?:   LogoVariant; // "icon" | "full" | "minimal" (default: "icon")
  className?: string;
  style?:     React.CSSProperties;
  onClick?:   () => void;
}

// ── Static unique ID for gradient defs (avoids SVG collision across instances)
let _idCounter = 0;

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
  const id = `kl${++_idCounter}`;

  // Effective showText based on variant
  const effectiveText = showText || variant === "full";
  const isMinimal     = variant === "minimal";

  // Scale factor for text positioning
  const textGap   = 10;
  const textWidth  = effectiveText ? size * 4.2 : 0;
  const totalW     = size + (effectiveText ? textGap + textWidth : 0);
  const viewBox    = `0 0 ${40 + (effectiveText ? textGap + 148 : 0)} 40`;

  // Glow intensity on hover
  const glowOpacity = hovered && animated ? 0.28 : 0.13;
  const glowScale   = hovered && animated ? 1.06 : 1;

  return (
    <svg
      width={totalW}
      height={size}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        flexShrink:  0,
        cursor:      onClick ? "pointer" : "default",
        transition:  "transform 0.25s ease",
        transform:   hovered && animated ? "scale(1.04)" : "scale(1)",
        ...style,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      aria-label="Krypton AI"
      role={onClick ? "button" : "img"}
    >
      <defs>
        {/* ── Core gradient: Gold → Amber → Orange ── */}
        <linearGradient id={`${id}_g1`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#FFD700"/>
          <stop offset="48%"  stopColor="#FFB000"/>
          <stop offset="100%" stopColor="#FF7A00"/>
          {animated && (
            <animateTransform
              attributeName="gradientTransform"
              type="rotate"
              from="0 0.5 0.5"
              to="360 0.5 0.5"
              dur="8s"
              repeatCount="indefinite"
            />
          )}
        </linearGradient>

        {/* ── Bright hover gradient ── */}
        <linearGradient id={`${id}_g2`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#FFE566"/>
          <stop offset="50%"  stopColor="#FFB000"/>
          <stop offset="100%" stopColor="#FF5500"/>
        </linearGradient>

        {/* ── Top-left shine ── */}
        <linearGradient id={`${id}_shine`} x1="0.1" y1="0" x2="0.5" y2="1">
          <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.55"/>
          <stop offset="55%"  stopColor="#FFFFFF" stopOpacity="0.06"/>
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0"/>
        </linearGradient>

        {/* ── Text gradient ── */}
        <linearGradient id={`${id}_txt`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#FFD700"/>
          <stop offset="60%"  stopColor="#FFB000"/>
          <stop offset="100%" stopColor="rgba(255,255,255,0.8)"/>
        </linearGradient>

        {/* ── Outer glow filter ── */}
        <filter id={`${id}_glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={hovered ? 3 : 2} result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        {/* ── Sparkle glow filter ── */}
        <filter id={`${id}_sp`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.2"/>
        </filter>

        {/* ── Inner depth filter ── */}
        <filter id={`${id}_inner`}>
          <feGaussianBlur stdDeviation="0.4"/>
        </filter>

        {/* ── Clip path for hexagon ── */}
        <clipPath id={`${id}_clip`}>
          <path d="M20 3.5L34.8 12V28L20 36.5L5.2 28V12Z"/>
        </clipPath>
      </defs>

      {/* ══════════════════════════════════════ */}
      {/* ── LOGO ICON ──────────────────────── */}
      {/* ══════════════════════════════════════ */}

      {/* Outer ambient glow ring */}
      <path
        d="M20 1L37.3 10.5V29.5L20 39L2.7 29.5V10.5Z"
        fill={`url(#${id}_g1)`}
        opacity={glowOpacity}
        filter={`url(#${id}_glow)`}
        style={{ transition:"opacity 0.3s ease" }}
      />

      {/* ── Main hexagon body ── */}
      <path
        d="M20 3.5L34.8 12V28L20 36.5L5.2 28V12Z"
        fill={hovered && animated ? `url(#${id}_g2)` : `url(#${id}_g1)`}
        style={{ transition:"fill 0.3s ease" }}
      />

      {/* ── Inner hexagon border ring (depth) ── */}
      <path
        d="M20 6L32.4 13V27L20 34L7.6 27V13Z"
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="0.7"
      />

      {/* ── Premium shine (top-left light reflection) ── */}
      <path
        d="M20 3.5L34.8 12V22H5.2V12Z"
        fill={`url(#${id}_shine)`}
      />

      {/* ── Subtle inner bottom shadow ── */}
      <path
        d="M5.2 24L20 32.5L34.8 24V28L20 36.5L5.2 28Z"
        fill="rgba(0,0,0,0.12)"
      />

      {/* ── K LETTERMARK (precise geometric path) ── */}
      {!isMinimal && (
        <g clipPath={`url(#${id}_clip)`}>
          {/* Vertical bar of K */}
          <rect x="11" y="12" width="4.5" height="16" rx="0.5" fill="#050505" opacity="0.88"/>
          {/* Top arm of K */}
          <path
            d="M15.5 20L23.5 12H29L20 20.5"
            stroke="#050505"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity="0.88"
          />
          {/* Bottom arm of K */}
          <path
            d="M15.5 21L23.5 29H29L20 20.5"
            stroke="#050505"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity="0.88"
          />
        </g>
      )}

      {/* ── Minimal variant: just dot ── */}
      {isMinimal && (
        <circle cx="20" cy="20" r="4" fill="#050505" opacity="0.8"/>
      )}

      {/* ── AI Sparkle system (3 dots) ── */}
      <g filter={`url(#${id}_sp)`}>
        <circle
          cx="33" cy="8" r={hovered ? 2.2 : 1.8}
          fill="#FFE566" opacity={hovered ? 1 : 0.85}
          style={{ transition:"all 0.3s ease" }}
        >
          {animated && <animate attributeName="r" values="1.6;2.2;1.6" dur="2.5s" repeatCount="indefinite"/>}
        </circle>
        <circle
          cx="36" cy="15" r="1.2"
          fill="#FF8C00" opacity={hovered ? 0.9 : 0.7}
          style={{ transition:"opacity 0.3s ease" }}
        >
          {animated && <animate attributeName="opacity" values="0.5;0.9;0.5" dur="3s" repeatCount="indefinite"/>}
        </circle>
        <circle cx="7" cy="33" r="1"   fill="#FFD700" opacity="0.65"/>
        <circle cx="4" cy="26" r="0.7" fill="#FFFFFF"  opacity="0.45"/>
      </g>

      {/* ══════════════════════════════════════ */}
      {/* ── LOGOTYPE TEXT ───────────────────── */}
      {/* ══════════════════════════════════════ */}
      {effectiveText && (
        <g>
          {/* KRYPTON */}
          <text
            x="50"
            y="25"
            fontFamily="'Syne', 'DM Sans', system-ui, sans-serif"
            fontSize="15"
            fontWeight="800"
            letterSpacing="2"
            fill={`url(#${id}_txt)`}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            KRYPTON
          </text>
          {/* AI — smaller, muted */}
          <text
            x="147"
            y="25"
            fontFamily="'DM Sans', system-ui, sans-serif"
            fontSize="11"
            fontWeight="400"
            letterSpacing="2.5"
            fill="rgba(255,255,255,0.38)"
          >
            AI
          </text>
          {/* Subtle underline accent */}
          <line
            x1="50" y1="29"
            x2={hovered ? "178" : "147"} y2="29"
            stroke={`url(#${id}_txt)`}
            strokeWidth="0.6"
            opacity={hovered ? 0.6 : 0.2}
            style={{ transition:"x2 0.4s ease, opacity 0.3s ease" }}
          />
        </g>
      )}
    </svg>
  );
}

// ── Named exports for convenience ─────────────────────────────────
export function KryptonIcon({ size = 32, animated = true, onClick }: { size?: number; animated?: boolean; onClick?: () => void }) {
  return <KryptonLogo size={size} showText={false} animated={animated} onClick={onClick}/>;
}

export function KryptonFull({ size = 32, animated = true }: { size?: number; animated?: boolean }) {
  return <KryptonLogo size={size} showText={true} animated={animated}/>;
}

export function KryptonWordmark({ size = 28 }: { size?: number }) {
  return <KryptonLogo size={size} variant="full" animated={false}/>;
      }

