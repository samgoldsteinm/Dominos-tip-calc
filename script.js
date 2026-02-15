const employees = [];
let lastCalculationResults = null;
let lastCalculationAllocations = null;
let lastCalculationRate = 0;

function $(id) { return document.getElementById(id); }

function renderEmployees() {
  const list = $('employees');
  list.innerHTML = '';
  employees.forEach((e, i) => {
    const li = document.createElement('li');
    li.className = 'employee-item';
    li.innerHTML = `<span class="name">${escapeHtml(e.name)}</span>
      <span class="hours">${e.hours.toFixed(2)} hrs</span>
      <button data-index="${i}" class="remove">Remove</button>`;
    list.appendChild(li);
  });
}

function escapeHtml(s){ return (s+'').replace(/[&<>"']/g, c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"
})[c]); }

function addEmployee() {
  const name = $('emp-name').value.trim();
  const hours = parseFloat($('emp-hours').value);
  if(!name || isNaN(hours) || hours <= 0) return alert('Enter name and positive hours');
  employees.push({name, hours});
  $('emp-name').value = '';
  $('emp-hours').value = '';
  renderEmployees();
}

function removeEmployee(index){ employees.splice(index,1); renderEmployees(); }

function readBillCounts(){
  const inputs = document.querySelectorAll('.bill-count');
  const counts = {};
  inputs.forEach(inp => counts[Number(inp.dataset.value)] = Math.max(0, Math.floor(Number(inp.value)||0)));
  return counts;
}

function computeTotalFromBills(){
  const counts = readBillCounts();
  const billValues = Object.keys(counts).map(k=>Number(k));
  const total = billValues.reduce((s,v)=>s + v * (counts[v]||0), 0);
  const el = $('total-tips');
  if(el){ el.value = total.toFixed(2); }
  return total;
}

function calculate() {
  if(employees.length === 0) return alert('Add at least one employee');
  const totalTips = parseFloat($('total-tips').value) || 0;
  const totalHours = employees.reduce((s,e)=>s+e.hours,0);
  if(totalHours <= 0) return alert('Total hours must be greater than 0');

  const rate = totalTips / totalHours;
  lastCalculationRate = rate;

  const results = employees.map(e=>{
    const exact = e.hours * rate;
    const roundedCash = Math.round(exact);
    return {name:e.name, hours:e.hours, exact, roundedCash};
  });

  // allocate bills using greedy per-person (largest-first), process largest amounts first
  const billValues = [100,50,20,10,5,1];
  const avail = readBillCounts();

  // clone avail as mutable
  const availMutable = {};
  billValues.forEach(v=> availMutable[v] = avail[v] || 0);

  // sort indices by roundedCash desc
  const order = results.map((r,i)=>i).sort((a,b)=>results[b].roundedCash - results[a].roundedCash);

  const allocations = results.map(()=>({bills:{}, remaining:0}));

  order.forEach(idx=>{
    let need = results[idx].roundedCash;
    const alloc = {};
    billValues.forEach(v=>{
      const take = Math.min(Math.floor(need / v), availMutable[v]);
      if(take>0){ alloc[v]=take; availMutable[v]-=take; need -= take*v; }
    });
    allocations[idx].bills = alloc;
    allocations[idx].remaining = need; // dollars still unpaid in cash
  });

  // Store for export
  lastCalculationResults = results;
  lastCalculationAllocations = allocations;

  // build output as per-employee cards (no horizontal scrolling)
  const out = [];
  out.push(`<p class="muted"><strong>Hourly tip rate:</strong> $${rate.toFixed(2)} / hr</p>`);
  out.push('<div class="results-cards">');
  results.forEach((r,i)=>{
    const bills = allocations[i].bills;
    const billItems = Object.keys(bills).length ? Object.keys(bills).map(v=>{
      return `<div class="bill-item"><span class="bill-denom">$${v}</span> <span class="bill-count">x ${bills[v]}</span></div>`;
    }).join('') : '<div class="bill-item muted">No cash allocated</div>';

    out.push(`
      <div class="employee-card">
        <div class="card-header">
          <div class="emp-name">${escapeHtml(r.name)}</div>
          <div class="emp-hours muted">${r.hours.toFixed(2)} hrs</div>
        </div>
        <div class="card-body">
          <div class="exact">Exact: $${r.exact.toFixed(2)}</div>
          <div class="rounded">Rounded to: <span class="rounded-amount">$${r.roundedCash}</span></div>
          <div class="bills-list">${billItems}</div>
          <div class="uncovered muted">Uncovered: ${allocations[i].remaining>0?('$'+allocations[i].remaining):'—'}</div>
        </div>
      </div>
    `);
  });
  out.push('</div>');

  // leftover bills
  out.push('<h4 class="muted">Remaining bills (after allocation)</h4>');
  out.push('<ul class="remaining-bills">');
  billValues.forEach(v=> out.push(`<li>$${v}: ${availMutable[v] || 0}</li>`));
  out.push('</ul>');

  $('results').innerHTML = out.join('\n');
  // show results (keep employee inputs visible) and mark container
  const resSec = $('results-section');
  if(resSec) resSec.classList.remove('hidden');
  const container = document.querySelector('.container');
  if(container) container.classList.add('results-shown');
  if(resSec) resSec.scrollIntoView({behavior:'smooth'});
}

