import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc, addDoc, query, where, getDocs, Timestamp, orderBy, getDoc, deleteDoc, writeBatch } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { MonthlyRate } from '../models';

@Injectable({
  providedIn: 'root'
})
export class UserInterestService {
  private firestore: Firestore = inject(Firestore);

  // User interest rates - uses original rates collection
  listUserRates(): Observable<MonthlyRate[]> {
    console.log('[USER-INTEREST-SERVICE] 📋 Fetching USER rates from RATES collection');
    const ratesCollection = collection(this.firestore, 'rates');
    return collectionData(ratesCollection, { idField: 'id' }) as Observable<MonthlyRate[]>;
  }

  async setUserMonthlyRate(rate: any): Promise<void> {
    const ratesDoc = doc(this.firestore, 'rates', rate.monthKey);
    return setDoc(ratesDoc, rate, { merge: true });
  }


  async deleteUserRate(monthKey: string): Promise<void> {
    const rateDoc = doc(this.firestore, 'rates', monthKey);
    return deleteDoc(rateDoc);
  }

  // Get user rate for a specific month
  async getUserRate(monthKey: string): Promise<MonthlyRate | null> {
    const rateDoc = doc(this.firestore, 'rates', monthKey);
    const rateSnapshot = await getDoc(rateDoc);
    
    if (rateSnapshot.exists()) {
      return { id: rateSnapshot.id, ...rateSnapshot.data() } as MonthlyRate;
    }
    return null;
  }
}
