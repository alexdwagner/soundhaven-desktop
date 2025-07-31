import { NextResponse } from 'next/server';

// API Route startup logging
// console.log('📱 [Hello API] Route loaded successfully');
// console.log('📱 [Hello API] Available methods: GET');
// console.log('📱 [Hello API] Features: API connectivity test');

export async function GET() {
  console.log('🟢 [Hello API] Static route hit');
  return NextResponse.json({ message: 'Hello from Next.js API!' });
} 