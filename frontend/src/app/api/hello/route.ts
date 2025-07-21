import { NextResponse } from 'next/server';

export async function GET() {
  console.log('🟢 [Hello API] Static route hit');
  return NextResponse.json({ message: 'Hello from Next.js API!' });
} 