"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useGame } from "@/contexts/game-context"
import type { GameScreen } from "@/components/game/game-wrapper"
import {
  Swords, Bot, Users, Gift, BookOpen, Hammer, History, Settings,
  Coins, X, Sparkles, Star, Target, Shield,
} from "lucide-react"
import Image from "next/image"
import dynamic from "next/dynamic"
import { loadMastersFromStorage } from "@/lib/masters-data"

const MasterMenuCard = dynamic(
  () => import("./master-screen").then(m => ({ default: m.MasterMenuCard })),
  { ssr: false, loading: () => null }
)

const GP_CSS = `
@keyframes gp-conic-spin { to { transform: rotate(360deg); } }

/* Anel girando – roxo/pink – para avatar e gift */
.gp-conic-ring {
  position: absolute; border-radius: inherit;
  background: conic-gradient(
    rgba(232,121,249,0.75) 0deg,
    rgba(139,92,246,0.75) 90deg,
    rgba(56,189,248,0.65) 180deg,
    rgba(167,139,250,0.75) 270deg,
    rgba(232,121,249,0.75) 360deg
  );
  animation: gp-conic-spin 4s linear infinite;
  z-index: 0;
}
/* Anel girando – dourado – para botão MESTRE */
.gp-conic-ring-gold {
  position: absolute; border-radius: inherit;
  background: conic-gradient(
    rgba(252,211,77,0.8) 0deg,
    rgba(245,158,11,0.6) 90deg,
    rgba(234,179,8,0.8) 180deg,
    rgba(252,211,77,0.6) 270deg,
    rgba(252,211,77,0.8) 360deg
  );
  animation: gp-conic-spin 3.5s linear infinite;
  z-index: 0;
}
/* Anel girando – lento roxo – para botões sidebar */
.gp-conic-ring-slow {
  position: absolute; border-radius: inherit;
  background: conic-gradient(
    rgba(139,92,246,0.45) 0deg,
    rgba(232,121,249,0.35) 90deg,
    rgba(56,189,248,0.45) 180deg,
    rgba(139,92,246,0.35) 270deg,
    rgba(139,92,246,0.45) 360deg
  );
  animation: gp-conic-spin 6s linear infinite;
  z-index: 0;
}

/* Cantos decorativos HUD */
.gp-corner { position: fixed; width: 20px; height: 20px; border-color: rgba(139,92,246,0.22); border-style: solid; z-index: 5; pointer-events: none; }
.gp-corner-tl { top: 10px; left: 10px; border-width: 2px 0 0 2px; }
.gp-corner-tr { top: 10px; right: 72px; border-width: 2px 2px 0 0; }
.gp-corner-bl { bottom: 84px; left: 10px; border-width: 0 0 2px 2px; }
.gp-corner-br { bottom: 84px; right: 72px; border-width: 0 2px 2px 0; }

/* Background sutil */
@keyframes gp-bgb { 0%,100%{filter:brightness(1);} 50%{filter:brightness(1.05);} }
.gp-wbg { animation: gp-bgb 8s ease-in-out infinite; }

/* Sidebar buttons */
.gp-sb {
  contain: layout style;
  width: 54px; padding: 8px 0;
  background: rgba(5,2,18,0.88);
  border: 1px solid rgba(124,58,237,0.18);
  border-radius: 14px;
  cursor: pointer;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  transition: all .25s ease;
  position: relative; overflow: hidden;
}
.gp-sb::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2.5px;
  background: rgba(139,92,246,0.9);
  transform: scaleY(0); transform-origin: center;
  transition: transform .25s ease;
}
.gp-sb:hover { background: rgba(10,5,32,0.95); border-color: rgba(139,92,246,0.42); transform: translateX(-2px); box-shadow: 3px 0 18px rgba(124,58,237,0.2); }
.gp-sb:hover::before { transform: scaleY(1); }
.gp-sb svg { width: 23px; height: 23px; color: rgba(167,139,250,0.82); transition: color .25s; }
.gp-sb:hover svg { color: rgba(196,165,250,1); filter: drop-shadow(0 0 5px rgba(167,139,250,0.5)); }
.gp-sb-lbl { font-size: 9.5px; font-weight: 800; letter-spacing: 1.1px; text-transform: uppercase; color: rgba(109,40,217,0.75); transition: color .25s; font-family: inherit; }
.gp-sb:hover .gp-sb-lbl { color: rgba(139,92,246,0.95); }
.gp-sb.gp-gold { background: rgba(12,7,2,0.88); border-color: rgba(245,158,11,0.25); }
.gp-sb.gp-gold::before { background: rgba(245,158,11,0.9); }
.gp-sb.gp-gold:hover { border-color: rgba(245,158,11,0.55); box-shadow: 3px 0 18px rgba(245,158,11,0.2); }
.gp-sb.gp-gold svg { color: rgba(252,211,77,0.9); }
.gp-sb.gp-gold .gp-sb-lbl { color: rgba(245,158,11,0.8); }

/* Bottom nav – levemente escuro */
.gp-nav-wrap {
  background: linear-gradient(180deg, rgba(3,1,18,0.65) 0%, rgba(3,1,18,0.96) 100%);
  backdrop-filter: blur(24px);
  border-top: 1px solid transparent;
}
@keyframes gp-navline-run {
  0%   { background-position: -100% 0; }
  100% { background-position: 200% 0; }
}
.gp-nav-line {
  position: absolute; top: 0; left: 0; right: 0; height: 1.5px;
  background: linear-gradient(90deg,
    transparent 0%, rgba(109,40,217,0) 8%,
    rgba(139,92,246,0.55) 22%, rgba(196,132,252,0.85) 35%,
    rgba(255,255,255,0.9) 50%,
    rgba(232,121,249,0.85) 65%, rgba(139,92,246,0.55) 78%,
    rgba(109,40,217,0) 92%, transparent 100%
  );
  background-size: 200% 100%;
  animation: gp-navline-run 4s linear infinite;
  box-shadow: 0 0 10px rgba(167,139,250,0.4), 0 0 22px rgba(139,92,246,0.18);
}
/* Nav separators between items */
.gp-ni + .gp-ni::before {
  content: '';
  position: absolute; left: 0; top: 20%; bottom: 20%;
  width: 1px;
  background: linear-gradient(180deg, transparent, rgba(139,92,246,0.25), transparent);
}
/* Active deck badge above JOGAR */
@keyframes gp-deck-holo {
  0%,100% { background-position: 0% 50%; }
  50%     { background-position: 100% 50%; }
}
.gp-deck-badge {
  background: linear-gradient(115deg,
    rgba(6,18,60,0.90) 0%, rgba(14,40,120,0.88) 35%,
    rgba(30,64,175,0.82) 60%, rgba(14,40,120,0.88) 80%, rgba(6,18,60,0.90) 100%
  );
  background-size: 250% 250%;
  animation: gp-deck-holo 4s ease infinite;
  border: 1.5px solid rgba(96,165,250,0.62);
  box-shadow: 0 2px 14px rgba(59,130,246,0.28), inset 0 1px 0 rgba(147,197,253,0.12);
  backdrop-filter: blur(10px);
  border-radius: 10px;
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px 6px 8px;
  cursor: pointer; transition: all .22s;
  width: 440px;
}
.gp-deck-badge:hover {
  border-color: rgba(147,197,253,0.85);
  box-shadow: 0 4px 22px rgba(59,130,246,0.42), inset 0 1px 0 rgba(147,197,253,0.18);
  transform: translateY(-1px);
}
.gp-deck-badge-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  box-shadow: 0 0 6px rgba(96,165,250,0.8);
  flex-shrink: 0;
  animation: gp-play-aura 2s ease-in-out infinite;
}
/* ══ ENTRANCE ANIMATION — zoom-out impact, no position shift, no flash ══ */
@keyframes gp-enter-scene {
  0%   { opacity: 0;   transform: scale(1.22); }
  18%  { opacity: 1;   transform: scale(1.22); }
  65%  { opacity: 1;   transform: scale(1.004); }
  82%  { transform: scale(0.9985); }
  100% { opacity: 1;   transform: scale(1); }
}
@keyframes gp-enter-ui {
  0%   { opacity: 0; }
  25%  { opacity: 0; }
  75%  { opacity: 1; }
  100% { opacity: 1; }
}
@keyframes gp-enter-btn {
  0%   { opacity: 0; transform: scale(0.88); }
  28%  { opacity: 0; transform: scale(0.88); }
  72%  { opacity: 1; transform: scale(1.032); }
  88%  { transform: scale(0.992); }
  100% { opacity: 1; transform: scale(1); }
}

.gp-anim-bg      { animation: gp-enter-scene 0.82s cubic-bezier(0.16,1,0.3,1) both; }
.gp-anim-hud     { animation: gp-enter-ui    0.82s ease both; }
.gp-anim-sidebar { animation: gp-enter-ui    0.82s ease both; }
.gp-anim-nav     { animation: gp-enter-ui    0.82s ease both; }
.gp-anim-music   { animation: gp-enter-ui    0.82s ease both; }
.gp-anim-master  { animation: gp-enter-ui    0.82s ease both; }
.gp-anim-ui-btns { animation: gp-enter-ui    0.82s ease both; }

/* Nav item active glow */
.gp-ni:hover .gp-ni-lbl { color: rgba(167,139,250,0.95); text-shadow: 0 0 8px rgba(139,92,246,0.5); }

/* Master art panel */
@keyframes gp-master-in {
  from { opacity: 0; transform: translateX(18px) scale(0.97); }
  to   { opacity: 1; transform: translateX(0) scale(1); }
}
@keyframes gp-master-float {
  0%,100% { transform: translateY(0px); }
  50%     { transform: translateY(-8px); }
}
.gp-master-art {
  animation: gp-master-in 0.55s cubic-bezier(0.22,1,0.36,1) both,
             gp-master-float 5s ease-in-out 0.6s infinite;
  filter: drop-shadow(0 0 22px rgba(139,92,246,0.45)) drop-shadow(0 0 44px rgba(109,40,217,0.22));
  will-change: transform;
}
.gp-master-art-wrap {
  position: fixed; z-index: 20;
  bottom: 74px; right: 70px;
  width: 310px; height: 480px;
  pointer-events: all;
  cursor: pointer;
}
.gp-master-art-wrap::after {
  content: '';
  position: absolute; bottom: 0; left: 10%; right: 10%; height: 60px;
  background: radial-gradient(ellipse at 50% 100%, rgba(139,92,246,0.28) 0%, transparent 72%);
  filter: blur(8px);
  pointer-events: none;
}
/* Tap wrapper: ripple glow, no transform on the image itself */
@keyframes gp-master-tap-ring {
  0%   { box-shadow: 0 0 0 0 rgba(139,92,246,0.55); opacity: 1; }
  100% { box-shadow: 0 0 0 38px rgba(139,92,246,0); opacity: 0; }
}
@keyframes gp-master-tap-scale {
  0%   { transform: scale(1); }
  35%  { transform: scale(1.035); }
  100% { transform: scale(1); }
}
/* Applied to the inner art wrapper only — doesn't reset float/entry */
.gp-master-tap-wrap { animation: gp-master-tap-scale 0.35s ease-in-out both; }
/* Glow ring: absolutely positioned, doesn't affect layout */
.gp-master-tap-ring {
  position: absolute; inset: 0; border-radius: 50%; pointer-events: none; z-index: 5;
  animation: gp-master-tap-ring 0.55s ease-out both;
}

/* Manga speech bubble */
@keyframes gp-bubble-in {
  0%   { opacity:0; transform: scale(0.82) translateY(8px); }
  65%  { opacity:1; transform: scale(1.02) translateY(-1px); }
  100% { opacity:1; transform: scale(1) translateY(0); }
}
@keyframes gp-bubble-out {
  0%   { opacity:1; }
  100% { opacity:0; transform: translateY(4px); }
}
.gp-bubble {
  /* Bottom-left of character art: near mouth level */
  position: absolute;
  bottom: 145px;   /* near hands/waist area */
  left: -200px;
  width: 192px;
  background: #fff;
  border: 2.5px solid #111;
  border-radius: 14px 14px 14px 4px;
  padding: 9px 12px 9px 12px;
  box-shadow: 3px 3px 0 #111;
  z-index: 30;
  animation: gp-bubble-in 0.32s cubic-bezier(0.22,1,0.36,1) both;
  pointer-events: none;
  /* Keep bubble above its sibling overflow */
  overflow: visible;
}
.gp-bubble.out { animation: gp-bubble-out 0.22s ease-in both; }

/* Tail: separate element so it is truly OUTSIDE the bubble box */
.gp-bubble-tail {
  position: absolute;
  /* sits to the right of the bubble, pointing right toward the character */
  right: -20px;
  bottom: 16px;
  width: 0; height: 0;
  /* Outer border (stroke) */
  border-top: 10px solid transparent;
  border-bottom: 10px solid transparent;
  border-left: 20px solid #111;
  pointer-events: none;
}
.gp-bubble-tail::after {
  content: '';
  position: absolute;
  top: -8px; left: -22px;
  width: 0; height: 0;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
  border-left: 18px solid #fff;
}

.gp-bubble-text {
  font-size: 12.5px; line-height: 1.5;
  color: #111; font-weight: 700; letter-spacing: 0.2px;
  font-family: 'Geist', 'Inter', sans-serif;
}
/* Micro-animations on sidebar */
.gp-sb:active { transform: translateX(-2px) scale(0.96); }
.gp-ni {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 5px; padding: 11px 4px 9px; background: transparent; border: none;
  cursor: pointer; position: relative; transition: background .2s;
  outline: none;
}
/* Active glow line at bottom */
.gp-ni::after {
  content: ''; position: absolute; bottom: 0; left: 15%; right: 15%; height: 2.5px;
  background: linear-gradient(90deg, transparent, rgba(167,139,250,0.9), rgba(232,121,249,1), rgba(167,139,250,0.9), transparent);
  transform: scaleX(0); transition: transform .22s cubic-bezier(0.22,1,0.36,1);
  border-radius: 1px 1px 0 0;
  box-shadow: 0 0 10px rgba(167,139,250,0.6), 0 0 20px rgba(139,92,246,0.25);
}
.gp-ni:hover::after { transform: scaleX(1); }
/* Active bg glow */
.gp-ni:hover {
  background: linear-gradient(180deg, rgba(124,58,237,0.06) 0%, rgba(139,92,246,0.12) 100%);
}
/* Icon transitions */
.gp-ni svg {
  color: rgba(109,40,217,0.62); transition: all .22s;
  filter: none;
  width: 27px; height: 27px;
}
.gp-ni:hover svg {
  color: rgba(192,132,252,1);
  filter: drop-shadow(0 0 7px rgba(167,139,250,0.6)) drop-shadow(0 0 14px rgba(139,92,246,0.3));
  transform: translateY(-2px) scale(1.08);
}
/* Label */
.gp-ni-lbl {
  font-size: 10px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase;
  color: rgba(109,40,217,0.52); transition: all .22s; font-family: inherit;
}
.gp-ni:hover .gp-ni-lbl {
  color: rgba(192,132,252,1);
  text-shadow: 0 0 8px rgba(139,92,246,0.5);
}
/* Luminous separator between items */
.gp-ni + .gp-ni::before {
  content: '';
  position: absolute; left: 0; top: 22%; bottom: 22%;
  width: 1px;
  background: linear-gradient(180deg, transparent, rgba(139,92,246,0.22), rgba(139,92,246,0.32), rgba(139,92,246,0.22), transparent);
  box-shadow: 0 0 4px rgba(139,92,246,0.12);
}

/* ── JOGAR — energetic overhaul ── */
@keyframes gp-play-bg {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes gp-play-aura {
  0%,100% {
    box-shadow:
      0 0 22px 3px rgba(59,130,246,0.55),
      0 0 55px 8px rgba(29,78,216,0.28),
      0 0 110px 14px rgba(99,179,237,0.12),
      inset 0 0 22px rgba(147,197,253,0.08);
  }
  50% {
    box-shadow:
      0 0 38px 6px rgba(96,165,250,0.80),
      0 0 80px 14px rgba(59,130,246,0.42),
      0 0 150px 22px rgba(147,197,253,0.18),
      inset 0 0 32px rgba(147,197,253,0.14);
  }
}
@keyframes gp-play-scan {
  0%   { transform: translateX(-100%) skewX(-18deg); }
  100% { transform: translateX(300%) skewX(-18deg); }
}
@keyframes gp-play-holo {
  0%   { opacity: 0.06; background-position: 0% 0%; }
  50%  { opacity: 0.14; background-position: 100% 100%; }
  100% { opacity: 0.06; background-position: 0% 0%; }
}
@keyframes gp-play-border-run {
  0%   { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}
.gp-play-btn {
  will-change: box-shadow, transform;
  background: linear-gradient(135deg,
    #020c3a 0%, #0a1e7a 18%, #1d4ed8 38%,
    #3b82f6 52%, #1d4ed8 66%, #0a1e7a 82%, #020c3a 100%
  );
  background-size: 300% 300%;
  animation: gp-play-bg 5s ease infinite, gp-play-aura 2.4s ease-in-out infinite;
  border: none;
  outline: none;
  clip-path: polygon(0 0, 100% 0, 100% 80%, 89% 100%, 0 100%);
  position: relative; overflow: hidden;
  transition: transform .2s ease, filter .2s ease;
  filter: brightness(1);
  /* Animated border via pseudo-element */
}
/* Running border glow */
.gp-play-btn::before {
  content: '';
  position: absolute; inset: 0;
  clip-path: inherit;
  background: linear-gradient(90deg,
    transparent 0%, rgba(147,197,253,0) 30%,
    rgba(219,234,254,1) 50%, rgba(147,197,253,0) 70%, transparent 100%
  );
  background-size: 200% 100%;
  animation: gp-play-border-run 2s linear infinite;
  pointer-events: none;
  z-index: 1;
  /* Fake border: mask to thin lines only */
  -webkit-mask: linear-gradient(#fff,#fff) top/100% 2.5px no-repeat,
                linear-gradient(#fff,#fff) bottom/100% 2.5px no-repeat,
                linear-gradient(#fff,#fff) left/2.5px 100% no-repeat,
                linear-gradient(#fff,#fff) right/2.5px 100% no-repeat;
  mask: linear-gradient(#fff,#fff) top/100% 2.5px no-repeat,
        linear-gradient(#fff,#fff) bottom/100% 2.5px no-repeat,
        linear-gradient(#fff,#fff) left/2.5px 100% no-repeat,
        linear-gradient(#fff,#fff) right/2.5px 100% no-repeat;
}
/* Scan flash */
.gp-play-btn::after {
  content: '';
  position: absolute; top: 0; bottom: 0; left: 0; width: 45%;
  background: linear-gradient(90deg, transparent 0%, rgba(147,197,253,0.32) 50%, transparent 100%);
  animation: gp-play-scan 2.8s ease-in-out infinite;
  pointer-events: none; z-index: 2;
}
/* Holographic overlay */
.gp-play-holo {
  position: absolute; inset: 0; pointer-events: none; z-index: 3;
  background: repeating-linear-gradient(
    58deg,
    rgba(147,197,253,0.08) 0px, rgba(147,197,253,0.08) 1px,
    transparent 1px, transparent 6px
  );
  animation: gp-play-holo 4s ease-in-out infinite;
}
.gp-play-btn:hover {
  transform: scale(1.028) translateY(-1px);
  filter: brightness(1.15);
}
.gp-play-btn:hover::after {
  animation-duration: 1.2s;
}
/* Canvas particles placeholder — handled via JS canvas */

/* ── COLEÇÃO (white/crystal — animated like JOGAR) ── */
@keyframes gp-col-bg {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes gp-col-aura {
  0%,100% { box-shadow: 0 0 18px 2px rgba(226,232,240,0.45), 0 0 45px 6px rgba(255,255,255,0.12), inset 0 0 18px rgba(255,255,255,0.06); }
  50%      { box-shadow: 0 0 32px 5px rgba(226,232,240,0.70), 0 0 70px 12px rgba(255,255,255,0.20), inset 0 0 28px rgba(255,255,255,0.10); }
}
@keyframes gp-col-scan {
  0%   { transform: translateX(-100%) skewX(-18deg); }
  100% { transform: translateX(300%) skewX(-18deg); }
}
@keyframes gp-col-border-run {
  0%   { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}
.gp-col-btn {
  will-change: box-shadow, transform;
  filter: drop-shadow(0 6px 22px rgba(0,0,0,0.65));
  background: linear-gradient(135deg,
    rgba(200,220,255,0.52) 0%, rgba(240,248,255,0.62) 25%,
    rgba(255,255,255,0.72) 50%, rgba(240,248,255,0.62) 75%, rgba(200,220,255,0.52) 100%
  );
  background-size: 300% 300%;
  border: 2.5px solid rgba(255,255,255,1);
  box-shadow: 0 0 18px rgba(255,255,255,0.28), inset 0 1px 0 rgba(255,255,255,0.5);
  outline: none;
  animation: gp-col-bg 5s ease infinite, gp-col-aura 2.8s ease-in-out infinite;
  backdrop-filter: blur(10px);
  position: relative; overflow: hidden;
  transition: transform .2s ease, filter .2s ease;
}
.gp-col-btn::before {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(90deg,
    transparent 0%, rgba(255,255,255,0) 30%,
    rgba(255,255,255,1) 50%, rgba(255,255,255,0) 70%, transparent 100%
  );
  background-size: 200% 100%;
  animation: gp-col-border-run 2.2s linear infinite;
  pointer-events: none; z-index: 1;
  -webkit-mask: linear-gradient(#fff,#fff) top/100% 2.5px no-repeat,
                linear-gradient(#fff,#fff) bottom/100% 2.5px no-repeat,
                linear-gradient(#fff,#fff) left/2.5px 100% no-repeat,
                linear-gradient(#fff,#fff) right/2.5px 100% no-repeat;
  mask: linear-gradient(#fff,#fff) top/100% 2.5px no-repeat,
        linear-gradient(#fff,#fff) bottom/100% 2.5px no-repeat,
        linear-gradient(#fff,#fff) left/2.5px 100% no-repeat,
        linear-gradient(#fff,#fff) right/2.5px 100% no-repeat;
}
.gp-col-btn::after {
  content: '';
  position: absolute; top: 0; bottom: 0; left: 0; width: 45%;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.38) 50%, transparent 100%);
  animation: gp-col-scan 3s ease-in-out infinite;
  pointer-events: none; z-index: 2;
}
.gp-col-holo {
  position: absolute; inset: 0; pointer-events: none; z-index: 3;
  background: repeating-linear-gradient(
    58deg,
    rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px,
    transparent 1px, transparent 6px
  );
  animation: gp-play-holo 4s ease-in-out infinite;
}
.gp-col-btn:hover {
  transform: scale(1.028) translateY(-1px);
  filter: brightness(1.12) drop-shadow(0 4px 16px rgba(0,0,0,0.55));
}
.gp-col-btn:hover::after { animation-duration: 1.4s; }

/* ── GACHA (rose neon — animated like JOGAR) ── */
@keyframes gp-gacha-bg {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes gp-gacha-aura {
  0%,100% { box-shadow: 0 0 22px 3px rgba(236,72,153,0.55), 0 0 55px 8px rgba(217,70,239,0.20), inset 0 0 22px rgba(249,168,212,0.06); }
  50%      { box-shadow: 0 0 38px 6px rgba(236,72,153,0.80), 0 0 88px 14px rgba(217,70,239,0.36), inset 0 0 32px rgba(249,168,212,0.12); }
}
@keyframes gp-gacha-scan {
  0%   { transform: translateX(-100%) skewX(-18deg); }
  100% { transform: translateX(300%) skewX(-18deg); }
}
@keyframes gp-gacha-border-run {
  0%   { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}
.gp-gacha-btn {
  will-change: box-shadow, transform;
  filter: drop-shadow(0 4px 16px rgba(0,0,0,0.55));
  background: linear-gradient(135deg,
    #3d0220 0%, #7a0a3a 18%, #be185d 38%,
    #ec4899 52%, #be185d 66%, #7a0a3a 82%, #3d0220 100%
  );
  background-size: 300% 300%;
  border: none; outline: none;
  animation: gp-gacha-bg 5s ease infinite, gp-gacha-aura 2.4s ease-in-out infinite;
  backdrop-filter: blur(18px);
  position: relative; overflow: hidden;
  transition: transform .2s ease, filter .2s ease;
}
.gp-gacha-btn::before {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(90deg,
    transparent 0%, rgba(249,168,212,0) 30%,
    rgba(255,200,230,1) 50%, rgba(249,168,212,0) 70%, transparent 100%
  );
  background-size: 200% 100%;
  animation: gp-gacha-border-run 2s linear infinite;
  pointer-events: none; z-index: 1;
  -webkit-mask: linear-gradient(#fff,#fff) top/100% 2.5px no-repeat,
                linear-gradient(#fff,#fff) bottom/100% 2.5px no-repeat,
                linear-gradient(#fff,#fff) left/2.5px 100% no-repeat,
                linear-gradient(#fff,#fff) right/2.5px 100% no-repeat;
  mask: linear-gradient(#fff,#fff) top/100% 2.5px no-repeat,
        linear-gradient(#fff,#fff) bottom/100% 2.5px no-repeat,
        linear-gradient(#fff,#fff) left/2.5px 100% no-repeat,
        linear-gradient(#fff,#fff) right/2.5px 100% no-repeat;
}
.gp-gacha-btn::after {
  content: '';
  position: absolute; top: 0; bottom: 0; left: 0; width: 45%;
  background: linear-gradient(90deg, transparent 0%, rgba(249,168,212,0.38) 50%, transparent 100%);
  background-size: 280% 100%;
  animation: gp-play-scan 5s linear infinite;
  pointer-events: none;
}
.gp-gacha-btn:hover {
  border-color: rgba(253,186,221,1);
  transform: scale(1.035);
  background: linear-gradient(140deg,
    rgba(130,15,70,0.96) 0%,
    rgba(190,30,100,0.92) 35%,
    rgba(236,72,153,0.88) 65%,
    rgba(140,15,75,0.96) 100%
  );
}

/* Stamina pulse */
@keyframes gp-stam { 0%,100%{opacity:1;} 50%{opacity:.82;} }
.gp-stam-fill { animation: gp-stam 2.5s ease-in-out infinite; }

/* Logo float */
@keyframes gp-logo-f { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-2px);} }
.gp-logo { animation: gp-logo-f 4s ease-in-out infinite; filter: drop-shadow(0 0 12px rgba(139,92,246,0.42)); }

/* Falling cards */
@keyframes fallingCard { 0%{transform:translateY(-120px) rotate(-8deg);opacity:0;} 5%{opacity:1;} 95%{opacity:0.55;} 100%{transform:translateY(calc(100vh + 140px)) rotate(12deg);opacity:0;} }
@keyframes cardSway    { 0%,100%{transform:translateX(-18px);} 50%{transform:translateX(18px);} }
@keyframes cardFlipSpin{ 0%{transform:rotateY(0deg);} 45%{transform:rotateY(0deg);} 55%{transform:rotateY(180deg);} 100%{transform:rotateY(180deg);} }
@keyframes cardHoloShift{ 0%,100%{opacity:0.05;} 50%{opacity:0.18;} }

/* ── Music Player ── */
@keyframes gp-disc-spin { to { transform: rotate(360deg); } }
.gp-disc {
  will-change: transform;
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
  background: conic-gradient(
    rgba(139,92,246,0.9) 0deg, rgba(232,121,249,0.85) 90deg,
    rgba(56,189,248,0.8) 180deg, rgba(167,139,250,0.9) 270deg,
    rgba(139,92,246,0.9) 360deg
  );
  animation: gp-disc-spin 2.8s linear infinite;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 10px rgba(139,92,246,0.45);
}
.gp-disc-inner {
  width: 11px; height: 11px; border-radius: 50%;
  background: rgba(4,2,16,0.95);
  border: 1px solid rgba(139,92,246,0.4);
}
.gp-disc.paused { animation-play-state: paused; }
.gp-music-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 10px 5px 6px;
  background: rgba(4,2,16,0.88);
  border: 1px solid rgba(139,92,246,0.22);
  border-radius: 20px;
  cursor: pointer;
  transition: border-color .25s, background .25s;
  overflow: hidden;
  max-width: 230px;
}
.gp-music-bar:hover { border-color: rgba(139,92,246,0.5); background: rgba(8,4,28,0.94); }
.gp-music-bar::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px;
  background: linear-gradient(180deg, rgba(232,121,249,0.8), rgba(139,92,246,0.8));
  border-radius: 1px;
}
.gp-music-title {
  font-size: 9.5px; font-weight: 700; letter-spacing: 0.8px;
  color: rgba(196,165,250,0.9); white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; max-width: 140px;
  text-transform: uppercase;
}
.gp-music-sub {
  font-size: 7.5px; font-weight: 600; letter-spacing: 1px;
  color: rgba(109,40,217,0.65); text-transform: uppercase;
}
@keyframes gp-music-scroll {
  0%   { transform: translateX(0); }
  40%  { transform: translateX(-50%); }
  50%  { transform: translateX(-50%); }
  90%  { transform: translateX(0); }
  100% { transform: translateX(0); }
}
.gp-music-scroll { animation: gp-music-scroll 8s linear infinite; display: inline-block; white-space: nowrap; }

/* Track selector mini-panel */
.gp-music-panel {
  position: fixed; z-index: 200;
  background: rgba(3,1,14,0.97);
  border: 1px solid rgba(139,92,246,0.3);
  border-radius: 16px;
  box-shadow: 0 0 40px rgba(124,58,237,0.25), 0 12px 40px rgba(0,0,0,0.7);
  backdrop-filter: blur(20px);
  padding: 16px;
  width: 260px;
}
.gp-track-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px; border-radius: 10px; cursor: pointer;
  border: 1px solid transparent;
  transition: all .2s;
}
.gp-track-item:hover { background: rgba(124,58,237,0.12); border-color: rgba(139,92,246,0.25); }
.gp-track-item.active { background: rgba(109,40,217,0.18); border-color: rgba(139,92,246,0.45); }
.gp-track-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.gp-track-name { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; color: rgba(196,165,250,0.9); }
.gp-track-name.active { color: rgba(232,121,249,1); }
.gp-track-sub { font-size: 9px; color: rgba(109,40,217,0.6); letter-spacing: 0.5px; }

/* Misc */
.rarity-lr{box-shadow:0 0 20px rgba(239,68,68,0.5),0 0 40px rgba(251,191,36,0.3);border:2px solid #fbbf24;}
.rarity-ur{box-shadow:0 0 18px rgba(245,158,11,0.5);border:2px solid #f59e0b;}
.rarity-sr{box-shadow:0 0 16px rgba(168,85,247,0.5);border:2px solid #a855f7;}
.rarity-r{box-shadow:0 0 10px rgba(148,163,184,0.3);border:2px solid #94a3b8;}
.gacha-btn{transition:all .2s;}
.gacha-btn:hover{transform:scale(1.02);filter:brightness(1.1);}
.gacha-btn:active{transform:scale(0.98);}
@keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}
.animate-float{animation:float 3s ease-in-out infinite;}
.aura-logo{filter:drop-shadow(0 0 12px rgba(139,92,246,0.5));}
`

