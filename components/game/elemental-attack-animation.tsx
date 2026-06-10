"use client"
import { useEffect, useState, useMemo, useRef } from "react"
import { createPortal } from "react-dom"

export interface AttackAnimationProps {
  id: string; startX: number; startY: number
  targetX: number; targetY: number; element: string
  isDirect?: boolean; attackerImage?: string; attackerName?: string
  portalTarget?: HTMLElement | null
  onImpact?: (id: string, x: number, y: number, element: string) => void
  onComplete: (id: string) => void
}

type Phase = "charge"|"release"|"strike"|"impact"|"aftermath"

// ── Timing constants ──────────────────────────────────────────────────────────
const T = {
  CHARGE:   155,   // short, tense anticipation
  RELEASE:  30,
  STRIKE:   210,   // blazing fast
  IMPACT:   200,   // heavy freeze frame
  AFTERMATH:640,   // long cinematic residual
  get TOTAL() { return this.CHARGE+this.RELEASE+this.STRIKE+this.IMPACT+this.AFTERMATH }
}

// ── Seeded RNG & particle builder ─────────────────────────────────────────────
const seed=(id:string,i:number)=>{let h=(i+1)*2654435761;for(const c of id)h=(h^c.charCodeAt(0)*1000003)>>>0;return h/4294967295}
const rv=(a:number,b:number,v:number)=>a+v*(b-a)
const mkP=(n:number,sp:number,mn:number,mx:number,id:string)=>
  Array.from({length:n}).map((_,i)=>({id:i,
    angle:rv(-sp/2,sp/2,seed(id,i))*(Math.PI/180),
    spd:rv(mn,mx,seed(id,i+100)), sz:rv(2,9,seed(id,i+200)),
    life:rv(.35,1,seed(id,i+300)), del:rv(0,85,seed(id,i+400)),
    jx:rv(-4,4,seed(id,i+500)), jy:rv(-4,4,seed(id,i+600)),
    spin:rv(0,360,seed(id,i+700)), riseY:rv(-24,-72,seed(id,i+800)),
  }))

// ── Palette per element ───────────────────────────────────────────────────────
const PAL:{[k:string]:{a:string;b:string;c:string;d:string;glow:string;screen:string}} = {
  fire:    {a:"#ff4500",b:"#fb923c",c:"#fbbf24",d:"#fff",glow:"rgba(251,146,60,1)",screen:"rgba(255,80,0,0.22)"},
  pyrus:   {a:"#ff4500",b:"#fb923c",c:"#fbbf24",d:"#fff",glow:"rgba(251,146,60,1)",screen:"rgba(255,80,0,0.22)"},
  aquos:   {a:"#0ea5e9",b:"#38bdf8",c:"#7dd3fc",d:"#e0f2fe",glow:"rgba(56,189,248,1)",screen:"rgba(0,150,255,0.18)"},
  aquo:    {a:"#0ea5e9",b:"#38bdf8",c:"#7dd3fc",d:"#e0f2fe",glow:"rgba(56,189,248,1)",screen:"rgba(0,150,255,0.18)"},
  water:   {a:"#0ea5e9",b:"#38bdf8",c:"#7dd3fc",d:"#e0f2fe",glow:"rgba(56,189,248,1)",screen:"rgba(0,150,255,0.18)"},
  haos:    {a:"#eab308",b:"#fde047",c:"#fef9c3",d:"#fff",glow:"rgba(253,224,71,1)",screen:"rgba(255,240,0,0.24)"},
  light:   {a:"#eab308",b:"#fde047",c:"#fef9c3",d:"#fff",glow:"rgba(253,224,71,1)",screen:"rgba(255,240,0,0.24)"},
  lightness:{a:"#eab308",b:"#fde047",c:"#fef9c3",d:"#fff",glow:"rgba(253,224,71,1)",screen:"rgba(255,240,0,0.24)"},
  darkus:  {a:"#4c1d95",b:"#7e22ce",c:"#a855f7",d:"#e9d5ff",glow:"rgba(168,85,247,1)",screen:"rgba(80,0,140,0.28)"},
  darkness:{a:"#4c1d95",b:"#7e22ce",c:"#a855f7",d:"#e9d5ff",glow:"rgba(168,85,247,1)",screen:"rgba(80,0,140,0.28)"},
  dark:    {a:"#4c1d95",b:"#7e22ce",c:"#a855f7",d:"#e9d5ff",glow:"rgba(168,85,247,1)",screen:"rgba(80,0,140,0.28)"},
  ventus:  {a:"#10b981",b:"#34d399",c:"#6ee7b7",d:"#d1fae5",glow:"rgba(52,211,153,1)",screen:"rgba(0,180,100,0.20)"},
  wind:    {a:"#10b981",b:"#34d399",c:"#6ee7b7",d:"#d1fae5",glow:"rgba(52,211,153,1)",screen:"rgba(0,180,100,0.20)"},
  void:    {a:"#334155",b:"#64748b",c:"#94a3b8",d:"#f8fafc",glow:"rgba(148,163,184,1)",screen:"rgba(0,0,0,0.35)"},
  neutral: {a:"#6366f1",b:"#818cf8",c:"#a5b4fc",d:"#fff",glow:"rgba(129,140,248,1)",screen:"rgba(100,100,255,0.18)"},
}
const p=(el:string)=>PAL[el]||PAL.neutral

// ── Easing per element ────────────────────────────────────────────────────────
const EASE:{[k:string]:string}={
  fire:"cubic-bezier(0.06,0,0.04,1)",pyrus:"cubic-bezier(0.06,0,0.04,1)",
  aquos:"cubic-bezier(0.08,0.02,0.06,1)",aquo:"cubic-bezier(0.08,0.02,0.06,1)",water:"cubic-bezier(0.08,0.02,0.06,1)",
  darkus:"cubic-bezier(0.04,0,0.06,1)",darkness:"cubic-bezier(0.04,0,0.06,1)",dark:"cubic-bezier(0.04,0,0.06,1)",
  haos:"cubic-bezier(0.04,0,0.04,1)",light:"cubic-bezier(0.04,0,0.04,1)",lightness:"cubic-bezier(0.04,0,0.04,1)",
  ventus:"cubic-bezier(0.06,0.04,0.04,1.02)",wind:"cubic-bezier(0.06,0.04,0.04,1.02)",
  void:"cubic-bezier(0.02,0,0.04,1)",
}

// ── DOM helpers ───────────────────────────────────────────────────────────────
type S=React.CSSProperties
const abs=(s:S):S=>({position:"absolute",willChange:"transform,opacity",...s})
const Ring=({d,bw="2px",bc,bg,glow,anim,op=1}:{d:number;bw?:string;bc?:string;bg?:string;glow?:string;anim?:string;op?:number})=>(
  <div style={abs({width:d,height:d,marginLeft:-d/2,marginTop:-d/2,borderRadius:"50%",
    border:bc?`${bw} solid ${bc}`:undefined,background:bg,boxShadow:glow,opacity:op,animation:anim})}/>)

