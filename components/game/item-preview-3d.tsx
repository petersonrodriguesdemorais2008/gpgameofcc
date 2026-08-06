"use client"

import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import {
  ContactShadows,
  Environment,
  Float,
  Html,
  Lightformer,
  PresentationControls,
  useTexture,
} from "@react-three/drei"
import { DoubleSide, SRGBColorSpace, type Group } from "three"
import { X } from "lucide-react"

export interface Preview3DItem {
  image: string
  name: string
  kind: "playmat" | "pack"
}

interface ItemPreview3DProps {
  item: Preview3DItem
  onClose: () => void
}

/* Evita que uma falha de textura derrube a tela inteira */
class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.log("[v0] Falha ao carregar previa 3D:", error)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function CenterMessage({ text }: { text: string }) {
  return (
    <Html center>
      <p className="text-slate-300 text-sm whitespace-nowrap select-none">{text}</p>
    </Html>
  )
}

/* Zoom suave com a roda do mouse / pinca */
function ZoomGroup({ children }: { children: ReactNode }) {
  const group = useRef<Group>(null)
  const target = useRef(1)
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    const el = gl.domElement
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      target.current = Math.min(2.2, Math.max(0.6, target.current - e.deltaY * 0.0012))
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [gl])

  useFrame((_, delta) => {
    if (!group.current) return
    const k = 1 - Math.pow(0.0015, delta) // interpolacao estavel por frame
    const s = group.current.scale.x
    const next = s + (target.current - s) * k
    group.current.scale.setScalar(next)
  })

  return <group ref={group}>{children}</group>
}

function ItemModel({ item, onHit }: { item: Preview3DItem; onHit: () => void }) {
  const texture = useTexture(item.image)
  const gl = useThree((s) => s.gl)
  const viewport = useThree((s) => s.viewport)

  useMemo(() => {
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = gl.capabilities.getMaxAnisotropy()
    texture.generateMipmaps = true
    texture.needsUpdate = true
  }, [texture, gl])

  // Dimensoes seguindo a proporcao real da imagem
  const { width, height } = useMemo(() => {
    const img = texture.image as { width?: number; height?: number } | undefined
    const ratio =
      img?.width && img?.height ? img.width / img.height : item.kind === "playmat" ? 1.5 : 0.71
    const maxDim = item.kind === "playmat" ? 4.3 : 3.4
    if (ratio >= 1) return { width: maxDim, height: maxDim / ratio }
    return { width: maxDim * ratio, height: maxDim }
  }, [texture, item.kind])

  // Garante que o modelo caiba na tela em qualquer resolucao
  const fit = Math.min(1, (viewport.width * 0.88) / width, (viewport.height * 0.78) / height)
  const depth = item.kind === "playmat" ? 0.05 : 0.11

  return (
    <group scale={fit}>
      {item.kind === "playmat" ? (
        // Playmat: arte opaca, ganha espessura de tapete
        <mesh castShadow onPointerDown={onHit}>
          <boxGeometry args={[width, height, depth]} />
          {/* Laterais e verso em tom escuro */}
          <meshStandardMaterial attach="material-0" color="#14161f" roughness={0.75} />
          <meshStandardMaterial attach="material-1" color="#14161f" roughness={0.75} />
          <meshStandardMaterial attach="material-2" color="#14161f" roughness={0.75} />
          <meshStandardMaterial attach="material-3" color="#14161f" roughness={0.75} />
          {/* Frente com a arte em alta qualidade */}
          <meshStandardMaterial
            attach="material-4"
            map={texture}
            roughness={0.38}
            metalness={0.08}
          />
          <meshStandardMaterial attach="material-5" color="#0d0e15" roughness={0.9} />
        </mesh>
      ) : (
        // Pack: PNG com fundo transparente, recortado para nao criar moldura preta
        <mesh castShadow onPointerDown={onHit}>
          <planeGeometry args={[width, height]} />
          <meshStandardMaterial
            map={texture}
            transparent
            alphaTest={0.35}
            side={DoubleSide}
            roughness={0.42}
            metalness={0.06}
          />
        </mesh>
      )}
      <ContactShadows
        position={[0, -height / 2 - 0.35, 0]}
        opacity={0.45}
        scale={width * 2.2}
        blur={2.6}
        far={2}
        resolution={512}
        color="#000000"
      />
    </group>
  )
}

