export interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  forcePasswordChange: boolean;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  color: string;
  sort_order: number;
}

export interface SavingsBucket {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  color: string;
}

export interface MonthData {
  monthId: string;
  income: number;
  spending: Record<string, number>;
  savingsContributions: Record<string, number>;
}

export interface Share {
  id: string;
  owner_id: string;
  recipient_id: string;
  recipient_username?: string;
  owner_username?: string;
  can_see_history: boolean;
  can_see_current_month: boolean;
  bucketVisibility?: Record<string, boolean>;
  created_at: string;
}

export interface SharedView {
  ownerUsername: string;
  shareId: string;
  canSeeHistory: boolean;
  canSeeCurrentMonth: boolean;
  categories: Category[];
  savingsBuckets: SavingsBucket[];
  months: Record<string, MonthData>;
}

export interface AdminUser {
  id: string;
  username: string;
  is_admin: number;
  force_password_change: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  month_id: string;
  date: string;
  description: string;
  original_description: string;
  amount: number;
  txn_type: 'income' | 'expense' | 'savings' | 'ignored';
  category_id: string | null;
  bucket_id: string | null;
  sort_order: number;
}

export interface CategoryRule {
  id: string;
  user_id: string;
  keyword: string;
  category_id: string;
}
