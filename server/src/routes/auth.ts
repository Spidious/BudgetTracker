import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import db, { uuidv4 } from '../db';
import { JWT_SECRET, COOKIE_OPTS } from '../index';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

function issueToken(user: { id: string; username: string; is_admin: number; force_password_change: number }, res: Response) {
  const payload = {
    id: user.id,
    username: user.username,
    isAdmin: user.is_admin === 1,
    forcePasswordChange: user.force_password_change === 1,
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
  res.cookie('token', token, COOKIE_OPTS);
  return payload;
}

// POST /api/auth/register
router.post('/register', authLimiter, (req: Request, res: Response): void => {
  const { username, password } = req.body ?? {};

  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    res.status(400).json({ error: 'Username must be at least 3 characters' });
    return;
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }
  // Disallow special chars in username that could cause confusion
  if (!/^[a-zA-Z0-9_.-]+$/.test(username.trim())) {
    res.status(400).json({ error: 'Username may only contain letters, numbers, underscores, dots, hyphens' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existing) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }

  const hash = bcrypt.hashSync(password, 12);
  const id = uuidv4();
  db.prepare(
    'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)'
  ).run(id, username.trim(), hash);

  const DEFAULT_COLORS = ['#6366f1','#10b981','#f97316','#06b6d4','#ec4899','#eab308'];
  const defaults = [
    { name: 'Housing',   target: 1500, color: '#6366f1' },
    { name: 'Food',      target: 600,  color: '#10b981' },
    { name: 'Transport', target: 300,  color: '#f97316' },
    { name: 'Utilities', target: 200,  color: '#06b6d4' },
    { name: 'Hobbies',   target: 250,  color: '#ec4899' },
    { name: 'Other',     target: 150,  color: '#eab308' },
  ];
  const insertCat = db.prepare(
    'INSERT INTO budget_categories (id, user_id, name, target_amount, color, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  );
  defaults.forEach((d, i) => insertCat.run(uuidv4(), id, d.name, d.target, d.color, i));

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  const payload = issueToken(user, res);
  res.status(201).json({ user: payload });
});

// POST /api/auth/login
router.post('/login', authLimiter, (req: Request, res: Response): void => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim()) as any;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  const payload = issueToken(user, res);
  res.json({ user: payload });
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response): void => {
  res.clearCookie('token', { path: '/' });
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: Request, res: Response): void => {
  res.json({ user: req.user });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, (req: Request, res: Response): void => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Both current and new password required' });
    return;
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as any;
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }

  const hash = bcrypt.hashSync(newPassword, 12);
  db.prepare(
    'UPDATE users SET password_hash = ?, force_password_change = 0 WHERE id = ?'
  ).run(hash, req.user!.id);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as any;
  const payload = issueToken(updated, res);
  res.json({ user: payload });
});

export default router;
