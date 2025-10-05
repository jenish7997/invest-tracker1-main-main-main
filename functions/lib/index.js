"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteInvestorUser = exports.createInvestorUser = exports.updateAdminInterestRate = exports.applyAdminMonthlyInterestAndRecalculate = exports.recalculateInterestForInvestor = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
admin.initializeApp();
// Configure CORS origins for Firebase Functions v2 - Allow all domains
const corsOrigins = true; // This allows all origins
/**
 * Verifies that the user making the request is an administrator.
 */
async function verifyAdmin(auth) {
    if (!auth) {
        throw new https_1.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    if (auth.token.admin !== true) {
        throw new https_1.HttpsError("permission-denied", "You must be an administrator to perform this action.");
    }
}
/**
 * Recalculates interest for a specific investor by removing all existing interest and recalculating
 */
exports.recalculateInterestForInvestor = (0, https_1.onCall)({
    cors: corsOrigins
}, async (request) => {
    await verifyAdmin(request.auth);
    const { investorId } = request.data;
    if (!investorId) {
        throw new https_1.HttpsError("invalid-argument", "Investor ID is required.");
    }
    try {
        const investorsRef = admin.firestore().collection("investors");
        const transactionsRef = admin.firestore().collection("transactions");
        const ratesRef = admin.firestore().collection("rates");
        // Get investor data
        const investorDoc = await investorsRef.doc(investorId).get();
        if (!investorDoc.exists) {
            throw new https_1.HttpsError("not-found", "Investor not found.");
        }
        const investor = investorDoc.data();
        if (!investor) {
            throw new https_1.HttpsError("not-found", "Investor data not found.");
        }
        // Get all available rates
        const ratesSnapshot = await ratesRef.get();
        const availableRates = new Map();
        ratesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            availableRates.set(data.monthKey, data.rate);
        });
        if (availableRates.size === 0) {
            return { success: true, message: "No interest rates found to apply." };
        }
        // Get all existing transactions for this investor
        const existingTransactionsQuery = await transactionsRef
            .where("investorId", "==", investorId)
            .orderBy("date", "asc")
            .get();
        const allTransactions = existingTransactionsQuery.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                investorId: data.investorId,
                investorName: data.investorName,
                type: data.type,
                amount: data.amount,
                date: data.date.toDate()
            };
        });
        // Separate non-interest transactions from interest transactions
        const nonInterestTransactions = allTransactions.filter(t => t.type !== 'interest');
        const interestTransactions = allTransactions.filter(t => t.type === 'interest');
        // Delete all existing interest transactions
        const batch = admin.firestore().batch();
        interestTransactions.forEach(transaction => {
            batch.delete(transactionsRef.doc(transaction.id));
        });
        // Calculate new interest for each month
        let processedMonths = 0;
        // Get all months that have rates
        const monthsWithRates = Array.from(availableRates.keys()).sort();
        console.log(`[DEBUG] Available rates:`, availableRates);
        console.log(`[DEBUG] Months with rates:`, monthsWithRates);
        // Process each month that has rates (for compound interest, we calculate on principal + previous interest)
        let totalInterestApplied = 0; // Track total interest for balance update
        let compoundBalance = 0; // Track compound balance including previous interest
        for (const monthKey of monthsWithRates) {
            console.log(`[DEBUG] Processing month: ${monthKey}`);
            const rate = availableRates.get(monthKey);
            const year = parseInt(monthKey.split('-')[0], 10);
            const month = parseInt(monthKey.split('-')[1], 10) - 1;
            const monthEndDate = new Date(year, month, new Date(year, month + 1, 0).getDate());
            // Calculate balance at the end of this month (including ALL transactions up to this point)
            let balanceAtMonthEnd = 0;
            // Add all non-interest transactions that occurred up to the end of this month
            for (const transaction of nonInterestTransactions) {
                if (transaction.date <= monthEndDate) {
                    if (transaction.type === 'invest' || transaction.type === 'deposit') {
                        balanceAtMonthEnd += transaction.amount;
                    }
                    else if (transaction.type === 'withdraw') {
                        balanceAtMonthEnd -= transaction.amount;
                    }
                }
            }
            // For compound interest, add previous interest to the balance
            const totalBalanceForInterest = balanceAtMonthEnd + compoundBalance;
            console.log(`[DEBUG] Month ${monthKey}: principalAtMonthEnd = ${balanceAtMonthEnd}, compoundBalance = ${compoundBalance}, totalBalanceForInterest = ${totalBalanceForInterest}, rate = ${rate}`);
            if (totalBalanceForInterest > 0) {
                const interestAmount = totalBalanceForInterest * rate;
                console.log(`[DEBUG] Month ${monthKey}: interestAmount = ${interestAmount}`);
                // Create new interest transaction
                const transactionDocRef = transactionsRef.doc();
                batch.set(transactionDocRef, {
                    investorId: investorId,
                    investorName: investor.name,
                    date: admin.firestore.Timestamp.fromDate(monthEndDate),
                    type: 'interest',
                    amount: interestAmount,
                    createdAt: admin.firestore.Timestamp.now()
                });
                // Update compound balance for next month
                compoundBalance += interestAmount;
                // Track total interest applied
                totalInterestApplied += interestAmount;
                console.log(`[DEBUG] Month ${monthKey}: interestAmount = ${interestAmount}, compoundBalance = ${compoundBalance}, totalInterestApplied = ${totalInterestApplied}`);
                processedMonths++;
            }
            else {
                console.log(`[DEBUG] Month ${monthKey}: No interest calculated (totalBalanceForInterest = ${totalBalanceForInterest})`);
            }
        }
        // Update investor balance (remove old interest, add new interest)
        const oldInterestTotal = interestTransactions.reduce((sum, t) => sum + t.amount, 0);
        const newBalance = (investor.balance || 0) - oldInterestTotal + totalInterestApplied;
        batch.update(investorDoc.ref, { balance: newBalance });
        await batch.commit();
        logger.info(`Recalculated interest for investor ${investorId}:`, {
            months: processedMonths,
            totalInterest: totalInterestApplied,
            oldInterest: oldInterestTotal
        });
        return {
            success: true,
            message: `Successfully recalculated interest for ${processedMonths} months. Total interest: ₹${totalInterestApplied.toFixed(2)}`,
            processedMonths,
            totalInterestApplied
        };
    }
    catch (error) {
        logger.error("Error recalculating interest:", error);
        throw new https_1.HttpsError("internal", "An unexpected error occurred while recalculating interest.");
    }
});
// ===== ADMIN INTEREST FUNCTIONS =====
/**
 * Applies monthly interest to all investors using admin rates and recalculates existing interest
 */
