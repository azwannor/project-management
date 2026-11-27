import { S3Client, PutObjectCommand, GetObjectCommand, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import fs from "node:fs/promises";
import path from "node:path";

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), ".uploads");
const DEFAULT_BUCKET = process.env.MINIO_BUCKET || "ittracker-files";

export const ALLOWED_UPLOAD_MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const SAFE_INLINE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf"]);

let bucketEnsured = false;

function getS3Client(): S3Client | null {
  const endpoint = process.env.MINIO_ENDPOINT;
  const accessKeyId = process.env.MINIO_ACCESS_KEY;
  const secretAccessKey = process.env.MINIO_SECRET_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    endpoint,
    region: process.env.MINIO_REGION || "us-east-1",
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
}

async function ensureBucket(client: S3Client, bucket: string) {
  if (bucketEnsured) return;
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    try {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
    } catch (err: unknown) {
      const code = (err as { name?: string })?.name;
      if (code !== "BucketAlreadyOwnedByYou" && code !== "BucketAlreadyExists") {
        throw err;
      }
    }
  }
  bucketEnsured = true;
}

/**
 * Sanitize storage object key segments to prevent directory traversal and malformed paths.
 */
export function sanitizeStorageKey(rawKey: string): string | null {
  const cleaned = rawKey
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "");

  if (!cleaned || cleaned.includes("..") || cleaned.endsWith(".")) {
    return null;
  }
  if (!/^[a-zA-Z0-9._/-]+$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}

/**
 * Resolve canonical safe Content-Type and Content-Disposition policy for a stored object key.
 */
export function resolveServePolicy(safeKey: string): { contentType: string; inline: boolean } {
  const ext = path.extname(safeKey).toLowerCase();
  const canonicalMime = ALLOWED_UPLOAD_MIME_BY_EXT[ext] || "application/octet-stream";
  const inline = SAFE_INLINE_EXTS.has(ext);
  return { contentType: canonicalMime, inline };
}

/**
 * Store a binary buffer into MinIO S3 (or local `.uploads/` fallback in dev) and return object key & proxy URL.
 */
export async function uploadFileObject(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<{ key: string; url: string; backend: "minio" | "local" }> {
  const safeKey = sanitizeStorageKey(params.key);
  if (!safeKey) {
    throw new Error("Invalid storage object key");
  }

  const client = getS3Client();
  if (client) {
    await ensureBucket(client, DEFAULT_BUCKET);
    await client.send(
      new PutObjectCommand({
        Bucket: DEFAULT_BUCKET,
        Key: safeKey,
        Body: params.body,
        ContentType: params.contentType,
      })
    );
    return {
      key: safeKey,
      url: `/api/files/${safeKey}`,
      backend: "minio",
    };
  }

  const rootResolved = path.resolve(LOCAL_UPLOAD_DIR);
  const targetPath = path.resolve(rootResolved, safeKey);
  if (!targetPath.startsWith(rootResolved + path.sep)) {
    throw new Error("Path outside upload root");
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, params.body);

  return {
    key: safeKey,
    url: `/api/files/${safeKey}`,
    backend: "local",
  };
}

/**
 * Retrieve a stored file buffer and canonical safe Content-Type from MinIO S3 or local `.uploads/`.
 */
export async function readFileObject(
  rawKey: string
): Promise<{ body: Buffer; contentType: string; inline: boolean; filename: string } | null> {
  const safeKey = sanitizeStorageKey(rawKey);
  if (!safeKey) return null;

  const { contentType, inline } = resolveServePolicy(safeKey);
  const filename = path.basename(safeKey);

  const client = getS3Client();
  if (client) {
    try {
      const res = await client.send(
        new GetObjectCommand({
          Bucket: DEFAULT_BUCKET,
          Key: safeKey,
        })
      );
      if (!res.Body) return null;
      const bytes = await res.Body.transformToByteArray();
      return {
        body: Buffer.from(bytes),
        contentType,
        inline,
        filename,
      };
    } catch {
      return null;
    }
  }

  try {
    const rootResolved = path.resolve(LOCAL_UPLOAD_DIR);
    const targetPath = path.resolve(rootResolved, safeKey);
    if (!targetPath.startsWith(rootResolved + path.sep)) {
      return null;
    }
    const body = await fs.readFile(targetPath);
    return {
      body,
      contentType,
      inline,
      filename,
    };
  } catch {
    return null;
  }
}
