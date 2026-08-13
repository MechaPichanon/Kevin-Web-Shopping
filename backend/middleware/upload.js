const multer = require("multer");

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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + MIME_TO_EXTENSION[file.mimetype]);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!MIME_TO_EXTENSION[file.mimetype]) {
      return cb(new InvalidFileTypeError("Unsupported file type"));
    }
    cb(null, true);
  },
});

function handleUploadErrors(err, req, res, next) {
  if (err instanceof InvalidFileTypeError) {
    return res.status(400).json({ error: "Unsupported file type (jpeg/png/webp only)" });
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
