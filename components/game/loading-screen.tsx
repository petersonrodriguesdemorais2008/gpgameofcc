"use client"

import { useEffect, useState, useRef } from "react"
import Image from "next/image"

interface LoadingScreenProps {
  onComplete: () => void
}

// ─── All game assets to preload ───────────────────────────────────────────────
const CARD_IMAGES = [
  "/images/adaga-energizada.png",
  "/images/amplificador-de-poder.png",
  "/images/arena-escandinava.png",
  "/images/arthur-20lr.png",
  "/images/arthur-20sr.png",
  "/images/arthur-20ur.png",
  "/images/bandagem-restauradora.png",
  "/images/bandagens-duplas.png",
  "/images/cards/Balin_R.png",
  "/images/cards/Balin_SR.png",
  "/images/cards/Flecha_de_Balista.png",
  "/images/cards/Pedra_de_Afiar.png",
  "/images/cards/a-grande-ordem.jpg",
  "/images/cards/alvorada-de-albion.jpg",
  "/images/cards/brincadeira-de-mau-gosto.png",
  "/images/cards/calem-lr.png",
  "/images/cards/calem-sr.png",
  "/images/cards/calem-ur.png",
  "/images/cards/calice-de-vinho-sagrado.png",
  "/images/cards/contra-ataque-surpresa.png",
  "/images/cards/dados-do-destino-gentil.png",
  "/images/cards/devorar-o-mundo.png",
  "/images/cards/escudo-de-mana.png",
  "/images/cards/estrategia-real.png",
  "/images/cards/fafnisbani.png",
  "/images/cards/fehnon-lr.jpg",
  "/images/cards/investida-coordenada.png",
  "/images/cards/julgamento-do-vazio-eterno.png",
  "/images/cards/kit-medico-improvisado.png",
  "/images/cards/lacos-da-ordem.png",
  "/images/cards/mefisto-foles.png",
  "/images/cards/miguel-arcanjo.png",
  "/images/cards/morgana-lr.jpg",
  "/images/cards/nucleo-explosivo.png",
  "/images/cards/ordem-de-laceracao.png",
  "/images/cards/portao-da-fortaleza.png",
  "/images/cards/projetil-de-impacto.png",
  "/images/cards/sinfonia-relampago.png",
  "/images/cards/soro-recuperador.png",
  "/images/cards/troca-de-guarda.png",
  "/images/cards/ventos-de-camelot.png",
  "/images/cards/veredito-do-rei-tirano.png",
  "/images/cards/veu-dos-lacos-cruzados.png",
  "/images/cauda-de-dragao-assada.png",
  "/images/cristal-recuperador.png",
  "/images/dados-da-calamidade.png",
  "/images/dados-da-fortuna.png",
  "/images/dados-elementais-alpha.png",
  "/images/dados-elementais-omega.png",
  "/images/fehnon-20sr.png",
  "/images/fehnon-20ur.png",
  "/images/fornbrenna.png",
  "/images/galahad-20r.png",
  "/images/galahad-20sr.png",
  "/images/hrotti-20lr.png",
  "/images/hrotti-20sr.png",
  "/images/hrotti-20ur.png",
  "/images/jaden-20lr.png",
  "/images/jaden-20sr.png",
  "/images/jaden-20ur.png",
  "/images/logi-20sr.png",
  "/images/logi-20ur.png",
  "/images/merlin-20r.png",
  "/images/merlin-20sr.png",
  "/images/mordred-20r.png",
  "/images/mordred-20sr.png",
  "/images/morgana-20sr.png",
  "/images/morgana-20ur.png",
  "/images/mr.png",
  "/images/o-20cavaleiro-20afogado-20r.png",
  "/images/o-20cavaleiro-20afogado-20sr.png",
  "/images/o-20cavaleiro-20verde-20r.png",
  "/images/o-20cavaleiro-20verde-20sr.png",
  "/images/oden-20sword.png",
  "/images/oswin-20r.png",
  "/images/oswin-20sr.png",
  "/images/protonix-20sword.png",
  "/images/reino-de-camelot.png",
  "/images/ruinas-abandonadas.png",
  "/images/twiligh-20avalon.png",
  "/images/ullr-20sr.png",
  "/images/ullr-20ur.png",
  "/images/ullrbogi.png",
  "/images/vivian-20r.png",
  "/images/vivian-20sr.png",
  "/images/cards/Chamado_da_Távola.png",
  "/images/cards/dados-do-cataclismo.png",
  // UI / icons
  "/images/gp-cg-logo.png",
  "/images/icons/gacha-coin.png",
  "/images/cards/card-back.png",
  "/images/icons/fehnon-icon.png",
  "/images/icons/hrotti-icon.png",
  "/images/icons/jaden-icon.png",
  "/images/icons/morgana-icon.png",
  "/images/icons/tsubasa-icon.png",
  "/images/icons/uller-icon.png",
  // Gacha packs / banners
  "/images/gacha/pack-fsg.png",
  "/images/gacha/pack-anl.png",
  "/images/gacha/fsg-anuncio.png",
  "/images/gacha/anl-anuncio.png",
]

// Loading tips shown during preload
const TIPS = [
  "Dica: cartas LR têm as habilidades mais poderosas do jogo.",
  "Dica: use o TAP para guardar cartas especiais fora do deck.",
  "Dica: o Gacha Diário reseta toda meia-noite. Não perca!",
  "Dica: Ultimate Gears amplificam o poder das suas Unidades.",
  "Dica: combine Irmandade para ativar efeitos de Brotherhood.",
  "Dica: Magic Function Cards ignoram armadilhas do oponente.",
  "Dica: o elemento Void não tem fraquezas elementais.",
  "Dica: cartas SR e LR podem ser encontradas no Banner FSG.",
  "Dica: construa decks com sinergia entre Unidades e Functions.",
]

