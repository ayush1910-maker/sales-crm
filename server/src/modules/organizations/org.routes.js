import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { requireOrgRole } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import {
  createOrgSchema,
  updateOrgSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
} from './org.schema.js';
import {
  handleCreateOrg,
  handleListOrgs,
  handleGetOrg,
  handleUpdateOrg,
  handleDeleteOrg,
  handleListMembers,
  handleInviteMember,
  handleUpdateMemberRole,
  handleRemoveMember,
} from './org.controller.js';

const router = Router();

// All organization routes require authenticated user
router.use(authenticate);

// Organization root collection
router.get('/', handleListOrgs);
router.post('/', validate(createOrgSchema), handleCreateOrg);

// Organization item operations
router.get('/:orgId', tenantScope({ required: true }), handleGetOrg);
router.patch(
  '/:orgId',
  tenantScope({ required: true }),
  requireOrgRole(['owner', 'admin']),
  validate(updateOrgSchema),
  handleUpdateOrg
);
router.delete(
  '/:orgId',
  tenantScope({ required: true }),
  requireOrgRole(['owner']),
  handleDeleteOrg
);

// Member management operations
router.get(
  '/:orgId/members',
  tenantScope({ required: true }),
  requireOrgRole(['owner', 'admin']),
  handleListMembers
);
router.post(
  '/:orgId/members',
  tenantScope({ required: true }),
  requireOrgRole(['owner', 'admin']),
  validate(inviteMemberSchema),
  handleInviteMember
);
router.patch(
  '/:orgId/members/:userId',
  tenantScope({ required: true }),
  requireOrgRole(['owner', 'admin']),
  validate(updateMemberRoleSchema),
  handleUpdateMemberRole
);
router.delete(
  '/:orgId/members/:userId',
  tenantScope({ required: true }),
  requireOrgRole(['owner', 'admin']),
  handleRemoveMember
);

export default router;
