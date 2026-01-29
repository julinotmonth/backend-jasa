import { getOne, getAll } from '../config/database.js';

// Public stats (for homepage)
export const getPublicStats = async (req, res) => {
  try {
    const totalClaims = await getOne('SELECT COUNT(*) as count FROM claims');
    const approvedClaims = await getOne("SELECT COUNT(*) as count FROM claims WHERE status = 'approved' OR status = 'completed'");
    const totalVerifications = await getOne('SELECT COUNT(*) as count FROM verifications');
    const totalUsers = await getOne("SELECT COUNT(*) as count FROM users WHERE role = 'user'");

    res.json({
      success: true,
      data: {
        totalClaims: parseInt(totalClaims?.count) || 0,
        approvedClaims: parseInt(approvedClaims?.count) || 0,
        totalVerifications: parseInt(totalVerifications?.count) || 0,
        totalUsers: parseInt(totalUsers?.count) || 0
      }
    });
  } catch (error) {
    console.error('Get public stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};

// Dashboard stats (for admin)
export const getDashboardStats = async (req, res) => {
  try {
    // Claims statistics
    const totalClaims = await getOne('SELECT COUNT(*) as count FROM claims');
    const pendingClaims = await getOne("SELECT COUNT(*) as count FROM claims WHERE status = 'pending'");
    const verifiedClaims = await getOne("SELECT COUNT(*) as count FROM claims WHERE status = 'verified'");
    const processingClaims = await getOne("SELECT COUNT(*) as count FROM claims WHERE status = 'processing'");
    const approvedClaims = await getOne("SELECT COUNT(*) as count FROM claims WHERE status = 'approved'");
    const rejectedClaims = await getOne("SELECT COUNT(*) as count FROM claims WHERE status = 'rejected'");
    const completedClaims = await getOne("SELECT COUNT(*) as count FROM claims WHERE status = 'completed'");

    // Verifications statistics
    const totalVerifications = await getOne('SELECT COUNT(*) as count FROM verifications');
    const pendingVerifications = await getOne("SELECT COUNT(*) as count FROM verifications WHERE status = 'pending'");
    const approvedVerifications = await getOne("SELECT COUNT(*) as count FROM verifications WHERE status = 'approved'");
    const rejectedVerifications = await getOne("SELECT COUNT(*) as count FROM verifications WHERE status = 'rejected'");

    // Users statistics
    const totalUsers = await getOne("SELECT COUNT(*) as count FROM users WHERE role = 'user'");
    const totalAdmins = await getOne("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");

    // Today's statistics
    const todaysClaims = await getOne(`
      SELECT COUNT(*) as count FROM claims 
      WHERE DATE(submitted_at) = CURRENT_DATE
    `);
    const todaysVerifications = await getOne(`
      SELECT COUNT(*) as count FROM verifications 
      WHERE DATE(submitted_at) = CURRENT_DATE
    `);

    // This week's statistics
    const weeksClaims = await getOne(`
      SELECT COUNT(*) as count FROM claims 
      WHERE submitted_at >= CURRENT_DATE - INTERVAL '7 days'
    `);

    // This month's statistics
    const monthsClaims = await getOne(`
      SELECT COUNT(*) as count FROM claims 
      WHERE DATE_TRUNC('month', submitted_at) = DATE_TRUNC('month', CURRENT_DATE)
    `);

    // Monthly claims for chart (last 6 months)
    const monthlyData = await getAll(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', submitted_at), 'Mon') as month,
        COUNT(*) as total,
        COUNT(CASE WHEN status IN ('approved', 'completed') THEN 1 END) as approved
      FROM claims
      WHERE submitted_at >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', submitted_at)
      ORDER BY DATE_TRUNC('month', submitted_at)
    `);

    // Recent claims
    const recentClaims = await getAll(`
      SELECT id, full_name, status, submitted_at 
      FROM claims 
      ORDER BY submitted_at DESC 
      LIMIT 5
    `);

    // Recent verifications
    const recentVerifications = await getAll(`
      SELECT id, full_name, status, submitted_at 
      FROM verifications 
      ORDER BY submitted_at DESC 
      LIMIT 5
    `);

    // Total transfer amount
    const totalTransferAmount = await getOne(`
      SELECT COALESCE(SUM(transfer_amount), 0) as total FROM claims 
      WHERE status = 'completed' AND transfer_amount IS NOT NULL
    `);

    res.json({
      success: true,
      data: {
        claims: {
          total: parseInt(totalClaims?.count) || 0,
          pending: parseInt(pendingClaims?.count) || 0,
          verified: parseInt(verifiedClaims?.count) || 0,
          processing: parseInt(processingClaims?.count) || 0,
          approved: parseInt(approvedClaims?.count) || 0,
          rejected: parseInt(rejectedClaims?.count) || 0,
          completed: parseInt(completedClaims?.count) || 0
        },
        verifications: {
          total: parseInt(totalVerifications?.count) || 0,
          pending: parseInt(pendingVerifications?.count) || 0,
          approved: parseInt(approvedVerifications?.count) || 0,
          rejected: parseInt(rejectedVerifications?.count) || 0
        },
        users: {
          total: parseInt(totalUsers?.count) || 0,
          admins: parseInt(totalAdmins?.count) || 0
        },
        today: {
          claims: parseInt(todaysClaims?.count) || 0,
          verifications: parseInt(todaysVerifications?.count) || 0
        },
        thisWeek: {
          claims: parseInt(weeksClaims?.count) || 0
        },
        thisMonth: {
          claims: parseInt(monthsClaims?.count) || 0
        },
        monthlyData: monthlyData.map(row => ({
          month: row.month,
          total: parseInt(row.total) || 0,
          approved: parseInt(row.approved) || 0
        })),
        recentClaims,
        recentVerifications,
        totalTransferAmount: parseFloat(totalTransferAmount?.total) || 0
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};
