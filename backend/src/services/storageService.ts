import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import dotenv from 'dotenv';
import { env } from '../config/env.js';

dotenv.config();

// Supports both AWS S3 and Cloudflare R2 (S3-compatible API).
// Set S3_ENDPOINT for R2: https://<account_id>.r2.cloudflarestorage.com
const s3Client = new S3Client({
  region: env.S3_REGION,
  ...(env.S3_ENDPOINT && { endpoint: env.S3_ENDPOINT }),
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
  // Required for Cloudflare R2 path-style access
  forcePathStyle: !!env.S3_ENDPOINT,
});

const BUCKET = env.S3_BUCKET_NAME;

// MEDIA_BASE_URL: public CDN/bucket base URL (e.g. https://media.yourapp.com or R2 public URL)
const MEDIA_BASE_URL = (env.MEDIA_BASE_URL || '').replace(/\/$/, '');

// Allowed MIME types for upload — images, video, audio only
export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
]);

// 25 MB — practical upper limit for Twilio MMS and reasonable mobile upload
export const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;

/**
 * Upload a media file buffer to S3 / Cloudflare R2.
 * Returns the publicly accessible URL and the storage key.
 */
export async function uploadMediaToStorage(
  fileBuffer: Buffer,
  mimeType: string,
  originalName: string
): Promise<{ url: string; key: string }> {
  const ext = path.extname(originalName) || mimeTypeToExt(mimeType);
  // Use a UUID key to prevent path traversal and avoid filename collisions
  const key = `media/${uuidv4()}${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
      // Do NOT set ACL here — configure bucket-level public access in S3/R2 console
    })
  );

  const url = buildPublicUrl(key);
  console.log(`[Storage] Uploaded media: ${key} (${mimeType}, ${fileBuffer.length} bytes)`);
  return { url, key };
}

/**
 * Delete a previously uploaded media file from storage by its key.
 */
export async function deleteMediaFromStorage(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
  console.log(`[Storage] Deleted media: ${key}`);
}

function buildPublicUrl(key: string): string {
  if (MEDIA_BASE_URL) {
    return `${MEDIA_BASE_URL}/${key}`;
  }
  // Fallback to standard AWS S3 virtual-hosted URL
  return `https://${BUCKET}.s3.${env.S3_REGION || 'us-east-1'}.amazonaws.com/${key}`;
}

function mimeTypeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg':    '.jpg',
    'image/png':     '.png',
    'image/gif':     '.gif',
    'image/webp':    '.webp',
    'image/heic':    '.heic',
    'video/mp4':     '.mp4',
    'video/quicktime': '.mov',
    'video/webm':    '.webm',
    'audio/mpeg':    '.mp3',
    'audio/mp4':     '.m4a',
    'audio/ogg':     '.ogg',
  };
  return map[mimeType] || '';
}
