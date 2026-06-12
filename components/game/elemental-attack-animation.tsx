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

// ── Timing ──────────────────────────────────────────────────────────────────
const T={CHARGE:130,RELEASE:25,STRIKE:185,IMPACT:230,AFTERMATH:820,
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
// CHARGE — full-screen aura + element-specific power build
// ════════════════════════════════════════════════════════════════════
function Charge({el,sx,sy}:{el:string;sx:number;sy:number}){
  const P=pal(el)
  const iF=["pyrus","fire"].includes(el), iA=["aquos","aquo","water"].includes(el)
  const iD=["darkus","darkness","dark"].includes(el), iH=["haos","light","lightness"].includes(el)
  const iV=["ventus","wind"].includes(el)

  return <>
    {/* ── FULL-SCREEN ENERGY FIELD that builds during charge */}
    <div style={{position:"fixed",inset:0,pointerEvents:"none",
      background:`radial-gradient(circle 280px at ${sx}px ${sy}px, ${P.sc} 0%, transparent 100%)`,
      animation:`xc-field-build ${T.CHARGE}ms ease-in forwards`,willChange:"opacity"}}/>
    {/* ── SCREEN VIGNETTE DARKENING */}
    <div style={{position:"fixed",inset:0,pointerEvents:"none",
      background:"radial-gradient(ellipse at center,transparent 22%,rgba(0,0,0,.55) 100%)",
      animation:`xc-vign-build ${T.CHARGE}ms ease-in forwards`,willChange:"opacity"}}/>

    {/* ── ELEMENT CORE ── */}
    <div style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)"}}>
      <div style={{position:"absolute",left:0,top:0,width:0,height:0}}>

      {iF && <>
        {/* 5 rings spinning at manic speeds */}
        <Ring d={148} c="rgba(251,146,60,.55)" bw="1px" glow="0 0 28px 10px rgba(249,115,22,.65)" an="ks 0.065s linear infinite" op={.6}/>
        <Ring d={124} c="#f97316" bw="2px"    glow="0 0 26px 12px rgba(249,115,22,.9)"  an="kr 0.08s linear infinite"  op={.88}/>
        <Ring d={96}  c="#fbbf24" bw="3px"    glow="0 0 18px 8px rgba(251,191,36,.85)"  an="ks 0.06s linear infinite"  op={.82}/>
        <Ring d={68}  c="#ef4444" bw="2px"    glow="0 0 14px 8px rgba(239,68,68,.88)"   an="kr 0.05s linear infinite"  op={.72}/>
        <Ring d={42}  c="#dc2626" bw="2px"    glow="0 0 10px 6px rgba(220,38,38,.85)"   an="ks 0.04s linear infinite"  op={.65}/>
        {/* 14 flame petals */}
        {Array.from({length:14},(_,i)=>(
          <div key={i} style={{position:"absolute",left:0,top:0,width:"15px",height:"50px",
            background:"linear-gradient(to top,rgba(239,68,68,.92),rgba(249,115,22,.55),rgba(251,191,36,.25),transparent)",
            borderRadius:"50% 50% 35% 35%",transformOrigin:"50% 100%",
            transform:`rotate(${i*(360/14)}deg) translateY(-60px)`,
            animation:`xc-petal ${60+i*5}ms ease-in-out ${i*12}ms infinite`,willChange:"transform,opacity"}}/>
        ))}
        {/* 12 orbiting embers */}
        {[[72,9,"rgba(251,191,36,.98)",130,0],[66,8,"rgba(249,115,22,.9)",105,28],[70,9,"#fff7ed",122,55],
          [62,7,"rgba(239,68,68,.88)",96,82],[68,6,"rgba(254,200,50,.85)",115,18],[64,8,"rgba(255,255,255,.92)",100,63],
          [70,6,"rgba(251,146,60,.9)",118,40],[58,5,"rgba(249,115,22,.78)",88,75],[66,7,"rgba(251,191,36,.82)",108,110],
          [62,5,"rgba(255,200,80,.75)",92,135],[68,8,"rgba(239,68,68,.8)",112,155],[60,5,"rgba(254,240,138,.7)",85,95]
        ].map(([r,s,c,dur,del],i)=><Orb key={i} r={r as number} sz={s as number} c={c as string} dur={dur as number} del={del as number}/>)}
        {/* White-hot core 58px */}
        <div style={{position:"absolute",left:-29,top:-29,width:58,height:58,borderRadius:"50%",
          background:"radial-gradient(circle,white 5%,#fb923c 22%,#dc2626 52%,#7f1d1d 100%)",
          boxShadow:"0 0 0 8px #f97316,0 0 44px 22px rgba(251,146,60,1),0 0 88px 40px rgba(220,38,38,.85)",
          animation:"xc-core .055s ease-in-out infinite",willChange:"transform,opacity"}}/>
        {/* Burst rings */}
        <Ring d={150} c="rgba(251,146,60,.4)" bw="1px" an="xc-burst .075s ease-out infinite"/>
        <Ring d={150} c="rgba(251,146,60,.22)" bw="1px" an="xc-burst .075s ease-out .037s infinite"/>
        {/* Outer energy field glow */}
        <div style={{position:"absolute",left:-75,top:-75,width:150,height:150,borderRadius:"50%",
          background:"radial-gradient(circle,rgba(251,146,60,.38) 0%,transparent 70%)",
          animation:"xc-core .09s ease-in-out infinite"}}/>
      </>}

      {iA && <>
        <Ring d={132} c="rgba(14,165,233,.5)"  bw="1px" glow="0 0 24px 9px rgba(14,165,233,.65)" an="kr .12s linear infinite" op={.6}/>
        <Ring d={110} c="#38bdf8"  bw="2px" glow="0 0 22px 10px rgba(56,189,248,.85)" an="ks .15s linear infinite" op={.82}/>
        <Ring d={84}  c="#7dd3fc" bw="2px"  glow="0 0 14px 6px rgba(125,211,252,.72)" an="kr .10s linear infinite" op={.72}/>
        <Ring d={58}  c="#bae6fd" bw="1px"  an="ks .08s linear infinite" op={.55}/>
        {/* 10 water streams */}
        {Array.from({length:10},(_,i)=>(
          <div key={i} style={{position:"absolute",left:0,top:0,width:"5px",height:"60px",
            background:"linear-gradient(to top,rgba(14,165,233,.9),rgba(56,189,248,.45),transparent)",
            borderRadius:"9999px",transformOrigin:"50% 100%",transform:`rotate(${i*36}deg) translateY(-68px)`,
            animation:`xc-stream .18s ease-in-out ${i*18}ms infinite`,willChange:"transform,opacity"}}/>
        ))}
        {[[66,8,"rgba(56,189,248,.95)",215,0],[60,6,"rgba(125,211,252,.85)",180,42],[68,8,"rgba(255,255,255,.9)",200,84],
          [62,6,"rgba(14,165,233,.8)",165,126],[66,5,"rgba(186,230,253,.72)",190,168],[58,5,"rgba(56,189,248,.78)",152,55],[64,7,"rgba(255,255,255,.82)",178,100]
        ].map(([r,s,c,dur,del],i)=><Orb key={i} r={r as number} sz={s as number} c={c as string} dur={dur as number} del={del as number}/>)}
        <div style={{position:"absolute",left:-25,top:-25,width:50,height:50,borderRadius:"50%",
          background:"radial-gradient(circle,white 8%,#7dd3fc 28%,#0284c7 60%,#0c4a6e 100%)",
          boxShadow:"0 0 0 7px #38bdf8,0 0 40px 20px rgba(56,189,248,1),0 0 80px 34px rgba(14,165,233,.8)",
          animation:"xc-core .08s ease-in-out infinite",willChange:"transform,opacity"}}/>
        <Ring d={134} c="rgba(56,189,248,.32)" bw="1px" an="xc-burst .10s ease-out infinite"/>
      </>}

      {iD && <>
        <Ring d={140} c="rgba(76,29,149,.65)" bw="2px" glow="0 0 40px 18px rgba(88,28,135,.92)" an="xc-collapse .13s ease-in infinite" op={.92}/>
        <Ring d={114} c="#7c3aed" bw="2px" glow="0 0 24px 11px rgba(124,58,237,.75)" an="kr .20s linear infinite" op={.76}/>
        <Ring d={86}  c="#a78bfa" bw="1px" an="ks .14s linear infinite" op={.58}/>
        {/* 14 shadow tendrils that SNAP outward */}
        {Array.from({length:14},(_,i)=>(
          <div key={i} style={{position:"absolute",left:0,top:0,
            width:`${40+Math.sin(i)*8}px`,height:"2px",
            background:"linear-gradient(to right,rgba(88,28,135,.95),rgba(139,92,246,.4),transparent)",
            borderRadius:"9999px",transformOrigin:"0 50%",transform:`rotate(${i*(360/14)}deg)`,
            animation:`xc-tendril .14s ease-in-out ${i*12}ms infinite`,willChange:"transform,opacity"}}/>
        ))}
        {/* 18 void particles converging inward */}
        {Array.from({length:18},(_,i)=>(
          <div key={i} style={{position:"absolute",left:0,top:0,width:"3px",height:"3px",borderRadius:"50%",
            background:"rgba(196,181,253,.9)",
            transform:`rotate(${i*20}deg) translateX(80px)`,
            animation:`xc-converge .20s ease-in ${i*11}ms infinite`,willChange:"transform,opacity"}}/>
        ))}
        {[[62,8,"rgba(88,28,135,.82)",600,0,true],[56,6,"rgba(168,85,247,.7)",490,150,false],
          [64,7,"rgba(196,181,253,.62)",540,300,true],[58,5,"rgba(76,29,149,.58)",440,90,false],
          [66,6,"rgba(139,92,246,.68)",570,225,true]
        ].map(([r,s,c,dur,del,rv],i)=><Orb key={i} r={r as number} sz={s as number} c={c as string} dur={dur as number} del={del as number} rev={rv as boolean}/>)}
        {/* Pure black singularity */}
        <div style={{position:"absolute",left:-20,top:-20,width:40,height:40,borderRadius:"50%",
          background:"radial-gradient(circle,#09000f 16%,black 58%)",
          boxShadow:"0 0 0 6px #581c87,0 0 0 14px rgba(88,28,135,.58),0 0 56px 28px rgba(88,28,135,1),0 0 120px 55px rgba(88,28,135,.7)"}}/>
        <Ring d={142} c="rgba(168,85,247,.25)" bw="1px" an="xc-burst .13s ease-out infinite"/>
        <div style={{position:"absolute",left:-70,top:-70,width:140,height:140,borderRadius:"50%",
          background:"radial-gradient(circle,rgba(88,28,135,.55) 0%,transparent 72%)",animation:"xc-collapse .10s ease-in infinite"}}/>
      </>}

      {iH && <>
        {/* 48 divine rays at 3 lengths */}
        {Array.from({length:48},(_,i)=>{
          const l=i%12===0?68:i%6===0?48:i%3===0?32:i%2===0?20:12
          const op=i%12===0?1:i%6===0?.86:i%3===0?.68:i%2===0?.5:.34
          return <div key={i} style={{position:"absolute",left:0,top:0,width:"2px",height:`${l}px`,
            background:"linear-gradient(to top,transparent,rgba(254,249,195,.92),white)",
            borderRadius:"9999px",transformOrigin:"50% 100%",
            transform:`rotate(${i*7.5}deg) translateY(-${l}px)`,opacity:op,
            animation:`xc-ray ${55+i%3*8}ms ease-in-out ${i%6===0?0:i%6===1?12:i%6===2?24:i%6===3?36:i%6===4?48:60}ms infinite`,
            willChange:"transform,opacity"}}/>
        })}
        {[[76,11,"rgba(253,224,71,.99)",112,0],[70,9,"rgba(255,255,255,.95)",92,32],
          [78,10,"rgba(254,240,138,.93)",126,64],[72,8,"rgba(253,224,71,.88)",102,96],
          [76,7,"rgba(255,255,255,.82)",118,128],[68,6,"rgba(254,240,138,.76)",88,160],
          [74,8,"rgba(253,224,71,.86)",108,44],[70,5,"rgba(255,255,255,.7)",84,115]
        ].map(([r,s,c,dur,del],i)=><Orb key={i} r={r as number} sz={s as number} c={c as string} dur={dur as number} del={del as number}/>)}
        {/* Blazing white-gold core 64px */}
        <div style={{position:"absolute",left:-32,top:-32,width:64,height:64,borderRadius:"50%",
          background:"white",
          boxShadow:"0 0 0 10px #fef08a,0 0 0 20px rgba(253,224,71,.54),0 0 90px 45px rgba(254,240,138,1),0 0 170px 68px rgba(253,224,71,.55)",
          animation:"xc-core .05s ease-in-out infinite",willChange:"transform,opacity"}}/>
        {/* Double burst */}
        <Ring d={156} c="rgba(254,240,138,.55)" bw="1px" an="xc-burst .08s ease-out infinite"/>
        <Ring d={156} c="rgba(254,240,138,.30)" bw="1px" an="xc-burst .08s ease-out .04s infinite"/>
        <div style={{position:"absolute",left:-76,top:-76,width:152,height:152,borderRadius:"50%",
          background:"radial-gradient(circle,rgba(254,240,138,.52) 0%,transparent 68%)",animation:"xc-halo .07s ease-in-out infinite"}}/>
      </>}

      {iV && <>
        <Ring d={130} c="rgba(16,185,129,.5)"  bw="1px" glow="0 0 22px 8px rgba(16,185,129,.65)" an="ks .09s linear infinite" op={.62}/>
        <Ring d={108} c="#34d399" bw="2px" glow="0 0 18px 7px rgba(52,211,153,.82)" an="kr .07s linear infinite" op={.82}/>
        <Ring d={80}  c="#6ee7b7" bw="2px" glow="0 0 12px 5px rgba(110,231,183,.72)" an="ks .055s linear infinite" op={.72}/>
        <Ring d={52}  c="#a7f3d0" bw="1px" an="kr .045s linear infinite" op={.55}/>
        {/* 10 wind blades */}
        {Array.from({length:10},(_,i)=>(
          <div key={i} style={{position:"absolute",left:0,top:0,width:"36px",height:"3px",
            background:"linear-gradient(to right,transparent,rgba(52,211,153,.9),rgba(110,231,183,.55),transparent)",
            borderRadius:"9999px",transformOrigin:"center center",transform:`rotate(${i*36}deg)`,
            animation:`xc-blade ${70+i*6}ms ease-in-out ${i*9}ms infinite`,willChange:"transform,opacity"}}/>
        ))}
        {[[62,9,"rgba(52,211,153,.95)",160,0],[56,7,"rgba(110,231,183,.85)",132,40],
          [64,8,"rgba(255,255,255,.9)",148,80],[58,6,"rgba(16,185,129,.78)",118,120],
          [62,5,"rgba(167,243,208,.72)",136,160],[56,7,"rgba(255,255,255,.82)",124,55]
        ].map(([r,s,c,dur,del],i)=><Orb key={i} r={r as number} sz={s as number} c={c as string} dur={dur as number} del={del as number}/>)}
        <div style={{position:"absolute",left:-27,top:-27,width:54,height:54,borderRadius:"50%",
          background:"radial-gradient(circle,white 8%,#6ee7b7 28%,#059669 60%,#064e3b 100%)",
          boxShadow:"0 0 0 7px #34d399,0 0 42px 21px rgba(52,211,153,1),0 0 84px 34px rgba(16,185,129,.8)",
          animation:"xc-core .07s ease-in-out infinite",willChange:"transform,opacity"}}/>
      </>}

      {/* VOID */}
      {!iF&&!iA&&!iD&&!iH&&!iV && <>
        <Ring d={132} c="rgba(71,85,105,.5)"  bw="1px" glow="0 0 18px 7px rgba(71,85,105,.65)" an="ks .40s linear infinite" op={.55}/>
        <Ring d={108} c="#64748b" bw="2px" glow="0 0 14px 6px rgba(100,116,139,.75)" an="kr .28s linear infinite" op={.72}/>
        <Ring d={80}  c="#94a3b8" bw="1px" an="ks .20s linear infinite" op={.58}/>
        {Array.from({length:10},(_,i)=>(
          <div key={i} style={{position:"absolute",left:0,top:0,width:`${18+i*4}px`,height:"2px",
            background:`rgba(148,163,184,${.82-i*.04})`,borderRadius:"2px",
            transformOrigin:"center center",transform:`rotate(${i*36}deg)`,
            animation:`xc-glitch .05s step-end ${i*6}ms infinite`}}/>
        ))}
        {[[54,7,"rgba(148,163,184,.85)",470,0],[48,5,"rgba(203,213,225,.75)",355,160],[56,6,"rgba(248,250,252,.65)",415,320]
        ].map(([r,s,c,dur,del],i)=><Orb key={i} r={r as number} sz={s as number} c={c as string} dur={dur as number} del={del as number}/>)}
        <div style={{position:"absolute",left:-22,top:-22,width:44,height:44,borderRadius:"50%",
          background:"radial-gradient(circle,white 6%,#94a3b8 28%,#334155 60%,black 100%)",
          boxShadow:"0 0 0 5px #475569,0 0 30px 15px rgba(71,85,105,1),0 0 62px 26px rgba(30,41,59,.82)"}}/>
        {[{d:96,op:.28},{d:116,op:.18},{d:132,op:.10}].map((r,i)=>(
          <div key={i} style={{position:"absolute",left:-r.d/2,top:-r.d/2,width:r.d,height:r.d,
            borderRadius:"50%",border:`1px solid rgba(148,163,184,${r.op})`,
            animation:`${i%2===0?"ks":"kr"} ${.85+i*.28}s linear infinite`}}/>
        ))}
      </>}

      </div>
    </div>
  </>
}

