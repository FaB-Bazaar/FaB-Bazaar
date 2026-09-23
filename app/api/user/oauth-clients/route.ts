// app/api/user/oauth-clients/route.ts
// This file contains GET and POST handlers for the main oauth-clients endpoint
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { oauthService } from "@/lib/services";
import { MAX_CLIENTS_PER_USER, MAX_CLIENT_NAME_LENGTH } from "@/lib/oauth-client-limits";

// GET - List user's OAuth clients
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await oauthService.listClients(session.user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ clients: result.data });

  } catch (error) {
    console.error('Error fetching user OAuth clients:', error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST - Create an additional OAuth client for the user (one per app).
// Existing clients are left alone; each is revoked on its own via DELETE.
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const clientName = typeof body?.client_name === 'string' ? body.client_name.trim() : '';
    if (!clientName) {
      return NextResponse.json({ error: "client_name is required" }, { status: 400 });
    }
    if (clientName.length > MAX_CLIENT_NAME_LENGTH) {
      return NextResponse.json(
        { error: `client_name must be at most ${MAX_CLIENT_NAME_LENGTH} characters` },
        { status: 400 }
      );
    }

    const existing = await oauthService.listClients(session.user.id);
    if (!existing.success) {
      return NextResponse.json({ error: existing.error }, { status: 500 });
    }
    if (existing.data.length >= MAX_CLIENTS_PER_USER) {
      return NextResponse.json(
        { error: `You can have at most ${MAX_CLIENTS_PER_USER} sets of credentials. Revoke one you no longer use first.` },
        { status: 400 }
      );
    }

    const result = await oauthService.createClient(session.user.id, clientName);

    if (!result.success) {
      const statusCode = result.error === 'User not found' ? 404 : 500;
      return NextResponse.json({ error: result.error }, { status: statusCode });
    }

    // Return the complete client data (including secret) for initial setup
    return NextResponse.json({
      client_id: result.data.client_id,
      client_secret: result.data.client_secret,
      client_name: result.data.client_name,
      created_at: result.data.created_at.toISOString(),
      grant_types: result.data.grant_types,
      scope: result.data.scope
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating user OAuth client:', error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
