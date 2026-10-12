/**
 * upload_existing_images.js
 * One-off for the move to Supabase Storage: copies every product image still
 * referenced in product_images from backend/uploads/ into the public
 * "products" bucket, under the same filename — so the existing
 * "/uploads/<file>" rows keep working through the GET /uploads/:file redirect.
 *
 * Only referenced files are copied (not slips, not images of deleted
 * products). A file already in the bucket is skipped, so re-running is safe.
 *
 * --from <dir> reads the files from another folder instead of backend/uploads
 * (used 2026-10-12 to upload pre-compressed 1200x1600 copies under the same
 * filenames, leaving the originals in backend/uploads untouched).
 *
 * Needs DATABASE_URL (the DB whose rows to copy — normally the Supabase one),
 * SUPABASE_URL and SUPABASE_SECRET_KEY. Run inside the auth-backend container:
 *   docker exec -e DATABASE_URL=... -e SUPABASE_URL=... -e SUPABASE_SECRET_KEY=... \
 *     kevin-web-shopping-auth-backend-1 node scripts/upload_existing_images.js         # dry run
 *   ... node scripts/upload_existing_images.js --yes                                    # upload
 *   ... node scripts/upload_existing_images.js --yes --from /tmp/compressed
 */

const fs = require("fs");
const path = require("path");
const pool = require("../db");
const { storageEnabled, uploadObject } = require("../utils/storage");

const fromIndex = process.argv.indexOf("--from");
const UPLOADS_DIR = fromIndex > -1 ? path.resolve(process.argv[fromIndex + 1]) : path.join(__dirname, "..", "uploads");
const CONTENT_TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

async function main() {
  if (!storageEnabled) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
  }
  const apply = process.argv.includes("--yes");

  const { rows } = await pool.query(
    "SELECT DISTINCT image_url FROM product_images WHERE image_url LIKE '/uploads/%' ORDER BY image_url"
  );
  const files = rows.map((r) => path.basename(r.image_url));
  const missing = files.filter((f) => !fs.existsSync(path.join(UPLOADS_DIR, f)));
  const totalBytes = files
    .filter((f) => !missing.includes(f))
    .reduce((sum, f) => sum + fs.statSync(path.join(UPLOADS_DIR, f)).size, 0);

  console.log(`Reading from ${UPLOADS_DIR}`);
  console.log(`${files.length} referenced images, ${(totalBytes / 1024 / 1024).toFixed(1)} MB on disk`);
  if (missing.length) console.log(`MISSING on disk (${missing.length}):`, missing.join(", "));
  if (!apply) {
    console.log("Dry run — nothing uploaded. Re-run with --yes to upload.");
    return;
  }

  let uploaded = 0, skipped = 0, failed = 0;
  for (const f of files) {
    if (missing.includes(f)) continue;
    const contentType = CONTENT_TYPES[path.extname(f).toLowerCase()];
    if (!contentType) {
      console.log(`skip ${f}: unknown file type`);
      failed++;
      continue;
    }
    try {
      await uploadObject("products", f, fs.readFileSync(path.join(UPLOADS_DIR, f)), contentType);
      uploaded++;
    } catch (err) {
      // Storage answers "Duplicate" (409) when the file is already there.
      if (/Duplicate|already exists|409/.test(err.message)) {
        skipped++;
      } else {
        console.log(`FAILED ${f}: ${err.message}`);
        failed++;
      }
    }
  }
  console.log(`uploaded ${uploaded}, already there ${skipped}, failed ${failed}, missing ${missing.length}`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