const CARD_THEMES = [
  { bg:"linear-gradient(145deg,#1e3a5f,#0c4a6e,#164e63)",border:"#38bdf8",glow:"rgba(56,189,248,0.35)",accent:"#7dd3fc"},
  { bg:"linear-gradient(145deg,#5b1a1a,#7f1d1d,#991b1b)",border:"#fca5a5",glow:"rgba(252,165,165,0.30)",accent:"#fecaca"},
  { bg:"linear-gradient(145deg,#713f12,#92400e,#78350f)",border:"#fcd34d",glow:"rgba(252,211,77,0.35)",accent:"#fde68a"},
  { bg:"linear-gradient(145deg,#3b0764,#581c87,#6b21a8)",border:"#d8b4fe",glow:"rgba(216,180,254,0.30)",accent:"#e9d5ff"},
  { bg:"linear-gradient(145deg,#064e3b,#065f46,#047857)",border:"#6ee7b7",glow:"rgba(110,231,183,0.30)",accent:"#a7f3d0"},
  { bg:"linear-gradient(145deg,#1e293b,#334155,#475569)",border:"#e2e8f0",glow:"rgba(226,232,240,0.25)",accent:"#f1f5f9"},
]

interface MainMenuProps {
  onNavigate: (screen: GameScreen) => void
  statusMessage?: string | null
  onClearMessage?: () => void
}

