import { minimalStorage } from './storage-minimal';
import { PostgreSQLStorage } from './postgres-storage';
import type { IStorage } from './storage';

export function createStorage(): IStorage {
  if (process.env.DATABASE_URL) {
    console.log('💾 Using PostgreSQL storage with Supabase');
    return new PostgreSQLStorage();
  } else {
    console.log('💾 Using minimal storage for server startup');
    return minimalStorage;
  }
}

export const storage = createStorage();