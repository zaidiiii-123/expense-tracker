// ============================================================
//   Expense Tracker — app.js  (FIXED & PERFECT)
// ============================================================

// ── CHART INSTANCES ───────────────────────────────────────
let barChart = null, doughnutChart = null, lineChart = null, anaBarChart = null;

// ── CONSTANTS ─────────────────────────────────────────────
const DEFAULT_PROFILE = { name:'Rahul Kumar', role:'Finance Manager', email:'', company:'' };
const DEFAULT_BUDGETS = { Travel:80000, 'Food & Entertainment':30000, 'Office Supplies':50000, Utilities:25000, Marketing:40000, Equipment:60000 };

const CAT_COLORS = {
  Travel:'#6C63FF', 'Food & Entertainment':'#FFB547', 'Office Supplies':'#00D68F',
  Utilities:'#FF5757', Marketing:'#4DA6FF', Equipment:'#B44DFF',
  Salary:'#00D68F', 'Client Payment':'#6C63FF', Freelance:'#FFB547',
  Investment:'#4DA6FF', Bonus:'#B44DFF', Other:'#8B93AB'
};
const CAT_ICONS = {
  Travel:'✈', 'Food & Entertainment':'🍽', 'Office Supplies':'📦',
  Utilities:'⚡', Marketing:'📣', Equipment:'🖥',
  Salary:'💼', 'Client Payment':'🤝', Freelance:'💻', Investment:'📊', Bonus:'🎁', Other:'💰'
};
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── DATA ─────────────────────────────────────────────────
let expenses = JSON.parse(localStorage.getItem('ep_expenses') || '[]');
let incomes  = JSON.parse(localStorage.getItem('ep_incomes')  || '[]');
let budgets  = JSON.parse(localStorage.getItem('ep_budgets')  || JSON.stringify(DEFAULT_BUDGETS));
let profile  = JSON.parse(localStorage.getItem('ep_profile')  || JSON.stringify(DEFAULT_PROFILE));

function save() {
  localStorage.setItem('ep_expenses', JSON.stringify(expenses));
  localStorage.setItem('ep_incomes',  JSON.stringify(incomes));
  localStorage.setItem('ep_budgets',  JSON.stringify(budgets));
  localStorage.setItem('ep_profile',  JSON.stringify(profile));
}

// ── HELPERS ───────────────────────────────────────────────
function fmt(n) {
  const num = Math.round(Number(n) || 0);
  return '₹' + num.toLocaleString('en-IN');
}

function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date)) return '—';
  return date.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

function getInitials(name) {
  if (!name) return 'U';
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0,2);
}

function getMonthlyData(arr) {
  const months = Array(12).fill(0);
  arr.forEach(item => {
    const d = new Date(item.date);
    if (!isNaN(d)) months[d.getMonth()] += Number(item.amount) || 0;
  });
  return months;
}

