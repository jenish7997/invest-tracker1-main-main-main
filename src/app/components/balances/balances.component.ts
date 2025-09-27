import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Investor, Transaction, MonthlyRate } from '../../models';
import { InvestmentService } from '../../services/investment.service';


@Component({
  selector: 'app-balances',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './balances.component.html',
  styleUrls: ['./balances.component.css']
})
export class BalancesComponent implements OnInit {
  investors: Investor[] = [];
  rates: MonthlyRate[] = [];
  rows: any[] = [];
  form!: FormGroup;
  selectedInvestor: Investor | null = null;
  summary: any = null;

  constructor(private fb: FormBuilder, public svc: InvestmentService) {
    this.svc.listInvestors().subscribe(inv => this.investors = inv);
    this.svc.listRates().subscribe(r => this.rates = r.sort((a, b) => a.monthKey.localeCompare(b.monthKey)));
  }

  ngOnInit() {
    this.form = this.fb.group({
      investorId: ['', Validators.required],
      startMonthKey: [''],
      endMonthKey: [''],
    });
  }

  async run() {
    if (this.form.invalid) return;

    const v = this.form.value;
    const investor = this.investors.find(x => x.id === v.investorId);
    if (!investor) {
      this.rows = [];
      this.summary = null;
      return;
    }

    this.selectedInvestor = investor;
    await this.loadInvestorData(investor.id!, v.startMonthKey, v.endMonthKey);
  }

  async loadInvestorData(investorId: string, startMonthKey?: string, endMonthKey?: string) {
    const transactions = await this.svc.getTransactionsByInvestor(investorId);
    
    // Calculate monthly balances with interest
    this.rows = this.calculateMonthlyBalances(transactions, startMonthKey, endMonthKey);
    this.calculateSummary(transactions);
  }

  // Method to refresh data (can be called externally)
  async refreshData() {
    if (this.selectedInvestor) {
      const v = this.form.value;
      await this.loadInvestorData(this.selectedInvestor.id!, v.startMonthKey, v.endMonthKey);
    }
  }

  private calculateMonthlyBalances(transactions: Transaction[], startMonth?: string, endMonth?: string): any[] {
    const monthlyData = new Map<string, any>();
    
    // Group transactions by month
    transactions.forEach(transaction => {
      const date = transaction.date instanceof Date ? transaction.date : transaction.date.toDate();
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
          monthKey,
          transactions: [],
          principal: 0,
          interest: 0,
          withdrawals: 0,
          balance: 0
        });
      }
      
      const monthData = monthlyData.get(monthKey);
      monthData.transactions.push(transaction);
      
      if (transaction.type === 'invest' || transaction.type === 'deposit') {
        monthData.principal += transaction.amount;
      } else if (transaction.type === 'interest') {
        monthData.interest += transaction.amount;
      } else if (transaction.type === 'withdraw') {
        monthData.withdrawals += transaction.amount;
        monthData.principal -= transaction.amount; // Deduct withdrawals from principal
      }
    });

    // Calculate running balance and apply interest
    let runningBalance = 0;
    const sortedMonths = Array.from(monthlyData.keys()).sort();
    const result: any[] = [];

    for (const monthKey of sortedMonths) {
      const monthData = monthlyData.get(monthKey)!;
      
      // Apply transactions for this month
      monthData.transactions.forEach(transaction => {
        if (transaction.type === 'invest' || transaction.type === 'deposit' || transaction.type === 'interest') {
          runningBalance += transaction.amount;
        } else if (transaction.type === 'withdraw') {
          runningBalance -= transaction.amount;
        }
      });
      
      monthData.balance = runningBalance;
      
      // Find the rate for this month
      const rate = this.rates.find(r => r.monthKey === monthKey);
      monthData.rate = rate ? rate.rate : 0;
      
      // Apply filters
      if (startMonth && monthKey < startMonth) return;
      if (endMonth && monthKey > endMonth) return;
      
      result.push(monthData);
    }

    return result;
  }

  private calculateSummary(transactions: Transaction[]) {
    let principalAmount = 0;
    let totalInterest = 0;
    let totalWithdrawals = 0;
    const interestByMonth: { month: string; amount: number; rate: number }[] = [];

    transactions.forEach(transaction => {
      if (transaction.type === 'invest' || transaction.type === 'deposit') {
        principalAmount += transaction.amount;
      } else if (transaction.type === 'withdraw') {
        principalAmount -= transaction.amount; // Deduct withdrawals from principal
      } else if (transaction.type === 'interest') {
        totalInterest += transaction.amount;
        
        // Find the month and rate for this interest
        const date = transaction.date instanceof Date ? transaction.date : transaction.date.toDate();
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const rate = this.rates.find(r => r.monthKey === monthKey);
        
        interestByMonth.push({
          month: monthKey,
          amount: transaction.amount,
          rate: rate ? rate.rate * 100 : 0
        });
      } else if (transaction.type === 'withdraw') {
        totalWithdrawals += transaction.amount;
      }
    });

    this.summary = {
      principalAmount,
      totalInterest,
      totalWithdrawals,
      grownCapital: principalAmount + totalInterest - totalWithdrawals,
      interestByMonth: interestByMonth.sort((a, b) => a.month.localeCompare(b.month))
    };
  }
}
