import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Create connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5000,
  database: process.env.DB_NAME || 'jasa_raharja_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  // Alternative: use DATABASE_URL for cloud deployments
  // connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

// Test database connection
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

// Get pool instance
export const getDb = () => pool;

// Helper function to get single row
export const getOne = async (sql, params = []) => {
  try {
    const result = await pool.query(sql, params);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Database getOne error:', error);
    throw error;
  }
};

// Helper function to get all rows
export const getAll = async (sql, params = []) => {
  try {
    const result = await pool.query(sql, params);
    return result.rows;
  } catch (error) {
    console.error('Database getAll error:', error);
    throw error;
  }
};

// Helper function to run a query (INSERT, UPDATE, DELETE)
export const run = async (sql, params = []) => {
  try {
    const result = await pool.query(sql, params);
    return result;
  } catch (error) {
    console.error('Database run error:', error);
    throw error;
  }
};

// Helper function to run query and return inserted/updated row
export const runReturning = async (sql, params = []) => {
  try {
    const result = await pool.query(sql, params);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Database runReturning error:', error);
    throw error;
  }
};

// Transaction helper
export const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Graceful shutdown
export const closeDatabase = async () => {
  await pool.end();
  console.log('Database pool closed');
};

export default { 
  initDatabase, 
  getDb, 
  getOne, 
  getAll, 
  run, 
  runReturning, 
  transaction,
  closeDatabase 
};
