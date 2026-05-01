import { Router, Request, Response } from 'express';
import db, { uuidv4 } from '../db';
import { requireAuth } from '../middleware/requireAuth';
import { getCurrentMonthId } from '../utils';

const router = Router();
router.use(requireAuth);

// GET /api/shares — shares I created (outgoing) + shares others made with me (incoming)
router.get('/', (req: Request, res: Response): void => {
  const userId = req.user!.id;

  const outgoing = (db.prepare(`
    SELECT s.*, u.username AS recipient_username
    FROM shares s
    JOIN users u ON u.id = s.recipient_id
    WHERE s.owner_id = ?
  `).all(userId) as any[]).map((s) => ({
    ...s,
    can_see_history: s.can_see_history === 1,
    can_see_current_month: s.can_see_current_month === 1,
    bucketVisibility: Object.fromEntries(
      (db.prepare('SELECT bucket_id, is_visible FROM share_bucket_visibility WHERE share_id = ?').all(s.id) as any[])
        .map((r: any) => [r.bucket_id, r.is_visible === 1])
    ),
  }));

  const incoming = (db.prepare(`
    SELECT s.*, u.username AS owner_username
    FROM shares s
    JOIN users u ON u.id = s.owner_id
    WHERE s.recipient_id = ?
  `).all(userId) as any[]).map((s) => ({
    ...s,
    can_see_history: s.can_see_history === 1,
    can_see_current_month: s.can_see_current_month === 1,
  }));

  res.json({ outgoing, incoming });
});

// POST /api/shares — create a share
router.post('/', (req: Request, res: Response): void => {
  const { recipientUsername, canSeeHistory, canSeeCurrentMonth } = req.body ?? {};
  const userId = req.user!.id;

  if (!recipientUsername) { res.status(400).json({ error: 'Recipient username required' }); return; }

  const recipient = db.prepare('SELECT id FROM users WHERE username = ?').get(recipientUsername.trim()) as any;
  if (!recipient) { res.status(404).json({ error: 'User not found' }); return; }
  if (recipient.id === userId) { res.status(400).json({ error: 'Cannot share with yourself' }); return; }

  const existing = db.prepare('SELECT id FROM shares WHERE owner_id = ? AND recipient_id = ?').get(userId, recipient.id);
  if (existing) { res.status(409).json({ error: 'Already sharing with this user' }); return; }

  const id = uuidv4();
  db.prepare(
    'INSERT INTO shares (id, owner_id, recipient_id, can_see_history, can_see_current_month) VALUES (?, ?, ?, ?, ?)'
  ).run(id, userId, recipient.id, canSeeHistory !== false ? 1 : 0, canSeeCurrentMonth !== false ? 1 : 0);

  // Default all existing buckets to visible
  const buckets = db.prepare('SELECT id FROM savings_buckets WHERE user_id = ?').all(userId) as any[];
  const insertVis = db.prepare('INSERT OR IGNORE INTO share_bucket_visibility (share_id, bucket_id, is_visible) VALUES (?, ?, 1)');
  for (const b of buckets) insertVis.run(id, b.id);

  res.status(201).json(db.prepare(`
    SELECT s.*, u.username AS recipient_username
    FROM shares s JOIN users u ON u.id = s.recipient_id WHERE s.id = ?
  `).get(id));
});