function getCatTotals(arr) {
  const t = {};
  arr.forEach(e => { t[e.category] = (t[e.category] || 0) + (Number(e.amount) || 0); });
  return t;
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function destroyChart(c) { try { if (c) c.destroy(); } catch(e){} return null; }

// ── CHART GLOBAL DEFAULTS ─────────────────────────────────
Chart.defaults.color       = '#525B74';
Chart.defaults.borderColor = '#2A2F3E';
Chart.defaults.font.family = 'DM Sans';

const TOOLTIP_OPTS = {
  backgroundColor:'#1A1E28', borderColor:'#353B50', borderWidth:1,
  titleColor:'#F0F2F8', bodyColor:'#8B93AB', padding:10,
  callbacks:{ label: ctx => '  ' + fmt(ctx.raw) }
};

const SCALE_OPTS = {
  x:{ grid:{ color:'#1E2330' }, ticks:{ color:'#525B74', font:{ size:11 } } },
  y:{ grid:{ color:'#1E2330' }, ticks:{ color:'#525B74', font:{ size:11 },
    callback: v => v >= 1000 ? '₹'+(v/1000).toFixed(0)+'k' : '₹'+v
  }}
};

// ── MODAL CONTROLS ────────────────────────────────────────
function openExpenseModal() {
  document.getElementById('expDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('expenseModal').classList.add('show');
}
function closeExpenseModal() { document.getElementById('expenseModal').classList.remove('show'); }

function openIncomeModal() {
  document.getElementById('incDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('incomeModal').classList.add('show');
}
function closeIncomeModal() { document.getElementById('incomeModal').classList.remove('show'); }

document.getElementById('expenseModal').addEventListener('click', e => { if (e.target.id==='expenseModal') closeExpenseModal(); });
document.getElementById('incomeModal').addEventListener('click',  e => { if (e.target.id==='incomeModal')  closeIncomeModal(); });

// ── TOAST ─────────────────────────────────────────────────
function showToast(msg, isError=false) {
  const t = document.getElementById('toast');
  document.getElementById('toastText').textContent = msg;
  t.style.borderColor = isError ? 'var(--red)' : 'var(--green2)';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── SUBMIT EXPENSE ────────────────────────────────────────
function submitExpense() {
  const title  = document.getElementById('expTitle').value.trim();
  const amount = parseFloat(document.getElementById('expAmount').value);
  const date   = document.getElementById('expDate').value;
  if (!title)           { showToast('❌ Title required!', true); return; }
  if (!amount || amount <= 0) { showToast('❌ Valid amount required!', true); return; }
  if (!date)            { showToast('❌ Date required!', true); return; }

  expenses.unshift({
    id: Date.now(), title, amount, date,
    category: document.getElementById('expCategory').value,
    payment:  document.getElementById('expPayment').value,
    desc:     document.getElementById('expDesc').value.trim(),
    status:   'Pending'
  });
  save();
  closeExpenseModal();
  ['expTitle','expAmount','expDesc'].forEach(id => { document.getElementById(id).value = ''; });
  updateBadge();
  renderDashboard();
  showToast('✓ Expense submitted successfully!');
}

// ── SUBMIT INCOME ─────────────────────────────────────────
function submitIncome() {
  const title  = document.getElementById('incTitle').value.trim();
  const amount = parseFloat(document.getElementById('incAmount').value);
  const date   = document.getElementById('incDate').value;
  if (!title)           { showToast('❌ Source required!', true); return; }
  if (!amount || amount <= 0) { showToast('❌ Valid amount required!', true); return; }
  if (!date)            { showToast('❌ Date required!', true); return; }

  incomes.unshift({
    id: Date.now(), title, amount, date,
    category: document.getElementById('incCategory').value
  });
  save();
  closeIncomeModal();
  ['incTitle','incAmount'].forEach(id => { document.getElementById(id).value = ''; });
  renderDashboard();
  renderIncomePage();
  showToast('✓ Income added!');
}

// ── DELETE / APPROVE ──────────────────────────────────────
function deleteExpense(id) {
  if (!confirm('Delete this expense?')) return;
  expenses = expenses.filter(e => e.id !== id);
  save(); updateBadge(); renderDashboard(); renderExpensesPage(); renderBudgetPage();
  showToast('🗑 Expense deleted!');
}

function approveExpense(id) {
  const e = expenses.find(x => x.id === id);
  if (!e) return;
  e.status = e.status === 'Approved' ? 'Pending' : 'Approved';
  save(); updateBadge(); renderDashboard(); renderExpensesPage();
  showToast(e.status === 'Approved' ? '✓ Expense approved!' : 'Moved back to Pending');
}

function deleteIncome(id) {
  if (!confirm('Delete this income entry?')) return;
  incomes = incomes.filter(i => i.id !== id);
  save(); renderDashboard(); renderIncomePage();
  showToast('🗑 Income deleted!');
}

// ── BADGE ─────────────────────────────────────────────────
function updateBadge() {
  const cnt = expenses.filter(e => e.status === 'Pending').length;
  const b = document.getElementById('pendingBadge');
  if (!b) return;
  b.textContent = cnt;
  b.style.display = cnt > 0 ? 'inline-block' : 'none';
}

// ── SEARCH ────────────────────────────────────────────────
function handleSearch(q) {
  document.querySelectorAll('.s-row').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
}

// ── PAGE NAVIGATION ───────────────────────────────────────
function showPage(name, navEl) {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  const pg = document.getElementById('page-' + name);
  if (pg) pg.style.display = 'flex';

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (navEl) navEl.classList.add('active');

  const titles = { dashboard:'Dashboard', expenses:'Expenses', income:'Income', budget:'Budget', analytics:'Analytics', account:'Account' };
  setEl('pageTitle', titles[name] || name);

  if (name==='dashboard')  renderDashboard();
  if (name==='expenses')   renderExpensesPage();
  if (name==='income')     renderIncomePage();
  if (name==='budget')     renderBudgetPage();
  if (name==='analytics')  renderAnalyticsPage();
  if (name==='account')    renderAccountPage();
}

// ============================================================
//  DASHBOARD
// ============================================================
function renderDashboard() {
  const totalExp   = expenses.reduce((s,e) => s + (Number(e.amount)||0), 0);
  const totalInc   = incomes.reduce((s,i)  => s + (Number(i.amount)||0), 0);
  const savings    = totalInc - totalExp;
  const savPct     = totalInc > 0 ? Math.round(savings/totalInc*100) : 0;
  const pendingArr = expenses.filter(e => e.status === 'Pending');
  const pendingAmt = pendingArr.reduce((s,e) => s + (Number(e.amount)||0), 0);

  setEl('d-totalExp',    fmt(totalExp));
  setEl('d-expCount',    expenses.length + ' transactions');
  setEl('d-totalInc',    fmt(totalInc));
  setEl('d-incCount',    incomes.length + ' entries');
  setEl('d-savings',     fmt(Math.max(0, savings)));
  setEl('d-savingsPct',  savPct + '% of income saved');
  setEl('d-pendingCount', pendingArr.length);
  setEl('d-pendingAmt',  fmt(pendingAmt) + ' pending');

  renderBarChart();
  renderDoughnut(totalExp);
  renderRecentTransactions();
}

// ── BAR CHART ─────────────────────────────────────────────
function renderBarChart() {
  const canvas = document.getElementById('barChartCanvas');
  if (!canvas) return;
  barChart = destroyChart(barChart);

  const incData = getMonthlyData(incomes);
  const expData = getMonthlyData(expenses);

  barChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: MONTHS,
      datasets: [
        { label:'Income',  data: incData, backgroundColor:'rgba(0,214,143,0.8)',  borderRadius:5, borderSkipped:false },
        { label:'Expense', data: expData, backgroundColor:'rgba(108,99,255,0.8)', borderRadius:5, borderSkipped:false }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:true,
      plugins:{
        legend:{ display:true, position:'top', labels:{ color:'#8B93AB', boxWidth:10, boxHeight:10, font:{size:11} } },
        tooltip: TOOLTIP_OPTS
      },
      scales: SCALE_OPTS
    }
  });
}

// ── DOUGHNUT CHART (FIXED) ────────────────────────────────
function renderDoughnut(totalExp) {
  const canvas = document.getElementById('doughnutCanvas');
  if (!canvas) return;
  doughnutChart = destroyChart(doughnutChart);

  // Update center text
  const centerEl = document.getElementById('donutCenterValue');
  if (centerEl) centerEl.textContent = fmt(totalExp || 0);

  const catTotals = getCatTotals(expenses);
  const cats   = Object.keys(catTotals);
  const values = cats.map(c => catTotals[c]);
  const colors = cats.map(c => CAT_COLORS[c] || '#8B93AB');

  // Legend
  const legendEl = document.getElementById('donutLegend');
  if (legendEl) {
    if (cats.length === 0) {
      legendEl.innerHTML = '<div style="color:var(--text3);font-size:12px;text-align:center;padding:8px">Add expenses to see breakdown</div>';
    } else {
      legendEl.innerHTML = cats.map((c,i) => {
        const pct = totalExp > 0 ? Math.round(values[i]/totalExp*100) : 0;
        return `<div class="leg-item">
          <div class="leg-dot" style="background:${colors[i]}"></div>
          <span class="leg-name">${c}</span>
          <span class="leg-pct" style="color:${colors[i]}">${pct}%</span>
        </div>`;
      }).join('');
    }
  }

  if (cats.length === 0) {
    // Draw empty ring
    doughnutChart = new Chart(canvas, {
      type:'doughnut',
      data:{ labels:['No Data'], datasets:[{ data:[1], backgroundColor:['#222736'], borderWidth:0 }] },
      options:{ cutout:'68%', plugins:{ legend:{display:false}, tooltip:{enabled:false} } }
    });
    return;
  }

  doughnutChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: cats,
      datasets:[{
        data: values,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#12151C',
        hoverBorderColor: '#12151C',
        hoverOffset: 4
      }]
    },
    options: {
      cutout: '68%',
      responsive: true,
      maintainAspectRatio: true,
      plugins:{
        legend:{ display:false },
        tooltip:{
          backgroundColor:'#1A1E28', borderColor:'#353B50', borderWidth:1,
          titleColor:'#F0F2F8', bodyColor:'#8B93AB', padding:10,
          callbacks:{
            label: ctx => '  ' + ctx.label + ': ' + fmt(ctx.raw) +
              ' (' + (totalExp>0 ? Math.round(ctx.raw/totalExp*100) : 0) + '%)'
          }
        }
      }
    }
  });
}

