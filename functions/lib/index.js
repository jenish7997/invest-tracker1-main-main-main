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
exports.deleteInvestor = exports.recalculateInterestForInvestor = exports.applyHistoricalInterest = exports.cleanupOrphanedInvestors = exports.setupInitialAdmin = exports.setAdminClaim = exports.createInvestorUser = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
admin.initializeApp();
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
exports.createInvestorUser = (0, https_1.onCall)(async (request) => {
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
exports.setAdminClaim = (0, https_1.onCall)(async (request) => {
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
exports.setupInitialAdmin = (0, https_1.onCall)(async (request) => {
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
exports.cleanupOrphanedInvestors = (0, https_1.onCall)(async (request) => {
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
 * Applies historical interest rates to a specific investor based on their transaction history
 */
exports.applyHistoricalInterest = (0, https_1.onCall)(async (request) => {
    await verifyAdmin(request.auth);
    const { investorId, fromMonthKey, toMonthKey } = request.data;
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
        // Get existing transactions for this investor
        const existingTransactionsQuery = await transactionsRef
            .where("investorId", "==", investorId)
            .orderBy("date", "asc")
            .get();
        const transactions = existingTransactionsQuery.docs.map(doc => {
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
        // Calculate month range to apply interest
        let startMonth = fromMonthKey;
        let endMonth = toMonthKey;
        if (!startMonth && !endMonth) {
            // If no range specified, apply all available rates after the earliest transaction
            if (transactions.length > 0) {
                const earliestTransaction = transactions[0];
                const earliestDate = earliestTransaction.date;
                startMonth = `${earliestDate.getFullYear()}-${String(earliestDate.getMonth() + 1).padStart(2, '0')}`;
                const currentDate = new Date();
                endMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            }
        }
        const batch = admin.firestore().batch();
        let processedMonths = 0;
        let totalInterestApplied = 0;
        // Get all months between start and end
        const monthsToProcess = [];
        if (startMonth && endMonth) {
            const start = new Date(startMonth + '-01');
            const end = new Date(endMonth + '-01');
            for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
                const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (availableRates.has(monthKey)) {
                    monthsToProcess.push(monthKey);
                }
            }
        }
        // Process each month
        for (const monthKey of monthsToProcess) {
            const rate = availableRates.get(monthKey);
            const year = parseInt(monthKey.split('-')[0], 10);
            const month = parseInt(monthKey.split('-')[1], 10) - 1;
            const monthEndDate = new Date(year, month, new Date(year, month + 1, 0).getDate());
            // Check if interest for this month already exists
            const existingInterestQuery = await transactionsRef
                .where("investorId", "==", investorId)
                .where("type", "==", "interest")
                .get();
            const hasInterestForMonth = existingInterestQuery.docs.some(doc => {
                const data = doc.data();
                const transactionDate = data.date.toDate();
                return transactionDate.getFullYear() === year &&
                    transactionDate.getMonth() === month;
            });
            if (hasInterestForMonth) {
                continue; // Skip if interest already applied for this month
            }
            // Calculate balance at the end of this month
            let balanceAtMonthEnd = 0;
            for (const transaction of transactions) {
                if (transaction.date <= monthEndDate) {
                    if (transaction.type === 'invest' || transaction.type === 'deposit' || transaction.type === 'interest') {
                        balanceAtMonthEnd += transaction.amount;
                    }
                    else if (transaction.type === 'withdraw') {
                        balanceAtMonthEnd -= transaction.amount;
                    }
                }
            }
            if (balanceAtMonthEnd > 0) {
                const interestAmount = balanceAtMonthEnd * rate;
                // Create interest transaction
                const transactionDocRef = transactionsRef.doc();
                batch.set(transactionDocRef, {
                    investorId: investorId,
                    investorName: investor.name,
                    date: admin.firestore.Timestamp.fromDate(monthEndDate),
                    type: 'interest',
                    amount: interestAmount,
                });
                totalInterestApplied += interestAmount;
                processedMonths++;
                // Add this interest to our transactions array for next month calculation
                transactions.push({
                    id: 'temp-' + monthKey,
                    investorId: investorId,
                    investorName: investor.name,
                    type: 'interest',
                    amount: interestAmount,
                    date: monthEndDate
                });
            }
        }
        if (processedMonths > 0) {
            // Update investor balance
            const newBalance = (investor.balance || 0) + totalInterestApplied;
            batch.update(investorDoc.ref, { balance: newBalance });
            await batch.commit();
            logger.info(`Applied historical interest to investor ${investorId}:`, {
                months: processedMonths,
                totalInterest: totalInterestApplied
            });
            return {
                success: true,
                message: `Successfully applied historical interest for ${processedMonths} months. Total interest: ${totalInterestApplied.toFixed(2)}`,
                processedMonths,
                totalInterestApplied
            };
        }
        else {
            return { success: true, message: "No historical interest to apply (already applied or no qualifying months)." };
        }
    }
    catch (error) {
        logger.error("Error applying historical interest:", error);
        throw new https_1.HttpsError("internal", "An unexpected error occurred while applying historical interest.");
    }
});
/**
 * Recalculates interest for a specific investor by removing all existing interest and recalculating
 */
exports.recalculateInterestForInvestor = (0, https_1.onCall)(async (request) => {
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
        // Get all months that have rates and transactions
        const monthsWithRates = Array.from(availableRates.keys()).sort();
        const monthsWithTransactions = new Set();
        nonInterestTransactions.forEach(transaction => {
            const monthKey = `${transaction.date.getFullYear()}-${String(transaction.date.getMonth() + 1).padStart(2, '0')}`;
            monthsWithTransactions.add(monthKey);
        });
        // Process each month that has both rates and transactions
        for (const monthKey of monthsWithRates) {
            if (!monthsWithTransactions.has(monthKey))
                continue;
            const rate = availableRates.get(monthKey);
            const year = parseInt(monthKey.split('-')[0], 10);
            const month = parseInt(monthKey.split('-')[1], 10) - 1;
            const monthEndDate = new Date(year, month, new Date(year, month + 1, 0).getDate());
            // Calculate balance at the end of this month
            let balanceAtMonthEnd = 0;
            for (const transaction of nonInterestTransactions) {
                if (transaction.date <= monthEndDate) {
                    if (transaction.type === 'invest' || transaction.type === 'deposit' || transaction.type === 'interest') {
                        balanceAtMonthEnd += transaction.amount;
                    }
                    else if (transaction.type === 'withdraw') {
                        balanceAtMonthEnd -= transaction.amount;
                    }
                }
            }
            if (balanceAtMonthEnd > 0) {
                const interestAmount = balanceAtMonthEnd * rate;
                // Create new interest transaction
                const transactionDocRef = transactionsRef.doc();
                batch.set(transactionDocRef, {
                    investorId: investorId,
                    investorName: investor.name,
                    date: admin.firestore.Timestamp.fromDate(monthEndDate),
                    type: 'interest',
                    amount: interestAmount,
                });
                totalInterestApplied += interestAmount;
                processedMonths++;
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
exports.deleteInvestor = (0, https_1.onCall)(async (request) => {
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
//# sourceMappingURL=index.js.map