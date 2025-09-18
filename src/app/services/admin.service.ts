
import { Injectable } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  constructor(private functions: Functions, private snackBar: MatSnackBar) {}

  async setAdminClaim(email: string): Promise<void> {
    try {
      const setAdminClaim = httpsCallable(this.functions, 'setAdminClaim');
      const result = await setAdminClaim({ email });
      this.snackBar.open(result.data['message'], 'Close', { duration: 3000 });
    } catch (error) {
      console.error('Error setting admin claim:', error);
      this.snackBar.open('An error occurred while setting the admin claim.', 'Close', {
        duration: 3000,
      });
    }
  }

  async setupInitialAdmin(email: string, password: string): Promise<boolean> {
    try {
      const setupInitialAdmin = httpsCallable(this.functions, 'setupInitialAdmin');
      const result = await setupInitialAdmin({ email, password });
      this.snackBar.open(result.data['message'], 'Close', { duration: 3000 });
      return true;
    } catch (error: any) {
      console.error('Error setting up initial admin:', error);
      let errorMessage = 'An error occurred while setting up the admin account.';
      
      if (error.code === 'functions/permission-denied') {
        errorMessage = 'Initial admin has already been set up.';
      } else if (error.code === 'functions/already-exists') {
        errorMessage = 'This email address is already in use.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
      return false;
    }
  }

  async cleanupOrphanedInvestors(): Promise<boolean> {
    try {
      const cleanupOrphanedInvestors = httpsCallable(this.functions, 'cleanupOrphanedInvestors');
      const result = await cleanupOrphanedInvestors({});
      const data: any = result.data;
      
      this.snackBar.open(data.message, 'Close', { duration: 5000 });
      
      if (data.deletedInvestors && data.deletedInvestors.length > 0) {
        console.log('Deleted orphaned investors:', data.deletedInvestors);
      }
      
      return true;
    } catch (error: any) {
      console.error('Error cleaning up orphaned investors:', error);
      let errorMessage = 'An error occurred while cleaning up orphaned data.';
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
      return false;
    }
  }

  async applyHistoricalInterest(investorId: string, fromMonthKey?: string, toMonthKey?: string): Promise<boolean> {
    try {
      const applyHistoricalInterest = httpsCallable(this.functions, 'applyHistoricalInterest');
      const result = await applyHistoricalInterest({ 
        investorId, 
        fromMonthKey, 
        toMonthKey 
      });
      const data: any = result.data;
      
      this.snackBar.open(data.message, 'Close', { duration: 5000 });
      
      if (data.processedMonths > 0) {
        console.log('Applied historical interest:', {
          months: data.processedMonths,
          totalInterest: data.totalInterestApplied
        });
      }
      
      return true;
    } catch (error: any) {
      console.error('Error applying historical interest:', error);
      let errorMessage = 'An error occurred while applying historical interest.';
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
      return false;
    }
  }

  async deleteInvestor(investorId: string): Promise<boolean> {
    try {
      const deleteInvestor = httpsCallable(this.functions, 'deleteInvestor');
      const result = await deleteInvestor({ investorId });
      const data: any = result.data;
      
      this.snackBar.open(data.message, 'Close', { duration: 5000 });
      
      console.log('Successfully deleted investor:', {
        investorId: investorId,
        deletedTransactions: data.deletedTransactions
      });
      
      return true;
    } catch (error: any) {
      console.error('Error deleting investor:', error);
      let errorMessage = 'An error occurred while deleting the investor.';
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
      return false;
    }
  }

}