// ── RECENT TRANSACTIONS (FIXED) ───────────────────────────
function renderRecentTransactions() {
  const el = document.getElementById('d-recentList');
  if (!el) return;

  // Combine expenses + incomes, sort by date descending, take 7
  const all = [
    ...expenses.map(e => ({ ...e, _type:'expense' })),
    ...incomes.map(i  => ({ ...i, _type:'income'  }))
  ].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,7);

  if (all.length === 0) {
    el.innerHTML = '<div class="empty-state">No transactions yet. Add an expense or income to get started!</div>';
    return;
  }

  el.innerHTML = `
    <table class="txn-table">
      <thead>
        <tr>
          <th>Transaction</th>
          <th>Category</th>
          <th>Date</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${all.map(item => buildRow(item, false)).join('')}
      </tbody>
    </table>`;
}

// ── BUILD TABLE ROW (FIXED) ───────────────────────────────
function buildRow(item, showPayment) {
  const isIncome = item._type === 'income';
  const color    = CAT_COLORS[item.category] || '#8B93AB';
  const icon     = CAT_ICONS[item.category]  || '💳';
  const amtColor = isIncome ? 'var(--green)' : 'var(--red)';
  const amtSign  = isIncome ? '+' : '−';
  const status   = isIncome ? 'Income' : (item.status || 'Pending');
  const badgeCls = isIncome ? 'badge-approved'
    : status === 'Approved' ? 'badge-approved'
    : status === 'Rejected' ? 'badge-rejected' : 'badge-pending';
  const subtitle = item.desc || item.category || '';

  const payCol = showPayment
    ? `<td style="color:var(--text2);font-size:12px">${item.payment || '—'}</td>`
    : '';

  const actions = isIncome
    ? `<button class="action-btn btn-delete" onclick="deleteIncome(${item.id})">✕</button>`
    : `<button class="action-btn btn-approve" onclick="approveExpense(${item.id})">${status==='Approved'?'Undo':'✓'}</button>
       <button class="action-btn btn-delete"  onclick="deleteExpense(${item.id})">✕</button>`;

  return `<tr class="s-row">
    <td>
      <div style="display:flex;align-items:center;gap:10px">
        <div class="txn-icon" style="background:${color}22">${icon}</div>
        <div>
          <div class="txn-name">${item.title}</div>
          <div class="txn-sub">${subtitle}</div>
        </div>
      </div>
    </td>
    <td>
      <span style="background:${color}18;color:${color};font-size:10px;padding:3px 10px;border-radius:20px;white-space:nowrap">
        ${item.category}
      </span>
    </td>
    ${payCol}
    <td style="color:var(--text2);font-size:12px;white-space:nowrap">${fmtDate(item.date)}</td>
    <td class="txn-amount" style="color:${amtColor};white-space:nowrap">${amtSign}${fmt(item.amount)}</td>
    <td><span class="txn-badge ${badgeCls}">${status}</span></td>
    <td style="white-space:nowrap">${actions}</td>
  </tr>`;
}

