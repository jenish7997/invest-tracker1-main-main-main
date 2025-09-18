# Month-wise Interest Display Feature

## Overview
Added month-wise interest breakdown display in the report page, showing interest calculations in brackets for better visibility and tracking.

## Changes Made

### 1. TypeScript Component (`report.component.ts`)

**New Interface:**
- Added `MonthlyInterest` interface with `month` and `amount` properties
- Extended `ReportData` interface to include `monthlyInterestBreakdown: MonthlyInterest[]`

**Enhanced Methods:**
- `generateReport()`: Now calculates monthly interest breakdown from transactions
- `getMonthKey()`: Private method to extract month-year key from dates
- `formatMonthDisplay()`: Formats month keys into readable format (e.g., "Jan 2024")
- `getTransactionMonth()`: Formats transaction dates for display in table

**Key Features:**
- Groups interest transactions by month-year
- Sorts monthly breakdowns chronologically
- Handles both string and Date object formats for transaction dates

### 2. HTML Template (`report.component.html`)

**Interest Summary Card:**
- Added monthly breakdown display under total interest
- Shows format: `(Jan 2024: ₹5,000, Feb 2024: ₹5,200)`
- Only displays if there are monthly breakdowns available

**Transactions Table:**
- Added month display in interest column
- Shows format: `₹5,000.00 (Jan 2024)` for each interest transaction

### 3. CSS Styling (`report.component.css`)

**New Styles:**
- `.monthly-breakdown`: Container for monthly breakdown text
- `.breakdown-text`: Styling for the breakdown text in brackets
- `.interest-month`: Styling for month display in transaction table

**Features:**
- Subtle italic styling for breakdown text
- Smaller font sizes for month information
- Maintains visual hierarchy and readability

## Example Display

### Interest Summary Card:
```
Total Interest: ₹15,600.00
(Jan 2024: ₹5,000, Feb 2024: ₹5,200, Mar 2024: ₹5,400)
```

### Transactions Table:
```
Interest Column:
₹5,000.00
(Jan 2024)

₹5,200.00
(Feb 2024)
```

## Technical Implementation

### Data Flow:
1. **Fetch Transactions**: Get all transactions for investor
2. **Filter Interest**: Identify interest type transactions
3. **Group by Month**: Create month-year keys and sum amounts
4. **Sort Chronologically**: Order months for display
5. **Display**: Show in both summary card and transaction table

### Month Key Format:
- Internal format: `"2024-01"` (YYYY-MM)
- Display format: `"Jan 2024"` (MMM YYYY)

### Error Handling:
- Graceful handling of date format variations
- Safe fallbacks for invalid dates
- Conditional display (only shows if data exists)

## Benefits

1. **Enhanced Visibility**: Users can see exactly which months earned interest
2. **Better Tracking**: Easy to identify interest payment patterns
3. **Improved UX**: Clear breakdown without cluttering the interface
4. **Historical Data**: Month-wise tracking for financial analysis
5. **Responsive Design**: Works on all screen sizes

## Usage

The feature automatically activates when:
- User has interest transactions in their account
- Interest has been applied through the admin panel
- Historical interest calculations exist

No additional configuration required - the breakdown appears automatically based on existing transaction data.
