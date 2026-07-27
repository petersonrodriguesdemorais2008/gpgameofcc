/**
 * IMAGE PRELOADER — cache module-level de imagens do jogo.
 *
 * - preloadImages(urls): dispara o download em paralelo e memoriza o resultado.
 * - imagesReady(urls): retorna uma Promise que resolve quando todas estiverem
 *   prontas (resolve imediatamente se já estiverem em cache).
 * - areImagesCached(urls): checagem síncrona — true se todas já carregaram.
 *
 * Como o cache vive no módulo, ele sobrevive a navegações entre telas:
 * a primeira visita paga o download, as próximas são instantâneas.
 */

const loaded = new Set<string>()
const pending = new Map<string, Promise<void>>()

function loadOne(src: string): Promise<void> {
  if (loaded.has(src)) return Promise.resolve()
  const existing = pending.get(src)
  if (existing) return existing

  const p = new Promise<void>((resolve) => {
    if (typeof window === "undefined") { resolve(); return }
    const img = new window.Image()
    img.onload = () => { loaded.add(src); pending.delete(src); resolve() }
    // Em erro também resolvemos: a tela não deve travar por uma imagem quebrada
    img.onerror = () => { pending.delete(src); resolve() }
    img.src = src
  })
  pending.set(src, p)
  return p
}

/** Dispara o pré-carregamento (fire-and-forget). */
export function preloadImages(urls: string[]) {
  for (const u of urls) loadOne(u)
}

/** Resolve quando todas as imagens estiverem prontas (ou falharem). */
export function imagesReady(urls: string[]): Promise<void> {
  return Promise.all(urls.map(loadOne)).then(() => undefined)
}

/** Checagem síncrona: todas já estão no cache? */
export function areImagesCached(urls: string[]): boolean {
  return urls.every((u) => loaded.has(u))
}

/** URLs das artes da tela de Modo de Jogo — usadas para warm-up no menu. */
export const GAME_MODE_IMAGES = [
  "/images/modes/banner-campanha.png",
  "/images/modes/mode-vsbot.png",
  "/images/modes/banner-pvp.png",
  "/images/modes/mode-draft.png",
  "/images/modes/mode-roguelike.png",
  "/images/modes/mode-catastrofe.png",
  "/images/modes/gear-blue.png",
]
