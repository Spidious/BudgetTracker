import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import path from 'path';

// ── JWT secret (generate once, persist to file in data dir) ──────────────────
import fs from 'fs';
const SECRET_FILE = path.join(process.cwd(), '../data/.jwt_secret');
let JWT_SECRET: string;
try {
  JWT_SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim();
} catch {
  JWT_SECRET = crypto.randomBytes(48).toString('hex');
  fs.mkdirSync(path.dirname(SECRET_FILE), { recursive: true });
  fs.writeFileSync(SECRET_FILE, JWT_SECRET, { mode: 0o600 });
}
export { JWT_SECRET };

export const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  secure: process.env.NODE_ENV === 'production',
};

// ── Import db (runs schema + seed) ───────────────────────────────────────────
import './db';

// ── Routes ───────────────────────────────────────────────────────────────────
import authRouter from './routes/auth';
import budgetRouter from './routes/budget';
import sharesRouter from './routes/shares';
import adminRouter from './routes/admin';
import transactionsRouter from './routes/transactions';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api/auth',         authRouter);
app.use('/api/budget',       budgetRouter);
app.use('/api/shares',       sharesRouter);
app.use('/api/admin',        adminRouter);
app.use('/api/transactions', transactionsRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`BudgetTracker API running on http://localhost:${PORT}`);
});