// ============================================================
//  EXPENSES PAGE
// ============================================================
function renderExpensesPage() {
  const filter = document.getElementById('expFilterSelect')?.value || 'all';
  const list   = filter === 'all' ? expenses : expenses.filter(e => e.status === filter);
  const el     = document.getElementById('exp-list');
  if (!el) return;

  if (list.length === 0) {
    el.innerHTML = '<div class="empty-state">No expenses found. Click "+ Add" to add one!</div>';
    return;
  }

  el.innerHTML = `
    <table class="txn-table">
      <thead>
        <tr>
          <th>Transaction</th><th>Category</th><th>Payment</th>
          <th>Date</th><th>Amount</th><th>Status</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(e => buildRow({...e, _type:'expense'}, true)).join('')}
      </tbody>
    </table>`;
}

// ============================================================
//  INCOME PAGE
// ============================================================
function renderIncomePage() {
  const total    = incomes.reduce((s,i) => s+(Number(i.amount)||0), 0);
  const now      = new Date();
  const monthAmt = incomes
    .filter(i => { const d=new Date(i.date); return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear(); })
    .reduce((s,i) => s+(Number(i.amount)||0), 0);
  const avg = incomes.length > 0 ? total/incomes.length : 0;

  setEl('inc-total', fmt(total));
  setEl('inc-count', incomes.length + ' entries');
  setEl('inc-month', fmt(monthAmt));
  setEl('inc-avg',   fmt(avg));

  const el = document.getElementById('inc-list');
  if (!el) return;

  if (incomes.length === 0) {
    el.innerHTML = '<div class="empty-state">No income yet. Click "+ Add Income" to add one!</div>';
    return;
  }

  el.innerHTML = `
    <table class="txn-table">
      <thead><tr><th>Source</th><th>Category</th><th>Date</th><th>Amount</th><th>Actions</th></tr></thead>
      <tbody>
        ${incomes.map(i => buildRow({...i, _type:'income'}, false)).join('')}
      </tbody>
    </table>`;
}

