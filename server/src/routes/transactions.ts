import { Router, Request, Response } from 'express';
import db, { uuidv4 } from '../db';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

// GET /api/transactions/:monthId
router.get('/:monthId', (req: Request, res: Response): void => {
  const { monthId } = req.params;
  const rows = db.prepare(
    'SELECT * FROM transactions WHERE user_id = ? AND month_id = ? ORDER BY sort_order, date'
  ).all(req.user!.id, monthId);
  res.json(rows);
});

// POST /api/transactions/:monthId — bulk import (replaces existing)
router.post('/:monthId', (req: Request, res: Response): void => {
  const { monthId } = req.params;
  if (!/^\d{4}-\d{2}$/.test(monthId)) { res.status(400).json({ error: 'Invalid month format' }); return; }

  const { transactions } = req.body ?? {};
  if (!Array.isArray(transactions)) { res.status(400).json({ error: 'transactions array required' }); return; }

  const userId = req.user!.id;

  const doImport = db.transaction(() => {
    db.prepare('DELETE FROM transactions WHERE user_id = ? AND month_id = ?').run(userId, monthId);

    const insert = db.prepare(`
      INSERT INTO transactions (id, user_id, month_id, date, description, original_description, amount, txn_type, category_id, bucket_id, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      if (!t.description || t.amount == null) continue;

      // Verify category/bucket belong to this user
      let catId: string | null = null;
      let bucketId: string | null = null;
      if (t.category_id) {
        const cat = db.prepare('SELECT id FROM budget_categories WHERE id = ? AND user_id = ?').get(t.category_id, userId);
        if (cat) catId = t.category_id;
      }
      if (t.bucket_id) {
        const bkt = db.prepare('SELECT id FROM savings_buckets WHERE id = ? AND user_id = ?').get(t.bucket_id, userId);
        if (bkt) bucketId = t.bucket_id;
      }

      insert.run(
        uuidv4(), userId, monthId,
        t.date ?? '',
        String(t.description).trim(),
        String(t.original_description ?? t.description).trim(),
        Math.abs(Number(t.amount) || 0),
        ['income', 'expense', 'savings', 'ignored'].includes(t.txn_type) ? t.txn_type : 'expense',
        catId, bucketId, i
      );
    }
  });

  doImport();
  const saved = db.prepare(
    'SELECT * FROM transactions WHERE user_id = ? AND month_id = ? ORDER BY sort_order, date'
  ).all(userId, monthId);
  res.json(saved);
});

// PATCH /api/transactions/:monthId/:id — update a single transaction
router.patch('/:monthId/:id', (req: Request, res: Response): void => {
  const t = db.prepare(
    'SELECT * FROM transactions WHERE id = ? AND user_id = ? AND month_id = ?'
  ).get(req.params.id, req.user!.id, req.params.monthId) as any;
  if (!t) { res.status(404).json({ error: 'Not found' }); return; }

  const { description, txn_type, category_id, bucket_id, amount } = req.body ?? {};
  const userId = req.user!.id;

  let catId = t.category_id;
  let bucketId = t.bucket_id;
  if ('category_id' in req.body) {
    catId = null;
    if (category_id) {
      const cat = db.prepare('SELECT id FROM budget_categories WHERE id = ? AND user_id = ?').get(category_id, userId);
      if (cat) catId = category_id;
    }
  }
  if ('bucket_id' in req.body) {
    bucketId = null;
    if (bucket_id) {
      const bkt = db.prepare('SELECT id FROM savings_buckets WHERE id = ? AND user_id = ?').get(bucket_id, userId);
      if (bkt) bucketId = bucket_id;
    }
  }

  db.prepare(`
    UPDATE transactions SET
      description = ?, txn_type = ?, category_id = ?, bucket_id = ?, amount = ?
    WHERE id = ?
  `).run(
    description !== undefined ? String(description).trim() : t.description,
    txn_type && ['income','expense','savings','ignored'].includes(txn_type) ? txn_type : t.txn_type,
    catId,
    bucketId,
    amount !== undefined ? Math.abs(Number(amount)) : t.amount,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id));
});

// DELETE /api/transactions/:monthId/:id
router.delete('/:monthId/:id', (req: Request, res: Response): void => {
  const result = db.prepare(
    'DELETE FROM transactions WHERE id = ? AND user_id = ? AND month_id = ?'
  ).run(req.params.id, req.user!.id, req.params.monthId);
  if (result.changes === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ ok: true });
});

// GET /api/transactions/rules — category matching rules
router.get('/rules/all', (req: Request, res: Response): void => {
  res.json(db.prepare('SELECT * FROM category_rules WHERE user_id = ?').all(req.user!.id));
});

// PUT /api/transactions/rules — upsert a rule
router.put('/rules/all', (req: Request, res: Response): void => {
  const { keyword, category_id } = req.body ?? {};
  if (!keyword || !category_id) { res.status(400).json({ error: 'keyword and category_id required' }); return; }

  const cat = db.prepare('SELECT id FROM budget_categories WHERE id = ? AND user_id = ?').get(category_id, req.user!.id);
  if (!cat) { res.status(404).json({ error: 'Category not found' }); return; }

  db.prepare(`
    INSERT INTO category_rules (id, user_id, keyword, category_id) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, keyword) DO UPDATE SET category_id = excluded.category_id
  `).run(uuidv4(), req.user!.id, String(keyword).toLowerCase().trim(), category_id);

  res.json({ ok: true });
});

export default router;
