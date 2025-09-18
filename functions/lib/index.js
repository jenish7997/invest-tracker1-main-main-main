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
exports.initializeSampleRates = exports.applyMonthlyInterestAndRecalculate = exports.updateInterestRate = exports.deleteInvestor = exports.recalculateInterestForInvestor = exports.cleanupOrphanedInvestors = exports.setupInitialAdmin = exports.setAdminClaim = exports.createInvestorUser = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
admin.initializeApp();
// Configure CORS origins for Firebase Functions v2
const corsOrigins = [
    'http://localhost:4200',
    'https://localhost:4200',
    'http://127.0.0.1:4200',
    'https://127.0.0.1:4200',
    'https://invest-tracker-447ff.web.app',
    'https://invest-tracker-447ff.firebaseapp.com'
];
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
 * Sets admin claim for a user - only callable by existing admins
 */
exports.setAdminClaim = (0, https_1.onCall)({
    cors: corsOrigins
}, async (request) => {
    await verifyAdmin(request.auth);
    const { email } = request.data;
    if (!email) {
        throw new https_1.HttpsError("invalid-argument", "Email is required.");
    }
    try {
        const user = await admin.auth().getUserByEmail(email);
        await admin.auth().setCustomUserClaims(user.uid, { admin: true });
        logger.info("Successfully set admin claim for user:", { uid: user.uid, email });
        return { success: true, message: `Successfully granted admin privileges to ${email}.` };
    }
    catch (error) {
        logger.error("Error setting admin claim:", error);
        if (error.code === "auth/user-not-found") {
            throw new https_1.HttpsError("not-found", "User with this email address does not exist.");
        }
        throw new https_1.HttpsError("internal", "An unexpected error occurred.");
    }
});
/**
 * Initial admin setup - can only be called once when no admins exist
 */
exports.setupInitialAdmin = (0, https_1.onCall)({
    cors: corsOrigins
}, async (request) => {
    const { email, password } = request.data;
    if (!email || !password) {
        throw new https_1.HttpsError("invalid-argument", "Email and password are required.");
    }
    try {
        // Check if any admin already exists
        const adminQuery = await admin.firestore().collection("adminSetup").doc("initialized").get();
        if (adminQuery.exists) {
            throw new https_1.HttpsError("permission-denied", "Initial admin has already been set up.");
        }
        // Create the admin user
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: "Admin"
        });
        // Set admin claim
        await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });
        // Mark admin setup as complete
        await admin.firestore().collection("adminSetup").doc("initialized").set({
            initialized: true,
            adminEmail: email,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        logger.info("Successfully created initial admin:", { uid: userRecord.uid, email });
        return { success: true, message: `Successfully created admin account for ${email}.` };
    }
    catch (error) {
        logger.error("Error setting up initial admin:", error);
        if (error.code === "auth/email-already-exists") {
            throw new https_1.HttpsError("already-exists", "This email address is already in use.");
        }
        throw new https_1.HttpsError("internal", "An unexpected error occurred.");
    }
});
/**
 * Cleans up orphaned investor data - removes Firestore documents for users that no longer exist in Auth
 */