exports.applyAdminMonthlyInterestAndRecalculate = (0, https_1.onCall)({
    cors: corsOrigins
}, async (request) => {
    await verifyAdmin(request.auth);
    const { monthKey, rate } = request.data;
    if (!monthKey || rate == null) {
        throw new https_1.HttpsError("invalid-argument", "Missing 'monthKey' or 'rate'.");
    }
    if (rate < 0 || rate > 1) {
        throw new https_1.HttpsError("invalid-argument", "Rate must be between 0 and 1.");
    }
    try {
        const year = parseInt(monthKey.split('-')[0], 10);
        const month = parseInt(monthKey.split('-')[1], 10) - 1;
        const interestDate = new Date(year, month, new Date(year, month + 1, 0).getDate());
        const investorsRef = admin.firestore().collection("investors");
        const transactionsRef = admin.firestore().collection("transactions");
        const adminRatesRef = admin.firestore().collection("adminRates");
        // Save the admin rate for historical tracking
        await adminRatesRef.doc(monthKey).set({ monthKey, rate });
        const investorsSnapshot = await investorsRef.get();
        if (investorsSnapshot.empty) {
            return { success: true, message: "No investors found to apply admin interest to." };
        }
        const batch = admin.firestore().batch();
        let processedCount = 0;
        for (const doc of investorsSnapshot.docs) {
            const investor = doc.data();
            // Calculate the balance at the end of this month (including all transactions up to this point)
            const monthEndDate = new Date(year, month, new Date(year, month + 1, 0).getDate());
            // Get all transactions for this investor up to the end of current month
            const transactionsQuery = await transactionsRef
                .where('investorId', '==', doc.id)
                .where('date', '<=', admin.firestore.Timestamp.fromDate(monthEndDate))
                .orderBy('date', 'asc')
                .get();
            let balanceAtMonthEnd = 0;
            let existingInterestForThisMonth = 0;
            transactionsQuery.docs.forEach(transactionDoc => {
                const transaction = transactionDoc.data();
                if (transaction.type === 'invest' || transaction.type === 'deposit') {
                    balanceAtMonthEnd += transaction.amount;
                }
                else if (transaction.type === 'withdraw') {
                    balanceAtMonthEnd -= transaction.amount;
                }
                else if (transaction.type === 'interest') {
                    // Check if this is an existing interest transaction for the same month
                    const transactionDate = transaction.date.toDate();
                    if (transactionDate.getFullYear() === year && transactionDate.getMonth() === month) {
                        existingInterestForThisMonth += transaction.amount;
                    }
                    // Don't include interest in balance calculation for simple interest
                }
            });
            // Only apply interest if there's a positive balance and no existing interest for this month
            if (balanceAtMonthEnd > 0 && existingInterestForThisMonth === 0) {
                // Calculate simple interest on the balance at month end
                const interestAmount = balanceAtMonthEnd * rate;
                // Create an interest transaction
                const transactionDocRef = transactionsRef.doc();
                batch.set(transactionDocRef, {
                    investorId: doc.id,
                    investorName: investor.name,
                    date: admin.firestore.Timestamp.fromDate(interestDate),
                    type: 'interest',
                    amount: interestAmount,
                    createdAt: admin.firestore.Timestamp.now()
                });
                // Update the investor's balance by adding the interest
                const investorDocRef = investorsRef.doc(doc.id);
                const currentBalance = investor.balance || 0;
                const newBalance = currentBalance + interestAmount;
                batch.update(investorDocRef, { balance: newBalance });
                processedCount++;
            }
        }
        await batch.commit();
        return { success: true, message: `Successfully applied compound admin interest to ${processedCount} investors for ${monthKey}.` };
    }
    catch (error) {
        logger.error("Error applying admin monthly interest:", error);
        throw new https_1.HttpsError("internal", "An unexpected error occurred while applying admin interest.");
    }
});
/**
 * Updates an existing admin interest rate and recalculates interest amounts
 */
