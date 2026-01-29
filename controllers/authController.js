import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getOne, run } from '../config/database.js';

const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

export const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Validasi field wajib (email sekarang opsional)
    if (!name || !password || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Nama, No. Telepon, dan password wajib diisi'
      });
    }

    // Validasi format No. Telepon
    const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,10}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Format No. Telepon tidak valid'
      });
    }

    // Validasi password yang lebih ketat
    if (!/^[A-Z]/.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password harus diawali dengan huruf kapital'
      });
    }

    if (!/[a-zA-Z]/.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password harus mengandung huruf'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password minimal 6 karakter'
      });
    }

    if (password.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Password maksimal 10 karakter'
      });
    }

    // Cek jika email sudah terdaftar (hanya jika email diisi)
    if (email) {
      const existingUserByEmail = await getOne('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUserByEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email sudah terdaftar'
        });
      }
    }

    // Cek jika No. Telepon sudah terdaftar
    const existingUserByPhone = await getOne('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existingUserByPhone) {
      return res.status(400).json({
        success: false,
        message: 'No. Telepon sudah terdaftar'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert and return the new user
    const result = await run(
      `INSERT INTO users (name, email, password, phone, role) 
       VALUES ($1, $2, $3, $4, 'user') 
       RETURNING id, name, email, phone, role`,
      [name, email || null, hashedPassword, phone]
    );

    const user = result.rows[0];
    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil',
      data: { user, token }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};

export const login = async (req, res) => {
  try {
    const { identifier, password, email } = req.body;
    
    // Support both old (email) and new (identifier) format
    const loginIdentifier = identifier || email;

    if (!loginIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email/No. Telepon dan password wajib diisi'
      });
    }

    // Cek apakah identifier adalah email atau nomor telepon
    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,10}$/;
    
    let user;
    
    if (emailRegex.test(loginIdentifier)) {
      // Login dengan email
      user = await getOne('SELECT * FROM users WHERE email = $1', [loginIdentifier]);
    } else if (phoneRegex.test(loginIdentifier)) {
      // Login dengan nomor telepon
      user = await getOne('SELECT * FROM users WHERE phone = $1', [loginIdentifier]);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Format email atau nomor telepon tidak valid'
      });
    }
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Akun tidak ditemukan'
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Password salah'
      });
    }

    const token = generateToken(user.id);
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login berhasil',
      data: { user: userWithoutPassword, token }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await getOne(
      'SELECT id, name, email, phone, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan'
      });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    
    const result = await run(
      'UPDATE users SET name = $1, phone = $2 WHERE id = $3 RETURNING id, name, email, phone, role, created_at',
      [name, phone, req.user.id]
    );

    const user = result.rows[0];

    res.json({
      success: true,
      message: 'Profil berhasil diperbarui',
      data: user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Password lama dan baru wajib diisi'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password baru minimal 6 karakter'
      });
    }

    const user = await getOne('SELECT password FROM users WHERE id = $1', [req.user.id]);
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: 'Password lama tidak sesuai'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await run(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, req.user.id]
    );

    res.json({
      success: true,
      message: 'Password berhasil diubah'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};
