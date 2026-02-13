const employees = [];

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
  // hide results and remove results-shown state
  const resSec = $('results-section');
  if(resSec) resSec.classList.add('hidden');
  const container = document.querySelector('.container');
  if(container) container.classList.remove('results-shown');
}

document.addEventListener('click', (e)=>{
  if(e.target.id === 'add-emp') addEmployee();
  if(e.target.id === 'calculate') calculate();
  if(e.target.id === 'clear') clearAll();
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