// ─── Preload a single image via browser Image API ─────────────────────────────
function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => resolve()
    img.onerror = () => resolve() // resolve even on error — don't block loading
    img.src = src
  })
}

// ─── Preload in concurrent batches ───────────────────────────────────────────
async function preloadBatch(urls: string[], batchSize = 8): Promise<void> {
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize)
    await Promise.all(batch.map(preloadImage))
  }
}

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0)
  const [tipIndex, setTipIndex] = useState(0)
  const [phase, setPhase] = useState<"loading" | "done" | "exiting">("loading")
  const loadedRef = useRef(0)
  const total = CARD_IMAGES.length

  // Cycle tips every 2.5s
  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex(i => (i + 1) % TIPS.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  // Preload all assets
  useEffect(() => {
    let cancelled = false

    const loadAll = async () => {
      const batchSize = 8
      for (let i = 0; i < CARD_IMAGES.length; i += batchSize) {
        if (cancelled) return
        const batch = CARD_IMAGES.slice(i, i + batchSize)
        await Promise.all(
          batch.map(src =>
            preloadImage(src).then(() => {
              if (!cancelled) {
                loadedRef.current += 1
                setProgress(Math.round((loadedRef.current / total) * 100))
              }
            })
          )
        )
      }

      if (!cancelled) {
        // Ensure we show 100% briefly before exiting
        setProgress(100)
        setPhase("done")
        await new Promise(r => setTimeout(r, 600))
        if (!cancelled) {
          setPhase("exiting")
          await new Promise(r => setTimeout(r, 500))
          if (!cancelled) onComplete()
        }
      }
    }

    loadAll()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #020610 0%, #050d1a 45%, #030a14 100%)",
        opacity: phase === "exiting" ? 0 : 1,
        transition: "opacity 0.5s ease-out",
      }}
    >
      {/* Background depth */}
      <div className="absolute inset-0 pointer-events-none">
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 80% 50% at 50% -10%, rgba(6,182,212,0.10) 0%,transparent 55%)"}} />
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 60% 40% at 20% 90%, rgba(139,92,246,0.07) 0%,transparent 50%)"}} />
        {/* Subtle grid */}
        <div style={{position:"absolute",inset:0,opacity:0.025,backgroundImage:"linear-gradient(rgba(56,189,248,0.3) 1px,transparent 1px),linear-gradient(90deg,rgba(56,189,248,0.3) 1px,transparent 1px)",backgroundSize:"64px 64px"}} />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="absolute rounded-full"
            style={{
              width: `${1 + i % 2}px`, height: `${1 + i % 2}px`,
              left: `${(i * 8.3) % 100}%`, top: `${(i * 11.7) % 100}%`,
              background: i % 3 === 0 ? "rgba(6,182,212,0.5)" : i % 3 === 1 ? "rgba(139,92,246,0.4)" : "rgba(251,191,36,0.3)",
              animation: `floatParticle ${6 + i % 4}s ease-in-out ${i * 0.5}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Logo */}
      <div className="relative mb-10 flex flex-col items-center">
        {/* Aura glow */}
        <div className="absolute inset-0 pointer-events-none rounded-full blur-3xl"
          style={{background:"radial-gradient(ellipse,rgba(6,182,212,0.15) 0%,transparent 70%)",transform:"scale(2)",animation:"pulse 3s ease-in-out infinite"}} />
        <Image
          src="/images/gp-cg-logo.png"
          alt="Gear Perks Card Game"
          width={320}
          height={180}
          className="relative w-56 sm:w-72 h-auto drop-shadow-2xl"
          priority
        />
      </div>

      {/* Progress section */}
      <div className="w-full max-w-xs px-6 flex flex-col items-center gap-4">
        {/* Progress bar */}
        <div className="w-full">
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.07)"}}>
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #06b6d4, #8b5cf6)",
                boxShadow: "0 0 10px rgba(6,182,212,0.6)",
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-slate-600 text-[10px] font-mono tracking-widest uppercase">
              {phase === "done" ? "Pronto!" : "Carregando"}
            </span>
            <span className="text-cyan-400/70 text-[10px] font-mono font-bold">
              {progress}%
            </span>
          </div>
        </div>

        {/* Animated dots indicator */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full"
              style={{
                background: phase === "done" ? "#06b6d4" : "rgba(6,182,212,0.5)",
                animation: phase !== "done" ? `loadingDot 1.2s ease-in-out ${i * 0.2}s infinite` : "none",
                opacity: phase === "done" ? 1 : undefined,
              }}
            />
          ))}
        </div>

        {/* Tip */}
        <div className="text-center px-2 h-8 flex items-center justify-center">
          <p
            className="text-slate-500 text-[11px] leading-relaxed text-center transition-opacity duration-500"
            key={tipIndex}
            style={{animation: "fadeInTip 0.4s ease-out forwards"}}
          >
            {TIPS[tipIndex]}
          </p>
        </div>
      </div>

      {/* CSS */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(2); }
          50% { opacity: 1; transform: scale(2.15); }
        }
        @keyframes floatParticle {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.2; }
          50% { transform: translateY(-20px) scale(1.2); opacity: 0.8; }
        }
        @keyframes loadingDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40% { transform: scale(1.4); opacity: 1; background: #06b6d4; }
        }
        @keyframes fadeInTip {
          0% { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
