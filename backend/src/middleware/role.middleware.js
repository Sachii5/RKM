const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: 'Unauthorized: No role defined' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }

    next();
  };
};

// Aliases for common role groups
const requireAdmin = requireRole(['ADMIN']);
const requireSupervisorOrAbove = requireRole(['ADMIN', 'SUPERVISOR']);
const requireSalesman = requireRole(['SALESMAN']);
const requireAnyValidRole = requireRole(['ADMIN', 'SUPERVISOR', 'SALESMAN']);

module.exports = {
  requireRole,
  requireAdmin,
  requireSupervisorOrAbove,
  requireSalesman,
  requireAnyValidRole
};
