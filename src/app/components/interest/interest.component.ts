import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { UserInterestService } from '../../services/user-interest.service';
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
    public userInterestSvc: UserInterestService
  ) { }

  ngOnInit() {
    this.rateForm = this.fb.group({
      monthKey: ['', Validators.required],
      rate: [0, [Validators.required, Validators.min(0), Validators.max(100)]], // Rate as a percentage (e.g., 5 for 5%)
    });

    this.loadRates();
  }

  private loadRates() {
    this.userInterestSvc.listUserRates().subscribe({
        next: (r) => {
        this.rates = r.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
      },
      error: () => {
        this.errorMessage = 'Error loading interest rates. Please try again.'
      }
    });
  }


  async applyInterest() {
    if (this.rateForm.invalid) return;

    this.loading = true;
    this.clearMessages();

    const { monthKey, rate } = this.rateForm.value;
    
    // Convert percentage to decimal (e.g., 12 -> 0.12)
    const decimalRate = rate / 100;

    // First, save the rate to rates collection
    await this.userInterestSvc.setUserMonthlyRate({ monthKey, rate: decimalRate });

    const applyInterestFn = httpsCallable(this.functions, 'applyMonthlyInterestAndRecalculate');

    try {
      const result: HttpsCallableResult = await applyInterestFn({ monthKey, rate: decimalRate });
      this.successMessage = (result.data as any).message || 'User interest applied successfully!';
      this.successMessage += ' Please refresh your reports to see the updated calculations.';

      this.rateForm.reset();

      // Refresh the rates list
      this.loadRates();

    } catch (error: any) {
      this.errorMessage = error.message || 'Error applying interest. Please try again.';
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
      // First, ensure the rate exists in rates collection
      await this.userInterestSvc.setUserMonthlyRate({ monthKey: rate.monthKey, rate: newRate });
      
      // Call backend function to update the rate and recalculate interest
      const updateRateFn = httpsCallable(this.functions, 'updateInterestRate');
      const result: HttpsCallableResult = await updateRateFn({ 
        monthKey: rate.monthKey, 
        oldRate: this.originalRate,
        newRate: newRate 
      });
      
      this.successMessage = (result.data as any).message || 'User interest rate updated successfully!';
      this.successMessage += ' Please refresh your reports to see the updated calculations.';

      // Update the local rates array immediately
      this.rates[index].rate = newRate;

      // Refresh the rates list to ensure UI is updated
      this.loadRates();

      this.cancelEdit();

    } catch (error: any) {
      this.errorMessage = error.message || 'Error updating interest rate. Please try again.';
    } finally {
      this.loading = false;
    }
  }
}
