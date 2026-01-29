import { getOne, getAll, run } from '../config/database.js';
import path from 'path';
import fs from 'fs';
import { createNotification, notificationTypes, getNotificationMessage } from './notificationController.js';

const generateClaimId = () => {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `KLM-${year}-${randomNum}`;
};

export const createClaim = async (req, res) => {
  try {
    const {
      fullName, nik, phone, address,
      incidentDate, incidentTime, incidentLocation, incidentDescription,
      vehicleType, vehicleNumber,
      bankName, bankBranch, accountNumber, accountHolderName,
      hospitalName, treatmentDescription, estimatedCost
    } = req.body;

    if (!fullName || !nik || !phone || !address || !incidentDate || !incidentLocation || !incidentDescription) {
      return res.status(400).json({
        success: false,
        message: 'Mohon lengkapi semua field yang wajib diisi'
      });
    }

    // Validate bank information
    if (!bankName || !accountNumber || !accountHolderName) {
      return res.status(400).json({
        success: false,
        message: 'Informasi rekening bank wajib diisi (nama bank, nomor rekening, nama pemilik rekening)'
      });
    }

    if (!req.files?.ktpFile || !req.files?.policeReportFile) {
      return res.status(400).json({
        success: false,
        message: 'KTP dan Surat Keterangan Polisi wajib diupload'
      });
    }

    if (!req.files?.bankBookFile) {
      return res.status(400).json({
        success: false,
        message: 'Foto/Scan Buku Tabungan wajib diupload'
      });
    }

    const claimId = generateClaimId();
    const userId = req.user?.id || null;

    // Insert claim
    await run(`
      INSERT INTO claims (
        id, user_id, full_name, nik, phone, address,
        incident_date, incident_time, incident_location, incident_description,
        vehicle_type, vehicle_number,
        bank_name, bank_branch, account_number, account_holder_name,
        hospital_name, treatment_description, estimated_cost,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'pending')
    `, [
      claimId, userId, fullName, nik, phone, address,
      incidentDate, incidentTime || null, incidentLocation, incidentDescription,
      vehicleType || null, vehicleNumber || null,
      bankName, bankBranch || null, accountNumber, accountHolderName,
      hospitalName || null, treatmentDescription || null, estimatedCost ? parseFloat(estimatedCost) : null
    ]);

    // Insert documents
    const documentTypes = {
      ktpFile: 'ktp',
      policeReportFile: 'police_report',
      stnkFile: 'stnk',
      medicalReportFile: 'medical_report',
      bankBookFile: 'bank_book'
    };

    for (const [fieldName, docType] of Object.entries(documentTypes)) {
      if (req.files[fieldName]) {
        const file = req.files[fieldName][0];
        // Convert absolute path to relative path
        const relativePath = file.path.split('uploads').pop();
        const filePath = 'uploads' + relativePath.replace(/\\/g, '/');
        
        await run(`
          INSERT INTO claim_documents (claim_id, document_type, file_name, file_path, file_size, mime_type)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [claimId, docType, file.originalname, filePath, file.size, file.mimetype]);
      }
    }

    // Insert initial timeline entry
    await run(`
      INSERT INTO claim_timeline (claim_id, status, description)
      VALUES ($1, 'Pengajuan Diterima', 'Klaim berhasil diajukan dan menunggu verifikasi dokumen')
    `, [claimId]);

    // Create notification for user if logged in
    if (userId) {
      const notifData = getNotificationMessage(notificationTypes.CLAIM_SUBMITTED, { claimId });
      await createNotification(userId, notificationTypes.CLAIM_SUBMITTED, notifData.title, notifData.message, claimId);
    }

    res.status(201).json({
      success: true,
      message: 'Klaim berhasil diajukan',
      data: { claimId, status: 'pending' }
    });
  } catch (error) {
    console.error('Create claim error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};

export const getClaimByIdOrNik = async (req, res) => {
  try {
    const { query } = req.params;

    let claim = await getOne('SELECT * FROM claims WHERE id = $1', [query]);
    if (!claim) {
      claim = await getOne('SELECT * FROM claims WHERE nik = $1 ORDER BY submitted_at DESC LIMIT 1', [query]);
    }

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Klaim tidak ditemukan'
      });
    }

    const documents = await getAll('SELECT * FROM claim_documents WHERE claim_id = $1', [claim.id]);
    const timeline = await getAll('SELECT * FROM claim_timeline WHERE claim_id = $1 ORDER BY created_at ASC', [claim.id]);

    res.json({
      success: true,
      data: { ...claim, documents, timeline }
    });
  } catch (error) {
    console.error('Get claim error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};

export const getAllClaims = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM claims WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM claims WHERE 1=1';
    const params = [];
    const countParams = [];
    let paramIndex = 1;

    if (status && status !== 'all') {
      query += ` AND status = $${paramIndex}`;
      countQuery += ` AND status = $${paramIndex}`;
      params.push(status);
      countParams.push(status);
      paramIndex++;
    }

    if (search) {
      query += ` AND (id ILIKE $${paramIndex} OR full_name ILIKE $${paramIndex} OR nik ILIKE $${paramIndex})`;
      countQuery += ` AND (id ILIKE $${paramIndex} OR full_name ILIKE $${paramIndex} OR nik ILIKE $${paramIndex})`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern);
      countParams.push(searchPattern);
      paramIndex++;
    }

    const countResult = await getOne(countQuery, countParams);
    const total = parseInt(countResult?.total) || 0;

    query += ` ORDER BY submitted_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const claims = await getAll(query, params);

    // Get documents for each claim
    const claimsWithDocs = await Promise.all(
      claims.map(async (claim) => {
        const documents = await getAll('SELECT * FROM claim_documents WHERE claim_id = $1', [claim.id]);
        return { ...claim, documents };
      })
    );

    res.json({
      success: true,
      data: {
        claims: claimsWithDocs,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all claims error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};

export const getUserClaims = async (req, res) => {
  try {
    const claims = await getAll('SELECT * FROM claims WHERE user_id = $1 ORDER BY submitted_at DESC', [req.user.id]);

    const claimsWithTimeline = await Promise.all(
      claims.map(async (claim) => {
        const timeline = await getAll('SELECT * FROM claim_timeline WHERE claim_id = $1 ORDER BY created_at ASC', [claim.id]);
        return { ...claim, timeline };
      })
    );

    res.json({ success: true, data: claimsWithTimeline });
  } catch (error) {
    console.error('Get user claims error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};

export const updateClaimStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const validStatuses = ['pending', 'verified', 'processing', 'approved', 'rejected', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status tidak valid'
      });
    }

    const claim = await getOne('SELECT * FROM claims WHERE id = $1', [id]);
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Klaim tidak ditemukan'
      });
    }

    // Update claim status
    await run(`
      UPDATE claims SET status = $1, admin_notes = $2 WHERE id = $3
    `, [status, adminNotes || null, id]);

    // Add timeline entry
    const statusDescriptions = {
      pending: 'Menunggu verifikasi dokumen',
      verified: 'Dokumen telah diverifikasi',
      processing: 'Klaim sedang diproses oleh tim',
      approved: 'Klaim disetujui untuk pencairan',
      rejected: 'Klaim ditolak. ' + (adminNotes || ''),
      completed: 'Klaim telah selesai diproses'
    };

    await run(`
      INSERT INTO claim_timeline (claim_id, status, description) VALUES ($1, $2, $3)
    `, [id, status.charAt(0).toUpperCase() + status.slice(1), statusDescriptions[status]]);

    // Create notification for user if claim has user_id
    if (claim.user_id) {
      const notifTypeMap = {
        verified: notificationTypes.CLAIM_VERIFIED,
        processing: notificationTypes.CLAIM_PROCESSING,
        approved: notificationTypes.CLAIM_APPROVED,
        rejected: notificationTypes.CLAIM_REJECTED,
        completed: notificationTypes.CLAIM_COMPLETED
      };

      const notifType = notifTypeMap[status];
      if (notifType) {
        const notifData = getNotificationMessage(notifType, { 
          claimId: id, 
          reason: adminNotes 
        });
        await createNotification(claim.user_id, notifType, notifData.title, notifData.message, id);
      }
    }

    res.json({
      success: true,
      message: 'Status klaim berhasil diupdate'
    });
  } catch (error) {
    console.error('Update claim status error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};

export const deleteClaim = async (req, res) => {
  try {
    const { id } = req.params;

    // Get documents to delete files
    const documents = await getAll('SELECT file_path FROM claim_documents WHERE claim_id = $1', [id]);
    documents.forEach(doc => {
      if (fs.existsSync(doc.file_path)) {
        fs.unlinkSync(doc.file_path);
      }
    });

    // Delete related records (cascade should handle this, but being explicit)
    await run('DELETE FROM claim_documents WHERE claim_id = $1', [id]);
    await run('DELETE FROM claim_timeline WHERE claim_id = $1', [id]);
    await run('DELETE FROM claims WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Klaim berhasil dihapus'
    });
  } catch (error) {
    console.error('Delete claim error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};

export const getClaimDocument = async (req, res) => {
  try {
    const { claimId, documentId } = req.params;

    const document = await getOne(
      'SELECT * FROM claim_documents WHERE id = $1 AND claim_id = $2',
      [documentId, claimId]
    );

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Dokumen tidak ditemukan'
      });
    }

    if (!fs.existsSync(document.file_path)) {
      return res.status(404).json({
        success: false,
        message: 'File tidak ditemukan'
      });
    }

    res.sendFile(path.resolve(document.file_path));
  } catch (error) {
    console.error('Get claim document error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};

// Upload bukti transfer oleh admin
export const uploadTransferProof = async (req, res) => {
  try {
    const { id } = req.params;
    const { transferAmount, transferDate, transferNotes } = req.body;

    const claim = await getOne('SELECT * FROM claims WHERE id = $1', [id]);
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Klaim tidak ditemukan'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Bukti transfer wajib diupload'
      });
    }

    // Convert absolute path to relative path
    const relativePath = req.file.path.split('uploads').pop();
    const filePath = 'uploads' + relativePath.replace(/\\/g, '/');

    // Update claim with transfer proof
    await run(`
      UPDATE claims SET 
        transfer_proof_path = $1,
        transfer_amount = $2,
        transfer_date = $3,
        transfer_notes = $4,
        status = 'completed'
      WHERE id = $5
    `, [
      filePath,
      transferAmount ? parseFloat(transferAmount) : null,
      transferDate || new Date().toISOString().split('T')[0],
      transferNotes || null,
      id
    ]);

    // Add to timeline
    await run(`
      INSERT INTO claim_timeline (claim_id, status, description)
      VALUES ($1, 'Selesai', 'Dana santunan telah ditransfer ke rekening penerima')
    `, [id]);

    // Create notification for user
    if (claim.user_id) {
      const notifData = getNotificationMessage(notificationTypes.CLAIM_COMPLETED, { 
        claimId: id,
        amount: transferAmount ? `Rp ${Number(transferAmount).toLocaleString('id-ID')}` : ''
      });
      await createNotification(claim.user_id, notificationTypes.CLAIM_COMPLETED, notifData.title, notifData.message, id);
    }

    res.json({
      success: true,
      message: 'Bukti transfer berhasil diupload',
      data: {
        transferProofPath: filePath,
        transferAmount,
        transferDate
      }
    });
  } catch (error) {
    console.error('Upload transfer proof error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};
