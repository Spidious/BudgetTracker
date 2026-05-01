import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import db, { uuidv4 } from '../db';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();
router.use(requireAdmin);

// Admin routes explicitly never expose budget/spending data.
// They only operate on user accounts.

// GET /api/admin/users
router.get('/users', (req: Request, res: Response): void => {
  const users = db.prepare(
    'SELECT id, username, is_admin, force_password_change, created_at FROM users ORDER BY created_at'
  ).all();
  res.json(users);
});

// POST /api/admin/users/:id/reset-password
// Generates a random temporary password, returns it ONCE. Admin gives it to user out-of-band.
router.post('/users/:id/reset-password', (req: Request, res: Response): void => {
  const target = db.prepare('SELECT id, username, is_admin FROM users WHERE id = ?').get(req.params.id) as any;
  if (!target) { res.status(404).json({ error: 'User not found' }); return; }

  // Prevent resetting another admin's password (admins can only reset non-admin users)
  if (target.is_admin && target.id !== req.user!.id) {
    res.status(403).json({ error: 'Cannot reset another admin\'s password' });
    return;
  }

  const tempPassword = generateTempPassword();
  const hash = bcrypt.hashSync(tempPassword, 12);
  db.prepare(
    'UPDATE users SET password_hash = ?, force_password_change = 1 WHERE id = ?'
  ).run(hash, req.params.id);

  // Return temp password ONCE — admin is responsible for delivering it securely
  res.json({
    username: target.username,
    temporaryPassword: tempPassword,
    message: 'Password reset. User must change it on next login.',
  });
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', (req: Request, res: Response): void => {
  if (req.params.id === req.user!.id) {
    res.status(400).json({ error: 'Cannot delete your own account' });
    return;
  }
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (result.changes === 0) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({ ok: true });
});

// POST /api/admin/users — create a user (admin-created accounts)
router.post('/users', (req: Request, res: Response): void => {
  const { username, isAdmin } = req.body ?? {};
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    res.status(400).json({ error: 'Username must be at least 3 characters' }); return;
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(username.trim())) {
    res.status(400).json({ error: 'Username may only contain letters, numbers, underscores, dots, hyphens' }); return;
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existing) { res.status(409).json({ error: 'Username already taken' }); return; }

  const tempPassword = generateTempPassword();
  const hash = bcrypt.hashSync(tempPassword, 12);
  const id = uuidv4();
  db.prepare(
    'INSERT INTO users (id, username, password_hash, is_admin, force_password_change) VALUES (?, ?, ?, ?, 1)'
  ).run(id, username.trim(), hash, isAdmin ? 1 : 0);

  res.status(201).json({
    id,
    username: username.trim(),
    temporaryPassword: tempPassword,
    message: 'User created. They must change their password on first login.',
  });
});

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let pwd = '';
  for (let i = 0; i < 12; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

export default router;
