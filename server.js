const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const sqlite3 = require("sqlite3").verbose();
const session = require("express-session");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

const DATABASE_FILE = process.env.DATABASE_FILE 
  ? path.resolve(process.env.DATABASE_FILE)
  : path.join(__dirname, "database", "cyber_challenge.db");

const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, "uploads");

fs.mkdirSync(path.dirname(DATABASE_FILE), { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.disable("x-powered-by");
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'"],
      "img-src": ["'self'", "data:", "blob:", "/uploads/"],
      "style-src": ["'self'", "'unsafe-inline'"],
    },
  },
}));

app.use(express.json({ limit: "1mb" }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'cyber-challenge-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});

app.use("/api/", apiLimiter);

const db = new sqlite3.Database(DATABASE_FILE);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_code TEXT NOT NULL UNIQUE,
      camera_permission TEXT NOT NULL,
      image_filename TEXT,
      created_at TEXT NOT NULL
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
});

const allowedMimeTypes = new Set(["image/jpeg", "image/png"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = file.mimetype === "image/png" ? ".png" : ".jpg";
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(new Error("Only JPEG and PNG images are allowed."));
    }
    cb(null, true);
  }
});

// Middleware to check admin authentication
const isAdminAuthenticated = (req, res, next) => {
  if (req.session && req.session.adminId) {
    next();
  } else {
    res.status(401).json({ success: false, message: "Unauthorized" });
  }
};

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOAD_DIR));

// Admin login endpoint
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  console.log(`Login attempt for username: ${username}`);
  
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Username and password are required."
    });
  }
  
  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
  
  db.get(
    `SELECT id, username FROM admin_users WHERE username = ? AND password_hash = ?`,
    [username, passwordHash],
    (err, row) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Database error."
        });
      }
      
      if (row) {
        console.log(`Login successful for: ${username}`);
        req.session.adminId = row.id;
        req.session.adminUsername = row.username;
        res.json({
          success: true,
          message: "Login successful."
        });
      } else {
        console.log(`Login failed for: ${username} - Invalid credentials`);
        res.status(401).json({
          success: false,
          message: "Invalid username or password."
        });
      }
    }
  );
});

// Admin logout endpoint
app.post("/api/admin/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Could not logout."
      });
    }
    res.json({
      success: true,
      message: "Logged out successfully."
    });
  });
});

// Check admin authentication status
app.get("/api/admin/status", (req, res) => {
  if (req.session && req.session.adminId) {
    res.json({
      success: true,
      authenticated: true,
      username: req.session.adminUsername
    });
  } else {
    res.json({
      success: true,
      authenticated: false
    });
  }
});

// Get all participants (admin only)
app.get("/api/admin/participants", isAdminAuthenticated, (req, res) => {
  db.all(
    `SELECT id, participant_code, camera_permission, image_filename, created_at FROM participants ORDER BY created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Could not fetch participants."
        });
      }
      res.json({
        success: true,
        participants: rows || []
      });
    }
  );
});

// Delete all participants (admin only)
app.delete("/api/admin/participants", isAdminAuthenticated, (req, res) => {
  db.all(
    `SELECT image_filename FROM participants`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Could not fetch participants."
        });
      }

      if (rows && rows.length > 0) {
        for (const row of rows) {
          if (row.image_filename) {
            fs.unlink(path.join(UPLOAD_DIR, row.image_filename), () => {});
          }
        }
      }

      db.run(
        `DELETE FROM participants`,
        function (err) {
          if (err) {
            return res.status(500).json({
              success: false,
              message: "Could not delete all participants."
            });
          }
          res.json({
            success: true,
            message: "All participants deleted.",
            deletedCount: rows ? rows.length : 0
          });
        }
      );
    }
  );
});

// Delete participant (admin only)
app.delete("/api/admin/participants/:id", isAdminAuthenticated, (req, res) => {
  const { id } = req.params;
  
  db.get(
    `SELECT image_filename FROM participants WHERE id = ?`,
    [id],
    (err, row) => {
      if (err || !row) {
        return res.status(404).json({
          success: false,
          message: "Participant not found."
        });
      }
      
      if (row.image_filename) {
        fs.unlink(path.join(UPLOAD_DIR, row.image_filename), () => {});
      }
      
      db.run(
        `DELETE FROM participants WHERE id = ?`,
        [id],
        function (err) {
          if (err) {
            return res.status(500).json({
              success: false,
              message: "Could not delete participant."
            });
          }
          res.json({
            success: true,
            message: "Participant deleted."
          });
        }
      );
    }
  );
});

app.get("/api/status", (_req, res) => {
  res.json({
    success: true,
    service: "Cyber Challenge 2026",
    time: new Date().toISOString()
  });
});

app.post("/api/participants", upload.single("photo"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No photo was received."
    });
  }

  const cameraPermission = String(req.body.cameraPermission || "");

  if (cameraPermission !== "granted") {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({
      success: false,
      message: "Camera permission was not recorded as granted."
    });
  }

  const participantCode =
    `CH-${new Date().getFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

  const createdAt = new Date().toISOString();

  db.run(
    `INSERT INTO participants
      (participant_code, camera_permission, image_filename, created_at)
     VALUES (?, ?, ?, ?)`,
    [
      participantCode,
      cameraPermission,
      req.file.filename,
      createdAt
    ],
    function (err) {
      if (err) {
        fs.unlink(req.file.path, () => {});
        console.error(err);
        return res.status(500).json({
          success: false,
          message: "Could not save participation."
        });
      }

      res.json({
        success: true,
        participantCode,
        createdAt
      });
    }
  );
});

app.get("/api/stats", (_req, res) => {
  db.get(
    `SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN camera_permission = 'granted' THEN 1 ELSE 0 END) AS granted
     FROM participants`,
    [],
    (err, row) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Could not read statistics."
        });
      }

      res.json({
        success: true,
        total: row.total || 0,
        granted: row.granted || 0
      });
    }
  );
});

app.get("/success", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "success.html"));
});

app.get("/awareness", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "awareness.html"));
});

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.use((err, _req, res, _next) => {
  console.error(err);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  res.status(400).json({
    success: false,
    message: err.message || "Unexpected error."
  });
});

app.listen(PORT, () => {
  console.log("");
  console.log("======================================");
  console.log(" Cyber Challenge 2026");
  console.log("======================================");
  console.log(`Local: http://localhost:${PORT}`);
  console.log("");
});