// ════════════════════════════════════════════════════════════════════
// STRIKE — blazing with motion-blur ghost copies
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

  // 13 speed lines
  const speedLines=Array.from({length:13},(_,i)=>{
    const off=(i-6)*9
    return <div key={i} style={{position:"fixed",left:0,top:`calc(50% + ${off}px)`,
      width:"100vw",height:Math.abs(i-6)<=1?"4px":"1.5px",
      background:`linear-gradient(to right,transparent 0%,${P.b} 35%,${P.b} 65%,transparent 100%)`,
      pointerEvents:"none",willChange:"opacity",
      animation:`xs-sline ${T.STRIKE}ms cubic-bezier(.02,0,.05,1) ${i*3}ms forwards`,
      opacity:.28-Math.abs(i-6)*.03}}/>
  })

  // Ghost motion blur copies at 30%, 55%, 78% of path
  const ghosts=[.30,.55,.78].map((pct,i)=>(
    <div key={i} style={{position:"absolute",left:`${dist*pct}px`,top:"50%",transform:"translateY(-50%)",
      display:"flex",alignItems:"center",opacity:.18-i*.05,filter:"blur(4px) brightness(1.6)"}}>
      <div style={{width:"36px",height:"36px",borderRadius:"50%",flexShrink:0,
        background:`radial-gradient(circle,white 6%,${P.c} 28%,${P.b} 56%,${P.a} 100%)`,
        boxShadow:`0 0 22px 10px ${P.gl}`}}/>
    </div>
  ))

  return <>
    {speedLines}
    {ghosts}
    <div style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",display:"flex",alignItems:"center",...mv}}>
      {/* 3-layer trail */}
      <div style={{position:"absolute",width:"310px",height:iH?"40px":iF?"35px":"28px",
        background:`linear-gradient(to right,transparent,${P.a}18,${P.a}72,${P.b},${P.c}55)`,
        borderRadius:"9999px",filter:"blur(8px)",opacity:.86,
        animation:`xs-trail ${T.STRIKE}ms ease-in forwards`,willChange:"opacity"}}/>
      <div style={{position:"absolute",width:"245px",height:iH?"22px":iF?"18px":"14px",
        background:`linear-gradient(to right,transparent,${P.a}45,${P.b},${P.c}72)`,
        borderRadius:"9999px",filter:"blur(3px)",opacity:.92}}/>
      <div style={{position:"absolute",width:"175px",height:iH?"10px":iF?"8px":"6px",
        background:`linear-gradient(to right,transparent,${P.b},white 68%,${P.c}38)`,
        borderRadius:"9999px",opacity:.97}}/>
      {/* Sonic boom cone */}
      <div style={{position:"absolute",width:"0",height:"0",right:"42px",top:"-28px",
        borderLeft:`60px solid ${P.sc}`,borderTop:"28px solid transparent",borderBottom:"28px solid transparent"}}/>
      {/* Element extras */}
      {iF && <>
        {[{x:60,y:-22,s:13},{x:96,y:18,s:11},{x:128,y:-18,s:10},{x:156,y:13,s:9},{x:180,y:-12,s:7},{x:200,y:10,s:6}].map((e,i)=>(
          <div key={i} style={{position:"absolute",width:e.s,height:e.s,borderRadius:"50%",
            background:"radial-gradient(circle,white,#fbbf24)",boxShadow:"0 0 16px 8px rgba(251,191,36,1)",
            left:e.x,top:e.y,opacity:.9-i*.1}}/>
        ))}
        <div style={{position:"absolute",width:"165px",height:"5px",background:"linear-gradient(to right,transparent,rgba(251,191,36,.82),white,transparent)",top:"-20px",left:"38px",borderRadius:"9999px",opacity:.74}}/>
        <div style={{position:"absolute",width:"130px",height:"4px",background:"linear-gradient(to right,transparent,rgba(249,115,22,.62),transparent)",top:"17px",left:"58px",borderRadius:"9999px",opacity:.60}}/>
      </>}
      {iA && <>
        {[{x:62,y:-17,s:12},{x:98,y:14,s:10},{x:128,y:-15,s:9},{x:155,y:10,s:7},{x:178,y:-9,s:5}].map((e,i)=>(
          <div key={i} style={{position:"absolute",width:e.s,height:e.s,borderRadius:"50%",
            background:"radial-gradient(circle,white,#7dd3fc)",boxShadow:"0 0 14px 7px rgba(56,189,248,.95)",
            left:e.x,top:e.y,opacity:.86-i*.1}}/>
        ))}
        {[{x:72,y:-25,w:5,h:22},{x:106,y:20,w:4,h:18},{x:136,y:-22,w:3,h:15}].map((d,i)=>(
          <div key={i} style={{position:"absolute",width:d.w,height:d.h,
            background:`linear-gradient(to top,${P.a},rgba(255,255,255,.65),transparent)`,
            borderRadius:"9999px",left:d.x,top:d.y,opacity:.75-i*.16}}/>
        ))}
      </>}
      {iD && <>
        {[{x:52,y:-16,w:20,h:4},{x:82,y:13,w:15,h:4},{x:108,y:-14,w:11,h:3},{x:132,y:10,w:9,h:3}].map((s,i)=>(
          <div key={i} style={{position:"absolute",width:s.w,height:s.h,background:`rgba(167,139,250,${.9-i*.12})`,
            borderRadius:"3px",boxShadow:"0 0 12px 6px rgba(88,28,135,.92)",
            left:s.x,top:s.y,transform:`rotate(${i%2===0?-28:24}deg)`,opacity:.84-i*.1}}/>
        ))}
        <div style={{position:"absolute",width:"130px",height:"3px",background:"linear-gradient(to right,transparent,rgba(88,28,135,.75),transparent)",top:"-20px",left:"32px",borderRadius:"9999px",opacity:.67,transform:"rotate(-8deg)"}}/>
        <div style={{position:"absolute",width:"104px",height:"3px",background:"linear-gradient(to right,transparent,rgba(88,28,135,.75),transparent)",top:"17px",left:"44px",borderRadius:"9999px",opacity:.67,transform:"rotate(8deg)"}}/>
      </>}
      {iH && <>
        {[{x:68,y:-24,s:14},{x:106,y:19,s:12},{x:140,y:-20,s:11},{x:170,y:14,s:10},{x:196,y:-13,s:8},{x:216,y:11,s:7}].map((e,i)=>(
          <div key={i} style={{position:"absolute",width:e.s,height:e.s,borderRadius:"50%",
            background:"radial-gradient(circle,white,#fde047)",boxShadow:"0 0 18px 9px rgba(253,224,71,1)",
            left:e.x,top:e.y,opacity:.92-i*.1}}/>
        ))}
        {[0,90].map((a,i)=>(
          <div key={i} style={{position:"absolute",width:"42px",height:"4px",right:"-3px",top:"-2px",
            background:"linear-gradient(to right,white,rgba(254,240,138,.6),transparent)",
            borderRadius:"9999px",transform:`rotate(${a}deg)`,transformOrigin:"left center",opacity:.88}}/>
        ))}
      </>}
      {iV && <>
        {[{x:58,y:-15,s:11},{x:90,y:13,s:9},{x:118,y:-13,s:8},{x:144,y:9,s:6}].map((e,i)=>(
          <div key={i} style={{position:"absolute",width:e.s,height:e.s,borderRadius:"50%",
            background:"radial-gradient(circle,white,#6ee7b7)",boxShadow:"0 0 14px 7px rgba(52,211,153,.95)",
            left:e.x,top:e.y,opacity:.86-i*.1}}/>
        ))}
        {[{x:72,r:15},{x:108,r:12},{x:136,r:10}].map((c,i)=>(
          <div key={i} style={{position:"absolute",width:c.r*2,height:c.r*2,borderRadius:"50%",
            border:"2px solid rgba(52,211,153,.72)",left:c.x-c.r,top:-c.r,
            animation:"ks .10s linear infinite"}}/>
        ))}
      </>}
      {/* Main orb 52px */}
      <div style={{width:"52px",height:"52px",flexShrink:0,borderRadius:"50%",
        background:`radial-gradient(circle,white 5%,${P.c} 24%,${P.b} 50%,${P.a} 82%)`,
        boxShadow:`0 0 0 7px ${P.b},0 0 40px 20px ${P.gl},0 0 80px 32px ${P.a}`}}/>
      {/* Nose pierce */}
      <div style={{position:"absolute",width:"26px",height:"26px",right:"-12px",
        background:"white",borderRadius:"50%",boxShadow:"0 0 36px 18px rgba(255,255,255,1)"}}/>
    </div>
  </>
}

