"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { ArrowLeft, BookOpen, Swords, Star, Lock, ChevronRight, Play, SkipForward } from "lucide-react"
import { useGame } from "@/contexts/game-context"

// ─── Types ────────────────────────────────────────────────────────────────────

type Emotion = "normal" | "happy" | "rage"
type CharacterId = "fehnon" | "calem" | "arthur" | "guard1" | "guard2"
type PanelLayout = "full" | "left-big" | "right-big" | "split" | "top-wide" | "action"

interface Character {
  id: CharacterId
  name: string
  emotion: Emotion
  side: "left" | "right" | "center"
  flipped?: boolean
}

interface Bubble {
  text: string
  speaker: CharacterId | "narrator"
  type: "speech" | "thought" | "shout" | "narrator" | "action"
  position?: "top" | "bottom" | "left" | "right"
}

interface Panel {
  id: string
  layout: PanelLayout
  background?: string
  characters: Character[]
  bubble?: Bubble
  actionWord?: string
  actionColor?: string
  overlay?: string
}

interface Scene {
  id: string
  title: string
  panels: Panel[]
}

interface Stage {
  id: string
  number: number
  title: string
  subtitle: string
  type: "scene" | "battle" | "boss"
  sceneData?: Scene
  locked?: boolean
  completed?: boolean
}

interface StoryModeScreenProps {
  onBack: () => void
  onStartBattle: (mode: "story-normal" | "story-boss") => void
}

// ─── Character image helper ───────────────────────────────────────────────────

function charImg(id: CharacterId, emotion: Emotion): string {
  return `/images/${id}_${emotion}_scene.png`
}

// ─── Chapter 1 Scene Data ─────────────────────────────────────────────────────