// PUT /api/shares/:id — update share settings
router.put('/:id', (req: Request, res: Response): void => {
  const share = db.prepare('SELECT * FROM shares WHERE id = ? AND owner_id = ?').get(req.params.id, req.user!.id) as any;
  if (!share) { res.status(404).json({ error: 'Share not found' }); return; }

  const { canSeeHistory, canSeeCurrentMonth, bucketVisibility } = req.body ?? {};

  db.prepare(
    'UPDATE shares SET can_see_history = ?, can_see_current_month = ? WHERE id = ?'
  ).run(
    canSeeHistory !== undefined ? (canSeeHistory ? 1 : 0) : share.can_see_history,
    canSeeCurrentMonth !== undefined ? (canSeeCurrentMonth ? 1 : 0) : share.can_see_current_month,
    req.params.id
  );

  // Update per-bucket visibility
  if (bucketVisibility && typeof bucketVisibility === 'object') {
    const upsertVis = db.prepare(
      'INSERT INTO share_bucket_visibility (share_id, bucket_id, is_visible) VALUES (?, ?, ?) ' +
      'ON CONFLICT(share_id, bucket_id) DO UPDATE SET is_visible = excluded.is_visible'
    );
    for (const [bucketId, visible] of Object.entries(bucketVisibility)) {
      const bucket = db.prepare('SELECT id FROM savings_buckets WHERE id = ? AND user_id = ?').get(bucketId, req.user!.id);
      if (bucket) upsertVis.run(req.params.id, bucketId, visible ? 1 : 0);
    }
  }

  res.json({ ok: true });
});

// DELETE /api/shares/:id
router.delete('/:id', (req: Request, res: Response): void => {
  const result = db.prepare('DELETE FROM shares WHERE id = ? AND owner_id = ?').run(req.params.id, req.user!.id);
  if (result.changes === 0) { res.status(404).json({ error: 'Share not found' }); return; }
  res.json({ ok: true });
});

// GET /api/shares/:id/view — view shared budget (recipient only)
router.get('/:id/view', (req: Request, res: Response): void => {
  const userId = req.user!.id;

  const share = db.prepare(`
    SELECT s.*, u.username AS owner_username
    FROM shares s JOIN users u ON u.id = s.owner_id
    WHERE s.id = ? AND s.recipient_id = ?
  `).get(req.params.id, userId) as any;

  if (!share) { res.status(404).json({ error: 'Share not found' }); return; }

  const ownerId = share.owner_id;
  const canHistory = share.can_see_history === 1;
  const canCurrent = share.can_see_current_month === 1;
  const currentMonthId = getCurrentMonthId();

  // Categories (always included if share exists)
  const categories = db.prepare(
    'SELECT * FROM budget_categories WHERE user_id = ? ORDER BY sort_order'
  ).all(ownerId);

  // Visible bucket IDs
  const bucketVis = Object.fromEntries(
    (db.prepare('SELECT bucket_id, is_visible FROM share_bucket_visibility WHERE share_id = ?').all(share.id) as any[])
      .map((r: any) => [r.bucket_id, r.is_visible === 1])
  );
  const allBuckets = db.prepare('SELECT * FROM savings_buckets WHERE user_id = ?').all(ownerId) as any[];
  const visibleBuckets = allBuckets.filter((b) => bucketVis[b.id] !== false);

  // Month data — filtered by permissions
  const monthRows = db.prepare('SELECT * FROM month_data WHERE user_id = ?').all(ownerId) as any[];
  const months: Record<string, any> = {};

  for (const row of monthRows) {
    const isCurrentMonth = row.month_id === currentMonthId;
    const isPast = row.month_id < currentMonthId;

    if (isCurrentMonth && !canCurrent) continue;
    if (isPast && !canHistory) continue;

    const spending = Object.fromEntries(
      (db.prepare('SELECT category_id, amount FROM month_spending WHERE month_data_id = ?').all(row.id) as any[])
        .map((r: any) => [r.category_id, r.amount])
    );

    // Only include visible savings buckets
    const visibleBucketIds = new Set(visibleBuckets.map((b) => b.id));
    const savingsAll = db.prepare('SELECT bucket_id, amount FROM month_savings WHERE month_data_id = ?').all(row.id) as any[];
    const savingsContributions = Object.fromEntries(
      savingsAll.filter((r: any) => visibleBucketIds.has(r.bucket_id)).map((r: any) => [r.bucket_id, r.amount])
    );

    months[row.month_id] = { monthId: row.month_id, income: row.income, spending, savingsContributions };
  }

  res.json({
    ownerUsername: share.owner_username,
    shareId: share.id,
    canSeeHistory: canHistory,
    canSeeCurrentMonth: canCurrent,
    categories,
    savingsBuckets: visibleBuckets,
    months,
  });
});

export default router;
