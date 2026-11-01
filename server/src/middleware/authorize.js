import { ApiError } from '../utils/ApiError.js';

/**
 * Middleware to restrict access to Platform Administrators
 */
export const authorizePlatformAdmin = (req, res, next) => {
  if (!req.user || req.user.platformRole !== 'platform_admin') {
    return next(ApiError.forbidden('Platform administrator privileges required'));
  }
  return next();
};

/**
 * Middleware factory to restrict access based on organization role.
 * Works in conjunction with tenantScope middleware which sets req.orgRole.
 * Platform admins always bypass org role checks.
 *
 * @param {string[]} allowedRoles - Array of allowed roles (e.g. ['owner', 'admin'])
 */
export const requireOrgRole = (allowedRoles = []) => {
  return (req, res, next) => {
    // Platform admin bypass
    if (req.user && req.user.platformRole === 'platform_admin') {
      return next();
    }

    if (!req.orgRole || !allowedRoles.includes(req.orgRole)) {
      return next(
        ApiError.forbidden(`Insufficient permissions. Requires one of: ${allowedRoles.join(', ')}`)
      );
    }

    return next();
  };
};
