import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { InvestmentService } from '../../services/investment.service';
import { NotificationService } from '../../services/notification.service';
import { LoggerService } from '../../services/logger.service';
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

  constructor(
    private fb: FormBuilder, 
    private svc: InvestmentService,
    private notificationService: NotificationService,
    private logger: LoggerService
  ) { }

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
      // Filter out interest transactions - only show invest and withdraw
      // The service already sorts by date and createdAt, so we just filter here
      this.SelectedInvestorTransection = transactions.filter(transaction => 
        transaction.type === 'invest' || transaction.type === 'withdraw' || transaction.type === 'deposit'
      );
    });
  }

  deleteTransaction(transaction: Transaction) {
    // Show confirmation dialog
    const confirmMessage = `Are you sure you want to delete this ${transaction.type} transaction of ₹${transaction.amount}?`;
    
    if (confirm(confirmMessage)) {
      this.logger.debug('Deleting transaction', { transactionId: transaction.id, type: transaction.type, amount: transaction.amount });
      
      // Call the service to delete the transaction
      this.svc.deleteTransaction(transaction.id!).then(() => {
        alert('Transaction deleted successfully');
        this.logger.logFinancialData('Transaction deleted', transaction);
        
        // Refresh the transactions list by getting the current investor ID
        const currentInvestorId = this.transactionForm.get('investorId')?.value;
        if (currentInvestorId) {
          this.svc.listTransactionsByInvestor(currentInvestorId).subscribe(transactions => {
            // Filter out interest transactions - only show invest and withdraw
            // The service already sorts by date and createdAt, so we just filter here
            this.SelectedInvestorTransection = transactions.filter(transaction => 
              transaction.type === 'invest' || transaction.type === 'withdraw' || transaction.type === 'deposit'
            );
          });
        }
      }).catch(error => {
        alert('Failed to delete transaction');
        this.logger.error('Error deleting transaction', error);
      });
    }
  }

}
