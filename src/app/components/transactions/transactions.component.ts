import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { InvestmentService } from '../../services/investment.service';
import { Investor, Transaction } from '../../models';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './transactions.component.html',
  styleUrls: ['./transactions.component.css']
})
export class TransactionsComponent implements OnInit {
  investors: Investor[] = [];
  transactionForm!: FormGroup;
  SelectedInvestorTransection: any[] = [];

  constructor(private fb: FormBuilder, private svc: InvestmentService) { }

  ngOnInit() {
    this.transactionForm = this.fb.group({
      investorId: ['', Validators.required],
      amount: [null, [Validators.required, Validators.min(1)]],
      date: ['', Validators.required]
    });

    // Load investors
    this.svc.listInvestors().subscribe(inv => (this.investors = inv));
  }

  onInvestorChange(event?: Event) {
    const selectEl = event?.target as HTMLSelectElement;
    const investorId = selectEl.value;
    if (!investorId) return;
    this.svc.listTransactionsByInvestor(investorId).subscribe(transactions => {
      console.log('Transactions for investor', investorId, transactions);
      // Filter out interest transactions - only show invest and withdraw
      this.SelectedInvestorTransection = transactions.filter(transaction => 
        transaction.type === 'invest' || transaction.type === 'withdraw' || transaction.type === 'deposit'
      );
    });
  }

}
