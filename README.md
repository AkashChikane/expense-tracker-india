# 💰 Expense Tracker - India

A comprehensive, mobile-first expense and loan tracking application designed for Indian users with INR currency support.

## Features

### 📊 Expense Tracking
- Track daily expenses with categories (Food, Transport, Utilities, Entertainment, Shopping, Health, Education, Other)
- Date-based expense logging
- Visual category breakdown
- Monthly expense summaries

### 💳 Loan Management
- Add and track multiple loans
- Automatic EMI calculation
- Visual progress tracking
- Interest calculation
- Remaining tenure display

### 💡 Loan Reduction Calculator
- Calculate potential savings with extra EMI payments
- See how much interest you can save
- Discover how many months you can reduce from your loan tenure
- Detailed breakdown of normal vs. accelerated payment plans

### 📈 Financial Summary
- All-time expense overview
- Current month expenses
- Total active loans
- Monthly EMI obligations
- Total interest payable across all loans
- Category-wise expense breakdown

### 🔒 Privacy & Security
- All data stored locally in your browser (localStorage)
- No server communication - completely offline after initial load
- Private repository ensures only you have access
- Export/import functionality for backups

## Usage

### Adding an Expense
1. Go to the "Expenses" tab
2. Fill in description, amount (₹), category, and date
3. Click "Add Expense"

### Adding a Loan
1. Go to the "Loans" tab
2. Enter loan name, principal amount (₹), interest rate (% p.a.), tenure (months), and start date
3. Click "Add Loan" - EMI will be calculated automatically

### Using the Loan Calculator
1. Go to the "Calculator" tab
2. Enter loan amount, interest rate, and tenure
3. Optionally add extra monthly payment amount
4. Click "Calculate Savings" to see how much you can save

### Viewing Summary
1. Go to the "Summary" tab
2. View your complete financial overview
3. See category-wise breakdown

### Data Management
- **Export Data**: Download a JSON backup of all your expenses and loans
- **Import Data**: Restore from a previous backup
- **Clear All Data**: Delete all data (use with caution!)

## Technical Details

- **Framework**: Vanilla JavaScript (no dependencies)
- **Storage**: Browser localStorage
- **Currency**: Indian Rupee (₹/INR)
- **Responsive**: Optimized for mobile devices
- **Browser Support**: Modern browsers (Chrome, Firefox, Safari, Edge)

## Future Enhancements

- Receipt scanning and OCR for automatic expense entry
- PDF bank statement upload and parsing
- Recurring expense tracking
- Budget goals and alerts
- Expense vs. income tracking
- More detailed charts and visualizations

## Privacy

This application runs entirely in your browser. No data is sent to any server. All information is stored locally on your device using localStorage.

---

Made with ❤️ for smart financial management
