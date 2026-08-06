"use client"

import { Suspense, useEffect, useMemo } from "react"
import { Canvas } from "@react-three/fiber"
import { PresentationControls, Float, Environment, useTexture } from "@react-three/drei"
import { SRGBColorSpace } from "three"

export interface Preview3DItem {
  image: string
  name: string
  kind: "playmat" | "pack"
}

interface ItemPreview3DProps {
  item: Preview3DItem
  onClose: () => void
}

function ItemModel({ item }: { item: Preview3DItem }) {
  const texture = useTexture(item.image)

  useMemo(() => {
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 16
    texture.needsUpdate = true
  }, [texture])

  // Dimensoes baseadas na proporcao real da imagem
  const { width, height } = useMemo(() => {
    const img = texture.image as { width?: number; height?: number } | undefined
    const ratio = img?.width && img?.height ? img.width / img.height : item.kind === "playmat" ? 1.5 : 0.71
    const maxDim = item.kind === "playmat" ? 4.2 : 3.4
    if (ratio >= 1) return { width: maxDim, height: maxDim / ratio }
    return { width: maxDim * ratio, height: maxDim }
  }, [texture, item.kind])

  const depth = item.kind === "playmat" ? 0.045 : 0.1

  return (
    <mesh castShadow>
      <boxGeometry args={[width, height, depth]} />
      {/* Laterais e verso em tom escuro */}
      <meshStandardMaterial attach="material-0" color="#14161f" roughness={0.8} />
      <meshStandardMaterial attach="material-1" color="#14161f" roughness={0.8} />
      <meshStandardMaterial attach="material-2" color="#14161f" roughness={0.8} />
      <meshStandardMaterial attach="material-3" color="#14161f" roughness={0.8} />
      {/* Frente com a arte em alta qualidade */}
      <meshStandardMaterial attach="material-4" map={texture} roughness={0.45} metalness={0.05} />
      <meshStandardMaterial attach="material-5" color="#0d0e15" roughness={0.9} />
    </mesh>
  )
}

export default function ItemPreview3D({ item, onClose }: ItemPreview3DProps) {
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

  return (
    <div
      className="fixed inset-0 z-[70] animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-label={`Visualizacao 3D de ${item.name}`}
    >
      {/* Fundo borrado — clique para fechar */}
      <div
        className="absolute inset-0 bg-[#0a0b12]/70 backdrop-blur-xl"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Cena 3D */}
      <div className="absolute inset-0">
        <Canvas
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          camera={{ position: [0, 0, 5.2], fov: 42 }}
          onPointerMissed={onClose}
        >
          <ambientLight intensity={0.65} />
          <directionalLight position={[4, 5, 6]} intensity={1.1} />
          <directionalLight position={[-4, -2, 4]} intensity={0.35} />
          <Suspense fallback={null}>
            <PresentationControls
              global
              cursor
              speed={1.4}
              rotation={[0.08, 0, 0]}
              polar={[-Math.PI / 3, Math.PI / 3]}
              azimuth={[-Math.PI, Math.PI]}
              config={{ mass: 1, tension: 180, friction: 24 }}
            >
              <Float speed={1.6} rotationIntensity={0.12} floatIntensity={0.35}>
                <ItemModel item={item} />
              </Float>
            </PresentationControls>
            <Environment preset="city" />
          </Suspense>
        </Canvas>
      </div>

      {/* Legenda */}
      <div className="absolute bottom-8 inset-x-0 flex flex-col items-center gap-1.5 pointer-events-none px-4">
        <h3 className="font-serif text-white font-bold text-xl text-balance text-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
          {item.name}
        </h3>
        <p className="text-slate-300/80 text-[13px] text-center">
          Arraste para girar &middot; Clique no fundo para sair
        </p>
      </div>
    </div>
  )
}