function clearAll(){
  employees.length = 0; renderEmployees();
  $('total-tips').value = '0';
  document.querySelectorAll('.bill-count').forEach(i=>i.value='0');
  $('results').innerHTML = '';
  lastCalculationResults = null;
  lastCalculationAllocations = null;
  lastCalculationRate = 0;
  // hide results and remove results-shown state
  const resSec = $('results-section');
  if(resSec) resSec.classList.add('hidden');
  const container = document.querySelector('.container');
  if(container) container.classList.remove('results-shown');
}

// History and Storage Functions
function getHistory(){ return JSON.parse(localStorage.getItem('tipCalcHistory')) || []; }
function saveHistory(record){ 
  const history = getHistory();
  history.unshift({ ...record, timestamp: new Date().toISOString() });
  if(history.length > 20) history.pop(); // keep last 20
  localStorage.setItem('tipCalcHistory', JSON.stringify(history));
}

function saveData(){
  const total = $('total-tips').value;
  const counts = readBillCounts();
  const data = { total: parseFloat(total), bills: counts, employees: employees.slice(), timestamp: new Date().toISOString() };
  localStorage.setItem('tipCalcData', JSON.stringify(data));
  saveHistory(data);
  alert('Data saved successfully!');
}

function exportPDF(){
  if(!lastCalculationResults || !lastCalculationAllocations){ alert('Please calculate tips first!'); return; }
  
  let text = 'DOMINOS TIP CALCULATOR RESULTS\n';
  text += '================================\n\n';
  text += `Hourly Tip Rate: $${lastCalculationRate.toFixed(2)}/hr\n\n`;
  
  lastCalculationResults.forEach((r, i) => {
    const alloc = lastCalculationAllocations[i];
    text += `${r.name}\n`;
    text += `-${''.repeat(r.name.length)}\n`;
    text += `Hours Worked: ${r.hours.toFixed(2)} hrs\n`;
    text += `Amount Received: $${r.roundedCash}\n`;
    text += `Exact Amount: $${r.exact.toFixed(2)}\n`;
    
    if(Object.keys(alloc.bills).length > 0){
      text += `Bills Received:\n`;
      [100,50,20,10,5,1].forEach(denom => {
        if(alloc.bills[denom]) text += `  $${denom} x${alloc.bills[denom]}\n`;
      });
    } else {
      text += `Bills Received: None\n`;
    }
    
    if(alloc.remaining > 0) text += `Remaining (uncovered): $${alloc.remaining}\n`;
    text += '\n';
  });
  
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type:'text/plain'}));
  a.download = `tip-results-${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
}

function exportCSV(){
  if(!lastCalculationResults || !lastCalculationAllocations){ alert('Please calculate tips first!'); return; }
  
  const rows = [['Employee Name', 'Hours Worked', 'Hourly Rate', 'Tip Amount', 'Bills ($100)', 'Bills ($50)', 'Bills ($20)', 'Bills ($10)', 'Bills ($5)', 'Bills ($1)', 'Remaining']];
  
  lastCalculationResults.forEach((r, i) => {
    const alloc = lastCalculationAllocations[i];
    const billBreakdown = [100, 50, 20, 10, 5, 1].map(denom => alloc.bills[denom] || 0);
    const billStr = billBreakdown.map((count, idx) => count > 0 ? `${count}x$${[100,50,20,10,5,1][idx]}` : '').filter(s => s).join(', ') || 'None';
    
    rows.push([
      r.name,
      r.hours.toFixed(2),
      `$${lastCalculationRate.toFixed(2)}`,
      `$${r.roundedCash}`,
      alloc.bills[100] || 0,
      alloc.bills[50] || 0,
      alloc.bills[20] || 0,
      alloc.bills[10] || 0,
      alloc.bills[5] || 0,
      alloc.bills[1] || 0,
      `$${alloc.remaining}`
    ]);
  });
  
  const csv = rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
  a.download = `tip-results-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

