/**
 * Seed an owner account (out-of-band admin provisioning).
 *
 * Owner accounts cannot be created via the public /auth/signup endpoint --
 * that endpoint only ever creates riders. Use this script to create the
 * restaurant owner account directly against the database.
 *
 * Usage (run from backend/):
 *   node scripts/seedOwner.js "Owner Name" owner@email.com password123 [phone]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function run() {
  const [, , name, email, password, contactNumber] = process.argv;

  if (!name || !email || !password) {
    console.error('Usage: node scripts/seedOwner.js "Owner Name" owner@email.com password [phone]');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('Password must be at least 6 characters');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const lower = email.toLowerCase();
  const existing = await User.findOne({ email: lower });
  if (existing) {
    console.error(`A user with email ${lower} already exists (role: ${existing.role})`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const user = await User.create({
    name,
    email: lower,
    password,
    role: 'owner',
    contactNumber: contactNumber || undefined,
  });

  console.log(`Owner created: ${user.email} (id: ${user._id.toString()})`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
