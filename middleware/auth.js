import jwt from 'jsonwebtoken';
import { getOne } from '../config/database.js';

// Verify JWT Token
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token tidak ditemukan. Silakan login terlebih dahulu.' 
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await getOne('SELECT id, name, email, role FROM users WHERE id = $1', [decoded.userId]);
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User tidak ditemukan.' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token telah kadaluarsa. Silakan login kembali.' 
      });
    }
    return res.status(401).json({ 
      success: false, 
      message: 'Token tidak valid.' 
    });
  }
};

// Check if user is admin
export const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Akses ditolak. Anda bukan admin.' 
    });
  }
  next();
};

// Optional authentication
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await getOne('SELECT id, name, email, role FROM users WHERE id = $1', [decoded.userId]);
      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    next();
  }
};
