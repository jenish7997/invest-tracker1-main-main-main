import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { InvestmentService } from '../../services/investment.service';
import { MonthlyRate } from '../../models';
import { CommonModule } from '@angular/common';
import { Functions, httpsCallable, HttpsCallableResult } from '@angular/fire/functions';

@Component({
  selector: 'app-interest',
  templateUrl: './interest.component.html',
  styleUrls: ['./interest.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
})
export class InterestComponent implements OnInit {
  rateForm!: FormGroup;
  rates: MonthlyRate[] = [];
  loading: boolean = false;
  successMessage: string = '';
  errorMessage: string = '';
  
  // Edit functionality
  editingRate: boolean = false;
  editingIndex: number = -1;
  editRateValue: number = 0;
  originalRate: number = 0;

  constructor(
    private fb: FormBuilder,
    private functions: Functions,
    public svc: InvestmentService
  ) { }

  ngOnInit() {
    this.rateForm = this.fb.group({
      monthKey: ['', Validators.required],
      rate: [0, [Validators.required, Validators.min(0), Validators.max(100)]], // Rate as a percentage (e.g., 5 for 5%)
    });

    this.svc.listRates().subscribe(r => {
      this.rates = r.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    });
  }

  async applyInterest() {
    if (this.rateForm.invalid) return;

    this.loading = true;
    this.clearMessages();

    const { monthKey, rate } = this.rateForm.value;
    
    // Convert percentage to decimal (e.g., 12 -> 0.12)
    const decimalRate = rate / 100;

    const applyInterestFn = httpsCallable(this.functions, 'applyMonthlyInterestAndRecalculate');

    try {
      const result: HttpsCallableResult = await applyInterestFn({ monthKey, rate: decimalRate });
      this.successMessage = (result.data as any).message || 'Interest applied successfully!';
      this.successMessage += ' Please refresh your reports to see the updated calculations.';

      this.rateForm.reset();

      // Refresh the rates list
      this.svc.listRates().subscribe(r => {
        this.rates = r.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
      });

    } catch (error: any) {
      this.errorMessage = error.message || 'Error applying interest. Please try again.';
      console.error('Error applying interest:', error);
    } finally {
      this.loading = false;
    }
  }

  clearMessages() {
    this.successMessage = '';
    this.errorMessage = '';
  }

  startEdit(rate: MonthlyRate, index: number) {
    this.editingRate = true;
    this.editingIndex = index;
    this.editRateValue = rate.rate * 100; // Convert to percentage
    this.originalRate = rate.rate;
  }

  cancelEdit() {
    this.editingRate = false;
    this.editingIndex = -1;
    this.editRateValue = 0;
    this.originalRate = 0;
  }

  async saveRateEdit(rate: MonthlyRate, index: number) {
    if (this.editRateValue < 0 || this.editRateValue > 100) {
      this.errorMessage = 'Rate must be between 0 and 100.';
      return;
    }

    this.loading = true;
    this.clearMessages();

    const newRate = this.editRateValue / 100; // Convert percentage to decimal

    try {
      // Call backend function to update the rate and recalculate interest
      const updateRateFn = httpsCallable(this.functions, 'updateInterestRate');
      const result: HttpsCallableResult = await updateRateFn({ 
        monthKey: rate.monthKey, 
        oldRate: this.originalRate,
        newRate: newRate 
      });
      
      this.successMessage = (result.data as any).message || 'Interest rate updated successfully!';
      this.successMessage += ' Please refresh your reports to see the updated calculations.';

      // Update the local rates array
      this.rates[index].rate = newRate;

      // Refresh the rates list
      this.svc.listRates().subscribe(r => {
        this.rates = r.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
      });

      this.cancelEdit();

    } catch (error: any) {
      this.errorMessage = error.message || 'Error updating interest rate. Please try again.';
      console.error('Error updating interest rate:', error);
    } finally {
      this.loading = false;
    }
  }
}
