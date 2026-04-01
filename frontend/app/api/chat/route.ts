type ChatRequest = {
  message?: unknown;
  conversation_id?: unknown;
};

const DEFAULT_FASTAPI_BASE_URL = "http://localhost:8000";

function getFastApiBaseUrl() {
  const fromEnv = process.env.FASTAPI_BASE_URL;
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  return DEFAULT_FASTAPI_BASE_URL;
}

export async function POST(request: Request) {
  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return Response.json({ error: "message is required." }, { status: 400 });
  }
  const conversation_id =
    typeof body.conversation_id === "string" ? body.conversation_id.trim() : "";

  const backendUrl = new URL("/chat", getFastApiBaseUrl());

  try {
    const res = await fetch(backendUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message,
        ...(conversation_id ? { conversation_id } : {}),
      }),
    });

    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return Response.json(
      { error: "Unable to reach FastAPI backend.", backend: backendUrl.href },
      { status: 502 }
    );
  }
}
