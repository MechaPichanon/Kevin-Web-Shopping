const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "bos_butter",
  password: "bosbutter@db",
  port: 5432,
});

module.exports = pool;