exports.cleanupOrphanedInvestors = (0, https_1.onCall)({
    cors: corsOrigins
}, async (request) => {
    await verifyAdmin(request.auth);
    try {
        // Get all investor documents from Firestore
        const investorsSnapshot = await admin.firestore().collection("investors").get();
        if (investorsSnapshot.empty) {
            return { success: true, message: "No investors found to clean up." };
        }
        const batch = admin.firestore().batch();
        let deletedCount = 0;
        const orphanedUsers = [];
        // Check each investor document
        for (const doc of investorsSnapshot.docs) {
            const investorData = doc.data();
            const uid = doc.id; // Document ID should match the Auth UID
            try {
                // Try to get the user from Firebase Auth
                await admin.auth().getUser(uid);
                // If we get here, user exists in Auth - keep the data
            }
            catch (authError) {
                if (authError.code === 'auth/user-not-found') {
                    // User doesn't exist in Auth - mark for deletion
                    batch.delete(doc.ref);
                    deletedCount++;
                    orphanedUsers.push({
                        uid: uid,
                        name: investorData.name,
                        email: investorData.email
                    });
                    // Also delete their transactions
                    const transactionsQuery = await admin.firestore()
                        .collection("transactions")
                        .where("investorId", "==", uid)
                        .get();
                    transactionsQuery.docs.forEach(transactionDoc => {
                        batch.delete(transactionDoc.ref);
                    });
                }
                else {
                    logger.warn(`Error checking user ${uid}:`, authError);
                }
            }
        }
        if (deletedCount > 0) {
            await batch.commit();
            logger.info(`Cleaned up ${deletedCount} orphaned investors:`, orphanedUsers);
            return {
                success: true,
                message: `Successfully cleaned up ${deletedCount} orphaned investors and their transactions.`,
                deletedInvestors: orphanedUsers
            };
        }
        else {
            return { success: true, message: "No orphaned investors found." };
        }
    }
    catch (error) {
        logger.error("Error cleaning up orphaned investors:", error);
        throw new https_1.HttpsError("internal", "An unexpected error occurred while cleaning up data.");
    }
});
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
        let totalInterestApplied = 0;
        let processedMonths = 0;
        // Get all months that have rates
        const monthsWithRates = Array.from(availableRates.keys()).sort();
        console.log(`[DEBUG] Available rates:`, availableRates);
        console.log(`[DEBUG] Months with rates:`, monthsWithRates);
        // Process each month that has rates (for compounding interest, we need to process all months with rates)
        let runningBalance = 0; // This will track the compounding balance
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
            // Add all interest from previous months (compounding)
            balanceAtMonthEnd += runningBalance;
            console.log(`[DEBUG] Month ${monthKey}: balanceAtMonthEnd = ${balanceAtMonthEnd}, rate = ${rate}`);
            if (balanceAtMonthEnd > 0) {
                const interestAmount = balanceAtMonthEnd * rate;
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
                // Update running balance for next month (compounding)
                runningBalance += interestAmount;
                console.log(`[DEBUG] Month ${monthKey}: runningBalance = ${runningBalance}`);
                totalInterestApplied += interestAmount;
                processedMonths++;
            }
            else {
                console.log(`[DEBUG] Month ${monthKey}: No interest calculated (balanceAtMonthEnd = ${balanceAtMonthEnd})`);
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
/**
 * Deletes an investor and all their associated data
 */
exports.deleteInvestor = (0, https_1.onCall)({
    cors: corsOrigins
}, async (request) => {
    await verifyAdmin(request.auth);
    const { investorId } = request.data;
    if (!investorId) {
        throw new https_1.HttpsError("invalid-argument", "Investor ID is required.");
    }
    try {
        const batch = admin.firestore().batch();
        let deletedTransactions = 0;
        // Delete the investor document
        const investorRef = admin.firestore().collection("investors").doc(investorId);
        batch.delete(investorRef);
        // Delete all transactions for this investor
        const transactionsQuery = await admin.firestore()
            .collection("transactions")
            .where("investorId", "==", investorId)
            .get();
        transactionsQuery.docs.forEach(transactionDoc => {
            batch.delete(transactionDoc.ref);
            deletedTransactions++;
        });
        // Delete the user from Firebase Auth
        try {
            await admin.auth().deleteUser(investorId);
            logger.info(`Successfully deleted user from Auth: ${investorId}`);
        }
        catch (authError) {
            if (authError.code === 'auth/user-not-found') {
                logger.warn(`User ${investorId} not found in Auth, continuing with Firestore cleanup`);
            }
            else {
                throw authError;
            }
        }
        // Commit all deletions
        await batch.commit();
        logger.info(`Successfully deleted investor ${investorId} and ${deletedTransactions} transactions`);
        return {
            success: true,
            message: `Successfully deleted investor and ${deletedTransactions} associated transactions.`,
            deletedTransactions
        };
    }
    catch (error) {
        logger.error("Error deleting investor:", error);
        throw new https_1.HttpsError("internal", "An unexpected error occurred while deleting the investor.");
    }
});
/**
 * Updates an existing interest rate and recalculates interest amounts
 */
exports.updateInterestRate = (0, https_1.onCall)({
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
        logger.info("Starting updateInterestRate", { monthKey, oldRate, newRate });
        const ratesRef = admin.firestore().collection("rates");
        const transactionsRef = admin.firestore().collection("transactions");
        const investorsRef = admin.firestore().collection("investors");
        // Update the rate in the rates collection
        await ratesRef.doc(monthKey).set({ monthKey, rate: newRate }, { merge: true });
        logger.info("Rate updated in rates collection", { monthKey, newRate });
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
            logger.info("Checking transaction date", {
                monthKey,
                transactionDate: transactionDate.toISOString(),
                transactionYear,
                transactionMonth,
                targetYear: year,
                targetMonth: month,
                matches: transactionYear === year && transactionMonth === month
            });
            return transactionYear === year && transactionMonth === month;
        });
        logger.info("Found interest transactions to update", {
            totalInterestTransactions: allInterestTransactionsQuery.docs.length,
            filteredForMonth: interestTransactions.length,
            monthKey,
            year,
            month: month + 1 // Show 1-based month for clarity
        });
        if (interestTransactions.length === 0) {
            return {
                success: true,
                message: `Rate updated to ${(newRate * 100).toFixed(1)}% for ${monthKey}. No existing interest transactions found to update.`
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
            // We need to get the balance at the beginning of the month (before any transactions in that month)
            const startOfMonth = new Date(year, month, 1);
            const principalQuery = await transactionsRef
                .where('investorId', '==', investorId)
                .where('date', '<', admin.firestore.Timestamp.fromDate(startOfMonth))
                .orderBy('date', 'asc')
                .get();
            let principalAmount = 0;
            principalQuery.docs.forEach(doc => {
                const t = doc.data();
                if (t.type === 'invest' || t.type === 'deposit' || t.type === 'interest') {
                    principalAmount += t.amount;
                }
                else if (t.type === 'withdraw') {
                    principalAmount -= t.amount;
                }
            });
            // Also need to add any transactions that happened on the first day of the month
            // but before the interest transaction
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
                if (t.type === 'invest' || t.type === 'deposit' || t.type === 'interest') {
                    principalAmount += t.amount;
                }
                else if (t.type === 'withdraw') {
                    principalAmount -= t.amount;
                }
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
                logger.info(`Updated interest for investor ${investorId}`, {
                    monthKey,
                    principalAmount,
                    oldInterest: transaction.amount,
                    newInterest: newInterestAmount,
                    adjustment: interestAdjustment
                });
            }
        }
        // Update all affected investor balances
        for (const [investorId, newBalance] of investorBalances) {
            const investorDocRef = investorsRef.doc(investorId);
            batch.update(investorDocRef, { balance: newBalance });
        }
        logger.info("Committing batch update", {
            updatedTransactions,
            totalInterestAdjustment
        });
        await batch.commit();
        logger.info("Successfully updated interest rate and recalculated amounts", {
            monthKey,
            newRate,
            updatedTransactions,
            totalInterestAdjustment
        });
        return {
            success: true,
            message: `Rate updated to ${(newRate * 100).toFixed(1)}% for ${monthKey}. Updated ${updatedTransactions} interest transactions with total adjustment of ₹${totalInterestAdjustment.toFixed(2)}.`
        };
    }
    catch (error) {
        logger.error("Error updating interest rate:", error);
        throw new https_1.HttpsError("internal", "An unexpected error occurred while updating the interest rate.");
    }
});
/**
 * Applies monthly interest to all investors and recalculates existing interest
 */
