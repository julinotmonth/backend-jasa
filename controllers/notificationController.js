import { getOne, getAll, run } from '../config/database.js';  // Pastikan impor dari database.js benar

// Get user's notifications
export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const notifications = await getAll(
      `SELECT * FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [userId]
    );

    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};

// Mark single notification as read
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if notification belongs to user
    const notification = await getOne(
      'SELECT * FROM notifications WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notifikasi tidak ditemukan'
      });
    }

    await run(
      'UPDATE notifications SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    res.json({
      success: true,
      message: 'Notifikasi ditandai sudah dibaca'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await run(
      'UPDATE notifications SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND is_read = FALSE',
      [userId]
    );

    res.json({
      success: true,
      message: 'Semua notifikasi ditandai sudah dibaca'
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};

// Delete notification
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if notification belongs to user
    const notification = await getOne(
      'SELECT * FROM notifications WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notifikasi tidak ditemukan'
      });
    }

    await run('DELETE FROM notifications WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Notifikasi berhasil dihapus'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};

// Helper function to create notification (used by other controllers)
export const createNotification = async (userId, type, title, message, referenceId = null) => {
  try {
    await run(
      `INSERT INTO notifications (user_id, type, title, message, reference_id, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, FALSE, CURRENT_TIMESTAMP)`,
      [userId, type, title, message, referenceId]
    );
    return true;
  } catch (error) {
    console.error('Create notification error:', error);
    return false;
  }
};

// Notification types and messages helper
export const notificationTypes = {
  CLAIM_SUBMITTED: 'claim_submitted',
  CLAIM_VERIFIED: 'claim_verified',
  CLAIM_PROCESSING: 'claim_processing',
  CLAIM_APPROVED: 'claim_approved',
  CLAIM_REJECTED: 'claim_rejected',
  CLAIM_COMPLETED: 'claim_completed',
  VERIFICATION_APPROVED: 'verification_approved',
  VERIFICATION_REJECTED: 'verification_rejected'
};

export const getNotificationMessage = (type, data = {}) => {
  const messages = {
    [notificationTypes.CLAIM_SUBMITTED]: {
      title: 'Klaim Berhasil Diajukan',
      message: `Klaim ${data.claimId || ''} telah berhasil diajukan dan sedang menunggu verifikasi.`
    },
    [notificationTypes.CLAIM_VERIFIED]: {
      title: 'Dokumen Terverifikasi',
      message: `Dokumen klaim ${data.claimId || ''} telah diverifikasi. Klaim Anda sedang diproses.`
    },
    [notificationTypes.CLAIM_PROCESSING]: {
      title: 'Klaim Sedang Diproses',
      message: `Klaim ${data.claimId || ''} sedang dalam proses penanganan oleh tim kami.`
    },
    [notificationTypes.CLAIM_APPROVED]: {
      title: 'Klaim Disetujui',
      message: `Selamat! Klaim ${data.claimId || ''} telah disetujui. Dana akan segera ditransfer.`
    },
    [notificationTypes.CLAIM_REJECTED]: {
      title: 'Klaim Ditolak',
      message: `Mohon maaf, klaim ${data.claimId || ''} tidak dapat disetujui. ${data.reason || ''}`
    },
    [notificationTypes.CLAIM_COMPLETED]: {
      title: 'Klaim Selesai',
      message: `Klaim ${data.claimId || ''} telah selesai. Dana ${data.amount || ''} telah ditransfer ke rekening Anda.`
    },
    [notificationTypes.VERIFICATION_APPROVED]: {
      title: 'Verifikasi Disetujui',
      message: `Verifikasi dokumen Anda telah disetujui. Anda dapat melanjutkan pengajuan klaim.`
    },
    [notificationTypes.VERIFICATION_REJECTED]: {
      title: 'Verifikasi Ditolak',
      message: `Verifikasi dokumen Anda ditolak. ${data.reason || 'Silakan periksa kembali dokumen Anda.'}`
    }
  };

  return messages[type] || { title: 'Notifikasi', message: 'Ada pembaruan untuk Anda.' };
};
