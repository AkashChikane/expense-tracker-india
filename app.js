// =========================
// Storage schema (preserved)
// =========================
const STORAGE_KEYS = {
    EXPENSES: 'expenses_india',
    LOANS: 'loans_india',
    PASSWORD_HASH: 'app_password_hash',
    SESSION: 'app_session'
};

// =========================
// State
// =========================
let expenses = JSON.parse(localStorage.getItem(STORAGE_KEYS.EXPENSES) || '[]');
let loans = JSON.parse(localStorage.getItem(STORAGE_KEYS.LOANS) || '[]');
let isAuthenticated = false;
let calendarOffsetMonths = 0;

// =========================
// Utilities
// =========================
const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
}).format(Number(amount || 0));

const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const safeDate = (dateStr) => {
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? null : d;
};

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const addMonths = (date, months) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
};

const monthsBetween = (start, end) => {
    const s = new Date(start.getFullYear(), start.getMonth(), 1);
    const e = new Date(end.getFullYear(), end.getMonth(), 1);
    return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
};

const monthlyRateFromAnnual = (annualRate) => (annualRate / 100) / 12;

const calcEmi = (principal, annualRate, tenureMonths) => {
    const p = Number(principal || 0);
    const r = monthlyRateFromAnnual(Number(annualRate || 0));
    const n = Number(tenureMonths || 0);
    if (!p || !n) return 0;
    if (r === 0) return p / n;
    return p * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
};

const totalPayable = (principal, emi, tenureMonths) => emi * tenureMonths;

const totalInterest = (principal, emi, tenureMonths) => (emi * tenureMonths) - principal;

const saveToStorage = () => {
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(loans));
};

const escapeHtml = (str) => String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

// =========================
// Password protection
// =========================
const hashPassword = async (password) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
};

const showAuthScreen = () => {
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('main-app');
    if (auth) auth.style.display = 'flex';
    if (app) app.style.display = 'none';
};

const showApp = () => {
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('main-app');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = 'block';
    refreshAll();
};

const checkAuth = () => {
    const session = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (!session) {
        showAuthScreen();
        return;
    }

    try {
        const sessionData = JSON.parse(session);
        if (Date.now() - sessionData.timestamp < 24 * 60 * 60 * 1000) {
            isAuthenticated = true;
            showApp();
            return;
        }
    } catch {}

    showAuthScreen();
};

// =========================
// Loan calculations/schedules
// =========================
const loanMetrics = (loan) => {
    const emi = Number(loan.emi || calcEmi(loan.principal, loan.interestRate, loan.tenure));
    const principal = Number(loan.principal || 0);
    const interest = Number(loan.interestRate || 0);
    const tenure = Number(loan.tenure || 0);
    const total = emi * tenure;
    const totalInt = total - principal;
    const start = safeDate(loan.startDate);
    const end = start ? addMonths(start, tenure - 1) : null;
    return { emi, total, totalInt, start, end };
};

const getLoanProgress = (loan) => {
    const { start } = loanMetrics(loan);
    if (!start) return { progress: 0, monthsPaid: 0, remaining: loan.tenure || 0 };
    const now = new Date();
    const monthsPaid = Math.max(0, monthsBetween(start, now) + (now.getDate() >= start.getDate() ? 1 : 0));
    const remaining = Math.max((loan.tenure || 0) - monthsPaid, 0);
    const progress = Math.min(((monthsPaid / (loan.tenure || 1)) * 100), 100);
    return { progress, monthsPaid, remaining };
};

