import express from 'express';
import {
  createVerification, getVerificationByIdOrNik, getAllVerifications,
  updateVerificationStatus, deleteVerification, getVerificationDocument
} from '../controllers/verificationController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';
import { uploadVerificationDocuments, handleUploadError } from '../middleware/upload.js';

const router = express.Router();

router.post('/', uploadVerificationDocuments, handleUploadError, createVerification);
router.get('/search/:query', getVerificationByIdOrNik);
router.get('/', authenticate, isAdmin, getAllVerifications);
router.put('/:id/status', authenticate, isAdmin, updateVerificationStatus);
router.delete('/:id', authenticate, isAdmin, deleteVerification);
router.get('/:verificationId/documents/:documentId', authenticate, getVerificationDocument);

export default router;
