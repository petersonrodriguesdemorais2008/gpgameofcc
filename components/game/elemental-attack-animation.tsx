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

// ─── Timing ────────────────────────────────────────────────────────────────
const T = {
  CHARGE:   140,
  RELEASE:  25,
  STRIKE:   195,
  IMPACT:   220,
  AFTERMATH:740,
  get TOTAL(){ return this.CHARGE+this.RELEASE+this.STRIKE+this.IMPACT+this.AFTERMATH }
}

// ─── Seeded RNG ────────────────────────────────────────────────────────────
const rng=(seed:number)=>{let s=seed^0x5851f42d;s=Math.imul(s^(s>>>16),0x45ae5235)|0;s^=s>>>11;return(s>>>0)/4294967296}
const mkPts=(n:number,el:string,id:string)=>Array.from({length:n},(_,i)=>{
  const r0=rng(i*7+id.charCodeAt(0)*13); const r1=rng(i*11+97); const r2=rng(i*13+31)
  const r3=rng(i*17+53); const r4=rng(i*19+79); const r5=rng(i*23+101)
  const fullAngle = r0*360
  const baseSpeed = 60+r1*140
  return { id:i, angle:fullAngle, speed:baseSpeed, size:2+r2*8, life:.4+r3*.6,
    delay:r4*120, spin:r5*720-360,
    px: baseSpeed*Math.cos(fullAngle*Math.PI/180),
    py: baseSpeed*Math.sin(fullAngle*Math.PI/180) }
})

// ─── Palettes ───────────────────────────────────────────────────────────────
type Pal={a:string;b:string;c:string;w:string;glow:string;screen:string;rgb:string}
const PALS:Record<string,Pal>={
  fire:    {a:"#dc2626",b:"#f97316",c:"#fbbf24",w:"#fff7ed",glow:"rgba(249,115,22,1)",screen:"rgba(239,68,68,0.28)",rgb:"249,115,22"},
  pyrus:   {a:"#dc2626",b:"#f97316",c:"#fbbf24",w:"#fff7ed",glow:"rgba(249,115,22,1)",screen:"rgba(239,68,68,0.28)",rgb:"249,115,22"},
  aquos:   {a:"#0369a1",b:"#0ea5e9",c:"#38bdf8",w:"#f0f9ff",glow:"rgba(14,165,233,1)",screen:"rgba(14,165,233,0.22)",rgb:"14,165,233"},
  aquo:    {a:"#0369a1",b:"#0ea5e9",c:"#38bdf8",w:"#f0f9ff",glow:"rgba(14,165,233,1)",screen:"rgba(14,165,233,0.22)",rgb:"14,165,233"},
  water:   {a:"#0369a1",b:"#0ea5e9",c:"#38bdf8",w:"#f0f9ff",glow:"rgba(14,165,233,1)",screen:"rgba(14,165,233,0.22)",rgb:"14,165,233"},
  haos:    {a:"#ca8a04",b:"#eab308",c:"#fde047",w:"#fefce8",glow:"rgba(234,179,8,1)",screen:"rgba(234,179,8,0.26)",rgb:"234,179,8"},
  light:   {a:"#ca8a04",b:"#eab308",c:"#fde047",w:"#fefce8",glow:"rgba(234,179,8,1)",screen:"rgba(234,179,8,0.26)",rgb:"234,179,8"},
  lightness:{a:"#ca8a04",b:"#eab308",c:"#fde047",w:"#fefce8",glow:"rgba(234,179,8,1)",screen:"rgba(234,179,8,0.26)",rgb:"234,179,8"},
  darkus:  {a:"#3b0764",b:"#6d28d9",c:"#a855f7",w:"#faf5ff",glow:"rgba(109,40,217,1)",screen:"rgba(88,28,135,0.32)",rgb:"109,40,217"},
  darkness:{a:"#3b0764",b:"#6d28d9",c:"#a855f7",w:"#faf5ff",glow:"rgba(109,40,217,1)",screen:"rgba(88,28,135,0.32)",rgb:"109,40,217"},
  dark:    {a:"#3b0764",b:"#6d28d9",c:"#a855f7",w:"#faf5ff",glow:"rgba(109,40,217,1)",screen:"rgba(88,28,135,0.32)",rgb:"109,40,217"},
  ventus:  {a:"#065f46",b:"#10b981",c:"#34d399",w:"#ecfdf5",glow:"rgba(16,185,129,1)",screen:"rgba(16,185,129,0.22)",rgb:"16,185,129"},
  wind:    {a:"#065f46",b:"#10b981",c:"#34d399",w:"#ecfdf5",glow:"rgba(16,185,129,1)",screen:"rgba(16,185,129,0.22)",rgb:"16,185,129"},
  void:    {a:"#1e293b",b:"#475569",c:"#94a3b8",w:"#f8fafc",glow:"rgba(71,85,105,1)",screen:"rgba(0,0,0,0.38)",rgb:"71,85,105"},
}
const pal=(el:string):Pal=>PALS[el]||{a:"#4338ca",b:"#6366f1",c:"#a5b4fc",w:"#eef2ff",glow:"rgba(99,102,241,1)",screen:"rgba(99,102,241,0.2)",rgb:"99,102,241"}

// ─── Helpers ────────────────────────────────────────────────────────────────
type S=React.CSSProperties
const el2=(p:Pal,children:React.ReactNode,sz=100)=>(
  <div style={{position:"absolute",left:-sz/2,top:-sz/2,width:sz,height:sz,contain:"layout style paint"}}>
    {children}
  </div>
)

