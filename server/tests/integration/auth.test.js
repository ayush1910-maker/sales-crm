import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Organization } from '../../src/models/Organization.js';
import { OrgMembership } from '../../src/models/OrgMembership.js';
import { RefreshToken } from '../../src/models/RefreshToken.js';

describe('Auth Integration Tests', () => {
  let app;

  beforeEach(() => {
    app = createApp();
  });

  const validUserData = {
    name: 'Alice Smith',
    email: 'alice@example.com',
    password: 'SecurePassword123!',
  };

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user and automatically create a personal organization', async () => {
      const res = await request(app).post('/api/v1/auth/register').send(validUserData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(validUserData.email);
      expect(res.body.data.user.firstName).toBe('Alice');
      expect(res.body.data.user.lastName).toBe('Smith');
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.organization).toBeDefined();
      expect(res.body.data.organization.role).toBe('owner');

      // Check cookie header
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/refreshToken=/);
      expect(cookies[0]).toMatch(/HttpOnly/i);

      // Verify MongoDB documents
      const createdUser = await User.findOne({ email: validUserData.email });
      expect(createdUser).not.toBeNull();

      const createdOrg = await Organization.findById(res.body.data.organization._id);
      expect(createdOrg).not.toBeNull();

      const membership = await OrgMembership.findOne({
        userId: createdUser._id,
        orgId: createdOrg._id,
      });
      expect(membership).not.toBeNull();
      expect(membership.role).toBe('owner');

      const storedRefreshToken = await RefreshToken.findOne({ userId: createdUser._id });
      expect(storedRefreshToken).not.toBeNull();
    });

    it('should reject registration when email is already registered', async () => {
      // First registration
      await request(app).post('/api/v1/auth/register').send(validUserData);

      // Duplicate registration attempt
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validUserData,
          name: 'Alice Duplicate',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/already exists/i);
    });

    it('should reject registration when password does not meet policy', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validUserData,
          password: 'weak',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.details).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // Register user before each login test
      await request(app).post('/api/v1/auth/register').send(validUserData);
    });

    it('should log in successfully with valid credentials and return tokens', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: validUserData.email,
        password: validUserData.password,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe(validUserData.email);
      expect(res.body.data.defaultOrganization).toBeDefined();
      expect(res.body.data.organizations.length).toBeGreaterThan(0);

      // Verify refresh cookie is set
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/refreshToken=/);
    });

    it('should reject login with incorrect password with generic message', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: validUserData.email,
        password: 'WrongPassword123!',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('should reject login for non-existent email with generic message', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'unknown@example.com',
        password: 'SomePassword123!',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBe('Invalid email or password');
    });
  });

  describe('Access Token Authentication (GET /api/v1/auth/me)', () => {
    let accessToken;

    beforeEach(async () => {
      const res = await request(app).post('/api/v1/auth/register').send(validUserData);
      accessToken = res.body.data.accessToken;
    });

    it('should succeed with valid Bearer access token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(validUserData.email);
      expect(res.body.data.organizations).toBeDefined();
    });

    it('should fail when Authorization header is missing', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should fail with invalid/malformed token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token-string');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Refresh Token Rotation & Invalidation', () => {
    let refreshCookie;

    beforeEach(async () => {
      const res = await request(app).post('/api/v1/auth/register').send(validUserData);
      refreshCookie = res.headers['set-cookie'][0];
    });

    it('should rotate refresh token and issue new access token', async () => {
      const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', refreshCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();

      const newCookie = res.headers['set-cookie']?.[0];
      expect(newCookie).toBeDefined();
      expect(newCookie).not.toEqual(refreshCookie);

      // Trying to reuse the old refresh token should be rejected (reuse detection)
      const reuseRes = await request(app).post('/api/v1/auth/refresh').set('Cookie', refreshCookie);

      expect(reuseRes.status).toBe(401);
    });

    it('should invalidate refresh token on logout', async () => {
      const logoutRes = await request(app).post('/api/v1/auth/logout').set('Cookie', refreshCookie);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Refreshing after logout must fail
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', refreshCookie);

      expect(refreshRes.status).toBe(401);
    });
  });
});
