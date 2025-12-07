// =======================================
//  PWA UPDATE SYSTEM
// =======================================

let newWorker = null;

// Register service worker
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").then(reg => {

        // Jika ada update ditemukan
        reg.addEventListener("updatefound", () => {
            newWorker = reg.installing;

            newWorker.addEventListener("statechange", () => {
                // SW lama sudah aktif, SW baru telah terinstall → update ready
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                    document.getElementById("applyUpdateBtn").style.display = "block";
                    document.getElementById("updateStatus").textContent = "Versi baru tersedia!";
                }
            });
        });
    });

    // Reload otomatis jika SW baru mengambil alih
    navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
    });
}

// Tombol: Periksa Update
document.getElementById("checkUpdateBtn").addEventListener("click", () => {
    document.getElementById("updateStatus").textContent = "Memeriksa update…";

    // Paksa fetch versi terbaru dari GitHub Pages
    fetch("./index.html?cache=" + Date.now())
        .then(() => {
            document.getElementById("updateStatus").textContent =
                "Jika ada versi baru, tombol Terapkan Update akan muncul.";
        })
        .catch(() => {
            document.getElementById("updateStatus").textContent = "Gagal memeriksa.";
        });
});

// Tombol: Terapkan Update
document.getElementById("applyUpdateBtn").addEventListener("click", () => {
    if (newWorker) {
        newWorker.postMessage({ action: "skipWaiting" });
    }
});

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
  if (Notification && Notification.permission === 'default') {
    Notification.requestPermission();
  }
};

function setDefaultDates() {
    const today = new Date().toISOString().split("T")[0];

    document.getElementById("orderDate").value = today;
    document.getElementById("deliverDate").value = today;
}

// panggil saat halaman pertama kali load
document.addEventListener("DOMContentLoaded", setDefaultDates);

const hargaSection = document.getElementById("hargaSection");
const toggleHargaBtn = document.getElementById("toggleHargaBtn");

toggleHargaBtn.addEventListener("click", () => {
    if (hargaSection.style.display === "none") {
        hargaSection.style.display = "block";
        toggleHargaBtn.textContent = "Tampilkan harga Harga";
    } else {
        hargaSection.style.display = "block";
        toggleHargaBtn.textContent = "Sembunyikan Harga";
    }
});




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
  saveMeta('prices',p,()=> {
    showToast('Harga tersimpan','Daftar harga berhasil disimpan.');
  });
  updatePriceField();
});

document.getElementById('clearBtn').addEventListener('click', ()=>{
  document.getElementById('buyer').value='';
  document.getElementById('phone').value='';
  document.getElementById('quantity').value=1;
  document.getElementById('note').value='';
  document.getElementById('status').value='belum';
  document.getElementById('unit').value='papan';
  updatePriceField();
});

document.getElementById('addBtn').addEventListener('click', addOrder);

function addOrder(){
  const buyer = document.getElementById('buyer').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const orderDate = document.getElementById('orderDate').value || (new Date()).toISOString().slice(0,10);
  const deliverDate = document.getElementById('deliverDate').value || '';
  const unit = document.getElementById('unit').value;
  const quantity = Number(document.getElementById('quantity').value)||1;
  const price = Number(document.getElementById('price').value)||0;
  const total = Number(document.getElementById('total').value)|| (price*quantity);
  const paymentMethod = document.getElementById('paymentMethod').value;
  const status = document.getElementById('status').value;
  const note = document.getElementById('note').value || '';

  if(!buyer){ alert('Isi nama pembeli'); return; }

  const tx = db.transaction('orders','readwrite');
  tx.objectStore('orders').add({buyer,phone,orderDate,deliverDate,unit,quantity,price,total,paymentMethod,status,note,created:Date.now()});
  tx.oncomplete = ()=> {
    renderOrders();
    showToast('Pesanan tersimpan', 'Pesanan berhasil ditambahkan.');
    document.getElementById('buyer').value='';
    document.getElementById('phone').value='';
    document.getElementById('note').value='';
    document.getElementById('status').value='belum';
    document.getElementById('unit').value='papan';
    document.getElementById('quantity').value=1;
    updatePriceField();
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
    let cash=0, transfer=0;
    data.forEach(item=>{
      if(item.status==='lunas') {
        totalRevenue += item.total;
        if(item.paymentMethod==='cash') cash += item.total;
        else transfer += item.total;
      } else {
        totalUnpaid += item.total;
      }
      const li = document.createElement('li');
      li.className='order-item';
      li.innerHTML = `
        <div class="order-left">
          <strong>${escapeHtml(item.buyer)}</strong> • ${escapeHtml(item.phone)}<br/>
          <small>Order: ${item.orderDate} • Antar: ${item.deliverDate || '-'} • ${item.quantity} ${item.unit}</small>
          <div>Rp ${numberWithCommas(item.total)} • ${escapeHtml(item.note)}</div>
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
      <div class="card"><strong>Pemasukan Cash</strong><div> Rp ${numberWithCommas(cash)} </div></div>
      <div class="card"><strong>Pemasukan Transfer</strong><div> Rp ${numberWithCommas(transfer)} </div></div>
      <div class="card"><strong>Total Pemasukan</strong><div> Rp ${numberWithCommas(cash+transfer)} </div></div>
      <div class="card"><strong>Total Piutang</strong><div> Rp ${numberWithCommas(totalUnpaid)} </div></div>
    `;

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
    document.getElementById('phone').value = it.phone;
    document.getElementById('orderDate').value = it.orderDate;
    document.getElementById('deliverDate').value = it.deliverDate;
    document.getElementById('unit').value = it.unit;
    document.getElementById('quantity').value = it.quantity;
    document.getElementById('price').value = it.price;
    document.getElementById('total').value = it.total;
    document.getElementById('paymentMethod').value = it.paymentMethod;
    document.getElementById('status').value = it.status;
    document.getElementById('note').value = it.note;
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

function showToast(message) {
  const toast = document.getElementById("toast");
  const msg = document.getElementById("toastMessage");

  msg.textContent = message;

  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500); // tampil 2.5 detik
}

function showNotification(title, body){
  if(!('Notification' in window)) return;
  if(Notification.permission !== 'granted') return;
  navigator.serviceWorker.ready.then(reg=>{
    reg.showNotification(title, {body, icon:'./icons/icon-192.png'});
  });
}
