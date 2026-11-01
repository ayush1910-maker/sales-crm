import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { seedAdmin } from '../../scripts/seed-admin.js';
import { User } from '../../src/models/User.js';

describe('Platform Admin & CLI Seeding Integration Tests', () => {
  let app;

  beforeEach(() => {
    app = createApp();
  });

  it('should seed a new platform admin user via seed script', async () => {
    const adminDetails = {
      email: 'admin.seed@example.com',
      password: 'AdminPassword123!',
      firstName: 'Super',
      lastName: 'Admin',
    };

    const result = await seedAdmin(adminDetails);
    expect(result.success).toBe(true);

    const seededUser = await User.findOne({ email: adminDetails.email });
    expect(seededUser).not.toBeNull();
    expect(seededUser.platformRole).toBe('platform_admin');
    expect(seededUser.firstName).toBe('Super');
    expect(seededUser.lastName).toBe('Admin');
  });

  it('should allow platform admin to log in and list all organizations across tenants', async () => {
    // 1. Seed admin
    await seedAdmin({
      email: 'sysadmin@example.com',
      password: 'SysAdminPass123!',
      firstName: 'System',
      lastName: 'Administrator',
    });

    // 2. Register regular users in distinct organizations
    await request(app).post('/api/v1/auth/register').send({
      name: 'Org1 User',
      email: 'org1@example.com',
      password: 'Password123!',
      organizationName: 'Tenant One',
    });

    await request(app).post('/api/v1/auth/register').send({
      name: 'Org2 User',
      email: 'org2@example.com',
      password: 'Password123!',
      organizationName: 'Tenant Two',
    });

    // 3. Log in as platform admin
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'sysadmin@example.com',
      password: 'SysAdminPass123!',
    });

    expect(loginRes.status).toBe(200);
    const adminToken = loginRes.body.data.accessToken;
    expect(loginRes.body.data.user.platformRole).toBe('platform_admin');

    // 4. Platform admin calls GET /api/v1/orgs -> should see all organizations
    const orgsRes = await request(app)
      .get('/api/v1/orgs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(orgsRes.status).toBe(200);
    const orgNames = orgsRes.body.data.map((o) => o.name);
    expect(orgNames).toContain('Tenant One');
    expect(orgNames).toContain('Tenant Two');
  });

  it('should allow platform admin to access and manage any organization without membership', async () => {
    // 1. Seed admin
    await seedAdmin({
      email: 'superadmin@example.com',
      password: 'SuperAdminPass123!',
    });

    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'superadmin@example.com',
      password: 'SuperAdminPass123!',
    });
    const adminToken = adminLogin.body.data.accessToken;

    // 2. Create an organization belonging to a regular user
    const userRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Regular Bob',
      email: 'bob@example.com',
      password: 'Password123!',
      organizationName: "Bob's Bakery",
    });
    const bobsOrgId = userRes.body.data.organization._id;

    // 3. Platform admin accesses Bob's organization details directly
    const getRes = await request(app)
      .get(`/api/v1/orgs/${bobsOrgId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.name).toBe("Bob's Bakery");

    // 4. Platform admin updates Bob's organization settings
    const updateRes = await request(app)
      .patch(`/api/v1/orgs/${bobsOrgId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: "Bob's Gourmet Bakery",
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.name).toBe("Bob's Gourmet Bakery");
  });
});
