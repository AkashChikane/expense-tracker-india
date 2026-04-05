// Data storage keys
const STORAGE_KEYS = {
    EXPENSES: 'expenses_india',
    LOANS: 'loans_india',
    PASSWORD_HASH: 'app_password_hash',
    SESSION: 'app_session'
};

// Simple hash function for password (SHA-256)
const hashPassword = async (password) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Authentication
let isAuthenticated = false;

const checkAuth = () => {
    const session = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (session) {
        const sessionData = JSON.parse(session);
        // Session valid for 24 hours
        if (Date.now() - sessionData.timestamp < 24 * 60 * 60 * 1000) {
            isAuthenticated = true;
            showApp();
            return;
        }
    }
    showAuthScreen();
};

const showAuthScreen = () => {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
};

const showApp = () => {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    // Render initial data
    renderExpenses();
    renderLoans();
    renderSummary();
};

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('password-input').value;
    const errorMsg = document.getElementById('auth-error');
    
    const storedHash = localStorage.getItem(STORAGE_KEYS.PASSWORD_HASH);
    const inputHash = await hashPassword(password);
    
    if (!storedHash) {
        // First time - set password
        if (password.length < 4) {
            errorMsg.textContent = 'Password must be at least 4 characters';
            return;
        }
        localStorage.setItem(STORAGE_KEYS.PASSWORD_HASH, inputHash);
        localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify({ timestamp: Date.now() }));
        isAuthenticated = true;
        errorMsg.textContent = '';
        showApp();
        alert('Password set successfully! Remember it - you\'ll need it to access your data.');
    } else {
        // Verify password
        if (inputHash === storedHash) {
            localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify({ timestamp: Date.now() }));
            isAuthenticated = true;
            errorMsg.textContent = '';
            showApp();
        } else {
            errorMsg.textContent = 'Incorrect password';
            document.getElementById('password-input').value = '';
        }
    }
});

document.getElementById('reset-password').addEventListener('click', () => {
    if (confirm('⚠️ WARNING: Resetting your password will DELETE ALL YOUR DATA (expenses and loans). This cannot be undone. Continue?')) {
        if (confirm('Last chance! Are you absolutely sure you want to delete everything and reset?')) {
            localStorage.clear();
            expenses = [];
            loans = [];
            document.getElementById('password-input').value = '';
            document.getElementById('auth-error').textContent = 'Data cleared. Set a new password.';
        }
    }
});

document.getElementById('logout').addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    isAuthenticated = false;
    document.getElementById('password-input').value = '';
    document.getElementById('auth-error').textContent = '';
    showAuthScreen();
});

document.getElementById('change-password').addEventListener('click', async () => {
    const currentPassword = prompt('Enter your current password:');
    if (!currentPassword) return;
    
    const storedHash = localStorage.getItem(STORAGE_KEYS.PASSWORD_HASH);
    const currentHash = await hashPassword(currentPassword);
    
    if (currentHash !== storedHash) {
        alert('Incorrect current password');
        return;
    }
    
    const newPassword = prompt('Enter your new password (minimum 4 characters):');
    if (!newPassword || newPassword.length < 4) {
        alert('Password must be at least 4 characters');
        return;
    }
    
    const confirmPassword = prompt('Confirm your new password:');
    if (newPassword !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }
    
    const newHash = await hashPassword(newPassword);
    localStorage.setItem(STORAGE_KEYS.PASSWORD_HASH, newHash);
    alert('Password changed successfully!');
});

// Initialize data
let expenses = JSON.parse(localStorage.getItem(STORAGE_KEYS.EXPENSES)) || [];
let loans = JSON.parse(localStorage.getItem(STORAGE_KEYS.LOANS)) || [];

// Utility Functions
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
    }).format(amount);
};

const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const saveToStorage = () => {
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(loans));
};

// Tab Navigation
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update active tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // Refresh content when switching tabs
        if (tabName === 'summary') renderSummary();
    });
});

