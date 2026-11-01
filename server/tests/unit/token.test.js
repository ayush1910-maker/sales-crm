import { describe, it, expect } from 'vitest';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  getRefreshTokenCookieOptions,
} from '../../src/utils/token.js';

describe('Token Utilities Unit Tests', () => {
  const mockUser = {
    _id: '65f012345678901234567890',
    email: 'user@example.com',
    platformRole: 'user',
  };

  it('should generate and verify a valid access token', () => {
    const token = generateAccessToken(mockUser);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe(mockUser._id);
    expect(decoded.email).toBe(mockUser.email);
    expect(decoded.platformRole).toBe('user');
  });

  it('should generate and verify a valid refresh token', () => {
    const token = generateRefreshToken(mockUser);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const decoded = verifyRefreshToken(token);
    expect(decoded.sub).toBe(mockUser._id);
    expect(decoded.jti).toBeDefined();
  });

  it('should fail verification if token is tampered', () => {
    const token = generateAccessToken(mockUser);
    const tampered = token.slice(0, -4) + 'abcd';
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it('should generate deterministic sha256 hashes', () => {
    const token = 'sample-refresh-token';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // 256 bits in hex
  });

  it('should produce secure cookie options', () => {
    const options = getRefreshTokenCookieOptions();
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe('/');
    expect(options.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
