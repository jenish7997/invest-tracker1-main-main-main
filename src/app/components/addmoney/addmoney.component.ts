import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { InvestmentService } from '../../services/investment.service';
import { NotificationService } from '../../services/notification.service';
import { LoggerService } from '../../services/logger.service';
import { Investor, Transaction } from '../../models';

@Component({
  selector: 'app-addmoney',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './addmoney.component.html',
  styleUrls: ['./addmoney.component.css']
})
export class AddmoneyComponent implements OnInit {
  investors: Investor[] = [];
  transactionForm!: FormGroup;

  constructor(
    private fb: FormBuilder, 
    private svc: InvestmentService,
    private notificationService: NotificationService,
    private logger: LoggerService
  ) {}

  ngOnInit() {
    this.transactionForm = this.fb.group({
      investorId: ['', Validators.required],
      amount: [null, [Validators.required, Validators.min(1)]],
      date: ['', Validators.required]
    });

    // Load investors
    this.svc.listInvestors().subscribe(inv => (this.investors = inv));
  }

  // onInvestorChange(investorId: string) {
  //   if (!investorId) return;
  //   this.svc.listTransactionsByInvestor(investorId).subscribe(transactions => {
  //     console.log('Transactions for investor', investorId, transactions);
  //     this.SelectedInvestorTransection = transactions;
  //   });
  // }

  onSubmit() {
  if (this.transactionForm.valid) {
    const formData = this.transactionForm.value;

    const investor = this.investors.find(i => i.id === formData.investorId);

    const transactionData: Omit<Transaction, 'id'> = {
      investorId: formData.investorId,
      investorName: investor ? investor.name : '',
      amount: formData.amount,
      date: new Date(formData.date),
      type: 'invest'
    };

    this.svc.addTransaction(transactionData)
      .then(() => {
        this.transactionForm.reset({
          investorId: '',
          amount: null,
          date: ''
        });
        // Notify that a transaction was added
        this.notificationService.notifyTransactionAdded();
      })
      .catch(error => {
        this.logger.error('Error saving transaction', error);
      });
  } else {
    this.transactionForm.markAllAsTouched();
  }
}

}
