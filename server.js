import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'your_database',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'your_password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Ekspor fungsi-fungsi yang dibutuhkan
export const initDatabase = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL database');
    client.release();
  } catch (error) {
    console.error('❌ Failed to connect to PostgreSQL:', error.message);
    throw error;
  }
};

export const closeDatabase = async () => {
  await pool.end();
  console.log('✅ Database connections closed');
};

export const getDb = () => pool;
export const getOne = async (sql, params = []) => {
  const result = await pool.query(sql, params);
  return result.rows[0] || null;
};
export const run = async (sql, params = []) => {
  return await pool.query(sql, params);
};
