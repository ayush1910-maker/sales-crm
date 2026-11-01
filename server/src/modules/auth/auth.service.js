import { User } from '../../models/User.js';
import { Organization } from '../../models/Organization.js';
import { OrgMembership } from '../../models/OrgMembership.js';
import { RefreshToken } from '../../models/RefreshToken.js';
import { ApiError } from '../../utils/ApiError.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../../utils/token.js';
import { slugify } from '../../utils/slug.js';

export const registerUser = async ({
  name,
  firstName,
  lastName,
  email,
  password,
  organizationName,
}) => {
  // Parse first and last names if full name was provided
  let fName = firstName;
  let lName = lastName;

  if (!fName && name) {
    const parts = name.trim().split(/\s+/);
    fName = parts[0];
    lName = parts.slice(1).join(' ') || parts[0];
  }

  // Check for existing user
  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new ApiError(409, 'An account with this email address already exists');
  }

  // Hash password
  const passwordHash = await User.hashPassword(password);

  // Create User document
  const user = await User.create({
    email: normalizedEmail,
    passwordHash,
    firstName: fName,
    lastName: lName,
    platformRole: 'user',
    isActive: true,
  });

  // Automatically create a personal organization for newly registered user
  const orgName = organizationName || `${fName}'s Organization`;
  const slug = slugify(orgName, true);

  const organization = await Organization.create({
    name: orgName,
    slug,
    contactEmail: normalizedEmail,
    isActive: true,
  });

  // Create OrgMembership with 'owner' role
  const membership = await OrgMembership.create({
    userId: user._id,
    orgId: organization._id,
    role: 'owner',
    isActive: true,
  });

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Store hashed refresh token in MongoDB
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    userId: user._id,
    tokenHash,
    expiresAt,
  });

  return {
    user,
    organization: {
      ...organization.toJSON(),
      role: membership.role,
    },
    accessToken,
    refreshToken,
  };
};

export const loginUser = async ({ email, password }) => {
  const normalizedEmail = email.toLowerCase().trim();

  // Find user and explicitly select passwordHash
  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  // Update last login timestamp
  user.lastLoginAt = new Date();
  await user.save();

  // Retrieve user's organizations
  const memberships = await OrgMembership.find({
    userId: user._id,
    isActive: true,
  }).populate('orgId');

  const organizations = memberships
    .filter((m) => m.orgId && m.orgId.isActive)
    .map((m) => ({
      _id: m.orgId._id,
      name: m.orgId.name,
      slug: m.orgId.slug,
      role: m.role,
    }));

  const defaultOrganization = organizations[0] || null;

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Store hashed refresh token in MongoDB
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    userId: user._id,
    tokenHash,
    expiresAt,
  });

  return {
    user,
    organizations,
    defaultOrganization,
    accessToken,
    refreshToken,
  };
};

export const refreshSession = async (rawRefreshToken) => {
  if (!rawRefreshToken) {
    throw ApiError.unauthorized('Refresh token is required');
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const tokenHash = hashToken(rawRefreshToken);
  const storedToken = await RefreshToken.findOne({ tokenHash });

  // Reuse detection: If token was already revoked, someone may be replaying an old token
  if (storedToken && storedToken.isRevoked()) {
    // Revoke all tokens for this user for security
    await RefreshToken.deleteMany({ userId: storedToken.userId });
    throw ApiError.unauthorized('Refresh token has been revoked. Please sign in again.');
  }

  if (!storedToken || storedToken.isExpired()) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await User.findById(decoded.sub);
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('User account not found or has been deactivated');
  }

  // Rotate tokens: generate new token pair
  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);
  const newTokenHash = hashToken(newRefreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Invalidate old token and record replacement
  storedToken.revokedAt = new Date();
  storedToken.replacedByTokenHash = newTokenHash;
  await storedToken.save();

  // Store new token in MongoDB
  await RefreshToken.create({
    userId: user._id,
    tokenHash: newTokenHash,
    expiresAt,
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    user,
  };
};

export const logoutUser = async (rawRefreshToken, userId = null) => {
  if (rawRefreshToken) {
    const tokenHash = hashToken(rawRefreshToken);
    await RefreshToken.deleteOne({ tokenHash });
  } else if (userId) {
    await RefreshToken.deleteMany({ userId });
  }

  return { loggedOut: true };
};

export const getCurrentUserProfile = async (userId) => {
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('User not found or inactive');
  }

  const memberships = await OrgMembership.find({
    userId: user._id,
    isActive: true,
  }).populate('orgId');

  const organizations = memberships
    .filter((m) => m.orgId && m.orgId.isActive)
    .map((m) => ({
      _id: m.orgId._id,
      name: m.orgId.name,
      slug: m.orgId.slug,
      contactEmail: m.orgId.contactEmail,
      role: m.role,
    }));

  return {
    user,
    organizations,
  };
};

export const updateCurrentUserProfile = async (
  userId,
  { firstName, lastName, currentPassword, newPassword }
) => {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('User not found or inactive');
  }

  if (newPassword) {
    if (!currentPassword) {
      throw ApiError.badRequest('Current password is required to set a new password');
    }
    const isCurrentValid = await user.comparePassword(currentPassword);
    if (!isCurrentValid) {
      throw ApiError.unauthorized('Current password does not match');
    }
    user.passwordHash = await User.hashPassword(newPassword);
  }

  if (firstName) user.firstName = firstName.trim();
  if (lastName) user.lastName = lastName.trim();

  await user.save();

  return {
    user: await User.findById(userId),
  };
};
