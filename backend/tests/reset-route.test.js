const express = require('express');
const request = require('supertest');

jest.mock('../src/middleware/auth.middleware', () => (req, res, next) => {
  req.user = { userid: 'SPV_TEST', role: 'SUPERVISOR' };
  next();
});

jest.mock('../src/middleware/role.middleware', () => ({
  requireSupervisorOrAbove: (req, res, next) => next(),
  requireSalesman: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next()
}));

jest.mock('../src/services/auth.service', () => ({
  loginUser: jest.fn()
}));

jest.mock('../src/services/backup.service', () => ({
  performResetAndBackup: jest.fn()
}));

jest.mock('../src/services/zone.service', () => ({
  getZoneByRadius: jest.fn(),
  getZoneByKelurahan: jest.fn(),
  createZoneTransaction: jest.fn(),
  softDeleteZone: jest.fn()
}));

jest.mock('../src/services/route.service', () => ({
  getTodayRoute: jest.fn()
}));

jest.mock('../src/controllers/analytics.controller', () => ({
  getMonthlyEvaluation: (req, res) => res.json({}),
  getSurveyAnalytics: (req, res) => res.json({})
}));

jest.mock('../src/db/pg', () => ({
  getMembers: jest.fn(),
  getMemberOrdersByDate: jest.fn()
}));

jest.mock('../src/db/pg_ops', () => ({
  query: jest.fn(),
  connect: jest.fn()
}));

const authService = require('../src/services/auth.service');
const { performResetAndBackup } = require('../src/services/backup.service');
const apiRoutes = require('../src/routes/api');

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

describe('Reset route manager approval', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rejects reset without manager approval credentials', async () => {
    const res = await request(app).post('/api/reset').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Approval MGR wajib/);
    expect(authService.loginUser).not.toHaveBeenCalled();
    expect(performResetAndBackup).not.toHaveBeenCalled();
  });

  test('rejects reset when approval account is not ADMIN', async () => {
    authService.loginUser.mockResolvedValue({ role: 'SUPERVISOR' });

    const res = await request(app)
      .post('/api/reset')
      .send({ adminUserid: 'SPV', adminPassword: 'secret' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/akun MGR/);
    expect(performResetAndBackup).not.toHaveBeenCalled();
  });

  test('rejects reset when manager approval credentials are invalid', async () => {
    authService.loginUser.mockRejectedValue(new Error('Invalid credentials'));

    const res = await request(app)
      .post('/api/reset')
      .send({ adminUserid: 'ADM', adminPassword: 'wrong' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/tidak valid/);
    expect(performResetAndBackup).not.toHaveBeenCalled();
  });

  test('runs reset after valid ADMIN approval', async () => {
    authService.loginUser.mockResolvedValue({ role: 'ADMIN' });
    performResetAndBackup.mockResolvedValue('visits_test.json');

    const res = await request(app)
      .post('/api/reset')
      .send({ adminUserid: 'ADM', adminPassword: 'secret' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, backupFilename: 'visits_test.json' });
    expect(performResetAndBackup).toHaveBeenCalledTimes(1);
  });

});
