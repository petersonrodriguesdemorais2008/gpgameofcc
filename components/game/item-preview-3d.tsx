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
  AdaptiveDpr,
  ContactShadows,
  Environment,
  Float,
  Html,
  Lightformer,
  useTexture,
} from "@react-three/drei"
import { DoubleSide, SRGBColorSpace, type Group } from "three"
import { X } from "lucide-react"

export interface Preview3DItem {
  image: string
  name: string
  kind: "playmat" | "pack"
}

/* Pre-carrega a textura no cache do loader ANTES do overlay abrir.
   Chamado no inicio do long-press: quando a previa monta, a imagem ja esta pronta. */
export function preloadPreviewTexture(image: string) {
  try {
    useTexture.preload(image)
  } catch {
    // se falhar aqui, o Suspense da cena cuida do carregamento normal
  }
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

const MAX_POLAR = Math.PI / 3
const ZOOM_MIN = 0.6
const ZOOM_MAX = 2.4

/* Controlador de gestos unificado: rotacao 1:1 suavizada, inercia de "flick"
   medida por tempo real, pinca para zoom no toque, roda do mouse no desktop
   e duplo clique/toque para resetar a vista. */
function GestureControls({ children }: { children: ReactNode }) {
  const rotGroup = useRef<Group>(null)
  const zoomGroup = useRef<Group>(null)
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)

  const st = useRef({
    pointers: new Map<number, { x: number; y: number }>(),
    rotX: 0.07,
    rotY: 0,
    targetX: 0.07,
    targetY: 0,
    velX: 0,
    velY: 0,
    zoom: 1,
    targetZoom: 1,
    pinchDist: 0,
    lastTapAt: 0,
    // Amostras recentes do arraste para calcular a velocidade real do flick
    samples: [] as { x: number; y: number; t: number }[],
  })

  useEffect(() => {
    const el = gl.domElement
    const s = st.current
    // Sensibilidade proporcional a tela: mesmo "peso" no celular e no desktop
    const SPEED = 2.6 / Math.max(320, size.width)

    const resetView = () => {
      s.targetX = 0.07
      s.targetY = 0
      s.targetZoom = 1
      s.velX = 0
      s.velY = 0
    }

    const onDown = (e: PointerEvent) => {
      s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      s.velX = 0
      s.velY = 0
      s.samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }]
      if (s.pointers.size === 2) {
        const [a, b] = [...s.pointers.values()]
        s.pinchDist = Math.hypot(a.x - b.x, a.y - b.y)
      }
      // Duplo toque/clique: reseta rotacao e zoom
      const now = performance.now()
      if (s.pointers.size === 1) {
        if (now - s.lastTapAt < 300) resetView()
        s.lastTapAt = now
      }
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        // ignora
      }
    }

    const onMove = (e: PointerEvent) => {
      const prev = s.pointers.get(e.pointerId)
      if (!prev) return
      s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (s.pointers.size === 2) {
        // Pinca: ajusta o zoom pela variacao da distancia entre os dedos
        const [a, b] = [...s.pointers.values()]
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        if (s.pinchDist > 0) {
          s.targetZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s.targetZoom * (dist / s.pinchDist)))
        }
        s.pinchDist = dist
        return
      }

      const dx = e.clientX - prev.x
      const dy = e.clientY - prev.y
      s.targetY += dx * SPEED
      s.targetX = Math.min(MAX_POLAR, Math.max(-MAX_POLAR, s.targetX + dy * SPEED))

      // Guarda amostras dos ultimos ~90ms para medir a velocidade do flick
      const now = performance.now()
      s.samples.push({ x: e.clientX, y: e.clientY, t: now })
      while (s.samples.length > 2 && now - s.samples[0].t > 90) s.samples.shift()
    }

    const onUp = (e: PointerEvent) => {
      s.pointers.delete(e.pointerId)
      s.pinchDist = 0
      if (s.pointers.size > 0) return

      // Velocidade real do gesto: deslocamento / tempo das amostras recentes
      const first = s.samples[0]
      const last = s.samples[s.samples.length - 1]
      if (first && last && last.t - first.t > 15) {
        const dt = (last.t - first.t) / 1000
        const MAX_VEL = 2.4 // rad/s
        s.velY = Math.min(MAX_VEL, Math.max(-MAX_VEL, ((last.x - first.x) * SPEED) / dt))
        s.velX = Math.min(MAX_VEL, Math.max(-MAX_VEL, ((last.y - first.y) * SPEED) / dt))
      }
      s.samples = []
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      s.targetZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s.targetZoom - e.deltaY * 0.0014))
    }

    el.addEventListener("pointerdown", onDown)
    el.addEventListener("pointermove", onMove)
    el.addEventListener("pointerup", onUp)
    el.addEventListener("pointercancel", onUp)
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      el.removeEventListener("pointerdown", onDown)
      el.removeEventListener("pointermove", onMove)
      el.removeEventListener("pointerup", onUp)
      el.removeEventListener("pointercancel", onUp)
      el.removeEventListener("wheel", onWheel)
    }
  }, [gl, size.width])

  useFrame((_, delta) => {
    const s = st.current
    const dragging = s.pointers.size > 0

    if (!dragging && (Math.abs(s.velX) > 0.001 || Math.abs(s.velY) > 0.001)) {
      // Inercia do flick com atrito exponencial
      s.targetY += s.velY * delta
      s.targetX = Math.min(MAX_POLAR, Math.max(-MAX_POLAR, s.targetX + s.velX * delta))
      const friction = Math.pow(0.06, delta)
      s.velX *= friction
      s.velY *= friction
      // Se bateu no limite vertical, mata a velocidade vertical
      if (Math.abs(s.targetX) >= MAX_POLAR) s.velX = 0
    }

    // Suavizacao critica: firme durante o arraste, macia na inercia
    const k = 1 - Math.pow(dragging ? 0.00000001 : 0.0002, delta)
    s.rotX += (s.targetX - s.rotX) * k
    s.rotY += (s.targetY - s.rotY) * k
    if (rotGroup.current) rotGroup.current.rotation.set(s.rotX, s.rotY, 0)

    const kz = 1 - Math.pow(0.001, delta)
    s.zoom += (s.targetZoom - s.zoom) * kz
    if (zoomGroup.current) zoomGroup.current.scale.setScalar(s.zoom)
  })

  return (
    <group ref={rotGroup}>
      <group ref={zoomGroup}>{children}</group>
    </group>
  )
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
          {/* Rugosidade alta e sem metalness: evita reflexos estourados na arte */}
          <meshStandardMaterial
            attach="material-4"
            map={texture}
            roughness={0.62}
            metalness={0}
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
            roughness={0.65}
            metalness={0}
          />
        </mesh>
      )}
      {/* frames={1}: a sombra e "assada" uma unica vez em vez de re-renderizar todo frame */}
      <ContactShadows
        frames={1}
        position={[0, -height / 2 - 0.35, 0]}
        opacity={0.45}
        scale={width * 2.2}
        blur={2.6}
        far={2}
        resolution={256}
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

  /* Só fecha em clique limpo e rapido no fundo:
     - ignora o "pointerup" do long-press que abriu a previa (periodo de carencia)
     - nao fecha ao arrastar, ao segurar ou ao interagir com o modelo */
  const gesture = useRef({ x: 0, y: 0, t: 0, moved: false, onModel: false, active: false })
  const openedAt = useRef(0)
  useEffect(() => {
    openedAt.current = Date.now()
  }, [])

  const endGesture = () => {
    const g = gesture.current
    const wasActive = g.active
    g.active = false
    if (!wasActive) return
    if (Date.now() - openedAt.current < 500) return // carencia pos-abertura
    if (g.moved || g.onModel) return
    if (Date.now() - g.t > 320) return // segurou: intencao de girar, nao de fechar
    onClose()
  }

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
        gesture.current = {
          x: e.clientX,
          y: e.clientY,
          t: Date.now(),
          moved: false,
          onModel: false,
          active: true,
        }
      }}
      onPointerMove={(e) => {
        const g = gesture.current
        if (!g.active) return
        if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 6) g.moved = true
      }}
      onPointerUp={endGesture}
      onPointerCancel={() => {
        gesture.current.active = false
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Fundo escurecido (sem backdrop-blur: ele disputava GPU com o WebGL e causava travamentos) */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(20,22,34,0.94),rgba(6,7,12,0.97))]"
        aria-hidden="true"
      />

      {/* Cena 3D */}
      <div
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        style={{ touchAction: "none" }}
      >
        <Canvas
          dpr={[1, 1.5]}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            stencil: false,
            depth: true,
          }}
          camera={{ position: [0, 0, 5.4], fov: 42 }}
          style={{ touchAction: "none" }}
        >
          <AdaptiveDpr pixelated />
          <ambientLight intensity={0.5} />
          <directionalLight position={[4, 5, 6]} intensity={0.7} />
          <directionalLight position={[-4, -2, 4]} intensity={0.25} />
          <Suspense fallback={<CenterMessage text="Carregando previa..." />}>
            <SceneBoundary fallback={<CenterMessage text="Nao foi possivel carregar a previa." />}>
              <GestureControls>
                <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.3}>
                  <ItemModel
                    item={item}
                    onHit={() => {
                      gesture.current.onModel = true
                    }}
                  />
                </Float>
              </GestureControls>
              {/* Iluminacao de estudio gerada localmente (sem download de HDR),
                  renderizada uma unica vez em resolucao reduzida */}
              <Environment resolution={128} frames={1}>
                <Lightformer
                  intensity={1.0}
                  position={[0, 3, 3]}
                  scale={[8, 3, 1]}
                  color="#ffffff"
                />
                <Lightformer
                  intensity={0.5}
                  position={[-4, 1, 2]}
                  scale={[4, 4, 1]}
                  color="#8ab4ff"
                />
                <Lightformer
                  intensity={0.55}
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
          Arraste para girar &middot; Role ou pince para aproximar &middot; Toque duplo para centralizar &middot; Esc para sair
        </p>
      </div>
    </div>,
    document.body,
  )
}
