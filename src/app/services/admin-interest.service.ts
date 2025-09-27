import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc, addDoc, query, where, getDocs, Timestamp, orderBy, getDoc, deleteDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { MonthlyRate } from '../models';

@Injectable({
  providedIn: 'root'
})
export class AdminInterestService {
  private firestore: Firestore = inject(Firestore);

  // Admin-specific interest rates collection
  listAdminRates(): Observable<MonthlyRate[]> {
    console.log('[ADMIN-INTEREST-SERVICE] 🏛️ Fetching ADMIN rates from ADMINRATES collection');
    const ratesCollection = collection(this.firestore, 'adminRates');
    return collectionData(ratesCollection, { idField: 'id' }) as Observable<MonthlyRate[]>;
  }

  setAdminMonthlyRate(rate: any): Promise<void> {
    const ratesDoc = doc(this.firestore, 'adminRates', rate.monthKey);
    return setDoc(ratesDoc, rate, { merge: true });
  }

  async deleteAdminRate(monthKey: string): Promise<void> {
    const rateDoc = doc(this.firestore, 'adminRates', monthKey);
    return deleteDoc(rateDoc);
  }

  // Get admin rate for a specific month
  async getAdminRate(monthKey: string): Promise<MonthlyRate | null> {
    const rateDoc = doc(this.firestore, 'adminRates', monthKey);
    const rateSnapshot = await getDoc(rateDoc);
    
    if (rateSnapshot.exists()) {
      return { id: rateSnapshot.id, ...rateSnapshot.data() } as MonthlyRate;
    }
    return null;
  }
}
