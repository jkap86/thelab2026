const path = require("path");
const pkg = require("pg");
const fs = require("fs");
const dotenv = require("dotenv");

const { Client } = pkg;

dotenv.config({ path: ".env.local" });

const ssl =
  process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl,
});

async function initializeDatabase() {
  try {
    await client.connect();
    console.log("Connected to database");

    const migrationsDir = path.join(process.cwd(), "db", "migrations");
    const migrationFiles = fs.readdirSync(migrationsDir);

    for (const file of migrationFiles) {
      if (file.endsWith(".sql")) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
        await client.query(sql);
      }
    }

    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Error initializing database", error);
    process.exit(1);
  } finally {
    await client.end();
    console.log("Database connection closed");
  }
}

initializeDatabase();
