/**
 * Creates all tables (if missing) and seeds default data.
 * Runs automatically on server start; can also be run with `npm run db:init`.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { query, pool } = require('../config/db');
const statements = require('./schema');
const seed = require('./seed');

async function initDatabase() {
  for (const sql of statements) {
    await query(sql);
  }
  await seed();
}

if (require.main === module) {
  initDatabase()
    .then(() => {
      console.log('✔ Database tables created and seeded');
      return pool.end();
    })
    .catch((err) => {
      console.error('✖ Database init failed:', err.message);
      process.exit(1);
    });
}

module.exports = initDatabase;
