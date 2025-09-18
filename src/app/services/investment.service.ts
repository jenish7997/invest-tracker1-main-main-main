
import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc, addDoc, query, where, getDocs, Timestamp, orderBy, getDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Transaction, Investor, MonthlyRate } from '../models';

@Injectable({
  providedIn: 'root'
})
export class InvestmentService {
  private firestore: Firestore = inject(Firestore);

  listInvestors(): Observable<Investor[]> {
    const investorsCollection = collection(this.firestore, 'investors');
    return collectionData(investorsCollection, { idField: 'id' }) as Observable<Investor[]>;
  }

  addTransaction(transactionData: Omit<Transaction, 'id'>): Promise<any> {
    const transactionsCollection = collection(this.firestore, 'transactions');
    return addDoc(transactionsCollection, transactionData);
  }

  async computeBalances(investorId: string, startMonthKey?: string, endMonthKey?: string): Promise<any[]> {
    const transactionsCollection = collection(this.firestore, 'transactions');
    
    let constraints = [
      where('investorId', '==', investorId),
      orderBy('date')
    ];

    const q = query(collection(this.firestore, 'transactions'), ...constraints);
    
    const querySnapshot = await getDocs(q);
    
    const allTransactions = querySnapshot.docs.map(doc => {
      const data = doc.data() as Transaction;
      return {
        ...data,
        date: (data.date as unknown as Timestamp).toDate()
      };
    });

    const startDate = startMonthKey ? new Date(startMonthKey + '-01') : null;
    const endDate = endMonthKey ? new Date(endMonthKey + '-28') : null;

    const filteredTransactions = allTransactions.filter(t => {
      const transactionDate = t.date;
      if (startDate && transactionDate < startDate) return false;
      if (endDate && transactionDate > endDate) return false;
      return true;
    });

    let balance = 0;
    const runningBalances = filteredTransactions.map(t => {
      if (t.type === 'invest' || t.type === 'deposit' || t.type === 'interest') {
        balance += t.amount;
      } else if (t.type === 'withdraw') {
        balance -= t.amount;
      }
      return {
        ...t,
        balance: balance,
        date: t.date.toLocaleDateString()
      };
    });
    
    return runningBalances;
  }
  
  async getTransactionsByInvestor(investorId: string): Promise<Transaction[]> {
    const transactionsCollection = collection(this.firestore, 'transactions');
    const q = query(
      transactionsCollection, 
      where('investorId', '==', investorId),
      orderBy('date', 'asc')
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: (doc.data()['date'] as unknown as Timestamp).toDate()
    })) as Transaction[];
  }

  listRates(): Observable<MonthlyRate[]> {
    const ratesCollection = collection(this.firestore, 'rates');
    return collectionData(ratesCollection, { idField: 'id' }) as Observable<MonthlyRate[]>;
  }

  setMonthlyRate(rate: any): Promise<void> {
    const ratesDoc = doc(this.firestore, 'rates', rate.monthKey);
    return setDoc(ratesDoc, rate, { merge: true });
  }

  listTransactionsByInvestor(investorId: string): Observable<Transaction[]> {
    const transactionsCollection = collection(this.firestore, 'transactions');
    const q = query(transactionsCollection, where('investorId', '==', investorId));
    return collectionData(q, { idField: 'id' }) as Observable<Transaction[]>;
  }
}
