import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Simple pass-through middleware - Supabase auth disabled temporarily
  // The game doesn't require authentication to run
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Only match protected routes if you need auth later
    '/protected/:path*',
  ],
}
