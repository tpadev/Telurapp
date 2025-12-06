
let db;

const request = indexedDB.open("EggDB", 1);

request.onupgradeneeded = function (event) {
    db = event.target.result;
    db.createObjectStore("production", { keyPath: "id", autoIncrement: true });
    db.createObjectStore("sales", { keyPath: "id", autoIncrement: true });
};

request.onsuccess = function (event) {
    db = event.target.result;
    updateStock();
};

function addProduction() {
    const qty = Number(document.getElementById("prod-qty").value);
    const date = document.getElementById("prod-date").value;

    const tx = db.transaction("production", "readwrite");
    tx.objectStore("production").add({ qty, date });

    tx.oncomplete = updateStock;
}

function addSale() {
    const buyer = document.getElementById("sale-buyer").value;
    const qty = Number(document.getElementById("sale-qty").value);
    const price = Number(document.getElementById("sale-price").value);

    const tx = db.transaction("sales", "readwrite");
    tx.objectStore("sales").add({ buyer, qty, price });

    tx.oncomplete = updateStock;
}

function updateStock() {
    let produced = 0;
    let sold = 0;

    const tx1 = db.transaction("production", "readonly");
    tx1.objectStore("production").getAll().onsuccess = e => {
        produced = e.target.result.reduce((sum, item) => sum + item.qty, 0);

        const tx2 = db.transaction("sales", "readonly");
        tx2.objectStore("sales").getAll().onsuccess = e2 => {
            sold = e2.target.result.reduce((sum, item) => sum + item.qty, 0);

            document.getElementById("stock").innerText =
                `Current Stock: ${produced - sold} eggs`;
        };
    };
}