const CHAPTER1_STAGES: Stage[] = [
  {
    id: "c1s1",
    number: 1,
    title: "O Encontro",
    subtitle: "Cena 1",
    type: "scene",
    sceneData: {
      id: "c1s1",
      title: "O Encontro",
      panels: [
        {
          id: "p1",
          layout: "full",
          background: "linear-gradient(180deg, #1a0a2e 0%, #2d1b4e 50%, #1a0a2e 100%)",
          characters: [{ id: "calem", name: "Calem", emotion: "normal", side: "center" }],
          bubble: {
            text: "Que dia monótono... como sempre.",
            speaker: "calem",
            type: "thought",
          },
          overlay: "Uma casa no topo de uma colina, longe de tudo...",
        },
        {
          id: "p2",
          layout: "split",
          background: "linear-gradient(135deg, #0a1628 0%, #1e3a5f 100%)",
          characters: [
            { id: "guard1", name: "Guarda 1", emotion: "normal", side: "right" },
            { id: "guard2", name: "Guarda 2", emotion: "normal", side: "left", flipped: true },
          ],
          bubble: {
            text: "Parem esse garoto! Ele é procurado pelo Reino de Camelot!",
            speaker: "guard1",
            type: "shout",
          },
        },
        {
          id: "p3",
          layout: "left-big",
          background: "linear-gradient(180deg, #0d1f3c 0%, #1a3a6b 100%)",
          characters: [{ id: "fehnon", name: "Fehnon", emotion: "rage", side: "left" }],
          bubble: {
            text: "Eu não fiz nada! Me soltem!",
            speaker: "fehnon",
            type: "shout",
          },
          actionWord: "DASH!",
          actionColor: "#3b82f6",
        },
        {
          id: "p4",
          layout: "right-big",
          background: "linear-gradient(180deg, #1a0a2e 0%, #2d1b4e 100%)",
          characters: [{ id: "calem", name: "Calem", emotion: "happy", side: "right" }],
          bubble: {
            text: "Hm? Que barulho é esse lá fora?",
            speaker: "calem",
            type: "speech",
          },
        },
        {
          id: "p5",
          layout: "full",
          background: "linear-gradient(180deg, #0a1628 0%, #1a2e4a 100%)",
          characters: [
            { id: "fehnon", name: "Fehnon", emotion: "normal", side: "left" },
            { id: "calem", name: "Calem", emotion: "rage", side: "right" },
          ],
          bubble: {
            text: "Desculpa invadir sua casa! Preciso me esconder!",
            speaker: "fehnon",
            type: "speech",
          },
        },
      ],
    },
  },
  {
    id: "c1s2",
    number: 2,
    title: "A Fuga",
    subtitle: "Cena 2",
    type: "scene",
    sceneData: {
      id: "c1s2",
      title: "A Fuga",
      panels: [
        {
          id: "p1",
          layout: "top-wide",
          background: "linear-gradient(180deg, #1a0a2e 0%, #0d1f3c 100%)",
          characters: [
            { id: "guard1", name: "Guarda 1", emotion: "normal", side: "left" },
            { id: "guard2", name: "Guarda 2", emotion: "normal", side: "right", flipped: true },
          ],
          bubble: {
            text: "Ele entrou nessa casa! Cerquem o local!",
            speaker: "guard1",
            type: "shout",
          },
        },
        {
          id: "p2",
          layout: "left-big",
          background: "linear-gradient(180deg, #0f2744 0%, #1e3a5f 100%)",
          characters: [{ id: "fehnon", name: "Fehnon", emotion: "normal", side: "left" }],
          bubble: {
            text: "Desculpa por isso. Preciso ir embora agora.",
            speaker: "fehnon",
            type: "speech",
          },
        },
        {
          id: "p3",
          layout: "right-big",
          background: "linear-gradient(180deg, #1a0a2e 0%, #2d1b4e 100%)",
          characters: [{ id: "calem", name: "Calem", emotion: "rage", side: "right" }],
          bubble: {
            text: "Espera! Eu vou com você!",
            speaker: "calem",
            type: "shout",
          },
        },
        {
          id: "p4",
          layout: "full",
          background: "linear-gradient(180deg, #0a1628 0%, #0d1f3c 100%)",
          characters: [
            { id: "fehnon", name: "Fehnon", emotion: "rage", side: "left" },
            { id: "calem", name: "Calem", emotion: "normal", side: "right" },
          ],
          bubble: {
            text: "Por que você foi atrás de mim?! Isso é problema meu!",
            speaker: "fehnon",
            type: "shout",
          },
        },
        {
          id: "p5",
          layout: "split",
          background: "linear-gradient(135deg, #0f2744 0%, #1a3a6b 100%)",
          characters: [{ id: "calem", name: "Calem", emotion: "happy", side: "left" }],
          bubble: {
            text: "Já estamos longe dos guardas. Você disse que tinha um plano, não disse?",
            speaker: "calem",
            type: "speech",
          },
        },
        {
          id: "p6",
          layout: "left-big",
          background: "linear-gradient(180deg, #1a0a2e 0%, #2d1b4e 100%)",
          characters: [{ id: "fehnon", name: "Fehnon", emotion: "happy", side: "left" }],
          bubble: {
            text: "...Certo. Conheço um lugar onde estaremos seguros. Me sigam.",
            speaker: "fehnon",
            type: "speech",
          },
        },
      ],
    },
  },
  {
    id: "c1s3",
    number: 3,
    title: "As Ruínas",
    subtitle: "Cena 3",
    type: "scene",
    sceneData: {
      id: "c1s3",
      title: "As Ruínas",
      panels: [
        {
          id: "p1",
          layout: "full",
          background: "linear-gradient(180deg, #1a2e1a 0%, #0d1f0d 100%)",
          characters: [
            { id: "fehnon", name: "Fehnon", emotion: "normal", side: "left" },
            { id: "calem", name: "Calem", emotion: "happy", side: "right" },
          ],
          overlay: "Ruínas Abandonadas — fora dos limites do Reino",
          bubble: {
            text: "Aqui. Ninguém vem até esse lugar.",
            speaker: "fehnon",
            type: "speech",
          },
        },
        {
          id: "p2",
          layout: "top-wide",
          background: "linear-gradient(180deg, #0f1f0f 0%, #1a2e1a 100%)",
          characters: [{ id: "calem", name: "Calem", emotion: "happy", side: "center" }],
          bubble: {
            text: "Incrível! Olha esses desenhos nas paredes... são antigos.",
            speaker: "calem",
            type: "speech",
          },
        },
        {
          id: "p3",
          layout: "split",
          background: "linear-gradient(135deg, #1a1a2e 0%, #2d1b4e 100%)",
          characters: [
            { id: "fehnon", name: "Fehnon", emotion: "normal", side: "left" },
            { id: "calem", name: "Calem", emotion: "normal", side: "right" },
          ],
          bubble: {
            text: "Essa estrela... você acha que existe mesmo? A lenda da estrela que realiza desejos?",
            speaker: "calem",
            type: "speech",
          },
        },
        {
          id: "p4",
          layout: "left-big",
          background: "linear-gradient(180deg, #1a0a2e 0%, #2d1b4e 100%)",
          characters: [{ id: "fehnon", name: "Fehnon", emotion: "happy", side: "left" }],
          bubble: {
            text: "Não sei. Mas ouvi sobre ela desde criança. Dizem que concede poderes inimagináveis.",
            speaker: "fehnon",
            type: "speech",
          },
        },
        {
          id: "p5",
          layout: "right-big",
          background: "linear-gradient(180deg, #0a0a1f 0%, #1a1a3e 100%)",
          characters: [{ id: "calem", name: "Calem", emotion: "normal", side: "right" }],
          bubble: {
            text: "Me sinto muito sozinho. Queria que minha vida mudasse... que fosse diferente.",
            speaker: "calem",
            type: "thought",
          },
        },
        {
          id: "p6",
          layout: "split",
          background: "linear-gradient(135deg, #1a0a2e 0%, #0f2744 100%)",
          characters: [
            { id: "fehnon", name: "Fehnon", emotion: "happy", side: "left" },
            { id: "calem", name: "Calem", emotion: "happy", side: "right" },
          ],
          bubble: {
            text: "Agora que somos amigos, você não precisa mais ter esse medo! Hahaha!",
            speaker: "fehnon",
            type: "speech",
          },
        },
      ],
    },
  },
  {
    id: "c1s4",
    number: 4,
    title: "A Rachadura",
    subtitle: "Cena 4",
    type: "scene",
    sceneData: {
      id: "c1s4",
      title: "A Rachadura Roxa",
      panels: [
        {
          id: "p1",
          layout: "full",
          background: "linear-gradient(180deg, #2d1b4e 0%, #1a0a2e 100%)",
          characters: [
            { id: "fehnon", name: "Fehnon", emotion: "normal", side: "left" },
            { id: "calem", name: "Calem", emotion: "happy", side: "right" },
          ],
          overlay: "No dia seguinte, eles partiram sem saber para onde ir...",
        },
        {
          id: "p2",
          layout: "top-wide",
          background: "linear-gradient(180deg, #1a0a2e 0%, #4a0a4a 100%)",
          characters: [{ id: "calem", name: "Calem", emotion: "rage", side: "center" }],
          bubble: {
            text: "O quê?! Isso é...",
            speaker: "calem",
            type: "shout",
          },
          actionWord: "CRASH!!",
          actionColor: "#8b5cf6",
        },
        {
          id: "p3",
          layout: "full",
          background: "linear-gradient(180deg, #4a0a4a 0%, #2d0a2d 100%)",
          characters: [{ id: "fehnon", name: "Fehnon", emotion: "rage", side: "left" }],
          bubble: {
            text: "CALEM!!",
            speaker: "fehnon",
            type: "shout",
          },
          actionWord: "BOOM!",
          actionColor: "#a855f7",
        },
        {
          id: "p4",
          layout: "left-big",
          background: "linear-gradient(180deg, #1a0a2e 0%, #2d0a2d 100%)",
          characters: [{ id: "fehnon", name: "Fehnon", emotion: "rage", side: "left" }],
          bubble: {
            text: "Uma voz... 'Venha ao Reino de Camelot até o meio-dia. Ou seu amigo morrerá.'",
            speaker: "narrator",
            type: "narrator",
          },
        },
        {
          id: "p5",
          layout: "full",
          background: "linear-gradient(180deg, #0a0a0a 0%, #1a0a1a 100%)",
          characters: [{ id: "fehnon", name: "Fehnon", emotion: "rage", side: "center" }],
          bubble: {
            text: "CAMELOT... Eu vou te salvar, Calem!",
            speaker: "fehnon",
            type: "shout",
          },
        },
      ],
    },
  },
  {
    id: "c1b1",
    number: 5,
    title: "Portões de Camelot",
    subtitle: "Batalha",
    type: "battle",
  },
  {
    id: "c1s5",
    number: 6,
    title: "O Refém",
    subtitle: "Cena 5",
    type: "scene",
    sceneData: {
      id: "c1s5",
      title: "O Refém",
      panels: [
        {
          id: "p1",
          layout: "full",
          background: "linear-gradient(180deg, #1a0a0a 0%, #2d0a0a 50%, #1a0a1a 100%)",
          characters: [{ id: "calem", name: "Calem", emotion: "rage", side: "center" }],
          overlay: "Salão do Trono — Reino de Camelot",
          bubble: {
            text: "Onde... onde estou?",
            speaker: "calem",
            type: "speech",
          },
        },
        {
          id: "p2",
          layout: "right-big",
          background: "linear-gradient(180deg, #2d0a0a 0%, #4a0a0a 100%)",
          characters: [{ id: "arthur", name: "Rei Arthur", emotion: "rage", side: "right" }],
          bubble: {
            text: "Bem-vindo ao meu reino, garoto. Você é apenas uma peça no meu jogo.",
            speaker: "arthur",
            type: "speech",
          },
        },
        {
          id: "p3",
          layout: "split",
          background: "linear-gradient(135deg, #1a0a1a 0%, #2d1b4e 100%)",
          characters: [
            { id: "fehnon", name: "Fehnon", emotion: "normal", side: "left" },
            { id: "arthur", name: "Rei Arthur", emotion: "normal", side: "right", flipped: true },
          ],
          bubble: {
            text: "Fehnon! Afinal, você chegou.",
            speaker: "arthur",
            type: "speech",
          },
        },
        {
          id: "p4",
          layout: "left-big",
          background: "linear-gradient(180deg, #1a0a2e 0%, #2d1b4e 100%)",
          characters: [{ id: "fehnon", name: "Fehnon", emotion: "rage", side: "left" }],
          bubble: {
            text: "Solte o Calem. O que você quer, Arthur?!",
            speaker: "fehnon",
            type: "shout",
          },
        },
        {
          id: "p5",
          layout: "right-big",
          background: "linear-gradient(180deg, #2d0a0a 0%, #4a0a0a 100%)",
          characters: [{ id: "arthur", name: "Rei Arthur", emotion: "rage", side: "right" }],
          bubble: {
            text: "Simples. Você conhece os Poderes Ultimates da estrela misteriosa. Me conte tudo.",
            speaker: "arthur",
            type: "speech",
          },
        },
      ],
    },
  },
  {
    id: "c1s6",
    number: 7,
    title: "Recusa e Confronto",
    subtitle: "Cena 6",
    type: "scene",
    sceneData: {
      id: "c1s6",
      title: "Recusa e Confronto",
      panels: [
        {
          id: "p1",
          layout: "left-big",
          background: "linear-gradient(180deg, #1a0a2e 0%, #2d1b4e 100%)",
          characters: [{ id: "fehnon", name: "Fehnon", emotion: "rage", side: "left" }],
          bubble: {
            text: "Não vou te contar nada!",
            speaker: "fehnon",
            type: "shout",
          },
        },
        {
          id: "p2",
          layout: "full",
          background: "linear-gradient(180deg, #1a0a2e 0%, #4a0a4a 100%)",
          characters: [
            { id: "fehnon", name: "Fehnon", emotion: "rage", side: "left" },
            { id: "arthur", name: "Rei Arthur", emotion: "rage", side: "right", flipped: true },
          ],
          bubble: {
            text: "ARTHUR!!!",
            speaker: "fehnon",
            type: "shout",
          },
          actionWord: "IMPACTO!",
          actionColor: "#7c3aed",
        },
        {
          id: "p3",
          layout: "right-big",
          background: "linear-gradient(180deg, #2d0a0a 0%, #4a1a0a 100%)",
          characters: [{ id: "arthur", name: "Rei Arthur", emotion: "rage", side: "right" }],
          bubble: {
            text: "Imprudente...!",
            speaker: "arthur",
            type: "shout",
          },
          actionWord: "EXPLOSÃO!!",
          actionColor: "#dc2626",
        },
        {
          id: "p4",
          layout: "full",
          background: "linear-gradient(180deg, #0a0a0a 0%, #1a0a1a 100%)",
          characters: [
            { id: "fehnon", name: "Fehnon", emotion: "rage", side: "left" },
            { id: "calem", name: "Calem", emotion: "rage", side: "right" },
          ],
          bubble: {
            text: "A sala... está desabando!",
            speaker: "calem",
            type: "shout",
          },
          actionWord: "CRASH!!",
          actionColor: "#f59e0b",
        },
        {
          id: "p5",
          layout: "split",
          background: "linear-gradient(135deg, #0f2744 0%, #1a3a6b 100%)",
          characters: [
            { id: "fehnon", name: "Fehnon", emotion: "normal", side: "left" },
            { id: "calem", name: "Calem", emotion: "rage", side: "right" },
          ],
          overlay: "Eles caem do alto do castelo...",
          bubble: {
            text: "Segura em mim, Calem!",
            speaker: "fehnon",
            type: "shout",
          },
        },
      ],
    },
  },
  {
    id: "c1s7",
    number: 8,
    title: "Nos Telhados",
    subtitle: "Cena 7",
    type: "scene",
    sceneData: {
      id: "c1s7",
      title: "Nos Telhados",
      panels: [
        {
          id: "p1",
          layout: "full",
          background: "linear-gradient(180deg, #1a0a2e 0%, #0f2744 100%)",
          characters: [
            { id: "fehnon", name: "Fehnon", emotion: "normal", side: "left" },
            { id: "calem", name: "Calem", emotion: "rage", side: "right" },
          ],
          overlay: "Telhados do Reino de Camelot",
          bubble: {
            text: "Você está bem, Calem?",
            speaker: "fehnon",
            type: "speech",
          },
        },
        {
          id: "p2",
          layout: "top-wide",
          background: "linear-gradient(180deg, #2d0a2d 0%, #4a0a4a 100%)",
          characters: [{ id: "calem", name: "Calem", emotion: "rage", side: "center" }],
          bubble: {
            text: "R-Raios roxos estão caindo do céu!",
            speaker: "calem",
            type: "shout",
          },
          actionWord: "KRA-KOW!!",
          actionColor: "#8b5cf6",
        },
        {
          id: "p3",
          layout: "right-big",
          background: "linear-gradient(180deg, #1a0a0a 0%, #2d0a0a 100%)",
          characters: [{ id: "arthur", name: "Rei Arthur", emotion: "rage", side: "right" }],
          bubble: {
            text: "Sua escolha foi péssima, Fehnon. Vocês dois serão executados.",
            speaker: "arthur",
            type: "speech",
          },
        },
        {
          id: "p4",
          layout: "full",
          background: "linear-gradient(180deg, #2d0a0a 0%, #4a0a2a 100%)",
          characters: [{ id: "arthur", name: "Rei Arthur", emotion: "rage", side: "center" }],
          bubble: {
            text: "Surja, Mefisto! MEU ULTIMATE GUARDIAN!!",
            speaker: "arthur",
            type: "shout",
          },
          actionWord: "INVOKE!!",
          actionColor: "#dc2626",
        },
        {
          id: "p5",
          layout: "split",
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a0a1a 100%)",
          characters: [
            { id: "calem", name: "Calem", emotion: "rage", side: "left" },
            { id: "fehnon", name: "Fehnon", emotion: "happy", side: "right" },
          ],
          bubble: {
            text: "Fe-Fehnon?! Como você pode estar sorrindo agora?!",
            speaker: "calem",
            type: "shout",
          },
        },
        {
          id: "p6",
          layout: "full",
          background: "linear-gradient(180deg, #0f2744 0%, #1a3a6b 100%)",
          characters: [{ id: "fehnon", name: "Fehnon", emotion: "happy", side: "center" }],
          bubble: {
            text: "Relaxa. Eu dou um jeito nesse cara. Porque eu também tenho minha Ultimate Gear...",
            speaker: "fehnon",
            type: "speech",
          },
          actionWord: "PROTONIX SWORD!!",
          actionColor: "#3b82f6",
        },
      ],
    },
  },
  {
    id: "c1boss",
    number: 9,
    title: "Mefisto — O Guardião",
    subtitle: "Boss Battle",
    type: "boss",
  },
  {
    id: "c1s8",
    number: 10,
    title: "A Revelação",
    subtitle: "Cena Final",
    type: "scene",
    sceneData: {
      id: "c1s8",
      title: "A Revelação",
      panels: [
        {
          id: "p1",
          layout: "left-big",
          background: "linear-gradient(180deg, #1a0a2e 0%, #0f2744 100%)",
          characters: [{ id: "fehnon", name: "Fehnon", emotion: "rage", side: "left" }],
          bubble: {
            text: "Desapareça, Mefisto!",
            speaker: "fehnon",
            type: "shout",
          },
          actionWord: "SLASH!!",
          actionColor: "#3b82f6",
        },
        {
          id: "p2",
          layout: "right-big",
          background: "linear-gradient(180deg, #2d0a0a 0%, #4a0a0a 100%)",
          characters: [{ id: "arthur", name: "Rei Arthur", emotion: "rage", side: "right" }],
          bubble: {
            text: "Como... meu Mefisto está sendo machucado?!",
            speaker: "arthur",
            type: "shout",
          },
        },
        {
          id: "p3",
          layout: "split",
          background: "linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 100%)",
          characters: [
            { id: "fehnon", name: "Fehnon", emotion: "normal", side: "left" },
            { id: "calem", name: "Calem", emotion: "happy", side: "right" },
          ],
          bubble: {
            text: "Conseguimos! Fehnon, você é incrível!",
            speaker: "calem",
            type: "speech",
          },
        },
        {
          id: "p4",
          layout: "full",
          background: "linear-gradient(180deg, #1a0a0a 0%, #2d0a0a 100%)",
          characters: [{ id: "arthur", name: "Rei Arthur", emotion: "rage", side: "center" }],
          bubble: {
            text: "Heh... heh... Vocês acham que ganharam? Eu ainda tenho... uma carta na manga.",
            speaker: "arthur",
            type: "speech",
          },
        },
        {
          id: "p5",
          layout: "split",
          background: "linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 100%)",
          characters: [
            { id: "fehnon", name: "Fehnon", emotion: "rage", side: "left" },
            { id: "calem", name: "Calem", emotion: "rage", side: "right" },
          ],
          bubble: {
            text: "Uma carta na manga...? O quê?!",
            speaker: "fehnon",
            type: "shout",
          },
        },
        {
          id: "p6",
          layout: "full",
          background: "linear-gradient(180deg, #000000 0%, #0a0a0a 100%)",
          characters: [],
          overlay: "— A ser continuado no Capítulo 2 —",
          bubble: {
            text: "Qual será o segredo final do Rei Arthur...?",
            speaker: "narrator",
            type: "narrator",
          },
        },
      ],
    },
  },
]

