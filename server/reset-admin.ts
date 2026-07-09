/**
 * One-time script to reset the admin password.
 * Run from server directory: npx tsx reset-admin.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { Admin } from './src/models/Admin';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vsy-box-cricket';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@vsyboxcricket.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin@123';

const run = async () => {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB:', MONGO_URI);

  // Delete existing admin/worker and re-create with correct password
  const deleted = await Admin.deleteMany({});
  console.log(`Deleted ${deleted.deletedCount} existing account(s)`);

  await Admin.create({
    name: 'VSY Admin',
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    role: 'admin',
  });

  await Admin.create({
    name: 'VSY Worker',
    email: 'bookings@vsy.com',
    password: '123456',
    role: 'worker',
  });

  console.log('\n✅ Accounts reset successfully!');
  console.log(`📧 Admin Email:    ${ADMIN_EMAIL}`);
  console.log(`🔑 Admin Password: ${ADMIN_PASSWORD}`);
  console.log(`📧 Worker Email:   bookings@vsy.com`);
  console.log(`🔑 Worker Password: 123456`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('❌ Reset failed:', err.message);
  process.exit(1);
});