// ═══════════════════════════════════════════════════════════════════════════
// CHARGE
// ═══════════════════════════════════════════════════════════════════════════
function Charge({el,id}:{el:string;id:string}){
  const P=pal(el)
  const iF=["pyrus","fire"].includes(el)
  const iA=["aquos","aquo","water"].includes(el)
  const iD=["darkus","darkness","dark"].includes(el)
  const iH=["haos","light","lightness"].includes(el)
  const iV=["ventus","wind"].includes(el)
  const iVo=el==="void"

  // Shared: rings
  const R=(d:number,c:string,bw:string,g?:string,an?:string,op=1)=>(
    <div style={{position:"absolute",left:-d/2,top:-d/2,width:d,height:d,
      borderRadius:"50%",border:`${bw} solid ${c}`,boxShadow:g,opacity:op,animation:an,
      willChange:"transform,opacity"}}/>
  )
  // Orbiting dot
  const Orb=(r:number,sz:number,c:string,dur:number,del:number,rev=false)=>(
    <div style={{position:"absolute",left:0,top:0,width:sz,height:sz,borderRadius:"50%",
      background:c,boxShadow:`0 0 ${sz*2}px ${sz}px ${c}`,
      animation:`xc-orbit-r${Math.round(r)} ${dur}ms linear ${del}ms infinite ${rev?"reverse":""}`,
      willChange:"transform"}}/>
  )

  if(iF) return <div style={{position:"absolute",left:-70,top:-70,width:140,height:140}}>
    {/* 4 concentric fire rings spinning */}
    {R(136,"rgba(251,146,60,0.6)","1px","0 0 30px 12px rgba(249,115,22,0.7)","xc-spin-f 0.07s linear infinite")}
    {R(114,"#f97316","2px","0 0 24px 10px rgba(249,115,22,0.85)","xc-spin-r 0.09s linear infinite")}
    {R(88 ,"#fbbf24","3px","0 0 18px 8px rgba(251,191,36,0.8)","xc-spin-f 0.06s linear infinite")}
    {R(62 ,"#ef4444","2px","0 0 14px 7px rgba(239,68,68,0.85)","xc-spin-r 0.05s linear infinite")}
    {/* 12 converging fire tendrils */}
    {Array.from({length:12},(_,i)=><div key={i} style={{position:"absolute",left:70,top:70,
      width:"68px",height:"3px",background:"linear-gradient(to right,transparent,rgba(249,115,22,0.9),rgba(251,191,36,0.5))",
      borderRadius:"9999px",transformOrigin:"0 50%",transform:`rotate(${i*30}deg) translateX(-68px)`,
      animation:`xc-tendril 0.07s ease-in-out ${i*8}ms infinite`,willChange:"transform,opacity"}}/>)}
    {/* 10 orbiting embers */}
    {[[70,9,"rgba(251,191,36,0.98)",140,0],[64,7,"rgba(249,115,22,0.9)",108,35],
      [68,8,"#fff7ed",125,70],[60,6,"rgba(239,68,68,0.85)",95,18],
      [66,5,"rgba(254,200,60,0.8)",115,52],[62,7,"rgba(255,255,255,0.9)",100,90],
      [64,5,"rgba(251,146,60,0.88)",120,25],[58,4,"rgba(249,115,22,0.75)",88,65],
      [70,6,"rgba(251,191,36,0.82)",132,40],[60,4,"rgba(255,200,80,0.7)",105,80]
    ].map(([r,s,c,dur,del],i)=>
      <div key={i} style={{position:"absolute",left:70,top:70,width:s,height:s,
        borderRadius:"50%",background:c as string,boxShadow:`0 0 ${(s as number)*2}px ${s}px ${c}`,
        animation:`xc-orbit-r${Math.round(r as number)} ${dur}ms linear ${del}ms infinite`,
        willChange:"transform"}}/>
    )}
    {/* 10 flame petals */}
    {Array.from({length:10},(_,i)=><div key={i} style={{position:"absolute",left:70,top:70,
      width:"16px",height:"44px",
      background:"linear-gradient(to top,rgba(239,68,68,0.9),rgba(249,115,22,0.6),rgba(251,191,36,0.3),transparent)",
      borderRadius:"50% 50% 30% 30%",transformOrigin:"50% 100%",
      transform:`rotate(${i*36}deg) translateY(-58px)`,
      animation:`xc-petal 0.07s ease-in-out ${i*15}ms infinite`,willChange:"transform,opacity"}}/>)}
    {/* White-hot core 52px */}
    <div style={{position:"absolute",left:70-26,top:70-26,width:52,height:52,borderRadius:"50%",
      background:"radial-gradient(circle,white 5%,#fb923c 25%,#dc2626 55%,#7f1d1d 100%)",
      boxShadow:"0 0 0 7px #f97316,0 0 40px 20px rgba(251,146,60,1),0 0 80px 36px rgba(220,38,38,0.82)",
      animation:"xc-core-pulse 0.055s ease-in-out infinite",willChange:"transform,opacity"}}/>
    {/* Burst rings */}
    {R(138,"rgba(251,146,60,0.42)","1px",undefined,"xc-burst 0.08s ease-out infinite")}
    {R(138,"rgba(251,146,60,0.24)","1px",undefined,"xc-burst 0.08s ease-out 0.04s infinite")}
    <div style={{position:"absolute",left:0,top:0,width:140,height:140,borderRadius:"50%",
      background:"radial-gradient(circle,rgba(251,146,60,0.35) 0%,transparent 70%)",
      animation:"xc-core-pulse 0.08s ease-in-out infinite"}}/>
  </div>

  if(iA) return <div style={{position:"absolute",left:-65,top:-65,width:130,height:130}}>
    {R(126,"rgba(14,165,233,0.5)","1px","0 0 26px 10px rgba(14,165,233,0.65)","xc-spin-r 0.12s linear infinite")}
    {R(106,"#38bdf8","2px","0 0 22px 9px rgba(56,189,248,0.8)","xc-spin-f 0.15s linear infinite")}
    {R(82 ,"#7dd3fc","2px","0 0 14px 6px rgba(125,211,252,0.72)","xc-spin-r 0.10s linear infinite")}
    {R(56 ,"#bae6fd","1px",undefined,"xc-spin-f 0.08s linear infinite")}
    {/* Water stream columns */}
    {Array.from({length:8},(_,i)=><div key={i} style={{position:"absolute",left:65,top:65,
      width:"5px",height:"52px",background:"linear-gradient(to top,rgba(14,165,233,0.88),rgba(56,189,248,0.4),transparent)",
      borderRadius:"9999px",transformOrigin:"50% 100%",transform:`rotate(${i*45}deg) translateY(-62px)`,
      animation:`xc-stream 0.18s ease-in-out ${i*22}ms infinite`,willChange:"transform,opacity"}}/>)}
    {[[64,8,"rgba(56,189,248,0.95)",220,0],[58,6,"rgba(125,211,252,0.85)",185,55],[66,7,"rgba(255,255,255,0.88)",205,110],
      [60,5,"rgba(14,165,233,0.78)",170,165],[64,4,"rgba(186,230,253,0.72)",195,220],[56,6,"rgba(56,189,248,0.82)",160,75]
    ].map(([r,s,c,dur,del],i)=>
      <div key={i} style={{position:"absolute",left:65,top:65,width:s,height:s,
        borderRadius:"50%",background:c as string,boxShadow:`0 0 ${(s as number)*2}px ${s}px ${c}`,
        animation:`xc-orbit-r${Math.round(r as number)} ${dur}ms linear ${del}ms infinite`,willChange:"transform"}}/>
    )}
    <div style={{position:"absolute",left:65-22,top:65-22,width:44,height:44,borderRadius:"50%",
      background:"radial-gradient(circle,white 8%,#7dd3fc 28%,#0284c7 60%,#0c4a6e 100%)",
      boxShadow:"0 0 0 6px #38bdf8,0 0 36px 18px rgba(56,189,248,1),0 0 72px 30px rgba(14,165,233,0.78)",
      animation:"xc-core-pulse 0.08s ease-in-out infinite",willChange:"transform,opacity"}}/>
    {R(128,"rgba(56,189,248,0.32)","1px",undefined,"xc-burst 0.10s ease-out infinite")}
  </div>

  if(iD) return <div style={{position:"absolute",left:-68,top:-68,width:136,height:136}}>
    {R(132,"rgba(76,29,149,0.65)","2px","0 0 36px 16px rgba(88,28,135,0.9)","xc-consume 0.14s ease-in infinite")}
    {R(108,"#7e22ce","2px","0 0 22px 10px rgba(168,85,247,0.72)","xc-spin-r 0.20s linear infinite")}
    {R(80 ,"#a855f7","1px",undefined,"xc-spin-f 0.14s linear infinite")}
    {/* 12 shadow tendrils reaching OUT then snapping back */}
    {Array.from({length:12},(_,i)=><div key={i} style={{position:"absolute",left:68,top:68,
      width:"50px",height:"2px",background:"linear-gradient(to right,rgba(88,28,135,0.95),rgba(88,28,135,0.35),transparent)",
      borderRadius:"9999px",transformOrigin:"0 50%",transform:`rotate(${i*30}deg)`,
      animation:`xc-dark-snap 0.15s ease-in-out ${i*14}ms infinite`,willChange:"transform,opacity"}}/>)}
    {/* 16 void particles converging inward */}
    {Array.from({length:16},(_,i)=><div key={i} style={{position:"absolute",left:68,top:68,
      width:"3px",height:"3px",borderRadius:"50%",background:"rgba(192,132,252,0.9)",
      animation:`xc-void-converge 0.20s ease-in ${i*12}ms infinite`,willChange:"transform,opacity",
      transform:`rotate(${i*22.5}deg) translateX(72px)`}}/>)}
    {[[60,7,"rgba(88,28,135,0.8)",620,0,true],[54,5,"rgba(168,85,247,0.68)",500,180,false],
      [62,6,"rgba(192,132,252,0.6)",560,360,true],[56,4,"rgba(76,29,149,0.55)",440,90,false],
      [64,5,"rgba(126,34,206,0.65)",580,270,true]
    ].map(([r,s,c,dur,del,rv],i)=>
      <div key={i} style={{position:"absolute",left:68,top:68,width:s,height:s,
        borderRadius:"50%",background:c as string,
        animation:`xc-orbit-r${Math.round(r as number)} ${dur}ms linear ${del}ms infinite${rv?" reverse":""}`,
        willChange:"transform"}}/>
    )}
    {/* Void singularity — absolute black with purple halo */}
    <div style={{position:"absolute",left:68-18,top:68-18,width:36,height:36,borderRadius:"50%",
      background:"radial-gradient(circle,#0a0010 16%,black 58%)",
      boxShadow:"0 0 0 5px #581c87,0 0 0 12px rgba(88,28,135,0.55),0 0 52px 26px rgba(88,28,135,1),0 0 110px 50px rgba(88,28,135,0.68)"}}/>
    {R(134,"rgba(168,85,247,0.28)","1px",undefined,"xc-burst 0.14s ease-out infinite")}
    <div style={{position:"absolute",left:0,top:0,width:136,height:136,borderRadius:"50%",
      background:"radial-gradient(circle,rgba(88,28,135,0.52) 0%,transparent 70%)",
      animation:"xc-consume 0.10s ease-in infinite"}}/>
  </div>

  if(iH) return <div style={{position:"absolute",left:-75,top:-75,width:150,height:150}}>
    {/* 40 divine rays — 4 lengths */}
    {Array.from({length:40},(_,i)=>{
      const l=i%10===0?58:i%5===0?42:i%2===0?28:16
      const op=i%10===0?1:i%5===0?0.84:i%2===0?0.64:0.42
      return <div key={i} style={{position:"absolute",left:75,top:75,
        width:"2px",height:`${l}px`,
        background:"linear-gradient(to top,transparent,rgba(254,249,195,0.9),white)",
        borderRadius:"9999px",transformOrigin:"50% 100%",
        transform:`rotate(${i*9}deg) translateY(-${l}px)`,opacity:op,
        animation:`xc-divine-ray 0.06s ease-in-out ${i%5===0?0:i%5===1?12:i%5===2?24:i%5===3?36:48}ms infinite`,
        willChange:"transform,opacity"}}/>
    })}
    {/* 6 orbiting golden orbs */}
    {[[72,10,"rgba(253,224,71,0.99)",118,0],[66,8,"rgba(255,255,255,0.95)",98,40],[74,9,"rgba(254,240,138,0.92)",132,80],
      [68,7,"rgba(253,224,71,0.88)",108,120],[72,6,"rgba(255,255,255,0.82)",122,160],[64,5,"rgba(254,240,138,0.76)",95,200]
    ].map(([r,s,c,dur,del],i)=>
      <div key={i} style={{position:"absolute",left:75,top:75,width:s,height:s,
        borderRadius:"50%",background:c as string,boxShadow:`0 0 ${(s as number)*3}px ${s}px ${c}`,
        animation:`xc-orbit-r${Math.round(r as number)} ${dur}ms linear ${del}ms infinite`,willChange:"transform"}}/>
    )}
    {/* Blazing white-gold core */}
    <div style={{position:"absolute",left:75-28,top:75-28,width:56,height:56,borderRadius:"50%",
      background:"white",
      boxShadow:"0 0 0 9px #fef08a,0 0 0 18px rgba(253,224,71,0.52),0 0 80px 40px rgba(254,240,138,1),0 0 150px 60px rgba(253,224,71,0.5)",
      animation:"xc-core-pulse 0.05s ease-in-out infinite",willChange:"transform,opacity"}}/>
    {R(148,"rgba(254,240,138,0.55)","1px",undefined,"xc-burst 0.08s ease-out infinite")}
    {R(148,"rgba(254,240,138,0.32)","1px",undefined,"xc-burst 0.08s ease-out 0.04s infinite")}
    <div style={{position:"absolute",left:0,top:0,width:150,height:150,borderRadius:"50%",
      background:"radial-gradient(circle,rgba(254,240,138,0.48) 0%,transparent 68%)",
      animation:"xc-halo 0.07s ease-in-out infinite"}}/>
  </div>

  if(iV) return <div style={{position:"absolute",left:-64,top:-64,width:128,height:128}}>
    {R(124,"rgba(16,185,129,0.5)","1px","0 0 24px 9px rgba(16,185,129,0.68)","xc-spin-f 0.09s linear infinite")}
    {R(102,"#34d399","2px","0 0 18px 7px rgba(52,211,153,0.8)","xc-spin-r 0.07s linear infinite")}
    {R(76 ,"#6ee7b7","2px","0 0 12px 5px rgba(110,231,183,0.72)","xc-spin-f 0.055s linear infinite")}
    {R(50 ,"#a7f3d0","1px",undefined,"xc-spin-r 0.045s linear infinite")}
    {/* Wind blade arcs */}
    {Array.from({length:8},(_,i)=><div key={i} style={{position:"absolute",left:64,top:64,
      width:"32px",height:"3px",background:"linear-gradient(to right,transparent,rgba(52,211,153,0.88),rgba(110,231,183,0.5),transparent)",
      borderRadius:"9999px",transformOrigin:"center center",transform:`rotate(${i*22.5}deg)`,
      animation:`xc-blade 0.075s ease-in-out ${i*10}ms infinite`,willChange:"transform,opacity"}}/>)}
    {[[58,8,"rgba(52,211,153,0.95)",165,0],[52,6,"rgba(110,231,183,0.85)",135,45],[60,7,"rgba(255,255,255,0.88)",150,90],
      [54,5,"rgba(16,185,129,0.78)",120,135],[60,4,"rgba(167,243,208,0.72)",140,180]
    ].map(([r,s,c,dur,del],i)=>
      <div key={i} style={{position:"absolute",left:64,top:64,width:s,height:s,
        borderRadius:"50%",background:c as string,boxShadow:`0 0 ${(s as number)*2}px ${s}px ${c}`,
        animation:`xc-orbit-r${Math.round(r as number)} ${dur}ms linear ${del}ms infinite`,willChange:"transform"}}/>
    )}
    <div style={{position:"absolute",left:64-24,top:64-24,width:48,height:48,borderRadius:"50%",
      background:"radial-gradient(circle,white 8%,#6ee7b7 28%,#059669 60%,#064e3b 100%)",
      boxShadow:"0 0 0 6px #34d399,0 0 38px 18px rgba(52,211,153,1),0 0 76px 30px rgba(16,185,129,0.78)",
      animation:"xc-core-pulse 0.07s ease-in-out infinite",willChange:"transform,opacity"}}/>
  </div>

  // VOID
  return <div style={{position:"absolute",left:-65,top:-65,width:130,height:130}}>
    {R(126,"rgba(71,85,105,0.5)","1px","0 0 20px 8px rgba(71,85,105,0.65)","xc-spin-f 0.42s linear infinite")}
    {R(104,"#64748b","2px","0 0 15px 6px rgba(100,116,139,0.75)","xc-spin-r 0.28s linear infinite")}
    {R(78 ,"#94a3b8","1px",undefined,"xc-spin-f 0.20s linear infinite")}
    {/* Glitch bars */}
    {Array.from({length:9},(_,i)=><div key={i} style={{position:"absolute",left:65,top:65,
      width:`${20+i*4}px`,height:"2px",background:`rgba(148,163,184,${0.8-i*0.06})`,
      borderRadius:"2px",transformOrigin:"center center",transform:`rotate(${i*40}deg)`,
      animation:`xc-void-glitch 0.05s step-end ${i*8}ms infinite`,willChange:"opacity"}}/>)}
    {[[52,6,"rgba(148,163,184,0.85)",480,0],[46,4,"rgba(203,213,225,0.75)",360,160],[54,5,"rgba(248,250,252,0.65)",420,320]
    ].map(([r,s,c,dur,del],i)=>
      <div key={i} style={{position:"absolute",left:65,top:65,width:s,height:s,
        borderRadius:"50%",background:c as string,
        animation:`xc-orbit-r${Math.round(r as number)} ${dur}ms linear ${del}ms infinite`,willChange:"transform"}}/>
    )}
    <div style={{position:"absolute",left:65-20,top:65-20,width:40,height:40,borderRadius:"50%",
      background:"radial-gradient(circle,white 6%,#94a3b8 28%,#334155 60%,black 100%)",
      boxShadow:"0 0 0 5px #475569,0 0 28px 14px rgba(71,85,105,1),0 0 60px 24px rgba(30,41,59,0.8)"}}/>
    {[{d:92,op:0.3},{d:110,op:0.2},{d:128,op:0.12}].map((r,i)=>
      <div key={i} style={{position:"absolute",left:65-r.d/2,top:65-r.d/2,width:r.d,height:r.d,
        borderRadius:"50%",border:`1px solid rgba(148,163,184,${r.op})`,
        animation:`xc-spin-${i%2===0?"f":"r"} ${0.9+i*0.3}s linear infinite`}}/>
    )}
  </div>
}

