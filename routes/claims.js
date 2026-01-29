import express from 'express';
import {
  createClaim, getClaimByIdOrNik, getAllClaims, getUserClaims,
  updateClaimStatus, deleteClaim, getClaimDocument, uploadTransferProof
} from '../controllers/claimController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';
import { uploadClaimDocuments, uploadTransferProof as uploadTransferProofMiddleware, handleUploadError } from '../middleware/upload.js';

const router = express.Router();

router.get('/search/:query', getClaimByIdOrNik);
router.post('/', authenticate, uploadClaimDocuments, handleUploadError, createClaim);
router.get('/my-claims', authenticate, getUserClaims);
router.get('/', authenticate, isAdmin, getAllClaims);
router.put('/:id/status', authenticate, isAdmin, updateClaimStatus);
router.post('/:id/transfer-proof', authenticate, isAdmin, uploadTransferProofMiddleware, handleUploadError, uploadTransferProof);
router.delete('/:id', authenticate, isAdmin, deleteClaim);
router.get('/:claimId/documents/:documentId', authenticate, getClaimDocument);

export default router;
