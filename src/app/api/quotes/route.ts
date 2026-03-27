import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://zenquotes.io/api/today', { next: { revalidate: 3600 } });
    const data = await response.json();
    if (data && data.length > 0) return NextResponse.json(data[0]);
    return NextResponse.json(null);
  } catch (error) {
    console.error('Error fetching quote:', error);
    return NextResponse.json(null);
  }
}