// Expense Management
document.getElementById('expense-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const expense = {
        id: Date.now(),
        name: document.getElementById('expense-name').value,
        amount: parseFloat(document.getElementById('expense-amount').value),
        category: document.getElementById('expense-category').value,
        date: document.getElementById('expense-date').value
    };
    
    expenses.unshift(expense);
    saveToStorage();
    renderExpenses();
    e.target.reset();
    
    // Set today's date as default
    document.getElementById('expense-date').valueAsDate = new Date();
});

const renderExpenses = () => {
    const container = document.getElementById('expenses-list');
    
    if (expenses.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <p>No expenses recorded yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = expenses.map(expense => `
        <div class="expense-item">
            <div class="expense-header">
                <span class="expense-name">${expense.name}</span>
                <span class="expense-amount">${formatCurrency(expense.amount)}</span>
            </div>
            <div class="expense-details">
                <span>${getCategoryEmoji(expense.category)} ${getCategoryName(expense.category)}</span>
                <span>${formatDate(expense.date)}</span>
                <button class="delete-btn" onclick="deleteExpense(${expense.id})">Delete</button>
            </div>
        </div>
    `).join('');
};

const deleteExpense = (id) => {
    if (confirm('Delete this expense?')) {
        expenses = expenses.filter(e => e.id !== id);
        saveToStorage();
        renderExpenses();
        renderSummary();
    }
};

const getCategoryEmoji = (category) => {
    const emojis = {
        food: '🍔', transport: '🚗', utilities: '💡',
        entertainment: '🎬', shopping: '🛍️', health: '⚕️',
        education: '📚', other: '📦'
    };
    return emojis[category] || '📦';
};

const getCategoryName = (category) => {
    const names = {
        food: 'Food & Dining', transport: 'Transport', utilities: 'Utilities',
        entertainment: 'Entertainment', shopping: 'Shopping', health: 'Health',
        education: 'Education', other: 'Other'
    };
    return names[category] || 'Other';
};

// Loan Management
document.getElementById('loan-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const principal = parseFloat(document.getElementById('loan-principal').value);
    const interestRate = parseFloat(document.getElementById('loan-interest').value);
    const tenure = parseInt(document.getElementById('loan-tenure').value);
    
    const monthlyRate = (interestRate / 100) / 12;
    const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, tenure) / (Math.pow(1 + monthlyRate, tenure) - 1);
    
    const loan = {
        id: Date.now(),
        name: document.getElementById('loan-name').value,
        principal: principal,
        interestRate: interestRate,
        tenure: tenure,
        emi: emi,
        startDate: document.getElementById('loan-start').value,
        totalPayable: emi * tenure
    };
    
    loans.unshift(loan);
    saveToStorage();
    renderLoans();
    e.target.reset();
});

