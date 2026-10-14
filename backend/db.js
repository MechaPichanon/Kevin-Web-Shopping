const { Pool } = require("pg");

const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME,
    };

// Max open DB connections. pg's default is 10; on Supabase Free the pooler
// allows 15 in total, shared with the chatbot (5) and any script, so the
// deployed server sets DB_POOL_MAX lower (e.g. 6). Unset locally → 10 as before.
poolConfig.max = Number(process.env.DB_POOL_MAX) || 10;

const pool = new Pool(poolConfig);

module.exports = pool;
