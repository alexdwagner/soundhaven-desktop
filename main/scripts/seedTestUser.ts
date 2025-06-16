import { db } from '../src/db';
import { users } from '../src/schema';
import { hashPassword } from '../src/utils/auth';

async function seedTestUser() {
  try {
    // Check if test user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'test@example.com'));

    if (existingUser) {
      console.log('Test user already exists');
      return;
    }

    // Hash the test password
    const hashedPassword = await hashPassword('testpassword');
    
    // Insert test user
    await db.insert(users).values({
      email: 'test@example.com',
      password: hashedPassword,
      name: 'Test User',
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000)
    });

    console.log('Test user created successfully');
  } catch (error) {
    console.error('Error seeding test user:', error);
  } finally {
    process.exit(0);
  }
}

// Import eq from drizzle-orm
import { eq } from 'drizzle-orm';

seedTestUser();