// ─── Manga Panel Renderer ──────────────────────────────────────────────────────

function BubbleComponent({ bubble, position = "top" }: { bubble: Bubble; position?: string }) {
  const isNarrator = bubble.type === "narrator"
  const isShout = bubble.type === "shout"
  const isThought = bubble.type === "thought"
  const isAction = bubble.type === "action"

  if (isNarrator) {
    return (
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "rgba(0,0,0,0.85)",
        border: "2px solid rgba(255,255,255,0.3)",
        borderRadius: 0,
        padding: "10px 20px",
        maxWidth: "80%",
        textAlign: "center",
        zIndex: 20,
      }}>
        <p style={{
          color: "#e2e8f0",
          fontSize: 12,
          fontStyle: "italic",
          lineHeight: 1.5,
          fontFamily: "serif",
        }}>{bubble.text}</p>
      </div>
    )
  }

  const bubbleStyle: React.CSSProperties = {
    position: "absolute",
    background: isThought ? "rgba(200,230,255,0.95)" : "#fff",
    color: "#111",
    padding: "8px 12px",
    maxWidth: "55%",
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1.4,
    zIndex: 20,
    fontFamily: "sans-serif",
  }

  if (isShout) {
    return (
      <div style={{
        ...bubbleStyle,
        background: "#fff",
        clipPath: "polygon(5% 0%, 95% 0%, 100% 5%, 100% 95%, 95% 100%, 5% 100%, 0% 95%, 0% 5%)",
        top: "8%",
        left: bubble.speaker === "fehnon" || bubble.speaker === "calem" ? "2%" : undefined,
        right: bubble.speaker === "arthur" ? "2%" : undefined,
        fontSize: 13,
        fontWeight: 900,
        border: "3px solid #111",
        color: "#000",
        padding: "10px 14px",
      }}>
        {bubble.text}
      </div>
    )
  }

  if (isThought) {
    return (
      <div style={{
        ...bubbleStyle,
        background: "rgba(220,240,255,0.95)",
        border: "2px dashed #6b7280",
        borderRadius: 999,
        padding: "10px 16px",
        top: "8%",
        left: "50%",
        transform: "translateX(-50%)",
        textAlign: "center",
        color: "#374151",
        fontStyle: "italic",
      }}>
        {bubble.text}
      </div>
    )
  }

  return (
    <div style={{
      ...bubbleStyle,
      border: "2.5px solid #111",
      borderRadius: 12,
      top: "8%",
      left: bubble.speaker === "arthur" ? undefined : "4%",
      right: bubble.speaker === "arthur" ? "4%" : undefined,
    }}>
      {bubble.text}
      {/* Tail */}
      <div style={{
        position: "absolute",
        bottom: -10,
        left: bubble.speaker === "arthur" ? undefined : "20%",
        right: bubble.speaker === "arthur" ? "20%" : undefined,
        width: 0,
        height: 0,
        borderLeft: "8px solid transparent",
        borderRight: "8px solid transparent",
        borderTop: "10px solid #111",
      }} />
      <div style={{
        position: "absolute",
        bottom: -7,
        left: bubble.speaker === "arthur" ? undefined : "calc(20% + 2px)",
        right: bubble.speaker === "arthur" ? "calc(20% + 2px)" : undefined,
        width: 0,
        height: 0,
        borderLeft: "6px solid transparent",
        borderRight: "6px solid transparent",
        borderTop: "8px solid #fff",
      }} />
    </div>
  )
}

