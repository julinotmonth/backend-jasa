# Jasa Raharja SAMSAT Backend - PostgreSQL Version

Backend API untuk sistem klaim Jasa Raharja SAMSAT menggunakan PostgreSQL.

## 🔄 Migrasi dari SQLite ke PostgreSQL

Versi ini telah dimigrasi dari SQLite ke PostgreSQL dengan perubahan utama:

### Perubahan Konfigurasi
- Mengganti `sql.js` dengan `pg` (node-postgres)
- Menggunakan connection pool untuk performa lebih baik
- Mendukung environment variables untuk konfigurasi database

### Perubahan Syntax SQL
| SQLite | PostgreSQL |
|--------|------------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` |
| `DATETIME` | `TIMESTAMP` |
| `TEXT` untuk JSON | `JSONB` untuk JSON data |
| `?` placeholder | `$1, $2, $3...` placeholder |
| `LIKE` (case-sensitive) | `ILIKE` (case-insensitive) |

### Perubahan Kode
- Semua query sekarang async/await (sebelumnya synchronous)
- Helper functions (`getOne`, `getAll`, `run`) sekarang return Promise
- Trigger untuk auto-update `updated_at` timestamp

## 📋 Prerequisites

- Node.js >= 18.x
- PostgreSQL >= 13.x
- npm atau yarn

## 🚀 Installation

### 1. Clone dan Install Dependencies

```bash
cd backend-postgres
npm install
```

### 2. Setup PostgreSQL Database

```sql
-- Login ke PostgreSQL
psql -U postgres

-- Buat database baru
CREATE DATABASE jasa_raharja_db;

-- (Opsional) Buat user khusus
CREATE USER jasaraharja WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE jasa_raharja_db TO jasaraharja;
```

### 3. Konfigurasi Environment Variables

Salin file `.env` dan sesuaikan:

```bash
cp .env .env.local
```

Edit `.env`:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# PostgreSQL Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jasa_raharja_db
DB_USER=postgres
DB_PASSWORD=your_password_here

# Atau gunakan DATABASE_URL untuk cloud deployment
# DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_this
JWT_EXPIRES_IN=7d

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
```

### 4. Inisialisasi Database

```bash
npm run init-db
```

Ini akan:
- Membuat semua tabel yang diperlukan
- Membuat indexes untuk performa
- Membuat trigger untuk auto-update timestamp
- Membuat user admin dan sample user

### 5. Jalankan Server

```bash
# Development dengan hot reload
npm run dev

# Production
npm start
```

## 📁 Struktur Folder

```
backend-postgres/
├── config/
│   ├── database.js      # PostgreSQL connection & helpers
│   ├── initDb.js        # Database initialization script
│   └── migrations.js    # Migration system
├── controllers/
│   ├── authController.js
│   ├── claimController.js
│   ├── notificationController.js
│   ├── statsController.js
│   └── verificationController.js
├── middleware/
│   ├── auth.js          # JWT authentication
│   └── upload.js        # File upload handler
├── routes/
│   ├── auth.js
│   ├── claims.js
│   ├── notifications.js
│   ├── stats.js
│   └── verifications.js
├── uploads/             # Uploaded files
│   ├── claims/
│   └── verifications/
├── .env                 # Environment variables
├── package.json
├── server.js            # Main entry point
└── README.md
```

## 🔧 Database Schema

### Tables

#### users
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| name | VARCHAR(255) | User's full name |
| email | VARCHAR(255) | Email (unique, nullable) |
| password | VARCHAR(255) | Hashed password |
| phone | VARCHAR(20) | Phone number (unique) |
| role | VARCHAR(10) | 'user' or 'admin' |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

#### claims
| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(50) | Claim ID (KLM-YYYY-XXXX) |
| user_id | INTEGER | FK to users |
| full_name | VARCHAR(255) | Claimant name |
| nik | VARCHAR(16) | National ID |
| status | VARCHAR(20) | Claim status |
| ... | ... | (other fields) |

#### claim_documents
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| claim_id | VARCHAR(50) | FK to claims |
| document_type | VARCHAR(20) | Type of document |
| file_path | TEXT | File location |

#### notifications
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| user_id | INTEGER | FK to users |
| type | VARCHAR(50) | Notification type |
| title | VARCHAR(255) | Notification title |
| message | TEXT | Notification content |
| is_read | BOOLEAN | Read status |

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/change-password` - Change password

### Claims
- `POST /api/claims` - Create new claim
- `GET /api/claims/search/:query` - Search claim by ID or NIK
- `GET /api/claims/my-claims` - Get user's claims
- `GET /api/claims` - Get all claims (admin)
- `PUT /api/claims/:id/status` - Update claim status (admin)
- `POST /api/claims/:id/transfer-proof` - Upload transfer proof (admin)
- `DELETE /api/claims/:id` - Delete claim (admin)

### Verifications
- `POST /api/verifications` - Create verification
- `GET /api/verifications/search/:query` - Search verification
- `GET /api/verifications` - Get all verifications (admin)
- `PUT /api/verifications/:id/status` - Update status (admin)

### Stats
- `GET /api/stats/public` - Public statistics
- `GET /api/stats/dashboard` - Dashboard statistics (admin)

### Notifications
- `GET /api/notifications` - Get user's notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification

## 🔐 Default Users

Setelah inisialisasi database:

**Admin:**
- Email: admin@jasaraharja.co.id
- Phone: 081000000001
- Password: Admin123

**Sample User:**
- Email: user@example.com
- Phone: 081234567890
- Password: User1234

## 🚀 Deployment

### Heroku

```bash
# Set environment variables
heroku config:set DATABASE_URL=your_postgres_url
heroku config:set JWT_SECRET=your_secret
heroku config:set NODE_ENV=production

# Deploy
git push heroku main
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### Railway/Render

Tambahkan environment variables di dashboard dan connect ke PostgreSQL service.

## 🧪 Testing

```bash
# Health check
curl http://localhost:5000/api/health

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin@jasaraharja.co.id","password":"Admin123"}'
```

## 📝 Migration System

Untuk menambah kolom atau mengubah schema:

```bash
# Run pending migrations
npm run migrate

# Check migration status
node config/migrations.js status
```

## ⚠️ Important Notes

1. **Security**: Ganti `JWT_SECRET` di production
2. **SSL**: Gunakan `?sslmode=require` untuk koneksi database cloud
3. **Backup**: Lakukan backup database secara berkala
4. **Indexes**: Sudah dibuat untuk field yang sering di-query

## 📄 License

MIT License
