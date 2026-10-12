// Supabase Storage for uploaded images, used only when SUPABASE_URL and
// SUPABASE_SECRET_KEY are set (the deployed server). Without them, uploads stay
// on local disk in uploads/ as before — so local dev never writes to the live
// storage.
//
// Talks to the Storage REST API with Node's built-in fetch (no extra npm
// package). Buckets:
//   products — public  (product images)
//   slips    — private (payment slips; shown through a short-lived signed URL)

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "")
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || ""
const storageEnabled = Boolean(SUPABASE_URL && SECRET_KEY)

const SIGNED_URL_SECONDS = 5 * 60

function authHeaders() {
  return { apikey: SECRET_KEY, Authorization: `Bearer ${SECRET_KEY}` }
}

async function uploadObject(bucket, name, buffer, contentType) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURIComponent(name)}`,
    {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": contentType },
      body: buffer,
    }
  )
  if (!res.ok) {
    throw new Error(`Supabase upload to ${bucket}/${name} failed: ${res.status} ${await res.text()}`)
  }
}

function publicUrl(bucket, name) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeURIComponent(name)}`
}

async function signedUrl(bucket, name) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${encodeURIComponent(name)}`,
    {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: SIGNED_URL_SECONDS }),
    }
  )
  if (!res.ok) {
    throw new Error(`Supabase sign ${bucket}/${name} failed: ${res.status} ${await res.text()}`)
  }
  const { signedURL } = await res.json()
  return `${SUPABASE_URL}/storage/v1${signedURL}`
}

module.exports = { storageEnabled, uploadObject, publicUrl, signedUrl }