// ── Module-level singletons — survive navigation ──
let _gpAudio: HTMLAudioElement | null = null
let _gpTrackId: string = ""
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _gpACtx: any = null  // AudioContext singleton for spectrum visualizer



// Exposed so other screens (duel) can pause/resume menu music
export function pauseMenuMusic() {
  if (_gpAudio && !_gpAudio.paused) {
    _gpAudio.pause()
  }
}
export function resumeMenuMusic() {
  if (_gpAudio && _gpAudio.paused) {
    _gpAudio.play().catch(() => {})
  }
}

export default function MainMenu({ onNavigate, statusMessage, onClearMessage }: MainMenuProps) {
  const { t } = useLanguage()
  const { coins, setCoins, giftBoxes, claimGift, playerProfile, mobileMode, stamina, maxStamina, staminaNextTickSeconds, decks } = useGame()

  const spendCoins = (amount: number) => setCoins((prev: number) => Math.max(0, prev - amount))

  // Active deck (first deck = default active)
  const activeDeck = decks?.[0] ?? null

  // Active master art — read directly from masters-data storage
  const [masterArtSrc, setMasterArtSrc] = useState<string>(() => {
    if (typeof window === "undefined") return "/images/masters/fehnon-art.png"
    const masters = loadMastersFromStorage()
    const active  = masters.find(m => m.isActive) ?? masters[0]
    return active?.artPath ?? "/images/masters/fehnon-art.png"
  })

  // Refresh master art whenever this screen mounts (player may have changed master)
  useEffect(() => {
    const masters = loadMastersFromStorage()
    const active  = masters.find(m => m.isActive) ?? masters[0]
    if (active?.artPath) setMasterArtSrc(active.artPath)
    // Also update active master id for voice lines
    if (active?.id) setActiveMasterId(active.id.split("-")[0].toLowerCase())
  }, [])

  // ── Voice lines data ──
  const MASTER_VOICES: Record<string, { text: string; src: string }[]> = {
    fehnon: [
      { text: "Eae! Meu nome é Fehnon Hoskie, prazer em te conhecer!",  src: "/audio/masters/fehnon_voice_1_apresentacao.mp3" },
      { text: "Eu tô louco pra entrar nessa festa!",                     src: "/audio/masters/fehnon_voice_2_introduel.mp3" },
      { text: "Ah! Essa foi por pouco...",                               src: "/audio/masters/fehnon_voice_3_loseduel.mp3" },
      { text: "Ah moleque! Essa foi uma vitória e tanto!",               src: "/audio/masters/fehnon_voice_4_winduel.mp3" },
      { text: "Ordem de Laceração!",                                     src: "/audio/masters/fehnon_voice_5_magic.mp3" },
    ],
    calem: [
      { text: "Olá! Me chamo Calem Hidenori",                           src: "/audio/masters/calem_voice_1_apresentacao.mp3" },
      { text: "Com meu poder, eu não tenho o que temer!",               src: "/audio/masters/calem_voice_2_introduel.mp3" },
      { text: "Tudo bem! Na próxima me esforço mais...",                src: "/audio/masters/calem_voice_3_loseduel.mp3" },
      { text: "Incrível! Nós conseguimos!",                             src: "/audio/masters/calem_voice_4_winduel.mp3" },
      { text: "Julgamento do Vazio Eterno.",                            src: "/audio/masters/calem_voice_5_magic.mp3" },
    ],
    morgana: [
      { text: "Oieee! Me chamo Morgana Pendragon",                      src: "/audio/masters/morgana_voice_1_apresentacao.mp3" },
      { text: "Vamos sentir a melodia de batalha!",                     src: "/audio/masters/morgana_voice_2_introduel.mp3" },
      { text: "Droga! Foi quase...",                                    src: "/audio/masters/morgana_voice_3_loseduel.mp3" },
      { text: "Radical! É isso que eu chamo de sinfonia épica!",        src: "/audio/masters/morgana_voice_4_winduel.mp3" },
      { text: "Sinfonia Relâmpago!",                                    src: "/audio/masters/morgana_voice_5_magic.mp3" },
    ],
  }

  const [activeMasterId,  setActiveMasterId]  = useState<string>(() => {
    if (typeof window === "undefined") return "fehnon"
    const masters = loadMastersFromStorage()
    const active  = masters.find(m => m.isActive) ?? masters[0]
    return active?.id?.split("-")[0].toLowerCase() ?? "fehnon"
  })
  const [bubble,          setBubble]          = useState<{ text: string; full: string; out: boolean } | null>(null)
  const typewriterRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const [masterTap,       setMasterTap]       = useState(false)
  const voiceIdxRef       = useRef<Record<string, number>>({})
  const voiceAudioRef     = useRef<HTMLAudioElement | null>(null)
  const bubbleTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMasterClick = () => {
    const voices = MASTER_VOICES[activeMasterId] ?? MASTER_VOICES["fehnon"]
    // Cycle through voices in order
    const idx = (voiceIdxRef.current[activeMasterId] ?? -1) + 1
    voiceIdxRef.current[activeMasterId] = idx % voices.length
    const voice = voices[voiceIdxRef.current[activeMasterId]]

    // Bounce animation
    setMasterTap(true)
    setTimeout(() => setMasterTap(false), 380)

    // Clear previous bubble timer
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current)

    // Show bubble with typewriter effect
    if (typewriterRef.current) clearInterval(typewriterRef.current)
    let i = 0
    setBubble({ text: "", full: voice.text, out: false })
    typewriterRef.current = setInterval(() => {
      i++
      setBubble(b => b ? { ...b, text: voice.text.slice(0, i) } : null)
      if (i >= voice.text.length && typewriterRef.current) {
        clearInterval(typewriterRef.current)
        typewriterRef.current = null
      }
    }, 38)

    // Play voice audio (separate from menu music)
    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause()
      voiceAudioRef.current.currentTime = 0
    }
    voiceAudioRef.current = new Audio(voice.src)
    voiceAudioRef.current.volume = 0.85
    voiceAudioRef.current.play().catch(() => {})

    // Auto-hide bubble after 3.2s with fade-out
    bubbleTimerRef.current = setTimeout(() => {
      if (typewriterRef.current) { clearInterval(typewriterRef.current); typewriterRef.current = null }
      setBubble(b => b ? { ...b, out: true } : null)
      setTimeout(() => setBubble(null), 260)
    }, 3200)
  }

  const [showPlayMenu,       setShowPlayMenu]       = useState(false)
  const [showGiftBox,        setShowGiftBox]         = useState(false)
  const [claimedCard,        setClaimedCard]         = useState<ReturnType<typeof claimGift>>(null)
  const [claimedCoins,       setClaimedCoins]        = useState<number | null>(null)
  const [isOpening,          setIsOpening]           = useState(false)
  const [isClaimingAll,      setIsClaimingAll]       = useState(false)
  const [claimAllResults,    setClaimAllResults]     = useState<{cards:any[];coins:number}|null>(null)
  const [showWallpaperModal, setShowWallpaperModal]  = useState(false)
  const [showDailyBonus,     setShowDailyBonus]      = useState(false)
  const [dailyBonusClaimed,  setDailyBonusClaimed]   = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    const last = localStorage.getItem("gpgame_daily_bonus_date")
    if (!last) return false
    return new Date(last).toDateString() === new Date().toDateString()
  })
  const [dailyBonusJustClaimed, setDailyBonusJustClaimed] = useState(false)

  /* ── Music player ── */
  const TRACKS = [
    { id: "ost1", name: "Main Menu OST 1", sub: "Gear of Perks OST", src: "/audio/Main%20Menu%20OST%201.mp3" },
    { id: "ost2", name: "Main Menu OST 2", sub: "Gear of Perks OST", src: "/audio/Main%20Menu%20OST%202.mp3" },
    { id: "menu", name: "Menu Game OST",   sub: "Gear of Perks OST", src: "/audio/Menu%20Game%20OST.mp3"     },
  ]
  const MUSIC_LS = "gpgame_menu_track"
  const [currentTrackId, setCurrentTrackId] = useState<string>(() =>
    typeof window !== "undefined" ? (localStorage.getItem(MUSIC_LS) ?? "ost1") : "ost1"
  )
  const [showMusicPanel, setShowMusicPanel] = useState(false)
  // audioRef is intentionally module-level so music persists across screens

  const currentTrack = TRACKS.find(t => t.id === currentTrackId) ?? TRACKS[0]

  useEffect(() => {
    if (typeof window === "undefined") return
    // Create singleton once
    if (!_gpAudio) {
      _gpAudio = new Audio()
      _gpAudio.loop = true
      _gpAudio.volume = 0.55
    }
    // Always ensure correct src is loaded
    if (_gpTrackId !== currentTrack.src) {
      _gpTrackId = currentTrack.src
      _gpAudio.src = currentTrack.src
      _gpAudio.load()
    }
    // Always try to play — handles returning from profile/other screens
    const tryPlay = () => _gpAudio!.play().catch(() => {
      const onc = () => _gpAudio?.play().catch(() => {})
      document.addEventListener("click", onc, { once: true })
    })
    tryPlay()
    // Resume music when tab regains focus (handles alt-tab / navigate back)
    const onFocus = () => { if (_gpAudio?.paused) _gpAudio.play().catch(() => {}) }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && _gpAudio?.paused) _gpAudio.play().catch(() => {})
    })
    return () => { window.removeEventListener("focus", onFocus) }
    // NOTE: intentionally NO pause on unmount — music persists across screens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrackId])

  const handleSelectTrack = (id: string) => {
    setShowMusicPanel(false)
    if (id === currentTrackId) return
    // Instant switch: stop current, load + play new immediately (no delay, no click needed)
    if (_gpAudio) {
      _gpAudio.pause()
      _gpAudio.volume = 0.55
      const track = TRACKS.find(t => t.id === id)
      if (track) {
        _gpAudio.src = track.src
        _gpAudio.load()
        _gpAudio.play().catch(() => {})
      }
    }
    setCurrentTrackId(id)
    if (typeof window !== "undefined") localStorage.setItem(MUSIC_LS, id)
  }

  const handleClaimDailyBonus = () => {
    if (dailyBonusClaimed) return
    setCoins((prev: number) => prev + 50)
    localStorage.setItem("gpgame_daily_bonus_date", new Date().toISOString())
    setDailyBonusClaimed(true)
    setDailyBonusJustClaimed(true)
  }

  const WALLPAPERS = [
    { id:"default",          name:"Padrão",           description:"Fundo padrão do menu com cartas caindo",   image:null,                                        cost:0,   free:true  },
    { id:"fehnon_wallpaper", name:"Fehnon Wallpaper",  description:"Arte do Fehnon Hoskie",                   image:"/images/wallpapers/fehnon_wallpaper.png",   cost:0,   free:true  },
    { id:"arthur_wallpaper", name:"Arthur Wallpaper",  description:"Arte do Arthur com o Vazio",              image:"/images/wallpapers/arthur_wallpaper.png",   cost:500, free:false },
    { id:"fsg_wallpaper",    name:"FSG Wallpaper",     description:"Arte dos Fundadores da Santa Guerra",     image:"/images/wallpapers/fsg_wallpaper.png",      cost:500, free:false },
    { id:"fsg_wallpaper_2",  name:"FSG Wallpaper 2",   description:"Arte especial dos personagens",           image:"/images/wallpapers/fsg_wallpaper_2.png",    cost:500, free:false },
    { id:"fsg_wallpaper_3",  name:"FSG Wallpaper 3",   description:"Arte do Fehnon e Morgana",                image:"/images/wallpapers/fsg_wallpaper_3.png",    cost:500, free:false },
    { id:"fsg_wallpaper_4",  name:"FSG Wallpaper 4",   description:"Arte do grupo FSG",                       image:"/images/wallpapers/fsg_wallpaper_4.png",    cost:500, free:false },
  ]
  const WALLPAPER_LS_KEY = "gpgame_selected_wallpaper"
  const UNLOCKED_LS_KEY  = "gpgame_unlocked_wallpapers"

  const [selectedWallpaper, setSelectedWallpaper] = useState<string>(() =>
    typeof window !== "undefined" ? (localStorage.getItem(WALLPAPER_LS_KEY) ?? "fehnon_wallpaper") : "fehnon_wallpaper"
  )
  const [unlockedWallpapers, setUnlockedWallpapers] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(UNLOCKED_LS_KEY)
        const parsed = saved ? JSON.parse(saved) : []
        return [...new Set(["default","fehnon_wallpaper",...parsed])]
      } catch { return ["default","fehnon_wallpaper"] }
    }
    return ["default","fehnon_wallpaper"]
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!localStorage.getItem(UNLOCKED_LS_KEY) && !localStorage.getItem(WALLPAPER_LS_KEY)) {
      setSelectedWallpaper("fehnon_wallpaper")
      setUnlockedWallpapers(["default","fehnon_wallpaper"])
    }
  }, [coins])

  const activeWallpaper = WALLPAPERS.find(w => w.id === selectedWallpaper)

  const handleSelectWallpaper = (id: string) => {
    setSelectedWallpaper(id)
    if (typeof window !== "undefined") localStorage.setItem(WALLPAPER_LS_KEY, id)
  }
  const handleUnlockWallpaper = (wallpaper: typeof WALLPAPERS[0]) => {
    if (coins < wallpaper.cost) return
    spendCoins(wallpaper.cost)
    const next = [...new Set([...unlockedWallpapers, wallpaper.id])]
    setUnlockedWallpapers(next)
    if (typeof window !== "undefined") localStorage.setItem(UNLOCKED_LS_KEY, JSON.stringify(next))
    handleSelectWallpaper(wallpaper.id)
  }

  useEffect(() => {
    if (statusMessage && onClearMessage) {
      const timer = setTimeout(() => onClearMessage(), 4000)
      return () => clearTimeout(timer)
    }
  }, [statusMessage, onClearMessage])

  const seededRand = (seed: number) => { const x = Math.sin(seed*9301+49297)*233280; return x-Math.floor(x) }
  const fallingCards = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x:        (i*5.1)%94+3+(seededRand(i+1)*3-1.5),
      delay:    (i*0.85)%16+seededRand(i+20)*2,
      duration: 18+seededRand(i+40)*12,
      width:    48+seededRand(i+60)*16,
      height:   68+seededRand(i+80)*20,
      themeIndex: i % CARD_THEMES.length,
      shimmerAngle: 110+seededRand(i+100)*40,
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [])

  const handleOpenGift = (giftId: string) => {
    setIsOpening(true)
    const gift = giftBoxes.find(g => g.id === giftId)
    setTimeout(() => {
      const card = claimGift(giftId)
      setClaimedCard(card)
      if (gift?.coinsReward && !card) setClaimedCoins(gift.coinsReward)
      setIsOpening(false)
    }, 1500)
  }
  const handleClaimAll = () => {
    setIsClaimingAll(true)
    const cards: any[] = []; let totalCoins = 0
    setTimeout(() => {
      giftBoxes.forEach(gift => {
        if (!gift.claimed) {
          const card = claimGift(gift.id)
          if (card) cards.push(card)
          else if (gift.coinsReward) totalCoins += gift.coinsReward
        }
      })
      setClaimAllResults({ cards, coins: totalCoins })
      setIsClaimingAll(false)
    }, 1500)
  }
  const unclaimedGifts = giftBoxes.filter(g => !g.claimed)

  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const fxCanvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext("2d"); if (!ctx) return
    let animId: number
    const resize = () => { canvas.width = innerWidth; canvas.height = innerHeight }
    resize(); addEventListener("resize", resize)
    class P {
      x=0;y=0;sz=0;vx=0;vy=0;op=0;hue=0;li=0;ml=0;tw=0;cop=0
      constructor(){this.reset()}
      reset(){this.x=Math.random()*canvas.width;this.y=Math.random()*canvas.height;this.sz=Math.random()*1.8+0.3;this.vx=(Math.random()-.5)*.28;this.vy=-Math.random()*.35-.07;this.op=Math.random()*.32+.06;this.hue=Math.random()*42+255;this.li=0;this.ml=Math.random()*180+90;this.tw=Math.random()*Math.PI*2}
      tick(){this.li++;this.x+=this.vx;this.y+=this.vy;this.tw+=.028;const pr=this.li/this.ml,fi=pr<.12?pr/.12:1,fo=pr>.72?(1-(pr-.72)/.28):1;this.cop=this.op*fi*fo*(.55+Math.sin(this.tw)*.45);if(this.li>=this.ml)this.reset()}
      draw(){ctx!.beginPath();ctx!.arc(this.x,this.y,this.sz,0,Math.PI*2);ctx!.fillStyle=`hsla(${this.hue},70%,70%,${this.cop})`;ctx!.fill()}
    }
    const ps:P[]=[]; for(let i=0;i<20;i++){const p=new P();p.li=Math.random()*p.ml;ps.push(p)}
    let lastT = 0
    const loop=(t: number)=>{
      animId=requestAnimationFrame(loop)
      if(t - lastT < 33) return  // cap to ~30fps
      lastT = t
      ctx.clearRect(0,0,canvas.width,canvas.height)
      ctx.shadowBlur=0
      ps.forEach(p=>{p.tick();p.draw()})
    }
    animId=requestAnimationFrame(loop)
    return ()=>{removeEventListener("resize",resize);cancelAnimationFrame(animId)}
  }, [])

  // ── FX Canvas: blue gear particles on touch/drag ──────────────────────────
  useEffect(() => {
    const canvas = fxCanvasRef.current
    if (!canvas || typeof window === "undefined") return
    const ctx = canvas.getContext("2d")!
    const resize = () => { canvas.width = innerWidth; canvas.height = innerHeight }
    resize()
    window.addEventListener("resize", resize)

    // Draw a gear shape at (cx,cy) with radius r, rotation rot, teeth count teeth
    function drawGear(
      cx: number, cy: number, r: number, rot: number,
      teeth: number, alpha: number, glowColor: string
    ) {
      const innerR = r * 0.58
      const toothH = r * 0.32
      const toothW = (Math.PI * 2) / teeth * 0.42
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(rot)
      ctx.globalAlpha = alpha

      // Glow
      ctx.shadowBlur = r * 1.4
      ctx.shadowColor = glowColor

      // Gear body path
      ctx.beginPath()
      for (let i = 0; i < teeth; i++) {
        const baseA = (Math.PI * 2 * i) / teeth
        const a0 = baseA - toothW / 2
        const a1 = baseA + toothW / 2
        const a2 = baseA + toothW * 1.6
        const a3 = baseA + (Math.PI * 2) / teeth - toothW * 0.6
        // Inner arc before tooth
        if (i === 0) ctx.moveTo(Math.cos(a0) * innerR, Math.sin(a0) * innerR)
        else ctx.lineTo(Math.cos(a0) * innerR, Math.sin(a0) * innerR)
        // Tooth top
        ctx.lineTo(Math.cos(a0) * (r + toothH), Math.sin(a0) * (r + toothH))
        ctx.lineTo(Math.cos(a1) * (r + toothH), Math.sin(a1) * (r + toothH))
        ctx.lineTo(Math.cos(a1) * innerR, Math.sin(a1) * innerR)
        // Inner arc to next tooth base
        ctx.arc(0, 0, innerR, a1, a3, false)
      }
      ctx.closePath()

      // Blue gradient fill
      const grd = ctx.createRadialGradient(0, 0, innerR * 0.2, 0, 0, r + toothH)
      grd.addColorStop(0,   "rgba(147,210,255,0.95)")
      grd.addColorStop(0.4, "rgba(56,160,240,0.88)")
      grd.addColorStop(0.75,"rgba(29,100,200,0.75)")
      grd.addColorStop(1,   "rgba(10,50,140,0.4)")
      ctx.fillStyle = grd
      ctx.fill()

      // Bright stroke
      ctx.strokeStyle = `rgba(180,230,255,${alpha * 0.85})`
      ctx.lineWidth = r * 0.08
      ctx.shadowBlur = r * 0.8
      ctx.shadowColor = "rgba(100,200,255,0.8)"
      ctx.stroke()

      // Center hole
      ctx.shadowBlur = 0
      ctx.beginPath()
      ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(10,30,80,${alpha * 0.9})`
      ctx.fill()
      ctx.strokeStyle = `rgba(147,210,255,${alpha * 0.7})`
      ctx.lineWidth = r * 0.06
      ctx.stroke()

      ctx.restore()
    }

    interface Gear {
      x: number; y: number
      vx: number; vy: number
      r: number
      rot: number; rotSpeed: number
      life: number; decay: number
      teeth: number
    }
    // Shatter shard: one detached tooth flying off
    interface Shard {
      // Origin gear center
      cx: number; cy: number
      // Position of shard (starts near gear perimeter)
      x: number; y: number
      vx: number; vy: number
      rot: number; rotSpeed: number
      life: number
      size: number   // tooth size
      angle: number  // original tooth angle on gear
    }

    const gears: Gear[] = []
    const shards: Shard[] = []

    // ── TOUCH: single gear that shatters its teeth outward ──
    const spawnShatter = (px: number, py: number) => {
      const teethCount = 7
      const R = 20   // gear radius
      // Brief intact gear flash (life 0.18 → fades as shards fly)
      gears.push({
        x: px, y: py, vx: 0, vy: 0,
        r: R, rot: Math.random() * Math.PI * 2,
        rotSpeed: 0.08, life: 0.55, decay: 0.045,
        teeth: teethCount,
      })
      // Each tooth becomes a shard
      for (let i = 0; i < teethCount; i++) {
        const baseAngle = (Math.PI * 2 * i) / teethCount + Math.random() * 0.18
        const speed = 2.5 + Math.random() * 3.5
        shards.push({
          cx: px, cy: py,
          x: px + Math.cos(baseAngle) * R * 0.9,
          y: py + Math.sin(baseAngle) * R * 0.9,
          vx: Math.cos(baseAngle) * speed,
          vy: Math.sin(baseAngle) * speed - 1.0,
          rot: baseAngle,
          rotSpeed: (Math.random() - 0.5) * 0.22,
          life: 1,
          size: 5 + Math.random() * 5,
          angle: baseAngle,
        })
      }
    }

    // Draw a single gear tooth shard (trapezoid shape)
    function drawShard(s: Shard) {
      ctx.save()
      ctx.translate(s.x, s.y)
      ctx.rotate(s.rot)
      ctx.globalAlpha = s.life * 0.92
      const w = s.size * 0.55
      const h = s.size
      ctx.beginPath()
      ctx.moveTo(-w * 0.7, 0)
      ctx.lineTo(-w, -h)
      ctx.lineTo( w, -h)
      ctx.lineTo( w * 0.7, 0)
      ctx.closePath()
      // Gradient fill same blue as gear
      const grd = ctx.createLinearGradient(0, -h, 0, 0)
      grd.addColorStop(0, `rgba(180,230,255,${s.life * 0.95})`)
      grd.addColorStop(0.4, `rgba(56,160,240,${s.life * 0.85})`)
      grd.addColorStop(1,   `rgba(20,80,180,${s.life * 0.5})`)
      ctx.fillStyle = grd
      ctx.shadowBlur = s.size * 1.2
      ctx.shadowColor = "rgba(100,200,255,0.7)"
      ctx.fill()
      ctx.strokeStyle = `rgba(200,240,255,${s.life * 0.7})`
      ctx.lineWidth = 0.8
      ctx.stroke()
      ctx.restore()
    }

    // ── DRAG: trail of small spinning gears ──
    let lastTrailX = -999; let lastTrailY = -999
    const spawnTrail = (px: number, py: number) => {
      const dist = Math.hypot(px - lastTrailX, py - lastTrailY)
      if (dist < 18) return
      lastTrailX = px; lastTrailY = py
      gears.push({
        x: px + (Math.random() - 0.5) * 6,
        y: py + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -Math.random() * 1.2 - 0.3,
        r: 4 + Math.random() * 5,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.18,
        life: 0.85,
        decay: 0.022 + Math.random() * 0.01,
        teeth: [5, 6][Math.floor(Math.random() * 2)],
      })
    }

    const onPointerDown = (e: PointerEvent) => { spawnShatter(e.clientX, e.clientY) }
    const onPointerMove = (e: PointerEvent) => {
      if (e.buttons === 0) return
      spawnTrail(e.clientX, e.clientY)
    }
    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("pointermove", onPointerMove, { passive: true })

    let animId: number
    const loop = () => {
      animId = requestAnimationFrame(loop)
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw trail gears
      for (let i = gears.length - 1; i >= 0; i--) {
        const g = gears[i]
        g.x  += g.vx;  g.y  += g.vy
        g.vx *= 0.94;  g.vy  = g.vy * 0.94 + 0.04
        g.rot += g.rotSpeed
        g.life -= g.decay
        if (g.life <= 0) { gears.splice(i, 1); continue }
        const alpha = g.life > 0.75 ? (1 - g.life) * 4 * g.life : g.life
        drawGear(g.x, g.y, g.r, g.rot, g.teeth, Math.min(alpha, g.life * 1.1), "rgba(56,160,240,0.7)")
      }

      // Draw shatter shards
      for (let i = shards.length - 1; i >= 0; i--) {
        const s = shards[i]
        s.x   += s.vx;  s.y   += s.vy
        s.vx  *= 0.93;  s.vy   = s.vy * 0.93 + 0.06
        s.rot += s.rotSpeed
        s.life -= 0.022
        if (s.life <= 0) { shards.splice(i, 1); continue }
        drawShard(s)
      }
    }
    animId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", resize)
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("pointermove", onPointerMove)
    }
  }, [])

  // ── Spectrum visualizer canvas — sits above bottom nav ──
  // Module-level AudioContext singleton so it persists across navigation

  /* ═══════════════════════════════ RENDER ══════════════════════════════ */
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: GP_CSS }} />

      {/* Partículas */}
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 2 }} />
      <canvas ref={fxCanvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 3 }} />

      {/* Cantos decorativos – NENHUM overlay escuro/vignette/scanline */}
      <div className="gp-corner gp-corner-tl" />
      <div className="gp-corner gp-corner-tr" />
      <div className="gp-corner gp-corner-bl" />
      <div className="gp-corner gp-corner-br" />

      {/* ══ BACKGROUND ══ */}
      <div className="fixed inset-0 z-0 gp-anim-bg">
        {activeWallpaper?.image ? (
          <div className="absolute inset-0 gp-wbg" style={{
            backgroundImage:`url(${activeWallpaper.image})`,
            backgroundSize:"cover", backgroundPosition:"center", backgroundRepeat:"no-repeat",
          }} />
        ) : (
          <div className="absolute inset-0 gp-wbg" style={{
            background:"linear-gradient(180deg,#03060F 0%,#060D1C 30%,#080F22 60%,#04091A 100%)",
          }} />
        )}
        {!activeWallpaper?.image && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {fallingCards.map(card => {
              const th = CARD_THEMES[card.themeIndex]
              const sw = 5+(card.id%4)*.8
              return (
                <div key={card.id} className="absolute" style={{left:`${card.x}%`,animation:`fallingCard ${card.duration}s linear infinite`,animationDelay:`${card.delay}s`,willChange:"transform"}}>
                  <div style={{animation:`cardSway ${sw}s ease-in-out infinite`,animationDelay:`${card.delay*.4}s`,willChange:"transform"}}>
                    <div style={{width:`${card.width}px`,height:`${card.height}px`,background:th.bg,border:`1.5px solid ${th.border}`,borderRadius:8,boxShadow:`0 0 10px ${th.glow}`,overflow:"hidden",position:"relative"}}>
                      <div style={{position:"absolute",inset:0,background:`linear-gradient(${card.shimmerAngle}deg,transparent 35%,rgba(255,255,255,0.12) 50%,transparent 65%)`}} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {/* Glows atmosféricos sutis apenas */}
        <div className="absolute inset-0" style={{background:"radial-gradient(ellipse 80% 40% at 50% 0%,rgba(109,40,217,0.07) 0%,transparent 55%)"}} />
        <div className="absolute inset-0" style={{background:"radial-gradient(ellipse 55% 35% at 10% 85%,rgba(109,40,217,0.05) 0%,transparent 50%)"}} />
      </div>

      {/* ══ TOP HUD ══ */}
      {/* ── GEAR PASS — fixed top left, beside profile ── */}
      <button
        onClick={() => onNavigate("gear-pass")}
        className="fixed z-50 gp-anim-hud group transition-all duration-200 hover:scale-105 active:scale-95"
        title="Gear Pass"
        style={{ top:8, left:175, width:320, height:100, background:"transparent", border:"none", padding:0, cursor:"pointer" }}>
        <Image
          src="/images/gear-pass-icon.png"
          alt="Gear Pass"
          width={320}
          height={100}
          className="w-full h-full object-contain"
          style={{ filter:"drop-shadow(0 0 18px rgba(232,121,249,0.65)) drop-shadow(0 3px 12px rgba(0,0,0,0.6))", transition:"filter .25s" }}
        />
      </button>

      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 pt-2 pb-2 relative gp-anim-hud"
        style={{ background:"transparent" }}>
        {/* ── Esquerda: perfil + master card ── */}
        <div className="flex flex-col gap-2.5">
          {/* Avatar + anel girando APENAS aqui (vermelho no guia) */}
          <button onClick={() => onNavigate("profile")}
            className="flex items-center gap-3 group transition-all duration-200 hover:scale-[1.03]">
            <div className="relative" style={{ width:68, height:68 }}>
              {/* Anel conic girando - SOMENTE no avatar */}
              <div className="gp-conic-ring" style={{ inset:-4, borderRadius:20 }} />
              <div className="relative overflow-hidden" style={{
                width:68, height:68, borderRadius:18, zIndex:1,
                border:"2px solid rgba(139,92,246,0.45)",
                boxShadow:"0 0 16px rgba(124,58,237,0.45)",
              }}>
                {playerProfile.avatarUrl ? (
                  <Image src={playerProfile.avatarUrl||"/placeholder.svg"} alt={playerProfile.name} width={68} height={68} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background:"linear-gradient(135deg,#2E1065,#7C3AED)" }}>
                    <span className="text-white text-2xl font-black">{playerProfile.name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </div>
              {mobileMode && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-black/80" style={{zIndex:2}} />}
            </div>
            <div className="text-left">
              <p className="text-white font-black text-xl leading-tight tracking-wide">{playerProfile.name}</p>
              <p className="text-[13px] font-bold tracking-widest" style={{color:"rgba(192,132,252,0.85)", textShadow:"0 0 8px rgba(139,92,246,0.4)"}}>{playerProfile.title||"Jogador"}</p>
            </div>
          </button>
          <div style={{ transform:"scaleX(1.12) scaleY(1.08)", transformOrigin:"left center" }}>
            <MasterMenuCard onOpen={() => onNavigate("masters")} />
          </div>

        </div>

        {/* ── Direita: STAMINA + COINS + GIFT — sem anel girando (verde no guia) ── */}
        <div className="flex items-center gap-2.5">

          {/* STAMINA — sem anel girando */}
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl" style={{
            background:"rgba(5,2,18,0.90)",
            border:"1px solid rgba(139,92,246,0.28)",
            boxShadow:"0 0 14px rgba(124,58,237,0.10)",
          }}>
            <span style={{ fontSize:18, filter:"drop-shadow(0 0 6px rgba(96,165,250,0.7))" }}>⚡</span>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black tracking-widest uppercase" style={{color:"rgba(167,139,250,0.55)"}}>Stamina</span>
                <span className="font-black text-base text-white tabular-nums">
                  {stamina}<span className="font-normal text-sm" style={{color:"rgba(167,139,250,0.4)"}}>/{maxStamina}</span>
                </span>
                {stamina < maxStamina && staminaNextTickSeconds > 0 && (
                  <span className="text-[10px] font-bold tabular-nums" style={{color:"rgba(52,211,153,0.6)"}}>
                    {String(Math.floor(staminaNextTickSeconds/60)).padStart(1,"0")}:{String(staminaNextTickSeconds%60).padStart(2,"0")}
                  </span>
                )}
              </div>
              <div className="rounded-full overflow-hidden" style={{width:88, height:5, background:"rgba(124,58,237,0.12)", border:"1px solid rgba(124,58,237,0.18)"}}>
                <div className="h-full rounded-full gp-stam-fill transition-all duration-500" style={{
                  width:`${Math.min(100,(stamina/maxStamina)*100)}%`,
                  background: stamina===maxStamina
                    ? "linear-gradient(90deg,#7C3AED,#E879F9)"
                    : stamina < maxStamina*.3
                    ? "linear-gradient(90deg,#ef4444,#f87171)"
                    : "linear-gradient(90deg,#6D28D9,#8B5CF6)",
                  boxShadow:"0 0 6px rgba(139,92,246,0.4)",
                }} />
              </div>
            </div>
          </div>

          {/* COINS — sem anel girando */}
          <div className="relative cursor-pointer transition-all hover:brightness-110"
            style={{ background:"rgba(10,6,2,0.90)", border:"1px solid rgba(245,158,11,0.28)",
              boxShadow:"0 0 12px rgba(245,158,11,0.08)", borderRadius:16,
              height:44, paddingLeft:58, paddingRight:14,
              display:"flex", alignItems:"center", gap:4,
              overflow:"visible" }}>
            {/* Coin icon — absolute, overflows bar vertically, bar height stays 44px */}
            <Image src="/images/Gacha_Coin.png" alt="Coins" width={58} height={58}
              style={{
                position:"absolute", left:4, top:"50%",
                transform:"translateY(-50%)",
                width:58, height:58,
                objectFit:"contain",
                filter:"drop-shadow(0 0 12px rgba(252,211,77,0.75))",
                pointerEvents:"none",
                zIndex:1,
              }}
            />
            <span className="font-black text-base tabular-nums" style={{color:"#FCD34D", textShadow:"0 0 8px rgba(252,211,77,0.4)"}}>{coins.toLocaleString()}</span>
            <span style={{color:"rgba(167,139,250,0.35)", fontSize:14}}>+</span>
          </div>

          {/* GIFT */}
          <div className="relative" style={{ borderRadius:16 }}>
            <button onClick={() => setShowGiftBox(true)}
              className="relative flex items-center justify-center transition-all hover:scale-105"
              style={{ width:46, height:46, background:"rgba(10,6,2,0.92)", borderRadius:11, border:"1.5px solid rgba(245,158,11,0.42)", boxShadow:"0 0 10px rgba(245,158,11,0.16)" }}>
              <Gift style={{ width:20, height:20, color:"#FCD34D", filter:"drop-shadow(0 0 5px rgba(252,211,77,0.55))" }} />
              {unclaimedGifts.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-black text-white"
                  style={{ background:"linear-gradient(135deg,#ef4444,#dc2626)", boxShadow:"0 0 8px rgba(239,68,68,0.65)", border:"1.5px solid rgba(255,255,255,0.15)", zIndex:2 }}>
                  {unclaimedGifts.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ══ MUSIC BAR — barra fixa topo, alinhada à esquerda perto do perfil ══ */}
      <button
        onClick={() => setShowMusicPanel(v => !v)}
        className="gp-music-bar gp-anim-music"
        style={{ position:"fixed", zIndex:50, bottom:110, left:20, width:230 }}>
        <div className="gp-disc"><div className="gp-disc-inner" /></div>
        <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
          <span className="gp-music-sub">Tocando agora</span>
          <div style={{ overflow: "hidden" }}>
            <span className="gp-music-title gp-music-scroll">
              {currentTrack.name}&nbsp;&nbsp;·&nbsp;&nbsp;{currentTrack.name}
            </span>
          </div>
        </div>
        <span style={{ color: "rgba(167,139,250,0.6)", fontSize: 10, flexShrink: 0 }}>
          {showMusicPanel ? "▲" : "▼"}
        </span>
      </button>

      {/* ── Music panel — separate fixed element so it's never clipped ── */}
      {showMusicPanel && (
        <div className="fixed z-[9999]" style={{ bottom: 200, left: 20 }}>
          <div className="gp-music-panel">
            <div className="flex items-center justify-between mb-3">
              <p style={{ fontSize:10, fontWeight:800, letterSpacing:"2px", textTransform:"uppercase", color:"rgba(139,92,246,0.6)" }}>
                🎵 Músicas do Menu
              </p>
              <button
                onClick={e => { e.stopPropagation(); setShowMusicPanel(false) }}
                style={{ color:"rgba(139,92,246,0.5)", fontSize:14, background:"none", border:"none", cursor:"pointer", lineHeight:1 }}>✕</button>
            </div>
            <div className="flex flex-col gap-1.5">
              {TRACKS.map(track => (
                <div key={track.id}
                  className={"gp-track-item" + (track.id === currentTrackId ? " active" : "")}
                  onClick={e => { e.stopPropagation(); handleSelectTrack(track.id) }}>
                  <div className="gp-track-dot" style={{
                    background: track.id === currentTrackId ? "linear-gradient(135deg,#E879F9,#8B5CF6)" : "rgba(109,40,217,0.35)",
                    boxShadow: track.id === currentTrackId ? "0 0 6px rgba(232,121,249,0.6)" : "none",
                  }} />
                  <div className="flex-1">
                    <p className={"gp-track-name" + (track.id === currentTrackId ? " active" : "")}>{track.name}</p>
                    <p className="gp-track-sub">{track.sub}</p>
                  </div>
                  {track.id === currentTrackId && (
                    <span style={{ fontSize:9, color:"rgba(232,121,249,0.85)", fontWeight:800, letterSpacing:"1px" }}>▶ NOW</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── STATUS MESSAGE ── */}
      {statusMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border text-xs font-semibold shadow-lg backdrop-blur-md ${
            statusMessage.includes("ativado") ? "border-emerald-500/40 text-emerald-300" : "border-amber-500/40 text-amber-300"
          }`} style={{ background: statusMessage.includes("ativado") ? "rgba(3,18,10,0.94)" : "rgba(18,10,2,0.94)" }}>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${statusMessage.includes("ativado") ? "bg-emerald-400" : "bg-amber-400"}`} />
            {statusMessage}
          </div>
        </div>
      )}

      {/* ══ MASTER ART — right side, clickable with voice + bubble ══ */}
      <div className="gp-master-art-wrap gp-anim-master" onClick={handleMasterClick} role="button" aria-label="Falar com Mestre">

        {/* Manga speech bubble */}
        {bubble && (
          <div className={`gp-bubble${bubble.out ? " out" : ""}`}>
            <p className="gp-bubble-text">{bubble.text}</p>
            {/* Tail is a child but overflow:visible means it renders outside the box */}
            <div className="gp-bubble-tail" />
          </div>
        )}

        {/* Character art — tap class on wrapper so entry/float animations don't reset */}
        {masterTap && <div className="gp-master-tap-ring" />}
        <div className={masterTap ? "gp-master-tap-wrap" : ""} style={{ position:"absolute", inset:0 }}>
          <Image
            key={masterArtSrc}
            src={masterArtSrc}
            alt="Master"
            fill
            sizes="310px"
            className="object-contain object-bottom gp-master-art"
            style={{ userSelect: "none" }}
            priority
          />
        </div>
      </div>

      {/* ══ BOTÕES LATERAIS DIREITOS — com anel lento ══ */}
      <div className="fixed z-30 flex flex-col gap-2 gp-anim-sidebar" style={{ top:152, right:4 }}>
        {[
          { label:"Deck",   icon:<Hammer />,   onClick:()=>onNavigate("deck-builder"),  gold:false, dot:false    },
          { label:"Histórico",  icon:<History />,  onClick:()=>onNavigate("history"),       gold:false, dot:false    },
          { label:"Config.", icon:<Settings />, onClick:()=>onNavigate("settings"),      gold:false, dot:false    },
          { label:"Diárias",  icon:null,         onClick:()=>{ setShowDailyBonus(true); setDailyBonusJustClaimed(false) }, gold:false, dot:!dailyBonusClaimed, emoji: dailyBonusClaimed ? "✅" : "🎁", dotColor:"rgba(52,211,153,0.9)" },
          { label:"Tema",   icon:null,         onClick:()=>setShowWallpaperModal(true),  gold:false, dot:false,   emoji:"🖼️" },
          { label:"História",  icon:<BookOpen />, onClick:()=>onNavigate("story"),         gold:false, dot:false    },
          { label:"Mestre", icon:<Star />,     onClick:()=>onNavigate("masters"),       gold:true,  dot:false    },
        ].map(btn => (
          <div key={btn.label} className="relative" style={{ borderRadius:14 }}>
            <button className={`gp-sb${btn.gold?" gp-gold":""}`} onClick={btn.onClick}>
              {btn.dot && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full animate-pulse" style={{background:btn.dotColor||"rgba(239,68,68,0.9)",boxShadow:`0 0 6px ${btn.dotColor||"rgba(239,68,68,0.9)"}`}} />}
              {btn.emoji ? <span style={{fontSize:16,lineHeight:1}}>{btn.emoji}</span> : btn.icon}
              <span className="gp-sb-lbl">{btn.label}</span>
            </button>
          </div>
        ))}
      </div>

      {/* ══ 3 BOTÕES DESTAQUE — lateral esquerda, exatamente como no desenho ══ */}
      {!showPlayMenu && (
        <div className="fixed z-20 gp-anim-ui-btns" style={{ left:24, top:200 }}>

          {/* ── DECK ATIVO — indicador acima do JOGAR ── */}
          {activeDeck && (
            <button className="gp-deck-badge" onClick={() => onNavigate("deck-builder")} style={{ marginBottom: 6 }}>
              <div className="gp-deck-badge-dot" />
              <div className="flex flex-col gap-0.5 overflow-hidden">
                <span style={{ fontSize:8, fontWeight:800, letterSpacing:"1.5px", textTransform:"uppercase", color:"rgba(147,197,253,0.55)" }}>Deck Ativo</span>
                <span style={{ fontSize:13, fontWeight:900, color:"rgba(219,234,254,0.95)", letterSpacing:"0.5px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:360, textShadow:"0 0 10px rgba(59,130,246,0.5)" }}>
                  {activeDeck.name}
                </span>
              </div>
              <span style={{ marginLeft:"auto", fontSize:10, color:"rgba(96,165,250,0.55)", fontWeight:700, flexShrink:0 }}>▸ {activeDeck.cards?.length ?? 0} cartas</span>
            </button>
          )}

          {/* ── JOGAR (AZUL) — retângulo grande com corte no canto ── */}
          <button className="gp-play-btn flex flex-col items-center justify-center gap-3"
            onClick={() => setShowPlayMenu(true)}
            style={{ width:440, height:205, borderRadius:0, marginBottom:10 }}>
            {/* Holographic lines overlay */}
            <div className="gp-play-holo" />
            {/* Sword icon with dual-glow */}
            <div className="relative" style={{ zIndex:4 }}>
              <Swords style={{ width:54, height:54, color:"#e0f2fe", filter:"drop-shadow(0 0 8px #60a5fa) drop-shadow(0 0 22px #3b82f6)" }} />
              {/* Aura ring behind sword */}
              <div style={{
                position:"absolute", inset:-14, borderRadius:"50%",
                background:"radial-gradient(ellipse at 50% 50%, rgba(59,130,246,0.22) 0%, transparent 70%)",
                animation:"gp-play-aura 2.4s ease-in-out infinite",
                pointerEvents:"none",
              }} />
            </div>
            <span className="font-black tracking-widest text-2xl uppercase relative" style={{
              zIndex:4,
              color:"#fff",
              textShadow:"0 0 12px #60a5fa, 0 0 28px #3b82f6, 0 2px 0 rgba(0,0,50,0.8)",
              letterSpacing:"0.28em",
            }}>Jogar</span>
          </button>

          {/* ── COLEÇÃO (BRANCO) + GACHA (ROSA) lado a lado abaixo do JOGAR ── */}
          <div className="flex items-center gap-0" style={{ marginTop:0 }}>

            {/* COLEÇÃO — retângulo branco */}
            <button className="gp-col-btn flex items-center justify-center gap-2.5"
              onClick={() => onNavigate("collection")}
              style={{ width:220, height:72, borderRadius:10 }}>
              <div className="gp-col-holo" />
              <BookOpen style={{ width:22, height:22, color:"#fff", filter:"drop-shadow(0 0 8px rgba(255,255,255,0.9)) drop-shadow(0 0 18px rgba(200,220,255,0.6))", zIndex:4, position:"relative" }} />
              <span className="font-black text-sm tracking-widest uppercase" style={{ color:"#fff", textShadow:"0 0 14px rgba(255,255,255,0.9), 0 0 28px rgba(200,230,255,0.5)", letterSpacing:"0.18em", zIndex:4, position:"relative" }}>Coleção</span>
            </button>

            {/* GACHA — oval rosa */}
            <button className="gp-gacha-btn flex items-center justify-center gap-2.5"
              onClick={() => onNavigate("gacha")}
              style={{ width:200, height:72, borderRadius:40 }}>
              <div className="gp-play-holo" />
              <Sparkles style={{ width:22, height:22, color:"#fce7f3", filter:"drop-shadow(0 0 8px rgba(249,168,212,0.95)) drop-shadow(0 0 18px rgba(236,72,153,0.6))", zIndex:4, position:"relative" }} />
              <span className="font-black text-sm tracking-widest uppercase" style={{ color:"#fce7f3", textShadow:"0 0 14px rgba(249,168,212,0.95), 0 0 28px rgba(236,72,153,0.55)", letterSpacing:"0.18em", zIndex:4, position:"relative" }}>Gacha</span>
            </button>

          </div>
        </div>
      )}

      {/* ══ BOTTOM NAV — levemente escuro (AMARELO no guia) ══ */}
      <div className="fixed bottom-0 left-0 right-0 z-40 gp-nav-wrap gp-anim-nav">
        <div className="gp-nav-line" />

        {!showPlayMenu ? (
          /* Nav normal: Social / Missões / Guilda / Loja / Perfil — SEM Jogar, Coleção, Gacha */
          <div className="flex items-center justify-around px-4 pb-5 pt-2">
            <button className="gp-ni" onClick={() => onNavigate("friends")}>
              <Users className="w-7 h-7" /><span className="gp-ni-lbl">Social</span>
            </button>
            <button className="gp-ni" onClick={() => onNavigate("missions")}>
              <Target className="w-7 h-7" /><span className="gp-ni-lbl">Missões</span>
            </button>
            <button className="gp-ni" onClick={() => onNavigate("guild")}>
              <Users className="w-7 h-7" /><span className="gp-ni-lbl">Guilda</span>
            </button>
            <button className="gp-ni" onClick={() => onNavigate("shop" as GameScreen)}>
              <span className="w-7 h-7 flex items-center justify-center text-2xl leading-none">🛒</span>
              <span className="gp-ni-lbl">Loja</span>
            </button>
            <button className="gp-ni" onClick={() => onNavigate("profile")}>
              <span className="w-7 h-7 flex items-center justify-center text-2xl leading-none">👤</span>
              <span className="gp-ni-lbl">Perfil</span>
            </button>
          </div>
        ) : (
          /* Sub-menu de modos de jogo */
          <div className="px-4 pb-6 pt-4 max-w-lg mx-auto space-y-2.5">
            <p className="text-center text-[11px] font-black tracking-widest uppercase mb-3" style={{color:"rgba(139,92,246,0.5)"}}>Modo de jogo</p>
            <button onClick={() => onNavigate("duel-bot")}
              className="w-full h-14 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-3 transition-all hover:scale-[1.02] hover:brightness-110 shadow-xl"
              style={{background:"linear-gradient(135deg,#1d4ed8,#3b82f6,#2563eb)",boxShadow:"0 8px 24px rgba(59,130,246,0.25)"}}>
              <Bot className="h-6 w-6" />{t("vsBot")}
            </button>
            <button onClick={() => onNavigate("duel-player")}
              className="w-full h-14 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-3 transition-all hover:scale-[1.02] hover:brightness-110 shadow-xl"
              style={{background:"linear-gradient(135deg,#c2410c,#f97316,#ea580c)",boxShadow:"0 8px 24px rgba(249,115,22,0.25)"}}>
              <Users className="h-6 w-6" />{t("vsPlayer")}
            </button>
            <button onClick={() => { setShowPlayMenu(false); onNavigate("story") }}
              className="w-full h-14 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-3 transition-all hover:scale-[1.02] hover:brightness-110 shadow-xl"
              style={{background:"linear-gradient(135deg,#5b21b6,#7c3aed,#4c1d95)",boxShadow:"0 8px 24px rgba(124,58,237,0.30)"}}>
              <BookOpen className="h-6 w-6" />Campanha
            </button>
            <button onClick={() => setShowPlayMenu(false)}
              className="w-full h-10 rounded-xl border text-sm font-semibold transition-colors hover:bg-white/[0.04]"
              style={{borderColor:"rgba(255,255,255,0.08)",color:"rgba(139,92,246,0.5)"}}>
              {t("back")}
            </button>
          </div>
        )}
      </div>

      {/* ══════════════════════ MODAIS ══════════════════════════════════════ */}

      {/* GIFT BOX */}
      {showGiftBox && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-3xl max-w-md w-full p-6 relative"
            style={{background:"linear-gradient(160deg,#05021A,#07031E)",border:"1px solid rgba(124,58,237,0.25)",boxShadow:"0 0 60px rgba(124,58,237,0.15)"}}>
            <button onClick={() => { setShowGiftBox(false); setClaimedCard(null); setClaimedCoins(null); setClaimAllResults(null) }}
              className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-5 h-5" style={{color:"rgba(167,139,250,0.7)"}} />
            </button>
            <div className="flex items-center justify-center gap-3 mb-6">
              <Gift className="w-7 h-7" style={{color:"#FCD34D"}} />
              <h2 className="text-xl font-black" style={{background:"linear-gradient(135deg,#FCD34D,#F59E0B)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Caixa de Presentes</h2>
            </div>
            {!claimedCard && !claimedCoins && !claimAllResults ? (
              unclaimedGifts.length > 0 ? (
                <>
                  {unclaimedGifts.length > 1 && (
                    <button onClick={handleClaimAll} disabled={isClaimingAll}
                      className="w-full gacha-btn h-12 rounded-xl text-white font-bold flex items-center justify-center gap-2 shadow-lg mb-4"
                      style={{background:"linear-gradient(135deg,#059669,#10b981)",boxShadow:"0 4px 20px rgba(16,185,129,0.3)"}}>
                      {isClaimingAll ? <><Sparkles className="w-4 h-4 animate-spin" />Coletando...</> : <><Gift className="w-4 h-4" />Coletar Tudo ({unclaimedGifts.length})</>}
                    </button>
                  )}
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                    {unclaimedGifts.map(gift => (
                      <div key={gift.id} className="rounded-2xl p-4" style={{background:"rgba(124,58,237,0.10)",border:"1px solid rgba(124,58,237,0.25)"}}>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 rounded-xl" style={{background:"linear-gradient(135deg,#7C3AED,#A855F7)"}}><Gift className="w-6 h-6 text-white" /></div>
                          <h3 className="font-bold text-white">{gift.title}</h3>
                        </div>
                        <p className="text-slate-300 text-sm mb-4">{gift.message}</p>
                        {gift.coinsReward && <div className="flex items-center gap-2 mb-3" style={{color:"#FCD34D"}}><Coins className="w-4 h-4" /><span>+{gift.coinsReward} Moedas</span></div>}
                        <button onClick={() => handleOpenGift(gift.id)} disabled={isOpening}
                          className="gacha-btn w-full h-12 rounded-xl text-black font-bold flex items-center justify-center gap-2 shadow-lg"
                          style={{background:"linear-gradient(135deg,#FCD34D,#F59E0B)",boxShadow:"0 4px 16px rgba(245,158,11,0.35)"}}>
                          {isOpening ? <><Sparkles className="w-4 h-4 animate-spin" />Abrindo...</> : "Abrir Presente"}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{background:"rgba(124,58,237,0.10)"}}>
                    <Gift className="w-8 h-8" style={{color:"rgba(124,58,237,0.45)"}} />
                  </div>
                  <p style={{color:"rgba(167,139,250,0.55)"}}>Nenhum presente disponível no momento.</p>
                </div>
              )
            ) : claimedCard ? (
              <div className="flex flex-col items-center py-4">
                <p className="font-bold text-lg mb-4" style={{color:"#FCD34D"}}>Você recebeu:</p>
                <div className="relative animate-float">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 blur-2xl opacity-50 animate-pulse" />
                  <div className={`relative w-40 h-56 rounded-xl overflow-hidden shadow-2xl ${claimedCard.rarity==="LR"?"rarity-lr":claimedCard.rarity==="UR"?"rarity-ur":claimedCard.rarity==="SR"?"rarity-sr":"rarity-r"}`}>
                    <Image src={claimedCard.image||"/placeholder.svg"} alt={claimedCard.name} fill sizes="160px" className="object-cover" />
                  </div>
                </div>
                <h3 className="mt-4 text-xl font-bold text-white text-center">{claimedCard.name}</h3>
                <span className={`mt-2 px-4 py-1 rounded-full text-sm font-bold ${claimedCard.rarity==="LR"?"bg-gradient-to-r from-red-500 to-amber-500 text-white":claimedCard.rarity==="UR"?"bg-gradient-to-r from-amber-500 to-yellow-400 text-black":claimedCard.rarity==="SR"?"bg-purple-500 text-white":"bg-slate-500 text-white"}`}>{claimedCard.rarity}</span>
                <button onClick={() => { setShowGiftBox(false); setClaimedCard(null) }}
                  className="mt-6 gacha-btn px-8 py-3 rounded-xl text-white font-bold shadow-lg"
                  style={{background:"linear-gradient(135deg,#7C3AED,#A855F7)",boxShadow:"0 4px 20px rgba(124,58,237,0.4)"}}>Fechar</button>
              </div>
            ) : claimAllResults ? (
              <div className="flex flex-col items-center py-4">
                <p className="font-bold text-lg mb-4" style={{color:"#FCD34D"}}>Você recebeu:</p>
                <div className="w-full max-h-[50vh] overflow-y-auto space-y-3 mb-4">
                  {claimAllResults.cards.length > 0 && (
                    <div className="rounded-2xl p-4" style={{background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.2)"}}>
                      <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Star className="w-5 h-5" style={{color:"#FCD34D"}} />Cartas ({claimAllResults.cards.length})</h3>
                      <div className="grid grid-cols-3 gap-2">
                        {claimAllResults.cards.map((card, index) => (
                          <div key={index}>
                            <div className={`relative w-full aspect-[2/3] rounded-lg overflow-hidden shadow-lg ${card.rarity==="LR"?"rarity-lr":card.rarity==="UR"?"rarity-ur":card.rarity==="SR"?"rarity-sr":"rarity-r"}`}>
                              <Image src={card.image||"/placeholder.svg"} alt={card.name} fill sizes="100px" className="object-cover" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {claimAllResults.coins > 0 && (
                    <div className="rounded-2xl p-4" style={{background:"rgba(245,158,11,0.10)",border:"1px solid rgba(245,158,11,0.25)"}}>
                      <div className="flex items-center justify-center gap-3">
                        <Image src="/images/icons/gacha-coin.png" alt="Gacha Coin" width={40} height={40} className="w-10 h-10 object-contain" />
                        <span className="text-2xl font-bold" style={{color:"#FCD34D"}}>+{claimAllResults.coins}</span>
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={() => { setShowGiftBox(false); setClaimAllResults(null) }}
                  className="gacha-btn px-8 py-3 rounded-xl text-white font-bold shadow-lg"
                  style={{background:"linear-gradient(135deg,#7C3AED,#A855F7)",boxShadow:"0 4px 20px rgba(124,58,237,0.4)"}}>Fechar</button>
              </div>
            ) : claimedCoins ? (
              <div className="flex flex-col items-center py-8">
                <p className="font-bold text-lg mb-4" style={{color:"#FCD34D"}}>Você recebeu:</p>
                <div className="relative animate-float">
                  <div className="absolute inset-0 rounded-2xl blur-2xl opacity-50 animate-pulse" style={{background:"linear-gradient(135deg,#FCD34D,#F59E0B)"}} />
                  <div className="relative flex items-center gap-3 px-8 py-6 rounded-2xl shadow-2xl"
                    style={{background:"linear-gradient(135deg,#D97706,#F59E0B)",boxShadow:"0 8px 32px rgba(245,158,11,0.35)"}}>
                    <Coins className="w-12 h-12 text-white" /><span className="text-4xl font-bold text-white">+{claimedCoins}</span>
                  </div>
                </div>
                <p className="mt-4 text-xl font-bold text-white">Moedas de Gacha!</p>
                <button onClick={() => { setShowGiftBox(false); setClaimedCoins(null) }}
                  className="mt-6 gacha-btn px-8 py-3 rounded-xl text-white font-bold"
                  style={{background:"linear-gradient(135deg,#7C3AED,#A855F7)",boxShadow:"0 4px 20px rgba(124,58,237,0.4)"}}>Fechar</button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* DAILY BONUS */}
      {showDailyBonus && (
        <div className="fixed inset-0 z-[9400] flex items-center justify-center p-4"
          style={{background:"rgba(0,0,0,0.88)",backdropFilter:"blur(8px)"}}>
          <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
            style={{background:"linear-gradient(160deg,#05021A,#07031E)",border:dailyBonusClaimed?"1px solid rgba(100,100,100,0.15)":"1px solid rgba(34,197,94,0.35)",boxShadow:dailyBonusClaimed?"none":"0 0 60px rgba(34,197,94,0.20)"}}>
            <div className="px-6 pt-6 pb-2 text-center">
              <div className="text-6xl mb-3">{dailyBonusClaimed?"✅":"🎁"}</div>
              <h2 className="text-white font-black text-2xl mb-1">Bônus Diário</h2>
              <p className="text-sm" style={{color:"rgba(167,139,250,0.58)"}}>{dailyBonusClaimed?"Você já coletou o bônus de hoje. Volte amanhã!":"Colete suas recompensas diárias gratuitas!"}</p>
            </div>
            <div className="px-6 py-5">
              <div className="rounded-2xl p-5 flex items-center justify-center gap-4"
                style={{background:dailyBonusClaimed?"rgba(255,255,255,0.03)":"rgba(34,197,94,0.08)",border:dailyBonusClaimed?"1px solid rgba(100,100,100,0.12)":"1px solid rgba(34,197,94,0.25)"}}>
                <div className="relative">
                  <Image src="/images/icons/gacha-coin.png" alt="Gacha Coin" width={56} height={56} className="drop-shadow-lg" />
                  {!dailyBonusClaimed && <div className="absolute inset-0 rounded-full blur-xl" style={{background:"rgba(251,191,36,0.4)",transform:"scale(1.5)"}} />}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest mb-0.5" style={{color:"rgba(167,139,250,0.5)"}}>Recompensa</p>
                  <p className="text-4xl font-black" style={{color:dailyBonusClaimed?"rgba(100,100,100,0.5)":"#FCD34D"}}>+50</p>
                  <p className="text-xs" style={{color:"rgba(124,58,237,0.5)"}}>Gacha Coins</p>
                </div>
              </div>
              {dailyBonusJustClaimed && (
                <div className="mt-3 text-center py-2.5 rounded-xl" style={{border:"1px solid rgba(34,197,94,0.3)",background:"rgba(34,197,94,0.10)"}}>
                  <p className="font-black text-sm" style={{color:"#34d399"}}>🎉 +50 Coins coletados!</p>
                </div>
              )}
            </div>
            <div className="px-6 pb-6 space-y-2.5">
              {!dailyBonusClaimed ? (
                <button onClick={handleClaimDailyBonus}
                  className="w-full py-4 rounded-2xl font-black text-lg text-white transition-all hover:scale-[1.02] hover:brightness-110 shadow-2xl"
                  style={{background:"linear-gradient(135deg,#15803d,#22c55e,#16a34a)",boxShadow:"0 8px 32px rgba(34,197,94,0.35)"}}>
                  🎁 Coletar Agora!
                </button>
              ) : (
                <div className="w-full py-4 rounded-2xl text-center font-bold" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(100,100,100,0.14)",color:"rgba(100,100,100,0.6)"}}>
                  Coletado hoje · Volte amanhã
                </div>
              )}
              <button onClick={() => setShowDailyBonus(false)}
                className="w-full py-2.5 rounded-xl border text-sm font-semibold transition-colors hover:bg-white/[0.04]"
                style={{borderColor:"rgba(255,255,255,0.08)",color:"rgba(139,92,246,0.5)"}}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WALLPAPER MODAL */}
      {showWallpaperModal && (
        <div className="fixed inset-0 z-[9500] flex flex-col" style={{background:"rgba(0,0,0,0.94)",backdropFilter:"blur(8px)"}}>
          <div className="flex items-center justify-between px-5 py-4"
            style={{background:"rgba(5,2,18,0.95)",borderBottom:"1px solid rgba(124,58,237,0.22)"}}>
            <div>
              <h2 className="text-white font-black text-xl flex items-center gap-2">🖼️ Tema do Menu</h2>
              <p className="text-xs mt-0.5" style={{color:"rgba(124,58,237,0.5)"}}>Escolha o wallpaper do menu principal</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{background:"rgba(12,7,2,0.88)",border:"1px solid rgba(245,158,11,0.2)"}}>
                <Image src="/images/icons/gacha-coin.png" alt="" width={16} height={16} className="object-contain" />
                <span className="font-black text-sm" style={{color:"#FCD34D"}}>{coins.toLocaleString()}</span>
              </div>
              <button onClick={() => setShowWallpaperModal(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/10"
                style={{border:"1px solid rgba(255,255,255,0.1)",color:"rgba(167,139,250,0.7)"}}>
                ✕
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {WALLPAPERS.map(wp => {
                const isSelected = selectedWallpaper === wp.id
                const isUnlocked = unlockedWallpapers.includes(wp.id)
                const canAfford  = coins >= wp.cost
                return (
                  <div key={wp.id}
                    className="relative rounded-2xl overflow-hidden cursor-pointer transition-all"
                    style={{border:isSelected?"2px solid rgba(139,92,246,0.85)":isUnlocked?"1px solid rgba(124,58,237,0.25)":"1px solid rgba(124,58,237,0.10)",boxShadow:isSelected?"0 0 22px rgba(124,58,237,0.32)":"none",transform:isSelected?"scale(1.02)":undefined,opacity:isUnlocked?1:0.82}}
                    onClick={() => { if (isUnlocked) handleSelectWallpaper(wp.id) }}>
                    <div className="relative aspect-video w-full overflow-hidden">
                      {wp.image ? (
                        <div className="absolute inset-0" style={{backgroundImage:`url(${wp.image})`,backgroundSize:"cover",backgroundPosition:"center"}} />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1" style={{background:"linear-gradient(145deg,#04081A,#070D24)"}}>
                          <span className="text-2xl">✨</span><span className="text-[10px]" style={{color:"rgba(124,58,237,0.5)"}}>Padrão</span>
                        </div>
                      )}
                      {!isUnlocked && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{background:"rgba(0,0,0,0.72)"}}>
                          <span className="text-3xl">🔒</span>
                          <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{background:"rgba(12,7,2,0.92)",border:"1px solid rgba(245,158,11,0.35)"}}>
                            <Image src="/images/icons/gacha-coin.png" alt="" width={14} height={14} className="object-contain" />
                            <span className="font-black text-xs" style={{color:"#FCD34D"}}>{wp.cost}</span>
                          </div>
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-lg" style={{background:"rgba(124,58,237,0.92)"}}>
                          <span className="text-white text-xs font-black">✓</span>
                        </div>
                      )}
                    </div>
                    <div className="px-3 py-2.5" style={{background:"rgba(5,2,18,0.94)"}}>
                      <p className="text-white font-bold text-sm truncate">{wp.name}</p>
                      <p className="text-xs truncate" style={{color:"rgba(124,58,237,0.52)"}}>{wp.description}</p>
                      <div className="mt-2">
                        {isSelected ? (
                          <div className="w-full py-1.5 rounded-lg text-center text-[11px] font-black" style={{background:"rgba(88,28,135,0.25)",border:"1px solid rgba(124,58,237,0.30)",color:"rgba(167,139,250,0.9)"}}>✓ Ativo</div>
                        ) : isUnlocked ? (
                          <button onClick={e => { e.stopPropagation(); handleSelectWallpaper(wp.id) }}
                            className="w-full py-1.5 rounded-lg text-center text-[11px] font-bold text-white transition-all hover:brightness-110"
                            style={{background:"linear-gradient(135deg,#5b21b6,#7c3aed)"}}>Selecionar</button>
                        ) : (
                          <button onClick={e => { e.stopPropagation(); if (canAfford) handleUnlockWallpaper(wp) }}
                            disabled={!canAfford}
                            className="w-full py-1.5 rounded-lg text-center text-[11px] font-black flex items-center justify-center gap-1 transition-all"
                            style={canAfford?{background:"linear-gradient(135deg,#92400E,#D97706)",color:"#000"}:{background:"rgba(28,28,28,0.8)",border:"1px solid rgba(100,100,100,0.2)",color:"rgba(150,150,150,0.6)"}}>
                            {canAfford ? <><Image src="/images/icons/gacha-coin.png" alt="" width={14} height={14} className="object-contain" />{wp.cost} — Desbloquear</> : <>🔒 Coins insuficientes</>}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
