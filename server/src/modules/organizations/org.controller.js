import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import {
  createOrganization,
  listOrganizations,
  getOrganizationById,
  updateOrganization,
  deleteOrganization,
  listMembers,
  addMemberByEmail,
  updateMemberRole,
  removeMember,
} from './org.service.js';

export const handleCreateOrg = asyncHandler(async (req, res) => {
  const result = await createOrganization(req.body, req.user);
  return res.status(201).json(ApiResponse.created(result, 'Organization created successfully'));
});

export const handleListOrgs = asyncHandler(async (req, res) => {
  const orgs = await listOrganizations(req.user);
  return res.status(200).json(ApiResponse.ok(orgs, 'Organizations retrieved'));
});

export const handleGetOrg = asyncHandler(async (req, res) => {
  const org = await getOrganizationById(req.orgId);
  return res.status(200).json(ApiResponse.ok(org, 'Organization retrieved'));
});

export const handleUpdateOrg = asyncHandler(async (req, res) => {
  const org = await updateOrganization(req.orgId, req.body);
  return res.status(200).json(ApiResponse.ok(org, 'Organization updated successfully'));
});

export const handleDeleteOrg = asyncHandler(async (req, res) => {
  const result = await deleteOrganization(req.orgId);
  return res.status(200).json(ApiResponse.ok(result, 'Organization deleted successfully'));
});

export const handleListMembers = asyncHandler(async (req, res) => {
  const members = await listMembers(req.orgId);
  return res.status(200).json(ApiResponse.ok(members, 'Members retrieved'));
});

export const handleInviteMember = asyncHandler(async (req, res) => {
  const result = await addMemberByEmail(req.orgId, req.body);
  return res.status(201).json(ApiResponse.created(result, 'Member added successfully'));
});

export const handleUpdateMemberRole = asyncHandler(async (req, res) => {
  const result = await updateMemberRole(
    req.orgId,
    req.params.userId,
    req.body.role,
    req.user,
    req.orgRole
  );
  return res.status(200).json(ApiResponse.ok(result, 'Member role updated successfully'));
});

export const handleRemoveMember = asyncHandler(async (req, res) => {
  const result = await removeMember(req.orgId, req.params.userId, req.user, req.orgRole);
  return res.status(200).json(ApiResponse.ok(result, 'Member removed successfully'));
});
