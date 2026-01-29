/**
 * Data Migration Script: SQLite to PostgreSQL
 * 
 * Gunakan script ini untuk memindahkan data dari database SQLite lama
 * ke database PostgreSQL baru.
 * 
 * Usage:
 *   1. Pastikan PostgreSQL sudah disetup dan initDb sudah dijalankan
 *   2. Copy file database.sqlite ke folder ini
 *   3. Jalankan: node config/dataMigration.js
 */

import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// PostgreSQL connection
const pgPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'jasa_raharja_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

// Helper to get all rows from SQLite
const getAllFromSqlite = (db, sql) => {
  const stmt = db.prepare(sql);
  const results = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();
  return results;
};

const migrateData = async () => {
  console.log('🔄 Starting data migration from SQLite to PostgreSQL...\n');

  // Check if SQLite database exists
  const sqlitePath = path.join(__dirname, '..', 'database.sqlite');
  if (!fs.existsSync(sqlitePath)) {
    console.log('⚠️  SQLite database not found at:', sqlitePath);
    console.log('   Copy your database.sqlite file to this location first.');
    process.exit(1);
  }

  try {
    // Initialize SQLite
    const SQL = await initSqlJs();
    const fileBuffer = fs.readFileSync(sqlitePath);
    const sqliteDb = new SQL.Database(fileBuffer);
    console.log('✅ Connected to SQLite database');

    // Test PostgreSQL connection
    await pgPool.query('SELECT 1');
    console.log('✅ Connected to PostgreSQL database\n');

    // Migrate Users
    console.log('📦 Migrating users...');
    const users = getAllFromSqlite(sqliteDb, 'SELECT * FROM users');
    for (const user of users) {
      try {
        await pgPool.query(`
          INSERT INTO users (id, name, email, password, phone, role, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO NOTHING
        `, [
          user.id,
          user.name,
          user.email,
          user.password,
          user.phone,
          user.role || 'user',
          user.created_at,
          user.updated_at
        ]);
      } catch (err) {
        console.log(`   ⚠️ Skipped user ${user.id}: ${err.message}`);
      }
    }
    // Reset sequence
    await pgPool.query(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`);
    console.log(`   ✅ Migrated ${users.length} users`);

    // Migrate Claims
    console.log('📦 Migrating claims...');
    const claims = getAllFromSqlite(sqliteDb, 'SELECT * FROM claims');
    for (const claim of claims) {
      try {
        await pgPool.query(`
          INSERT INTO claims (
            id, user_id, full_name, nik, phone, address,
            incident_date, incident_time, incident_location, incident_description,
            vehicle_type, vehicle_number, bank_name, bank_branch, account_number,
            account_holder_name, hospital_name, treatment_description, estimated_cost,
            transfer_proof_path, transfer_amount, transfer_date, transfer_notes,
            status, admin_notes, submitted_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
          ON CONFLICT (id) DO NOTHING
        `, [
          claim.id, claim.user_id, claim.full_name, claim.nik, claim.phone, claim.address,
          claim.incident_date, claim.incident_time, claim.incident_location, claim.incident_description,
          claim.vehicle_type, claim.vehicle_number, claim.bank_name, claim.bank_branch, claim.account_number,
          claim.account_holder_name, claim.hospital_name, claim.treatment_description, claim.estimated_cost,
          claim.transfer_proof_path, claim.transfer_amount, claim.transfer_date, claim.transfer_notes,
          claim.status, claim.admin_notes, claim.submitted_at, claim.updated_at
        ]);
      } catch (err) {
        console.log(`   ⚠️ Skipped claim ${claim.id}: ${err.message}`);
      }
    }
    console.log(`   ✅ Migrated ${claims.length} claims`);

    // Migrate Claim Documents
    console.log('📦 Migrating claim documents...');
    const claimDocs = getAllFromSqlite(sqliteDb, 'SELECT * FROM claim_documents');
    for (const doc of claimDocs) {
      try {
        await pgPool.query(`
          INSERT INTO claim_documents (id, claim_id, document_type, file_name, file_path, file_size, mime_type, uploaded_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO NOTHING
        `, [doc.id, doc.claim_id, doc.document_type, doc.file_name, doc.file_path, doc.file_size, doc.mime_type, doc.uploaded_at]);
      } catch (err) {
        console.log(`   ⚠️ Skipped claim_document ${doc.id}: ${err.message}`);
      }
    }
    await pgPool.query(`SELECT setval('claim_documents_id_seq', COALESCE((SELECT MAX(id) FROM claim_documents), 1))`);
    console.log(`   ✅ Migrated ${claimDocs.length} claim documents`);

    // Migrate Claim Timeline
    console.log('📦 Migrating claim timeline...');
    const timeline = getAllFromSqlite(sqliteDb, 'SELECT * FROM claim_timeline');
    for (const entry of timeline) {
      try {
        await pgPool.query(`
          INSERT INTO claim_timeline (id, claim_id, status, description, created_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO NOTHING
        `, [entry.id, entry.claim_id, entry.status, entry.description, entry.created_at]);
      } catch (err) {
        console.log(`   ⚠️ Skipped timeline ${entry.id}: ${err.message}`);
      }
    }
    await pgPool.query(`SELECT setval('claim_timeline_id_seq', COALESCE((SELECT MAX(id) FROM claim_timeline), 1))`);
    console.log(`   ✅ Migrated ${timeline.length} timeline entries`);

    // Migrate Verifications
    console.log('📦 Migrating verifications...');
    const verifications = getAllFromSqlite(sqliteDb, 'SELECT * FROM verifications');
    for (const ver of verifications) {
      try {
        await pgPool.query(`
          INSERT INTO verifications (
            id, full_name, nik, phone, email, status, pre_check_results,
            admin_notes, reviewed_by, reviewed_at, submitted_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          ON CONFLICT (id) DO NOTHING
        `, [
          ver.id, ver.full_name, ver.nik, ver.phone, ver.email, ver.status,
          ver.pre_check_results, ver.admin_notes, ver.reviewed_by, ver.reviewed_at,
          ver.submitted_at, ver.updated_at
        ]);
      } catch (err) {
        console.log(`   ⚠️ Skipped verification ${ver.id}: ${err.message}`);
      }
    }
    console.log(`   ✅ Migrated ${verifications.length} verifications`);

    // Migrate Verification Documents
    console.log('📦 Migrating verification documents...');
    const verDocs = getAllFromSqlite(sqliteDb, 'SELECT * FROM verification_documents');
    for (const doc of verDocs) {
      try {
        await pgPool.query(`
          INSERT INTO verification_documents (id, verification_id, document_type, file_name, file_path, file_size, mime_type, uploaded_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO NOTHING
        `, [doc.id, doc.verification_id, doc.document_type, doc.file_name, doc.file_path, doc.file_size, doc.mime_type, doc.uploaded_at]);
      } catch (err) {
        console.log(`   ⚠️ Skipped verification_document ${doc.id}: ${err.message}`);
      }
    }
    await pgPool.query(`SELECT setval('verification_documents_id_seq', COALESCE((SELECT MAX(id) FROM verification_documents), 1))`);
    console.log(`   ✅ Migrated ${verDocs.length} verification documents`);

    // Migrate Notifications
    console.log('📦 Migrating notifications...');
    const notifications = getAllFromSqlite(sqliteDb, 'SELECT * FROM notifications');
    for (const notif of notifications) {
      try {
        await pgPool.query(`
          INSERT INTO notifications (id, user_id, type, title, message, reference_id, is_read, read_at, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO NOTHING
        `, [
          notif.id, notif.user_id, notif.type, notif.title, notif.message,
          notif.reference_id, notif.is_read === 1, notif.read_at, notif.created_at
        ]);
      } catch (err) {
        console.log(`   ⚠️ Skipped notification ${notif.id}: ${err.message}`);
      }
    }
    await pgPool.query(`SELECT setval('notifications_id_seq', COALESCE((SELECT MAX(id) FROM notifications), 1))`);
    console.log(`   ✅ Migrated ${notifications.length} notifications`);

    console.log('\n════════════════════════════════════════════════════');
    console.log('✅ Data migration completed successfully!');
    console.log('════════════════════════════════════════════════════');
    console.log('\nSummary:');
    console.log(`  - Users: ${users.length}`);
    console.log(`  - Claims: ${claims.length}`);
    console.log(`  - Claim Documents: ${claimDocs.length}`);
    console.log(`  - Claim Timeline: ${timeline.length}`);
    console.log(`  - Verifications: ${verifications.length}`);
    console.log(`  - Verification Documents: ${verDocs.length}`);
    console.log(`  - Notifications: ${notifications.length}`);
    console.log('\n⚠️  Note: Make sure to also copy the uploads folder!');

    sqliteDb.close();
    await pgPool.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
};

migrateData();