exports.updateAdminInterestRate = (0, https_1.onCall)({
    cors: corsOrigins
}, async (request) => {
    await verifyAdmin(request.auth);
    const { monthKey, oldRate, newRate } = request.data;
    if (!monthKey || oldRate == null || newRate == null) {
        throw new https_1.HttpsError("invalid-argument", "Missing 'monthKey', 'oldRate', or 'newRate'.");
    }
    if (newRate < 0 || newRate > 1) {
        throw new https_1.HttpsError("invalid-argument", "New rate must be between 0 and 1.");
    }
    try {
        logger.info("Starting updateAdminInterestRate", { monthKey, oldRate, newRate });
        const adminRatesRef = admin.firestore().collection("adminRates");
        const transactionsRef = admin.firestore().collection("transactions");
        const investorsRef = admin.firestore().collection("investors");
        // Update the admin rate in the adminRates collection
        await adminRatesRef.doc(monthKey).set({ monthKey, rate: newRate }, { merge: true });
        logger.info("Admin rate updated in adminRates collection", { monthKey, newRate });
        // Get all interest transactions for this month
        const year = parseInt(monthKey.split('-')[0], 10);
        const month = parseInt(monthKey.split('-')[1], 10) - 1;
        // Get all interest transactions first, then filter by date
        const allInterestTransactionsQuery = await transactionsRef
            .where('type', '==', 'interest')
            .get();
        // Filter by date range - be more inclusive for edge cases
        const interestTransactions = allInterestTransactionsQuery.docs.filter(doc => {
            const transaction = doc.data();
            const transactionDate = transaction.date.toDate();
            // Check if the transaction year and month match exactly
            const transactionYear = transactionDate.getFullYear();
            const transactionMonth = transactionDate.getMonth();
            return transactionYear === year && transactionMonth === month;
        });
        logger.info("Found admin interest transactions to update", {
            totalInterestTransactions: allInterestTransactionsQuery.docs.length,
            filteredForMonth: interestTransactions.length,
            monthKey
        });
        if (interestTransactions.length === 0) {
            return {
                success: true,
                message: `Admin rate updated to ${(newRate * 100).toFixed(1)}% for ${monthKey}. No existing interest transactions found to update.`
            };
        }
        // Get all investors to update their balances
        const investorsSnapshot = await investorsRef.get();
        const investorBalances = new Map();
        for (const doc of investorsSnapshot.docs) {
            investorBalances.set(doc.id, doc.data().balance || 0);
        }
        const batch = admin.firestore().batch();
        let updatedTransactions = 0;
        let totalInterestAdjustment = 0;
        // Update each interest transaction
        for (const transactionDoc of interestTransactions) {
            const transaction = transactionDoc.data();
            const investorId = transaction.investorId;
            // Calculate the principal amount that was used for this interest calculation
            const startOfMonth = new Date(year, month, 1);
            const principalQuery = await transactionsRef
                .where('investorId', '==', investorId)
                .where('date', '<', admin.firestore.Timestamp.fromDate(startOfMonth))
                .orderBy('date', 'asc')
                .get();
            let principalAmount = 0;
            principalQuery.docs.forEach(doc => {
                const t = doc.data();
                if (t.type === 'invest' || t.type === 'deposit') {
                    principalAmount += t.amount;
                }
                else if (t.type === 'withdraw') {
                    principalAmount -= t.amount;
                }
                // Don't include interest in principal calculation for simple interest
            });
            // Also need to add any transactions that happened on the first day of the month
            const firstDayOfMonth = new Date(year, month, 1);
            const interestTransactionDate = transaction.date.toDate();
            const firstDayTransactionsQuery = await transactionsRef
                .where('investorId', '==', investorId)
                .where('date', '>=', admin.firestore.Timestamp.fromDate(firstDayOfMonth))
                .where('date', '<', admin.firestore.Timestamp.fromDate(interestTransactionDate))
                .orderBy('date', 'asc')
                .get();
            firstDayTransactionsQuery.docs.forEach(doc => {
                const t = doc.data();
                if (t.type === 'invest' || t.type === 'deposit') {
                    principalAmount += t.amount;
                }
                else if (t.type === 'withdraw') {
                    principalAmount -= t.amount;
                }
                // Don't include interest in principal calculation for simple interest
            });
            if (principalAmount > 0) {
                // Calculate the new interest amount
                const newInterestAmount = principalAmount * newRate;
                const interestAdjustment = newInterestAmount - transaction.amount;
                // Update the transaction
                batch.update(transactionDoc.ref, { amount: newInterestAmount });
                // Update the investor's balance
                const currentBalance = investorBalances.get(investorId) || 0;
                const newBalance = currentBalance + interestAdjustment;
                investorBalances.set(investorId, newBalance);
                totalInterestAdjustment += interestAdjustment;
                updatedTransactions++;
            }
        }
        // Update all affected investor balances
        for (const [investorId, newBalance] of investorBalances) {
            const investorDocRef = investorsRef.doc(investorId);
            batch.update(investorDocRef, { balance: newBalance });
        }
        await batch.commit();
        return {
            success: true,
            message: `Admin rate updated to ${(newRate * 100).toFixed(1)}% for ${monthKey}. Updated ${updatedTransactions} interest transactions with total adjustment of ₹${totalInterestAdjustment.toFixed(2)}.`
        };
    }
    catch (error) {
        logger.error("Error updating admin interest rate:", error);
        throw new https_1.HttpsError("internal", "An unexpected error occurred while updating the admin interest rate.");
    }
});
/**
 * Creates a new investor user with a permanent password set by the admin.
 */
