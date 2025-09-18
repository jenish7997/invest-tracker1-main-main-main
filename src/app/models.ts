export interface Transaction {
  id?: string;
  investorId: string;
  investorName: string;
  date: any; // Firestore Timestamp or Date
  type: 'invest' | 'withdraw' | 'deposit' | 'interest';
  amount: number;
}

export interface MonthlyRate {
  id?: string; // e.g. '2025-01'
  monthKey: string; // 'YYYY-MM'
  rate: number; // e.g. 0.02 for 2% monthly
}

export interface Investor {
  id?: string;
  name: string;
  email?: string;
  balance?: number;
}