// ═══════════════════════════════════════════════════════════════════════════
// CHARGE — dramatic power build-up per element
// ═══════════════════════════════════════════════════════════════════════════
function Charge({el,id}:{el:string;id:string}){
  const pal=p(el)
  const hub=(sz:number,children:React.ReactNode)=>(
    <div style={{position:"absolute",left:0,top:"50%",marginTop:-sz/2,
      width:sz,height:sz,contain:"layout style paint"}}>
      <div style={{position:"absolute",left:sz/2,top:sz/2,width:0,height:0}}>
        {children}
      </div>
    </div>
  )

  const isFire=["pyrus","fire"].includes(el)
  const isAquo=["aquos","aquo","water"].includes(el)
  const isDark=["darkus","darkness","dark"].includes(el)
  const isHaos=["haos","light","lightness"].includes(el)
  const isVent=["ventus","wind"].includes(el)
  const isVoid=el==="void"

  // ─ FIRE ─────────────────────────────────────────────────────────────────
  if(isFire) return hub(128,<>
    {/* Outer unstable corona */}
    <Ring d={122} bc="rgba(251,146,60,0.5)" bw="1px" anim="xa-spin .09s linear infinite" op={.65}/>
    <Ring d={108} bc="#f97316" bw="2px" glow="0 0 32px 14px rgba(249,115,22,.9)" anim="xa-spin .11s linear infinite" op={.88}/>
    <Ring d={84}  bc="#fbbf24" bw="3px" glow="0 0 20px 9px rgba(251,191,36,.82)" anim="xa-spin .07s linear reverse infinite" op={.82}/>
    <Ring d={58}  bc="#ef4444" bw="2px" glow="0 0 16px 9px rgba(239,68,68,.88)"  anim="xa-spin .05s linear infinite" op={.72}/>
    {/* 8 flame petals */}
    {[0,45,90,135,180,225,270,315].map((a,i)=>(
      <div key={i} style={abs({width:"14px",height:"38px",
        background:"linear-gradient(to top,rgba(249,115,22,.95),rgba(251,191,36,.6),transparent)",
        borderRadius:"50% 50% 40% 40%",transformOrigin:"50% 100%",
        transform:`rotate(${a}deg) translateY(-52px)`,
        animation:`xa-flare .08s ease-in-out ${i*20}ms infinite`})}/>
    ))}
    {/* 5 orbiting embers */}
    {[{r:58,s:9,c:"rgba(251,191,36,.98)",dur:170},{r:52,s:7,c:"rgba(249,115,22,.9)",dur:135},
      {r:60,s:6,c:"rgba(255,255,255,.85)",dur:155},{r:50,s:5,c:"rgba(254,100,10,.8)",dur:120},
      {r:56,s:4,c:"rgba(255,200,50,.75)",dur:145}].map((o,i)=>(
      <div key={i} style={abs({width:o.s,height:o.s,borderRadius:"50%",background:o.c,
        boxShadow:`0 0 ${o.s*2}px ${o.s}px ${o.c}`,
        animation:`xa-orbit-${i} ${o.dur}ms linear ${i*30}ms infinite`})}/>
    ))}
    {/* White-hot magma core */}
    <div style={abs({width:44,height:44,borderRadius:"50%",
      background:"radial-gradient(circle,white 8%,#fb923c 28%,#dc2626 62%,#7f1d1d 100%)",
      boxShadow:"0 0 0 7px #f97316,0 0 40px 20px rgba(251,146,60,1),0 0 80px 34px rgba(220,38,38,.8)",
      animation:"xa-pulse .06s ease-in-out infinite"})}/>
    <Ring d={124} bg="radial-gradient(circle,rgba(251,146,60,.3) 0%,transparent 70%)" anim="xa-pulse .1s ease-in-out infinite"/>
    <Ring d={120} bc="rgba(251,146,60,.45)" bw="1px" anim="xa-burst .09s ease-out infinite"/>
    <Ring d={120} bc="rgba(251,146,60,.25)" bw="1px" anim="xa-burst .09s ease-out .045s infinite"/>
    {/* Convergence lines from edges */}
    {[0,30,60,90,120,150,180,210,240,270,300,330].map((a,i)=>(
      <div key={`cv${i}`} style={abs({width:"80px",height:"2px",
        background:`linear-gradient(to left,transparent,${pal.b},.95,transparent)`,
        borderRadius:"9999px",transformOrigin:"right center",
        transform:`rotate(${a}deg) translateX(-100px)`,
        animation:`xa-converge .155s ease-in ${i*10}ms forwards`,opacity:.6})}/>
    ))}
  </>)

  // ─ AQUOS ────────────────────────────────────────────────────────────────
  if(isAquo) return hub(118,<>
    <Ring d={114} bc="rgba(14,165,233,.55)" bw="1px" anim="xa-spin .14s linear infinite" op={.6}/>
    <Ring d={100} bc="#38bdf8" bw="2px" glow="0 0 28px 12px rgba(56,189,248,.82)" anim="xa-spin .18s linear reverse infinite" op={.82}/>
    <Ring d={76}  bc="#7dd3fc" bw="2px" glow="0 0 16px 8px rgba(125,211,252,.75)" anim="xa-spin .12s linear infinite" op={.72}/>
    <Ring d={52}  bc="#bae6fd" bw="1px" anim="xa-spin .09s linear reverse infinite" op={.55}/>
    {[0,72,144,216,288].map((a,i)=>(
      <div key={i} style={abs({width:"4px",height:"44px",
        background:"linear-gradient(to top,rgba(14,165,233,.88),rgba(56,189,248,.4),transparent)",
        borderRadius:"9999px",transformOrigin:"50% 100%",
        transform:`rotate(${a}deg) translateY(-52px)`,
        animation:`xa-aq-stream .22s ease-in-out ${i*40}ms infinite`,opacity:.8})}/>
    ))}
    {[{r:56,s:8,c:"rgba(56,189,248,.95)",dur:280},{r:50,s:6,c:"rgba(125,211,252,.85)",dur:240},
      {r:58,s:5,c:"rgba(255,255,255,.8)",dur:260},{r:52,s:4,c:"rgba(14,165,233,.75)",dur:220}].map((o,i)=>(
      <div key={i} style={abs({width:o.s,height:o.s,borderRadius:"50%",background:o.c,
        boxShadow:`0 0 ${o.s*2}px ${o.s}px ${o.c}`,
        animation:`xa-orbit-${i} ${o.dur}ms linear ${i*60}ms infinite`})}/>
    ))}
    <div style={abs({width:38,height:38,borderRadius:"50%",
      background:"radial-gradient(circle,white 10%,#7dd3fc 32%,#0284c7 65%,#0c4a6e 100%)",
      boxShadow:"0 0 0 6px #38bdf8,0 0 36px 18px rgba(56,189,248,1),0 0 72px 30px rgba(14,165,233,.75)",
      animation:"xa-pulse .09s ease-in-out infinite"})}/>
    <Ring d={110} bg="radial-gradient(circle,rgba(56,189,248,.28) 0%,transparent 70%)" anim="xa-pulse .12s ease-in-out infinite"/>
    <Ring d={116} bc="rgba(56,189,248,.35)" bw="1px" anim="xa-burst .11s ease-out infinite"/>
    {[0,36,72,108,144,180,216,252,288,324].map((a,i)=>(
      <div key={`cv${i}`} style={abs({width:"64px",height:"1px",
        background:`linear-gradient(to left,transparent,${pal.b},transparent)`,
        borderRadius:"9999px",transformOrigin:"right center",
        transform:`rotate(${a}deg) translateX(-80px)`,
        animation:`xa-converge .155s ease-in ${i*12}ms forwards`,opacity:.5})}/>
    ))}
  </>)

  // ─ DARKNESS ─────────────────────────────────────────────────────────────
  if(isDark) return hub(116,<>
    <Ring d={112} bc="rgba(76,29,149,.7)" bw="2px" glow="0 0 38px 16px rgba(88,28,135,.95)" anim="xa-dark-consume .16s ease-in infinite" op={.92}/>
    <Ring d={88}  bc="#a855f7" bw="2px" glow="0 0 22px 10px rgba(168,85,247,.75)" anim="xa-spin .24s linear reverse infinite" op={.76}/>
    <Ring d={64}  bc="#c084fc" bw="1px" anim="xa-spin .15s linear infinite" op={.58}/>
    {[0,40,80,120,160,200,240,280,320].map((a,i)=>(
      <div key={a} style={abs({width:"44px",height:"2px",
        background:"linear-gradient(to right,rgba(88,28,135,.97),rgba(88,28,135,.3),transparent)",
        borderRadius:"9999px",transformOrigin:"left center",
        transform:`rotate(${a}deg) translateX(14px)`,
        animation:`xa-dark-tendril .17s ease-in-out ${i*16}ms infinite`,opacity:.85})}/>
    ))}
    {[{r:56,s:7,c:"rgba(88,28,135,.82)",dur:660},{r:50,s:6,c:"rgba(168,85,247,.7)",dur:540},
      {r:58,s:5,c:"rgba(192,132,252,.6)",dur:600},{r:52,s:4,c:"rgba(76,29,149,.55)",dur:480}].map((o,i)=>(
      <div key={i} style={abs({width:o.s,height:o.s,borderRadius:"50%",background:o.c,
        animation:`xa-orbit-dk${i} ${o.dur}ms linear ${i*150}ms infinite reverse`})}/>
    ))}
    <div style={abs({width:30,height:30,borderRadius:"50%",
      background:"radial-gradient(circle,#0f0a1e 14%,black 55%)",
      boxShadow:"0 0 0 5px #581c87,0 0 0 12px rgba(88,28,135,.6),0 0 52px 26px rgba(88,28,135,1),0 0 100px 44px rgba(88,28,135,.65)"})}/>
    <Ring d={112} bg="radial-gradient(circle,rgba(88,28,135,.56) 0%,transparent 70%)" anim="xa-dark-consume .12s ease-in infinite"/>
    <Ring d={110} bc="rgba(168,85,247,.32)" bw="1px" anim="xa-burst .15s ease-out infinite"/>
    {[0,22,44,66,88,110,132,154,176,198,220,242,264,286,308,330].map((a,i)=>(
      <div key={`cv${i}`} style={abs({width:"70px",height:"2px",
        background:`linear-gradient(to left,transparent,${pal.c},transparent)`,
        borderRadius:"9999px",transformOrigin:"right center",
        transform:`rotate(${a}deg) translateX(-90px)`,
        animation:`xa-converge .155s ease-in ${i*8}ms forwards`,opacity:.45})}/>
    ))}
  </>)

  // ─ HAOS ─────────────────────────────────────────────────────────────────
  if(isHaos) return hub(130,<>
    {Array.from({length:32},(_,i)=>i*11.25).map((a,i)=>(
      <div key={a} style={abs({width:"2px",
        height:i%8===0?"52px":i%4===0?"34px":i%2===0?"22px":"14px",
        background:"linear-gradient(to top,transparent,rgba(254,249,195,.9),white)",
        borderRadius:"9999px",transformOrigin:"50% 100%",
        transform:`rotate(${a}deg) translateY(-${i%8===0?50:i%4===0?32:i%2===0?20:12}px)`,
        opacity:i%8===0?1:i%4===0?.82:i%2===0?.62:.42,
        animation:`xa-haos-ray .065s ease-in-out ${i%4===0?0:i%4===1?16:i%4===2?32:48}ms infinite`})}/>
    ))}
    {[{r:62,s:9,c:"rgba(253,224,71,.99)",dur:130},{r:56,s:7,c:"rgba(255,255,255,.95)",dur:108},
      {r:64,s:7,c:"rgba(254,240,138,.92)",dur:148},{r:58,s:6,c:"rgba(253,224,71,.86)",dur:122},
      {r:62,s:5,c:"rgba(255,255,255,.78)",dur:136}].map((o,i)=>(
      <div key={i} style={abs({width:o.s,height:o.s,borderRadius:"50%",background:o.c,
        boxShadow:`0 0 ${o.s*3}px ${o.s}px ${o.c}`,
        animation:`xa-orbit-ha${i} ${o.dur}ms linear ${i*25}ms infinite`})}/>
    ))}
    <div style={abs({width:46,height:46,borderRadius:"50%",background:"white",
      boxShadow:"0 0 0 8px #fef08a,0 0 0 16px rgba(253,224,71,.55),0 0 72px 36px rgba(254,240,138,1),0 0 130px 56px rgba(253,224,71,.55)",
      animation:"xa-pulse .055s ease-in-out infinite"})}/>
    <Ring d={124} bg="radial-gradient(circle,rgba(254,240,138,.5) 0%,transparent 65%)" anim="xa-haos-halo .07s ease-in-out infinite"/>
    <Ring d={128} bc="rgba(254,240,138,.58)" bw="1px" anim="xa-burst .085s ease-out infinite"/>
    <Ring d={128} bc="rgba(254,240,138,.34)" bw="1px" anim="xa-burst .085s ease-out .042s infinite"/>
    {[0,30,60,90,120,150,180,210,240,270,300,330].map((a,i)=>(
      <div key={`cv${i}`} style={abs({width:"75px",height:"2px",
        background:`linear-gradient(to left,transparent,${pal.b},transparent)`,
        borderRadius:"9999px",transformOrigin:"right center",
        transform:`rotate(${a}deg) translateX(-95px)`,
        animation:`xa-converge .155s ease-in ${i*10}ms forwards`,opacity:.55})}/>
    ))}
  </>)

  // ─ VENTUS ───────────────────────────────────────────────────────────────
  if(isVent) return hub(118,<>
    <Ring d={114} bc="rgba(16,185,129,.55)" bw="1px" anim="xa-spin .12s linear infinite" op={.62}/>
    <Ring d={98}  bc="#34d399" bw="2px" glow="0 0 26px 12px rgba(52,211,153,.82)" anim="xa-spin .09s linear reverse infinite" op={.82}/>
    <Ring d={74}  bc="#6ee7b7" bw="2px" glow="0 0 14px 7px rgba(110,231,183,.75)" anim="xa-spin .07s linear infinite" op={.72}/>
    <Ring d={50}  bc="#a7f3d0" bw="1px" anim="xa-spin .055s linear reverse infinite" op={.55}/>
    {[0,60,120,180,240,300].map((a,i)=>(
      <div key={i} style={abs({width:"28px",height:"3px",
        background:`linear-gradient(to left,transparent,rgba(52,211,153,.9),transparent)`,
        borderRadius:"9999px",transformOrigin:"center center",
        transform:`rotate(${a}deg)`,
        animation:`xa-vent-blade .08s ease-in-out ${i*13}ms infinite`,opacity:.85})}/>
    ))}
    {[{r:56,s:8,c:"rgba(52,211,153,.95)",dur:180},{r:50,s:6,c:"rgba(110,231,183,.85)",dur:145},
      {r:58,s:5,c:"rgba(255,255,255,.8)",dur:160},{r:52,s:4,c:"rgba(16,185,129,.75)",dur:130}].map((o,i)=>(
      <div key={i} style={abs({width:o.s,height:o.s,borderRadius:"50%",background:o.c,
        boxShadow:`0 0 ${o.s*2}px ${o.s}px ${o.c}`,
        animation:`xa-orbit-vt${i} ${o.dur}ms linear ${i*40}ms infinite`})}/>
    ))}
    <div style={abs({width:40,height:40,borderRadius:"50%",
      background:"radial-gradient(circle,white 10%,#6ee7b7 30%,#059669 62%,#064e3b 100%)",
      boxShadow:"0 0 0 6px #34d399,0 0 34px 18px rgba(52,211,153,1),0 0 68px 28px rgba(16,185,129,.75)",
      animation:"xa-pulse .07s ease-in-out infinite"})}/>
    <Ring d={110} bg="radial-gradient(circle,rgba(52,211,153,.28) 0%,transparent 70%)" anim="xa-pulse .1s ease-in-out infinite"/>
  </>)

  // ─ VOID ─────────────────────────────────────────────────────────────────
  return hub(118,<>
    <Ring d={114} bc="rgba(100,116,139,.5)" bw="1px" anim="xa-spin .35s linear infinite" op={.55}/>
    <Ring d={96}  bc="#64748b" bw="2px" glow="0 0 24px 10px rgba(100,116,139,.78)" anim="xa-spin .22s linear reverse infinite" op={.72}/>
    <Ring d={70}  bc="#94a3b8" bw="2px" anim="xa-spin .16s linear infinite" op={.62}/>
    {[0,45,90,135,180,225,270,315].map((a,i)=>(
      <div key={i} style={abs({width:"3px",height:"30px",
        background:`linear-gradient(to top,transparent,rgba(148,163,184,.8),white)`,
        borderRadius:"9999px",transformOrigin:"50% 100%",
        transform:`rotate(${a}deg) translateY(-40px)`,
        animation:`xa-void-static .06s step-end ${i*12}ms infinite`,opacity:.75})}/>
    ))}
    {[{r:52,s:6,c:"rgba(148,163,184,.85)",dur:480},{r:46,s:4,c:"rgba(203,213,225,.75)",dur:360},
      {r:54,s:3,c:"rgba(248,250,252,.65)",dur:420}].map((o,i)=>(
      <div key={i} style={abs({width:o.s,height:o.s,borderRadius:"50%",background:o.c,
        animation:`xa-orbit-vd${i} ${o.dur}ms linear ${i*140}ms infinite`})}/>
    ))}
    <div style={abs({width:28,height:28,borderRadius:"50%",
      background:"radial-gradient(circle,white 8%,#94a3b8 32%,#334155 62%,black 100%)",
      boxShadow:"0 0 0 5px #64748b,0 0 30px 16px rgba(100,116,139,1),0 0 60px 24px rgba(51,65,85,.8)"})}/>
    {[{w:110,op:.3},{w:86,op:.2},{w:64,op:.15}].map((r,i)=>(
      <Ring key={i} d={r.w} bc={`rgba(148,163,184,${r.op})`} bw="1px" anim={`xa-spin ${.8+i*.3}s linear ${i%2===0?"":"reverse"} infinite`}/>
    ))}
  </>)
}

