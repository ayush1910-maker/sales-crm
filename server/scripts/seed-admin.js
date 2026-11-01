import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { logger } from '../src/config/logger.js';
import { User } from '../src/models/User.js';
import { Organization } from '../src/models/Organization.js';
import { OrgMembership } from '../src/models/OrgMembership.js';
import { slugify } from '../src/utils/slug.js';

// Parse CLI flags (e.g. --email=... --password=... --firstName=... --lastName=...)
const parseArgs = () => {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (key && value) {
        args[key] = value;
      }
    }
  }
  return args;
};

export const seedAdmin = async (options = {}) => {
  const cliArgs = parseArgs();

  const email = (options.email || cliArgs.email || process.env.ADMIN_EMAIL || '')
    .toLowerCase()
    .trim();

  const password = options.password || cliArgs.password || process.env.ADMIN_PASSWORD || '';

  const firstName =
    options.firstName || cliArgs.firstName || process.env.ADMIN_FIRST_NAME || 'Platform';

  const lastName = options.lastName || cliArgs.lastName || process.env.ADMIN_LAST_NAME || 'Admin';

  if (!email || !email.includes('@')) {
    throw new Error(
      'Valid admin email must be provided via --email flag or ADMIN_EMAIL environment variable'
    );
  }

  if (!password || password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error(
      'Admin password must be provided via --password flag or ADMIN_PASSWORD environment variable and meet policy (min 8 chars, 1 uppercase, 1 number)'
    );
  }

  // Connect to MongoDB if not already connected
  const shouldDisconnect = mongoose.connection.readyState !== 1;
  if (shouldDisconnect) {
    await mongoose.connect(env.MONGODB_URI);
    logger.info('Connected to MongoDB for admin seeding');
  }

  try {
    let user = await User.findOne({ email }).select('+passwordHash');
    const passwordHash = await User.hashPassword(password);

    if (user) {
      user.platformRole = 'platform_admin';
      user.passwordHash = passwordHash;
      user.firstName = firstName;
      user.lastName = lastName;
      user.isActive = true;
      await user.save();
      logger.info(`Existing user [${email}] elevated to platform_admin`);
    } else {
      user = await User.create({
        email,
        passwordHash,
        firstName,
        lastName,
        platformRole: 'platform_admin',
        isActive: true,
      });
      logger.info(`New platform_admin user created: [${email}]`);
    }

    // Ensure platform admin has an associated organization
    let membership = await OrgMembership.findOne({ userId: user._id, isActive: true });
    if (!membership) {
      const orgName = `${firstName}'s Admin Workspace`;
      const slug = slugify(orgName, true);
      const organization = await Organization.create({
        name: orgName,
        slug,
        contactEmail: email,
        isActive: true,
      });

      membership = await OrgMembership.create({
        userId: user._id,
        orgId: organization._id,
        role: 'owner',
        isActive: true,
      });
      logger.info(`Admin workspace [${orgName}] created with slug [${slug}]`);
    }

    logger.info(`Platform admin seed completed successfully for [${email}]`);
    return { user, success: true };
  } finally {
    if (shouldDisconnect) {
      await mongoose.disconnect();
      logger.info('Disconnected from MongoDB');
    }
  }
};

// If run directly from CLI
if (process.argv[1]?.endsWith('seed-admin.js')) {
  seedAdmin()
    .then(() => {
      logger.info('Platform admin seeding finished.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error(`Seed admin failed: ${err.message}`);
      process.exit(1);
    });
}
