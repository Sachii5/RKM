const { calculateDistance, parseCoordinates } = require('../src/utils/helpers');
const { hashPassword, comparePassword } = require('../src/utils/crypto');
const { determineRole } = require('../src/services/auth.service');

describe('Core Logic Tests', () => {

  test('1. Haversine calculation accuracy', () => {
    // Distance between Monas Jakarta (-6.1754, 106.8272) and Bandung (-6.9147, 107.6098) is ~119 km
    const dist = calculateDistance(-6.1754, 106.8272, -6.9147, 107.6098);
    expect(dist).toBeGreaterThan(118);
    expect(dist).toBeLessThan(121);
  });

  test('7. Invalid coordinate handling', () => {
    // Valid coords
    expect(parseCoordinates('-6.8, 108.4')).toEqual({lat: -6.8, lng: 108.4});
    // Missing comma
    expect(parseCoordinates('-6.8 108.4')).toBeNull();
    // Out of bounds
    expect(parseCoordinates('91.0, 108.4')).toBeNull();
    // Non-numeric
    expect(parseCoordinates('abc, xyz')).toBeNull();
  });

  test('5. Role-based access matrix logic validation', () => {
    expect(determineRole('mgr_test@example.com', null)).toBe('ADMIN');
    expect(determineRole('spv_test@example.com', null)).toBe('SUPERVISOR');
    expect(determineRole(null, 'DND')).toBe('SALESMAN');
    expect(determineRole('unknown@ex.com', 'XYZ')).toBe('UNKNOWN');
  });

  test('6. Password hashing test with bcrypt', async () => {
    const pwd = 'test_password_123';
    const hash = await hashPassword(pwd);
    expect(hash).not.toBe(pwd);
    // Compare truthy
    const isMatch = await comparePassword(pwd, hash);
    expect(isMatch).toBe(true);
    // Compare falsy
    const isFalse = await comparePassword('wrong_pwd', hash);
    expect(isFalse).toBe(false);
  });

});
