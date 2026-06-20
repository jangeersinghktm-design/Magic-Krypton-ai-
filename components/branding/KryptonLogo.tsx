"use client";
/**
 * KRYPTON AI — Premium Brand Identity System v2
 *
 * Design philosophy: Precision node-network mark.
 * Represents intelligence, neural connection, and engineering precision.
 * No letterforms. No gold. No cartoon feeling.
 *
 * Inspired by: OpenAI, Anthropic, Linear, Stripe — geometric restraint.
 * Palette: Platinum / Silver on deep space background.
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

  const GAP_W  = 14;
  const TEXT_W = 118;
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
        transition:  animated ? "transform 0.25s cubic-bezier(0.16,1,0.3,1), opacity 0.2s ease" : "none",
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
        {/* Platinum → Silver gradient for nodes/edges */}
        <linearGradient id={`${uid}_g`} x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#F5F5F5"/>
          <stop offset="55%"  stopColor="#D9D9D9"/>
          <stop offset="100%" stopColor="#BFC5CC"/>
        </linearGradient>

        {/* Core node — brighter, the "intelligence" point */}
        <radialGradient id={`${uid}_core`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#FFFFFF"/>
          <stop offset="100%" stopColor="#D9D9D9"/>
        </radialGradient>

        {/* Wordmark gradient */}
        <linearGradient id={`${uid}_t`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#F5F5F5"/>
          <stop offset="100%" stopColor="#BFC5CC"/>
        </linearGradient>

        {/* Glow filter for hover state */}
        <filter id={`${uid}_glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.4" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* ═══════════════════════════════════════════════════ */}
      {/*  PRECISION NODE MARK                                */}
      {/*  3 outer nodes (neural inputs) connect to 1 core    */}
      {/*  node (intelligence) — asymmetric, engineered feel  */}
      {/* ═══════════════════════════════════════════════════ */}
      <g filter={hov && animated ? `url(#${uid}_glow)` : undefined} style={{ transition: "filter 0.25s ease" }}>
        {/* Connection edges — drawn first, beneath nodes */}
        <line x1="20" y1="20" x2="9"  y2="9"  stroke={`url(#${uid}_g)`} strokeWidth="1.4" strokeLinecap="round" opacity="0.55"/>
        <line x1="20" y1="20" x2="31" y2="9"  stroke={`url(#${uid}_g)`} strokeWidth="1.4" strokeLinecap="round" opacity="0.55"/>
        <line x1="20" y1="20" x2="9"  y2="31" stroke={`url(#${uid}_g)`} strokeWidth="1.4" strokeLinecap="round" opacity="0.55"/>
        <line x1="20" y1="20" x2="31" y2="31" stroke={`url(#${uid}_g)`} strokeWidth="1.4" strokeLinecap="round" opacity="0.55"/>

        {/* Outer ring — precision boundary */}
        <circle cx="20" cy="20" r="17.5" stroke={`url(#${uid}_g)`} strokeWidth="1" opacity="0.18" fill="none"/>

        {/* Four outer nodes */}
        <circle cx="9"  cy="9"  r="2.6" fill={`url(#${uid}_g)`}/>
        <circle cx="31" cy="9"  r="2.6" fill={`url(#${uid}_g)`}/>
        <circle cx="9"  cy="31" r="2.6" fill={`url(#${uid}_g)`}/>
        <circle cx="31" cy="31" r="2.6" fill={`url(#${uid}_g)`}/>

        {/* Core node — the intelligence point, larger + brighter */}
        <circle
          cx="20" cy="20"
          r={hov && animated ? 5.6 : 5}
          fill={`url(#${uid}_core)`}
          style={{ transition: "r 0.25s cubic-bezier(0.16,1,0.3,1)" }}
        />
        <circle cx="20" cy="20" r={hov && animated ? 5.6 : 5} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.6"
          style={{ transition: "r 0.25s cubic-bezier(0.16,1,0.3,1)" }}/>
      </g>

      {/* ═══════════════════════════════════════════════════ */}
      {/*  WORDMARK — KRYPTON AI                              */}
      {/* ═══════════════════════════════════════════════════ */}
      {hasText && (
        <g>
          <text
            x="54" y="25"
            fontFamily="'Inter', system-ui, sans-serif"
            fontSize="15"
            fontWeight="700"
            letterSpacing="1.2"
            fill={`url(#${uid}_t)`}
          >
            KRYPTON AI
          </text>
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
