import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { query } from '../config/database';

const initDatabase = async () => {
  try {
    console.log('Starting database initialization...');

    const initSqlPath = path.join(__dirname, '../../prisma/init.sql');
    const initSql = fs.readFileSync(initSqlPath, 'utf-8');

    const statements = initSql
      .split(/;\s*$/)
      .filter(stmt => stmt.trim() && !stmt.trim().startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await query(statement.trim());
          console.log(`✓ Executed: ${statement.trim().substring(0, 80)}...`);
        } catch (error: any) {
          if (error.message.includes('already exists') || error.message.includes('duplicate')) {
            console.log(`ℹ Skipping (already exists): ${statement.trim().substring(0, 60)}...`);
          } else {
            console.error(`✗ Error executing: ${statement.trim().substring(0, 80)}...`);
            console.error(`  Error: ${error.message}`);
          }
        }
      }
    }

    console.log('\n✓ Database initialization completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Database initialization failed:', error);
    process.exit(1);
  }
};

initDatabase();
