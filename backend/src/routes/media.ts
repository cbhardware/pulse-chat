import express, { Request, Response, Router, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import {
  uploadMediaToStorage,
  deleteMediaFromStorage,
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
} from '../services/storageService.js';

const router: Router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

/**
 * POST /api/v1/media/upload
 * Upload a photo, video, or audio file to S3/R2.
 * Expects multipart/form-data with a single field named "file".
 *
 * Response: { url, key, mimeType, size }
 * Use the returned `url` as `mediaUrl` when calling POST /api/v1/groups/:groupId/messages.
 * Twilio will fetch that URL and deliver it natively as MMS (no link sent to recipients).
 */
router.post(
  '/upload',
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: `File too large. Maximum size is ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)}MB.`,
          });
        }
        return res.status(400).json({ error: err.message });
      }
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided. Use field name "file".' });
    }

    try {
      const { url, key } = await uploadMediaToStorage(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname
      );

      res.status(201).json({
        url,
        key,
        mimeType: req.file.mimetype,
        size: req.file.size,
      });
    } catch (error) {
      console.error('[Media Upload Error]:', error);
      res.status(500).json({ error: 'Failed to upload media. Check storage configuration.' });
    }
  }
);

/**
 * DELETE /api/v1/media/:key
 * Delete a previously uploaded media file by its storage key.
 * The key is URL-encoded (e.g. "media%2Fuuid.jpg" for "media/uuid.jpg").
 */
router.delete('/:key(*)', async (req: Request, res: Response) => {
  const { key } = req.params;

  if (!key || key.includes('..')) {
    return res.status(400).json({ error: 'Invalid media key.' });
  }

  try {
    await deleteMediaFromStorage(key);
    res.json({ deleted: true, key });
  } catch (error) {
    console.error('[Media Delete Error]:', error);
    res.status(500).json({ error: 'Failed to delete media.' });
  }
});

export default router;