const getDueLoansForMonth = (date) => {
    const targetKey = monthKey(date);
    return loans
        .map((loan) => {
            const { start, end, emi, totalInt, total } = loanMetrics(loan);
            if (!start) return null;
            const startKey = monthKey(start);
            const endKey = end ? monthKey(end) : startKey;
            if (targetKey < startKey || targetKey > endKey) return null;

            const monthsSinceStart = monthsBetween(start, date);
            const installmentNumber = Math.max(1, monthsSinceStart + 1);
            return {
                ...loan,
                emi,
                totalInt,
                total,
                installmentNumber
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
};

const simulatePrepaymentSavings = (loan, extraMonthly = 0, oneTimePrepayment = 0) => {
    const principal = Number(loan.principal || 0);
    const rate = monthlyRateFromAnnual(Number(loan.interestRate || 0));
    const emi = Number(loan.emi || calcEmi(loan.principal, loan.interestRate, loan.tenure));
    const tenure = Number(loan.tenure || 0);
    if (!principal || !tenure) return null;

    let balance = principal - Number(oneTimePrepayment || 0);
    balance = Math.max(balance, 0);

    const baseMonthly = emi;
    const payment = baseMonthly + Number(extraMonthly || 0);
    const maxMonths = Math.max(tenure * 2, 1);
    let paid = Number(oneTimePrepayment || 0);
    let months = 0;

    while (balance > 0 && months < maxMonths) {
        const interestPart = balance * rate;
        const principalPart = payment - interestPart;

        if (principalPart <= 0) {
            return null;
        }

        if (principalPart >= balance) {
            paid += balance + interestPart;
            balance = 0;
        } else {
            paid += payment;
            balance -= principalPart;
        }
        months += 1;
    }

    const normalTotal = baseMonthly * tenure;
    const normalInterest = normalTotal - principal;
    const actualInterest = paid - principal;
    return {
        normalTotal,
        normalInterest,
        actualPaid: paid,
        actualInterest,
        saved: normalTotal - paid,
        interestSaved: normalInterest - actualInterest,
        monthsSaved: tenure - months,
        monthsToClose: months,
        monthlyPayment: payment
    };
};

// =========================
// Rendering helpers
// =========================
const getCategoryEmoji = (category) => ({
    food: '🍔', transport: '🚗', utilities: '💡', entertainment: '🎬',
    shopping: '🛍️', health: '⚕️', education: '📚', other: '📦'
}[category] || '📦');

const getCategoryName = (category) => ({
    food: 'Food & Dining', transport: 'Transport', utilities: 'Utilities',
    entertainment: 'Entertainment', shopping: 'Shopping', health: 'Health',
    education: 'Education', other: 'Other'
}[category] || 'Other');

const renderHeaderStats = () => {
    const totalDebt = loans.reduce((sum, loan) => sum + Number(loan.principal || 0), 0);
    const monthlyEmi = loans.reduce((sum, loan) => sum + Number(loan.emi || calcEmi(loan.principal, loan.interestRate, loan.tenure)), 0);
    const interestPayable = loans.reduce((sum, loan) => sum + totalInterest(Number(loan.principal || 0), Number(loan.emi || calcEmi(loan.principal, loan.interestRate, loan.tenure)), Number(loan.tenure || 0)), 0);

    const debtEl = document.getElementById('total-loans-amount');
    const emiEl = document.getElementById('monthly-emi');
    const intEl = document.getElementById('total-interest');

    if (debtEl) debtEl.textContent = formatCurrency(totalDebt);
    if (emiEl) emiEl.textContent = formatCurrency(monthlyEmi);
    if (intEl) intEl.textContent = formatCurrency(interestPayable);
};

const renderLoans = () => {
    const container = document.getElementById('loans-list');
    if (!container) return;

    if (!loans.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🏦</div>
                <p>No loans recorded yet</p>
                <p style="margin-top: .5rem;">Add your first loan to start tracking EMI and savings.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = loans.map((loan) => {
        const { emi, total, totalInt } = loanMetrics(loan);
        const { progress, remaining } = getLoanProgress(loan);
        const safeName = escapeHtml(loan.name);
        const selectId = `optimize-${loan.id}`;

        return `
            <div class="loan-item">
                <div class="loan-header">
                    <span class="loan-name">${safeName}</span>
                    <span class="loan-amount">${formatCurrency(loan.principal)}</span>
                </div>

                <div class="loan-info-grid">
                    <div class="loan-info-item">
                        <div class="loan-info-label">Monthly EMI</div>
                        <div class="loan-info-value">${formatCurrency(emi)}</div>
                    </div>
                    <div class="loan-info-item">
                        <div class="loan-info-label">Interest Rate</div>
                        <div class="loan-info-value">${Number(loan.interestRate || 0).toFixed(2)}% p.a.</div>
                    </div>
                    <div class="loan-info-item">
                        <div class="loan-info-label">Tenure</div>
                        <div class="loan-info-value">${loan.tenure || 0} months</div>
                    </div>
                    <div class="loan-info-item">
                        <div class="loan-info-label">Total Interest</div>
                        <div class="loan-info-value">${formatCurrency(totalInt)}</div>
                    </div>
                </div>

                <div class="loan-progress">
                    <div class="progress-label">
                        <span>Started: ${formatDate(loan.startDate)}</span>
                        <span>${remaining} months left</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width:${progress}%"></div>
                    </div>
                </div>

                <div class="loan-actions">
                    <button class="btn btn-secondary btn-small" onclick="openOptimizeLoan(${loan.id})">Optimize</button>
                    <button class="btn btn-danger btn-small" onclick="deleteLoan(${loan.id})">Delete</button>
                </div>
            </div>
        `;
    }).join('');
};

const renderExpenses = () => {
    const container = document.getElementById('expenses-list');
    if (!container) return;

    if (!expenses.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🧾</div>
                <p>No expenses recorded yet</p>
            </div>
        `;
        return;
    }

    const recent = [...expenses].sort((a, b) => b.id - a.id).slice(0, 8);
    container.innerHTML = recent.map((expense) => `
        <div class="expense-item">
            <div class="expense-header">
                <span class="expense-name">${escapeHtml(expense.name)}</span>
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

const renderExpenseSummary = () => {
    const container = document.getElementById('expense-summary');
    if (!container) return;

    if (!expenses.length) {
        container.innerHTML = `<div class="empty-state"><p>No expense summary yet.</p></div>`;
        return;
    }

    const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const currentMonth = monthKey(new Date());
    const monthTotal = expenses.filter((e) => (e.date || '').startsWith(currentMonth))
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const byCategory = expenses.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + Number(e.amount || 0);
        return acc;
    }, {});

    container.innerHTML = `
        <div class="summary-stat">
            <span class="stat-label">All-time expense total</span>
            <span class="stat-value negative">${formatCurrency(total)}</span>
        </div>
        <div class="summary-stat">
            <span class="stat-label">This month</span>
            <span class="stat-value negative">${formatCurrency(monthTotal)}</span>
        </div>
        ${Object.entries(byCategory)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, amount]) => `
                <div class="summary-stat">
                    <span class="stat-label">${getCategoryEmoji(cat)} ${getCategoryName(cat)}</span>
                    <span class="stat-value neutral">${formatCurrency(amount)}</span>
                </div>
            `).join('')}
    `;
};

const renderCalendar = () => {
    const monthLabel = document.getElementById('current-month');
    const container = document.getElementById('calendar-content');
    if (!monthLabel || !container) return;

    const target = addMonths(new Date(), calendarOffsetMonths);
    const options = { month: 'long', year: 'numeric' };
    monthLabel.textContent = target.toLocaleDateString('en-IN', options);

    const dueLoans = getDueLoansForMonth(target);
    if (!dueLoans.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📅</div>
                <p>No EMIs due in this month.</p>
            </div>
        `;
        return;
    }

    const grouped = dueLoans.reduce((acc, loan) => {
        const payDate = safeDate(loan.startDate) || new Date();
        const dueDate = new Date(target.getFullYear(), target.getMonth(), payDate.getDate());
        const key = dueDate.toISOString().slice(0, 10);
        acc[key] = acc[key] || [];
        acc[key].push({ ...loan, dueDate });
        return acc;
    }, {});

    const sortedKeys = Object.keys(grouped).sort();
    const totalEmiThisMonth = dueLoans.reduce((sum, l) => sum + Number(l.emi || 0), 0);

    container.innerHTML = `
        <div class="summary-stat" style="margin-bottom: 1rem;">
            <span class="stat-label">Total EMI this month</span>
            <span class="stat-value neutral">${formatCurrency(totalEmiThisMonth)}</span>
        </div>
        ${sortedKeys.map((key) => {
            const loansForDay = grouped[key];
            return `
                <div class="emi-day">
                    <div class="emi-date">${formatDate(key)}</div>
                    ${loansForDay.map((loan) => `
                        <div class="emi-list-item">
                            <span>${escapeHtml(loan.name)} • EMI ${loan.installmentNumber}/${loan.tenure}</span>
                            <strong>${formatCurrency(loan.emi)}</strong>
                        </div>
                    `).join('')}
                </div>
            `;
        }).join('')}
    `;
};

const renderOptimizeSelect = () => {
    const select = document.getElementById('optimize-loan-select');
    if (!select) return;

    const current = select.value;
    select.innerHTML = `<option value="">-- Choose a loan --</option>` + loans.map((loan) => 
        `<option value="${loan.id}">${escapeHtml(loan.name)} • ${formatCurrency(loan.principal)}</option>`
    ).join('');

    if (current) select.value = current;
};

const renderOptimizeDetails = (loanId) => {
    const container = document.getElementById('optimize-loan-details');
    if (!container) return;

    const loan = loans.find((l) => String(l.id) === String(loanId));
    if (!loan) {
        container.innerHTML = `
            <div class="empty-state">
                <p>Select one of your existing loans to see savings.</p>
            </div>
        `;
        return;
    }

    const extraMonthly = Number(document.getElementById('opt-extra-monthly')?.value || 0);
    const oneTimePrepayment = Number(document.getElementById('opt-one-time')?.value || 0);
    const result = simulatePrepaymentSavings(loan, extraMonthly, oneTimePrepayment);

    if (!result) {
        container.innerHTML = `<div class="empty-state"><p>Can’t calculate savings for this loan with the current inputs.</p></div>`;
        return;
    }

    container.innerHTML = `
        <div class="optimize-results">
            <div class="savings-card">
                <div>Potential savings on</div>
                <div style="font-size:1.5rem;font-weight:700;margin-top:.25rem;">${escapeHtml(loan.name)}</div>
                <div class="savings-amount">${formatCurrency(result.saved)}</div>
                <div>Estimated total savings</div>
            </div>

            <div class="comparison-table">
                <div class="comparison-col">
                    <h4>Current Plan</h4>
                    <div class="comparison-row"><span>Monthly EMI</span><strong>${formatCurrency(loan.emi)}</strong></div>
                    <div class="comparison-row"><span>Total Interest</span><strong>${formatCurrency(result.normalInterest)}</strong></div>
                    <div class="comparison-row"><span>Total Payable</span><strong>${formatCurrency(result.normalTotal)}</strong></div>
                    <div class="comparison-row"><span>Duration</span><strong>${loan.tenure} months</strong></div>
                </div>
                <div class="comparison-col">
                    <h4>With Extra Payments</h4>
                    <div class="comparison-row"><span>Monthly Payment</span><strong>${formatCurrency(result.monthlyPayment)}</strong></div>
                    <div class="comparison-row"><span>Total Interest</span><strong>${formatCurrency(result.actualInterest)}</strong></div>
                    <div class="comparison-row"><span>Total Paid</span><strong>${formatCurrency(result.actualPaid)}</strong></div>
                    <div class="comparison-row"><span>Close In</span><strong>${result.monthsToClose} months</strong></div>
                </div>
            </div>

            <div class="savings-card" style="margin-top:1.5rem; background: linear-gradient(135deg, #0f766e 0%, #10b981 100%);">
                <div>Interest saved</div>
                <div class="savings-amount" style="font-size:2rem;">${formatCurrency(result.interestSaved)}</div>
                <div>Time saved: ${Math.max(result.monthsSaved, 0)} months</div>
            </div>
        </div>
    `;
};

const refreshAll = () => {
    renderHeaderStats();
    renderLoans();
    renderExpenses();
    renderExpenseSummary();
    renderCalendar();
    renderOptimizeSelect();
    renderOptimizeDetails(document.getElementById('optimize-loan-select')?.value || '');
};

// =========================
// Actions
// =========================
window.deleteLoan = (id) => {
    if (!confirm('Delete this loan?')) return;
    loans = loans.filter((loan) => String(loan.id) !== String(id));
    saveToStorage();
    refreshAll();
};

window.deleteExpense = (id) => {
    if (!confirm('Delete this expense?')) return;
    expenses = expenses.filter((expense) => String(expense.id) !== String(id));
    saveToStorage();
    refreshAll();
};

window.openOptimizeLoan = (id) => {
    const select = document.getElementById('optimize-loan-select');
    if (!select) return;
    select.value = String(id);
    document.querySelector('[data-tab="optimize"]')?.click();
    renderOptimizeDetails(id);
};

// =========================
// Form handlers
// =========================
document.addEventListener('DOMContentLoaded', () => {
    // auth
    document.getElementById('auth-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('password-input').value;
        const errorMsg = document.getElementById('auth-error');
        const storedHash = localStorage.getItem(STORAGE_KEYS.PASSWORD_HASH);
        const inputHash = await hashPassword(password);

        if (!storedHash) {
            if (password.length < 4) {
                errorMsg.textContent = 'Password must be at least 4 characters';
                return;
            }
            localStorage.setItem(STORAGE_KEYS.PASSWORD_HASH, inputHash);
            localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify({ timestamp: Date.now() }));
            isAuthenticated = true;
            errorMsg.textContent = '';
            showApp();
            return;
        }

        if (inputHash === storedHash) {
            localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify({ timestamp: Date.now() }));
            isAuthenticated = true;
            errorMsg.textContent = '';
            showApp();
        } else {
            errorMsg.textContent = 'Incorrect password';
            document.getElementById('password-input').value = '';
        }
    });

    document.getElementById('reset-password')?.addEventListener('click', () => {
        if (!confirm('Resetting will delete all stored data and password. Continue?')) return;
        if (!confirm('This cannot be undone. Are you sure?')) return;
        localStorage.clear();
        expenses = [];
        loans = [];
        document.getElementById('password-input').value = '';
        document.getElementById('auth-error').textContent = 'Data cleared. Set a new password.';
        showAuthScreen();
    });

    document.getElementById('logout')?.addEventListener('click', () => {
        localStorage.removeItem(STORAGE_KEYS.SESSION);
        isAuthenticated = false;
        document.getElementById('password-input').value = '';
        document.getElementById('auth-error').textContent = '';
        showAuthScreen();
    });

    document.getElementById('change-password')?.addEventListener('click', async () => {
        const currentPassword = prompt('Enter your current password:');
        if (!currentPassword) return;
        const storedHash = localStorage.getItem(STORAGE_KEYS.PASSWORD_HASH);
        const currentHash = await hashPassword(currentPassword);
        if (currentHash !== storedHash) return alert('Incorrect current password');

        const newPassword = prompt('Enter your new password (min 4 chars):');
        if (!newPassword || newPassword.length < 4) return alert('Password must be at least 4 characters');
        const confirmPassword = prompt('Confirm your new password:');
        if (newPassword !== confirmPassword) return alert('Passwords do not match');

        localStorage.setItem(STORAGE_KEYS.PASSWORD_HASH, await hashPassword(newPassword));
        alert('Password changed successfully');
    });

    // tabs
    document.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
            document.getElementById(`${btn.dataset.tab}-tab`)?.classList.add('active');
            if (btn.dataset.tab === 'calendar') renderCalendar();
            if (btn.dataset.tab === 'optimize') renderOptimizeDetails(document.getElementById('optimize-loan-select')?.value || '');
        });
    });

    // form toggles
    document.getElementById('show-add-loan')?.addEventListener('click', () => {
        document.getElementById('add-loan-form').style.display = 'block';
    });
    document.getElementById('close-add-loan')?.addEventListener('click', () => {
        document.getElementById('add-loan-form').style.display = 'none';
    });
    document.getElementById('show-add-expense')?.addEventListener('click', () => {
        document.getElementById('add-expense-form').style.display = 'block';
    });
    document.getElementById('close-add-expense')?.addEventListener('click', () => {
        document.getElementById('add-expense-form').style.display = 'none';
    });

    // loan form
    document.getElementById('loan-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const principal = Number(document.getElementById('loan-principal').value);
        const interestRate = Number(document.getElementById('loan-interest').value);
        const tenure = Number(document.getElementById('loan-tenure').value);
        const emi = calcEmi(principal, interestRate, tenure);

        loans.unshift({
            id: Date.now(),
            name: document.getElementById('loan-name').value.trim(),
            principal,
            interestRate,
            tenure,
            emi,
            startDate: document.getElementById('loan-start').value,
            totalPayable: totalPayable(principal, emi, tenure)
        });

        saveToStorage();
        e.target.reset();
        document.getElementById('loan-start').valueAsDate = new Date();
        document.getElementById('add-loan-form').style.display = 'none';
        refreshAll();
    });

    // expense form (kept for schema compatibility, but visually secondary)
    document.getElementById('expense-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        expenses.unshift({
            id: Date.now(),
            name: document.getElementById('expense-name').value.trim(),
            amount: Number(document.getElementById('expense-amount').value),
            category: document.getElementById('expense-category').value,
            date: document.getElementById('expense-date').value
        });
        saveToStorage();
        e.target.reset();
        document.getElementById('expense-date').valueAsDate = new Date();
        document.getElementById('add-expense-form').style.display = 'none';
        refreshAll();
    });

    // calendar nav
    document.getElementById('prev-month')?.addEventListener('click', () => {
        calendarOffsetMonths -= 1;
        renderCalendar();
    });
    document.getElementById('next-month')?.addEventListener('click', () => {
        calendarOffsetMonths += 1;
        renderCalendar();
    });

    // optimize select and inputs
    document.getElementById('optimize-loan-select')?.addEventListener('change', (e) => renderOptimizeDetails(e.target.value));
    ['opt-extra-monthly', 'opt-one-time'].forEach((id) => {
        document.getElementById(id)?.addEventListener('input', () => {
            const loanId = document.getElementById('optimize-loan-select')?.value || '';
            renderOptimizeDetails(loanId);
        });
    });

    // export/import/clear
    document.getElementById('export-data')?.addEventListener('click', () => {
        const data = { expenses, loans, exportDate: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `loan-manager-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById('import-data')?.addEventListener('click', () => document.getElementById('import-file')?.click());

    document.getElementById('import-file')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (!confirm('Replace current data with imported data?')) return;
                expenses = Array.isArray(data.expenses) ? data.expenses : [];
                loans = Array.isArray(data.loans) ? data.loans : [];
                saveToStorage();
                refreshAll();
                alert('Data imported successfully');
            } catch {
                alert('Invalid backup file');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    document.getElementById('clear-data')?.addEventListener('click', () => {
        if (!confirm('This will delete all data from this browser. Continue?')) return;
        if (!confirm('Last warning: this cannot be undone.')) return;
        localStorage.clear();
        expenses = [];
        loans = [];
        refreshAll();
    });

    // defaults
    const expenseDate = document.getElementById('expense-date');
    const loanStart = document.getElementById('loan-start');
    if (expenseDate) expenseDate.valueAsDate = new Date();
    if (loanStart) loanStart.valueAsDate = new Date();

    checkAuth();
});

// Keep the optimizer inputs in the DOM even if not visible to users looking at old state.
// These are appended at runtime to avoid changing stored schema or disturbing existing data.
document.addEventListener('DOMContentLoaded', () => {
    const optimizeCard = document.getElementById('optimize-tab');
    if (optimizeCard && !document.getElementById('opt-extra-monthly')) {
        const card = optimizeCard.querySelector('.card');
        if (card) {
            const extra = document.createElement('div');
            extra.innerHTML = `
                <div class="optimize-input">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="opt-extra-monthly">Extra Monthly Payment (₹)</label>
                            <input id="opt-extra-monthly" type="number" min="0" step="0.01" placeholder="5000">
                        </div>
                        <div class="form-group">
                            <label for="opt-one-time">One-time Prepayment (₹)</label>
                            <input id="opt-one-time" type="number" min="0" step="0.01" placeholder="0">
                        </div>
                    </div>
                </div>
            `;
            const details = document.getElementById('optimize-loan-details');
            if (details) card.insertBefore(extra.firstElementChild, details);
        }
    }
});