exports.applyMonthlyInterestAndRecalculate = (0, https_1.onCall)({
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
        const ratesRef = admin.firestore().collection("rates");
        // Save the rate for historical tracking
        await ratesRef.doc(monthKey).set({ monthKey, rate });
        const investorsSnapshot = await investorsRef.get();
        if (investorsSnapshot.empty) {
            return { success: true, message: "No investors found to apply interest to." };
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
            transactionsQuery.docs.forEach(transactionDoc => {
                const transaction = transactionDoc.data();
                if (transaction.type === 'invest' || transaction.type === 'deposit' || transaction.type === 'interest') {
                    balanceAtMonthEnd += transaction.amount;
                }
                else if (transaction.type === 'withdraw') {
                    balanceAtMonthEnd -= transaction.amount;
                }
            });
            // Only apply interest if there's a positive balance
            if (balanceAtMonthEnd > 0) {
                const interestAmount = balanceAtMonthEnd * rate;
                const newBalance = (investor.balance || 0) + interestAmount;
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
                // Update the investor's balance
                const investorDocRef = investorsRef.doc(doc.id);
                batch.update(investorDocRef, { balance: newBalance });
                processedCount++;
            }
        }
        await batch.commit();
        return { success: true, message: `Successfully applied interest to ${processedCount} investors for ${monthKey}.` };
    }
    catch (error) {
        logger.error("Error applying monthly interest:", error);
        throw new https_1.HttpsError("internal", "An unexpected error occurred while applying interest.");
    }
});
// Initialize sample rates for testing
exports.initializeSampleRates = (0, https_1.onCall)({
    cors: corsOrigins
}, async (request) => {
    await verifyAdmin(request.auth);
    try {
        const ratesRef = admin.firestore().collection("rates");
        const batch = admin.firestore().batch();
        // Add sample rates for the current year
        const currentYear = new Date().getFullYear();
        const sampleRates = [
            { monthKey: `${currentYear}-01`, rate: 0.10 }, // 10%
            { monthKey: `${currentYear}-02`, rate: 0.12 }, // 12%
            { monthKey: `${currentYear}-03`, rate: 0.08 }, // 8%
            { monthKey: `${currentYear}-04`, rate: 0.15 }, // 15%
            { monthKey: `${currentYear}-05`, rate: 0.09 }, // 9%
            { monthKey: `${currentYear}-06`, rate: 0.11 }, // 11%
        ];
        sampleRates.forEach(rate => {
            const rateDocRef = ratesRef.doc(rate.monthKey);
            batch.set(rateDocRef, rate);
        });
        await batch.commit();
        return {
            message: `Sample rates initialized successfully! Added ${sampleRates.length} rates for ${currentYear}.`
        };
    }
    catch (error) {
        console.error('Error initializing sample rates:', error);
        throw new https_1.HttpsError("internal", "Failed to initialize sample rates.");
    }
});
//# sourceMappingURL=index.js.map