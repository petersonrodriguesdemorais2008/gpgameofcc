"use client"
import { useEffect, useState, useMemo, useRef } from "react"
import { createPortal } from "react-dom"

export interface AttackAnimationProps {
  id:string; startX:number; startY:number; targetX:number; targetY:number
  element:string; isDirect?:boolean; attackerImage?:string; attackerName?:string
  portalTarget?:HTMLElement|null
  onImpact?:(id:string,x:number,y:number,element:string)=>void
  onComplete:(id:string)=>void
}
type Phase="charge"|"release"|"strike"|"impact"|"aftermath"

// ── Timing — longer & weightier for real emotional/cinematic impact ──────────
const T={CHARGE:320,RELEASE:45,STRIKE:260,IMPACT:320,AFTERMATH:950,HITSTOP:95,
  get TOTAL(){return this.CHARGE+this.RELEASE+this.STRIKE+this.IMPACT+this.AFTERMATH}}

// ── RNG ─────────────────────────────────────────────────────────────────────
const h=(s:number)=>{let x=s^0x5851f42d;x=Math.imul(x^(x>>>16),0x45ae5235)|0;x^=x>>>11;return(x>>>0)/4294967296}
const mkP=(n:number,el:string,id:string)=>Array.from({length:n},(_,i)=>{
  const a=h(i*7+id.charCodeAt(0)*13)*360
  const sp=55+h(i*11+97)*165
  return{id:i,angle:a,speed:sp,size:1.5+h(i*13+31)*9,life:.35+h(i*17+53)*.65,
    delay:h(i*19+79)*110,px:sp*Math.cos(a*Math.PI/180),py:sp*Math.sin(a*Math.PI/180)}
})

// ── Palettes ─────────────────────────────────────────────────────────────────
type P={a:string;b:string;c:string;w:string;gl:string;sc:string;rgb:string}
const PALS:Record<string,P>={
  fire:    {a:"#b91c1c",b:"#f97316",c:"#fbbf24",w:"#fff7ed",gl:"rgba(249,115,22,1)",sc:"rgba(239,68,68,.30)",rgb:"249,115,22"},
  pyrus:   {a:"#b91c1c",b:"#f97316",c:"#fbbf24",w:"#fff7ed",gl:"rgba(249,115,22,1)",sc:"rgba(239,68,68,.30)",rgb:"249,115,22"},
  aquos:   {a:"#075985",b:"#0ea5e9",c:"#38bdf8",w:"#f0f9ff",gl:"rgba(14,165,233,1)",sc:"rgba(14,165,233,.22)",rgb:"14,165,233"},
  aquo:    {a:"#075985",b:"#0ea5e9",c:"#38bdf8",w:"#f0f9ff",gl:"rgba(14,165,233,1)",sc:"rgba(14,165,233,.22)",rgb:"14,165,233"},
  water:   {a:"#075985",b:"#0ea5e9",c:"#38bdf8",w:"#f0f9ff",gl:"rgba(14,165,233,1)",sc:"rgba(14,165,233,.22)",rgb:"14,165,233"},
  haos:    {a:"#854d0e",b:"#eab308",c:"#fde047",w:"#fefce8",gl:"rgba(234,179,8,1)",sc:"rgba(234,179,8,.28)",rgb:"234,179,8"},
  light:   {a:"#854d0e",b:"#eab308",c:"#fde047",w:"#fefce8",gl:"rgba(234,179,8,1)",sc:"rgba(234,179,8,.28)",rgb:"234,179,8"},
  lightness:{a:"#854d0e",b:"#eab308",c:"#fde047",w:"#fefce8",gl:"rgba(234,179,8,1)",sc:"rgba(234,179,8,.28)",rgb:"234,179,8"},
  darkus:  {a:"#2e1065",b:"#7c3aed",c:"#a78bfa",w:"#faf5ff",gl:"rgba(124,58,237,1)",sc:"rgba(88,28,135,.34)",rgb:"124,58,237"},
  darkness:{a:"#2e1065",b:"#7c3aed",c:"#a78bfa",w:"#faf5ff",gl:"rgba(124,58,237,1)",sc:"rgba(88,28,135,.34)",rgb:"124,58,237"},
  dark:    {a:"#2e1065",b:"#7c3aed",c:"#a78bfa",w:"#faf5ff",gl:"rgba(124,58,237,1)",sc:"rgba(88,28,135,.34)",rgb:"124,58,237"},
  ventus:  {a:"#064e3b",b:"#10b981",c:"#34d399",w:"#ecfdf5",gl:"rgba(16,185,129,1)",sc:"rgba(16,185,129,.22)",rgb:"16,185,129"},
  wind:    {a:"#064e3b",b:"#10b981",c:"#34d399",w:"#ecfdf5",gl:"rgba(16,185,129,1)",sc:"rgba(16,185,129,.22)",rgb:"16,185,129"},
  void:    {a:"#0f172a",b:"#475569",c:"#94a3b8",w:"#f8fafc",gl:"rgba(71,85,105,1)",sc:"rgba(0,0,0,.42)",rgb:"71,85,105"},
}
const pal=(e:string):P=>PALS[e]||{a:"#3730a3",b:"#6366f1",c:"#a5b4fc",w:"#eef2ff",gl:"rgba(99,102,241,1)",sc:"rgba(99,102,241,.2)",rgb:"99,102,241"}
export type ElementPalette=P
/** Reusable element palette lookup — also used by duel-screen.tsx for the targeting aim line */
export const getElementPalette=(e:string):P=>pal((e||"neutral").toLowerCase().trim())
/** Normalizes any element string variant into one of: fire|aquos|darkness|haos|ventus|void */
export const normalizeElement=(e:string):string=>{
  const x=(e||"").toLowerCase().trim()
  if(["pyrus","fire"].includes(x)) return "fire"
  if(["aquos","aquo","water"].includes(x)) return "aquos"
  if(["darkus","darkness","dark"].includes(x)) return "darkness"
  if(["haos","light","lightness"].includes(x)) return "haos"
  if(["ventus","wind"].includes(x)) return "ventus"
  if(x==="void") return "void"
  return "neutral"
}

type S=React.CSSProperties

// ── Orbit factory ────────────────────────────────────────────────────────────
const ORBS=[44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,76,78]
const orbKFs=ORBS.map(r=>`@keyframes ko${r}{0%{transform:translate3d(${r}px,0,0)}25%{transform:translate3d(0,${r}px,0)}50%{transform:translate3d(-${r}px,0,0)}75%{transform:translate3d(0,-${r}px,0)}100%{transform:translate3d(${r}px,0,0)}}`).join("")
const Orb=({r,sz,c,dur,del,rev=false}:{r:number;sz:number;c:string;dur:number;del:number;rev?:boolean})=>(
  <div style={{position:"absolute",left:0,top:0,width:sz,height:sz,borderRadius:"50%",
    background:c,boxShadow:`0 0 ${sz*2.5}px ${sz}px ${c}`,
    animation:`ko${r} ${dur}ms linear ${del}ms infinite${rev?" reverse":""}`,willChange:"transform"}}/>
)
const Ring=({d,c,bw="2px",glow,an,op=1}:{d:number;c?:string;bw?:string;glow?:string;an?:string;op?:number})=>(
  <div style={{position:"absolute",left:-d/2,top:-d/2,width:d,height:d,borderRadius:"50%",
    border:c?`${bw} solid ${c}`:undefined,boxShadow:glow,opacity:op,animation:an,willChange:"transform,opacity"}}/>
)

