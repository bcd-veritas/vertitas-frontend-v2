import type { NextRequest } from "next/server";

/**
 * Server-side proxy for the middleware's admin dashboard endpoints. The browser
 * calls same-origin `/api/admin/*`; this handler forwards to the middleware with
 * the `x-admin-key` header injected from a server-only env var, so the key never
 * reaches client code. GET (dashboard reads) + POST (create-market).
 *
 * `ADMIN_API_KEY` (NOT NEXT_PUBLIC_) must match the middleware's ADMIN_API_KEY.
 */
export const dynamic = "force-dynamic";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";
const ADMIN_KEY = process.env.ADMIN_API_KEY ?? "";

export async function GET( 
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const target = `${API}/admin/${path.join("/")}${request.nextUrl.search}`;

  try {
    const upstream = await fetch(target, {
      headers: { "x-admin-key": ADMIN_KEY },
      cache: "no-store",
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return Response.json({ error: "Upstream unavailable" }, { status: 502 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const target = `${API}/admin/${path.join("/")}${request.nextUrl.search}`;
  const body = await request.text();

  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: { "x-admin-key": ADMIN_KEY, "content-type": "application/json" },
      body,
      cache: "no-store",
    });

    const contentType = upstream.headers.get("content-type") ?? "";

    // Server-Sent Events (create-market progress): pass the stream straight
    // through instead of buffering with .text(), so the client sees each step
    // as it lands rather than all at once when the request finishes.
    if (contentType.includes("text/event-stream") && upstream.body) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
          "x-accel-buffering": "no",
        },
      });
    }

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        "content-type": contentType || "application/json",
      },
    });
  } catch {
    return Response.json({ error: "Upstream unavailable" }, { status: 502 });
  }
}
