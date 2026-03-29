import sharp from "sharp";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Magic byte signatures for image formats
const MAGIC_BYTES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF header
};

function detectMimeType(buffer: Buffer): string | null {
  for (const [mime, signatures] of Object.entries(MAGIC_BYTES)) {
    for (const sig of signatures) {
      if (sig.every((byte, i) => buffer[i] === byte)) {
        return mime;
      }
    }
  }
  return null;
}

export interface ValidatedImage {
  buffer: Buffer;
  mimeType: string;
  base64: string;
}

export async function validateAndProcessImage(
  fileBuffer: Buffer,
  declaredMimeType?: string
): Promise<ValidatedImage> {
  // Check file size
  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error("File size exceeds 10MB limit");
  }

  if (fileBuffer.length === 0) {
    throw new Error("Empty file");
  }

  // Validate magic bytes (don't trust Content-Type header)
  const detectedMime = detectMimeType(fileBuffer);
  if (!detectedMime) {
    throw new Error("Unrecognized image format. Only JPEG, PNG, and WebP are allowed.");
  }

  if (!ALLOWED_MIME_TYPES.includes(detectedMime as typeof ALLOWED_MIME_TYPES[number])) {
    throw new Error("Unsupported image format. Only JPEG, PNG, and WebP are allowed.");
  }

  // If declared MIME doesn't match detected, use detected (don't trust client)
  if (declaredMimeType && declaredMimeType !== detectedMime) {
    console.warn(
      `MIME type mismatch: declared=${declaredMimeType}, detected=${detectedMime}`
    );
  }

  // Re-encode with sharp to:
  // 1. Strip EXIF/metadata (privacy + security)
  // 2. Neutralize any embedded payloads (polyglot files)
  // 3. Resize if extremely large
  const processed = await sharp(fileBuffer)
    .rotate() // Auto-rotate based on EXIF before stripping
    .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  return {
    buffer: processed,
    mimeType: "image/jpeg",
    base64: processed.toString("base64"),
  };
}