// ════════════════════════════════════════════════════════════════════
// CHARGE — each element builds power in a STRUCTURALLY UNIQUE shape
// ════════════════════════════════════════════════════════════════════
function Charge({el,sx,sy}:{el:string;sx:number;sy:number}){
  const P=pal(el)
  const iF=["pyrus","fire"].includes(el), iA=["aquos","aquo","water"].includes(el)
  const iD=["darkus","darkness","dark"].includes(el), iH=["haos","light","lightness"].includes(el)
  const iV=["ventus","wind"].includes(el)

  const fieldAura=(
    <>
      <div style={{position:"fixed",inset:0,pointerEvents:"none",
        background:`radial-gradient(circle 280px at ${sx}px ${sy}px, ${P.sc} 0%, transparent 100%)`,
        animation:`xc-field-build ${T.CHARGE}ms ease-in forwards`,willChange:"opacity"}}/>
      <div style={{position:"fixed",inset:0,pointerEvents:"none",
        background:"radial-gradient(ellipse at center,transparent 22%,rgba(0,0,0,.55) 100%)",
        animation:`xc-vign-build ${T.CHARGE}ms ease-in forwards`,willChange:"opacity"}}/>
    </>
  )

  return <>
    {fieldAura}
    <div style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)"}}>
      <div style={{position:"absolute",left:0,top:0,width:0,height:0}}>

      {/* ═══ FIRE — PULSING FIREBALL WITH CHAOTIC FLAME LICKS ═══ */}
      {iF && <>
        {/* Wobbling molten core (not a clean circle — irregular pulse) */}
        <div style={{position:"absolute",left:-30,top:-30,width:60,height:60,borderRadius:"50%",
          background:"radial-gradient(circle,white 6%,#fde047 22%,#fb923c 46%,#dc2626 74%,#7f1d1d 100%)",
          boxShadow:"0 0 0 8px #f97316,0 0 46px 22px rgba(251,146,60,1),0 0 90px 40px rgba(220,38,38,.85)",
          animation:"xc-fire-wobble .14s ease-in-out infinite",willChange:"transform,opacity"}}/>
        {/* 9 chaotic flame tongues licking upward at irregular angles/heights */}
        {Array.from({length:9},(_,i)=>{
          const a=i*40+((i%3)*7), L=46+((i*17)%26)
          return <div key={i} style={({position:"absolute",left:-9,top:-L,width:18,height:L,
            background:`linear-gradient(to top,${P.a},${P.b} 45%,${P.c} 78%,transparent)`,
            borderRadius:"50% 50% 50% 6px / 60% 60% 35% 35%",transformOrigin:"50% 100%",
            boxShadow:`0 0 14px 5px ${P.gl}`,
            animation:`xc-lick ${380+((i*53)%180)}ms ease-in-out ${i*30}ms infinite`,willChange:"transform,opacity",
            "--la":`${a}deg`}) as React.CSSProperties}/>
        })}
        {/* Embers swirling on TURBULENT (non-circular) paths */}
        {[0,1,2,3,4,5,6,7].map(i=>(
          <div key={i} style={{position:"absolute",left:0,top:0,width:7-((i%3)),height:7-((i%3)),borderRadius:"50%",
            background:i%2===0?"rgba(251,191,36,.96)":"rgba(255,255,255,.9)",
            boxShadow:`0 0 10px 5px ${P.gl}`,
            animation:`xc-ember-swirl ${520+i*60}ms ease-in-out ${i*45}ms infinite`,willChange:"transform,opacity"}}/>
        ))}
        {/* Heat shimmer distortion rings */}
        <Ring d={130} c="rgba(251,146,60,.3)" bw="2px" an="xc-heat-shimmer .22s ease-in-out infinite"/>
        <div style={{position:"absolute",left:-72,top:-72,width:144,height:144,borderRadius:"50%",
          background:"radial-gradient(circle,rgba(251,146,60,.4) 0%,transparent 70%)",
          animation:"xc-fire-wobble .18s ease-in-out infinite"}}/>
      </>}

      {/* ═══ AQUOS — SPIRALING WHIRLPOOL TIGHTENING INWARD ═══ */}
      {iA && <>
        {/* 3 spiral vortex bands rotating + SHRINKING (tightening whirlpool) */}
        {[0,1,2].map(i=>(
          <div key={i} style={{position:"absolute",left:-(78-i*8),top:-(78-i*8),width:(78-i*8)*2,height:(78-i*8)*2,
            borderRadius:"50%",
            background:`conic-gradient(from ${i*60}deg,transparent 0deg 18deg,${i%2===0?P.b:P.c} 18deg 34deg,transparent 34deg 70deg,${i%2===0?P.c:P.b} 70deg 86deg,transparent 86deg 122deg,${i%2===0?P.b:P.c} 122deg 138deg,transparent 138deg 174deg,${i%2===0?P.c:P.b} 174deg 190deg,transparent 190deg 226deg,${i%2===0?P.b:P.c} 226deg 242deg,transparent 242deg 278deg,${i%2===0?P.c:P.b} 278deg 294deg,transparent 294deg 330deg,${i%2===0?P.b:P.c} 330deg 346deg,transparent 346deg 360deg)`,
            filter:"blur(1px)",mixBlendMode:"screen",opacity:.8-i*.14,
            animation:`xc-whirl-${i%2===0?"cw":"ccw"} ${260-i*30}ms linear infinite`,willChange:"transform,opacity"}}/>
        ))}
        {/* Dark drain throat at the center */}
        <div style={{position:"absolute",left:-13,top:-13,width:26,height:26,borderRadius:"50%",
          background:"radial-gradient(circle,#0c4a6e 30%,#082f49 66%,#020617 100%)",
          boxShadow:"inset 0 0 14px 6px rgba(2,8,23,.92)",
          animation:"xc-fire-wobble .16s ease-in-out infinite"}}/>
        {/* Droplets spiraling INWARD (decaying radius, not constant) */}
        {Array.from({length:8},(_,i)=>(
          <div key={i} style={{position:"absolute",left:0,top:0,width:6,height:6,borderRadius:"50%",
            background:"radial-gradient(circle,white,#7dd3fc)",boxShadow:`0 0 9px 4px ${P.gl}`,
            animation:`xc-spiral-in ${680+i*40}ms linear ${i*70}ms infinite`,willChange:"transform,opacity"}}/>
        ))}
        {/* Rising water tendrils around the rim */}
        {Array.from({length:6},(_,i)=>(
          <div key={i} style={({position:"absolute",left:0,top:0,width:"5px",height:"50px",
            background:"linear-gradient(to top,rgba(14,165,233,.85),rgba(56,189,248,.4),transparent)",
            borderRadius:"9999px",transformOrigin:"50% 100%",
            animation:`xc-stream .2s ease-in-out ${i*22}ms infinite`,willChange:"transform,opacity",
            "--r":`${i*60}deg`}) as React.CSSProperties}/>
        ))}
      </>}

      {/* ═══ DARKNESS — COLLAPSING VOID WITH SNAPPING TENDRILS ═══ */}
      {iD && <>
        <Ring d={140} c="rgba(76,29,149,.65)" bw="2px" glow="0 0 40px 18px rgba(88,28,135,.92)" an="xc-collapse .13s ease-in infinite" op={.92}/>
        <Ring d={114} c="#7c3aed" bw="2px" glow="0 0 24px 11px rgba(124,58,237,.75)" an="kr .20s linear infinite" op={.76}/>
        <Ring d={86}  c="#a78bfa" bw="1px" an="ks .14s linear infinite" op={.58}/>
        {Array.from({length:14},(_,i)=>(
          <div key={i} style={({position:"absolute",left:0,top:0,
            width:`${40+((i*13)%16)}px`,height:"2px",
            background:"linear-gradient(to right,rgba(88,28,135,.95),rgba(139,92,246,.4),transparent)",
            borderRadius:"9999px",transformOrigin:"0 50%",
            animation:`xc-tendril .14s ease-in-out ${i*12}ms infinite`,willChange:"transform,opacity",
            "--r":`${i*(360/14)}deg`}) as React.CSSProperties}/>
        ))}
        {Array.from({length:18},(_,i)=>(
          <div key={i} style={({position:"absolute",left:0,top:0,width:"3px",height:"3px",borderRadius:"50%",
            background:"rgba(196,181,253,.9)",
            animation:`xc-converge .20s ease-in ${i*11}ms infinite`,willChange:"transform,opacity",
            "--r":`${i*20}deg`}) as React.CSSProperties}/>
        ))}
        {[[62,8,"rgba(88,28,135,.82)",600,0,true],[56,6,"rgba(168,85,247,.7)",490,150,false],
          [64,7,"rgba(196,181,253,.62)",540,300,true],[58,5,"rgba(76,29,149,.58)",440,90,false],
          [66,6,"rgba(139,92,246,.68)",570,225,true]
        ].map(([r,s,c,dur,del,rv],i)=><Orb key={i} r={r as number} sz={s as number} c={c as string} dur={dur as number} del={del as number} rev={rv as boolean}/>)}
        <div style={{position:"absolute",left:-20,top:-20,width:40,height:40,borderRadius:"50%",
          background:"radial-gradient(circle,#09000f 16%,black 58%)",
          boxShadow:"0 0 0 6px #581c87,0 0 0 14px rgba(88,28,135,.58),0 0 56px 28px rgba(88,28,135,1),0 0 120px 55px rgba(88,28,135,.7)"}}/>
        <div style={{position:"absolute",left:-70,top:-70,width:140,height:140,borderRadius:"50%",
          background:"radial-gradient(circle,rgba(88,28,135,.55) 0%,transparent 72%)",animation:"xc-collapse .10s ease-in infinite"}}/>
      </>}

      {/* ═══ HAOS — ASCENDING LIGHT PILLAR WITH ROTATING HALO ═══ */}
      {iH && <>
        {/* Vertical ascending pillar of light (distinct silhouette, not a sphere) */}
        <div style={{position:"absolute",left:-11,top:-92,width:22,height:96,transformOrigin:"50% 100%",
          background:"linear-gradient(to top,white,rgba(254,240,138,.85),rgba(253,224,71,.4),transparent)",
          borderRadius:"9999px",filter:"blur(3px)",
          animation:"xc-pillar-grow .13s ease-out infinite alternate",willChange:"transform,opacity"}}/>
        {/* Rotating halo ring (donut, distinct from starburst) */}
        <div style={{position:"absolute",left:-66,top:-22,width:132,height:44,borderRadius:"50%",
          border:"4px solid rgba(253,224,71,.85)",boxShadow:"0 0 26px 11px rgba(253,224,71,.6)",
          animation:"xc-halo-spin .9s linear infinite",willChange:"transform"}}/>
        <div style={{position:"absolute",left:-50,top:-15,width:100,height:30,borderRadius:"50%",
          border:"2px solid rgba(255,255,255,.7)",animation:"xc-halo-spin .6s linear infinite reverse"}}/>
        {/* 24 divine rays */}
        {Array.from({length:24},(_,i)=>{
          const l=i%6===0?56:i%3===0?38:i%2===0?24:14
          return <div key={i} style={({position:"absolute",left:0,top:0,width:"2px",height:`${l}px`,
            background:"linear-gradient(to top,transparent,rgba(254,249,195,.92),white)",
            borderRadius:"9999px",transformOrigin:"50% 100%",
            opacity:i%6===0?1:i%3===0?.82:i%2===0?.62:.42,
            animation:`xc-ray .065s ease-in-out ${i%4*12}ms infinite`,willChange:"transform,opacity",
            "--r":`${i*15}deg`,"--ty":`-${l}px`}) as React.CSSProperties}/>
        })}
        {/* White-hot core */}
        <div style={{position:"absolute",left:-26,top:-26,width:52,height:52,borderRadius:"50%",background:"white",
          boxShadow:"0 0 0 9px #fef08a,0 0 0 18px rgba(253,224,71,.5),0 0 76px 38px rgba(254,240,138,1),0 0 140px 56px rgba(253,224,71,.5)",
          animation:"xc-core .05s ease-in-out infinite"}}/>
      </>}

      {/* ═══ VENTUS — SPINNING TORNADO FUNNEL FORMING ═══ */}
      {iV && <>
        {/* Vertical funnel of 6 stacked dashed ellipses (narrow top → wide base) */}
        {Array.from({length:6},(_,i)=>{
          const w=40+i*20, hy=-70+i*14, bw=2.6-i*.3
          return <div key={i} style={{position:"absolute",left:-w/2,top:hy-w*.16,width:w,height:w*.32,
            borderRadius:"50%",border:`${bw}px dashed ${i%2===0?P.b:P.c}`,
            opacity:.92-i*.08,boxShadow:i<2?`0 0 12px 4px ${P.gl}`:undefined,
            animation:`${i%2===0?"ks":"kr"} ${260-i*22}ms linear infinite`,willChange:"transform"}}/>
        })}
        {/* Debris spiraling up the funnel */}
        {Array.from({length:8},(_,i)=>(
          <div key={i} style={{position:"absolute",left:0,top:0,width:5,height:9,borderRadius:"2px",
            background:`linear-gradient(${P.c},rgba(255,255,255,.6))`,boxShadow:`0 0 6px 2px ${P.gl}`,
            animation:`xc-funnel-rise ${420+i*45}ms linear ${i*48}ms infinite`,willChange:"transform,opacity"}}/>
        ))}
        {/* Wind blade arcs at base */}
        {Array.from({length:6},(_,i)=>(
          <div key={i} style={({position:"absolute",left:-18,top:38,width:"36px",height:"3px",
            background:"linear-gradient(to right,transparent,rgba(52,211,153,.88),transparent)",
            borderRadius:"9999px",transformOrigin:"center center",
            animation:`xc-blade 90ms ease-in-out ${i*12}ms infinite`,willChange:"transform,opacity",
            "--r":`${i*60}deg`}) as React.CSSProperties}/>
        ))}
      </>}

      {/* ═══ VOID — GLITCHING FRAGMENTED REALITY ═══ */}
      {!iF&&!iA&&!iD&&!iH&&!iV && <>
        {/* Rotating wireframe diamond (fake-3D via scaleY skew) — distinct silhouette */}
        <div style={{position:"absolute",left:-44,top:-44,width:88,height:88,
          border:"2px solid rgba(148,163,184,.7)",
          animation:"xc-diamond-spin .9s linear infinite",willChange:"transform"}}/>
        <div style={{position:"absolute",left:-32,top:-32,width:64,height:64,
          border:"1px solid rgba(203,213,225,.5)",
          animation:"xc-diamond-spin .6s linear infinite reverse"}}/>
        {/* 9 randomly flickering fragment squares (broken reality) */}
        {Array.from({length:9},(_,i)=>{
          const gx=((i%3)-1)*30, gy=(Math.floor(i/3)-1)*30
          return <div key={i} style={({position:"absolute",left:gx-4,top:gy-4,width:8,height:8,
            background:"rgba(148,163,184,.85)",
            animation:`xc-frag-flicker ${110+((i*37)%90)}ms steps(2) ${i*15}ms infinite`,willChange:"opacity,transform"}) as React.CSSProperties}/>
        })}
        {/* Scan-line glitch bars */}
        {Array.from({length:3},(_,i)=>(
          <div key={i} style={{position:"absolute",left:-50,top:-18+i*18,width:100,height:2,
            background:"rgba(203,213,225,.6)",
            animation:`xc-scanline 140ms steps(4) ${i*30}ms infinite`,willChange:"transform,opacity"}}/>
        ))}
        <div style={{position:"absolute",left:-19,top:-19,width:38,height:38,borderRadius:"50%",
          background:"radial-gradient(circle,white 6%,#94a3b8 28%,#334155 60%,black 100%)",
          boxShadow:"0 0 0 5px #475569,0 0 28px 14px rgba(71,85,105,1),0 0 60px 24px rgba(30,41,59,.82)"}}/>
      </>}

      </div>
    </div>
  </>
}

// ════════════════════════════════════════════════════════════════════
// STRIKE SPEED LINES — TRUE full-viewport overlay, rendered OUTSIDE the
// rotated/positioned flight container (ctr) so position:fixed actually
// spans the real screen instead of being trapped by ctr's transform.
// ════════════════════════════════════════════════════════════════════
function StrikeSpeedLines({el}:{el:string}){
  const P=pal(el)
  return <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:10001}}>
    {Array.from({length:13},(_,i)=>{
      const off=(i-6)*9
      return <div key={i} style={{position:"absolute",left:0,top:`calc(50% + ${off}px)`,
        width:"100vw",height:Math.abs(i-6)<=1?"4px":"1.5px",
        background:`linear-gradient(to right,transparent 0%,${P.b} 35%,${P.b} 65%,transparent 100%)`,
        willChange:"opacity",
        animation:`xs-sline ${T.STRIKE}ms cubic-bezier(.02,0,.05,1) ${i*3}ms forwards`,
        opacity:.28-Math.abs(i-6)*.03}}/>
    })}
  </div>
}