export default function ItemPreview3D({ item, onClose }: ItemPreview3DProps) {
  // Portal so depois da montagem no cliente
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Fecha com Escape e trava o scroll da pagina
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  /* Só fecha em clique limpo no fundo: nao fecha ao arrastar nem ao clicar no modelo */
  const gesture = useRef({ x: 0, y: 0, moved: false, onModel: false, active: false })

  /* Fade-in apenas por opacidade: qualquer transform aqui criaria um backdrop root
     e o backdrop-blur deixaria de desfocar a tela atras do overlay. */
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (!mounted) return null

  return createPortal(
    <div
      className={`fixed inset-0 z-[70] transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={`Visualizacao 3D de ${item.name}`}
      onPointerDownCapture={(e) => {
        gesture.current = { x: e.clientX, y: e.clientY, moved: false, onModel: false, active: true }
      }}
      onPointerMove={(e) => {
        const g = gesture.current
        if (!g.active) return
        if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 8) g.moved = true
      }}
      onPointerUp={() => {
        const g = gesture.current
        g.active = false
        if (!g.moved && !g.onModel) onClose()
      }}
      onPointerCancel={() => {
        gesture.current.active = false
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Fundo borrado */}
      <div className="absolute inset-0 bg-[#0a0b12]/75 backdrop-blur-2xl" aria-hidden="true" />

      {/* Cena 3D */}
      <div
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        style={{ touchAction: "none" }}
      >
        <Canvas
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          camera={{ position: [0, 0, 5.4], fov: 42 }}
          style={{ touchAction: "none" }}
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[4, 5, 6]} intensity={1.15} />
          <directionalLight position={[-4, -2, 4]} intensity={0.35} />
          <Suspense fallback={<CenterMessage text="Carregando previa..." />}>
            <SceneBoundary fallback={<CenterMessage text="Nao foi possivel carregar a previa." />}>
              <PresentationControls
                global
                cursor={false}
                speed={1.3}
                rotation={[0.07, 0, 0]}
                polar={[-Math.PI / 3, Math.PI / 3]}
                azimuth={[-Math.PI, Math.PI]}
                config={{ mass: 1, tension: 170, friction: 26 }}
              >
                <ZoomGroup>
                  <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.3}>
                    <ItemModel
                      item={item}
                      onHit={() => {
                        gesture.current.onModel = true
                      }}
                    />
                  </Float>
                </ZoomGroup>
              </PresentationControls>
              {/* Iluminacao de estudio gerada localmente (sem download de HDR) */}
              <Environment resolution={256}>
                <Lightformer
                  intensity={2.2}
                  position={[0, 3, 3]}
                  scale={[8, 3, 1]}
                  color="#ffffff"
                />
                <Lightformer
                  intensity={1.1}
                  position={[-4, 1, 2]}
                  scale={[4, 4, 1]}
                  color="#8ab4ff"
                />
                <Lightformer
                  intensity={1.2}
                  position={[4, -1, 2]}
                  scale={[4, 4, 1]}
                  color="#ffd68a"
                />
              </Environment>
            </SceneBoundary>
          </Suspense>
        </Canvas>
      </div>

      {/* Fechar */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar visualizacao 3D"
        className="absolute top-5 right-5 z-10 w-10 h-10 rounded-full bg-[#0a0b12]/80 border border-white/10 text-slate-200 hover:text-white hover:border-amber-400/40 flex items-center justify-center transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Legenda */}
      <div className="absolute bottom-8 inset-x-0 flex flex-col items-center gap-1.5 pointer-events-none px-4">
        <h3 className="font-serif text-white font-bold text-xl text-balance text-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
          {item.name}
        </h3>
        <p className="text-slate-300/80 text-[13px] text-center">
          Arraste para girar &middot; Role para aproximar &middot; Clique no fundo para sair
        </p>
      </div>
    </div>,
    document.body,
  )
}
