import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import {
  registerUser,
  loginUser,
  refreshSession,
  logoutUser,
  getCurrentUserProfile,
  updateCurrentUserProfile,
} from './auth.service.js';
import { setRefreshTokenCookie, clearRefreshTokenCookie } from '../../utils/token.js';

export const register = asyncHandler(async (req, res) => {
  const result = await registerUser(req.body);
  setRefreshTokenCookie(res, result.refreshToken);

  return res.status(201).json(
    ApiResponse.created(
      {
        user: result.user,
        organization: result.organization,
        accessToken: result.accessToken,
      },
      'User registered successfully'
    )
  );
});

export const login = asyncHandler(async (req, res) => {
  const result = await loginUser(req.body);
  setRefreshTokenCookie(res, result.refreshToken);

  return res.status(200).json(
    ApiResponse.ok(
      {
        user: result.user,
        organizations: result.organizations,
        defaultOrganization: result.defaultOrganization,
        accessToken: result.accessToken,
      },
      'Login successful'
    )
  );
});

export const refresh = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  const result = await refreshSession(rawRefreshToken);
  setRefreshTokenCookie(res, result.refreshToken);

  return res.status(200).json(
    ApiResponse.ok(
      {
        accessToken: result.accessToken,
        user: result.user,
      },
      'Tokens refreshed successfully'
    )
  );
});

export const logout = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  const userId = req.user?._id;

  await logoutUser(rawRefreshToken, userId);
  clearRefreshTokenCookie(res);

  return res.status(200).json(ApiResponse.ok(null, 'Logged out successfully'));
});

export const getMe = asyncHandler(async (req, res) => {
  const profile = await getCurrentUserProfile(req.user._id);
  return res.status(200).json(ApiResponse.ok(profile, 'Profile retrieved'));
});

export const updateMe = asyncHandler(async (req, res) => {
  const updated = await updateCurrentUserProfile(req.user._id, req.body);
  return res.status(200).json(ApiResponse.ok(updated, 'Profile updated successfully'));
});