// ============================================================
//  BUDGET PAGE
// ============================================================
function renderBudgetPage() {
  const totalBudget = Object.values(budgets).reduce((s,v) => s+v, 0);
  const totalSpent  = expenses.reduce((s,e) => s+(Number(e.amount)||0), 0);
  const remaining   = Math.max(0, totalBudget - totalSpent);
  const spentPct    = totalBudget > 0 ? Math.round(totalSpent/totalBudget*100) : 0;

  setEl('bud-total',    fmt(totalBudget));
  setEl('bud-spent',    fmt(totalSpent));
  setEl('bud-spentPct', spentPct+'% used');
  setEl('bud-remaining',fmt(remaining));
  setEl('bud-remPct',   (100-spentPct)+'% left');

  const catSpent = getCatTotals(expenses);
  const el = document.getElementById('bud-list');
  if (!el) return;

  el.innerHTML = Object.entries(budgets).map(([cat, limit]) => {
    const spent = catSpent[cat] || 0;
    const pct   = limit > 0 ? Math.min(100, Math.round(spent/limit*100)) : 0;
    const barColor = pct>=90 ? 'linear-gradient(90deg,#FF5757,#FF8888)'
                   : pct>=70 ? 'linear-gradient(90deg,#FFB547,#FFD080)'
                   : `linear-gradient(90deg,${CAT_COLORS[cat]||'#6C63FF'},${CAT_COLORS[cat]||'#6C63FF'}99)`;
    const warn = pct>=90
      ? '<span style="color:var(--red);font-size:11px;margin-left:6px">⚠ Over limit!</span>'
      : pct>=70 ? '<span style="color:var(--amber);font-size:11px;margin-left:6px">Near limit</span>' : '';

    return `<div class="budget-item">
      <div class="budget-header">
        <span class="budget-name">${CAT_ICONS[cat]||'💳'} ${cat}</span>
        <span class="budget-amount">${fmt(spent)} / ${fmt(limit)}
          <span style="color:${pct>=90?'var(--red)':pct>=70?'var(--amber)':'var(--text3)'}"> (${pct}%)</span>
          ${warn}
        </span>
      </div>
      <div class="budget-bar-bg">
        <div class="budget-bar-fill" style="width:${pct}%;background:${barColor}"></div>
      </div>
    </div>`;
  }).join('');
}

