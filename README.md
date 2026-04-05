# 🏦 Expense & Loan Tracker - India

A comprehensive, mobile-first **expense and loan tracking** application designed for Indian users with full INR (₹) currency support. Zero dependencies, works completely offline, and keeps all your financial data private on your device.

---

## 🗂️ Codebase Overview (for AI agents)

This is a **vanilla JavaScript single-page application** (no framework, no build step):

```
expense-tracker-india/
├── index.html    — Full DOM structure, all tabs and forms
├── app.js        — All JavaScript logic (~800 lines)
├── styles.css    — All styling, dark theme, responsive (~900 lines)
└── README.md     — This file
```

### Key Architecture Patterns

- **State**: Three global arrays/variables — `expenses[]`, `loans[]`, `monthlyBudget`, `expenseCategoryFilter`, `isAuthenticated`, `calendarOffsetMonths`
- **Storage**: `localStorage` with keys defined in `STORAGE_KEYS` constant
- **Rendering**: Imperative DOM rendering — each `render*()` function overwrites innerHTML of a container element
- **Authentication**: SHA-256 password hash stored in localStorage; session expires after 24 hours
- **Entry point**: Single `DOMContentLoaded` listener at the bottom of `app.js` wires all event handlers then calls `checkAuth()`

### STORAGE_KEYS (localStorage)
| Key | Value |
|-----|-------|
| `expenses_india` | JSON array of expense objects |
| `loans_india` | JSON array of loan objects |
| `app_password_hash` | SHA-256 hex string |
| `app_session` | `{ timestamp: number }` |
| `monthly_budget_india` | Number (budget in ₹) |

### Data Schemas
**Expense object:**
```json
{ "id": 1712345678901, "name": "Groceries", "amount": 500, "category": "food", "date": "2024-04-05" }
```
**Loan object:**
```json
{ "id": 1712345678901, "name": "Home Loan", "principal": 5000000, "interestRate": 8.5, "tenure": 240, "emi": 43391, "startDate": "2023-01-01", "totalPayable": 10413810 }
```

### Key Functions
| Function | Purpose |
|----------|---------|
| `calcEmi(principal, annualRate, months)` | Standard EMI formula |
| `loanMetrics(loan)` | Returns emi, total, totalInt, start, end dates |
| `getLoanProgress(loan)` | Returns progress%, monthsPaid, remaining months |
| `getRemainingBalance(loan)` | Present value of remaining EMI payments |
| `simulatePrepaymentSavings(loan, extra, oneTime)` | Simulate accelerated repayment |
| `getDueLoansForMonth(date)` | Get EMIs due in a given calendar month |
| `renderLoans()` | Render loan cards in #loans-list |
| `renderExpenses()` | Render filtered expense list in #expenses-list |
| `renderExpenseSummary()` | Render category breakdown in #expense-summary |
| `renderBudgetTracker()` | Render monthly budget progress in #budget-tracker |
| `renderCalendar()` | Render EMI calendar in #calendar-content |
| `renderOptimizeDetails(loanId)` | Render loan optimization results |
| `refreshAll()` | Call all render functions |
| `saveToStorage()` | Persist state to localStorage (with quota error handling) |
| `hashPassword(password)` | SHA-256 hash via Web Crypto API (async) |
| `checkAuth()` | Validate session, show auth or app screen |

---

## ✨ Features

### 📊 Expense Tracking
- Add expenses with description, amount (₹), category, and date
- **8 categories**: Food & Dining, Transport, Utilities, Entertainment, Shopping, Health, Education, Other
- **Category filter** — filter the expense list by any category
- Shows 15 most recent expenses (50 when filtered)
- Monthly expense summary with category breakdown

### 💰 Monthly Budget Tracker
- Set a monthly spending budget (₹)
- Live progress bar showing spending vs. budget
- Visual over-budget warning with colour change
- Shows amount spent, budget, and remaining/overage

