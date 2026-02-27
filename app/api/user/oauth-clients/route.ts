// app/api/user/oauth-clients/route.ts
// This file contains GET and POST handlers for the main oauth-clients endpoint
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { oauthService } from "@/lib/services";

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

// POST - Generate new OAuth client for user (replaces any existing client)
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { client_name } = await req.json();
    if (!client_name) {
      return NextResponse.json({ error: "client_name is required" }, { status: 400 });
    }

    // Revoke all existing clients before creating a new one (one-client-per-user limit)
    const existing = await oauthService.listClients(session.user.id);
    if (existing.success && existing.data.length > 0) {
      await Promise.all(
        existing.data.map(c => oauthService.revokeClient(session.user.id, c.client_id))
      );
    }

    const result = await oauthService.createClient(session.user.id, client_name);

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
