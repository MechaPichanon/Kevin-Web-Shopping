const DEFAULT_FASTAPI_BASE_URL = "http://localhost:8000";

function getFastApiBaseUrl() {
  const fromEnv = process.env.FASTAPI_BASE_URL;
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  return DEFAULT_FASTAPI_BASE_URL;
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form data." }, { status: 400 });
  }

  const image = formData.get("image");
  if (!(image instanceof Blob) || image.size === 0) {
    return Response.json({ error: "image is required." }, { status: 400 });
  }

  const backendUrl = new URL("/image-search", getFastApiBaseUrl());

  try {
    const res = await fetch(backendUrl, {
      method: "POST",
      body: formData,
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
