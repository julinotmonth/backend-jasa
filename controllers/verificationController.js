import { getOne, getAll, run } from '../config/database.js';
import path from 'path';
import fs from 'fs';

const generateVerificationId = () => {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `VER-${year}${month}-${randomNum}`;
};

export const createVerification = async (req, res) => {
  try {
    const { fullName, nik, phone, email, preCheckResults } = req.body;

    if (!fullName || !nik || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Nama lengkap, NIK, dan nomor HP wajib diisi'
      });
    }

    if (nik.length !== 16) {
      return res.status(400).json({
        success: false,
        message: 'NIK harus 16 digit'
      });
    }

    if (!req.files?.ktpFile || !req.files?.policeReportFile) {
      return res.status(400).json({
        success: false,
        message: 'KTP dan Surat Keterangan Polisi wajib diupload'
      });
    }

    const verificationId = generateVerificationId();

    // Insert verification - PostgreSQL uses JSONB natively
    await run(`
      INSERT INTO verifications (id, full_name, nik, phone, email, pre_check_results, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
    `, [
      verificationId, fullName, nik, phone,
      email || null,
      preCheckResults ? JSON.stringify(preCheckResults) : null
    ]);

    // Insert documents
    const documentTypes = {
      ktpFile: 'ktp',
      policeReportFile: 'police_report',
      stnkFile: 'stnk',
      medicalFile: 'medical_report'
    };

    for (const [fieldName, docType] of Object.entries(documentTypes)) {
      if (req.files[fieldName]) {
        const file = req.files[fieldName][0];
        // Convert absolute path to relative path
        const relativePath = file.path.split('uploads').pop();
        const filePath = 'uploads' + relativePath.replace(/\\/g, '/');
        
        await run(`
          INSERT INTO verification_documents (verification_id, document_type, file_name, file_path, file_size, mime_type)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [verificationId, docType, file.originalname, filePath, file.size, file.mimetype]);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Dokumen berhasil dikirim untuk verifikasi',
      data: { verificationId, status: 'pending' }
    });
  } catch (error) {
    console.error('Create verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};

export const getVerificationByIdOrNik = async (req, res) => {
  try {
    const { query } = req.params;

    let verification = await getOne('SELECT * FROM verifications WHERE id = $1', [query]);
    if (!verification) {
      verification = await getOne('SELECT * FROM verifications WHERE nik = $1 ORDER BY submitted_at DESC LIMIT 1', [query]);
    }

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: 'Data verifikasi tidak ditemukan'
      });
    }

    // pre_check_results is already JSONB in PostgreSQL, but we still need to handle if it's stored as string
    if (verification.pre_check_results && typeof verification.pre_check_results === 'string') {
      try {
        verification.pre_check_results = JSON.parse(verification.pre_check_results);
      } catch (e) {}
    }

    const documents = await getAll('SELECT * FROM verification_documents WHERE verification_id = $1', [verification.id]);

    res.json({
      success: true,
      data: { ...verification, documents }
    });
  } catch (error) {
    console.error('Get verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};

export const getAllVerifications = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM verifications WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM verifications WHERE 1=1';
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

    const verifications = await getAll(query, params);

    // Get documents for each verification
    const verificationsWithDocs = await Promise.all(
      verifications.map(async (verification) => {
        const documents = await getAll('SELECT * FROM verification_documents WHERE verification_id = $1', [verification.id]);
        
        // Parse pre_check_results if it's a string
        if (verification.pre_check_results && typeof verification.pre_check_results === 'string') {
          try {
            verification.pre_check_results = JSON.parse(verification.pre_check_results);
          } catch (e) {}
        }
        
        return { ...verification, documents };
      })
    );

    res.json({
      success: true,
      data: {
        verifications: verificationsWithDocs,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all verifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};

export const updateVerificationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const validStatuses = ['pending', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status tidak valid'
      });
    }

    const verification = await getOne('SELECT * FROM verifications WHERE id = $1', [id]);
    if (!verification) {
      return res.status(404).json({
        success: false,
        message: 'Verifikasi tidak ditemukan'
      });
    }

    await run(`
      UPDATE verifications 
      SET status = $1, admin_notes = $2, reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [status, adminNotes || null, req.user.name, id]);

    res.json({
      success: true,
      message: 'Status verifikasi berhasil diupdate'
    });
  } catch (error) {
    console.error('Update verification status error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};

export const deleteVerification = async (req, res) => {
  try {
    const { id } = req.params;

    // Get documents to delete files
    const documents = await getAll('SELECT file_path FROM verification_documents WHERE verification_id = $1', [id]);
    documents.forEach(doc => {
      if (fs.existsSync(doc.file_path)) {
        fs.unlinkSync(doc.file_path);
      }
    });

    // Delete related records
    await run('DELETE FROM verification_documents WHERE verification_id = $1', [id]);
    await run('DELETE FROM verifications WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Verifikasi berhasil dihapus'
    });
  } catch (error) {
    console.error('Delete verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};

export const getVerificationDocument = async (req, res) => {
  try {
    const { verificationId, documentId } = req.params;

    const document = await getOne(
      'SELECT * FROM verification_documents WHERE id = $1 AND verification_id = $2',
      [documentId, verificationId]
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
    console.error('Get verification document error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};