// ═══════════════════════════════════════════════════════════════════════════
// STRIKE — blazing fast projectile with deep trails
// ═══════════════════════════════════════════════════════════════════════════
function Strike({el,dist}:{el:string;dist:number}){
  const pal=p(el)
  const ease=EASE[el]||"cubic-bezier(0.06,0,0.04,1)"
  const mv:S={animation:`xa-move ${T.STRIKE}ms ${ease} forwards`,willChange:"transform"}

  const speedLines=(count:number,color:string,opacity:number)=>
    Array.from({length:count},(_,i)=>i).map(i=>(
      <div key={`sl${i}`} style={{position:"fixed",left:0,
        top:`calc(50% + ${(i-(count-1)/2)*7}px)`,
        width:"100vw",height:i===(count-1)/2?"3px":"1px",
        background:`linear-gradient(to right,transparent,${color},transparent)`,
        pointerEvents:"none",willChange:"opacity",
        animation:`xa-speed-line ${T.STRIKE}ms cubic-bezier(0.03,0,0.07,1) ${i*5}ms forwards`,
        opacity:opacity-Math.abs(i-(count-1)/2)*0.04}}/>
    ))

  // Full set of trails: outer glow → mid body → sharp core
  const trail=(w1:number,h1:number,c1:string,w2:number,h2:number,c2:string,w3:number,h3:number,c3:string,nodes?:React.ReactNode)=>(
    <div style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",
      display:"flex",alignItems:"center",...mv}}>
      {/* Wide outer glow trail */}
      <div style={abs({width:w1,height:h1,background:c1,borderRadius:"9999px",
        filter:"blur(6px)",opacity:.82,animation:`xa-trail-fade ${T.STRIKE}ms ease-in forwards`})}/>
      {/* Mid body */}
      <div style={abs({width:w2,height:h2,background:c2,borderRadius:"9999px",
        filter:"blur(2px)",opacity:.9})}/>
      {/* Sharp bright core */}
      <div style={abs({width:w3,height:h3,background:c3,borderRadius:"9999px",opacity:.96})}/>
      {nodes}
      {/* Bright orb tip */}
      <div style={{width:"44px",height:"44px",flexShrink:0,borderRadius:"50%",
        background:`radial-gradient(circle,white 8%,${pal.b} 30%,${pal.a} 62%,${pal.a} 100%)`,
        boxShadow:`0 0 0 5px ${pal.b},0 0 32px 16px ${pal.glow},0 0 64px 26px ${pal.a}`}}/>
      {/* Nose flare */}
      <div style={{position:"absolute",width:"18px",height:"18px",right:"-8px",
        background:"white",borderRadius:"50%",
        boxShadow:`0 0 26px 13px rgba(255,255,255,1)`}}/>
    </div>
  )

  const isFire=["pyrus","fire"].includes(el)
  const isAquo=["aquos","aquo","water"].includes(el)
  const isDark=["darkus","darkness","dark"].includes(el)
  const isHaos=["haos","light","lightness"].includes(el)
  const isVent=["ventus","wind"].includes(el)
  const isVoid=el==="void"

  return <>
    {speedLines(9,pal.b,.22)}
    {isFire && trail(280,28,`linear-gradient(to right,transparent,rgba(127,29,29,.15),rgba(220,38,38,.42),#f97316,rgba(251,146,60,.45))`,220,14,`linear-gradient(to right,transparent,rgba(220,38,38,.55),#f97316,rgba(251,146,60,.6))`,150,6,`linear-gradient(to right,transparent,#fbbf24,rgba(255,255,255,.75),rgba(251,146,60,.35))`,<>
      {[{x:50,y:-18,s:11},{x:82,y:14,s:9},{x:108,y:-13,s:8},{x:138,y:9,s:7},{x:162,y:-8,s:5}].map((e,i)=>(
        <div key={i} style={abs({width:e.s,height:e.s,borderRadius:"50%",background:"radial-gradient(circle,white,#fbbf24)",boxShadow:"0 0 12px 6px rgba(251,191,36,.95)",left:e.x,top:e.y,opacity:.85-i*.1})}/>
      ))}
      <div style={abs({width:"140px",height:"5px",background:"linear-gradient(to right,transparent,rgba(251,191,36,.75),white,transparent)",top:"-17px",left:"32px",borderRadius:"9999px",opacity:.72})}/>
      <div style={abs({width:"110px",height:"4px",background:"linear-gradient(to right,transparent,rgba(249,115,22,.55),transparent)",top:"14px",left:"52px",borderRadius:"9999px",opacity:.58})}/>
    </>)}
    {isAquo && trail(260,24,`linear-gradient(to right,transparent,rgba(7,89,133,.15),rgba(2,132,199,.4),#0ea5e9,rgba(56,189,248,.42))`,200,12,`linear-gradient(to right,transparent,rgba(2,132,199,.52),#0ea5e9,rgba(56,189,248,.58))`,140,5,`linear-gradient(to right,transparent,#7dd3fc,rgba(255,255,255,.7),rgba(56,189,248,.32))`,<>
      {[{x:55,y:-15,s:10},{x:88,y:12,s:8},{x:116,y:-11,s:7},{x:142,y:8,s:6}].map((e,i)=>(
        <div key={i} style={abs({width:e.s,height:e.s,borderRadius:"50%",background:"radial-gradient(circle,white,#7dd3fc)",boxShadow:"0 0 10px 5px rgba(56,189,248,.92)",left:e.x,top:e.y,opacity:.82-i*.1})}/>
      ))}
      {[{x:65,y:-20,w:5,h:18},{x:95,y:16,w:4,h:14},{x:125,y:-18,w:3,h:12}].map((d,i)=>(
        <div key={i} style={abs({width:d.w,height:d.h,background:`linear-gradient(to top,${pal.a},rgba(255,255,255,.6),transparent)`,borderRadius:"9999px",left:d.x,top:d.y,opacity:.7-i*.15})}/>
      ))}
    </>)}
    {isDark && trail(250,22,`linear-gradient(to right,transparent,rgba(49,10,73,.28),rgba(88,28,135,.58),#581c87,rgba(168,85,247,.44))`,190,12,`linear-gradient(to right,transparent,rgba(88,28,135,.68),#7e22ce,rgba(168,85,247,.52))`,120,5,`linear-gradient(to right,transparent,#a855f7,rgba(192,132,252,.55))`,<>
      {[{x:48,y:-15,w:16,h:3},{x:75,y:11,w:12,h:3},{x:100,y:-11,w:9,h:2},{x:122,y:8,w:7,h:2}].map((s,i)=>(
        <div key={i} style={abs({width:s.w,height:s.h,background:`rgba(168,85,247,${.85-i*.12})`,borderRadius:"2px",boxShadow:"0 0 9px 4px rgba(88,28,135,.88)",left:s.x,top:s.y,transform:`rotate(${i%2===0?-24:20}deg)`,opacity:.8-i*.1})}/>
      ))}
      <div style={abs({width:"108px",height:"3px",background:"linear-gradient(to right,transparent,rgba(88,28,135,.72),transparent)",top:"-18px",left:"32px",borderRadius:"9999px",opacity:.65,transform:"rotate(-7deg)"})}/>
      <div style={abs({width:"88px",height:"3px",background:"linear-gradient(to right,transparent,rgba(88,28,135,.72),transparent)",top:"16px",left:"44px",borderRadius:"9999px",opacity:.65,transform:"rotate(7deg)"})}/>
    </>)}
    {isHaos && trail(300,30,`linear-gradient(to right,transparent,rgba(161,123,0,.18),rgba(234,179,8,.45),#fde047,rgba(254,240,138,.48))`,240,16,`linear-gradient(to right,transparent,rgba(234,179,8,.58),#fde047,rgba(254,240,138,.62))`,160,7,`linear-gradient(to right,transparent,#fef08a,rgba(255,255,255,.85),rgba(253,224,71,.4))`,<>
      {[{x:60,y:-19,s:12},{x:95,y:15,s:10},{x:128,y:-14,s:9},{x:158,y:10,s:8},{x:185,y:-9,s:6}].map((e,i)=>(
        <div key={i} style={abs({width:e.s,height:e.s,borderRadius:"50%",background:"radial-gradient(circle,white,#fde047)",boxShadow:"0 0 14px 7px rgba(253,224,71,.98)",left:e.x,top:e.y,opacity:.88-i*.1})}/>
      ))}
      {[0,45,90,135].map((a,i)=>(
        <div key={i} style={{position:"absolute",width:"30px",height:"2px",
          background:"linear-gradient(to right,white,rgba(254,240,138,.6),transparent)",
          right:"-5px",top:"-1px",borderRadius:"9999px",
          transformOrigin:"left center",transform:`rotate(${a}deg)`,opacity:.7}}/>
      ))}
    </>)}
    {isVent && trail(270,26,`linear-gradient(to right,transparent,rgba(5,78,52,.15),rgba(4,120,87,.42),#10b981,rgba(52,211,153,.44))`,210,13,`linear-gradient(to right,transparent,rgba(4,120,87,.55),#10b981,rgba(52,211,153,.6))`,145,6,`linear-gradient(to right,transparent,#6ee7b7,rgba(255,255,255,.72),rgba(52,211,153,.36))`,<>
      {[{x:55,y:-14,s:10},{x:84,y:12,s:8},{x:110,y:-12,s:7},{x:136,y:8,s:5}].map((e,i)=>(
        <div key={i} style={abs({width:e.s,height:e.s,borderRadius:"50%",background:"radial-gradient(circle,white,#6ee7b7)",boxShadow:"0 0 11px 5px rgba(52,211,153,.92)",left:e.x,top:e.y,opacity:.82-i*.1})}/>
      ))}
      <div style={abs({width:"100px",height:"4px",background:"linear-gradient(to right,transparent,rgba(52,211,153,.7),transparent)",top:"-16px",left:"28px",borderRadius:"9999px",opacity:.65,transform:"rotate(-8deg)"})}/>
    </>)}
    {isVoid && <div style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",display:"flex",alignItems:"center",...mv}}>
      {speedLines(5,"rgba(148,163,184,.3)",.12)}
      <div style={abs({width:220,height:18,background:"linear-gradient(to right,transparent,rgba(51,65,85,.22),rgba(100,116,139,.5),#64748b,rgba(148,163,184,.38))",borderRadius:"9999px",filter:"blur(4px)",opacity:.82,animation:`xa-trail-fade ${T.STRIKE}ms ease-in forwards`})}/>
      <div style={abs({width:170,height:9,background:"linear-gradient(to right,transparent,rgba(100,116,139,.6),#94a3b8",borderRadius:"9999px",filter:"blur(2px)",opacity:.88})}/>
      {[0,30,60,90,120,150].map((a,i)=>(
        <div key={i} style={abs({width:12,height:4,background:"rgba(203,213,225,.8)",borderRadius:"2px",transform:`rotate(${a}deg)`,left:40+i*22,top:-8+i%2*16,opacity:.7-i*.08})}/>
      ))}
      <div style={{width:"36px",height:"36px",flexShrink:0,borderRadius:"50%",background:"radial-gradient(circle,white 8%,#94a3b8 32%,#334155 62%,black 100%)",boxShadow:"0 0 0 5px #64748b,0 0 28px 14px rgba(148,163,184,1),0 0 56px 22px rgba(51,65,85,.7)"}}/>
    </div>}
  </>
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPACT — cinematic freeze frame
// ═══════════════════════════════════════════════════════════════════════════
function Impact({el}:{el:string}){
  const pal=p(el)
  const flash=`radial-gradient(circle at center,white 0%,${pal.d} 22%,${pal.b} 48%,transparent 72%)`
  const glow=pal.glow
  const cr=`radial-gradient(circle at center,rgba(255,30,30,0) 0%,rgba(255,30,30,.22) 100%)`
  const cb=`radial-gradient(circle at center,rgba(30,30,255,0) 0%,rgba(30,30,255,.22) 100%)`
  const screenTint=pal.screen
  return(
    <div style={{position:"absolute",left:"-50vw",top:"-50vh",width:"100vw",height:"100vh",
      pointerEvents:"none",contain:"layout style paint"}}>
      {/* Screen-wide element tint */}
      <div style={{position:"absolute",inset:0,background:screenTint,
        animation:`xa-screen-tint ${T.IMPACT}ms ease-out forwards`,willChange:"opacity"}}/>
      {/* Global vignette darkening */}
      <div style={{position:"absolute",inset:0,
        background:"radial-gradient(ellipse at center,transparent 25%,rgba(0,0,0,.78) 100%)",
        animation:`xa-vignette ${T.IMPACT}ms ease-out forwards`,willChange:"opacity"}}/>
      {/* Full-screen radial flash */}
      <div style={{position:"absolute",inset:0,background:flash,
        animation:`xa-hero-flash ${T.IMPACT}ms linear forwards`,willChange:"opacity"}}/>
      {/* Chromatic aberration — red left */}
      <div style={{position:"absolute",inset:0,background:cr,
        animation:`xa-chroma-r ${T.IMPACT}ms ease-out forwards`,willChange:"opacity,transform",mixBlendMode:"screen"}}/>
      {/* Chromatic aberration — blue right */}
      <div style={{position:"absolute",inset:0,background:cb,
        animation:`xa-chroma-b ${T.IMPACT}ms ease-out forwards`,willChange:"opacity,transform",mixBlendMode:"screen"}}/>
      {/* Impact point */}
      <div style={{position:"absolute",left:"50%",top:"50%",width:0,height:0}}>
        {/* Compression orb */}
        <div style={abs({width:200,height:200,marginLeft:-100,marginTop:-100,borderRadius:"50%",
          background:glow,filter:"blur(32px)",
          animation:`xa-hero-compress ${T.IMPACT}ms ease-out forwards`})}/>
        {/* 6 shockwave rings — main spectacle */}
        {[{sz:150,bw:"8px",d:0,spd:1.4},{sz:150,bw:"5px",d:30,spd:1.7},{sz:150,bw:"3px",d:60,spd:2.1},
          {sz:150,bw:"2px",d:90,spd:2.6},{sz:150,bw:"2px",d:120,spd:3.2},{sz:150,bw:"1px",d:150,spd:4.0}].map((r,i)=>(
          <div key={i} style={abs({width:r.sz,height:r.sz,marginLeft:-r.sz/2,marginTop:-r.sz/2,
            borderRadius:"50%",border:`${r.bw} solid ${i<2?"white":`rgba(255,255,255,${.8-i*.12})`}`,
            boxShadow:i<2?`0 0 34px 14px ${glow}`:undefined,
            animation:`xa-shockwave ${T.IMPACT*r.spd}ms cubic-bezier(0.04,0,0.18,1) ${r.d}ms forwards`})}/>
        ))}
        {/* 12 impact burst rays */}
        {Array.from({length:12},(_,i)=>i*30).map((a,i)=>(
          <div key={i} style={abs({width:"110px",height:i%3===0?"3px":"1px",
            background:`linear-gradient(to right,white,${glow},transparent)`,
            borderRadius:"9999px",transformOrigin:"left center",
            transform:`rotate(${a}deg)`,opacity:i%3===0?.85:.55,
            animation:`xa-impact-ray ${T.IMPACT*1.2}ms ease-out ${i*4}ms forwards`})}/>
        ))}
        {/* Freeze ring cluster */}
        <Ring d={100} bc="white" bw="5px" glow={`0 0 30px 14px ${glow},inset 0 0 22px 10px ${glow}`} anim={`xa-hero-ring ${T.IMPACT}ms ease-out forwards`}/>
        <Ring d={62}  bc="white" bw="3px" op={.75} anim={`xa-hero-ring ${T.IMPACT}ms ease-out 16ms forwards`}/>
        <Ring d={36}  bc="white" bw="2px" op={.55} anim={`xa-hero-ring ${T.IMPACT}ms ease-out 30ms forwards`}/>
        {/* Horizontal + vertical ground waves */}
        <div style={abs({width:"320px",height:"16px",marginLeft:-160,top:28,
          background:`linear-gradient(to right,transparent,${glow},transparent)`,
          borderRadius:"9999px",filter:"blur(4px)",
          animation:`xa-ground-wave ${T.IMPACT*1.4}ms ease-out forwards`})}/>
        <div style={abs({width:"240px",height:"12px",marginLeft:-120,top:-30,
          background:`linear-gradient(to right,transparent,${glow},transparent)`,
          borderRadius:"9999px",filter:"blur(3px)",opacity:.55,
          animation:`xa-ground-wave ${T.IMPACT*1.2}ms ease-out 20ms forwards`})}/>
        {/* Smoke puffs */}
        {[{sx:-40,c:"rgba(200,200,200,.52)"},{sx:0,c:"rgba(220,220,220,.46)"},{sx:40,c:"rgba(180,180,180,.48)"}].map((s,i)=>(
          <div key={i} style={({position:"absolute",left:"-28px",top:"-14px",
            width:"56px",height:"56px",borderRadius:"50%",
            background:`radial-gradient(circle,${s.c},transparent)`,filter:"blur(8px)",
            animation:`xa-smoke ${T.AFTERMATH*.72}ms ease-out ${i*28}ms forwards`,
            "--sx":`${s.sx}px`}) as React.CSSProperties}/>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// AFTERMATH — epic element signatures
// ═══════════════════════════════════════════════════════════════════════════
function Aftermath({el,id,pts}:{el:string;id:string;pts:ReturnType<typeof mkP>}){
  const pal=p(el)
  const isFire=["pyrus","fire"].includes(el)
  const isAquo=["aquos","aquo","water"].includes(el)
  const isDark=["darkus","darkness","dark"].includes(el)
  const isHaos=["haos","light","lightness"].includes(el)
  const isVent=["ventus","wind"].includes(el)
  const isVoid=el==="void"
  const isTerra=["terra","subterra"].includes(el)

  const EC:Record<string,{core:string;trail:string;glow:string}> = {
    fire:   {core:"white",trail:"#fb923c",glow:"rgba(251,146,60,1)"},
    pyrus:  {core:"white",trail:"#fb923c",glow:"rgba(251,146,60,1)"},
    aquos:  {core:"white",trail:"#38bdf8",glow:"rgba(56,189,248,1)"},
    aquo:   {core:"white",trail:"#38bdf8",glow:"rgba(56,189,248,1)"},
    water:  {core:"white",trail:"#38bdf8",glow:"rgba(56,189,248,1)"},
    haos:   {core:"white",trail:"#fde047",glow:"rgba(253,224,71,1)"},
    light:  {core:"white",trail:"#fde047",glow:"rgba(253,224,71,1)"},
    lightness:{core:"white",trail:"#fde047",glow:"rgba(253,224,71,1)"},
    darkus: {core:"#c084fc",trail:"#581c87",glow:"rgba(88,28,135,1)"},
    darkness:{core:"#c084fc",trail:"#581c87",glow:"rgba(88,28,135,1)"},
    dark:   {core:"#c084fc",trail:"#581c87",glow:"rgba(88,28,135,1)"},
    ventus: {core:"white",trail:"#34d399",glow:"rgba(52,211,153,1)"},
    wind:   {core:"white",trail:"#34d399",glow:"rgba(52,211,153,1)"},
    void:   {core:"#94a3b8",trail:"#334155",glow:"rgba(100,116,139,1)"},
  }
  const ec=EC[el]||{core:"white",trail:pal.b,glow:pal.glow}

  return(
    <div style={{position:"absolute",left:0,top:0,pointerEvents:"none"}}>
      {/* ── PARTICLE BURST ──────────────────────────────────────────────── */}
      {pts.map(pt=>{
        const px=pt.spd*Math.cos(pt.angle)
        const py=pt.spd*Math.sin(pt.angle)
        const dur=T.AFTERMATH*pt.life
        return(
          <div key={pt.id} style={({
            position:"absolute",left:"-3px",top:"-3px",
            width:`${pt.sz}px`,height:`${pt.sz}px`,borderRadius:"50%",
            background:`radial-gradient(circle,${ec.core},${ec.trail})`,
            boxShadow:`0 0 ${pt.sz*2}px ${pt.sz}px ${ec.glow}`,
            animation:`xa-particle ${dur}ms cubic-bezier(0.04,.35,.18,1) ${pt.del}ms forwards`,
            willChange:"transform,opacity",
            "--px":`${px}px`,"--py":`${py}px`,
          }) as React.CSSProperties}/>
        )
      })}

      {/* ── ELEMENT SIGNATURES ──────────────────────────────────────────── */}
      {/* FIRE: 3 rising ember columns */}
      {isFire && <>
        {[-18,0,18].map((ox,i)=>(
          <div key={i} style={abs({width:"12px",height:"80px",
            background:"linear-gradient(to top,rgba(251,146,60,.88),rgba(249,115,22,.35),transparent)",
            borderRadius:"9999px",filter:"blur(4px)",left:ox-6,top:-10,
            animation:`xa-fire-rise ${T.AFTERMATH*.75}ms ease-out ${i*45}ms forwards`})}/>
        ))}
        {[{ox:-22,oy:-12},{ox:6,oy:-20},{ox:20,oy:-8},{ox:-8,oy:-18},{ox:14,oy:-14},{ox:-16,oy:-6}].map((e,i)=>(
          <div key={i} style={abs({width:"5px",height:"5px",borderRadius:"50%",
            background:"radial-gradient(circle,white,#fbbf24)",
            boxShadow:"0 0 7px 3px rgba(251,191,36,.95)",
            left:e.ox,top:e.oy,
            animation:`xa-ember ${T.AFTERMATH*.85}ms ease-out ${i*40}ms forwards`,willChange:"transform,opacity"})}/>
        ))}
        <Ring d={90}  bc="rgba(249,115,22,.5)" bw="1px" anim={`xa-ring-out ${T.AFTERMATH*.5}ms ease-out forwards`}/>
        <Ring d={140} bc="rgba(251,146,60,.3)" bw="1px" anim={`xa-ring-out ${T.AFTERMATH*.6}ms ease-out 40ms forwards`}/>
      </>}

      {/* AQUOS: expanding water ripple rings + splash drops */}
      {isAquo && <>
        {[{s:80,d:0},{s:140,d:60},{s:200,d:120},{s:260,d:190}].map((r,i)=>(
          <Ring key={i} d={r.s} bc={`rgba(56,189,248,${.8-i*.15})`} bw={`${3-i*.5}px`}
            glow={i<2?`0 0 14px 6px rgba(56,189,248,.55)`:undefined}
            anim={`xa-ripple-out ${T.AFTERMATH*.72}ms cubic-bezier(.04,.4,.18,1) ${r.d}ms forwards`}/>
        ))}
        {Array.from({length:12},(_,i)=>i*30).map((a,i)=>(
          <div key={i} style={abs({width:"8px",height:"8px",borderRadius:"50%",
            background:"radial-gradient(circle,white,#7dd3fc)",
            boxShadow:"0 0 8px 4px rgba(56,189,248,.9)",
            animation:`xa-drop-out ${T.AFTERMATH*.62}ms ease-out ${i*18}ms forwards`,
            "--da":`${a}deg`} as React.CSSProperties)}/>
        ))}
      </>}

      {/* DARKNESS: void singularity absorption + rift tears */}
      {isDark && <>
        {[0,30,60,90,120,150,180,210,240,270,300,330].map((a,i)=>(
          <div key={i} style={abs({width:"80px",height:"2px",
            background:"linear-gradient(to left,rgba(168,85,247,.9),rgba(88,28,135,.4),transparent)",
            borderRadius:"9999px",transformOrigin:"left center",transform:`rotate(${a}deg)`,
            animation:`xa-dark-abs ${T.AFTERMATH*.8}ms ease-out ${i*10}ms forwards`})}/>
        ))}
        {[-28,-10,10,28].map((x,i)=>(
          <div key={i} style={abs({width:"2px",height:"65px",marginLeft:x,top:-32,
            background:`linear-gradient(to bottom,transparent,rgba(88,28,135,${.9-i*.1}),transparent)`,
            borderRadius:"9999px",boxShadow:"0 0 8px 3px rgba(88,28,135,.75)",
            animation:`xa-void-crack ${T.AFTERMATH*.65}ms ease-out ${i*36}ms forwards`})}/>
        ))}
        <Ring d={80}  bc="rgba(168,85,247,.55)" bw="2px" anim={`xa-ring-in ${T.AFTERMATH*.55}ms ease-out forwards`}/>
        <Ring d={120} bc="rgba(88,28,135,.35)"  bw="1px" anim={`xa-ring-in ${T.AFTERMATH*.7}ms ease-out 40ms forwards`}/>
      </>}

      {/* HAOS: divine cross + starburst */}
      {isHaos && <>
        {[0,90,45,135].map((a,i)=>(
          <div key={i} style={abs({width:i<2?"120px":"85px",height:i<2?"4px":"3px",
            background:"linear-gradient(to right,white,rgba(254,240,138,.75),transparent)",
            borderRadius:"9999px",transformOrigin:"left center",transform:`rotate(${a}deg)`,
            animation:`xa-haos-ray-out ${T.AFTERMATH*.55}ms ease-out ${i*14}ms forwards`})}/>
        ))}
        {Array.from({length:16},(_,i)=>i*22.5).map((a,i)=>(
          <div key={i} style={abs({width:"55px",height:"1px",
            background:"linear-gradient(to right,rgba(254,240,138,.8),transparent)",
            borderRadius:"9999px",transformOrigin:"left center",transform:`rotate(${a}deg)`,
            animation:`xa-haos-ray-out ${T.AFTERMATH*.42}ms ease-out ${i*8}ms forwards`,opacity:.62})}/>
        ))}
        {[{s:80,d:0},{s:140,d:55},{s:200,d:115}].map((r,i)=>(
          <Ring key={i} d={r.s} bc={`rgba(253,224,71,${.75-i*.18})`}
            bw="1px" glow={i===0?"0 0 12px 6px rgba(253,224,71,.55)":undefined}
            anim={`xa-ring-out ${T.AFTERMATH*.55}ms ease-out ${r.d}ms forwards`}/>
        ))}
      </>}

      {/* VENTUS: tornadic rings + feather particles */}
      {isVent && <>
        {[{s:80,d:0},{s:140,d:50},{s:200,d:105},{s:260,d:168}].map((r,i)=>(
          <div key={i} style={abs({width:r.s,height:r.s,marginLeft:-r.s/2,marginTop:-r.s/2,
            borderRadius:"50%",border:`${2-i*.3}px dashed rgba(52,211,153,${.75-i*.14})`,
            animation:`xa-spin ${.3+i*.1}s linear infinite,xa-ring-out ${T.AFTERMATH*.65}ms ease-out ${r.d}ms forwards`})}/>
        ))}
        {Array.from({length:10},(_,i)=>i*36).map((a,i)=>(
          <div key={i} style={abs({width:"22px",height:"4px",
            background:`linear-gradient(to right,rgba(52,211,153,.85),transparent)`,
            borderRadius:"9999px",transformOrigin:"left center",
            transform:`rotate(${a}deg)`,
            animation:`xa-vent-shard ${T.AFTERMATH*.58}ms ease-out ${i*22}ms forwards`})}/>
        ))}
      </>}

      {/* VOID: reality fragmentation */}
      {isVoid && <>
        {[[40,0,12,4],[60,45,9,3],[-40,0,8,4],[-55,30,10,3],[0,-40,11,4],[0,38,9,3],
          [50,-25,7,3],[-45,-28,8,4],[30,50,7,3],[-30,-50,9,4]].map(([x,y,w,h],i)=>(
          <div key={i} style={abs({width:w,height:h,background:`rgba(148,163,184,${.8-i*.04})`,
            borderRadius:"2px",boxShadow:"0 0 6px 2px rgba(100,116,139,.7)",
            animation:`xa-void-shard ${T.AFTERMATH*.72}ms cubic-bezier(.04,.35,.18,1) ${i*28}ms forwards`,
            "--vx":`${x}px`,"--vy":`${y}px`} as React.CSSProperties)}/>
        ))}
        {[45,90,135,180,225,270,315].map((a,i)=>(
          <div key={i} style={abs({width:"60px",height:"1px",
            background:`linear-gradient(to right,rgba(148,163,184,.7),transparent)`,
            borderRadius:"9999px",transformOrigin:"left center",transform:`rotate(${a}deg)`,
            animation:`xa-void-crack ${T.AFTERMATH*.5}ms ease-out ${i*15}ms forwards`,opacity:.65})}/>
        ))}
      </>}

      {/* Residual core glow that lingers */}
      <div style={abs({width:"40px",height:"40px",marginLeft:-20,marginTop:-20,borderRadius:"50%",
        background:`radial-gradient(circle,${ec.glow},transparent)`,filter:"blur(10px)",
        animation:`xa-core-linger ${T.AFTERMATH}ms ease-out forwards`})}/>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export function ElementalAttackAnimation({
  id,startX,startY,targetX,targetY,element,attackerImage,attackerName,
  portalTarget,onImpact,onComplete,
}:AttackAnimationProps){
  const [phase,setPhase]=useState<Phase>("charge")
  const [mounted,setMounted]=useState(false)
  const dist=Math.hypot(targetX-startX,targetY-startY)
  const aRad=Math.atan2(targetY-startY,targetX-startX)
  const aDeg=aRad*(180/Math.PI)
  const el=(element?.toLowerCase().trim()||"neutral")
  const doneRef=useRef(onComplete)
  useEffect(()=>{doneRef.current=onComplete},[onComplete])
  useEffect(()=>{
    setMounted(true)
    const tm=[
      setTimeout(()=>setPhase("release"),T.CHARGE),
      setTimeout(()=>setPhase("strike"),T.CHARGE+T.RELEASE),
      setTimeout(()=>{setPhase("impact");onImpact?.(id,targetX,targetY,el)},T.CHARGE+T.RELEASE+T.STRIKE),
      setTimeout(()=>setPhase("aftermath"),T.CHARGE+T.RELEASE+T.STRIKE+T.IMPACT),
      setTimeout(()=>doneRef.current(id),T.TOTAL),
    ]
    return()=>tm.forEach(clearTimeout)
  },[id])
  if(!mounted) return null

  const tbl:Record<string,[number,number,number,number]>={
    pyrus:[28,120,42,96],fire:[28,120,42,96],
    aquos:[22,115,34,84],aquo:[22,115,34,84],water:[22,115,34,84],
    haos:[32,170,38,90],light:[32,170,38,90],lightness:[32,170,38,90],
    darkus:[24,115,24,66],darkness:[24,115,24,66],dark:[24,115,24,66],
    ventus:[28,148,32,86],wind:[28,148,32,86],
    void:[30,360,24,72],
  }
  const [n,sp,mn,mx]=tbl[el]??[18,115,32,82]
  const pts=useMemo(()=>mkP(n,sp,mn,mx,id),[el,id])

  const ease=EASE[el]||"cubic-bezier(0.06,0,0.04,1)"
  const inFlight=phase==="charge"||phase==="release"||phase==="strike"
  const ctr:S=inFlight
    ?{position:"absolute",left:startX,top:startY,width:dist,height:60,marginTop:-30,
       pointerEvents:"none",zIndex:10000,transformOrigin:"0 50%",transform:`rotate(${aDeg}deg)`,
       willChange:"transform",contain:"layout style paint"}
    :{position:"absolute",left:targetX,top:targetY,width:0,height:60,marginTop:-30,
       pointerEvents:"none",zIndex:10000,transformOrigin:"0 50%",transform:`rotate(${aDeg}deg)`,
       willChange:"transform",contain:"layout style paint"}

  const orbitKFs=`
    @keyframes xa-orbit-0{from{transform:rotate(0deg) translateX(-58px)}to{transform:rotate(360deg) translateX(-58px)}}
    @keyframes xa-orbit-1{from{transform:rotate(120deg) translateX(-52px)}to{transform:rotate(480deg) translateX(-52px)}}
    @keyframes xa-orbit-2{from{transform:rotate(240deg) translateX(-56px)}to{transform:rotate(600deg) translateX(-56px)}}
    @keyframes xa-orbit-3{from{transform:rotate(60deg) translateX(-50px)}to{transform:rotate(420deg) translateX(-50px)}}
    @keyframes xa-orbit-4{from{transform:rotate(180deg) translateX(-54px)}to{transform:rotate(540deg) translateX(-54px)}}
    @keyframes xa-orbit-dk0{from{transform:rotate(45deg) translateX(-56px)}to{transform:rotate(405deg) translateX(-56px)}}
    @keyframes xa-orbit-dk1{from{transform:rotate(165deg) translateX(-50px)}to{transform:rotate(525deg) translateX(-50px)}}
    @keyframes xa-orbit-dk2{from{transform:rotate(285deg) translateX(-58px)}to{transform:rotate(645deg) translateX(-58px)}}
    @keyframes xa-orbit-dk3{from{transform:rotate(15deg) translateX(-52px)}to{transform:rotate(375deg) translateX(-52px)}}
    @keyframes xa-orbit-ha0{from{transform:rotate(0deg) translateX(-62px)}to{transform:rotate(360deg) translateX(-62px)}}
    @keyframes xa-orbit-ha1{from{transform:rotate(72deg) translateX(-56px)}to{transform:rotate(432deg) translateX(-56px)}}
    @keyframes xa-orbit-ha2{from{transform:rotate(144deg) translateX(-64px)}to{transform:rotate(504deg) translateX(-64px)}}
    @keyframes xa-orbit-ha3{from{transform:rotate(216deg) translateX(-58px)}to{transform:rotate(576deg) translateX(-58px)}}
    @keyframes xa-orbit-ha4{from{transform:rotate(288deg) translateX(-62px)}to{transform:rotate(648deg) translateX(-62px)}}
    @keyframes xa-orbit-vt0{from{transform:rotate(0deg) translateX(-56px)}to{transform:rotate(360deg) translateX(-56px)}}
    @keyframes xa-orbit-vt1{from{transform:rotate(90deg) translateX(-50px)}to{transform:rotate(450deg) translateX(-50px)}}
    @keyframes xa-orbit-vt2{from{transform:rotate(180deg) translateX(-58px)}to{transform:rotate(540deg) translateX(-58px)}}
    @keyframes xa-orbit-vt3{from{transform:rotate(270deg) translateX(-52px)}to{transform:rotate(630deg) translateX(-52px)}}
    @keyframes xa-orbit-vd0{from{transform:rotate(60deg) translateX(-52px)}to{transform:rotate(420deg) translateX(-52px)}}
    @keyframes xa-orbit-vd1{from{transform:rotate(180deg) translateX(-46px)}to{transform:rotate(540deg) translateX(-46px)}}
    @keyframes xa-orbit-vd2{from{transform:rotate(300deg) translateX(-54px)}to{transform:rotate(660deg) translateX(-54px)}}
  `

  const globalKFs=`
    @keyframes xa-spin{to{transform:rotate(360deg)}}
    @keyframes xa-pulse{0%,100%{transform:scale(1);opacity:.94}50%{transform:scale(1.18);opacity:1}}
    @keyframes xa-burst{0%{transform:scale(.85);opacity:.9}100%{transform:scale(1.28);opacity:0}}
    @keyframes xa-flare{0%,100%{transform:scaleY(0);opacity:0}45%{transform:scaleY(1);opacity:.9}}
    @keyframes xa-dark-consume{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(.88);opacity:1}}
    @keyframes xa-dark-tendril{0%,100%{transform:scaleX(1);opacity:.78}50%{transform:scaleX(1.45);opacity:1}}
    @keyframes xa-haos-ray{0%,100%{opacity:.72;transform:scaleY(1)}50%{opacity:1;transform:scaleY(1.42)}}
    @keyframes xa-haos-halo{0%,100%{transform:scale(1);opacity:.65}50%{transform:scale(1.25);opacity:.98}}
    @keyframes xa-aq-stream{0%,100%{transform:scaleY(0) rotate(var(--deg,0));opacity:0}45%{transform:scaleY(1) rotate(var(--deg,0));opacity:.9}}
    @keyframes xa-vent-blade{0%,100%{transform:scaleX(.7) rotate(var(--a,0deg));opacity:.7}50%{transform:scaleX(1.3) rotate(var(--a,0deg));opacity:1}}
    @keyframes xa-void-static{0%{opacity:.8}50%{opacity:.2}100%{opacity:.75}}
    @keyframes xa-converge{0%{transform:rotate(var(--deg,0deg)) translateX(-100px);opacity:0}40%{opacity:.8}100%{transform:rotate(var(--deg,0deg)) translateX(0px);opacity:0}}
    @keyframes xa-move{0%{transform:translateX(0)}100%{transform:translateX(${dist}px)}}
    @keyframes xa-trail-fade{0%{opacity:.86}100%{opacity:0}}
    @keyframes xa-speed-line{0%{transform:scaleX(0) translateX(-100%);opacity:0}5%{opacity:.75}70%{opacity:.5}100%{transform:scaleX(1) translateX(0);opacity:0}}
    @keyframes xa-hero-flash{0%{opacity:.96}12%{opacity:1}100%{opacity:0}}
    @keyframes xa-hero-compress{0%{transform:scale(0);opacity:1}50%{opacity:.82}100%{transform:scale(3.5);opacity:0}}
    @keyframes xa-hero-ring{0%{transform:scale(0);opacity:1}100%{transform:scale(1.8);opacity:0}}
    @keyframes xa-shockwave{0%{transform:scale(0);opacity:1}70%{opacity:.4}100%{transform:scale(6.5);opacity:0}}
    @keyframes xa-impact-ray{0%{transform:rotate(var(--ra,0deg)) scaleX(0);opacity:1}38%{transform:rotate(var(--ra,0deg)) scaleX(1.6);opacity:.88}100%{transform:rotate(var(--ra,0deg)) scaleX(2.8);opacity:0}}
    @keyframes xa-ground-wave{0%{transform:scaleX(0) scaleY(1);opacity:.88}100%{transform:scaleX(1) scaleY(.12);opacity:0}}
    @keyframes xa-smoke{0%{transform:translate(var(--sx,0px),0) scale(.28);opacity:.74;filter:blur(4px)}100%{transform:translate(var(--sx,0px),-64px) scale(2.6);opacity:0;filter:blur(16px)}}
    @keyframes xa-screen-tint{0%{opacity:.92}18%{opacity:1}100%{opacity:0}}
    @keyframes xa-vignette{0%{opacity:.88}100%{opacity:0}}
    @keyframes xa-chroma-r{0%{opacity:.85;transform:translate(-10px,0)}60%{opacity:.38}100%{opacity:0;transform:translate(-22px,0)}}
    @keyframes xa-chroma-b{0%{opacity:.85;transform:translate(10px,0)}60%{opacity:.38}100%{opacity:0;transform:translate(22px,0)}}
    @keyframes xa-particle{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--px,40px),var(--py,-40px)) scale(0);opacity:0}}
    @keyframes xa-fire-rise{0%{transform:scaleY(0) scaleX(1);opacity:1}60%{opacity:.7}100%{transform:scaleY(1) scaleX(.4);opacity:0}}
    @keyframes xa-ember{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--ex,10px),var(--ey,-60px)) scale(0);opacity:0}}
    @keyframes xa-ripple-out{0%{transform:scale(.15);opacity:.92}100%{transform:scale(5);opacity:0}}
    @keyframes xa-drop-out{0%{transform:rotate(var(--da,0deg)) translateX(0) scale(1);opacity:1}100%{transform:rotate(var(--da,0deg)) translateX(90px) scale(0);opacity:0}}
    @keyframes xa-dark-abs{0%{transform:rotate(var(--a,0deg)) scaleX(1);opacity:.9}100%{transform:rotate(var(--a,0deg)) scaleX(0);opacity:0}}
    @keyframes xa-void-crack{0%{transform:scaleY(0);opacity:.92}40%{transform:scaleY(1.1);opacity:.85}100%{transform:scaleY(.85);opacity:0}}
    @keyframes xa-void-shard{0%{transform:translate(0,0) rotate(0deg) scale(1);opacity:1}100%{transform:translate(var(--vx,30px),var(--vy,-30px)) rotate(180deg) scale(0);opacity:0}}
    @keyframes xa-haos-ray-out{0%{transform:rotate(var(--a,0deg)) scaleX(0);opacity:1}40%{opacity:.88}100%{transform:rotate(var(--a,0deg)) scaleX(1);opacity:0}}
    @keyframes xa-vent-shard{0%{transform:rotate(var(--a,0deg)) scaleX(0);opacity:.9}50%{opacity:.75}100%{transform:rotate(var(--a,0deg)) scaleX(1.4);opacity:0}}
    @keyframes xa-ring-out{0%{transform:scale(0);opacity:.9}100%{transform:scale(3.5);opacity:0}}
    @keyframes xa-ring-in{0%{transform:scale(3);opacity:.7}100%{transform:scale(0);opacity:0}}
    @keyframes xa-core-linger{0%{transform:scale(1);opacity:.88}60%{opacity:.55}100%{transform:scale(2.5);opacity:0}}
    @keyframes xa-aq-wave{0%{transform:scale(0.1);opacity:.9}100%{transform:scale(4.2);opacity:0}}
    @keyframes afterimage-fade{0%{opacity:.38;filter:blur(3px) brightness(1.8)}100%{opacity:0;filter:blur(8px) brightness(2.4)}}
  `

  const pal=p(el)
  const output=(
    <>
      <style>{orbitKFs+globalKFs}</style>
      {attackerImage&&(phase==="charge"||phase==="release")&&(<>
        <div style={{position:"absolute",left:startX-40,top:startY-56,width:80,height:112,
          backgroundImage:`url(${attackerImage})`,backgroundSize:"cover",backgroundPosition:"center",
          borderRadius:"8px",opacity:.38,filter:"blur(3px) brightness(2)",
          animation:"afterimage-fade 240ms ease-out forwards",pointerEvents:"none",zIndex:5,willChange:"opacity"}}/>
        <div style={{position:"absolute",left:startX-40,top:startY-56,width:80,height:112,
          backgroundImage:`url(${attackerImage})`,backgroundSize:"cover",backgroundPosition:"center",
          borderRadius:"8px",opacity:.18,filter:"blur(7px) brightness(2.4)",
          animation:"afterimage-fade 380ms ease-out 50ms forwards",pointerEvents:"none",zIndex:4,willChange:"opacity"}}/>
      </>)}
      <div style={ctr} suppressHydrationWarning>
        {(phase==="charge"||phase==="release")&&<Charge el={el} id={id}/>}
        {phase==="strike"&&<Strike el={el} dist={dist}/>}
        {phase==="impact"&&<Impact el={el}/>}
        {phase==="aftermath"&&<Aftermath el={el} id={id} pts={pts}/>}
      </div>
    </>
  )
  if(portalTarget) return createPortal(output,portalTarget)
  if(typeof document!=="undefined") return createPortal(output,document.body)
  return null
}