function MangaPanel({ panel, isActive }: { panel: Panel; isActive: boolean }) {
  return (
    <div style={{
      position: "relative",
      width: "100%",
      height: 280,
      background: panel.background || "#0a0a1a",
      border: "3px solid #111",
      overflow: "hidden",
      flexShrink: 0,
    }}>
      {/* Background overlay for atmosphere */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)",
        zIndex: 1,
      }} />

      {/* Characters */}
      {panel.characters.map((char, i) => {
        const leftPos = char.side === "left" ? "0%" : char.side === "right" ? "auto" : "50%"
        const rightPos = char.side === "right" ? "0%" : undefined
        const transform = char.side === "center"
          ? "translateX(-50%)"
          : char.flipped
          ? "scaleX(-1)"
          : undefined

        return (
          <div key={i} style={{
            position: "absolute",
            bottom: 0,
            left: leftPos,
            right: rightPos,
            transform,
            height: "100%",
            width: panel.characters.length === 1 ? "70%" : "50%",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 5,
          }}>
            <img
              src={charImg(char.id, char.emotion)}
              alt={char.name}
              style={{
                height: "95%",
                width: "auto",
                objectFit: "contain",
                objectPosition: "bottom",
                filter: "drop-shadow(4px 0 8px rgba(0,0,0,0.8))",
              }}
              onError={(e) => {
                // Fallback if image not found
                const target = e.target as HTMLImageElement
                target.style.display = "none"
              }}
            />
          </div>
        )
      })}

      {/* Overlay text */}
      {panel.overlay && (
        <div style={{
          position: "absolute",
          top: 8,
          left: 8,
          right: 8,
          background: "rgba(0,0,0,0.75)",
          padding: "4px 10px",
          zIndex: 15,
          borderLeft: "3px solid #8b5cf6",
        }}>
          <p style={{
            color: "#e2e8f0",
            fontSize: 10,
            fontStyle: "italic",
            fontFamily: "serif",
          }}>{panel.overlay}</p>
        </div>
      )}

      {/* Action word */}
      {panel.actionWord && (
        <div style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          transform: "translate(-50%, -50%) rotate(-5deg)",
          zIndex: 18,
          textAlign: "center",
        }}>
          <span style={{
            fontSize: 36,
            fontWeight: 900,
            color: panel.actionColor || "#f59e0b",
            textShadow: `3px 3px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000`,
            fontFamily: "'Arial Black', sans-serif",
            letterSpacing: "0.05em",
            lineHeight: 1,
          }}>{panel.actionWord}</span>
        </div>
      )}

      {/* Speech bubble */}
      {panel.bubble && <BubbleComponent bubble={panel.bubble} />}

      {/* Panel border effect */}
      <div style={{
        position: "absolute", inset: 0,
        border: "1px solid rgba(255,255,255,0.05)",
        zIndex: 25,
        pointerEvents: "none",
      }} />
    </div>
  )
}