// ═══════════════════════════════════════════════════════════════════════════
// STRIKE
// ═══════════════════════════════════════════════════════════════════════════
function Strike({el,dist}:{el:string;dist:number}){
  const P=pal(el)
  const mv:S={animation:`xs-fly ${T.STRIKE}ms ${["pyrus","fire"].includes(el)?"cubic-bezier(0.05,0,0.03,1)":["darkus","darkness","dark"].includes(el)?"cubic-bezier(0.04,0,0.05,1)":"cubic-bezier(0.06,0,0.04,1)"} forwards`,willChange:"transform"}
  const sl=(n:number,clr:string,baseOp:number)=>Array.from({length:n},(_,i)=>(
    <div key={`sl${i}`} style={{position:"fixed",left:0,top:`calc(50% + ${(i-(n-1)/2)*8}px)`,
      width:"100vw",height:i===(n-1)/2?"4px":"1.5px",
      background:`linear-gradient(to right,transparent 0%,${clr} 40%,${clr} 60%,transparent 100%)`,
      pointerEvents:"none",willChange:"opacity",
      animation:`xs-speed-line ${T.STRIKE}ms cubic-bezier(0.02,0,0.06,1) ${i*4}ms forwards`,
      opacity:baseOp-Math.abs(i-(n-1)/2)*0.035}}/>
  ))

  const iF=["pyrus","fire"].includes(el), iA=["aquos","aquo","water"].includes(el)
  const iD=["darkus","darkness","dark"].includes(el), iH=["haos","light","lightness"].includes(el)
  const iV=["ventus","wind"].includes(el)

  return <>
    {sl(11,P.b,0.26)}
    <div style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",display:"flex",alignItems:"center",...mv}}>
      {/* ── OUTER GLOW TRAIL */}
      <div style={{position:"absolute",width:"290px",height:iH?"36px":iF?"32px":"26px",
        background:`linear-gradient(to right,transparent,${P.a}22,${P.a}88,${P.b},${P.c}66)`,
        borderRadius:"9999px",filter:"blur(7px)",opacity:.85,willChange:"opacity",
        animation:`xs-trail-fade ${T.STRIKE}ms ease-in forwards`}}/>
      {/* ── MID TRAIL */}
      <div style={{position:"absolute",width:"230px",height:iH?"20px":iF?"17px":"13px",
        background:`linear-gradient(to right,transparent,${P.a}55,${P.b},${P.c}77)`,
        borderRadius:"9999px",filter:"blur(2.5px)",opacity:.92}}/>
      {/* ── SHARP CORE */}
      <div style={{position:"absolute",width:"160px",height:iH?"8px":iF?"7px":"5px",
        background:`linear-gradient(to right,transparent,${P.b},white 70%,${P.c}44)`,
        borderRadius:"9999px",opacity:.96}}/>
      {/* ── ELEMENT-SPECIFIC EXTRAS */}
      {iF && <>
        {[{x:55,y:-20,s:12},{x:90,y:16,s:10},{x:120,y:-16,s:9},{x:148,y:11,s:8},{x:172,y:-10,s:6},{x:192,y:8,s:5}].map((e,i)=>(
          <div key={i} style={{position:"absolute",width:e.s,height:e.s,borderRadius:"50%",
            background:"radial-gradient(circle,white,#fbbf24)",boxShadow:"0 0 14px 7px rgba(251,191,36,1)",
            left:e.x,top:e.y,opacity:.88-i*.1,willChange:"opacity"}}/>
        ))}
        <div style={{position:"absolute",width:"150px",height:"5px",
          background:"linear-gradient(to right,transparent,rgba(251,191,36,0.8),white,transparent)",
          top:"-18px",left:"35px",borderRadius:"9999px",opacity:.72}}/>
        <div style={{position:"absolute",width:"110px",height:"4px",
          background:"linear-gradient(to right,transparent,rgba(249,115,22,0.6),transparent)",
          top:"15px",left:"55px",borderRadius:"9999px",opacity:.58}}/>
        {/* Sonic cone ahead */}
        <div style={{position:"absolute",width:"0",height:"0",right:"38px",top:"-20px",
          borderLeft:"40px solid transparent",borderRight:"0px solid transparent",
          borderBottom:"40px solid rgba(249,115,22,0.18)"}}/>
      </>}
      {iA && <>
        {[{x:58,y:-16,s:11},{x:92,y:13,s:9},{x:120,y:-14,s:8},{x:145,y:9,s:7},{x:166,y:-9,s:5}].map((e,i)=>(
          <div key={i} style={{position:"absolute",width:e.s,height:e.s,borderRadius:"50%",
            background:"radial-gradient(circle,white,#7dd3fc)",boxShadow:"0 0 12px 6px rgba(56,189,248,0.95)",
            left:e.x,top:e.y,opacity:.84-i*.1}}/>
        ))}
        {[{x:68,y:-22,w:5,h:20},{x:100,y:18,w:4,h:16},{x:130,y:-20,w:3,h:14}].map((d,i)=>(
          <div key={i} style={{position:"absolute",width:d.w,height:d.h,
            background:`linear-gradient(to top,${P.a},rgba(255,255,255,0.6),transparent)`,
            borderRadius:"9999px",left:d.x,top:d.y,opacity:.72-i*.15}}/>
        ))}
      </>}
      {iD && <>
        {[{x:50,y:-14,w:18,h:4},{x:78,y:11,w:14,h:4},{x:104,y:-13,w:10,h:3},{x:128,y:9,w:8,h:3}].map((s,i)=>(
          <div key={i} style={{position:"absolute",width:s.w,height:s.h,background:`rgba(168,85,247,${.88-i*.12})`,
            borderRadius:"2px",boxShadow:"0 0 11px 5px rgba(88,28,135,0.9)",
            left:s.x,top:s.y,transform:`rotate(${i%2===0?-26:22}deg)`,opacity:.82-i*.1}}/>
        ))}
        <div style={{position:"absolute",width:"120px",height:"3px",
          background:"linear-gradient(to right,transparent,rgba(88,28,135,0.72),transparent)",
          top:"-18px",left:"30px",borderRadius:"9999px",opacity:.65,transform:"rotate(-8deg)"}}/>
        <div style={{position:"absolute",width:"96px",height:"3px",
          background:"linear-gradient(to right,transparent,rgba(88,28,135,0.72),transparent)",
          top:"16px",left:"42px",borderRadius:"9999px",opacity:.65,transform:"rotate(8deg)"}}/>
      </>}
      {iH && <>
        {[{x:64,y:-22,s:13},{x:100,y:17,s:11},{x:132,y:-18,s:10},{x:160,y:13,s:9},{x:185,y:-12,s:7},{x:205,y:10,s:6}].map((e,i)=>(
          <div key={i} style={{position:"absolute",width:e.s,height:e.s,borderRadius:"50%",
            background:"radial-gradient(circle,white,#fde047)",boxShadow:"0 0 16px 8px rgba(253,224,71,1)",
            left:e.x,top:e.y,opacity:.9-i*.1}}/>
        ))}
        {/* Divine cross at tip */}
        {[0,90].map((a,i)=>(
          <div key={i} style={{position:"absolute",width:"36px",height:"3px",right:"-2px",top:"-1px",
            background:"linear-gradient(to right,white,rgba(254,240,138,0.5),transparent)",
            borderRadius:"9999px",transform:`rotate(${a}deg)`,transformOrigin:"left center",opacity:.85}}/>
        ))}
      </>}
      {iV && <>
        {[{x:56,y:-14,s:10},{x:86,y:12,s:8},{x:112,y:-13,s:7},{x:136,y:9,s:5}].map((e,i)=>(
          <div key={i} style={{position:"absolute",width:e.s,height:e.s,borderRadius:"50%",
            background:"radial-gradient(circle,white,#6ee7b7)",boxShadow:"0 0 12px 6px rgba(52,211,153,0.95)",
            left:e.x,top:e.y,opacity:.84-i*.1}}/>
        ))}
        {/* Spiral wind rings */}
        {[{x:70,r:14},{x:104,r:11},{x:132,r:9}].map((c,i)=>(
          <div key={i} style={{position:"absolute",width:c.r*2,height:c.r*2,borderRadius:"50%",
            border:"1.5px solid rgba(52,211,153,0.7)",left:c.x-c.r,top:-c.r,
            animation:"xc-spin-f 0.12s linear infinite"}}/>
        ))}
      </>}
      {/* ── MAIN ORB */}
      <div style={{width:"48px",height:"48px",flexShrink:0,borderRadius:"50%",
        background:`radial-gradient(circle,white 6%,${P.c} 26%,${P.b} 52%,${P.a} 82%)`,
        boxShadow:`0 0 0 6px ${P.b},0 0 36px 18px ${P.glow},0 0 72px 28px ${P.a}`}}/>
      {/* Nose flash */}
      <div style={{position:"absolute",width:"22px",height:"22px",right:"-10px",background:"white",
        borderRadius:"50%",boxShadow:"0 0 30px 16px rgba(255,255,255,1)"}}/>
      {/* Sonic boom cone */}
      <div style={{position:"absolute",width:"0",height:"0",right:"36px",top:"-24px",
        borderLeft:`50px solid ${P.screen}`,
        borderTop:"24px solid transparent",borderBottom:"24px solid transparent"}}/>
    </div>
  </>
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPACT
// ═══════════════════════════════════════════════════════════════════════════
function Impact({el}:{el:string}){
  const P=pal(el)
  const iF=["pyrus","fire"].includes(el), iA=["aquos","aquo","water"].includes(el)
  const iD=["darkus","darkness","dark"].includes(el), iH=["haos","light","lightness"].includes(el)
  const iV=["ventus","wind"].includes(el)
  return(
    <div style={{position:"absolute",left:"-50vw",top:"-50vh",width:"100vw",height:"100vh",pointerEvents:"none"}}>
      {/* Element screen tint */}
      <div style={{position:"absolute",inset:0,background:P.screen,
        animation:`xi-tint ${T.IMPACT}ms ease-out forwards`,willChange:"opacity"}}/>
      {/* Heavy vignette */}
      <div style={{position:"absolute",inset:0,
        background:"radial-gradient(ellipse at center,transparent 20%,rgba(0,0,0,0.85) 100%)",
        animation:`xi-vignette ${T.IMPACT}ms ease-out forwards`,willChange:"opacity"}}/>
      {/* Full flash */}
      <div style={{position:"absolute",inset:0,
        background:`radial-gradient(circle at center,white 0%,${P.w} 18%,${P.c} 42%,transparent 68%)`,
        animation:`xi-flash ${T.IMPACT}ms linear forwards`,willChange:"opacity"}}/>
      {/* Chroma R */}
      <div style={{position:"absolute",inset:0,
        background:"radial-gradient(circle at center,rgba(255,40,40,0) 0%,rgba(255,40,40,0.24) 100%)",
        animation:`xi-chroma-r ${T.IMPACT}ms ease-out forwards`,mixBlendMode:"screen",willChange:"transform,opacity"}}/>
      {/* Chroma B */}
      <div style={{position:"absolute",inset:0,
        background:"radial-gradient(circle at center,rgba(40,40,255,0) 0%,rgba(40,40,255,0.24) 100%)",
        animation:`xi-chroma-b ${T.IMPACT}ms ease-out forwards`,mixBlendMode:"screen",willChange:"transform,opacity"}}/>
      {/* ── IMPACT CENTER */}
      <div style={{position:"absolute",left:"50%",top:"50%",width:0,height:0}}>
        {/* Compression orb */}
        <div style={{position:"absolute",left:"-110px",top:"-110px",width:"220px",height:"220px",
          borderRadius:"50%",background:P.glow,filter:"blur(36px)",
          animation:`xi-compress ${T.IMPACT}ms ease-out forwards`,willChange:"transform,opacity"}}/>
        {/* 8 shockwave rings */}
        {[{sz:160,bw:"9px",d:0,spd:1.3,op:1},{sz:160,bw:"6px",d:25,spd:1.6,op:.9},
          {sz:160,bw:"4px",d:50,spd:2.0,op:.8},{sz:160,bw:"3px",d:80,spd:2.5,op:.68},
          {sz:160,bw:"2px",d:110,spd:3.2,op:.55},{sz:160,bw:"2px",d:145,spd:4.0,op:.42},
          {sz:160,bw:"1px",d:185,spd:5.0,op:.30},{sz:160,bw:"1px",d:230,spd:6.5,op:.18},
        ].map((r,i)=>(
          <div key={i} style={{position:"absolute",left:-r.sz/2,top:-r.sz/2,
            width:r.sz,height:r.sz,borderRadius:"50%",
            border:`${r.bw} solid ${i<3?"white":`rgba(255,255,255,${r.op})`}`,
            boxShadow:i<3?`0 0 40px 16px ${P.glow}`:undefined,opacity:r.op,
            animation:`xi-shockwave ${T.IMPACT*r.spd}ms cubic-bezier(0.03,0,0.16,1) ${r.d}ms forwards`,
            willChange:"transform,opacity"}}/>
        ))}
        {/* 16 impact rays */}
        {Array.from({length:16},(_,i)=>(
          <div key={i} style={{position:"absolute",width:"130px",height:i%4===0?"4px":"2px",
            background:`linear-gradient(to right,white,${P.glow},transparent)`,
            borderRadius:"9999px",transformOrigin:"left center",
            transform:`rotate(${i*22.5}deg)`,opacity:i%4===0?.9:.6,
            animation:`xi-ray ${T.IMPACT*1.3}ms ease-out ${i*3}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {/* Freeze rings */}
        {[{d:110,bw:"6px",del:0},{d:68,bw:"4px",del:14},{d:38,bw:"2px",del:26}].map((r,i)=>(
          <div key={i} style={{position:"absolute",left:-r.d/2,top:-r.d/2,width:r.d,height:r.d,
            borderRadius:"50%",border:`${r.bw} solid white`,
            boxShadow:`0 0 32px 14px ${P.glow},inset 0 0 24px 10px ${P.glow}`,
            animation:`xi-ring ${T.IMPACT}ms ease-out ${r.del}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {/* Ground waves ×3 */}
        {[{w:360,y:32,del:0,op:.9},{w:280,y:-36,del:18,op:.65},{w:200,y:56,del:35,op:.45}].map((g,i)=>(
          <div key={i} style={{position:"absolute",left:-g.w/2,top:g.y,width:g.w,height:"18px",
            background:`linear-gradient(to right,transparent,${P.glow},transparent)`,
            borderRadius:"9999px",filter:"blur(5px)",opacity:g.op,
            animation:`xi-ground ${T.IMPACT*1.4}ms ease-out ${g.del}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {/* Element burst shapes */}
        {iF && Array.from({length:8},(_,i)=>(
          <div key={i} style={{position:"absolute",left:"-4px",top:"-4px",width:"8px",height:"60px",
            background:"linear-gradient(to top,rgba(239,68,68,0.85),rgba(249,115,22,0.5),transparent)",
            borderRadius:"9999px",transformOrigin:"50% 100%",transform:`rotate(${i*45}deg)`,
            animation:`xi-flame-jet ${T.IMPACT*0.9}ms ease-out ${i*8}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {iA && [70,120,175,240].map((s,i)=>(
          <div key={i} style={{position:"absolute",left:-s/2,top:-s/2,width:s,height:s,
            borderRadius:"50%",border:`${3-i*.5}px solid rgba(56,189,248,${0.88-i*.16})`,
            boxShadow:i<2?`0 0 14px 6px rgba(56,189,248,0.55)`:undefined,
            animation:`xi-water-ring ${T.IMPACT*1.6}ms cubic-bezier(.04,.4,.18,1) ${i*35}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {iD && Array.from({length:12},(_,i)=>(
          <div key={i} style={{position:"absolute",width:"80px",height:"2px",
            background:"linear-gradient(to right,rgba(168,85,247,0.92),rgba(88,28,135,0.4),transparent)",
            borderRadius:"9999px",transformOrigin:"left center",transform:`rotate(${i*30}deg)`,
            animation:`xi-dark-ray ${T.IMPACT*0.9}ms ease-out ${i*8}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {iH && <>
          {[0,45,90,135].map((a,i)=>(
            <div key={i} style={{position:"absolute",width:i<2?"150px":"100px",height:i<2?"5px":"3px",
              background:"linear-gradient(to right,white,rgba(254,240,138,0.75),transparent)",
              borderRadius:"9999px",transformOrigin:"left center",transform:`rotate(${a}deg)`,
              animation:`xi-ray ${T.IMPACT*1.1}ms ease-out ${i*12}ms forwards`,opacity:.92,willChange:"transform,opacity"}}/>
          ))}
          {[60,110,165].map((s,i)=>(
            <div key={i} style={{position:"absolute",left:-s/2,top:-s/2,width:s,height:s,
              borderRadius:"50%",border:`${2-i*.5}px solid rgba(253,224,71,${0.82-i*.18})`,
              animation:`xi-shockwave ${T.IMPACT*1.5}ms cubic-bezier(.04,.4,.18,1) ${i*28}ms forwards`,willChange:"transform,opacity"}}/>
          ))}
        </>}
        {iV && [0,60,120,180,240,300].map((a,i)=>(
          <div key={i} style={{position:"absolute",width:"65px",height:"3px",
            background:`linear-gradient(to right,rgba(52,211,153,0.88),transparent)`,
            borderRadius:"9999px",transformOrigin:"left center",transform:`rotate(${a}deg)`,
            animation:`xi-vent-slash ${T.IMPACT*0.85}ms ease-out ${i*10}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {/* Smoke puffs */}
        {[{sx:-48,c:"rgba(210,210,210,0.55)"},{sx:0,c:"rgba(230,230,230,0.48)"},{sx:48,c:"rgba(195,195,195,0.52)"},{sx:-24,c:"rgba(220,220,220,0.44)"}].map((s,i)=>(
          <div key={i} style={({position:"absolute",left:"-32px",top:"-16px",
            width:"64px",height:"64px",borderRadius:"50%",
            background:`radial-gradient(circle,${s.c},transparent)`,filter:"blur(10px)",
            animation:`xi-smoke ${T.AFTERMATH*.68}ms ease-out ${i*24}ms forwards`,
            "--sx":`${s.sx}px`}) as React.CSSProperties}/>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// AFTERMATH
// ═══════════════════════════════════════════════════════════════════════════
function Aftermath({el,pts}:{el:string;pts:ReturnType<typeof mkPts>}){
  const P=pal(el)
  const iF=["pyrus","fire"].includes(el), iA=["aquos","aquo","water"].includes(el)
  const iD=["darkus","darkness","dark"].includes(el), iH=["haos","light","lightness"].includes(el)
  const iV=["ventus","wind"].includes(el), iVo=el==="void"

  const core={fire:{c:"white",t:"#fb923c",g:"rgba(251,146,60,1)"},
    pyrus:{c:"white",t:"#fb923c",g:"rgba(251,146,60,1)"},
    aquos:{c:"white",t:"#38bdf8",g:"rgba(56,189,248,1)"},aquo:{c:"white",t:"#38bdf8",g:"rgba(56,189,248,1)"},water:{c:"white",t:"#38bdf8",g:"rgba(56,189,248,1)"},
    haos:{c:"white",t:"#fde047",g:"rgba(253,224,71,1)"},light:{c:"white",t:"#fde047",g:"rgba(253,224,71,1)"},lightness:{c:"white",t:"#fde047",g:"rgba(253,224,71,1)"},
    darkus:{c:"#c084fc",t:"#581c87",g:"rgba(88,28,135,1)"},darkness:{c:"#c084fc",t:"#581c87",g:"rgba(88,28,135,1)"},dark:{c:"#c084fc",t:"#581c87",g:"rgba(88,28,135,1)"},
    ventus:{c:"white",t:"#34d399",g:"rgba(52,211,153,1)"},wind:{c:"white",t:"#34d399",g:"rgba(52,211,153,1)"},
    void:{c:"#94a3b8",t:"#334155",g:"rgba(100,116,139,1)"},
  } as Record<string,{c:string;t:string;g:string}>
  const ec=core[el]||{c:"white",t:P.b,g:P.glow}

  return(
    <div style={{position:"absolute",left:0,top:0,pointerEvents:"none"}}>
      {/* Residual core glow */}
      <div style={{position:"absolute",left:"-28px",top:"-28px",width:"56px",height:"56px",
        borderRadius:"50%",background:`radial-gradient(circle,${ec.g},transparent)`,filter:"blur(14px)",
        animation:`xa-core-linger ${T.AFTERMATH}ms ease-out forwards`,willChange:"transform,opacity"}}/>
      {/* ── PARTICLE FIELD ── */}
      {pts.map(pt=>(
        <div key={pt.id} style={({position:"absolute",left:"-4px",top:"-4px",
          width:`${pt.size}px`,height:`${pt.size}px`,borderRadius:"50%",
          background:`radial-gradient(circle,${ec.c},${ec.t})`,
          boxShadow:`0 0 ${pt.size*2.5}px ${pt.size}px ${ec.g}`,
          animation:`xa-particle ${T.AFTERMATH*pt.life}ms cubic-bezier(0.04,.38,.18,1) ${pt.delay}ms both`,
          willChange:"transform,opacity","--px":`${pt.px}px`,"--py":`${pt.py}px`}) as React.CSSProperties}/>
      ))}
      {/* ── FIRE: 4 ember columns + secondary ring */}
      {iF && <>
        {[-24,-8,8,24].map((ox,i)=>(
          <div key={i} style={{position:"absolute",width:"14px",height:"90px",
            background:"linear-gradient(to top,rgba(251,146,60,.9),rgba(249,115,22,.4),transparent)",
            borderRadius:"9999px",filter:"blur(5px)",left:ox-7,top:-15,
            animation:`xa-fire-col ${T.AFTERMATH*.72}ms ease-out ${i*36}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {[80,130,190,260].map((d,i)=>(
          <div key={i} style={{position:"absolute",left:-d/2,top:-d/2,width:d,height:d,
            borderRadius:"50%",border:`${2-i*.35}px solid rgba(249,115,22,${0.72-i*.14})`,
            animation:`xa-ring-out ${T.AFTERMATH*.65}ms ease-out ${i*38}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
      </>}
      {/* ── AQUOS: 5 expanding rings + 18 droplets */}
      {iA && <>
        {[65,110,160,215,275].map((d,i)=>(
          <div key={i} style={{position:"absolute",left:-d/2,top:-d/2,width:d,height:d,
            borderRadius:"50%",border:`${2.5-i*.3}px solid rgba(56,189,248,${0.85-i*.13})`,
            boxShadow:i<2?`0 0 12px 5px rgba(56,189,248,0.55)`:undefined,
            animation:`xa-ripple-out ${T.AFTERMATH*.7}ms cubic-bezier(.04,.4,.18,1) ${i*42}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {Array.from({length:18},(_,i)=>(
          <div key={i} style={({position:"absolute",width:"7px",height:"7px",borderRadius:"50%",
            background:"radial-gradient(circle,white,#7dd3fc)",boxShadow:"0 0 8px 4px rgba(56,189,248,0.92)",
            left:"-3px",top:"-3px",
            animation:`xa-drop ${T.AFTERMATH*.6}ms ease-out ${i*14}ms both`,
            "--da":`${i*20}deg`}) as React.CSSProperties}/>
        ))}
      </>}
      {/* ── DARKNESS: absorption vortex + 4 rift tears */}
      {iD && <>
        {Array.from({length:14},(_,i)=>(
          <div key={i} style={{position:"absolute",width:"90px",height:"2px",
            background:"linear-gradient(to left,rgba(168,85,247,0.92),rgba(88,28,135,0.4),transparent)",
            borderRadius:"9999px",transformOrigin:"left center",transform:`rotate(${i*25.7}deg)`,
            animation:`xa-dark-absorb ${T.AFTERMATH*.78}ms ease-in ${i*8}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {[-32,-12,12,32].map((x,i)=>(
          <div key={i} style={{position:"absolute",width:"2px",height:"75px",left:x,top:-38,
            background:`linear-gradient(to bottom,transparent,rgba(88,28,135,${0.92-i*.06}),transparent)`,
            borderRadius:"9999px",boxShadow:"0 0 8px 3px rgba(88,28,135,0.75)",
            animation:`xa-void-rift ${T.AFTERMATH*.62}ms ease-out ${i*35}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {[80,140,210].map((d,i)=>(
          <div key={i} style={{position:"absolute",left:-d/2,top:-d/2,width:d,height:d,
            borderRadius:"50%",border:`${2-i*.4}px solid rgba(168,85,247,${0.65-i*.15})`,
            animation:`xa-ring-in ${T.AFTERMATH*.72}ms ease-out ${i*40}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
      </>}
      {/* ── HAOS: starburst + 5 rings */}
      {iH && <>
        {Array.from({length:20},(_,i)=>(
          <div key={i} style={{position:"absolute",width:i%4===0?"140px":i%2===0?"90px":"58px",height:i%4===0?"5px":i%2===0?"3px":"2px",
            background:"linear-gradient(to right,white,rgba(254,240,138,0.8),transparent)",
            borderRadius:"9999px",transformOrigin:"left center",transform:`rotate(${i*18}deg)`,
            animation:`xa-divine-out ${T.AFTERMATH*.5}ms ease-out ${i*10}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {[65,110,162,218,280].map((d,i)=>(
          <div key={i} style={{position:"absolute",left:-d/2,top:-d/2,width:d,height:d,
            borderRadius:"50%",border:`${2-i*.3}px solid rgba(253,224,71,${0.82-i*.14})`,
            boxShadow:i<2?`0 0 12px 5px rgba(253,224,71,0.55)`:undefined,
            animation:`xa-ring-out ${T.AFTERMATH*.58}ms ease-out ${i*38}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
      </>}
      {/* ── VENTUS: 4 spinning dashed rings + 12 slashes */}
      {iV && <>
        {[70,120,175,235].map((d,i)=>(
          <div key={i} style={{position:"absolute",left:-d/2,top:-d/2,width:d,height:d,
            borderRadius:"50%",border:`${2-i*.3}px dashed rgba(52,211,153,${0.78-i*.14})`,
            animation:`xc-spin-${i%2===0?"f":"r"} ${.28+i*.08}s linear infinite, xa-ring-out ${T.AFTERMATH*.68}ms ease-out ${i*40}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
        {Array.from({length:12},(_,i)=>(
          <div key={i} style={{position:"absolute",width:"65px",height:"3px",
            background:`linear-gradient(to right,rgba(52,211,153,0.88),transparent)`,
            borderRadius:"9999px",transformOrigin:"left center",transform:`rotate(${i*30}deg)`,
            animation:`xa-vent-slash ${T.AFTERMATH*.56}ms ease-out ${i*16}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
      </>}
      {/* ── VOID: geometric fragments + static */}
      {iVo && <>
        {[[44,0,12,4],[62,45,9,4],[-44,0,10,4],[-56,30,8,4],[0,-42,11,4],[0,40,9,4],
          [50,-28,8,3],[-46,-30,9,4],[32,52,7,3],[-30,-54,10,4],[56,22,7,3],[-22,56,8,4]
        ].map(([x,y,w,h],i)=>(
          <div key={i} style={({position:"absolute",width:w,height:h,background:`rgba(148,163,184,${.84-i*.025})`,
            borderRadius:"2px",boxShadow:"0 0 7px 2px rgba(100,116,139,0.72)",
            animation:`xa-void-shard ${T.AFTERMATH*.72}ms cubic-bezier(.04,.38,.18,1) ${i*22}ms both`,
            willChange:"transform,opacity","--vx":`${x}px`,"--vy":`${y}px`}) as React.CSSProperties}/>
        ))}
        {Array.from({length:8},(_,i)=>(
          <div key={i} style={{position:"absolute",width:"62px",height:"1px",
            background:`linear-gradient(to right,rgba(148,163,184,0.75),transparent)`,
            borderRadius:"9999px",transformOrigin:"left center",transform:`rotate(${i*22.5+11}deg)`,
            animation:`xa-vent-slash ${T.AFTERMATH*.52}ms ease-out ${i*18}ms forwards`,willChange:"transform,opacity"}}/>
        ))}
      </>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
export function ElementalAttackAnimation({
  id,startX,startY,targetX,targetY,element,attackerImage,attackerName,
  portalTarget,onImpact,onComplete,
}:AttackAnimationProps){
  const [phase,setPhase]=useState<Phase>("charge")
  const [mounted,setMounted]=useState(false)
  const dist=Math.hypot(targetX-startX,targetY-startY)
  const aDeg=Math.atan2(targetY-startY,targetX-startX)*(180/Math.PI)
  const el=(element?.toLowerCase().trim()||"neutral")
  const doneRef=useRef(onComplete)
  useEffect(()=>{doneRef.current=onComplete},[onComplete])

  const ptCount:Record<string,number>={fire:48,pyrus:48,aquos:42,aquo:42,water:42,
    haos:50,light:50,lightness:50,darkus:44,darkness:44,dark:44,
    ventus:40,wind:40,void:36}
  const pts=useMemo(()=>mkPts(ptCount[el]??36,el,id),[el,id])

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

  const inFlight=phase==="charge"||phase==="release"||phase==="strike"
  const ctr:S=inFlight
    ?{position:"absolute",left:startX,top:startY,width:dist,height:60,marginTop:-30,
       pointerEvents:"none",zIndex:10000,transformOrigin:"0 50%",transform:`rotate(${aDeg}deg)`,
       willChange:"transform",contain:"layout style paint"}
    :{position:"absolute",left:targetX,top:targetY,width:0,height:60,marginTop:-30,
       pointerEvents:"none",zIndex:10000,transformOrigin:"0 50%",transform:`rotate(${aDeg}deg)`,
       willChange:"transform",contain:"layout style paint"}

  // All keyframes
  const ALL_RADII=[44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74]
  const orbitKFs=ALL_RADII.map(r=>`
    @keyframes xc-orbit-r${r}{
      from{transform:translate(${r}px,0)}
      25%{transform:translate(0,${r}px)}
      50%{transform:translate(-${r}px,0)}
      75%{transform:translate(0,-${r}px)}
      to{transform:translate(${r}px,0)}
    }`).join("")

  const kfs=`
    @keyframes xc-spin-f{to{transform:rotate(360deg)}}
    @keyframes xc-spin-r{to{transform:rotate(-360deg)}}
    @keyframes xc-core-pulse{0%,100%{transform:scale(1);opacity:.95}50%{transform:scale(1.2);opacity:1}}
    @keyframes xc-burst{0%{transform:scale(.8);opacity:.92}100%{transform:scale(1.35);opacity:0}}
    @keyframes xc-petal{0%,100%{transform:var(--base-t,none) scaleY(0);opacity:0}45%{transform:var(--base-t,none) scaleY(1);opacity:.9}}
    @keyframes xc-tendril{0%,100%{transform:rotate(var(--a,0deg)) scaleX(0);opacity:0}45%{transform:rotate(var(--a,0deg)) scaleX(1);opacity:.88}}
    @keyframes xc-dark-snap{0%,100%{transform:rotate(var(--a,0deg)) scaleX(0.2);opacity:.6}45%{transform:rotate(var(--a,0deg)) scaleX(1);opacity:.95}}
    @keyframes xc-void-converge{0%{opacity:.8}50%{opacity:.3;transform:rotate(var(--a,0deg)) translateX(0)}100%{opacity:0;transform:rotate(var(--a,0deg)) translateX(72px)}}
    @keyframes xc-divine-ray{0%,100%{opacity:var(--op,.72);transform:scaleY(1)}50%{opacity:1;transform:scaleY(1.45)}}
    @keyframes xc-halo{0%,100%{transform:scale(1);opacity:.62}50%{transform:scale(1.28);opacity:.98}}
    @keyframes xc-stream{0%,100%{transform:scaleY(0);opacity:0}45%{transform:scaleY(1);opacity:.9}}
    @keyframes xc-blade{0%,100%{transform:scaleX(.65) rotate(var(--a,0deg));opacity:.7}50%{transform:scaleX(1.35) rotate(var(--a,0deg));opacity:1}}
    @keyframes xc-consume{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(.85);opacity:1}}
    @keyframes xc-void-glitch{0%{opacity:.82}25%{opacity:.18}50%{opacity:.76}75%{opacity:.22}100%{opacity:.80}}
    @keyframes xs-fly{0%{transform:translateX(0)}100%{transform:translateX(${dist}px)}}
    @keyframes xs-trail-fade{0%{opacity:.88}100%{opacity:0}}
    @keyframes xs-speed-line{0%{transform:translateX(-100%);opacity:0}5%{opacity:.88}65%{opacity:.55}100%{transform:translateX(0);opacity:0}}
    @keyframes xi-tint{0%{opacity:.95}15%{opacity:1}100%{opacity:0}}
    @keyframes xi-vignette{0%{opacity:.9}100%{opacity:0}}
    @keyframes xi-flash{0%{opacity:.98}8%{opacity:1}100%{opacity:0}}
    @keyframes xi-chroma-r{0%{opacity:.88;transform:translate(-12px,0)}65%{opacity:.4}100%{opacity:0;transform:translate(-26px,0)}}
    @keyframes xi-chroma-b{0%{opacity:.88;transform:translate(12px,0)}65%{opacity:.4}100%{opacity:0;transform:translate(26px,0)}}
    @keyframes xi-compress{0%{transform:scale(0);opacity:1}55%{opacity:.85}100%{transform:scale(4);opacity:0}}
    @keyframes xi-shockwave{0%{transform:scale(0);opacity:1}72%{opacity:.45}100%{transform:scale(7.5);opacity:0}}
    @keyframes xi-ray{0%{transform:rotate(var(--ra,0deg)) scaleX(0);opacity:1}40%{transform:rotate(var(--ra,0deg)) scaleX(1.7);opacity:.88}100%{transform:rotate(var(--ra,0deg)) scaleX(3);opacity:0}}
    @keyframes xi-ring{0%{transform:scale(0);opacity:1}100%{transform:scale(2.2);opacity:0}}
    @keyframes xi-ground{0%{transform:scaleX(0);opacity:.9}100%{transform:scaleX(1) scaleY(.1);opacity:0}}
    @keyframes xi-smoke{0%{transform:translate(var(--sx,0),0) scale(.25);opacity:.76;filter:blur(5px)}100%{transform:translate(var(--sx,0),-72px) scale(2.8);opacity:0;filter:blur(18px)}}
    @keyframes xi-flame-jet{0%{transform:rotate(var(--a,0deg)) scaleY(0);opacity:1}45%{opacity:.82}100%{transform:rotate(var(--a,0deg)) scaleY(1);opacity:0}}
    @keyframes xi-water-ring{0%{transform:scale(.1);opacity:.9}100%{transform:scale(5.5);opacity:0}}
    @keyframes xi-dark-ray{0%{transform:rotate(var(--a,0deg)) scaleX(0);opacity:.9}100%{transform:rotate(var(--a,0deg)) scaleX(0);opacity:0}}
    @keyframes xi-vent-slash{0%{transform:rotate(var(--a,0deg)) scaleX(0);opacity:.9}50%{opacity:.72}100%{transform:rotate(var(--a,0deg)) scaleX(1.5);opacity:0}}
    @keyframes xa-particle{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--px,40px),var(--py,-40px)) scale(0);opacity:0}}
    @keyframes xa-core-linger{0%{transform:scale(1);opacity:.9}65%{opacity:.55}100%{transform:scale(3);opacity:0}}
    @keyframes xa-fire-col{0%{transform:scaleY(0);opacity:1}60%{opacity:.72}100%{transform:scaleY(1) scaleX(.35);opacity:0}}
    @keyframes xa-ring-out{0%{transform:scale(0);opacity:.92}100%{transform:scale(4.5);opacity:0}}
    @keyframes xa-ring-in{0%{transform:scale(3.5);opacity:.72}100%{transform:scale(0);opacity:0}}
    @keyframes xa-ripple-out{0%{transform:scale(.12);opacity:.92}100%{transform:scale(5.5);opacity:0}}
    @keyframes xa-drop{0%{transform:rotate(var(--da,0deg)) translateX(0) scale(1);opacity:1}100%{transform:rotate(var(--da,0deg)) translateX(105px) scale(0);opacity:0}}
    @keyframes xa-dark-absorb{0%{transform:rotate(var(--a,0deg)) scaleX(1);opacity:.9}100%{transform:rotate(var(--a,0deg)) scaleX(.05);opacity:0}}
    @keyframes xa-void-rift{0%{transform:scaleY(0);opacity:.92}42%{transform:scaleY(1.12);opacity:.88}100%{transform:scaleY(.9);opacity:0}}
    @keyframes xa-void-shard{0%{transform:translate(0,0) rotate(0deg) scale(1);opacity:1}100%{transform:translate(var(--vx,30px),var(--vy,-30px)) rotate(200deg) scale(0);opacity:0}}
    @keyframes xa-divine-out{0%{transform:rotate(var(--a,0deg)) scaleX(0);opacity:1}42%{opacity:.9}100%{transform:rotate(var(--a,0deg)) scaleX(1.2);opacity:0}}
    @keyframes xa-vent-slash{0%{transform:rotate(var(--a,0deg)) scaleX(0);opacity:.9}52%{opacity:.75}100%{transform:rotate(var(--a,0deg)) scaleX(1.6);opacity:0}}
    @keyframes afterimage-fade{0%{opacity:.42;filter:blur(3px) brightness(2)}100%{opacity:0;filter:blur(9px) brightness(2.5)}}
  `

  const output=(
    <>
      <style>{orbitKFs+kfs}</style>
      {attackerImage&&(phase==="charge"||phase==="release")&&(<>
        <div style={{position:"absolute",left:startX-40,top:startY-56,width:80,height:112,
          backgroundImage:`url(${attackerImage})`,backgroundSize:"cover",backgroundPosition:"center",
          borderRadius:"8px",opacity:.42,filter:"blur(3px) brightness(2)",
          animation:"afterimage-fade 250ms ease-out forwards",pointerEvents:"none",zIndex:5,willChange:"opacity"}}/>
        <div style={{position:"absolute",left:startX-40,top:startY-56,width:80,height:112,
          backgroundImage:`url(${attackerImage})`,backgroundSize:"cover",backgroundPosition:"center",
          borderRadius:"8px",opacity:.20,filter:"blur(7px) brightness(2.5)",
          animation:"afterimage-fade 390ms ease-out 55ms forwards",pointerEvents:"none",zIndex:4,willChange:"opacity"}}/>
      </>)}
      <div style={ctr} suppressHydrationWarning>
        {(phase==="charge"||phase==="release")&&<Charge el={el} id={id}/>}
        {phase==="strike"&&<Strike el={el} dist={dist}/>}
        {phase==="impact"&&<Impact el={el}/>}
        {phase==="aftermath"&&<Aftermath el={el} pts={pts}/>}
      </div>
    </>
  )
  if(portalTarget) return createPortal(output,portalTarget)
  if(typeof document!=="undefined") return createPortal(output,document.body)
  return null
}
