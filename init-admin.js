const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const DATABASE_FILE = path.resolve(process.env.DATABASE_FILE || './database/cyber_challenge.db');

fs.mkdirSync(path.dirname(DATABASE_FILE), { recursive: true });

const db = new sqlite3.Database(DATABASE_FILE);

db.serialize(() => {
  // Create admin_users table if it doesn't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  // Check if admin user already exists
  db.get(`SELECT id FROM admin_users WHERE username = 'admin'`, (err, row) => {
    if (err) {
      console.error('Error checking admin user:', err);
      process.exit(1);
    }

    if (row) {
      console.log('✓ Admin user already exists');
      db.close();
      process.exit(0);
    }

    // Create default admin user
    const passwordHash = crypto.createHash('sha256').update('admin123').digest('hex');
    const createdAt = new Date().toISOString();

    db.run(
      `INSERT INTO admin_users (username, password_hash, created_at) VALUES (?, ?, ?)`,
      ['admin', passwordHash, createdAt],
      function (err) {
        if (err) {
          console.error('Error creating admin user:', err);
          process.exit(1);
        }

        console.log('✓ Admin user created successfully');
        console.log('');
        console.log('Default Admin Credentials:');
        console.log('Username: admin');
        console.log('Password: admin123');
        console.log('');
        console.log('⚠️  Please change the password after first login!');
        console.log('');

        db.close();
        process.exit(0);
      }
    );
  });
});