// ─── Scene Viewer ─────────────────────────────────────────────────────────────

function SceneViewer({
  scene,
  onComplete,
}: {
  scene: Scene
  onComplete: () => void
}) {
  const [panelIndex, setPanelIndex] = useState(0)
  const [animating, setAnimating] = useState(false)
  const total = scene.panels.length

  const next = useCallback(() => {
    if (animating) return
    if (panelIndex >= total - 1) {
      onComplete()
      return
    }
    setAnimating(true)
    setTimeout(() => {
      setPanelIndex(i => i + 1)
      setAnimating(false)
    }, 200)
  }, [panelIndex, total, animating, onComplete])

  const skip = () => onComplete()

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "#000",
        display: "flex", flexDirection: "column",
        userSelect: "none",
      }}
      onClick={next}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px",
        background: "rgba(0,0,0,0.9)",
        borderBottom: "2px solid #222",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BookOpen size={16} color="#8b5cf6" />
          <span style={{ color: "#e2e8f0", fontWeight: 900, fontSize: 14 }}>{scene.title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#475569", fontSize: 11 }}>{panelIndex + 1} / {total}</span>
          <button
            onClick={(e) => { e.stopPropagation(); skip() }}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8, padding: "4px 10px",
              color: "#94a3b8", fontSize: 11, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <SkipForward size={12} />
            Pular
          </button>
        </div>
      </div>

      {/* Panel area */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}>
        {/* Progress dots */}
        <div style={{
          display: "flex", gap: 4, justifyContent: "center",
          padding: "8px 0",
          background: "rgba(0,0,0,0.5)",
          flexShrink: 0,
        }}>
          {scene.panels.map((_, i) => (
            <div key={i} style={{
              width: i === panelIndex ? 20 : 6,
              height: 4,
              borderRadius: 99,
              background: i === panelIndex ? "#8b5cf6" : i < panelIndex ? "#4c1d95" : "#1e1e2e",
              transition: "all 0.3s ease",
            }} />
          ))}
        </div>

        {/* The panel */}
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 0 16px",
          opacity: animating ? 0 : 1,
          transition: "opacity 0.2s ease",
        }}>
          <div style={{ width: "100%", maxWidth: 500 }}>
            <MangaPanel panel={scene.panels[panelIndex]} isActive={true} />
          </div>
        </div>

        {/* Tap to continue hint */}
        <div style={{
          textAlign: "center",
          paddingBottom: 16,
          flexShrink: 0,
        }}>
          <span style={{
            color: "#334155",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.1em",
            animation: "pulse 2s ease-in-out infinite",
          }}>
            {panelIndex >= total - 1 ? "[ Toque para continuar ]" : "[ Toque para avançar ]"}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ─── Stage Card ───────────────────────────────────────────────────────────────

