import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // O jogo usa playerId local para o PVP; não há sessão externa neste middleware.
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Only match protected routes if you need auth later
    '/protected/:path*',
  ],
}
