import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

// Force Supabase connection - override DATABASE_URL
let connectionString = process.env.SUPABASE_POOLER_URL || process.env.SUPABASE_CONNECTION_STRING || process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (process.env.SUPABASE_POOLER_URL) {
  // Use Supabase pooler URL (preferred)
  connectionString = process.env.SUPABASE_POOLER_URL;
  
  // Fix common issues with Supabase URLs
  if (connectionString.startsWith('postgres://')) {
    connectionString = connectionString.replace('postgres://', 'postgresql://');
  }
  if (connectionString.includes('#')) {
    connectionString = connectionString.replace(/#/g, '%23');
  }
  
  console.log('🔗 Conectando ao Supabase database (pooler)...');
  console.log('🔍 Connection string format:', connectionString.split('@')[0] + '@[hidden]');
  console.log('🔍 Using SUPABASE_POOLER_URL:', !!process.env.SUPABASE_POOLER_URL);
  console.log('🔍 Using DATABASE_URL:', !!process.env.DATABASE_URL);
} else if (process.env.SUPABASE_CONNECTION_STRING) {
  // Use Supabase connection string
  connectionString = process.env.SUPABASE_CONNECTION_STRING;
  console.log('🔗 Conectando ao Supabase database...');
} else if (process.env.SUPABASE_DATABASE_URL) {
  // Fallback to old URL with encoding
  connectionString = process.env.SUPABASE_DATABASE_URL.replace('#', '%23');
  console.log('🔗 Conectando ao Supabase database (fallback)...');
} else {
  console.log('🔗 Usando PostgreSQL local...');
}

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

// Create Drizzle instance
export const db = drizzle(pool, { schema });

// Test database connection
export async function testConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log("✅ Database connection successful");
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    return false;
  }
}

// Initialize profiles table and create missing user profile
export async function initializeProfiles() {
  try {
    const client = await pool.connect();
    
    // Create profiles table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id uuid PRIMARY KEY,
        name text,
        email text,
        role text DEFAULT 'user',
        clinic_id integer,
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now()
      );
    `);
    
    // Create the missing user profile for current authenticated user
    await client.query(`
      INSERT INTO profiles (id, name, email, role, clinic_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        clinic_id = EXCLUDED.clinic_id,
        updated_at = now();
    `, [
      '3cd96e6d-81f2-4c8a-a54d-3abac77b37a4',
      'Caio Rodrigo',
      'cr@caiorodrigo.com.br',
      'super_admin',
      1
    ]);
    
    client.release();
    console.log("✅ Profiles table initialized and user profile created");
    return true;
  } catch (error) {
    console.error("❌ Profile initialization failed:", error);
    return false;
  }
}

// Close database connection
export async function closeConnection() {
  await pool.end();
}