function StageCard({
  stage,
  onPress,
  completedIds,
}: {
  stage: Stage
  onPress: () => void
  completedIds: Set<string>
}) {
  const isCompleted = completedIds.has(stage.id)
  const prevIndex = CHAPTER1_STAGES.findIndex(s => s.id === stage.id) - 1
  const prevStage = prevIndex >= 0 ? CHAPTER1_STAGES[prevIndex] : null
  const isLocked = prevStage !== null && !completedIds.has(prevStage.id)

  const bgColor = stage.type === "boss"
    ? "linear-gradient(135deg, rgba(220,38,38,0.15), rgba(127,29,29,0.10))"
    : stage.type === "battle"
    ? "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(29,78,216,0.10))"
    : "linear-gradient(135deg, rgba(91,33,182,0.15), rgba(55,48,163,0.10))"

  const borderColor = stage.type === "boss"
    ? isCompleted ? "rgba(220,38,38,0.5)" : "rgba(220,38,38,0.25)"
    : stage.type === "battle"
    ? isCompleted ? "rgba(37,99,235,0.5)" : "rgba(37,99,235,0.25)"
    : isCompleted ? "rgba(91,33,182,0.5)" : "rgba(91,33,182,0.25)"

  const icon = stage.type === "boss"
    ? "💀"
    : stage.type === "battle"
    ? "⚔️"
    : "📖"

  return (
    <button
      onClick={isLocked ? undefined : onPress}
      disabled={isLocked}
      style={{
        width: "100%",
        background: isLocked ? "rgba(255,255,255,0.02)" : bgColor,
        border: `1px solid ${isLocked ? "rgba(255,255,255,0.05)" : borderColor}`,
        borderRadius: 16,
        padding: "14px 16px",
        display: "flex", alignItems: "center", gap: 14,
        cursor: isLocked ? "not-allowed" : "pointer",
        opacity: isLocked ? 0.45 : 1,
        transition: "all 0.2s",
        textAlign: "left",
      }}
    >
      {/* Number / status */}
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: isCompleted
          ? "rgba(34,197,94,0.2)"
          : isLocked
          ? "rgba(255,255,255,0.04)"
          : stage.type === "boss"
          ? "rgba(220,38,38,0.2)"
          : stage.type === "battle"
          ? "rgba(37,99,235,0.2)"
          : "rgba(91,33,182,0.2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        border: `1px solid ${isCompleted ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
        fontSize: isLocked ? 18 : 20,
      }}>
        {isLocked ? <Lock size={18} color="#334155" /> : isCompleted ? "✓" : icon}
      </div>

      {/* Info */}
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{
            fontSize: 9, fontWeight: 800,
            color: stage.type === "boss" ? "#f87171" : stage.type === "battle" ? "#60a5fa" : "#a78bfa",
            textTransform: "uppercase", letterSpacing: "0.08em",
            background: stage.type === "boss" ? "rgba(220,38,38,0.15)" : stage.type === "battle" ? "rgba(37,99,235,0.15)" : "rgba(91,33,182,0.15)",
            padding: "2px 6px", borderRadius: 6,
          }}>
            {stage.subtitle}
          </span>
          {isCompleted && (
            <span style={{
              fontSize: 9, color: "#22c55e", fontWeight: 700,
              background: "rgba(34,197,94,0.1)", padding: "2px 6px", borderRadius: 6,
            }}>✓ Concluído</span>
          )}
        </div>
        <p style={{
          color: isLocked ? "#334155" : "#e2e8f0",
          fontWeight: 900, fontSize: 14, margin: 0,
        }}>{stage.title}</p>
      </div>

      {!isLocked && (
        <ChevronRight size={16} color="#475569" />
      )}
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const LS_STORY_KEY = "gpgame_story_progress"