// ============================================================
//  ANALYTICS PAGE
// ============================================================
function renderAnalyticsPage() {
  renderLineChart();
  renderAnaBar();
  renderTopCategories();
  renderKeyStats();
}

function renderLineChart() {
  const canvas = document.getElementById('lineChartCanvas');
  if (!canvas) return;
  lineChart = destroyChart(lineChart);
  lineChart = new Chart(canvas, {
    type:'line',
    data:{
      labels: MONTHS,
      datasets:[{
        label:'Expenses', data: getMonthlyData(expenses),
        borderColor:'#6C63FF', backgroundColor:'rgba(108,99,255,0.12)',
        borderWidth:2, tension:0.4, fill:true,
        pointBackgroundColor:'#6C63FF', pointRadius:4, pointHoverRadius:6
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:true,
      plugins:{ legend:{display:false}, tooltip: TOOLTIP_OPTS },
      scales: SCALE_OPTS
    }
  });
}

function renderAnaBar() {
  const canvas = document.getElementById('anaBarCanvas');
  if (!canvas) return;
  anaBarChart = destroyChart(anaBarChart);
  anaBarChart = new Chart(canvas, {
    type:'bar',
    data:{
      labels: MONTHS,
      datasets:[
        { label:'Income',  data: getMonthlyData(incomes),  backgroundColor:'rgba(0,214,143,0.8)',  borderRadius:4 },
        { label:'Expense', data: getMonthlyData(expenses), backgroundColor:'rgba(255,87,87,0.75)', borderRadius:4 }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:true,
      plugins:{
        legend:{ display:true, position:'top', labels:{ color:'#8B93AB', boxWidth:10, font:{size:11} } },
        tooltip: TOOLTIP_OPTS
      },
      scales: SCALE_OPTS
    }
  });
}

function renderTopCategories() {
  const el = document.getElementById('ana-categories');
  if (!el) return;
  const catTotals = getCatTotals(expenses);
  const total     = Object.values(catTotals).reduce((s,v)=>s+v, 0);
  const sorted    = Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);

  if (sorted.length === 0) {
    el.innerHTML = '<div class="empty-state">No expense data yet</div>';
    return;
  }

  el.innerHTML = sorted.map(([cat, amt]) => {
    const pct   = total>0 ? Math.round(amt/total*100) : 0;
    const color = CAT_COLORS[cat] || '#8B93AB';
    return `<div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:13px;font-weight:500">${CAT_ICONS[cat]||'💳'} ${cat}</span>
        <span style="font-size:12px;color:var(--text2)">${fmt(amt)} <span style="color:${color}">(${pct}%)</span></span>
      </div>
      <div class="budget-bar-bg">
        <div class="budget-bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
    </div>`;
  }).join('');
}

function renderKeyStats() {
  const el = document.getElementById('ana-stats');
  if (!el) return;
  const totalExp = expenses.reduce((s,e)=>s+(Number(e.amount)||0), 0);
  const totalInc = incomes.reduce((s,i)=>s+(Number(i.amount)||0), 0);
  const avg      = expenses.length > 0 ? totalExp/expenses.length : 0;
  const highest  = expenses.length > 0
    ? expenses.reduce((m,e)=>(Number(e.amount)>Number(m.amount)?e:m), expenses[0]) : null;
  const now = new Date();
  const thisMonthExp = expenses
    .filter(e=>{ const d=new Date(e.date); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(); })
    .reduce((s,e)=>s+(Number(e.amount)||0), 0);

  const rows = [
    ['Total Expenses',    fmt(totalExp)],
    ['Total Income',      fmt(totalInc)],
    ['Net Savings',       fmt(Math.max(0, totalInc-totalExp))],
    ['This Month Spent',  fmt(thisMonthExp)],
    ['Avg per Expense',   fmt(avg)],
    ['Highest Expense',   highest ? fmt(highest.amount)+' ('+highest.title+')' : '—'],
    ['Total Transactions',expenses.length],
    ['Approved',          expenses.filter(e=>e.status==='Approved').length],
    ['Pending',           expenses.filter(e=>e.status==='Pending').length],
  ];

  el.innerHTML = rows.map(([label, val]) =>
    `<div class="stat-row">
       <span class="stat-row-label">${label}</span>
       <span class="stat-row-value">${val}</span>
     </div>`
  ).join('');
}

// ============================================================
//  ACCOUNT PAGE
// ============================================================
function renderAccountPage() {
  document.getElementById('profileName').value    = profile.name    || '';
  document.getElementById('profileRole').value    = profile.role    || '';
  document.getElementById('profileEmail').value   = profile.email   || '';
  document.getElementById('profileCompany').value = profile.company || '';
  updateProfileDisplay();

  const el = document.getElementById('budgetEditList');
  if (!el) return;
  el.innerHTML = Object.entries(budgets).map(([cat, limit]) =>
    `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
       <span style="font-size:13px;flex:1">${CAT_ICONS[cat]||'💳'} ${cat}</span>
       <input type="number" class="form-input"
         style="width:130px;padding:6px 10px;font-size:12px"
         id="budlimit-${cat.replace(/[\s&]/g,'_')}"
         value="${limit}" min="0">
     </div>`
  ).join('');
}

function saveProfile() {
  profile.name    = document.getElementById('profileName').value.trim()    || profile.name;
  profile.role    = document.getElementById('profileRole').value.trim()    || profile.role;
  profile.email   = document.getElementById('profileEmail').value.trim();
  profile.company = document.getElementById('profileCompany').value.trim();
  save();
  updateProfileDisplay();
  showToast('✓ Profile saved!');
}

function updateProfileDisplay() {
  const initials = getInitials(profile.name || 'User');
  setEl('avatarInitials',    initials);
  setEl('profileAvatar',     initials);
  setEl('sidebarName',       profile.name || 'User');
  setEl('profileNameDisplay',profile.name || 'User');
  setEl('sidebarRole',       profile.role || '');
  setEl('profileRoleDisplay',profile.role || '');
}

function saveBudgetLimits() {
  Object.keys(budgets).forEach(cat => {
    const safeKey = cat.replace(/[\s&]/g,'_');
    const el = document.getElementById('budlimit-'+safeKey);
    if (el) {
      const v = parseFloat(el.value);
      if (!isNaN(v) && v >= 0) budgets[cat] = v;
    }
  });
  save();
  showToast('✓ Budget limits saved!');
}

function clearAllData() {
  if (!confirm('Are you sure? This will permanently delete ALL data!')) return;
  expenses = []; incomes = [];
  budgets  = {...DEFAULT_BUDGETS};
  profile  = {...DEFAULT_PROFILE};
  save();
  updateBadge();
  updateProfileDisplay();
  renderDashboard();
  showToast('🗑 All data cleared!');
}

// ── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateProfileDisplay();
  updateBadge();
  renderDashboard();
});