### 💳 Loan Management
- Add and track multiple loans simultaneously
- Automatic EMI calculation using standard formula: `EMI = P·r·(1+r)ⁿ / ((1+r)ⁿ−1)`
- Visual progress bar showing repayment progress
- **Estimated outstanding balance** — present value of remaining payments
- Displays: EMI amount, interest rate, tenure, total interest payable, months remaining

### 📅 EMI Calendar
- Month-by-month view of all EMI payments due
- Navigate forward/backward by month
- Groups multiple loans by due date
- Shows EMI installment number (e.g., "EMI 5/60")
- Total EMI amount for the month

### 💡 Loan Optimizer
- Select any loan and enter extra monthly payment and/or one-time prepayment
- Calculates: interest saved, months saved, total savings, and close-by month
- Side-by-side comparison table: Current Plan vs. With Extra Payments

### 🔒 Security & Privacy
- Password protected with SHA-256 hashing (Web Crypto API)
- Sessions expire after 24 hours (auto-logout)
- All data stored locally — **never leaves your browser**
- No external dependencies, no network requests

### 💾 Data Management
- **Export**: Download a timestamped JSON backup
- **Import**: Restore from a previous JSON backup (with confirmation)
- **Reset Password**: Available on the login screen (clears all data)
- **Change Password**: Available in the footer (requires current password)
- **Logout**: Clear session without deleting data

---

## 🚀 Running the App

### Simplest: Open directly in browser
```bash
open index.html        # macOS
xdg-open index.html    # Linux
```
> ⚠️ Some browsers restrict `localStorage` on `file://` URLs. Use a server for best results.

### Recommended: Local HTTP server
```bash
# Python 3 (pre-installed on most systems)
cd expense-tracker-india
python3 -m http.server 8000
# Visit: http://localhost:8000

# Node.js
npx serve .
# Visit: http://localhost:3000
```

### Production: Static hosting
Drop the 3 files (`index.html`, `styles.css`, `app.js`) on any static host:
- GitHub Pages (`git push` + enable Pages)
- Netlify (drag-and-drop deploy)
- Vercel (`vercel --prod`)
- Any web server (nginx, Apache)

**No build step needed.** The app is ready to deploy as-is.

---

## 🔧 First-Time Setup

1. Open the app in a browser
2. You'll see a password screen — enter any password (min. 4 characters) to set it
3. Your session lasts 24 hours; after that you'll need to log in again
4. **Forgot password?** Click "Reset Password" on the login screen (⚠️ clears all data)

---

## 📱 Mobile Support

The app is responsive and optimized for mobile:
- Tabs switch to a 2×2 grid on small screens (< 480px)
- Header stats maintain 3 columns on all screen sizes
- Cards reduce padding on mobile
- Footer buttons arrange in a 2-column grid
- All forms use full-width inputs

---

## 🧪 No Test Suite

This project has no automated test suite. Manual testing is done by:
1. Opening the app in a browser
2. Adding sample loans and expenses
3. Verifying calculations match expected EMI values

---

## 🗺️ Potential Future Improvements

- Recurring expense templates (mark an expense as monthly/weekly)
- PDF bank statement parsing for bulk import
- Income tracking alongside expenses
- Bar/pie charts for expense categories (e.g., Chart.js)
- Push/browser notifications for upcoming EMI due dates
- Multi-currency support beyond INR
- Cloud sync option (e.g., Supabase, Firebase)

---

## 🔐 Security Notes

- Password hashing uses browser's native **Web Crypto API** (`crypto.subtle.digest('SHA-256')`)
- No data is ever transmitted over the network
- The SHA-256 hash is stored in `localStorage` (not the plain-text password)
- Session is a timestamp in `localStorage`; clearing browser data logs you out
- There is no password recovery — if forgotten, use "Reset Password" (deletes all data)

---

Made with ❤️ for smart financial management in India 🇮🇳
