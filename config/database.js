import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Gunakan connection string dari environment variables untuk cloud deployments
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Gunakan DATABASE_URL dari Railway
  ssl: {
    rejectUnauthorized: false, // Pastikan SSL diaktifkan untuk koneksi ke cloud
  },
  max: 20, // Jumlah maksimum klien di pool
  idleTimeoutMillis: 30000, // Tutup koneksi idle setelah 30 detik
  connectionTimeoutMillis: 2000, // Timeout setelah 2 detik jika koneksi gagal
});

// Tes koneksi database
export const initDatabase = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL database');
    client.release();
    return pool;
  } catch (error) {
    console.error('❌ Failed to connect to PostgreSQL:', error.message);
    throw error;
  }
};

// Export fungsi lain seperti getDb, getOne, dll sesuai kebutuhan
export const getDb = () => pool;

export default { 
  initDatabase, 
  getDb 
};