const renderLoans = () => {
    const container = document.getElementById('loans-list');
    
    if (loans.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💳</div>
                <p>No loans recorded yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = loans.map(loan => {
        const monthsPassed = Math.floor((new Date() - new Date(loan.startDate)) / (1000 * 60 * 60 * 24 * 30));
        const progress = Math.min((monthsPassed / loan.tenure) * 100, 100);
        const remainingMonths = Math.max(loan.tenure - monthsPassed, 0);
        const totalInterest = loan.totalPayable - loan.principal;
        
        return `
            <div class="loan-item">
                <div class="loan-header">
                    <span class="loan-name">${loan.name}</span>
                    <span class="loan-amount">${formatCurrency(loan.principal)}</span>
                </div>
                <div class="loan-details">
                    <span>EMI: ${formatCurrency(loan.emi)}</span>
                    <span>${loan.interestRate}% p.a.</span>
                    <span>${remainingMonths}/${loan.tenure} months left</span>
                </div>
                <div class="loan-progress">
                    <small>Progress: ${progress.toFixed(1)}%</small>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                </div>
                <div class="loan-details" style="margin-top: 0.5rem;">
                    <span>Total Interest: ${formatCurrency(totalInterest)}</span>
                    <button class="delete-btn" onclick="deleteLoan(${loan.id})">Delete</button>
                </div>
            </div>
        `;
    }).join('');
};

const deleteLoan = (id) => {
    if (confirm('Delete this loan?')) {
        loans = loans.filter(l => l.id !== id);
        saveToStorage();
        renderLoans();
        renderSummary();
    }
};

// Loan Calculator
document.getElementById('calculate-btn').addEventListener('click', () => {
    const principal = parseFloat(document.getElementById('calc-principal').value);
    const interestRate = parseFloat(document.getElementById('calc-interest').value);
    const tenure = parseInt(document.getElementById('calc-tenure').value);
    const extraPayment = parseFloat(document.getElementById('calc-extra').value) || 0;
    
    if (!principal || !interestRate || !tenure) {
        alert('Please fill in all required fields');
        return;
    }
    
    // Calculate normal EMI
    const monthlyRate = (interestRate / 100) / 12;
    const normalEMI = principal * monthlyRate * Math.pow(1 + monthlyRate, tenure) / (Math.pow(1 + monthlyRate, tenure) - 1);
    const normalTotal = normalEMI * tenure;
    const normalInterest = normalTotal - principal;
    
    // Calculate with extra payment
    let balance = principal;
    let monthsWithExtra = 0;
    let totalPaidWithExtra = 0;
    const extraEMI = normalEMI + extraPayment;
    
    while (balance > 0 && monthsWithExtra < tenure) {
        const interestForMonth = balance * monthlyRate;
        const principalForMonth = extraEMI - interestForMonth;
        
        if (principalForMonth >= balance) {
            totalPaidWithExtra += balance + interestForMonth;
            balance = 0;
        } else {
            totalPaidWithExtra += extraEMI;
            balance -= principalForMonth;
        }
        monthsWithExtra++;
    }
    
    const interestWithExtra = totalPaidWithExtra - principal;
    const interestSaved = normalInterest - interestWithExtra;
    const monthsSaved = tenure - monthsWithExtra;
    const totalSaved = normalTotal - totalPaidWithExtra;
    
    // Display results
    const resultsContainer = document.getElementById('calculator-results');
    resultsContainer.innerHTML = `
        <h3 style="margin-bottom: 1rem;">Without Extra Payment</h3>
        <div class="result-row">
            <span class="result-label">Monthly EMI:</span>
            <span class="result-value">${formatCurrency(normalEMI)}</span>
        </div>
        <div class="result-row">
            <span class="result-label">Total Interest:</span>
            <span class="result-value">${formatCurrency(normalInterest)}</span>
        </div>
        <div class="result-row">
            <span class="result-label">Total Amount:</span>
            <span class="result-value">${formatCurrency(normalTotal)}</span>
        </div>
        
        ${extraPayment > 0 ? `
            <h3 style="margin: 1.5rem 0 1rem 0;">With Extra Payment (₹${extraPayment}/month)</h3>
            <div class="result-row">
                <span class="result-label">Monthly Payment:</span>
                <span class="result-value">${formatCurrency(extraEMI)}</span>
            </div>
            <div class="result-row">
                <span class="result-label">Total Interest:</span>
                <span class="result-value">${formatCurrency(interestWithExtra)}</span>
            </div>
            <div class="result-row">
                <span class="result-label">Total Amount:</span>
                <span class="result-value">${formatCurrency(totalPaidWithExtra)}</span>
            </div>
            <div class="result-row">
                <span class="result-label">Payoff Time:</span>
                <span class="result-value">${monthsWithExtra} months</span>
            </div>
            
            <div class="savings-highlight">
                <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">💰 You Save!</div>
                <div style="font-size: 1.3rem; font-weight: 700;">${formatCurrency(totalSaved)}</div>
                <div style="font-size: 0.9rem; margin-top: 0.5rem; opacity: 0.9;">
                    Interest saved: ${formatCurrency(interestSaved)}<br>
                    Time saved: ${monthsSaved} months
                </div>
            </div>
            
            <div style="margin-top: 1rem; padding: 1rem; background: #fef3c7; border-radius: 0.5rem; font-size: 0.9rem;">
                <strong>💡 Tip:</strong> By paying an extra ${formatCurrency(extraPayment)} per month, you'll be debt-free ${monthsSaved} months earlier and save ${formatCurrency(interestSaved)} in interest!
            </div>
        ` : ''}
    `;
});

// Summary
const renderSummary = () => {
    const summaryContainer = document.getElementById('summary-content');
    const breakdownContainer = document.getElementById('monthly-breakdown');
    
    // Calculate totals
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalLoans = loans.reduce((sum, l) => sum + l.principal, 0);
    const totalEMI = loans.reduce((sum, l) => sum + l.emi, 0);
    const totalLoanInterest = loans.reduce((sum, l) => sum + (l.totalPayable - l.principal), 0);
    
    // Current month expenses
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthlyExpenses = expenses.filter(e => e.date.startsWith(currentMonth))
        .reduce((sum, e) => sum + e.amount, 0);
    
    summaryContainer.innerHTML = `
        <div class="summary-stat">
            <span class="stat-label">💸 Total Expenses (All Time)</span>
            <span class="stat-value negative">${formatCurrency(totalExpenses)}</span>
        </div>
        <div class="summary-stat">
            <span class="stat-label">📅 This Month's Expenses</span>
            <span class="stat-value negative">${formatCurrency(monthlyExpenses)}</span>
        </div>
        <div class="summary-stat">
            <span class="stat-label">💳 Active Loan Amount</span>
            <span class="stat-value neutral">${formatCurrency(totalLoans)}</span>
        </div>
        <div class="summary-stat">
            <span class="stat-label">📊 Total Monthly EMI</span>
            <span class="stat-value negative">${formatCurrency(totalEMI)}</span>
        </div>
        <div class="summary-stat">
            <span class="stat-label">⚠️ Total Interest Payable</span>
            <span class="stat-value negative">${formatCurrency(totalLoanInterest)}</span>
        </div>
        
        ${totalLoans > 0 ? `
            <div style="margin-top: 1.5rem; padding: 1rem; background: #fef3c7; border-radius: 0.5rem;">
                <strong>💡 Loan Reduction Tip:</strong><br>
                <small>Use the Calculator tab to see how extra payments can reduce your loan burden. Even small extra payments can save lakhs in interest!</small>
            </div>
        ` : ''}
    `;
    
    // Category breakdown
    const categoryTotals = {};
    expenses.forEach(e => {
        categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });
    
    const sortedCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1]);
    
    if (sortedCategories.length > 0) {
        breakdownContainer.innerHTML = `
            <h3 style="margin-bottom: 1rem;">Expenses by Category</h3>
            ${sortedCategories.map(([cat, amount]) => {
                const percentage = totalExpenses > 0 ? (amount / totalExpenses * 100).toFixed(1) : 0;
                return `
                    <div class="summary-stat">
                        <span class="stat-label">${getCategoryEmoji(cat)} ${getCategoryName(cat)}</span>
                        <span class="stat-value neutral">${formatCurrency(amount)} <small>(${percentage}%)</small></span>
                    </div>
                `;
            }).join('')}
        `;
    } else {
        breakdownContainer.innerHTML = `
            <div class="empty-state">
                <p>No expense data to show breakdown</p>
            </div>
        `;
    }
};

// Data Export/Import
document.getElementById('export-data').addEventListener('click', () => {
    const data = {
        expenses,
        loans,
        exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById('import-data').addEventListener('click', () => {
    document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            
            if (confirm('This will replace all current data. Continue?')) {
                expenses = data.expenses || [];
                loans = data.loans || [];
                saveToStorage();
                renderExpenses();
                renderLoans();
                renderSummary();
                alert('Data imported successfully!');
            }
        } catch (error) {
            alert('Invalid file format');
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
});

document.getElementById('clear-data').addEventListener('click', () => {
    if (confirm('⚠️ This will delete ALL your data permanently. Are you absolutely sure?')) {
        if (confirm('Last chance! This cannot be undone. Proceed?')) {
            localStorage.clear();
            expenses = [];
            loans = [];
            renderExpenses();
            renderLoans();
            renderSummary();
            alert('All data cleared');
        }
    }
});

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication first
    checkAuth();
    
    // Set today's date as default for expense form
    document.getElementById('expense-date').valueAsDate = new Date();
    document.getElementById('loan-start').valueAsDate = new Date();
});