// ════════════════════════════════════════════════════════════════════
// STRIKE — each element travels as a STRUCTURALLY UNIQUE projectile
// ════════════════════════════════════════════════════════════════════
function Strike({el,dist}:{el:string;dist:number}){
  const P=pal(el)
  const easing={fire:"cubic-bezier(.04,0,.02,1)",pyrus:"cubic-bezier(.04,0,.02,1)",
    darkus:"cubic-bezier(.03,0,.04,1)",darkness:"cubic-bezier(.03,0,.04,1)",dark:"cubic-bezier(.03,0,.04,1)",
    haos:"cubic-bezier(.03,0,.03,1)",light:"cubic-bezier(.03,0,.03,1)",lightness:"cubic-bezier(.03,0,.03,1)",
    void:"cubic-bezier(.02,0,.03,1)"}[el]||"cubic-bezier(.05,0,.04,1)"
  const mv:S={animation:`xs-fly ${T.STRIKE}ms ${easing} forwards`,willChange:"transform"}

  const iF=["pyrus","fire"].includes(el), iA=["aquos","aquo","water"].includes(el)
  const iD=["darkus","darkness","dark"].includes(el), iH=["haos","light","lightness"].includes(el)
  const iV=["ventus","wind"].includes(el)

  return <>
    <div style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",...mv}}>
      {/* Inner wave wrapper — gives each element a UNIQUE flight trajectory, not a straight line */}
      <div style={{display:"flex",alignItems:"center",
        animation:`${
          iF ? "xs-wave-fire" : iA ? "xs-wave-aquos" : iD ? "xs-wave-darkness" : iH ? "xs-wave-haos" : iV ? "xs-wave-ventus" : "xs-wave-void"
        } ${T.STRIKE}ms ease-in-out forwards`,willChange:"transform"}}>

      {/* ═══ FIRE — TUMBLING METEOR WITH FLAME TRAIL ═══ */}
      {iF && <>
        <div style={{position:"absolute",width:"300px",height:"34px",
          background:`linear-gradient(to right,transparent,${P.a}20,${P.a}74,${P.b},${P.c}50)`,
          borderRadius:"9999px",filter:"blur(8px)",opacity:.84,
          animation:`xs-trail ${T.STRIKE}ms ease-in forwards`,willChange:"opacity"}}/>
        {[{x:60,y:-22,s:13},{x:96,y:18,s:11},{x:128,y:-18,s:10},{x:156,y:13,s:9},{x:180,y:-12,s:7},{x:200,y:10,s:6}].map((e,i)=>(
          <div key={i} style={{position:"absolute",width:e.s,height:e.s,borderRadius:"50%",
            background:"radial-gradient(circle,white,#fbbf24)",boxShadow:"0 0 16px 8px rgba(251,191,36,1)",
            left:e.x,top:e.y,opacity:.9-i*.1}}/>
        ))}
        {/* Tumbling rotating meteor body with surface flame texture */}
        <div style={{width:"50px",height:"50px",flexShrink:0,borderRadius:"46% 54% 60% 40% / 50% 46% 54% 50%",
          background:"radial-gradient(circle at 35% 35%,white 4%,#fde047 18%,#fb923c 42%,#dc2626 72%,#7f1d1d 100%)",
          boxShadow:`0 0 0 6px ${P.b}aa,0 0 38px 19px ${P.gl},0 0 76px 30px ${P.a}`,
          animation:"xs-tumble .26s linear infinite"}}/>
        <div style={{position:"absolute",width:"24px",height:"24px",right:"-10px",background:"white",
          borderRadius:"50%",boxShadow:"0 0 30px 16px rgba(255,255,255,1)"}}/>
      </>}

      {/* ═══ AQUOS — DRILLING TORRENT OF WATER ═══ */}
      {iA && <>
        <div style={{position:"absolute",width:"280px",height:"30px",
          background:`linear-gradient(to right,transparent,${P.a}18,${P.a}70,${P.b},${P.c}48)`,
          borderRadius:"9999px",filter:"blur(7px)",opacity:.84,
          animation:`xs-trail ${T.STRIKE}ms ease-in forwards`,willChange:"opacity"}}/>
        {/* Corkscrew spiral bands wrapping the travel axis */}
        {[0,1,2].map(i=>(
          <div key={i} style={{position:"absolute",left:30+i*32,top:-19,width:34,height:38,
            borderRadius:"50%",border:`3px solid ${i%2===0?P.b:P.c}`,opacity:.8-i*.12,
            animation:`xs-drill ${130-i*14}ms linear infinite`,willChange:"transform"}}/>
        ))}
        {[{x:62,y:-17,s:12},{x:98,y:14,s:10},{x:128,y:-15,s:9},{x:155,y:10,s:7}].map((e,i)=>(
          <div key={i} style={{position:"absolute",width:e.s,height:e.s,borderRadius:"50%",
            background:"radial-gradient(circle,white,#7dd3fc)",boxShadow:"0 0 14px 7px rgba(56,189,248,.95)",
            left:e.x,top:e.y,opacity:.86-i*.1}}/>
        ))}
        {/* Wave-crest leading edge (not a round orb — a crashing wave shape) */}
        <div style={{width:"50px",height:"42px",flexShrink:0,position:"relative"}}>
          <div style={{position:"absolute",left:0,top:6,width:50,height:34,
            borderRadius:"50% 50% 50% 50% / 65% 65% 35% 35%",
            background:"radial-gradient(circle at 40% 30%,white 6%,#7dd3fc 26%,#0284c7 58%,#0c4a6e 100%)",
            boxShadow:`0 0 0 5px ${P.b}aa,0 0 36px 18px ${P.gl},0 0 70px 28px ${P.a}`}}/>
          <div style={{position:"absolute",left:6,top:-8,width:22,height:18,borderRadius:"50%",
            background:"radial-gradient(circle,white,rgba(255,255,255,.5),transparent)",opacity:.85}}/>
        </div>
        <div style={{position:"absolute",width:"22px",height:"22px",right:"-9px",background:"white",
          borderRadius:"50%",boxShadow:"0 0 28px 14px rgba(255,255,255,1)"}}/>
      </>}

      {/* ═══ DARKNESS — SLICING VOID BLADE ═══ */}
      {iD && <>
        <div style={{position:"absolute",width:"260px",height:"22px",
          background:`linear-gradient(to right,transparent,${P.a}28,${P.a}80,${P.b},${P.c}40)`,
          borderRadius:"9999px",filter:"blur(7px)",opacity:.84,
          animation:`xs-trail ${T.STRIKE}ms ease-in forwards`,willChange:"opacity"}}/>
        {[{x:52,y:-16,w:20,h:4},{x:82,y:13,w:15,h:4},{x:108,y:-14,w:11,h:3},{x:132,y:10,w:9,h:3}].map((s,i)=>(
          <div key={i} style={{position:"absolute",width:s.w,height:s.h,background:`rgba(167,139,250,${.9-i*.12})`,
            borderRadius:"3px",boxShadow:"0 0 12px 6px rgba(88,28,135,.92)",
            left:s.x,top:s.y,transform:`rotate(${i%2===0?-28:24}deg)`,opacity:.84-i*.1}}/>
        ))}
        {/* Crescent blade silhouette — NOT round */}
        <div style={{width:"58px",height:"30px",flexShrink:0,position:"relative"}}>
          <div style={{position:"absolute",left:0,top:0,width:58,height:30,
            borderRadius:"0 60% 60% 0 / 0 100% 100% 0",
            background:`linear-gradient(110deg,${P.a},${P.b} 55%,#c4b5fd)`,
            boxShadow:`0 0 0 4px rgba(124,58,237,.55),0 0 32px 16px ${P.gl},0 0 64px 26px ${P.a}`,
            clipPath:"polygon(0% 50%,55% 0%,100% 50%,55% 100%)"}}/>
        </div>
        <div style={{position:"absolute",width:"16px",height:"16px",right:"-7px",
          background:"#c4b5fd",borderRadius:"50%",boxShadow:"0 0 22px 11px rgba(167,139,250,1)"}}/>
      </>}

      {/* ═══ HAOS — HOLY LASER BEAM ═══ */}
      {iH && <>
        {/* Thin intense beam (not a fat trail — a beam) */}
        <div style={{position:"absolute",width:"320px",height:"10px",
          background:`linear-gradient(to right,transparent,white,rgba(254,240,138,.95),white)`,
          borderRadius:"9999px",boxShadow:"0 0 40px 16px rgba(253,224,71,.85)",
          animation:`xs-trail ${T.STRIKE}ms ease-in forwards`,willChange:"opacity"}}/>
        <div style={{position:"absolute",width:"260px",height:"4px",
          background:"linear-gradient(to right,transparent,white,white)",borderRadius:"9999px",opacity:.96}}/>
        {[{x:68,y:-24,s:14},{x:106,y:19,s:12},{x:140,y:-20,s:11},{x:170,y:14,s:10},{x:196,y:-13,s:8}].map((e,i)=>(
          <div key={i} style={{position:"absolute",width:e.s,height:e.s,borderRadius:"50%",
            background:"radial-gradient(circle,white,#fde047)",boxShadow:"0 0 18px 9px rgba(253,224,71,1)",
            left:e.x,top:e.y,opacity:.92-i*.1}}/>
        ))}
        {/* Cross-shaped arrowhead tip (signature Haos silhouette) */}
        <div style={{width:0,height:0,flexShrink:0,position:"relative"}}>
          <div style={{position:"absolute",left:-22,top:-22,width:44,height:44,
            background:"white",clipPath:"polygon(50% 0%,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0% 50%,38% 38%)",
            boxShadow:"0 0 0 6px #fef08a,0 0 50px 24px rgba(254,240,138,1),0 0 100px 40px rgba(253,224,71,.6)",
            animation:"xc-core .045s ease-in-out infinite"}}/>
        </div>
      </>}

      {/* ═══ VENTUS — FLYING MINI-CYCLONE ═══ */}
      {iV && <>
        <div style={{position:"absolute",width:"270px",height:"26px",
          background:`linear-gradient(to right,transparent,${P.a}18,${P.a}68,${P.b},${P.c}46)`,
          borderRadius:"9999px",filter:"blur(7px)",opacity:.84,
          animation:`xs-trail ${T.STRIKE}ms ease-in forwards`,willChange:"opacity"}}/>
        {/* Vertical funnel rings spinning AROUND the travel direction (perpendicular look) */}
        {[0,1,2,3].map(i=>(
          <div key={i} style={{position:"absolute",left:-13+i*1,top:-(24-i*5),width:26-i*4,height:14-i*2,
            borderRadius:"50%",border:`${2.4-i*.3}px dashed ${i%2===0?P.b:P.c}`,opacity:.92-i*.1,
            animation:`${i%2===0?"ks":"kr"} ${90-i*10}ms linear infinite`,willChange:"transform"}}/>
        ))}
        {[{x:56,y:-15,s:11},{x:88,y:13,s:9},{x:116,y:-13,s:8}].map((e,i)=>(
          <div key={i} style={{position:"absolute",width:e.s,height:e.s,borderRadius:"50%",
            background:"radial-gradient(circle,white,#6ee7b7)",boxShadow:"0 0 14px 7px rgba(52,211,153,.95)",
            left:e.x,top:e.y,opacity:.86-i*.1}}/>
        ))}
        {/* Cyclone body: tapered funnel shape, not round */}
        <div style={{width:"46px",height:"46px",flexShrink:0,position:"relative"}}>
          <div style={{position:"absolute",left:8,top:0,width:30,height:46,
            borderRadius:"50% 50% 50% 50% / 25% 25% 75% 75%",
            background:"radial-gradient(circle,white 8%,#6ee7b7 28%,#059669 60%,#064e3b 100%)",
            boxShadow:`0 0 0 5px ${P.b}aa,0 0 32px 16px ${P.gl},0 0 64px 26px ${P.a}`,
            animation:"ks .14s linear infinite"}}/>
        </div>
      </>}

      {/* ═══ VOID — JITTERING GLITCH FRAGMENT CLUSTER ═══ */}
      {!iF&&!iA&&!iD&&!iH&&!iV && <>
        <div style={{position:"absolute",width:"230px",height:"16px",
          background:"linear-gradient(to right,transparent,rgba(51,65,85,.2),rgba(100,116,139,.5),#64748b,rgba(148,163,184,.35))",
          borderRadius:"9999px",filter:"blur(4px)",opacity:.8,
          animation:`xs-trail ${T.STRIKE}ms ease-in forwards`,willChange:"opacity"}}/>
        {/* Cluster of jittering glitch squares instead of a smooth orb */}
        <div style={{width:38,height:38,flexShrink:0,position:"relative"}}>
          {[[0,0,22],[10,-10,12],[-9,9,10],[8,9,9],[-10,-7,8]].map(([dx,dy,sz],i)=>(
            <div key={i} style={{position:"absolute",left:18+dx-sz/2,top:18+dy-sz/2,width:sz,height:sz,
              background:i===0?"radial-gradient(circle,white 10%,#94a3b8 40%,#334155 100%)":"rgba(148,163,184,.85)",
              boxShadow:i===0?"0 0 0 5px #475569,0 0 30px 15px rgba(71,85,105,1)":"0 0 8px 3px rgba(100,116,139,.7)",
              animation:`xs-jitter ${70+i*17}ms steps(2) ${i*9}ms infinite`,willChange:"transform,opacity"}}/>
          ))}
        </div>
      </>}

      {/* Sonic boom cone (shared) */}
      <div style={{position:"absolute",width:"0",height:"0",right:"42px",top:"-28px",
        borderLeft:`60px solid ${P.sc}`,borderTop:"28px solid transparent",borderBottom:"28px solid transparent"}}/>
      </div>
    </div>
  </>
}

