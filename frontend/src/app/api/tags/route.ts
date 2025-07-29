import { NextRequest, NextResponse } from 'next/server';

// API Route startup logging
console.log('📱 [Tags API] Route loaded successfully');
console.log('📱 [Tags API] Available methods: GET');
console.log('📱 [Tags API] Features: Tag management, track associations');

export async function GET(request: NextRequest) {
  console.log('📱 [Next.js API] /api/tags called from mobile');
  
  // For now, return empty tags array
  // TODO: Implement actual tags from database
  const tags = [];
  
  console.log('📱 [Next.js API] Returning tags:', tags.length);
  
  return NextResponse.json({
    data: tags,
    message: 'Tags retrieved successfully'
  });
}

export async function POST(request: NextRequest) {
  console.log('📱 [Next.js API] /api/tags POST called from mobile');
  
  try {
    const body = await request.json();
    console.log('📱 [Next.js API] Tag creation request:', body);
    
    // For now, return a mock response
    // TODO: Implement actual tag creation
    const newTag = {
      id: Date.now().toString(),
      name: body.name,
      color: body.color || '#3B82F6'
    };
    
    console.log('📱 [Next.js API] Created tag:', newTag);
    
    return NextResponse.json({
      data: newTag,
      message: 'Tag created successfully'
    });
  } catch (error) {
    console.error('📱 [Next.js API] Error creating tag:', error);
    return NextResponse.json(
      { error: 'Failed to create tag' },
      { status: 500 }
    );
  }
} 