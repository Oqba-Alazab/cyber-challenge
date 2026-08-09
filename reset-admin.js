const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Use the same path logic as server.js
const DATABASE_FILE = process.env.DATABASE_FILE 
  ? path.resolve(process.env.DATABASE_FILE)
  : path.join(__dirname, "database", "cyber_challenge.db");

console.log('Target Database:', DATABASE_FILE);

// Ensure directory exists
fs.mkdirSync(path.dirname(DATABASE_FILE), { recursive: true });

const db = new sqlite3.Database(DATABASE_FILE);

db.serialize(() => {
  console.log('1. Preparing admin table...');
  db.run(`DROP TABLE IF EXISTS admin_users`);
  db.run(`
    CREATE TABLE admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  console.log('2. Creating fresh admin account...');
  const username = 'admin';
  const password = 'admin123';
  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
  const createdAt = new Date().toISOString();

  db.run(
    `INSERT INTO admin_users (username, password_hash, created_at) VALUES (?, ?, ?)`,
    [username, passwordHash, createdAt],
    function (err) {
      if (err) {
        console.error('❌ Error creating admin:', err.message);
        process.exit(1);
      }

      console.log('\n✅ SUCCESS! Admin account has been reset.');
      console.log('------------------------------------------');
      console.log('Username: ' + username);
      console.log('Password: ' + password);
      console.log('------------------------------------------');
      console.log('You can now run "npm start" and login.');
      
      db.close();
    }
  );
});
