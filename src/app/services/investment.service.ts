
import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc, addDoc, query, where, getDocs, Timestamp, orderBy, getDoc, deleteDoc } from '@angular/fire/firestore';
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
    // Add createdAt timestamp for precise ordering
    const transactionWithTimestamp = {
      ...transactionData,
      createdAt: Timestamp.now()
    };
    return addDoc(transactionsCollection, transactionWithTimestamp);
  }

  async computeBalances(investorId: string, startMonthKey?: string, endMonthKey?: string): Promise<any[]> {
    console.log(`[DEBUG] computeBalances called for investorId: ${investorId}`);
    
    const transactionsCollection = collection(this.firestore, 'transactions');
    
    // First, get all transactions for the investor
    let constraints = [
      where('investorId', '==', investorId),
      orderBy('date', 'asc')
    ];

    const q = query(collection(this.firestore, 'transactions'), ...constraints);
    
    const querySnapshot = await getDocs(q);
    console.log(`[DEBUG] Found ${querySnapshot.docs.length} transactions for investor ${investorId}`);
    
    const allTransactions = querySnapshot.docs.map(doc => {
      const data = doc.data() as Transaction;
      return {
        ...data,
        date: (data.date as unknown as Timestamp).toDate(),
        createdAt: data.createdAt ? (data.createdAt as unknown as Timestamp).toDate() : new Date()
      };
    });

    console.log(`[DEBUG] Mapped transactions:`, allTransactions.map(t => ({
      type: t.type,
      amount: t.amount,
      date: t.date,
      createdAt: t.createdAt
    })));

    // Sort by date first, then by createdAt for same-day transactions
    allTransactions.sort((a, b) => {
      const dateCompare = a.date.getTime() - b.date.getTime();
      if (dateCompare === 0) {
        return a.createdAt.getTime() - b.createdAt.getTime();
      }
      return dateCompare;
    });

    console.log(`[DEBUG] Sorted transactions:`, allTransactions.map(t => ({
      type: t.type,
      amount: t.amount,
      date: t.date,
      createdAt: t.createdAt
    })));

    const startDate = startMonthKey ? new Date(startMonthKey + '-01') : null;
    const endDate = endMonthKey ? new Date(endMonthKey + '-28') : null;

    const filteredTransactions = allTransactions.filter(t => {
      const transactionDate = t.date;
      if (startDate && transactionDate < startDate) return false;
      if (endDate && transactionDate > endDate) return false;
      return true;
    });

    let balance = 0;
    console.log(`[DEBUG] Processing ${filteredTransactions.length} filtered transactions`);
    
    const runningBalances = filteredTransactions.map((t, index) => {
      const oldBalance = balance;
      if (t.type === 'invest' || t.type === 'deposit' || t.type === 'interest') {
        balance += t.amount;
      } else if (t.type === 'withdraw') {
        balance -= t.amount;
      }
      
      console.log(`[DEBUG] Transaction ${index + 1}: ${t.type} ${t.amount} | Balance: ${oldBalance} -> ${balance}`);
      
      return {
        ...t,
        balance: balance,
        date: this.formatDateForDisplay(t.date)
      };
    });
    
    console.log(`[DEBUG] Final running balances:`, runningBalances.map(t => ({
      type: t.type,
      amount: t.amount,
      balance: t.balance,
      date: t.date
    })));
    
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
    
    const transactions = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: (data['date'] as unknown as Timestamp).toDate(),
        createdAt: data['createdAt'] ? (data['createdAt'] as unknown as Timestamp).toDate() : new Date()
      };
    }) as Transaction[];

    // Sort by date first, then by createdAt for same-day transactions
    transactions.sort((a, b) => {
      const dateCompare = a.date.getTime() - b.date.getTime();
      if (dateCompare === 0) {
        return a.createdAt.getTime() - b.createdAt.getTime();
      }
      return dateCompare;
    });

    return transactions;
  }

  listRates(): Observable<MonthlyRate[]> {
    const ratesCollection = collection(this.firestore, 'rates');
    return collectionData(ratesCollection, { idField: 'id' }) as Observable<MonthlyRate[]>;
  }


  listTransactionsByInvestor(investorId: string): Observable<Transaction[]> {
    const transactionsCollection = collection(this.firestore, 'transactions');
    const q = query(
      transactionsCollection, 
      where('investorId', '==', investorId),
      orderBy('date', 'desc') // Order by date descending (newest first)
    );
    
    // Return observable that sorts by createdAt as secondary sort
    return new Observable<Transaction[]>(observer => {
      collectionData(q, { idField: 'id' }).subscribe({
        next: (transactions) => {
          // Cast to Transaction[] and sort by date first, then by createdAt for same-day transactions
          const typedTransactions = transactions as Transaction[];
          const sortedTransactions = typedTransactions.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            const dateCompare = dateB.getTime() - dateA.getTime();
            
            if (dateCompare === 0) {
              const createdAtA = a.createdAt ? new Date(a.createdAt) : new Date(0);
              const createdAtB = b.createdAt ? new Date(b.createdAt) : new Date(0);
              return createdAtB.getTime() - createdAtA.getTime();
            }
            
            return dateCompare;
          });
          
          observer.next(sortedTransactions);
        },
        error: (error) => observer.error(error),
        complete: () => observer.complete()
      });
    });
  }

  deleteTransaction(transactionId: string): Promise<void> {
    const transactionDoc = doc(this.firestore, 'transactions', transactionId);
    return deleteDoc(transactionDoc);
  }

  private formatDateForDisplay(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  }
}