exports.createInvestorUser = (0, https_1.onCall)({
    cors: corsOrigins
}, async (request) => {
    await verifyAdmin(request.auth);
    const { name, email, password } = request.data;
    if (!name || !email || !password) {
        throw new https_1.HttpsError("invalid-argument", "Missing required fields.");
    }
    try {
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: name,
        });
        await admin.firestore().collection("investors").doc(userRecord.uid).set({
            name,
            email,
            balance: 0,
            uid: userRecord.uid,
        });
        logger.info("Successfully created new user:", { uid: userRecord.uid });
        return { success: true, message: `Successfully created user for ${email}.` };
    }
    catch (error) {
        logger.error("Error creating new investor user:", error);
        if (error.code === "auth/email-already-exists") {
            throw new https_1.HttpsError("already-exists", "This email address is already in use.");
        }
        throw new https_1.HttpsError("internal", "An unexpected error occurred.");
    }
});
/**
 * Deletes an investor user from both Firebase Auth and Firestore.
 */
exports.deleteInvestorUser = (0, https_1.onCall)({
    cors: corsOrigins
}, async (request) => {
    await verifyAdmin(request.auth);
    const { investorId } = request.data;
    if (!investorId) {
        throw new https_1.HttpsError("invalid-argument", "Investor ID is required.");
    }
    try {
        // First, delete all transactions for this investor
        const transactionsRef = admin.firestore().collection("transactions");
        const transactionsQuery = await transactionsRef
            .where("investorId", "==", investorId)
            .get();
        // Delete all transactions
        const batch = admin.firestore().batch();
        transactionsQuery.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        // Delete the investor document
        const investorDoc = admin.firestore().collection("investors").doc(investorId);
        batch.delete(investorDoc);
        // Commit the Firestore deletions
        await batch.commit();
        // Finally, delete the user from Firebase Auth
        await admin.auth().deleteUser(investorId);
        logger.info("Successfully deleted investor user:", { investorId });
        return { success: true, message: "Investor and all associated data have been successfully deleted." };
    }
    catch (error) {
        logger.error("Error deleting investor user:", error);
        if (error.code === "auth/user-not-found") {
            // User might already be deleted from Auth but still exists in Firestore
            logger.warn("User not found in Firebase Auth, but continuing with Firestore cleanup");
            return { success: true, message: "Investor data has been cleaned up (user was not found in Auth)." };
        }
        throw new https_1.HttpsError("internal", "An unexpected error occurred while deleting the investor.");
    }
});
//# sourceMappingURL=index.js.map