import { Router, Request, Response } from 'express';
import db, { uuidv4 } from '../db';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

// ─── Categories ──────────────────────────────────────────────────────────────

router.get('/categories', (req: Request, res: Response): void => {
  const rows = db.prepare(
    'SELECT * FROM budget_categories WHERE user_id = ? ORDER BY sort_order'
  ).all(req.user!.id);
  res.json(rows);
});

router.post('/categories', (req: Request, res: Response): void => {
  const { name, targetAmount, color } = req.body ?? {};
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'Name required' });
    return;
  }
  const maxOrder = (db.prepare(
    'SELECT MAX(sort_order) as m FROM budget_categories WHERE user_id = ?'
  ).get(req.user!.id) as any)?.m ?? -1;

  const id = uuidv4();
  db.prepare(
    'INSERT INTO budget_categories (id, user_id, name, target_amount, color, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, req.user!.id, name.trim(), Number(targetAmount) || 0, color || '#6366f1', maxOrder + 1);

  res.status(201).json(db.prepare('SELECT * FROM budget_categories WHERE id = ?').get(id));
});

router.put('/categories/:id', (req: Request, res: Response): void => {
  const cat = db.prepare(
    'SELECT * FROM budget_categories WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.user!.id);
  if (!cat) { res.status(404).json({ error: 'Not found' }); return; }

  const { name, targetAmount, color } = req.body ?? {};
  db.prepare(
    'UPDATE budget_categories SET name = ?, target_amount = ?, color = ? WHERE id = ?'
  ).run(
    name ? String(name).trim() : (cat as any).name,
    targetAmount !== undefined ? Number(targetAmount) : (cat as any).target_amount,
    color || (cat as any).color,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM budget_categories WHERE id = ?').get(req.params.id));
});

router.delete('/categories/:id', (req: Request, res: Response): void => {
  const result = db.prepare(
    'DELETE FROM budget_categories WHERE id = ? AND user_id = ?'
  ).run(req.params.id, req.user!.id);
  if (result.changes === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ ok: true });
});

// ─── Savings Buckets ─────────────────────────────────────────────────────────

router.get('/buckets', (req: Request, res: Response): void => {
  const rows = db.prepare(
    'SELECT * FROM savings_buckets WHERE user_id = ?'
  ).all(req.user!.id);
  res.json(rows);
});

router.post('/buckets', (req: Request, res: Response): void => {
  const { name, targetAmount, color } = req.body ?? {};
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'Name required' });
    return;
  }
  const id = uuidv4();
  db.prepare(
    'INSERT INTO savings_buckets (id, user_id, name, target_amount, color) VALUES (?, ?, ?, ?, ?)'
  ).run(id, req.user!.id, name.trim(), Number(targetAmount) || 0, color || '#6366f1');
  res.status(201).json(db.prepare('SELECT * FROM savings_buckets WHERE id = ?').get(id));
});

