let db;
const request = indexedDB.open('OrderDB',1);
request.onupgradeneeded = e => {
  db = e.target.result;
  db.createObjectStore('orders',{keyPath:'id',autoIncrement:true});
  db.createObjectStore('meta',{keyPath:'key'});
};
request.onsuccess = e => {
  db = e.target.result;
  loadPrices();
  renderOrders();
};

function saveMeta(k,v,cb){
  const tx = db.transaction('meta','readwrite');
  tx.objectStore('meta').put({key:k,value:v});
  tx.oncomplete = ()=> cb && cb();
}

function loadMeta(k,cb){
  const tx = db.transaction('meta','readonly');
  const req = tx.objectStore('meta').get(k);
  req.onsuccess = ()=> cb && cb(req.result ? req.result.value : null);
}

function loadPrices(){
  loadMeta('prices', (p)=>{
    if(p){
      document.getElementById('priceButir').value = p.butir;
      document.getElementById('pricePapan').value = p.papan;
      document.getElementById('priceIkat').value = p.ikat;
    }
    updatePriceField();
  });
}

function updatePriceField(){
  const unit = document.getElementById('unit').value;
  const q = Number(document.getElementById('quantity').value)||1;
  const prices = {
    butir: Number(document.getElementById('priceButir').value)||0,
    papan: Number(document.getElementById('pricePapan').value)||0,
    ikat: Number(document.getElementById('priceIkat').value)||0
  };
  let price = 0;
  if(unit==='butir') price = prices.butir;
  if(unit==='papan') price = prices.papan;
  if(unit==='ikat') price = prices.ikat;
  document.getElementById('price').value = price;
  document.getElementById('total').value = price * q;
}

document.getElementById('unit').addEventListener('change', updatePriceField);
document.getElementById('quantity').addEventListener('input', updatePriceField);
document.getElementById('priceButir').addEventListener('input', updatePriceField);
document.getElementById('pricePapan').addEventListener('input', updatePriceField);
document.getElementById('priceIkat').addEventListener('input', updatePriceField);

document.getElementById('savePrices').addEventListener('click', ()=>{
  const p = {
    butir: Number(document.getElementById('priceButir').value)||0,
    papan: Number(document.getElementById('pricePapan').value)||0,
    ikat: Number(document.getElementById('priceIkat').value)||0
  };
  saveMeta('prices',p,()=> alert('Harga tersimpan'));
  updatePriceField();
});

document.getElementById('clearBtn').addEventListener('click', ()=>{
  document.getElementById('buyer').value='';
  document.getElementById('quantity').value=1;
  document.getElementById('note').value='';
  document.getElementById('status').value='lunas';
  updatePriceField();
});

document.getElementById('addBtn').addEventListener('click', addOrder);

function addOrder(){
  const buyer = document.getElementById('buyer').value.trim();
  const date = document.getElementById('date').value || (new Date()).toISOString().slice(0,10);
  const unit = document.getElementById('unit').value;
  const quantity = Number(document.getElementById('quantity').value)||1;
  const price = Number(document.getElementById('price').value)||0;
  const total = Number(document.getElementById('total').value)|| (price*quantity);
  const status = document.getElementById('status').value;
  const note = document.getElementById('note').value || '';

  if(!buyer){ alert('Isi nama pembeli'); return; }

  const tx = db.transaction('orders','readwrite');
  tx.objectStore('orders').add({buyer,date,unit,quantity,price,total,status,note,created:Date.now()});
  tx.oncomplete = ()=> {
    renderOrders();
    document.getElementById('buyer').value='';
    document.getElementById('note').value='';
  };
}

function renderOrders(){
  const list = document.getElementById('orders');
  list.innerHTML='';

  const tx = db.transaction('orders','readonly');
  const req = tx.objectStore('orders').getAll();
  req.onsuccess = ()=>{
    const data = req.result.sort((a,b)=>b.created - a.created);
    if(data.length===0){
      list.innerHTML = '<div class="empty">Belum ada pesanan</div>';
      document.getElementById('summary').innerHTML='';
      return;
    }
    let totalRevenue=0, totalUnpaid=0, totalOrders=data.length;
    data.forEach(item=>{
      totalRevenue += item.total;
      if(item.status==='belum') totalUnpaid += item.total;
      const li = document.createElement('li');
      li.className='order-item';
      li.innerHTML = `
        <div class="order-left">
          <strong>${escapeHtml(item.buyer)}</strong><br/>
          <small>${item.date} • ${item.quantity} ${item.unit} • Rp ${numberWithCommas(item.total)}</small>
          <div>${escapeHtml(item.note)}</div>
        </div>
        <div class="order-right">
          <div class="badge ${item.status}">${item.status==='lunas' ? 'Lunas' : 'Belum Lunas'}</div>
          <button class="edit" data-id="${item.id}">Edit</button>
          <button class="del" data-id="${item.id}">Hapus</button>
        </div>
      `;
      list.appendChild(li);
    });

    document.getElementById('summary').innerHTML = `
      <div class="card"><strong>Total Pesanan</strong><div> ${totalOrders} </div></div>
      <div class="card"><strong>Total Pemasukan</strong><div> Rp ${numberWithCommas(totalRevenue)} </div></div>
      <div class="card"><strong>Total Piutang</strong><div> Rp ${numberWithCommas(totalUnpaid)} </div></div>
    `;

    // attach handlers
    Array.from(document.querySelectorAll('button.edit')).forEach(b=>{
      b.addEventListener('click', ()=>{ editOrder(Number(b.dataset.id)); });
    });
    Array.from(document.querySelectorAll('button.del')).forEach(b=>{
      b.addEventListener('click', ()=>{ deleteOrder(Number(b.dataset.id)); });
    });
  };
}

function editOrder(id){
  const tx = db.transaction('orders','readonly');
  const req = tx.objectStore('orders').get(id);
  req.onsuccess = ()=>{
    const it = req.result;
    if(!it) return;
    document.getElementById('buyer').value = it.buyer;
    document.getElementById('date').value = it.date;
    document.getElementById('unit').value = it.unit;
    document.getElementById('quantity').value = it.quantity;
    document.getElementById('price').value = it.price;
    document.getElementById('total').value = it.total;
    document.getElementById('status').value = it.status;
    document.getElementById('note').value = it.note;
    // delete old record to be replaced when saving
    const tx2 = db.transaction('orders','readwrite');
    tx2.objectStore('orders').delete(id);
    tx2.oncomplete = ()=> { renderOrders(); window.scrollTo(0,0); };
  };
}

function deleteOrder(id){
  if(!confirm('Hapus pesanan ini?')) return;
  const tx = db.transaction('orders','readwrite');
  tx.objectStore('orders').delete(id);
  tx.oncomplete = renderOrders;
}

function numberWithCommas(x){ return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