// ════════════════════════════════════════════════════════════════════
// IMPACT — screen shake wrapper + 8 shockwaves + element bursts
// ════════════════════════════════════════════════════════════════════
function Impact({el}:{el:string}){
  const P=pal(el)
  const iF=["pyrus","fire"].includes(el), iA=["aquos","aquo","water"].includes(el)
  const iD=["darkus","darkness","dark"].includes(el), iH=["haos","light","lightness"].includes(el)
  const iV=["ventus","wind"].includes(el)

  return(
    // Screen shake wrapper
    <div style={{position:"absolute",left:"-50vw",top:"-50vh",width:"100vw",height:"100vh",
      pointerEvents:"none",animation:`xi-shake ${T.IMPACT*.7}ms ease-out forwards`,contain:"layout"}}>
      {/* Element screen tint */}
      <div style={{position:"absolute",inset:0,background:P.sc,
        animation:`xi-tint ${T.IMPACT}ms ease-out forwards`,willChange:"opacity"}}/>
      {/* Global vignette */}
      <div style={{position:"absolute",inset:0,
        background:"radial-gradient(ellipse at center,transparent 18%,rgba(0,0,0,.88) 100%)",
        animation:`xi-vign ${T.IMPACT}ms ease-out forwards`,willChange:"opacity"}}/>
      {/* Blinding flash */}
      <div style={{position:"absolute",inset:0,
        background:`radial-gradient(circle at center,white 0%,${P.w} 16%,${P.c} 40%,transparent 66%)`,
        animation:`xi-flash ${T.IMPACT}ms linear forwards`,willChange:"opacity"}}/>
      {/* Chromatic split R */}
      <div style={{position:"absolute",inset:0,
        background:"radial-gradient(circle at center,rgba(255,30,30,0) 0%,rgba(255,30,30,.26) 100%)",
        animation:`xi-chr ${T.IMPACT}ms ease-out forwards`,mixBlendMode:"screen",willChange:"transform,opacity"}}/>
      {/* Chromatic split B */}
      <div style={{position:"absolute",inset:0,
        background:"radial-gradient(circle at center,rgba(30,30,255,0) 0%,rgba(30,30,255,.26) 100%)",
        animation:`xi-chb ${T.IMPACT}ms ease-out forwards`,mixBlendMode:"screen",willChange:"transform,opacity"}}/>

      {/* Impact epicenter */}
      <div style={{position:"absolute",left:"50%",top:"50%",width:0,height:0}}>
        {/* Compression sphere */}
        <div style={{position:"absolute",left:"-125px",top:"-125px",width:"250px",height:"250px",
          borderRadius:"50%",background:P.gl,filter:"blur(40px)",
          animation:`xi-compress ${T.IMPACT}ms ease-out forwards`,willChange:"transform,opacity"}}/>
        {/* 8 shockwave rings */}
        {[{bw:"10px",d:0,spd:1.25,op:1},{bw:"7px",d:22,spd:1.55,op:.92},{bw:"5px",d:46,spd:1.9,op:.82},
          {bw:"4px",d:72,spd:2.4,op:.70},{bw:"3px",d:102,spd:3.1,op:.57},{bw:"2px",d:136,spd:4.0,op:.44},
          {bw:"2px",d:176,spd:5.2,op:.30},{bw:"1px",d:222,spd:7.0,op:.18}
        ].map((r,i)=>(
          <div key={i} style={{position:"absolute",left:"-90px",top:"-90px",width:"180px",height:"180px",
            borderRadius:"50%",border:`${r.bw} solid ${i<3?"white":`rgba(255,255,255,${r.op})`}`,
            boxShadow:i<3?`0 0 44px 18px ${P.gl}`:undefined,opacity:r.op,
            animation:`xi-wave ${T.IMPACT*r.spd}ms cubic-bezier(.03,0,.14,1) ${r.d}ms forwards`,
            willChange:"transform,opacity"}}/>
        ))}
        {/* 20 impact rays */}
        {Array.from({length:20},(_,i)=>(
          <div key={i} style={{position:"absolute",left:0,top:0,
            width:"150px",height:i%5===0?"5px":i%2===0?"3px":"2px",
            background:`linear-gradient(to right,white,${P.gl},transparent)`,
            borderRadius:"9999px",transformOrigin:"left center",transform:`rotate(${i*18}deg)`,
            opacity:i%5===0?.92:i%2===0?.68:.48,
            animation:`xi-ray ${T.IMPACT*1.35}ms ease-out ${i*3}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {/* 3 freeze rings */}
        {[{d:120,bw:"7px",del:0},{d:74,bw:"4px",del:12},{d:40,bw:"2px",del:24}].map((r,i)=>(
          <div key={i} style={{position:"absolute",left:-r.d/2,top:-r.d/2,width:r.d,height:r.d,
            borderRadius:"50%",border:`${r.bw} solid white`,
            boxShadow:`0 0 36px 16px ${P.gl},inset 0 0 28px 12px ${P.gl}`,
            animation:`xi-ring ${T.IMPACT}ms ease-out ${r.del}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {/* 4 ground waves */}
        {[{w:400,y:36,del:0,op:.92},{w:300,y:-40,del:18,op:.68},{w:220,y:62,del:36,op:.48},{w:160,y:-64,del:55,op:.32}].map((g,i)=>(
          <div key={i} style={{position:"absolute",left:-g.w/2,top:g.y,width:g.w,height:"20px",
            background:`linear-gradient(to right,transparent,${P.gl},transparent)`,
            borderRadius:"9999px",filter:"blur(6px)",opacity:g.op,
            animation:`xi-gwave ${T.IMPACT*1.5}ms ease-out ${g.del}ms forwards`,willChange:"transform,opacity"}}/>
        ))}

        {/* Element-specific impact bursts */}
        {iF && Array.from({length:10},(_,i)=>(
          <div key={i} style={{position:"absolute",left:"-5px",top:"-5px",width:"10px",height:"75px",
            background:"linear-gradient(to top,rgba(239,68,68,.88),rgba(249,115,22,.55),transparent)",
            borderRadius:"9999px",transformOrigin:"50% 100%",transform:`rotate(${i*36}deg)`,
            animation:`xi-fjet ${T.IMPACT*.88}ms ease-out ${i*7}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {iA && [80,135,195,260,330].map((s,i)=>(
          <div key={i} style={{position:"absolute",left:-s/2,top:-s/2,width:s,height:s,
            borderRadius:"50%",border:`${3-i*.5}px solid rgba(56,189,248,${.88-i*.14})`,
            boxShadow:i<2?`0 0 16px 7px rgba(56,189,248,.58)`:undefined,
            animation:`xi-wring ${T.IMPACT*1.7}ms cubic-bezier(.03,.4,.16,1) ${i*32}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {iD && Array.from({length:14},(_,i)=>(
          <div key={i} style={{position:"absolute",width:"95px",height:"2px",
            background:"linear-gradient(to right,rgba(167,139,250,.92),rgba(88,28,135,.4),transparent)",
            borderRadius:"9999px",transformOrigin:"left center",transform:`rotate(${i*25.7}deg)`,
            animation:`xi-dray ${T.IMPACT*.88}ms ease-out ${i*7}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {iH && <>
          {[0,45,90,135].map((a,i)=>(
            <div key={i} style={{position:"absolute",left:0,top:0,
              width:i<2?"160px":"110px",height:i<2?"6px":"4px",
              background:"linear-gradient(to right,white,rgba(254,240,138,.8),transparent)",
              borderRadius:"9999px",transformOrigin:"left center",transform:`rotate(${a}deg)`,
              animation:`xi-ray ${T.IMPACT*1.15}ms ease-out ${i*10}ms forwards`,opacity:.94,willChange:"transform,opacity"}}/>
          ))}
          {[65,118,175].map((s,i)=>(
            <div key={i} style={{position:"absolute",left:-s/2,top:-s/2,width:s,height:s,
              borderRadius:"50%",border:`${2-i*.45}px solid rgba(253,224,71,${.84-i*.18})`,
              animation:`xi-wave ${T.IMPACT*1.6}ms cubic-bezier(.04,.4,.16,1) ${i*26}ms forwards`,willChange:"transform,opacity"}}/>
          ))}
        </>}
        {iV && Array.from({length:8},(_,i)=>(
          <div key={i} style={{position:"absolute",width:"78px",height:"3px",
            background:`linear-gradient(to right,rgba(52,211,153,.9),transparent)`,
            borderRadius:"9999px",transformOrigin:"left center",transform:`rotate(${i*22.5+11}deg)`,
            animation:`xi-vslash ${T.IMPACT*.82}ms ease-out ${i*9}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {/* Smoke puffs ×4 */}
        {[{sx:-52,c:"rgba(210,210,210,.56)"},{sx:-18,c:"rgba(230,230,230,.50)"},{sx:18,c:"rgba(220,220,220,.52)"},{sx:52,c:"rgba(200,200,200,.48)"}].map((s,i)=>(
          <div key={i} style={({position:"absolute",left:"-36px",top:"-18px",
            width:"72px",height:"72px",borderRadius:"50%",
            background:`radial-gradient(circle,${s.c},transparent)`,filter:"blur(11px)",
            animation:`xi-smoke ${T.AFTERMATH*.7}ms ease-out ${i*20}ms forwards`,"--sx":`${s.sx}px`}) as React.CSSProperties}/>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// AFTERMATH — 80 particles + epic element signatures
// ════════════════════════════════════════════════════════════════════
function Aftermath({el,pts}:{el:string;pts:ReturnType<typeof mkP>}){
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
  return(
    <div style={{position:"absolute",left:0,top:0,pointerEvents:"none"}}>
      {/* Residual epicenter glow */}
      <div style={{position:"absolute",left:"-36px",top:"-36px",width:"72px",height:"72px",
        borderRadius:"50%",background:`radial-gradient(circle,${ec.g},transparent)`,filter:"blur(16px)",
        animation:`xa-linger ${T.AFTERMATH}ms ease-out forwards`,willChange:"transform,opacity"}}/>
      {/* ── Particles */}
      {pts.map(pt=>(
        <div key={pt.id} style={({position:"absolute",left:"-4px",top:"-4px",
          width:`${pt.size}px`,height:`${pt.size}px`,borderRadius:"50%",
          background:`radial-gradient(circle,${ec.c},${ec.t})`,
          boxShadow:`0 0 ${pt.size*2.8}px ${pt.size}px ${ec.g}`,
          animation:`xa-ptcl ${T.AFTERMATH*pt.life}ms cubic-bezier(.04,.38,.16,1) ${pt.delay}ms both`,
          willChange:"transform,opacity","--px":`${pt.px}px`,"--py":`${pt.py}px`}) as React.CSSProperties}/>
      ))}

      {/* ── FIRE: 5 ember columns + 5 expanding rings + 8 embers */}
      {iF && <>
        {[-32,-16,0,16,32].map((ox,i)=>(
          <div key={i} style={{position:"absolute",width:"13px",height:"100px",
            background:"linear-gradient(to top,rgba(251,146,60,.92),rgba(249,115,22,.42),transparent)",
            borderRadius:"9999px",filter:"blur(5px)",left:ox-6,top:-18,
            animation:`xa-fcol ${T.AFTERMATH*.75}ms ease-out ${i*32}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {[85,140,200,265,340].map((d,i)=>(
          <div key={i} style={{position:"absolute",left:-d/2,top:-d/2,width:d,height:d,
            borderRadius:"50%",border:`${2.5-i*.4}px solid rgba(249,115,22,${.75-i*.12})`,
            animation:`xa-rout ${T.AFTERMATH*.62}ms ease-out ${i*35}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {Array.from({length:8},(_,i)=>(
          <div key={i} style={{position:"absolute",left:"-3px",top:"-3px",width:"6px",height:"6px",borderRadius:"50%",
            background:"radial-gradient(circle,white,#fbbf24)",boxShadow:"0 0 8px 4px rgba(251,191,36,.98)",
            animation:`xa-ember ${T.AFTERMATH*.88}ms ease-out ${i*38}ms both`,
            willChange:"transform,opacity"} as React.CSSProperties}/>
        ))}
      </>}

      {/* ── AQUOS: 6 ripple rings + 22 droplets + water column */}
      {iA && <>
        {[62,108,158,214,276,345].map((d,i)=>(
          <div key={i} style={{position:"absolute",left:-d/2,top:-d/2,width:d,height:d,
            borderRadius:"50%",border:`${2.8-i*.35}px solid rgba(56,189,248,${.88-i*.12})`,
            boxShadow:i<2?`0 0 14px 6px rgba(56,189,248,.58)`:undefined,
            animation:`xa-ripple ${T.AFTERMATH*.72}ms cubic-bezier(.04,.4,.18,1) ${i*38}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {Array.from({length:22},(_,i)=>(
          <div key={i} style={({position:"absolute",width:"8px",height:"8px",borderRadius:"50%",
            background:"radial-gradient(circle,white,#7dd3fc)",boxShadow:"0 0 9px 4px rgba(56,189,248,.95)",
            left:"-4px",top:"-4px",
            animation:`xa-drop ${T.AFTERMATH*.62}ms ease-out ${i*12}ms both`,"--da":`${i*16.36}deg`}) as React.CSSProperties}/>
        ))}
        {/* Water column */}
        <div style={{position:"absolute",left:"-8px",top:"-60px",width:"16px",height:"70px",
          background:"linear-gradient(to top,rgba(56,189,248,.85),rgba(125,211,252,.4),transparent)",
          borderRadius:"9999px",filter:"blur(4px)",
          animation:`xa-wcol ${T.AFTERMATH*.68}ms ease-out forwards`,willChange:"transform,opacity"}}/>
      </>}

      {/* ── DARKNESS: 16-line absorption vortex + 5 rift tears + imploding rings */}
      {iD && <>
        {Array.from({length:16},(_,i)=>(
          <div key={i} style={{position:"absolute",width:"100px",height:"2px",
            background:"linear-gradient(to left,rgba(167,139,250,.94),rgba(88,28,135,.42),transparent)",
            borderRadius:"9999px",transformOrigin:"left center",transform:`rotate(${i*22.5}deg)`,
            animation:`xa-dabs ${T.AFTERMATH*.8}ms ease-in ${i*7}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {[-36,-14,0,14,36].map((x,i)=>(
          <div key={i} style={{position:"absolute",width:"2px",height:"82px",left:x,top:-40,
            background:`linear-gradient(to bottom,transparent,rgba(88,28,135,${.94-i*.05}),transparent)`,
            borderRadius:"9999px",boxShadow:"0 0 9px 4px rgba(88,28,135,.78)",
            animation:`xa-vrift ${T.AFTERMATH*.64}ms ease-out ${i*30}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {[88,148,218].map((d,i)=>(
          <div key={i} style={{position:"absolute",left:-d/2,top:-d/2,width:d,height:d,
            borderRadius:"50%",border:`${2-i*.4}px solid rgba(167,139,250,${.68-i*.16})`,
            animation:`xa-rin ${T.AFTERMATH*.75}ms ease-out ${i*38}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
      </>}

      {/* ── HAOS: 24-point starburst + 6 rings + divine pillar */}
      {iH && <>
        {Array.from({length:24},(_,i)=>(
          <div key={i} style={{position:"absolute",left:0,top:0,
            width:i%6===0?"155px":i%3===0?"105px":i%2===0?"70px":"45px",
            height:i%6===0?"6px":i%3===0?"4px":"2px",
            background:"linear-gradient(to right,white,rgba(254,240,138,.82),transparent)",
            borderRadius:"9999px",transformOrigin:"left center",transform:`rotate(${i*15}deg)`,
            animation:`xa-dout ${T.AFTERMATH*.52}ms ease-out ${i*8}ms forwards`,
            opacity:i%6===0?1:i%3===0?.88:i%2===0?.72:.52,willChange:"transform,opacity"}}/>
        ))}
        {[68,115,168,228,295,368].map((d,i)=>(
          <div key={i} style={{position:"absolute",left:-d/2,top:-d/2,width:d,height:d,
            borderRadius:"50%",border:`${2.2-i*.32}px solid rgba(253,224,71,${.85-i*.12})`,
            boxShadow:i<2?`0 0 14px 6px rgba(253,224,71,.58)`:undefined,
            animation:`xa-rout ${T.AFTERMATH*.6}ms ease-out ${i*35}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {/* Divine light pillar */}
        <div style={{position:"absolute",left:"-12px",top:"-120px",width:"24px",height:"130px",
          background:"linear-gradient(to top,white,rgba(254,240,138,.7),rgba(253,224,71,.3),transparent)",
          borderRadius:"9999px",filter:"blur(6px)",
          animation:`xa-pillar ${T.AFTERMATH*.72}ms ease-out forwards`,willChange:"transform,opacity"}}/>
      </>}

      {/* ── VENTUS: 5 spinning dashed rings + 14 wind slashes + feathers */}
      {iV && <>
        {[72,125,182,245,315].map((d,i)=>(
          <div key={i} style={{position:"absolute",left:-d/2,top:-d/2,width:d,height:d,
            borderRadius:"50%",border:`${2.2-i*.35}px dashed rgba(52,211,153,${.82-i*.13})`,
            animation:`${i%2===0?"ks":"kr"} ${.25+i*.07}s linear infinite, xa-rout ${T.AFTERMATH*.7}ms ease-out ${i*38}ms forwards`,
            willChange:"transform,opacity"}}/>
        ))}
        {Array.from({length:14},(_,i)=>(
          <div key={i} style={{position:"absolute",left:0,top:0,width:"72px",height:"3px",
            background:`linear-gradient(to right,rgba(52,211,153,.9),transparent)`,
            borderRadius:"9999px",transformOrigin:"left center",transform:`rotate(${i*25.7}deg)`,
            animation:`xa-vslash ${T.AFTERMATH*.57}ms ease-out ${i*14}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
      </>}

      {/* ── VOID: 14 shards + 10 cracks + desaturate rings */}
      {iVo && <>
        {[[48,0,13,5],[65,50,10,4],[-48,0,11,4],[-60,35,9,4],[0,-46,12,5],[0,44,10,4],
          [52,-30,9,3],[-50,-32,10,4],[34,56,8,3],[-32,-58,11,4],[58,24,8,3],[-24,60,9,4],
          [44,-52,7,4],[38,50,7,3]
        ].map(([x,y,w,h],i)=>(
          <div key={i} style={({position:"absolute",width:w,height:h,
            background:`rgba(148,163,184,${.86-i*.02})`,borderRadius:"2px",
            boxShadow:"0 0 8px 3px rgba(100,116,139,.74)",
            animation:`xa-vshard ${T.AFTERMATH*.74}ms cubic-bezier(.04,.38,.18,1) ${i*18}ms both`,
            willChange:"transform,opacity","--vx":`${x}px`,"--vy":`${y}px`}) as React.CSSProperties}/>
        ))}
        {Array.from({length:10},(_,i)=>(
          <div key={i} style={{position:"absolute",left:0,top:0,width:"68px",height:"1px",
            background:`linear-gradient(to right,rgba(148,163,184,.78),transparent)`,
            borderRadius:"9999px",transformOrigin:"left center",transform:`rotate(${i*18+9}deg)`,
            animation:`xa-vslash ${T.AFTERMATH*.52}ms ease-out ${i*16}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {[90,150,220].map((d,i)=>(
          <div key={i} style={{position:"absolute",left:-d/2,top:-d/2,width:d,height:d,
            borderRadius:"50%",border:`1px solid rgba(148,163,184,${.32-i*.08})`,
            animation:`xa-rout ${T.AFTERMATH*.58}ms ease-out ${i*45}ms forwards`,willChange:"transform,opacity"}}/>
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

  const nPts:{[k:string]:number}={fire:72,pyrus:72,aquos:64,aquo:64,water:64,
    haos:80,light:80,lightness:80,darkus:68,darkness:68,dark:68,ventus:60,wind:60,void:54}
  const pts=useMemo(()=>mkP(nPts[el]??54,el,id),[el,id])

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
       willChange:"transform",contain:"layout style paint"}
    :{position:"absolute",left:targetX,top:targetY,width:0,height:60,marginTop:-30,
       pointerEvents:"none",zIndex:10000,transformOrigin:"0 50%",transform:`rotate(${aDeg}deg)`,
       willChange:"transform",contain:"layout style paint"}

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
    @keyframes xi-flash{0%{opacity:1}6%{opacity:1}100%{opacity:0}}
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
        {phase==="impact"&&<Impact el={el}/>}
        {phase==="aftermath"&&<Aftermath el={el} pts={pts}/>}
      </div>
    </>
  )
  if(portalTarget) return createPortal(out,portalTarget)
  if(typeof document!=="undefined") return createPortal(out,document.body)
  return null
}