router.put('/buckets/:id', (req: Request, res: Response): void => {
  const bucket = db.prepare(
    'SELECT * FROM savings_buckets WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.user!.id);
  if (!bucket) { res.status(404).json({ error: 'Not found' }); return; }

  const { name, targetAmount, color } = req.body ?? {};
  db.prepare(
    'UPDATE savings_buckets SET name = ?, target_amount = ?, color = ? WHERE id = ?'
  ).run(
    name ? String(name).trim() : (bucket as any).name,
    targetAmount !== undefined ? Number(targetAmount) : (bucket as any).target_amount,
    color || (bucket as any).color,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM savings_buckets WHERE id = ?').get(req.params.id));
});

router.delete('/buckets/:id', (req: Request, res: Response): void => {
  const result = db.prepare(
    'DELETE FROM savings_buckets WHERE id = ? AND user_id = ?'
  ).run(req.params.id, req.user!.id);
  if (result.changes === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ ok: true });
});

// ─── Month Data ───────────────────────────────────────────────────────────────

router.get('/months/:monthId', (req: Request, res: Response): void => {
  const row = db.prepare(
    'SELECT * FROM month_data WHERE user_id = ? AND month_id = ?'
  ).get(req.user!.id, req.params.monthId) as any;

  if (!row) {
    res.json({ monthId: req.params.monthId, income: 0, spending: {}, savingsContributions: {} });
    return;
  }

  const spending = Object.fromEntries(
    (db.prepare('SELECT category_id, amount FROM month_spending WHERE month_data_id = ?').all(row.id) as any[])
      .map((r: any) => [r.category_id, r.amount])
  );
  const savingsContributions = Object.fromEntries(
    (db.prepare('SELECT bucket_id, amount FROM month_savings WHERE month_data_id = ?').all(row.id) as any[])
      .map((r: any) => [r.bucket_id, r.amount])
  );

  res.json({ monthId: row.month_id, income: row.income, spending, savingsContributions });
});

router.put('/months/:monthId', (req: Request, res: Response): void => {
  const { income, spending, savingsContributions } = req.body ?? {};
  const userId = req.user!.id;
  const monthId = req.params.monthId;

  if (!/^\d{4}-\d{2}$/.test(monthId)) {
    res.status(400).json({ error: 'Invalid month format (YYYY-MM)' });
    return;
  }

  // Upsert month_data
  let row = db.prepare(
    'SELECT id FROM month_data WHERE user_id = ? AND month_id = ?'
  ).get(userId, monthId) as any;

  if (!row) {
    const id = uuidv4();
    db.prepare(
      'INSERT INTO month_data (id, user_id, month_id, income) VALUES (?, ?, ?, ?)'
    ).run(id, userId, monthId, Number(income) || 0);
    row = { id };
  } else {
    if (income !== undefined) {
      db.prepare('UPDATE month_data SET income = ? WHERE id = ?').run(Number(income) || 0, row.id);
    }
  }

  // Upsert spending entries
  if (spending && typeof spending === 'object') {
    const upsertSpend = db.prepare(
      'INSERT INTO month_spending (month_data_id, category_id, amount) VALUES (?, ?, ?) ' +
      'ON CONFLICT(month_data_id, category_id) DO UPDATE SET amount = excluded.amount'
    );
    for (const [catId, amount] of Object.entries(spending)) {
      // Verify category belongs to this user
      const cat = db.prepare('SELECT id FROM budget_categories WHERE id = ? AND user_id = ?').get(catId, userId);
      if (cat) upsertSpend.run(row.id, catId, Number(amount) || 0);
    }
  }

  // Upsert savings contributions
  if (savingsContributions && typeof savingsContributions === 'object') {
    const upsertSaving = db.prepare(
      'INSERT INTO month_savings (month_data_id, bucket_id, amount) VALUES (?, ?, ?) ' +
      'ON CONFLICT(month_data_id, bucket_id) DO UPDATE SET amount = excluded.amount'
    );
    for (const [bucketId, amount] of Object.entries(savingsContributions)) {
      const bucket = db.prepare('SELECT id FROM savings_buckets WHERE id = ? AND user_id = ?').get(bucketId, userId);
      if (bucket) upsertSaving.run(row.id, bucketId, Number(amount) || 0);
    }
  }

  // Return updated month
  const updated = db.prepare('SELECT * FROM month_data WHERE id = ?').get(row.id) as any;
  const spendingOut = Object.fromEntries(
    (db.prepare('SELECT category_id, amount FROM month_spending WHERE month_data_id = ?').all(row.id) as any[])
      .map((r: any) => [r.category_id, r.amount])
  );
  const savingsOut = Object.fromEntries(
    (db.prepare('SELECT bucket_id, amount FROM month_savings WHERE month_data_id = ?').all(row.id) as any[])
      .map((r: any) => [r.bucket_id, r.amount])
  );

  res.json({ monthId: updated.month_id, income: updated.income, spending: spendingOut, savingsContributions: savingsOut });
});

export default router;