function renderChart(){
  const history = getHistory();
  if(history.length < 2){
    $('chart-container').classList.add('hidden');
    return;
  }
  
  // Sort history by date (oldest first)
  const sorted = [...history].reverse();
  
  // Group by date and accumulate tips
  const dateMap = {};
  let cumulativeTips = 0;
  const labels = [];
  const data = [];
  
  sorted.forEach(item => {
    const date = new Date(item.timestamp).toLocaleDateString();
    if(!dateMap[date]){
      dateMap[date] = 0;
      labels.push(date);
    }
    dateMap[date] += item.total || 0;
    cumulativeTips += item.total || 0;
    data.push(cumulativeTips);
  });
  
  // Get canvas and create chart
  const ctx = $('tipsChart').getContext('2d');
  if(window.tipsChartInstance) window.tipsChartInstance.destroy();
  
  window.tipsChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Cumulative Tips',
        data: data,
        borderColor: 'var(--dominos-red)',
        backgroundColor: 'rgba(227, 24, 55, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'var(--dominos-red)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: true, labels: { font: { size: 14, family: "'Inter', sans-serif" }, color: 'var(--dominos-blue)' } }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { font: { size: 12, family: "'Inter', sans-serif" }, color: 'var(--dominos-blue)', callback: (v) => '$' + v },
          grid: { color: 'rgba(0,75,141,0.05)' }
        },
        x: {
          ticks: { font: { size: 12, family: "'Inter', sans-serif" }, color: 'var(--dominos-blue)' },
          grid: { color: 'rgba(0,75,141,0.05)' }
        }
      }
    }
  });
  
  $('chart-container').classList.remove('hidden');
}

function viewHistory(){
  const modal = $('history-modal');
  const historyList = $('history-list');
  const history = getHistory();
  if(history.length === 0){
    historyList.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px">No history yet</p>';
    $('chart-container').classList.add('hidden');
  } else {
    historyList.innerHTML = history.map((item, i) => `
      <div class="history-item">
        <div class="history-item-header">
          <span class="history-item-title">Session ${history.length - i}</span>
          <span class="history-item-date">${new Date(item.timestamp).toLocaleString()}</span>
        </div>
        <div class="history-item-details">
          Total: $${item.total || 0}<br>
          Employees: ${item.employees?.length || 0}
        </div>
      </div>
    `).join('');
    renderChart();
  }
  modal.classList.remove('hidden');
}

function closeHistory(){
  $('history-modal').classList.add('hidden');
}


document.addEventListener('click', (e)=>{
  if(e.target.id === 'add-emp') addEmployee();
  if(e.target.id === 'calculate') calculate();
  if(e.target.id === 'clear') clearAll();
  if(e.target.id === 'save-data') saveData();
  if(e.target.id === 'export-pdf') exportPDF();
  if(e.target.id === 'export-csv') exportCSV();
  if(e.target.id === 'view-history') viewHistory();
  if(e.target.id === 'close-history') closeHistory();
  if(e.target.id === 'history-modal') closeHistory(); // close when clicking outside
  if(e.target.classList.contains('remove')) removeEmployee(Number(e.target.dataset.index));
});

// small helper to prefill demo data (optional)
window._Sgeezy = { employees, addEmployee };

// Recompute total whenever bill counts change
document.addEventListener('input', (e)=>{
  if(e.target && e.target.classList && e.target.classList.contains('bill-count')){
    computeTotalFromBills();
  }
});

// compute on load in case there are defaults
window.addEventListener('load', ()=> computeTotalFromBills());
