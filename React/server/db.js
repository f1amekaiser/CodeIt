const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Initialize database tables
const initDB = async () => {
  try {
    // Create users table
    await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

    // Create rooms table
    await pool.query(`
            CREATE TABLE IF NOT EXISTS rooms (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

      await pool.query(`
          CREATE TABLE IF NOT EXISTS room_members (
            room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            role VARCHAR(20) NOT NULL DEFAULT 'member',
            can_edit BOOLEAN NOT NULL DEFAULT TRUE,
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (room_id, user_id),
            CHECK (role IN ('owner', 'admin', 'member'))
          )
        `);

      await pool.query(`
          CREATE TABLE IF NOT EXISTS room_code_labels (
            id SERIAL PRIMARY KEY,
            room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
            label VARCHAR(100) NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            start_line INTEGER NOT NULL,
            end_line INTEGER NOT NULL,
            code TEXT NOT NULL,
            created_by INTEGER REFERENCES users(id),
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CHECK (start_line > 0 AND end_line >= start_line),
            UNIQUE (room_id, label)
          )
        `);

      await pool.query(`
          INSERT INTO room_members (room_id, user_id, role, can_edit)
          SELECT id, created_by, 'owner', TRUE FROM rooms
          WHERE created_by IS NOT NULL
          ON CONFLICT (room_id, user_id) DO NOTHING
        `);

    console.log("Database tables initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
};

module.exports = { pool, initDB };
