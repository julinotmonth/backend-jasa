import { initDatabase, getDb, getOne, run, getAll } from './database.js';
import dotenv from 'dotenv';

dotenv.config();

// Migration tracking table
const createMigrationsTable = async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

// Check if migration has been executed
const isMigrationExecuted = async (name) => {
  const result = await getOne('SELECT id FROM migrations WHERE name = $1', [name]);
  return !!result;
};

// Mark migration as executed
const markMigrationExecuted = async (name) => {
  await run('INSERT INTO migrations (name) VALUES ($1)', [name]);
};

// Define migrations
const migrations = [
  {
    name: '001_initial_schema',
    up: async () => {
      // This is handled by initDb.js
      console.log('Initial schema - handled by initDb.js');
    }
  },
  {
    name: '002_add_transfer_columns',
    up: async () => {
      // Add transfer-related columns if they don't exist
      const columnsToAdd = [
        { name: 'transfer_proof_path', type: 'TEXT' },
        { name: 'transfer_amount', type: 'DECIMAL(15, 2)' },
        { name: 'transfer_date', type: 'DATE' },
        { name: 'transfer_notes', type: 'TEXT' }
      ];

      for (const column of columnsToAdd) {
        try {
          const exists = await getOne(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'claims' AND column_name = $1
          `, [column.name]);

          if (!exists) {
            await run(`ALTER TABLE claims ADD COLUMN ${column.name} ${column.type}`);
            console.log(`  Added column: ${column.name}`);
          }
        } catch (error) {
          console.log(`  Column ${column.name} might already exist`);
        }
      }
    }
  },
  {
    name: '003_add_bank_columns',
    up: async () => {
      const columnsToAdd = [
        { name: 'bank_name', type: 'VARCHAR(100)' },
        { name: 'bank_branch', type: 'VARCHAR(100)' },
        { name: 'account_number', type: 'VARCHAR(50)' },
        { name: 'account_holder_name', type: 'VARCHAR(255)' }
      ];

      for (const column of columnsToAdd) {
        try {
          const exists = await getOne(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'claims' AND column_name = $1
          `, [column.name]);

          if (!exists) {
            await run(`ALTER TABLE claims ADD COLUMN ${column.name} ${column.type}`);
            console.log(`  Added column: ${column.name}`);
          }
        } catch (error) {
          console.log(`  Column ${column.name} might already exist`);
        }
      }
    }
  },
  {
    name: '004_add_medical_columns',
    up: async () => {
      const columnsToAdd = [
        { name: 'hospital_name', type: 'VARCHAR(255)' },
        { name: 'treatment_description', type: 'TEXT' },
        { name: 'estimated_cost', type: 'DECIMAL(15, 2)' }
      ];

      for (const column of columnsToAdd) {
        try {
          const exists = await getOne(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'claims' AND column_name = $1
          `, [column.name]);

          if (!exists) {
            await run(`ALTER TABLE claims ADD COLUMN ${column.name} ${column.type}`);
            console.log(`  Added column: ${column.name}`);
          }
        } catch (error) {
          console.log(`  Column ${column.name} might already exist`);
        }
      }
    }
  }
];

// Run all pending migrations
const runMigrations = async () => {
  console.log('🔄 Running database migrations...');
  console.log('');

  try {
    await initDatabase();
    await createMigrationsTable();

    let executedCount = 0;

    for (const migration of migrations) {
      const executed = await isMigrationExecuted(migration.name);
      
      if (!executed) {
        console.log(`📦 Running migration: ${migration.name}`);
        await migration.up();
        await markMigrationExecuted(migration.name);
        executedCount++;
        console.log(`✅ Migration ${migration.name} completed`);
        console.log('');
      }
    }

    if (executedCount === 0) {
      console.log('ℹ️  No pending migrations');
    } else {
      console.log(`✅ ${executedCount} migration(s) executed successfully`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

// Show migration status
const showStatus = async () => {
  try {
    await initDatabase();
    await createMigrationsTable();

    console.log('📋 Migration Status:');
    console.log('');

    for (const migration of migrations) {
      const executed = await isMigrationExecuted(migration.name);
      const status = executed ? '✅' : '⏳';
      console.log(`${status} ${migration.name}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

// CLI handling
const command = process.argv[2];

if (command === 'status') {
  showStatus();
} else {
  runMigrations();
}
