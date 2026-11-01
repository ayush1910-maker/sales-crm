import mongoose from 'mongoose';
import { Organization } from '../../models/Organization.js';
import { OrgMembership } from '../../models/OrgMembership.js';
import { User } from '../../models/User.js';
import { ApiError } from '../../utils/ApiError.js';
import { slugify } from '../../utils/slug.js';

export const createOrganization = async (orgData, creatorUser) => {
  const name = orgData.name.trim();
  const slug = orgData.slug ? slugify(orgData.slug, false) : slugify(name, true);
  const contactEmail = (orgData.contactEmail || creatorUser.email).toLowerCase().trim();

  // Ensure unique slug
  let finalSlug = slug;
  let counter = 1;
  while (await Organization.findOne({ slug: finalSlug })) {
    finalSlug = `${slug}-${counter}`;
    counter++;
  }

  const organization = await Organization.create({
    name,
    slug: finalSlug,
    contactEmail,
    isActive: true,
  });

  const membership = await OrgMembership.create({
    userId: creatorUser._id,
    orgId: organization._id,
    role: 'owner',
    isActive: true,
  });

  return {
    organization,
    membership,
  };
};

export const listOrganizations = async (user) => {
  if (user.platformRole === 'platform_admin') {
    const orgs = await Organization.find().sort({ createdAt: -1 });
    return orgs;
  }

  const memberships = await OrgMembership.find({
    userId: user._id,
    isActive: true,
  }).populate('orgId');

  return memberships
    .filter((m) => m.orgId && m.orgId.isActive)
    .map((m) => ({
      _id: m.orgId._id,
      name: m.orgId.name,
      slug: m.orgId.slug,
      contactEmail: m.orgId.contactEmail,
      role: m.role,
      joinedAt: m.joinedAt,
      createdAt: m.orgId.createdAt,
    }));
};

export const getOrganizationById = async (orgId) => {
  const org = await Organization.findById(orgId);
  if (!org || !org.isActive) {
    throw ApiError.notFound('Organization not found');
  }
  return org;
};

export const updateOrganization = async (orgId, updateData) => {
  const org = await Organization.findById(orgId);
  if (!org || !org.isActive) {
    throw ApiError.notFound('Organization not found');
  }

  if (updateData.name) org.name = updateData.name.trim();
  if (updateData.contactEmail) org.contactEmail = updateData.contactEmail.toLowerCase().trim();
  if (typeof updateData.isActive === 'boolean') org.isActive = updateData.isActive;

  await org.save();
  return org;
};

export const deleteOrganization = async (orgId) => {
  const org = await Organization.findById(orgId);
  if (!org) {
    throw ApiError.notFound('Organization not found');
  }

  org.isActive = false;
  await org.save();

  // Deactivate all memberships
  await OrgMembership.updateMany({ orgId }, { isActive: false });

  return { deleted: true };
};

export const listMembers = async (orgId) => {
  const memberships = await OrgMembership.find({
    orgId,
    isActive: true,
  }).populate('userId', 'firstName lastName email platformRole isActive');

  return memberships
    .filter((m) => m.userId && m.userId.isActive)
    .map((m) => ({
      membershipId: m._id,
      user: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
};

export const addMemberByEmail = async (orgId, { email, role = 'member' }) => {
  const normalizedEmail = email.toLowerCase().trim();

  // Check if target user exists in system
  let user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw ApiError.notFound(
      `User with email ${normalizedEmail} does not have an account. They must register first.`
    );
  }

  if (!user.isActive) {
    throw ApiError.badRequest('Cannot add a deactivated user to the organization');
  }

  // Check for existing membership
  let membership = await OrgMembership.findOne({
    userId: user._id,
    orgId,
  });

  if (membership) {
    if (membership.isActive) {
      throw ApiError.badRequest('User is already an active member of this organization');
    }
    // Reactivate existing membership
    membership.isActive = true;
    membership.role = role;
    membership.joinedAt = new Date();
    await membership.save();
  } else {
    membership = await OrgMembership.create({
      userId: user._id,
      orgId,
      role,
      isActive: true,
    });
  }

  return {
    membershipId: membership._id,
    user: {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    },
    role: membership.role,
    joinedAt: membership.joinedAt,
  };
};

export const updateMemberRole = async (orgId, memberUserId, newRole, actorUser, actorRole) => {
  if (!mongoose.Types.ObjectId.isValid(memberUserId)) {
    throw ApiError.badRequest('Invalid member user ID format');
  }

  const membership = await OrgMembership.findOne({
    orgId,
    userId: memberUserId,
    isActive: true,
  });

  if (!membership) {
    throw ApiError.notFound('Member not found in this organization');
  }

  // If changing an owner's role or making someone an owner, enforce owner permission
  const isPlatformAdmin = actorUser.platformRole === 'platform_admin';
  if (
    !isPlatformAdmin &&
    actorRole !== 'owner' &&
    (membership.role === 'owner' || newRole === 'owner')
  ) {
    throw ApiError.forbidden('Only organization owners can grant or revoke ownership');
  }

  // If demoting an owner, ensure at least one other active owner remains
  if (membership.role === 'owner' && newRole !== 'owner') {
    const ownerCount = await OrgMembership.countDocuments({
      orgId,
      role: 'owner',
      isActive: true,
    });
    if (ownerCount <= 1) {
      throw ApiError.badRequest(
        'Cannot demote the only owner. Transfer ownership or assign another owner first.'
      );
    }
  }

  membership.role = newRole;
  await membership.save();

  return membership;
};

export const removeMember = async (orgId, memberUserId, actorUser, actorRole) => {
  if (!mongoose.Types.ObjectId.isValid(memberUserId)) {
    throw ApiError.badRequest('Invalid member user ID format');
  }

  const membership = await OrgMembership.findOne({
    orgId,
    userId: memberUserId,
    isActive: true,
  });

  if (!membership) {
    throw ApiError.notFound('Member not found in this organization');
  }

  const isPlatformAdmin = actorUser.platformRole === 'platform_admin';
  if (!isPlatformAdmin && actorRole !== 'owner' && membership.role === 'owner') {
    throw ApiError.forbidden('Only organization owners can remove other owners');
  }

  // Prevent removing the sole owner
  if (membership.role === 'owner') {
    const ownerCount = await OrgMembership.countDocuments({
      orgId,
      role: 'owner',
      isActive: true,
    });
    if (ownerCount <= 1) {
      throw ApiError.badRequest('Cannot remove the only owner of the organization');
    }
  }

  membership.isActive = false;
  await membership.save();

  return { removed: true };
};
