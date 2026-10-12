const crypto = require("crypto");
const multer = require("multer");
const sharp = require("sharp");
const { storageEnabled, uploadObject } = require("../utils/storage");

// Extension is derived from the validated mimetype below, never from the
// client-supplied originalname — otherwise a request can pass the mimetype
// check (e.g. Content-Type: image/png) while originalname is "x.html", and
// express.static would then serve the saved file with a text/html
// Content-Type based on that extension.
const MIME_TO_EXTENSION = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

class InvalidFileTypeError extends Error {}
class UnreadableImageError extends Error {}

// Phone photos are ~3000x4000 / 4-5 MB; shrinking them keeps pages fast and
// stays inside Supabase's free bandwidth. Product images match the settings
// used for the one-off copy of the existing catalogue (1200x1600, quality 85;
// measured: CLIP image-search vectors stay ≥0.99 similar to the originals).
// Slips are often tall phone screenshots, so they get a much larger box —
// the transfer details must stay readable for the admin.
const COMPRESS_BOX = {
  image: { width: 1200, height: 1600 },
  slip: { width: 1600, height: 3200 },
};

// Re-encodes in the same format, so mimetype and file extension don't change.
// .rotate() applies the phone's EXIF orientation; metadata (incl. GPS) is dropped.
async function compressImage(buffer, mimetype, fieldName) {
  const box = COMPRESS_BOX[fieldName] || COMPRESS_BOX.image;
  const image = sharp(buffer)
    .rotate()
    .resize({ ...box, fit: "inside", withoutEnlargement: true });
  if (mimetype === "image/png") return image.png({ compressionLevel: 9 }).toBuffer();
  if (mimetype === "image/webp") return image.webp({ quality: 85 }).toBuffer();
  return image.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
}

// Payment slips get an unguessable name (they're personal data); the "slip-"
// prefix is also how GET /uploads/:file knows to use the private bucket.
// Product images keep the timestamp name.
function generateFilename(file) {
  const ext = MIME_TO_EXTENSION[file.mimetype];
  return file.fieldname === "slip" ? `slip-${crypto.randomUUID()}${ext}` : Date.now() + ext;
}

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, generateFilename(file));
  },
});

const multerUpload = multer({
  // Supabase mode keeps the file in memory just long enough to send it on.
  storage: storageEnabled ? multer.memoryStorage() : diskStorage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!MIME_TO_EXTENSION[file.mimetype]) {
      return cb(new InvalidFileTypeError("Unsupported file type"));
    }
    cb(null, true);
  },
});

// Supabase mode: after multer, compress the image, upload it and set
// req.file.filename, so controllers keep storing "/uploads/<filename>"
// exactly as in disk mode.
async function sendToStorage(req, res, next) {
  if (!req.file) return next();
  try {
    let body;
    try {
      body = await compressImage(req.file.buffer, req.file.mimetype, req.file.fieldname);
    } catch {
      // The Content-Type said image, but the bytes aren't a readable image.
      throw new UnreadableImageError("Unreadable image");
    }
    const filename = generateFilename(req.file);
    const bucket = req.file.fieldname === "slip" ? "slips" : "products";
    await uploadObject(bucket, filename, body, req.file.mimetype);
    req.file.size = body.length;
    req.file.filename = filename;
    next();
  } catch (err) {
    next(err);
  }
}

// Same call shape as multer (upload.single("image")), so routes don't change.
const upload = {
  single(fieldName) {
    const receive = multerUpload.single(fieldName);
    return storageEnabled ? [receive, sendToStorage] : receive;
  },
};

function handleUploadErrors(err, req, res, next) {
  if (err instanceof InvalidFileTypeError) {
    return res.status(400).json({ error: "Unsupported file type (jpeg/png/webp only)" });
  }
  if (err instanceof UnreadableImageError) {
    return res.status(400).json({ error: "Could not read the image file" });
  }
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large (max 5MB)" });
    }
    return res.status(400).json({ error: "Upload error" });
  }
  next(err);
}

module.exports = { upload, handleUploadErrors };
