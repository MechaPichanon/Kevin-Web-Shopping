// NEXT_PUBLIC_* vars are inlined into the client bundle at `next build` time,
// so this must be set in the environment the build runs in (see
// docker-compose.yml / docker-compose.prod.yml), not just at container start.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

// Resolves a value that may already be an absolute URL (external image, old
// DB row) or a relative "/uploads/..." path against API_BASE.
export function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}
