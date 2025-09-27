import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { AdminInterestService } from '../../services/admin-interest.service';
import { MonthlyRate } from '../../models';
import { CommonModule } from '@angular/common';
import { Functions, httpsCallable, HttpsCallableResult } from '@angular/fire/functions';

@Component({
  selector: 'app-admin-interest',
  templateUrl: './admin-interest.component.html',
  styleUrls: ['./admin-interest.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
})
export class AdminInterestComponent implements OnInit {
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
    public adminInterestSvc: AdminInterestService
  ) { }

  ngOnInit() {
    this.rateForm = this.fb.group({
      monthKey: ['', Validators.required],
      rate: [0, [Validators.required, Validators.min(0), Validators.max(100)]], // Rate as a percentage (e.g., 5 for 5%)
    });

    this.adminInterestSvc.listAdminRates().subscribe(r => {
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

    console.log(`[ADMIN-INTEREST] 🔥 APPLYING ADMIN RATE: ${monthKey} = ${rate}% (${decimalRate} decimal)`);
    console.log(`[ADMIN-INTEREST] 🔥 Calling Firebase function: applyAdminMonthlyInterestAndRecalculate`);
    console.log(`[ADMIN-INTEREST] 🔥 This should ONLY write to adminRates collection, NOT rates collection!`);

    const applyInterestFn = httpsCallable(this.functions, 'applyAdminMonthlyInterestAndRecalculate');

    try {
      const result: HttpsCallableResult = await applyInterestFn({ monthKey, rate: decimalRate });
      this.successMessage = (result.data as any).message || 'Admin interest applied successfully!';
      this.successMessage += ' Please refresh your admin reports to see the updated calculations.';

      this.rateForm.reset();

      // Refresh the rates list
      this.adminInterestSvc.listAdminRates().subscribe(r => {
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
      // Call backend function to update the admin rate and recalculate interest
      const updateRateFn = httpsCallable(this.functions, 'updateAdminInterestRate');
      const result: HttpsCallableResult = await updateRateFn({ 
        monthKey: rate.monthKey, 
        oldRate: this.originalRate,
        newRate: newRate 
      });
      
      this.successMessage = (result.data as any).message || 'Admin interest rate updated successfully!';
      this.successMessage += ' Please refresh your admin reports to see the updated calculations.';

      // Update the local rates array
      this.rates[index].rate = newRate;

      // Refresh the rates list
      this.adminInterestSvc.listAdminRates().subscribe(r => {
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

  // Clear all admin rates
  async clearAllAdminRates() {
    if (!confirm('Are you sure you want to delete ALL admin interest rates? This action cannot be undone.')) {
      return;
    }

    this.loading = true;
    this.clearMessages();

    try {
      console.log('[ADMIN-INTEREST] 🗑️ Clearing all admin rates...');
      
      // Delete all rates one by one
      for (const rate of this.rates) {
        await this.adminInterestSvc.deleteAdminRate(rate.monthKey);
        console.log(`[ADMIN-INTEREST] 🗑️ Deleted rate for ${rate.monthKey}`);
      }

      this.successMessage = `Successfully cleared ${this.rates.length} admin interest rates.`;
      
      // Refresh the rates list
      this.adminInterestSvc.listAdminRates().subscribe(r => {
        this.rates = r.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
      });

    } catch (error: any) {
      this.errorMessage = error.message || 'Error clearing admin rates. Please try again.';
      console.error('Error clearing admin rates:', error);
    } finally {
      this.loading = false;
    }
  }

  // Add sample admin rates
  async addSampleAdminRates() {
    if (!confirm('This will add sample admin interest rates for testing. Continue?')) {
      return;
    }

    this.loading = true;
    this.clearMessages();

    try {
      console.log('[ADMIN-INTEREST] 📊 Adding sample admin rates...');
      
      // Sample data for 2024 and 2025
      const sampleRates = [
        { monthKey: '2024-01', rate: 0.12 }, // 12%
        { monthKey: '2024-02', rate: 0.15 }, // 15%
        { monthKey: '2024-03', rate: 0.18 }, // 18%
        { monthKey: '2024-04', rate: 0.10 }, // 10%
        { monthKey: '2024-05', rate: 0.14 }, // 14%
        { monthKey: '2024-06', rate: 0.16 }, // 16%
        { monthKey: '2024-07', rate: 0.20 }, // 20%
        { monthKey: '2024-08', rate: 0.13 }, // 13%
        { monthKey: '2024-09', rate: 0.17 }, // 17%
        { monthKey: '2024-10', rate: 0.11 }, // 11%
        { monthKey: '2024-11', rate: 0.19 }, // 19%
        { monthKey: '2024-12', rate: 0.15 }, // 15%
        { monthKey: '2025-01', rate: 0.15 }, // 15%
        { monthKey: '2025-02', rate: 0.20 }, // 20%
        { monthKey: '2025-03', rate: 0.08 }, // 8%
        { monthKey: '2025-04', rate: 0.18 }, // 18%
        { monthKey: '2025-05', rate: 0.09 }, // 9%
        { monthKey: '2025-06', rate: 0.11 }, // 11%
        { monthKey: '2025-07', rate: 0.10 }, // 10%
        { monthKey: '2025-08', rate: 0.20 }, // 20%
        { monthKey: '2025-09', rate: 0.15 }, // 15%
        { monthKey: '2025-10', rate: 0.12 }, // 12%
        { monthKey: '2025-11', rate: 0.16 }, // 16%
        { monthKey: '2025-12', rate: 0.14 }  // 14%
      ];

      // Add each sample rate
      for (const sampleRate of sampleRates) {
        await this.adminInterestSvc.setAdminMonthlyRate(sampleRate);
        console.log(`[ADMIN-INTEREST] 📊 Added sample rate: ${sampleRate.monthKey} = ${(sampleRate.rate * 100).toFixed(1)}%`);
      }

      this.successMessage = `Successfully added ${sampleRates.length} sample admin interest rates!`;
      
      // Refresh the rates list
      this.adminInterestSvc.listAdminRates().subscribe(r => {
        this.rates = r.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
      });

    } catch (error: any) {
      this.errorMessage = error.message || 'Error adding sample rates. Please try again.';
      console.error('Error adding sample rates:', error);
    } finally {
      this.loading = false;
    }
  }
}
