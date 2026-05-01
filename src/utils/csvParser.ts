export interface RawTransaction {
  id: string;
  date: string;
  description: string;
  original_description: string;
  amount: number;       // always positive
  txn_type: 'income' | 'expense' | 'savings' | 'ignored';
  category_id: string | null;
  bucket_id: string | null;
}

// ── CSV line parser that handles quoted fields ────────────────────────────────
function parseLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      fields.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur.trim());
  return fields;
}

function findCol(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex((h) => h.includes(c));
    if (idx !== -1) return idx;
  }
  return -1;
}

function normalizeDate(raw: string): string {
  if (!raw) return '';
  // Handle MM/DD/YYYY, MM-DD-YYYY, YYYY-MM-DD, M/D/YY
  const slashUs = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashUs) {
    const [, m, d, y] = slashUs;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const dashUs = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (dashUs) {
    const [, m, d, y] = dashUs;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return raw;
}

let seq = 0;
function tmpId() { return `tmp_${Date.now()}_${seq++}`; }

export function parseCSV(text: string): RawTransaction[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Skip non-header preamble lines (banks sometimes add account info before headers)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const h = parseLine(lines[i]).map((c) => c.toLowerCase());
    if (h.some((c) => c.includes('date') || c.includes('description') || c.includes('amount') || c.includes('debit'))) {
      headerIdx = i;
      break;
    }
  }

  const headers = parseLine(lines[headerIdx]).map((h) => h.toLowerCase().replace(/[^a-z ]/g, '').trim());

  const dateIdx = findCol(headers, ['posting date', 'transaction date', 'trans date', 'date']);
  const descIdx = findCol(headers, ['description', 'memo', 'payee', 'merchant', 'name', 'details', 'narrative']);
  const amtIdx  = findCol(headers, ['transaction amount', 'amount']);
  const debitIdx = findCol(headers, ['debit', 'withdrawal', 'withdrawals', 'charge']);
  const creditIdx = findCol(headers, ['credit', 'deposit', 'deposits', 'payment']);

  if (descIdx === -1) return [];

  const results: RawTransaction[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const desc = cols[descIdx]?.trim() ?? '';
    if (!desc) continue;

    let amount = 0;
    let txn_type: 'income' | 'expense' = 'expense';

    if (amtIdx !== -1 && cols[amtIdx]) {
      const raw = cols[amtIdx].replace(/[$,\s]/g, '');
      const signed = parseFloat(raw);
      if (isNaN(signed) || signed === 0) continue;
      amount = Math.abs(signed);
      // Positive = deposit/income in most formats; negative = purchase/expense
      txn_type = signed > 0 ? 'income' : 'expense';
    } else if (debitIdx !== -1 || creditIdx !== -1) {
      const debitRaw  = debitIdx  !== -1 ? cols[debitIdx]?.replace(/[$,\s]/g, '')  ?? '' : '';
      const creditRaw = creditIdx !== -1 ? cols[creditIdx]?.replace(/[$,\s]/g, '') ?? '' : '';
      const debit  = Math.abs(parseFloat(debitRaw)  || 0);
      const credit = Math.abs(parseFloat(creditRaw) || 0);
      if (debit > 0)       { amount = debit;  txn_type = 'expense'; }
      else if (credit > 0) { amount = credit; txn_type = 'income';  }
      else continue;
    } else {
      continue;
    }

    const date = dateIdx !== -1 ? normalizeDate(cols[dateIdx]?.trim() ?? '') : '';

    results.push({ id: tmpId(), date, description: desc, original_description: desc, amount, txn_type, category_id: null, bucket_id: null });
  }

  return results;
}

// ── Detect potential transfer pairs (same merchant, both income+expense) ──────
export interface TransferGroup {
  key: string;
  transactions: RawTransaction[];
  netAmount: number;
  netType: 'income' | 'expense';
}

function normalizeKey(desc: string): string {
  return desc.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30);
}

export function detectTransferPairs(txns: RawTransaction[]): TransferGroup[] {
  const groups = new Map<string, RawTransaction[]>();
  for (const t of txns) {
    const key = normalizeKey(t.description);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const result: TransferGroup[] = [];
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const hasIncome  = group.some((t) => t.txn_type === 'income');
    const hasExpense = group.some((t) => t.txn_type === 'expense');
    if (!hasIncome || !hasExpense) continue;

    const net = group.reduce((s, t) => s + (t.txn_type === 'income' ? t.amount : -t.amount), 0);
    result.push({ key, transactions: group, netAmount: Math.abs(net), netType: net >= 0 ? 'income' : 'expense' });
  }
  return result;
}

// ── Auto-categorize against keyword rules ────────────────────────────────────
export function autoCategorize(
  txns: RawTransaction[],
  rules: Array<{ keyword: string; category_id: string }>
): RawTransaction[] {
  return txns.map((t) => {
    if (t.category_id) return t;
    const desc = t.description.toLowerCase();
    for (const rule of rules) {
      if (desc.includes(rule.keyword.toLowerCase())) {
        return { ...t, category_id: rule.category_id };
      }
    }
    return t;
  });
}