export default function StoryModeScreen({ onBack, onStartBattle }: StoryModeScreenProps) {
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set()
    try {
      const saved = localStorage.getItem(LS_STORY_KEY)
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch { return new Set() }
  })

  const [activeScene, setActiveScene] = useState<Scene | null>(null)
  const [pendingCompleteId, setPendingCompleteId] = useState<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(LS_STORY_KEY, JSON.stringify([...completedIds]))
    } catch {}
  }, [completedIds])

  const handleStagePress = (stage: Stage) => {
    if (stage.type === "scene" && stage.sceneData) {
      setPendingCompleteId(stage.id)
      setActiveScene(stage.sceneData)
    } else if (stage.type === "battle") {
      setPendingCompleteId(stage.id)
      onStartBattle("story-normal")
    } else if (stage.type === "boss") {
      setPendingCompleteId(stage.id)
      onStartBattle("story-boss")
    }
  }

  const handleSceneComplete = () => {
    if (pendingCompleteId) {
      setCompletedIds(prev => new Set([...prev, pendingCompleteId]))
      setPendingCompleteId(null)
    }
    setActiveScene(null)
  }

  const totalStages = CHAPTER1_STAGES.length
  const completedCount = CHAPTER1_STAGES.filter(s => completedIds.has(s.id)).length
  const progressPct = Math.round((completedCount / totalStages) * 100)

  return (
    <>
      {/* ── Active scene viewer ── */}
      {activeScene && (
        <SceneViewer scene={activeScene} onComplete={handleSceneComplete} />
      )}

      {/* ── Main screen ── */}
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg,#020610 0%,#050d1a 50%,#030a14 100%)",
        color: "#f1f5f9",
        fontFamily: "'Segoe UI',system-ui,sans-serif",
        display: "flex", flexDirection: "column",
        position: "relative", overflow: "hidden",
      }}>
        {/* Background glows */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(91,33,182,0.12) 0%, transparent 60%)" }} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 30% at 80% 80%, rgba(220,38,38,0.07) 0%, transparent 55%)" }} />
        </div>

        {/* ── HEADER ── */}
        <div style={{
          position: "sticky", top: 0, zIndex: 50,
          background: "rgba(2,6,16,0.92)", backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          padding: "14px 16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 600, margin: "0 auto" }}>
            <button onClick={onBack} style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 12, padding: "8px 10px", cursor: "pointer",
              color: "#94a3b8", display: "flex", alignItems: "center",
            }}>
              <ArrowLeft size={18} />
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <BookOpen size={18} color="#8b5cf6" />
                <h1 style={{ fontWeight: 900, fontSize: 18, margin: 0 }}>Campanha</h1>
              </div>
              <p style={{ color: "#475569", fontSize: 11, margin: 0 }}>Gear Perks — A Lenda da Estrela</p>
            </div>
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div style={{ flex: 1, overflowY: "auto", position: "relative", zIndex: 1 }}>
          <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 16px 100px" }}>

            {/* Chapter 1 header */}
            <div style={{
              background: "linear-gradient(135deg, rgba(91,33,182,0.20), rgba(55,48,163,0.12))",
              border: "1px solid rgba(91,33,182,0.30)",
              borderRadius: 20, padding: "20px",
              marginBottom: 20, position: "relative", overflow: "hidden",
            }}>
              {/* Decorative lines */}
              <div style={{
                position: "absolute", top: 0, right: 0, width: 120, height: 120,
                background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)",
              }} />

              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, position: "relative" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14, flexShrink: 0,
                  background: "linear-gradient(145deg,#4c1d95,#7c3aed)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 8px 24px rgba(124,58,237,0.35)",
                  fontSize: 24,
                }}>⭐</div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 800, color: "#a78bfa",
                      background: "rgba(91,33,182,0.2)", padding: "2px 8px",
                      borderRadius: 6, letterSpacing: "0.08em", textTransform: "uppercase",
                    }}>Capítulo 1</span>
                  </div>
                  <h2 style={{ fontWeight: 900, fontSize: 18, margin: "0 0 4px", color: "#e2e8f0" }}>
                    A Lenda da Estrela
                  </h2>
                  <p style={{ color: "#64748b", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                    Um encontro inesperado, um reino em alerta e uma lenda que mudará o destino de dois garotos.
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "#64748b" }}>Progresso</span>
                  <span style={{ fontSize: 11, color: "#a78bfa", fontWeight: 800 }}>
                    {completedCount}/{totalStages} · {progressPct}%
                  </span>
                </div>
                <div style={{
                  height: 6, borderRadius: 99,
                  background: "rgba(255,255,255,0.07)", overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%", borderRadius: 99, width: `${progressPct}%`,
                    background: "linear-gradient(90deg, #7c3aed, #a855f7)",
                    boxShadow: "0 0 12px rgba(168,85,247,0.5)",
                    transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
                  }} />
                </div>
              </div>
            </div>

            {/* Stages list */}
            <h3 style={{
              fontWeight: 900, fontSize: 12, color: "#475569",
              letterSpacing: "0.08em", textTransform: "uppercase",
              marginBottom: 12,
            }}>Fases</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {CHAPTER1_STAGES.map(stage => (
                <StageCard
                  key={stage.id}
                  stage={stage}
                  onPress={() => handleStagePress(stage)}
                  completedIds={completedIds}
                />
              ))}
            </div>

            {/* Completion badge */}
            {progressPct === 100 && (
              <div style={{
                marginTop: 24,
                background: "linear-gradient(135deg, rgba(234,179,8,0.15), rgba(161,98,7,0.10))",
                border: "1px solid rgba(234,179,8,0.30)",
                borderRadius: 16, padding: "16px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
                <p style={{ fontWeight: 900, fontSize: 14, color: "#fbbf24", margin: "0 0 4px" }}>
                  Capítulo 1 Concluído!
                </p>
                <p style={{ color: "#78716c", fontSize: 12, margin: 0 }}>
                  Capítulo 2 em breve...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