// ════════════════════════════════════════════════════════════════════
// IMPACT — screen shake wrapper + 8 shockwaves + element bursts
// ════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════
// IMPACT SCREEN FX — TRUE full-screen overlay, rendered OUTSIDE the
// rotated/positioned flight container so it always covers the full
// viewport correctly, no matter where on the field the hit lands.
// ════════════════════════════════════════════════════════════════════
function ImpactScreenFX({el}:{el:string}){
  const P=pal(el)
  const iF=["pyrus","fire"].includes(el), iA=["aquos","aquo","water"].includes(el)
  const iD=["darkus","darkness","dark"].includes(el), iH=["haos","light","lightness"].includes(el)
  const iV=["ventus","wind"].includes(el)
  const HS=T.HITSTOP
  return (
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:10001,
      animation:`xi-shake ${T.IMPACT*.8}ms ease-out ${HS}ms forwards`}}>
      {/* Zoom-punch — a hard radial pulse simulating a camera-hit jolt */}
      <div style={{position:"absolute",inset:0,
        background:`radial-gradient(circle at center,${P.gl} 0%,transparent 38%)`,
        animation:`xi-zoom-punch ${T.IMPACT*.42}ms cubic-bezier(.1,.8,.2,1) ${HS}ms forwards`,
        mixBlendMode:"screen",willChange:"transform,opacity"}}/>
      <div style={{position:"absolute",inset:0,background:P.sc,
        animation:`xi-tint ${T.IMPACT}ms ease-out forwards`,willChange:"opacity"}}/>
      <div style={{position:"absolute",inset:0,
        background:"radial-gradient(ellipse at center,transparent 18%,rgba(0,0,0,.88) 100%)",
        animation:`xi-vign ${T.IMPACT}ms ease-out forwards`,willChange:"opacity"}}/>
      <div style={{position:"absolute",inset:0,
        background:`radial-gradient(circle at center,white 0%,${P.w} 16%,${P.c} 40%,transparent 66%)`,
        animation:`xi-flash-hold ${T.IMPACT}ms ease-out forwards`,willChange:"opacity"}}/>
      <div style={{position:"absolute",inset:0,
        background:"radial-gradient(circle at center,rgba(255,30,30,0) 0%,rgba(255,30,30,.26) 100%)",
        animation:`xi-chr ${T.IMPACT}ms ease-out ${HS}ms forwards`,mixBlendMode:"screen",willChange:"transform,opacity"}}/>
      <div style={{position:"absolute",inset:0,
        background:"radial-gradient(circle at center,rgba(30,30,255,0) 0%,rgba(30,30,255,.26) 100%)",
        animation:`xi-chb ${T.IMPACT}ms ease-out ${HS}ms forwards`,mixBlendMode:"screen",willChange:"transform,opacity"}}/>

      {iF && <div style={{position:"absolute",inset:0,
        animation:`xi-fire-border ${T.IMPACT*1.05}ms ease-out ${HS}ms forwards`,willChange:"box-shadow"}}/>}
      {iA && <div style={{position:"absolute",inset:0,
        background:"radial-gradient(circle at center,transparent 0%,rgba(56,189,248,.16) 48%,transparent 72%)",
        animation:`xi-aqua-ripple ${T.IMPACT*1.3}ms ease-out ${HS}ms forwards`,willChange:"transform,opacity"}}/>}
      {iD && <div style={{position:"absolute",inset:0,background:"black",
        animation:`xi-void-flash ${T.IMPACT*.5}ms ease-out ${HS}ms forwards`,willChange:"opacity"}}/>}
      {iH && <>
        <div style={{position:"absolute",inset:0,
          background:"linear-gradient(105deg,transparent 40%,rgba(255,255,255,.92) 50%,transparent 60%)",
          animation:`xi-lens-flare ${T.IMPACT*.85}ms ease-out ${HS}ms forwards`,willChange:"transform,opacity"}}/>
        <div style={{position:"absolute",inset:0,
          background:"linear-gradient(15deg,transparent 44%,rgba(254,240,138,.7) 50%,transparent 56%)",
          animation:`xi-lens-flare ${T.IMPACT*.95}ms ease-out ${HS+35}ms forwards`,willChange:"transform,opacity"}}/>
      </>}
      {iV && Array.from({length:6},(_,i)=>(
        <div key={i} style={{position:"absolute",left:0,top:`${8+i*16}%`,width:"100%",height:"2px",
          background:"linear-gradient(to right,transparent,rgba(52,211,153,.75),transparent)",
          animation:`xi-debris-sweep ${T.IMPACT*.7}ms ease-out ${HS+i*16}ms forwards`,willChange:"transform,opacity"}}/>
      ))}
      {!iF&&!iA&&!iD&&!iH&&!iV && <div style={{position:"absolute",inset:0,
        background:"repeating-linear-gradient(0deg,rgba(148,163,184,.10) 0px,transparent 2px,transparent 5px)",
        animation:`xi-void-scan ${T.IMPACT*.65}ms steps(7) ${HS}ms forwards`,willChange:"transform,opacity"}}/>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// IMPACT SIGIL — giant elemental magic-circle that flashes at the hit
// point, the "ability activate!" anime moment. Anchored at real screen
// pixel coords (fixed), unaffected by ctr's rotation/clipping.
// ════════════════════════════════════════════════════════════════════
function ImpactSigil({el,x,y}:{el:string;x:number;y:number}){
  const P=pal(el)
  const iF=["pyrus","fire"].includes(el), iA=["aquos","aquo","water"].includes(el)
  const iD=["darkus","darkness","dark"].includes(el), iH=["haos","light","lightness"].includes(el)
  const iV=["ventus","wind"].includes(el)
  const HS=T.HITSTOP

  // Outer rune ring — segmented arc pattern unique per element (conic-gradient stripes)
  const ringPattern = iF
    ? "conic-gradient(from 0deg,transparent 0deg 8deg,#fb923c 8deg 22deg,transparent 22deg 38deg,#fbbf24 38deg 52deg,transparent 52deg 68deg,#fb923c 68deg 82deg,transparent 82deg 98deg,#fbbf24 98deg 112deg,transparent 112deg 128deg,#fb923c 128deg 142deg,transparent 142deg 158deg,#fbbf24 158deg 172deg,transparent 172deg 188deg,#fb923c 188deg 202deg,transparent 202deg 218deg,#fbbf24 218deg 232deg,transparent 232deg 248deg,#fb923c 248deg 262deg,transparent 262deg 278deg,#fbbf24 278deg 292deg,transparent 292deg 308deg,#fb923c 308deg 322deg,transparent 322deg 338deg,#fbbf24 338deg 352deg,transparent 352deg 360deg)"
    : iA ? "conic-gradient(from 0deg,transparent 0deg 10deg,#38bdf8 10deg 26deg,transparent 26deg 46deg,#7dd3fc 46deg 62deg,transparent 62deg 82deg,#38bdf8 82deg 98deg,transparent 98deg 118deg,#7dd3fc 118deg 134deg,transparent 134deg 154deg,#38bdf8 154deg 170deg,transparent 170deg 190deg,#7dd3fc 190deg 206deg,transparent 206deg 226deg,#38bdf8 226deg 242deg,transparent 242deg 262deg,#7dd3fc 262deg 278deg,transparent 278deg 298deg,#38bdf8 298deg 314deg,transparent 314deg 334deg,#7dd3fc 334deg 350deg,transparent 350deg 360deg)"
    : iD ? "conic-gradient(from 0deg,transparent 0deg 12deg,#a78bfa 12deg 30deg,transparent 30deg 48deg,#7c3aed 48deg 66deg,transparent 66deg 84deg,#a78bfa 84deg 102deg,transparent 102deg 120deg,#7c3aed 120deg 138deg,transparent 138deg 156deg,#a78bfa 156deg 174deg,transparent 174deg 192deg,#7c3aed 192deg 210deg,transparent 210deg 228deg,#a78bfa 228deg 246deg,transparent 246deg 264deg,#7c3aed 264deg 282deg,transparent 282deg 300deg,#a78bfa 300deg 318deg,transparent 318deg 336deg,#7c3aed 336deg 354deg,transparent 354deg 360deg)"
    : iH ? "conic-gradient(from 0deg,transparent 0deg 6deg,#fde047 6deg 18deg,transparent 18deg 30deg,white 30deg 42deg,transparent 42deg 54deg,#fde047 54deg 66deg,transparent 66deg 78deg,white 78deg 90deg,transparent 90deg 102deg,#fde047 102deg 114deg,transparent 114deg 126deg,white 126deg 138deg,transparent 138deg 150deg,#fde047 150deg 162deg,transparent 162deg 174deg,white 174deg 186deg,transparent 186deg 198deg,#fde047 198deg 210deg,transparent 210deg 222deg,white 222deg 234deg,transparent 234deg 246deg,#fde047 246deg 258deg,transparent 258deg 270deg,white 270deg 282deg,transparent 282deg 294deg,#fde047 294deg 306deg,transparent 306deg 318deg,white 318deg 330deg,transparent 330deg 342deg,#fde047 342deg 354deg,transparent 354deg 360deg)"
    : iV ? "conic-gradient(from 0deg,transparent 0deg 14deg,#34d399 14deg 34deg,transparent 34deg 54deg,#6ee7b7 54deg 74deg,transparent 74deg 94deg,#34d399 94deg 114deg,transparent 114deg 134deg,#6ee7b7 134deg 154deg,transparent 154deg 174deg,#34d399 174deg 194deg,transparent 194deg 214deg,#6ee7b7 214deg 234deg,transparent 234deg 254deg,#34d399 254deg 274deg,transparent 274deg 294deg,#6ee7b7 294deg 314deg,transparent 314deg 334deg,#34d399 334deg 354deg,transparent 354deg 360deg)"
    : "conic-gradient(from 0deg,transparent 0deg 5deg,#94a3b8 5deg 13deg,transparent 13deg 28deg,transparent 28deg 41deg,#64748b 41deg 49deg,transparent 49deg 70deg,#94a3b8 70deg 78deg,transparent 78deg 95deg,transparent 95deg 110deg,#64748b 110deg 118deg,transparent 118deg 138deg,#94a3b8 138deg 146deg,transparent 146deg 165deg,transparent 165deg 178deg,#64748b 178deg 186deg,transparent 186deg 205deg,#94a3b8 205deg 213deg,transparent 213deg 230deg,transparent 230deg 245deg,#64748b 245deg 253deg,transparent 253deg 272deg,#94a3b8 272deg 280deg,transparent 280deg 298deg,transparent 298deg 312deg,#64748b 312deg 320deg,transparent 320deg 340deg,#94a3b8 340deg 348deg,transparent 348deg 360deg)"

  // Inner core glyph silhouette per element (clip-path polygon — a recognizable geometric icon)
  const glyphClip = iF
    ? "polygon(50% 0%,61% 30%,90% 20%,70% 45%,100% 55%,68% 60%,80% 92%,50% 70%,20% 92%,32% 60%,0% 55%,30% 45%,10% 20%,39% 30%)" // blazing star/flame
    : iA ? "polygon(50% 0%,68% 22%,95% 30%,78% 50%,95% 70%,68% 78%,50% 100%,32% 78%,5% 70%,22% 50%,5% 30%,32% 22%)" // hexagonal droplet
    : iD ? "polygon(50% 2%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)" // pentagram fang
    : iH ? "polygon(50% 0%,57% 38%,93% 25%,62% 50%,93% 75%,57% 62%,50% 100%,43% 62%,7% 75%,38% 50%,7% 25%,43% 38%)" // radiant cross-star
    : iV ? "polygon(50% 0%,55% 25%,80% 10%,65% 35%,100% 40%,68% 50%,100% 60%,65% 65%,80% 90%,55% 75%,50% 100%,45% 75%,20% 90%,35% 65%,0% 60%,32% 50%,0% 40%,35% 35%,20% 10%,45% 25%)" // spiral pinwheel
    : "polygon(50% 5%,75% 20%,75% 20%,95% 45%,80% 45%,90% 70%,65% 60%,55% 90%,45% 65%,20% 80%,30% 55%,5% 50%,25% 35%,15% 15%,40% 30%)" // fractured shard

  return (
    <div style={{position:"fixed",left:x,top:y,width:0,height:0,pointerEvents:"none",zIndex:10002}}>
      {/* Outer segmented rune ring — spins in, holds during hitstop, fades */}
      <div style={{position:"absolute",left:-160,top:-160,width:320,height:320,borderRadius:"50%",
        background:ringPattern,filter:"blur(.4px)",
        boxShadow:`0 0 50px 6px ${P.gl}`,
        animation:`xg-ring-in ${T.IMPACT*1.05}ms cubic-bezier(.16,.85,.2,1) forwards, xg-ring-spin ${T.IMPACT*2.4}ms linear forwards`,
        willChange:"transform,opacity"}}/>
      {/* Mid ring — counter-spinning, smaller, double border */}
      <div style={{position:"absolute",left:-118,top:-118,width:236,height:236,borderRadius:"50%",
        border:`2px solid ${P.c}`,opacity:.8,boxShadow:`0 0 30px 6px ${P.gl}`,
        animation:`xg-ring-in ${T.IMPACT*.92}ms cubic-bezier(.16,.85,.2,1) ${HS*.3}ms forwards, xg-ring-spin-rev ${T.IMPACT*1.7}ms linear forwards`,
        willChange:"transform,opacity"}}/>
      <div style={{position:"absolute",left:-100,top:-100,width:200,height:200,borderRadius:"50%",
        border:`1px solid rgba(255,255,255,.6)`,
        animation:`xg-ring-in ${T.IMPACT*.85}ms cubic-bezier(.16,.85,.2,1) ${HS*.5}ms forwards`,
        willChange:"transform,opacity"}}/>
      {/* Central glyph — the elemental "rune" icon, big bright flash */}
      <div style={{position:"absolute",left:-72,top:-72,width:144,height:144,
        background:`linear-gradient(135deg,white,${P.c} 35%,${P.b} 70%)`,
        clipPath:glyphClip,filter:`drop-shadow(0 0 20px ${P.gl})`,
        animation:`xg-glyph-flash ${T.IMPACT*.85}ms cubic-bezier(.1,.7,.15,1) ${HS*.4}ms forwards`,
        willChange:"transform,opacity"}}/>
      {/* Bright core burst behind the glyph */}
      <div style={{position:"absolute",left:-50,top:-50,width:100,height:100,borderRadius:"50%",
        background:"radial-gradient(circle,white,transparent 70%)",
        animation:`xg-core-burst ${T.IMPACT*.6}ms ease-out forwards`,willChange:"transform,opacity"}}/>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// IMPACT — localized epicenter burst, anchored at the exact hit point.
// Rendered un-rotated (counter-rotates ctr's angle) so rings/rays
// always look upright no matter which direction the attack came from.
// ════════════════════════════════════════════════════════════════════
function Impact({el,counterRotate=0}:{el:string;counterRotate?:number}){
  const P=pal(el)
  const iF=["pyrus","fire"].includes(el), iA=["aquos","aquo","water"].includes(el)
  const iD=["darkus","darkness","dark"].includes(el), iH=["haos","light","lightness"].includes(el)
  const iV=["ventus","wind"].includes(el)
  const HS=T.HITSTOP

  return(
      <div style={{position:"absolute",left:0,top:0,width:0,height:0,
        transform:`rotate(${counterRotate}deg)`,willChange:"transform"}}>
        {/* Compression sphere */}
        <div style={{position:"absolute",left:"-125px",top:"-125px",width:"250px",height:"250px",
          borderRadius:"50%",background:P.gl,filter:"blur(40px)",
          animation:`xi-compress ${T.IMPACT}ms ease-out ${HS}ms forwards`,willChange:"transform,opacity"}}/>
        {/* 11 shockwave rings — bigger, more layered, more spectacular */}
        {[{bw:"12px",d:0,spd:1.2,op:1},{bw:"9px",d:18,spd:1.45,op:.95},{bw:"7px",d:38,spd:1.7,op:.88},
          {bw:"5px",d:60,spd:2.05,op:.78},{bw:"4px",d:86,spd:2.5,op:.66},{bw:"3px",d:114,spd:3.1,op:.55},
          {bw:"3px",d:146,spd:3.9,op:.44},{bw:"2px",d:182,spd:5.0,op:.34},{bw:"2px",d:222,spd:6.4,op:.25},
          {bw:"1px",d:266,spd:8.2,op:.16},{bw:"1px",d:316,spd:10.5,op:.09}
        ].map((r,i)=>(
          <div key={i} style={{position:"absolute",left:"-90px",top:"-90px",width:"180px",height:"180px",
            borderRadius:"50%",border:`${r.bw} solid ${i<4?"white":`rgba(255,255,255,${r.op})`}`,
            boxShadow:i<4?`0 0 50px 20px ${P.gl}`:undefined,opacity:r.op,
            animation:`xi-wave ${T.IMPACT*r.spd}ms cubic-bezier(.03,0,.14,1) ${HS+r.d}ms forwards`,
            willChange:"transform,opacity"}}/>
        ))}
        {/* 20 impact rays */}
        {Array.from({length:20},(_,i)=>(
          <div key={i} style={{position:"absolute",left:0,top:0,
            width:"150px",height:i%5===0?"5px":i%2===0?"3px":"2px",
            background:`linear-gradient(to right,white,${P.gl},transparent)`,
            borderRadius:"9999px",transformOrigin:"left center",transform:`rotate(${i*18}deg)`,
            opacity:i%5===0?.92:i%2===0?.68:.48,
            animation:`xi-ray ${T.IMPACT*1.35}ms ease-out ${HS+i*3}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {/* 3 freeze rings */}
        {[{d:120,bw:"7px",del:0},{d:74,bw:"4px",del:12},{d:40,bw:"2px",del:24}].map((r,i)=>(
          <div key={i} style={{position:"absolute",left:-r.d/2,top:-r.d/2,width:r.d,height:r.d,
            borderRadius:"50%",border:`${r.bw} solid white`,
            boxShadow:`0 0 36px 16px ${P.gl},inset 0 0 28px 12px ${P.gl}`,
            animation:`xi-ring ${T.IMPACT}ms ease-out ${HS+r.del}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {/* 4 ground waves */}
        {[{w:400,y:36,del:0,op:.92},{w:300,y:-40,del:18,op:.68},{w:220,y:62,del:36,op:.48},{w:160,y:-64,del:55,op:.32}].map((g,i)=>(
          <div key={i} style={{position:"absolute",left:-g.w/2,top:g.y,width:g.w,height:"20px",
            background:`linear-gradient(to right,transparent,${P.gl},transparent)`,
            borderRadius:"9999px",filter:"blur(6px)",opacity:g.op,
            animation:`xi-gwave ${T.IMPACT*1.5}ms ease-out ${HS+g.del}ms forwards`,willChange:"transform,opacity"}}/>
        ))}

        {/* Element-specific impact bursts */}
        {iF && Array.from({length:10},(_,i)=>(
          <div key={i} style={{position:"absolute",left:"-5px",top:"-5px",width:"10px",height:"75px",
            background:"linear-gradient(to top,rgba(239,68,68,.88),rgba(249,115,22,.55),transparent)",
            borderRadius:"9999px",transformOrigin:"50% 100%",transform:`rotate(${i*36}deg)`,
            animation:`xi-fjet ${T.IMPACT*.88}ms ease-out ${HS+i*7}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {iA && [80,135,195,260,330].map((s,i)=>(
          <div key={i} style={{position:"absolute",left:-s/2,top:-s/2,width:s,height:s,
            borderRadius:"50%",border:`${3-i*.5}px solid rgba(56,189,248,${.88-i*.14})`,
            boxShadow:i<2?`0 0 16px 7px rgba(56,189,248,.58)`:undefined,
            animation:`xi-wring ${T.IMPACT*1.7}ms cubic-bezier(.03,.4,.16,1) ${HS+i*32}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {iD && Array.from({length:14},(_,i)=>(
          <div key={i} style={{position:"absolute",width:"95px",height:"2px",
            background:"linear-gradient(to right,rgba(167,139,250,.92),rgba(88,28,135,.4),transparent)",
            borderRadius:"9999px",transformOrigin:"left center",transform:`rotate(${i*25.7}deg)`,
            animation:`xi-dray ${T.IMPACT*.88}ms ease-out ${HS+i*7}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {iH && <>
          {[0,45,90,135].map((a,i)=>(
            <div key={i} style={{position:"absolute",left:0,top:0,
              width:i<2?"160px":"110px",height:i<2?"6px":"4px",
              background:"linear-gradient(to right,white,rgba(254,240,138,.8),transparent)",
              borderRadius:"9999px",transformOrigin:"left center",transform:`rotate(${a}deg)`,
              animation:`xi-ray ${T.IMPACT*1.15}ms ease-out ${HS+i*10}ms forwards`,opacity:.94,willChange:"transform,opacity"}}/>
          ))}
          {[65,118,175].map((s,i)=>(
            <div key={i} style={{position:"absolute",left:-s/2,top:-s/2,width:s,height:s,
              borderRadius:"50%",border:`${2-i*.45}px solid rgba(253,224,71,${.84-i*.18})`,
              animation:`xi-wave ${T.IMPACT*1.6}ms cubic-bezier(.04,.4,.16,1) ${HS+i*26}ms forwards`,willChange:"transform,opacity"}}/>
          ))}
        </>}
        {iV && Array.from({length:8},(_,i)=>(
          <div key={i} style={{position:"absolute",width:"78px",height:"3px",
            background:`linear-gradient(to right,rgba(52,211,153,.9),transparent)`,
            borderRadius:"9999px",transformOrigin:"left center",transform:`rotate(${i*22.5+11}deg)`,
            animation:`xi-vslash ${T.IMPACT*.82}ms ease-out ${HS+i*9}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {/* Smoke puffs ×4 */}
        {[{sx:-52,c:"rgba(210,210,210,.56)"},{sx:-18,c:"rgba(230,230,230,.50)"},{sx:18,c:"rgba(220,220,220,.52)"},{sx:52,c:"rgba(200,200,200,.48)"}].map((s,i)=>(
          <div key={i} style={({position:"absolute",left:"-36px",top:"-18px",
            width:"72px",height:"72px",borderRadius:"50%",
            background:`radial-gradient(circle,${s.c},transparent)`,filter:"blur(11px)",
            animation:`xi-smoke ${T.AFTERMATH*.7}ms ease-out ${HS+i*20}ms forwards`,"--sx":`${s.sx}px`}) as React.CSSProperties}/>
        ))}
      </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// AFTERMATH — each element has a UNIQUE signature explosion shape
// ════════════════════════════════════════════════════════════════════
function Aftermath({el,pts,counterRotate=0}:{el:string;pts:ReturnType<typeof mkP>;counterRotate?:number}){
  const P=pal(el)
  const iF=["pyrus","fire"].includes(el), iA=["aquos","aquo","water"].includes(el)
  const iD=["darkus","darkness","dark"].includes(el), iH=["haos","light","lightness"].includes(el)
  const iV=["ventus","wind"].includes(el), iVo=el==="void"
  const EC:{[k:string]:{c:string;t:string;g:string}}={
    fire:{c:"white",t:"#fb923c",g:"rgba(251,146,60,1)"},pyrus:{c:"white",t:"#fb923c",g:"rgba(251,146,60,1)"},
    aquos:{c:"white",t:"#38bdf8",g:"rgba(56,189,248,1)"},aquo:{c:"white",t:"#38bdf8",g:"rgba(56,189,248,1)"},water:{c:"white",t:"#38bdf8",g:"rgba(56,189,248,1)"},
    haos:{c:"white",t:"#fde047",g:"rgba(253,224,71,1)"},light:{c:"white",t:"#fde047",g:"rgba(253,224,71,1)"},lightness:{c:"white",t:"#fde047",g:"rgba(253,224,71,1)"},
    darkus:{c:"#c084fc",t:"#581c87",g:"rgba(88,28,135,1)"},darkness:{c:"#c084fc",t:"#581c87",g:"rgba(88,28,135,1)"},dark:{c:"#c084fc",t:"#581c87",g:"rgba(88,28,135,1)"},
    ventus:{c:"white",t:"#34d399",g:"rgba(52,211,153,1)"},wind:{c:"white",t:"#34d399",g:"rgba(52,211,153,1)"},
    void:{c:"#94a3b8",t:"#334155",g:"rgba(100,116,139,1)"},
  }
  const ec=EC[el]||{c:"white",t:P.b,g:P.gl}
  const RR=[44,52,60,68,46,54,62,70,48,56,64,72]

  return(
    // counterRotate cancels ctr's flight-angle rotation so "rises upward" / cross-shaped
    // effects (fire embers, haos cross, ventus funnel) always stay visually upright.
    <div style={{position:"absolute",left:0,top:0,pointerEvents:"none",
      transform:`rotate(${counterRotate}deg)`,willChange:"transform"}}>
      {/* Residual epicenter glow */}
      <div style={{position:"absolute",left:"-36px",top:"-36px",width:"72px",height:"72px",
        borderRadius:"50%",background:`radial-gradient(circle,${ec.g},transparent)`,filter:"blur(16px)",
        animation:`xa-linger ${T.AFTERMATH}ms ease-out forwards`,willChange:"transform,opacity"}}/>

      {/* ── Victory glimmer — 9 slow-drifting sparkles that linger long after the burst,
          giving the finishing blow a lasting emotional "glow" instead of cutting off abruptly ── */}
      {Array.from({length:9},(_,i)=>{
        const a = i * 40
        const r = 70 + (i % 3) * 35
        return <div key={i} style={({position:"absolute",left:"-2px",top:"-2px",
          width:`${3+(i%3)}px`,height:`${3+(i%3)}px`,borderRadius:"50%",
          background:ec.c,boxShadow:`0 0 8px 3px ${ec.g}`,
          animation:`xa-glimmer ${T.AFTERMATH*(.78+(i%4)*.06)}ms ease-out ${280+i*55}ms both`,
          willChange:"transform,opacity",
          "--gx":`${r*Math.cos(a*Math.PI/180)}px`,"--gy":`${r*Math.sin(a*Math.PI/180)-50}px`}) as React.CSSProperties}/>
      })}

      {/* ── Generic particle field (count varies per element) ── */}
      {pts.map(pt=>(
        <div key={pt.id} style={({position:"absolute",left:"-4px",top:"-4px",
          width:`${pt.size}px`,height:`${pt.size}px`,borderRadius:"50%",
          background:`radial-gradient(circle,${ec.c},${ec.t})`,
          boxShadow:`0 0 ${pt.size*2.8}px ${pt.size}px ${ec.g}`,
          animation:`xa-ptcl ${T.AFTERMATH*pt.life}ms cubic-bezier(.04,.38,.16,1) ${pt.delay}ms both`,
          willChange:"transform,opacity","--px":`${pt.px}px`,"--py":`${pt.py}px`}) as React.CSSProperties}/>
      ))}

      {/* ═══ FIRE — FIREBALL EXPLODING INTO FLAMES ═══ */}
      {iF && <>
        {/* Core fireball: pops bright then expands & fades */}
        <div style={{position:"absolute",left:-34,top:-34,width:68,height:68,borderRadius:"50%",
          background:"radial-gradient(circle,white 8%,#fde047 24%,#fb923c 48%,#dc2626 76%,#7f1d1d 100%)",
          boxShadow:"0 0 50px 26px rgba(251,146,60,1),0 0 100px 46px rgba(220,38,38,.8)",
          animation:`xa-fireball ${T.AFTERMATH*.62}ms cubic-bezier(.1,.6,.25,1) forwards`,willChange:"transform,opacity,filter"}}/>
        {/* 12 flame tongues bursting outward from the core */}
        {Array.from({length:12},(_,i)=>{
          const a=i*30, w=14+((i%3)*3), L=44+((i%4)*8)
          return <div key={i} style={({position:"absolute",left:-w/2,top:-L,width:w,height:L,
            background:`linear-gradient(to top,${P.a},${P.b} 45%,${P.c} 78%,transparent)`,
            borderRadius:"50% 50% 50% 6px / 60% 60% 35% 35%",
            transformOrigin:"50% 100%",boxShadow:`0 0 14px 5px ${P.gl}`,
            animation:`xa-flame ${T.AFTERMATH*(.62+(i%3)*.08)}ms cubic-bezier(.15,.7,.25,1) ${i*8}ms both`,
            willChange:"transform,opacity","--fa":`${a}deg`}) as React.CSSProperties}/>
        })}
        {/* 3 shockwave rings from the blast */}
        {[90,150,220].map((d,i)=>(
          <div key={i} style={{position:"absolute",left:-d/2,top:-d/2,width:d,height:d,
            borderRadius:"50%",border:`${2.5-i*.5}px solid rgba(249,115,22,${.72-i*.14})`,
            animation:`xa-rout ${T.AFTERMATH*.6}ms ease-out ${i*40}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {/* Ember rain falling */}
        {Array.from({length:9},(_,i)=>(
          <div key={i} style={({position:"absolute",left:"-3px",top:"-3px",width:"6px",height:"6px",borderRadius:"50%",
            background:"radial-gradient(circle,white,#fbbf24)",boxShadow:"0 0 8px 4px rgba(251,191,36,.98)",
            animation:`xa-ember ${T.AFTERMATH*.86}ms ease-out ${220+i*36}ms both`,
            willChange:"transform,opacity"}) as React.CSSProperties}/>
        ))}
      </>}

      {/* ═══ AQUOS — AQUATIC EXPLOSION WITH WHIRLPOOL ═══ */}
      {iA && <>
        {/* 3 spiral vortex discs: drain inward then burst outward */}
        {[0,1,2].map(i=>{
          const sz=116+i*40
          const dur=T.AFTERMATH*(.92+i*.16)
          return <div key={i} style={{position:"absolute",left:-sz/2,top:-sz/2,width:sz,height:sz,borderRadius:"50%",
            background:`conic-gradient(from ${i*38}deg,transparent 0deg 9deg,${P.b} 9deg 23deg,transparent 23deg 45deg,${P.c} 45deg 59deg,transparent 59deg 81deg,${P.b} 81deg 95deg,transparent 95deg 117deg,${P.c} 117deg 131deg,transparent 131deg 153deg,${P.b} 153deg 167deg,transparent 167deg 189deg,${P.c} 189deg 203deg,transparent 203deg 225deg,${P.b} 225deg 239deg,transparent 239deg 261deg,${P.c} 261deg 275deg,transparent 275deg 297deg,${P.b} 297deg 311deg,transparent 311deg 333deg,${P.c} 333deg 347deg,transparent 347deg 360deg)`,
            filter:"blur(1.5px)",mixBlendMode:"screen",opacity:.82-i*.14,
            animation:`xa-vortex ${dur}ms cubic-bezier(.32,0,.18,1) ${i*22}ms both`,willChange:"transform,opacity"}}/>
        })}
        {/* Dark drain center that collapses then pops */}
        <div style={{position:"absolute",left:-15,top:-15,width:30,height:30,borderRadius:"50%",
          background:"radial-gradient(circle,#0c4a6e 28%,#082f49 64%,#020617 100%)",
          boxShadow:`inset 0 0 16px 7px rgba(2,8,23,.92),0 0 26px 12px ${P.gl}`,
          animation:`xa-drain ${T.AFTERMATH*.6}ms cubic-bezier(.32,0,.18,1) forwards`,willChange:"transform,opacity"}}/>
        {/* 4 ripple rings expanding outward (splash) */}
        {[70,128,196,272].map((d,i)=>(
          <div key={i} style={{position:"absolute",left:-d/2,top:-d/2,width:d,height:d,
            borderRadius:"50%",border:`${2.6-i*.4}px solid rgba(56,189,248,${.85-i*.14})`,
            boxShadow:i<2?`0 0 14px 6px rgba(56,189,248,.58)`:undefined,
            animation:`xa-ripple ${T.AFTERMATH*.66}ms cubic-bezier(.04,.4,.18,1) ${T.AFTERMATH*.28+i*34}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {/* 20 splash droplets bursting out after the drain */}
        {Array.from({length:20},(_,i)=>(
          <div key={i} style={({position:"absolute",width:"8px",height:"8px",borderRadius:"50%",
            background:"radial-gradient(circle,white,#7dd3fc)",boxShadow:"0 0 9px 4px rgba(56,189,248,.95)",
            left:"-4px",top:"-4px",
            animation:`xa-drop ${T.AFTERMATH*.5}ms ease-out ${T.AFTERMATH*.32+i*11}ms both`,"--da":`${i*18}deg`}) as React.CSSProperties}/>
        ))}
        {/* Rising water column */}
        <div style={{position:"absolute",left:"-8px",top:"-60px",width:"16px",height:"70px",
          background:"linear-gradient(to top,rgba(56,189,248,.85),rgba(125,211,252,.4),transparent)",
          borderRadius:"9999px",filter:"blur(4px)",
          animation:`xa-wcol ${T.AFTERMATH*.62}ms ease-out forwards`,willChange:"transform,opacity"}}/>
      </>}

      {/* ═══ DARKNESS — VOID IMPLOSION WITH SHADOW CLAWS ═══ */}
      {iD && <>
        {/* 10 absorption lines pulling everything INWARD */}
        {Array.from({length:10},(_,i)=>(
          <div key={i} style={({position:"absolute",width:"100px",height:"2px",
            background:"linear-gradient(to left,rgba(167,139,250,.95),rgba(88,28,135,.42),transparent)",
            borderRadius:"9999px",transformOrigin:"left center",
            animation:`xa-dabs ${T.AFTERMATH*.42}ms ease-in ${i*8}ms forwards`,willChange:"transform,opacity",
            "--r":`${i*36}deg`}) as React.CSSProperties}/>
        ))}
        {/* 2 collapsing rings (implosion) */}
        {[150,220].map((d,i)=>(
          <div key={i} style={{position:"absolute",left:-d/2,top:-d/2,width:d,height:d,
            borderRadius:"50%",border:`${2-i*.5}px solid rgba(167,139,250,${.62-i*.18})`,
            animation:`xa-rin ${T.AFTERMATH*.4}ms ease-in ${i*30}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {/* 6 shadow claws snapping outward after the implosion */}
        {Array.from({length:6},(_,i)=>{
          const base=i*60
          const a0=base, a1=base+(i%2===0?32:-32), a2=base+(i%2===0?16:-16)
          return <div key={i} style={({position:"absolute",left:0,top:-4,width:68,height:8,
            background:`linear-gradient(to right,${P.a},${P.b},rgba(167,139,250,.35),transparent)`,
            borderRadius:"0 50% 60% 30% / 0 100% 90% 60%",
            transformOrigin:"0 50%",boxShadow:`0 0 12px 5px ${P.gl}`,
            animation:`xa-claw ${T.AFTERMATH*.58}ms cubic-bezier(.18,.82,.22,1) ${T.AFTERMATH*.34+i*8}ms both`,
            willChange:"transform,opacity","--a0":`${a0}deg`,"--a1":`${a1}deg`,"--a2":`${a2}deg`}) as React.CSSProperties}/>
        })}
        {/* 4 reality rift tears */}
        {[-34,-12,12,34].map((x,i)=>(
          <div key={i} style={{position:"absolute",width:"2px",height:"82px",left:x,top:-40,
            background:`linear-gradient(to bottom,transparent,rgba(88,28,135,${.94-i*.06}),transparent)`,
            borderRadius:"9999px",boxShadow:"0 0 9px 4px rgba(88,28,135,.78)",
            animation:`xa-vrift ${T.AFTERMATH*.6}ms ease-out ${T.AFTERMATH*.3+i*26}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {/* Final burst ring as the claws release */}
        <div style={{position:"absolute",left:-90,top:-90,width:180,height:180,borderRadius:"50%",
          border:"2px solid rgba(167,139,250,.5)",
          animation:`xa-rout ${T.AFTERMATH*.5}ms ease-out ${T.AFTERMATH*.34}ms forwards`,willChange:"transform,opacity"}}/>
      </>}

      {/* ═══ HAOS — RADIANT HOLY EXPLOSION ═══ */}
      {iH && <>
        {/* Cross-shaped divine flash */}
        {[0,90].map(a=>(
          <div key={a} style={({position:"absolute",left:-95,top:-4,width:190,height:8,
            background:"linear-gradient(to right,transparent,white,rgba(254,240,138,.95),white,transparent)",
            borderRadius:"9999px",boxShadow:"0 0 28px 13px rgba(253,224,71,.85)",
            animation:`xa-cross ${T.AFTERMATH*.3}ms ease-out forwards`,willChange:"transform,opacity",
            "--r":`${a}deg`}) as React.CSSProperties}/>
        ))}
        {/* 16-point starburst */}
        {Array.from({length:16},(_,i)=>(
          <div key={i} style={({position:"absolute",left:0,top:0,
            width:i%4===0?"150px":i%2===0?"100px":"62px",height:i%4===0?"6px":i%2===0?"4px":"2px",
            background:"linear-gradient(to right,white,rgba(254,240,138,.82),transparent)",
            borderRadius:"9999px",transformOrigin:"left center",
            animation:`xa-dout ${T.AFTERMATH*.5}ms ease-out ${i*9}ms forwards`,
            opacity:i%4===0?1:i%2===0?.82:.56,willChange:"transform,opacity",
            "--r":`${i*22.5}deg`}) as React.CSSProperties}/>
        ))}
        {/* 4 expanding rings */}
        {[72,128,192,268].map((d,i)=>(
          <div key={i} style={{position:"absolute",left:-d/2,top:-d/2,width:d,height:d,
            borderRadius:"50%",border:`${2.2-i*.4}px solid rgba(253,224,71,${.84-i*.15})`,
            boxShadow:i<2?`0 0 14px 6px rgba(253,224,71,.58)`:undefined,
            animation:`xa-rout ${T.AFTERMATH*.58}ms ease-out ${i*36}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {/* Divine pillar with ground flash disc */}
        <div style={{position:"absolute",left:"-13px",top:"-130px",width:"26px",height:"140px",
          background:"linear-gradient(to top,white,rgba(254,240,138,.72),rgba(253,224,71,.3),transparent)",
          borderRadius:"9999px",filter:"blur(6px)",
          animation:`xa-pillar ${T.AFTERMATH*.66}ms ease-out forwards`,willChange:"transform,opacity"}}/>
        <div style={{position:"absolute",left:"-46px",top:"-7px",width:"92px",height:"14px",
          background:"radial-gradient(ellipse,white,rgba(254,240,138,.7),transparent)",
          borderRadius:"9999px",filter:"blur(3px)",
          animation:`xa-gflash ${T.AFTERMATH*.4}ms ease-out forwards`,willChange:"transform,opacity"}}/>
        {/* Halo ring + 8 bursting light orbs */}
        <div style={{position:"absolute",left:-85,top:-85,width:170,height:170,borderRadius:"50%",
          border:"3px solid rgba(253,224,71,.55)",boxShadow:"0 0 24px 10px rgba(253,224,71,.45)",
          animation:`ks 2.6s linear infinite,xa-rout ${T.AFTERMATH*.7}ms ease-out 50ms forwards`,willChange:"transform,opacity"}}/>
        {Array.from({length:8},(_,i)=>(
          <div key={i} style={{position:"absolute",left:0,top:0,transform:`rotate(${i*45}deg)`}}>
            <div style={{width:9,height:9,borderRadius:"50%",background:"white",
              boxShadow:"0 0 14px 7px rgba(254,240,138,1)",
              animation:`xa-halodot ${T.AFTERMATH*.58}ms ease-out 60ms forwards`,willChange:"transform,opacity"}}/>
          </div>
        ))}
      </>}

      {/* ═══ VENTUS — TORNADO WHIRLWIND ═══ */}
      {iV && <>
        {/* Swaying tornado funnel made of 7 spinning rings (wide base → narrow top) */}
        <div style={{position:"absolute",left:0,top:0,
          animation:`xa-sway ${T.AFTERMATH*.9}ms ease-in-out forwards`,willChange:"transform,opacity"}}>
          {Array.from({length:7},(_,i)=>{
            const w=152-i*18, hy=46-i*23, bw=3-i*.32
            const spinDur=540-i*52
            return <div key={i} style={{position:"absolute",left:-w/2,top:hy-w*.17,width:w,height:w*.34,
              borderRadius:"50%",border:`${bw}px dashed ${i%2===0?P.b:P.c}`,
              opacity:.9-i*.06,boxShadow:i<2?`0 0 12px 4px ${P.gl}`:undefined,
              animation:`${i%2===0?"ks":"kr"} ${spinDur}ms linear infinite`,willChange:"transform"}}/>
          })}
          {/* Ground dust ring at funnel base */}
          <div style={{position:"absolute",left:-80,top:18,width:160,height:160,borderRadius:"50%",
            border:`2px dashed rgba(52,211,153,.5)`,opacity:.7,
            animation:"ks 1.4s linear infinite"}}/>
        </div>
        {/* 10 debris particles spiraling up around the funnel */}
        {Array.from({length:10},(_,i)=>{
          const R=RR[i]
          const spinDur=300+i*24
          return <div key={i} style={{position:"absolute",left:0,top:0,
            animation:`xa-rise ${T.AFTERMATH*.82}ms ease-out ${i*26}ms forwards`,willChange:"transform,opacity"}}>
            <div style={{width:6,height:11,borderRadius:"2px",
              background:`linear-gradient(${ec.t},rgba(255,255,255,.6))`,boxShadow:`0 0 6px 2px ${ec.g}`,
              animation:`ko${R} ${spinDur}ms linear ${i%2===0?"":"reverse"} infinite`,willChange:"transform"}}/>
          </div>
        })}
        {/* 8 wind slash streaks */}
        {Array.from({length:8},(_,i)=>(
          <div key={i} style={({position:"absolute",left:0,top:0,width:"74px",height:"3px",
            background:`linear-gradient(to right,rgba(52,211,153,.9),transparent)`,
            borderRadius:"9999px",transformOrigin:"left center",
            animation:`xa-vslash ${T.AFTERMATH*.55}ms ease-out ${i*14}ms forwards`,willChange:"transform,opacity",
            "--r":`${i*45}deg`}) as React.CSSProperties}/>
        ))}
      </>}

      {/* ═══ VOID — REALITY GLITCH FRAGMENTATION ═══ */}
      {iVo && <>
        {/* 10 fragment shards flying outward */}
        {[[48,0,13,5],[65,50,10,4],[-48,0,11,4],[-60,35,9,4],[0,-46,12,5],[0,44,10,4],
          [52,-30,9,3],[-50,-32,10,4],[34,56,8,3],[-32,-58,11,4]
        ].map(([x,y,w,h],i)=>(
          <div key={i} style={({position:"absolute",width:w,height:h,
            background:`rgba(148,163,184,${.86-i*.03})`,borderRadius:"2px",
            boxShadow:"0 0 8px 3px rgba(100,116,139,.74)",
            animation:`xa-vshard ${T.AFTERMATH*.7}ms cubic-bezier(.04,.38,.18,1) ${i*18}ms both`,
            willChange:"transform,opacity","--vx":`${x}px`,"--vy":`${y}px`}) as React.CSSProperties}/>
        ))}
        {/* 4 horizontal scan-line glitch bars */}
        {Array.from({length:4},(_,i)=>(
          <div key={i} style={({position:"absolute",left:-95,top:-26+i*17,width:190,height:3,
            background:"rgba(203,213,225,.55)",
            animation:`xa-glitchpos 90ms steps(3) ${i*23}ms 6,xa-fadeout ${T.AFTERMATH*.5}ms ease-out ${i*25}ms forwards`,
            willChange:"transform,opacity"}) as React.CSSProperties}/>
        ))}
        {/* 6-cell static grid flicker */}
        {Array.from({length:6},(_,i)=>{
          const gx=(i%3-1)*16, gy=(Math.floor(i/3)-.5)*16
          return <div key={i} style={({position:"absolute",left:gx-3,top:gy-3,width:6,height:6,borderRadius:"1px",
            background:"rgba(148,163,184,.85)",
            animation:`xa-static 90ms steps(1) ${i*14}ms 5,xa-fadeout ${T.AFTERMATH*.4}ms ease-out ${i*14}ms forwards`,
            willChange:"opacity"}) as React.CSSProperties}/>
        })}
        {/* 6 reality cracks */}
        {Array.from({length:6},(_,i)=>(
          <div key={i} style={({position:"absolute",left:0,top:0,width:"68px",height:"1px",
            background:"linear-gradient(to right,rgba(148,163,184,.78),transparent)",
            borderRadius:"9999px",transformOrigin:"left center",
            animation:`xa-vslash ${T.AFTERMATH*.5}ms ease-out ${i*16}ms forwards`,willChange:"transform,opacity",
            "--r":`${i*30+9}deg`}) as React.CSSProperties}/>
        ))}
        {/* 2 desaturate rings */}
        {[100,170].map((d,i)=>(
          <div key={i} style={{position:"absolute",left:-d/2,top:-d/2,width:d,height:d,
            borderRadius:"50%",border:`1px solid rgba(148,163,184,${.3-i*.1})`,
            animation:`xa-rout ${T.AFTERMATH*.56}ms ease-out ${i*42}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
      </>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════
export function ElementalAttackAnimation({
  id,startX,startY,targetX,targetY,element,attackerImage,
  portalTarget,onImpact,onComplete,
}:AttackAnimationProps){
  const [phase,setPhase]=useState<Phase>("charge")
  const [mounted,setMounted]=useState(false)
  const dist=Math.hypot(targetX-startX,targetY-startY)
  const aDeg=Math.atan2(targetY-startY,targetX-startX)*(180/Math.PI)
  const el=(element?.toLowerCase().trim()||"neutral")
  const doneRef=useRef(onComplete)
  useEffect(()=>{doneRef.current=onComplete},[onComplete])

  const nPts:{[k:string]:number}={fire:40,pyrus:40,aquos:36,aquo:36,water:36,
    haos:42,light:42,lightness:42,darkus:32,darkness:32,dark:32,ventus:28,wind:28,void:24}
  const pts=useMemo(()=>mkP(nPts[el]??24,el,id),[el,id])

  useEffect(()=>{
    setMounted(true)
    const tms=[
      setTimeout(()=>setPhase("release"),T.CHARGE),
      setTimeout(()=>setPhase("strike"),T.CHARGE+T.RELEASE),
      setTimeout(()=>{setPhase("impact");onImpact?.(id,targetX,targetY,el)},T.CHARGE+T.RELEASE+T.STRIKE),
      setTimeout(()=>setPhase("aftermath"),T.CHARGE+T.RELEASE+T.STRIKE+T.IMPACT),
      setTimeout(()=>doneRef.current(id),T.TOTAL),
    ]
    return()=>tms.forEach(clearTimeout)
  },[id])
  if(!mounted) return null

  const inFlight=phase==="charge"||phase==="release"||phase==="strike"
  const ctr:S=inFlight
    ?{position:"absolute",left:startX,top:startY,width:dist,height:60,marginTop:-30,
       pointerEvents:"none",zIndex:10000,transformOrigin:"0 50%",transform:`rotate(${aDeg}deg)`,
       willChange:"transform",overflow:"visible"}
    :{position:"absolute",left:targetX,top:targetY,width:0,height:60,marginTop:-30,
       pointerEvents:"none",zIndex:10000,transformOrigin:"0 50%",transform:`rotate(${aDeg}deg)`,
       willChange:"transform",overflow:"visible"}

  const kfs=`
    ${orbKFs}
    @keyframes ks{to{transform:rotate(360deg)}}
    @keyframes kr{to{transform:rotate(-360deg)}}
    @keyframes xc-core{0%,100%{transform:scale(1);opacity:.95}50%{transform:scale(1.22);opacity:1}}
    @keyframes xc-burst{0%{transform:scale(.78);opacity:.94}100%{transform:scale(1.42);opacity:0}}
    @keyframes xc-petal{0%,100%{transform:rotate(var(--r,0deg)) translateY(var(--ty,-60px)) scaleY(0);opacity:0}45%{opacity:.92}}
    @keyframes xc-field-build{0%{opacity:0}100%{opacity:1}}
    @keyframes xc-vign-build{0%{opacity:0}100%{opacity:1}}
    @keyframes xc-collapse{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(.82);opacity:1}}
    @keyframes xc-tendril{0%,100%{transform:rotate(var(--r,0deg)) scaleX(.15);opacity:.55}45%{transform:rotate(var(--r,0deg)) scaleX(1);opacity:.95}}
    @keyframes xc-converge{0%{opacity:.82;transform:rotate(var(--r,0deg)) translateX(80px)}100%{opacity:0;transform:rotate(var(--r,0deg)) translateX(0)}}
    @keyframes xc-ray{0%,100%{opacity:var(--op,.72);transform:scaleY(1)}50%{opacity:1;transform:scaleY(1.48)}}
    @keyframes xc-halo{0%,100%{transform:scale(1);opacity:.65}50%{transform:scale(1.30);opacity:1}}
    @keyframes xc-stream{0%,100%{transform:scaleY(0);opacity:0}45%{transform:scaleY(1);opacity:.92}}
    @keyframes xc-blade{0%,100%{transform:scaleX(.6);opacity:.65}50%{transform:scaleX(1.4);opacity:1}}
    @keyframes xc-glitch{0%{opacity:.84}33%{opacity:.18}66%{opacity:.78}100%{opacity:.82}}
    @keyframes xs-fly{0%{transform:translate3d(0,0,0)}100%{transform:translate3d(${dist}px,0,0)}}
    @keyframes xs-trail{0%{opacity:.88}100%{opacity:0}}
    @keyframes xs-sline{0%{transform:translateX(-100%);opacity:0}5%{opacity:.92}68%{opacity:.58}100%{transform:translateX(0);opacity:0}}
    @keyframes xi-shake{0%{transform:translate(0,0)}8%{transform:translate(-10px,-7px)}16%{transform:translate(10px,9px)}24%{transform:translate(-12px,5px)}32%{transform:translate(12px,-9px)}42%{transform:translate(-7px,7px)}52%{transform:translate(7px,-5px)}62%{transform:translate(-4px,3px)}74%{transform:translate(4px,-2px)}86%{transform:translate(-2px,1px)}100%{transform:translate(0,0)}}
    @keyframes xi-tint{0%{opacity:.98}12%{opacity:1}100%{opacity:0}}
    @keyframes xi-vign{0%{opacity:.92}100%{opacity:0}}
    @keyframes xi-flash-hold{0%{opacity:1}28%{opacity:1}45%{opacity:.92}100%{opacity:0}}

    /* ── STRIKE trajectory waves — each element flies differently, not a straight line ── */
    @keyframes xs-wave-fire{0%{transform:translateY(0) rotate(0deg)}30%{transform:translateY(-30px) rotate(-5deg)}65%{transform:translateY(-10px) rotate(2deg)}100%{transform:translateY(8px) rotate(6deg)}}
    @keyframes xs-wave-aquos{0%{transform:translateY(0)}20%{transform:translateY(-18px)}40%{transform:translateY(15px)}60%{transform:translateY(-13px)}80%{transform:translateY(9px)}100%{transform:translateY(0)}}
    @keyframes xs-wave-ventus{0%{transform:translateY(0) rotate(0deg)}14%{transform:translateY(-15px) rotate(8deg)}28%{transform:translateY(11px) rotate(-8deg)}42%{transform:translateY(-13px) rotate(9deg)}57%{transform:translateY(10px) rotate(-8deg)}71%{transform:translateY(-9px) rotate(6deg)}85%{transform:translateY(6px) rotate(-4deg)}100%{transform:translateY(0) rotate(0deg)}}
    @keyframes xs-wave-darkness{0%,100%{transform:translateY(0)}10%{transform:translateY(-6px)}22%{transform:translateY(4px)}35%{transform:translateY(-5px)}48%{transform:translateY(7px)}60%{transform:translateY(-4px)}74%{transform:translateY(5px)}88%{transform:translateY(-3px)}}
    @keyframes xs-wave-haos{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
    @keyframes xs-wave-void{0%{transform:translate(0,0)}12%{transform:translate(4px,-10px)}25%{transform:translate(-5px,7px)}37%{transform:translate(6px,-5px)}50%{transform:translate(-7px,9px)}62%{transform:translate(5px,-7px)}75%{transform:translate(-4px,6px)}87%{transform:translate(3px,-4px)}100%{transform:translate(0,0)}}

    /* ── IMPACT full-screen finishing flourishes ── */
    @keyframes xi-fire-border{0%{box-shadow:inset 0 0 70px 35px rgba(249,115,22,.85),inset 0 0 160px 80px rgba(220,38,38,.5)}100%{box-shadow:inset 0 0 0px 0px rgba(249,115,22,0)}}
    @keyframes xi-aqua-ripple{0%{transform:scale(.25);opacity:.95}100%{transform:scale(2.8);opacity:0}}
    @keyframes xi-void-flash{0%{opacity:.88}100%{opacity:0}}
    @keyframes xi-lens-flare{0%{opacity:0;transform:translateX(-32%)}32%{opacity:1}100%{opacity:0;transform:translateX(32%)}}
    @keyframes xi-debris-sweep{0%{transform:translateX(-110%);opacity:0}30%{opacity:1}100%{transform:translateX(110%);opacity:0}}
    @keyframes xi-void-scan{0%{opacity:.92;transform:translateY(0)}100%{opacity:0;transform:translateY(34px)}}
    @keyframes xi-chr{0%{opacity:.9;transform:translate(-14px,0)}68%{opacity:.42}100%{opacity:0;transform:translate(-30px,0)}}
    @keyframes xi-chb{0%{opacity:.9;transform:translate(14px,0)}68%{opacity:.42}100%{opacity:0;transform:translate(30px,0)}}
    @keyframes xi-compress{0%{transform:scale(0);opacity:1}58%{opacity:.88}100%{transform:scale(4.5);opacity:0}}
    @keyframes xi-wave{0%{transform:scale(0);opacity:1}74%{opacity:.48}100%{transform:scale(8.5);opacity:0}}
    @keyframes xi-ray{0%{transform:rotate(var(--ra,0deg)) scaleX(0);opacity:1}42%{transform:rotate(var(--ra,0deg)) scaleX(1.8);opacity:.9}100%{transform:rotate(var(--ra,0deg)) scaleX(3.5);opacity:0}}
    @keyframes xi-ring{0%{transform:scale(0);opacity:1}100%{transform:scale(2.5);opacity:0}}
    @keyframes xi-gwave{0%{transform:scaleX(0);opacity:.92}100%{transform:scaleX(1) scaleY(.08);opacity:0}}
    @keyframes xi-smoke{0%{transform:translate(var(--sx,0),0) scale(.22);opacity:.78;filter:blur(6px)}100%{transform:translate(var(--sx,0),-80px) scale(3);opacity:0;filter:blur(20px)}}
    @keyframes xi-fjet{0%{transform:rotate(var(--r,0deg)) scaleY(0);opacity:1}48%{opacity:.85}100%{transform:rotate(var(--r,0deg)) scaleY(1);opacity:0}}
    @keyframes xi-wring{0%{transform:scale(.1);opacity:.92}100%{transform:scale(6);opacity:0}}
    @keyframes xi-dray{0%{transform:rotate(var(--r,0deg)) scaleX(1);opacity:.9}100%{transform:rotate(var(--r,0deg)) scaleX(.05);opacity:0}}
    @keyframes xi-vslash{0%{transform:rotate(var(--r,0deg)) scaleX(0);opacity:.9}52%{opacity:.72}100%{transform:rotate(var(--r,0deg)) scaleX(1.6);opacity:0}}
    @keyframes xa-ptcl{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--px,40px),var(--py,-40px)) scale(0);opacity:0}}
    @keyframes xa-linger{0%{transform:scale(1);opacity:.92}68%{opacity:.58}100%{transform:scale(3.5);opacity:0}}
    @keyframes xa-fcol{0%{transform:scaleY(0);opacity:1}62%{opacity:.75}100%{transform:scaleY(1) scaleX(.3);opacity:0}}
    @keyframes xa-ember{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(calc(var(--ex,10px)),calc(-65px - var(--ey,20px))) scale(0);opacity:0}}
    @keyframes xa-rout{0%{transform:scale(0);opacity:.94}100%{transform:scale(5);opacity:0}}
    @keyframes xa-rin{0%{transform:scale(3.8);opacity:.75}100%{transform:scale(0);opacity:0}}
    @keyframes xa-ripple{0%{transform:scale(.1);opacity:.94}100%{transform:scale(6);opacity:0}}
    @keyframes xa-drop{0%{transform:rotate(var(--da,0deg)) translateX(0) scale(1);opacity:1}100%{transform:rotate(var(--da,0deg)) translateX(115px) scale(0);opacity:0}}
    @keyframes xa-wcol{0%{transform:scaleY(0);opacity:1}62%{opacity:.72}100%{transform:scaleY(1) scaleX(.32);opacity:0}}
    @keyframes xa-dabs{0%{transform:rotate(var(--r,0deg)) scaleX(1);opacity:.92}100%{transform:rotate(var(--r,0deg)) scaleX(.04);opacity:0}}
    @keyframes xa-vrift{0%{transform:scaleY(0);opacity:.94}44%{transform:scaleY(1.14);opacity:.88}100%{transform:scaleY(.88);opacity:0}}
    @keyframes xa-dout{0%{transform:rotate(var(--r,0deg)) scaleX(0);opacity:1}44%{opacity:.92}100%{transform:rotate(var(--r,0deg)) scaleX(1.3);opacity:0}}
    @keyframes xa-pillar{0%{transform:scaleY(0);opacity:1}62%{opacity:.78}100%{transform:scaleY(1) scaleX(.25);opacity:0}}
    @keyframes xa-vslash{0%{transform:rotate(var(--r,0deg)) scaleX(0);opacity:.92}54%{opacity:.76}100%{transform:rotate(var(--r,0deg)) scaleX(1.7);opacity:0}}
    @keyframes xa-vshard{0%{transform:translate(0,0) rotate(0deg) scale(1);opacity:1}100%{transform:translate(var(--vx,30px),var(--vy,-30px)) rotate(210deg) scale(0);opacity:0}}
    @keyframes afterimage-fade{0%{opacity:.44;filter:blur(4px) brightness(2)}100%{opacity:0;filter:blur(10px) brightness(2.8)}}

    /* ── Zoom-punch — camera-hit jolt at the moment of impact ── */
    @keyframes xi-zoom-punch{0%{transform:scale(.15);opacity:0}22%{transform:scale(1);opacity:.95}55%{opacity:.5}100%{transform:scale(2.4);opacity:0}}

    /* ── Impact Sigil — the "ability activate!" magic-circle moment ── */
    @keyframes xg-ring-in{0%{transform:scale(.05);opacity:0}26%{transform:scale(1.12);opacity:1}42%{transform:scale(1);opacity:1}78%{opacity:.7}100%{transform:scale(1.3);opacity:0}}
    @keyframes xg-ring-spin{0%{transform:rotate(0deg) scale(.05)}26%{transform:rotate(95deg) scale(1.12)}42%{transform:rotate(130deg) scale(1)}100%{transform:rotate(340deg) scale(1.3)}}
    @keyframes xg-ring-spin-rev{0%{transform:rotate(0deg) scale(.05)}26%{transform:rotate(-80deg) scale(1.12)}42%{transform:rotate(-110deg) scale(1)}100%{transform:rotate(-300deg) scale(1.3)}}
    @keyframes xg-glyph-flash{0%{transform:scale(0) rotate(-25deg);opacity:0}30%{transform:scale(1.25) rotate(6deg);opacity:1}48%{transform:scale(1) rotate(0deg);opacity:1}80%{opacity:.55}100%{transform:scale(1.4) rotate(8deg);opacity:0}}
    @keyframes xg-core-burst{0%{transform:scale(0);opacity:1}35%{transform:scale(1.6);opacity:.9}100%{transform:scale(3.2);opacity:0}}

    /* ── Victory glimmer — slow drifting sparkles that linger after the burst ── */
    @keyframes xa-glimmer{0%{transform:translate(0,0) scale(0);opacity:0}15%{opacity:1;transform:translate(calc(var(--gx,40px)*.3),calc(var(--gy,-40px)*.3)) scale(1.2)}100%{transform:translate(var(--gx,40px),var(--gy,-40px)) scale(.2);opacity:0}}

    /* ── FIRE charge/strike: wobbling core + licking flames + turbulent embers ── */
    @keyframes xc-fire-wobble{0%,100%{transform:scale(1) translate(0,0);opacity:.95}25%{transform:scale(1.12) translate(2px,-1px);opacity:1}50%{transform:scale(.94) translate(-1px,2px);opacity:.9}75%{transform:scale(1.08) translate(1px,1px);opacity:1}}
    @keyframes xc-lick{0%,100%{transform:rotate(var(--la,0deg)) translateY(0) scaleY(.3) scaleX(.6);opacity:.5}40%{transform:rotate(var(--la,0deg)) translateY(-6px) scaleY(1) scaleX(1);opacity:1}70%{transform:rotate(calc(var(--la,0deg) + 4deg)) translateY(-10px) scaleY(1.15) scaleX(.85);opacity:.85}}
    @keyframes xc-ember-swirl{0%{transform:translate(38px,0) scale(.6);opacity:.3}15%{transform:translate(20px,-30px) scale(1);opacity:1}35%{transform:translate(-25px,-15px) scale(.8);opacity:.9}55%{transform:translate(-15px,25px) scale(1.1);opacity:1}75%{transform:translate(22px,18px) scale(.7);opacity:.8}100%{transform:translate(38px,0) scale(.6);opacity:.3}}
    @keyframes xc-heat-shimmer{0%,100%{transform:scale(1);opacity:.3}50%{transform:scale(1.06);opacity:.55}}
    @keyframes xs-tumble{to{transform:rotate(360deg)}}

    /* ── AQUOS charge/strike: tightening whirlpool + inward spiral + drill ── */
    @keyframes xc-whirl-cw{0%{transform:rotate(0deg) scale(1)}50%{transform:rotate(180deg) scale(.78)}100%{transform:rotate(360deg) scale(1)}}
    @keyframes xc-whirl-ccw{0%{transform:rotate(0deg) scale(1)}50%{transform:rotate(-180deg) scale(.78)}100%{transform:rotate(-360deg) scale(1)}}
    @keyframes xc-spiral-in{0%{transform:rotate(0deg) translateX(50px);opacity:0}10%{opacity:1}90%{transform:rotate(620deg) translateX(4px);opacity:.9}100%{transform:rotate(680deg) translateX(0px);opacity:0}}
    @keyframes xs-drill{to{transform:rotate(360deg)}}

    /* ── HAOS charge: ascending pillar + rotating halo ── */
    @keyframes xc-pillar-grow{0%{transform:scaleY(.4);opacity:.6}100%{transform:scaleY(1);opacity:1}}
    @keyframes xc-halo-spin{to{transform:rotate(360deg)}}

    /* ── VENTUS charge: funnel debris rising ── */
    @keyframes xc-funnel-rise{0%{transform:translateY(20px) translateX(0) scale(.5);opacity:0}20%{opacity:1}100%{transform:translateY(-90px) translateX(8px) scale(1.1);opacity:0}}

    /* ── VOID charge/strike: spinning diamond + flickering fragments + scanlines + jitter ── */
    @keyframes xc-diamond-spin{0%{transform:rotate(0deg) scale(1,1)}50%{transform:rotate(180deg) scale(.7,1)}100%{transform:rotate(360deg) scale(1,1)}}
    @keyframes xc-frag-flicker{0%{opacity:.9;transform:scale(1)}50%{opacity:.15;transform:scale(.4)}100%{opacity:.85;transform:scale(1.1)}}
    @keyframes xc-scanline{0%{transform:translateX(-15px);opacity:.7}50%{transform:translateX(12px);opacity:.3}100%{transform:translateX(-6px);opacity:.6}}
    @keyframes xs-jitter{0%{transform:translate(0,0)}25%{transform:translate(3px,-2px)}50%{transform:translate(-2px,3px)}75%{transform:translate(2px,2px)}100%{transform:translate(0,0)}}

    /* ── FIRE: fireball pop + flame tongues ── */
    @keyframes xa-fireball{0%{transform:scale(.7);opacity:1;filter:brightness(2.4)}16%{transform:scale(1.35);opacity:1;filter:brightness(1.7)}100%{transform:scale(2.6);opacity:0;filter:brightness(1)}}
    @keyframes xa-flame{0%{transform:rotate(var(--fa,0deg)) translateY(0) scaleY(.2) scaleX(.7);opacity:.95}22%{transform:rotate(var(--fa,0deg)) translateY(-10px) scaleY(1) scaleX(1);opacity:1}60%{transform:rotate(calc(var(--fa,0deg) + 5deg)) translateY(-38px) scaleY(1.28) scaleX(.8);opacity:.8}100%{transform:rotate(calc(var(--fa,0deg) - 4deg)) translateY(-74px) scaleY(1.5) scaleX(.35);opacity:0}}

    /* ── AQUOS: whirlpool drain → splash burst ── */
    @keyframes xa-vortex{0%{transform:rotate(0deg) scale(1);opacity:.85}38%{transform:rotate(480deg) scale(.2);opacity:1}44%{transform:rotate(508deg) scale(.16);opacity:1}72%{transform:rotate(700deg) scale(2.1);opacity:.5}100%{transform:rotate(860deg) scale(3.6);opacity:0}}
    @keyframes xa-drain{0%{transform:scale(.55);opacity:.85}40%{transform:scale(1.7);opacity:1}48%{transform:scale(.25);opacity:1}100%{transform:scale(0);opacity:0}}

    /* ── DARKNESS: shadow claw sweep (3-stage angle via CSS vars) ── */
    @keyframes xa-claw{0%{transform:rotate(var(--a0,0deg)) scaleX(.15);opacity:.45}38%{transform:rotate(var(--a0,0deg)) scaleX(.2);opacity:.55}64%{transform:rotate(var(--a1,0deg)) scaleX(1.4);opacity:1}100%{transform:rotate(var(--a2,0deg)) scaleX(.85);opacity:0}}

    /* ── HAOS: divine cross flash + ground flash disc + halo burst dots ── */
    @keyframes xa-cross{0%{transform:rotate(var(--r,0deg)) scaleX(0);opacity:1}30%{transform:rotate(var(--r,0deg)) scaleX(1.65);opacity:1}100%{transform:rotate(var(--r,0deg)) scaleX(2.1);opacity:0}}
    @keyframes xa-gflash{0%{transform:scale(.2);opacity:1}30%{transform:scale(1.3);opacity:.9}100%{transform:scale(2.6);opacity:0}}
    @keyframes xa-halodot{0%{transform:translateX(0) scale(1.7);opacity:1}100%{transform:translateX(98px) scale(.15);opacity:0}}

    /* ── VENTUS: tornado funnel sway + rising debris ── */
    @keyframes xa-sway{0%{transform:translate(0,0) rotate(0deg);opacity:1}30%{transform:translate(9px,-16px) rotate(2deg);opacity:1}60%{transform:translate(-7px,-34px) rotate(-2deg);opacity:.85}100%{transform:translate(4px,-58px) rotate(1deg);opacity:0}}
    @keyframes xa-rise{0%{transform:translateY(0);opacity:1}100%{transform:translateY(-155px);opacity:0}}

    /* ── VOID: glitch stutter + static flicker + fade ── */
    @keyframes xa-glitchpos{0%,100%{transform:translateX(0)}20%{transform:translateX(11px)}40%{transform:translateX(-8px)}60%{transform:translateX(6px)}80%{transform:translateX(-4px)}}
    @keyframes xa-static{0%,49%{opacity:.9}50%,100%{opacity:.08}}
    @keyframes xa-fadeout{0%{opacity:1}100%{opacity:0}}
  `

  const out=(
    <>
      <style>{kfs}</style>
      {attackerImage&&(phase==="charge"||phase==="release")&&(<>
        <div style={{position:"absolute",left:startX-42,top:startY-58,width:84,height:116,
          backgroundImage:`url(${attackerImage})`,backgroundSize:"cover",backgroundPosition:"center",
          borderRadius:"8px",opacity:.44,filter:"blur(4px) brightness(2)",
          animation:"afterimage-fade 255ms ease-out forwards",pointerEvents:"none",zIndex:5,willChange:"opacity"}}/>
        <div style={{position:"absolute",left:startX-42,top:startY-58,width:84,height:116,
          backgroundImage:`url(${attackerImage})`,backgroundSize:"cover",backgroundPosition:"center",
          borderRadius:"8px",opacity:.22,filter:"blur(8px) brightness(2.8)",
          animation:"afterimage-fade 395ms ease-out 58ms forwards",pointerEvents:"none",zIndex:4,willChange:"opacity"}}/>
      </>)}
      <div style={ctr} suppressHydrationWarning>
        {(phase==="charge"||phase==="release")&&<Charge el={el} sx={startX} sy={startY}/>}
        {phase==="strike"&&<Strike el={el} dist={dist}/>}
        {phase==="impact"&&<Impact el={el} counterRotate={-aDeg}/>}
        {phase==="aftermath"&&<Aftermath el={el} pts={pts} counterRotate={-aDeg}/>}
      </div>
      {/* Rendered as SIBLINGS (not nested in the rotated ctr) so they're TRUE full-viewport overlays
          and unaffected by ctr's transform creating a new containing block for fixed descendants */}
      {phase==="strike"&&<StrikeSpeedLines el={el}/>}
      {phase==="impact"&&<ImpactScreenFX el={el}/>}
      {phase==="impact"&&<ImpactSigil el={el} x={targetX} y={targetY}/>}
    </>
  )
  if(portalTarget) return createPortal(out,portalTarget)
  if(typeof document!=="undefined") return createPortal(out,document.body)
  return null
}
