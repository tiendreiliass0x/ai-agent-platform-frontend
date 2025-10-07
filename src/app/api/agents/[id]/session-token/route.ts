import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const agentId = params.id;
  const authHeader = req.headers.get('authorization') || '';

  try {
    // Fetch agent details to retrieve public_id and server-side api_key
    const agentRes = await fetch(`${API_URL}/api/v1/agents/${agentId}`, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    });

    if (!agentRes.ok) {
      return NextResponse.json({ error: 'Failed to load agent' }, { status: agentRes.status });
    }

    const agent = await agentRes.json();
    const publicId = agent.public_id;
    const apiKey = agent.api_key;

    if (!publicId || !apiKey) {
      return NextResponse.json({ error: 'Agent missing credentials' }, { status: 400 });
    }

    // Request a short-lived session token from the backend using the API key server-side
    const tokenRes = await fetch(`${API_URL}/api/v1/agents/public/${publicId}/session-token`, {
      method: 'POST',
      headers: {
        'X-Agent-API-Key': apiKey
      }
    });

    if (!tokenRes.ok) {
      return NextResponse.json({ error: 'Failed to issue session token' }, { status: tokenRes.status });
    }

    const token = await tokenRes.json();
    return NextResponse.json(token, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal error', details: String(err?.message || err) }, { status: 500 });
  }
}

