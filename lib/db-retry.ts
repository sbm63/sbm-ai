import { db } from '@vercel/postgres';

/**
 * Execute a database query with automatic retry logic
 * @param queryFn Function that returns the database query
 * @param maxRetries Maximum number of retry attempts (default: 3)
 * @param retryDelay Delay between retries in milliseconds (default: 2000)
 */
export async function executeWithRetry<T>(
  queryFn: () => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 2000,
): Promise<T> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Database operation attempt ${attempt}/${maxRetries}...`);
      const result = await queryFn();
      console.log('✅ Database operation successful');
      return result;
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Database attempt ${attempt} failed:`, error.message);

      if (attempt < maxRetries) {
        console.log(`⏳ Waiting ${retryDelay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  console.error('❌ All database connection attempts failed');
  throw new Error(
    `Database connection failed after ${maxRetries} attempts: ${lastError?.message}`,
  );
}

/**
 * Test database connectivity with retries
 */
export async function testConnection(): Promise<void> {
  await executeWithRetry(() => db.sql`SELECT 1 as test`);
}
