import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { OrgMembership } from '../../src/models/OrgMembership.js';

describe('Organization & Membership Integration Tests', () => {
  let app;
  let ownerUser;
  let ownerToken;
  let ownerOrg;

  let memberUser;
  let memberToken;

  let outsiderToken;
  let outsiderOrg;

  beforeEach(async () => {
    app = createApp();

    // 1. Create owner and primary org
    const ownerRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Owner User',
      email: 'owner@example.com',
      password: 'OwnerPassword123!',
      organizationName: 'Primary Org',
    });
    ownerUser = ownerRes.body.data.user;
    ownerToken = ownerRes.body.data.accessToken;
    ownerOrg = ownerRes.body.data.organization;

    // 2. Create another user who will be invited as a member
    const memberRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Regular Member',
      email: 'member@example.com',
      password: 'MemberPassword123!',
    });
    memberUser = memberRes.body.data.user;
    memberToken = memberRes.body.data.accessToken;

    // 3. Create outsider in a completely separate organization
    const outsiderRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Outsider User',
      email: 'outsider@example.com',
      password: 'OutsiderPassword123!',
      organizationName: 'Outsider Org',
    });
    outsiderToken = outsiderRes.body.data.accessToken;
    outsiderOrg = outsiderRes.body.data.organization;
  });

  describe('Organization Creation & Listing', () => {
    it('should create a new organization with authenticated user as owner', async () => {
      const res = await request(app)
        .post('/api/v1/orgs')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Second Company',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.organization.name).toBe('Second Company');
      expect(res.body.data.membership.role).toBe('owner');
    });

    it('should list only organizations that the user belongs to', async () => {
      const res = await request(app)
        .get('/api/v1/orgs')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      // Owner belongs to Primary Org, should not see Outsider Org
      const orgIds = res.body.data.map((o) => o._id.toString());
      expect(orgIds).toContain(ownerOrg._id.toString());
      expect(orgIds).not.toContain(outsiderOrg._id.toString());
    });
  });

  describe('Cross-Organization Access Prevention', () => {
    it('should deny outsider access to an organization they do not belong to (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/orgs/${ownerOrg._id}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/access denied/i);
    });

    it('should deny outsider modifying an organization they do not belong to', async () => {
      const res = await request(app)
        .patch(`/api/v1/orgs/${ownerOrg._id}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ name: 'Hacked Name' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Role-Based Authorization within Organization', () => {
    beforeEach(async () => {
      // Add memberUser to ownerOrg as 'member'
      await request(app)
        .post(`/api/v1/orgs/${ownerOrg._id}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: memberUser.email,
          role: 'member',
        });
    });

    it('should allow member to view org details', async () => {
      const res = await request(app)
        .get(`/api/v1/orgs/${ownerOrg._id}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data._id.toString()).toBe(ownerOrg._id.toString());
    });

    it('should forbid member from inviting new users (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/v1/orgs/${ownerOrg._id}/members`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          email: 'another@example.com',
          role: 'member',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/insufficient permissions/i);
    });

    it('should forbid member from updating organization details', async () => {
      const res = await request(app)
        .patch(`/api/v1/orgs/${ownerOrg._id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          name: 'Attempted Org Rename',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should allow owner to promote member to admin', async () => {
      const res = await request(app)
        .patch(`/api/v1/orgs/${ownerOrg._id}/members/${memberUser._id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          role: 'admin',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedMembership = await OrgMembership.findOne({
        orgId: ownerOrg._id,
        userId: memberUser._id,
      });
      expect(updatedMembership.role).toBe('admin');
    });

    it('should allow owner to remove a member', async () => {
      const res = await request(app)
        .delete(`/api/v1/orgs/${ownerOrg._id}/members/${memberUser._id}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const membership = await OrgMembership.findOne({
        orgId: ownerOrg._id,
        userId: memberUser._id,
      });
      expect(membership.isActive).toBe(false);
    });

    it('should prevent removing the only owner of an organization', async () => {
      const res = await request(app)
        .delete(`/api/v1/orgs/${ownerOrg._id}/members/${ownerUser._id}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/cannot remove the only owner/i);
    });
  });
});
