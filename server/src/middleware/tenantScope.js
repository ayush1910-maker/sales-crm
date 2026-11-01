import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { OrgMembership } from '../models/OrgMembership.js';
import { Organization } from '../models/Organization.js';

/**
 * Tenant scoping middleware.
 * Resolves target orgId from X-Org-Id header, route param (:orgId), or query string (?orgId=).
 * Verifies active membership unless user has platform_admin role.
 *
 * @param {Object} options
 * @param {boolean} [options.required=true] Whether orgId must be present
 */
export const tenantScope = ({ required = true } = {}) => {
  return async (req, res, next) => {
    try {
      const rawOrgId = req.headers['x-org-id'] || req.params.orgId || req.query.orgId;

      if (!rawOrgId) {
        if (!required) {
          return next();
        }
        throw ApiError.badRequest(
          'Organization ID is required via X-Org-Id header or URL parameter'
        );
      }

      if (!mongoose.Types.ObjectId.isValid(rawOrgId)) {
        throw ApiError.badRequest('Invalid organization ID format');
      }

      const orgId = new mongoose.Types.ObjectId(rawOrgId);

      // Verify organization existence and active state
      const org = await Organization.findById(orgId);
      if (!org || !org.isActive) {
        throw ApiError.notFound('Organization not found or inactive');
      }

      // Platform admin bypass
      if (req.user && req.user.platformRole === 'platform_admin') {
        req.orgId = orgId;
        req.orgRole = 'platform_admin';
        req.organization = org;
        return next();
      }

      // Check user membership in the organization
      const membership = await OrgMembership.findOne({
        userId: req.user._id,
        orgId,
        isActive: true,
      });

      if (!membership) {
        throw ApiError.forbidden('Access denied: You are not a member of this organization');
      }

      req.orgId = orgId;
      req.orgRole = membership.role;
      req.orgMembership = membership;
      req.organization = org;

      return next();
    } catch (error) {
      return next(error);
    }
  };
};
