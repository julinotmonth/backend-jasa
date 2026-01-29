import { initDatabase, getDb, getOne, run } from './database.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const init = async () => {
  console.log('🔧 Initializing PostgreSQL database...');

  try {
    await initDatabase();
    const pool = getDb();

    // Create Users table
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(20) UNIQUE NOT NULL,
        role VARCHAR(10) DEFAULT 'user' CHECK(role IN ('user', 'admin')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table created');

    // Create Claims table
    await run(`
      CREATE TABLE IF NOT EXISTS claims (
        id VARCHAR(50) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        full_name VARCHAR(255) NOT NULL,
        nik VARCHAR(16) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        address TEXT NOT NULL,
        incident_date DATE NOT NULL,
        incident_time VARCHAR(10),
        incident_location TEXT NOT NULL,
        incident_description TEXT NOT NULL,
        vehicle_type VARCHAR(100),
        vehicle_number VARCHAR(20),
        bank_name VARCHAR(100),
        bank_branch VARCHAR(100),
        account_number VARCHAR(50),
        account_holder_name VARCHAR(255),
        hospital_name VARCHAR(255),
        treatment_description TEXT,
        estimated_cost DECIMAL(15, 2),
        transfer_proof_path TEXT,
        transfer_amount DECIMAL(15, 2),
        transfer_date DATE,
        transfer_notes TEXT,
        status VARCHAR(20) DEFAULT 'pending' CHECK(status IN ('pending', 'verified', 'processing', 'approved', 'rejected', 'completed')),
        admin_notes TEXT,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Claims table created');

    // Create Claim Documents table
    await run(`
      CREATE TABLE IF NOT EXISTS claim_documents (
        id SERIAL PRIMARY KEY,
        claim_id VARCHAR(50) NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
        document_type VARCHAR(20) NOT NULL CHECK(document_type IN ('ktp', 'police_report', 'stnk', 'medical_report', 'bank_book')),
        file_name VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        mime_type VARCHAR(100),
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Claim Documents table created');

    // Create Claim Timeline table
    await run(`
      CREATE TABLE IF NOT EXISTS claim_timeline (
        id SERIAL PRIMARY KEY,
        claim_id VARCHAR(50) NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Claim Timeline table created');

    // Create Verifications table
    await run(`
      CREATE TABLE IF NOT EXISTS verifications (
        id VARCHAR(50) PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        nik VARCHAR(16) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        email VARCHAR(255),
        status VARCHAR(20) DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
        pre_check_results JSONB,
        admin_notes TEXT,
        reviewed_by VARCHAR(255),
        reviewed_at TIMESTAMP,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Verifications table created');

    // Create Verification Documents table
    await run(`
      CREATE TABLE IF NOT EXISTS verification_documents (
        id SERIAL PRIMARY KEY,
        verification_id VARCHAR(50) NOT NULL REFERENCES verifications(id) ON DELETE CASCADE,
        document_type VARCHAR(20) NOT NULL CHECK(document_type IN ('ktp', 'police_report', 'stnk', 'medical_report')),
        file_name VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        mime_type VARCHAR(100),
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Verification Documents table created');

    // Create Notifications table
    await run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        reference_id VARCHAR(50),
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Notifications table created');

    // Create indexes for better performance
    await run(`CREATE INDEX IF NOT EXISTS idx_claims_user_id ON claims(user_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_claims_nik ON claims(nik)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_claims_submitted_at ON claims(submitted_at DESC)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_verifications_status ON verifications(status)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_verifications_nik ON verifications(nik)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_claim_documents_claim_id ON claim_documents(claim_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_verification_documents_verification_id ON verification_documents(verification_id)`);
    console.log('✅ Indexes created');

    // Create function for auto-updating updated_at timestamp
    await run(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    // Create triggers for auto-updating updated_at
    const tables = ['users', 'claims', 'verifications'];
    for (const table of tables) {
      await run(`
        DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table}
      `);
      await run(`
        CREATE TRIGGER update_${table}_updated_at
        BEFORE UPDATE ON ${table}
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
      `);
    }
    console.log('✅ Triggers created for auto-updating timestamps');

    // Insert default admin user
    const existingAdmin = await getOne(
      'SELECT id FROM users WHERE email = $1 OR phone = $2',
      ['admin@jasaraharja.co.id', '081000000001']
    );

    if (!existingAdmin) {
      const adminPassword = await bcrypt.hash('Admin123', 10);
      await run(
        'INSERT INTO users (name, email, password, phone, role) VALUES ($1, $2, $3, $4, $5)',
        ['Administrator', 'admin@jasaraharja.co.id', adminPassword, '081000000001', 'admin']
      );
      console.log('✅ Admin user created (email: admin@jasaraharja.co.id, phone: 081000000001, password: Admin123)');
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    // Insert sample user
    const existingUser = await getOne(
      'SELECT id FROM users WHERE email = $1 OR phone = $2',
      ['user@example.com', '081234567890']
    );

    if (!existingUser) {
      const userPassword = await bcrypt.hash('User1234', 10);
      await run(
        'INSERT INTO users (name, email, password, phone, role) VALUES ($1, $2, $3, $4, $5)',
        ['John Doe', 'user@example.com', userPassword, '081234567890', 'user']
      );
      console.log('✅ Sample user created (email: user@example.com, phone: 081234567890, password: User1234)');
    } else {
      console.log('ℹ️  Sample user already exists');
    }

    console.log('');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║  ✅ PostgreSQL Database initialized successfully!      ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
};

init();
