"use client"

import { useState } from "react"
import { GameProvider } from "@/contexts/game-context"
import { LanguageProvider } from "@/contexts/language-context"
import DuelIntroOverlay from "@/components/game/duel-intro-overlay"

export default function IntroTest() {
  const [key, setKey] = useState(0)
  const [show, setShow] = useState(true)
  return (
    <LanguageProvider>
      <GameProvider>
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
          <button className="text-white" onClick={() => { setShow(true); setKey(k => k + 1) }}>replay</button>
          {show && (
            <DuelIntroOverlay
              key={key}
              opponent={{ name: "Mefisto", subtitle: "Boss Battle", icon: "/images/arthur_rage_scene.png", isBoss: true }}
              onComplete={() => setShow(false)}
            />
          )}
        </div>
      </GameProvider>
    </LanguageProvider>
  )
}
