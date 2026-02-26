/* ==========================================
   1. CẤU HÌNH & BIẾN TOÀN CỤC
   ========================================== */
const URL_WMS = "https://script.google.com/macros/s/AKfycbxMmN7GsvTIBw4fRbNTITPbS7MWoypOY1I4LKSGHQK0NlrFM3Cxkr3G9KI9klZ6qQRb/exec"; 
const URL_MES = "https://script.google.com/macros/s/AKfycbw2NIYJGSLO3k_FbgkZfUEsbNFeHnUsDNEt8OBRHgelFRyGgi6q6vRNLJJa7rdxHcv0Zw/exec"; 

const IFRAME_URLS = {
    "Xưởng Chế Biến": "https://forms.google.com/your-form-link-1", 
    "Xưởng Đóng Gói": "https://forms.google.com/your-form-link-2",
    "Xuất Kho": "https://docs.google.com/spreadsheets/d/your-sheet-link/preview"
};

const STOCK_THRESHOLD = 10;
let inventoryData = []; 
let mesData = [];
let elements = {}; // Quản lý tập trung các phần tử DOM

/* ==========================================
   2. KHỞI TẠO HỆ THỐNG
   ========================================== */
document.addEventListener("DOMContentLoaded", () => {
    // Thu thập các phần tử DOM
    elements = {
        skuTableBody: document.querySelector("#sku-table tbody"),
        inventoryMonitorBody: document.getElementById("inventory-monitor-body"),
        mesMonitorBody: document.getElementById("mes-monitor-body"),
        searchInput: document.querySelector("#skuSearch"),
        navButtons: document.querySelectorAll(".nav-btn"),
        filterButtons: document.querySelectorAll(".filter-btn"),
        overviewSection: document.getElementById("overview-section"),
        iframeSection: document.getElementById("iframe-section"),
        magicFrame: document.getElementById("magic-frame"),
        entryForm: document.getElementById("entryForm"),
        magicModal: document.getElementById("magicModal"),
        detailModal: document.getElementById("detailModal")
    };

    // Tải dữ liệu ban đầu
    fetchData();

    // Gán sự kiện tìm kiếm chính
    if (elements.searchInput) {
        elements.searchInput.addEventListener("input", handleMainSearch);
    }

    // Gán sự kiện Menu
    elements.navButtons.forEach(btn => {
        btn.addEventListener("click", () => handleNavigation(btn));
    const deliveryBtn = document.getElementById('btn-delivery');
    if (deliveryBtn) {
        deliveryBtn.addEventListener('click', window.openDeliveryModal);
    }
    });

    // Tự động cập nhật đơn hàng/tồn kho mỗi 5 phút
    setInterval(updateInventoryAlert, 300000);
    updateInventoryAlert();
});

/* ==========================================
   3. XỬ LÝ POP-UP (MODAL) - SỬA LỖI DEFINED
   ========================================== */
window.typeWriter = function(elementId, text) {
    let i = 0;
    const element = document.getElementById(elementId);
    element.innerHTML = '';
    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, 50);
        }
    }
    type();
};
window.terminalType = function(element) {
    if (!element) return; // Thoát ngay nếu không thấy phần tử

    const text = element.getAttribute('data-text') || element.innerText;
    if (!text) return; // Thoát nếu không có chữ để chạy

    let i = 0;
    element.innerHTML = '';
    
    // Xóa bỏ mọi interval cũ nếu lỡ tay bấm nhanh nhiều lần
    if (window.terminalInterval) clearInterval(window.terminalInterval);

    window.terminalInterval = setInterval(() => {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
        } else {
            clearInterval(window.terminalInterval);
        }
    }, 40);
};


// Ví dụ: Gọi khi mở Modal Nhập Kho
// typeWriter('modalTitle', 'KHOI TAO HE THONG NHAP KHO...');
// Xuất hàm ra phạm vi toàn cục để HTML có thể gọi được
/* --- QUYỀN NĂNG NHẬP KHO --- */
window.openRMModal = function() {
    const modal = document.getElementById('rmInputModal');
    if (modal) {
        modal.style.display = 'block';
        
        // Tự động điền mã Lô & Ngày tháng
        if (typeof generateRMLot === "function") {
            const lotInput = document.getElementById('rmLot');
            if (lotInput) lotInput.value = generateRMLot();
        }
        
        const dateInput = document.getElementById('rmDate');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        // Kích hoạt hiệu ứng Terminal cho tiêu đề (nếu có)
        const title = modal.querySelector('.glow-text-small');
        if (title && window.terminalType) {
            window.terminalType(title);
        }
    } else {
        console.error("Hệ thống: Không tìm thấy thực thể 'rmInputModal'");
    }
};

// Đừng quên hàm tạo mã Lô cũng cần được khai báo rõ ràng
window.generateRMLot = function() {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    return `RM-${randomNum}`;
};

// 1. Hàm đóng Modal (Ép vào phạm vi toàn cục)
window.closeModal = function() {
    // Tìm tất cả các loại modal đang có
    const detailModal = document.getElementById('detailModal');
    const magicModal = document.getElementById('magicModal');
    
    if (detailModal) detailModal.style.display = 'none';
    if (magicModal) magicModal.style.display = 'none';
    
    // Mở lại cuộn trang cho body
    document.body.style.overflow = 'auto';
};

// 2. Gán sự kiện sau khi trang load xong
document.addEventListener("DOMContentLoaded", () => {
    // Tìm tất cả các nút X và gán hàm đóng
    const closeBtns = document.querySelectorAll('.close-btn');
    closeBtns.forEach(btn => {
        btn.onclick = window.closeModal;
    });

    // Đóng khi bấm vào vùng tối bên ngoài modal
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            window.closeModal();
        }
    };
});

/* ==========================================
   4. TẢI VÀ HIỂN THỊ DỮ LIỆU
   ========================================== */

async function fetchData() {
    try {
        const [resWMS, resMES] = await Promise.all([
            fetch(URL_WMS).then(res => res.json()),
            fetch(URL_MES).then(res => res.json())
        ]);

        inventoryData = resWMS;
        mesData = resMES; 
        
        renderTable(inventoryData, elements.skuTableBody);           
        updateKPIs(inventoryData, mesData);

    } catch (error) {
        console.error("Lỗi triệu hồi:", error);
    }
}

function renderInventoryMonitor(data, targetElems) {
    const tbody = targetElems.inventoryMonitorBody;
    if (!tbody) return;

    tbody.innerHTML = data.map(item => {
        const atp = Number(item.ATP) || 0;
        const category = getCategory(item.sku_id);
        const isLow = atp <= STOCK_THRESHOLD ? 'stock-low' : '';
        return `
            <tr class="${isLow}" data-category="${category}">
                <td><div class="sku-id-text">${item.sku_id}</div></td>
                <td><span class="cat-badge">${category}</span></td>
                <td class="atp-val">${atp}</td>
                <td>${item.onhand_stock || 0}</td>
                <td><span class="status-dot ${atp > 0 ? 'instock' : 'outstock'}"></span>${item.stock_status || 'N/A'}</td>
            </tr>`;
    }).join('');
}

function renderMESMonitor(data, targetElems) {
    const tbody = targetElems.mesMonitorBody;
    if (!tbody) return;

    tbody.innerHTML = data.map(item => {
        const statusClass = (item.status === "Completed") ? "status-finished" : "status-running";
        return `
            <tr>
                <td class="purple-text">#${item.batch_id}</td>
                <td>${item.product_name}</td>
                <td><div class="status-badge ${statusClass}">${item.status}</div></td>
                <td><span class="qc-tag">${item.pqc_status || 'Wait'}</span></td>
            </tr>`;
    }).join('');
}

/* ==========================================
   5. CÁC HÀM BỔ TRỢ (HELPERS)
   ========================================== */

function handleMainSearch(e) {
    const keyword = e.target.value.toLowerCase();
    const filtered = inventoryData.filter(item => 
        String(item.product_name || "").toLowerCase().includes(keyword) || 
        String(item.order_id || "").toLowerCase().includes(keyword)
    );
    renderTable(filtered, elements.skuTableBody);
}

// Hàm tìm kiếm bên trong Modal
window.handleInventorySearch = function(input) {
    const term = input.value.toLowerCase();
    const rows = document.querySelectorAll('#modalBody tbody tr');
    rows.forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(term) ? '' : 'none';
    });
};

function getCategory(skuId) {
    if (!skuId) return "Khác";
    const code = skuId.toUpperCase();
    if (code.startsWith("TAS")) return "Trà";
    if (code.startsWith("CAN")) return "Cao";
    return "Khác";
}

function animateNumber(id, target) {
    const element = document.getElementById(id);
    if (!element) return;
    element.innerText = Math.floor(target).toLocaleString();
}

function updateKPIs(invData, mData) {
    const totalATP = invData.reduce((sum, item) => sum + (Number(item.ATP) || 0), 0);
    const activeBatches = mData.filter(item => item.status === "Created").length;
    animateNumber("total-qty-main", totalATP);
    animateNumber("batch-active-main", activeBatches);
}

// Giữ lại hàm renderTable cũ của bạn...
function renderTable(data, container) {
    if (!container) return;
    container.innerHTML = data.map(item => `
        <tr>
            <td>${item.product_name}<br><small>#${item.batch_id}</small></td>
            <td class="purple-text">#${item.order_id}</td>
            <td>${item.shipping_qty} / ${item.required_qty}</td>
            <td>📍 ${item.location_id}</td>
            <td><span class="status-badge">${item.shipping_status}</span></td>
        </tr>`).join('');
}
function switchTab(tabName) {
    // 1. Gỡ bỏ trạng thái active của tất cả các nút
    const btns = document.querySelectorAll('.nav-btn');
    btns.forEach(btn => btn.classList.remove('active'));

    // 2. Thêm active cho nút vừa bấm
    event.currentTarget.classList.add('active');

    // 3. Logic xử lý nội dung (Ví dụ: Ẩn/Hiện các section tương ứng)
    console.log("Đang chuyển sang quyền năng: " + tabName);
    
    // Ví dụ: Nếu bấm vào 'inventory', ta có thể tự động lọc bảng SKU
    if(tabName === 'inventory') {
        // Gọi hàm lọc hoặc fetch dữ liệu kho
    }
}
// Mở Modal Xuất Kho từ Sidebar
// Đảm bảo hàm này nằm ở ngoài cùng của file script.js hoặc ép vào window
window.openDeliveryModal = function() {
    const modal = document.getElementById('deliveryModal');
    if (modal) {
        modal.style.display = 'block';
        
        // Tự động điền ngày hiện tại vào input date
        const dateInput = document.getElementById('transDate');
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
        }
        
        // Chặn cuộn trang body khi mở modal
        document.body.style.overflow = 'hidden';
    } else {
        console.error("Không tìm thấy modal có ID: deliveryModal");
    }
};

// Cập nhật lại hàm đóng modal để mở lại cuộn trang
window.closeModal = function() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(m => m.style.display = 'none');
    document.body.style.overflow = 'auto';
};

// Thêm dòng mới vào bảng hàng hóa
function addRow() {
    const tbody = document.getElementById('itemsBody');
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td><input type="text" class="table-input" placeholder="Tên hàng..."></td>
        <td><input type="number" class="table-input" value="1"></td>
        <td><input type="text" class="table-input" placeholder="Lý do..."></td>
        <td><button type="button" class="btn-remove" onclick="removeRow(this)">×</button></td>
    `;
    tbody.appendChild(newRow);
}

// Xóa dòng
function removeRow(btn) {
    const row = btn.parentNode.parentNode;
    if (document.querySelectorAll('#itemsBody tr').length > 1) {
        row.parentNode.removeChild(row);
    }
}

// Gửi dữ liệu lên Google Sheets (Hàm triệu hồi)
document.getElementById('deliveryForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Thu thập dữ liệu
    const rows = document.querySelectorAll('#itemsBody tr');
    const items = Array.from(rows).map(row => {
        const inputs = row.querySelectorAll('input');
        return {
            name: inputs[0].value,
            qty: inputs[1].value,
            purpose: inputs[2].value
        };
    });

    const formData = {
        type: document.getElementById('transType').value,
        date: document.getElementById('transDate').value,
        source: document.getElementById('sourceLoc').value,
        dest: document.getElementById('destLoc').value,
        items: JSON.stringify(items)
    };

    console.log("Dữ liệu sẵn sàng gửi đi:", formData);
    alert("🚀 Lệnh đã được triệu hồi lên Google Sheets!");
    closeModal();
});
/* ==========================================
   QUẢN LÝ BẢNG ĐỘNG TRONG FORM XUẤT KHO
   ========================================== */

// 1. Hàm thêm dòng mới
window.addRow = function() {
    const tbody = document.getElementById('itemsBody');
    if (!tbody) return;

    const newRow = document.createElement('tr');
    // Thêm class để kích hoạt animation CSS
    newRow.className = 'magical-row-entry';
    
    newRow.innerHTML = `
        <td><input type="text" class="table-input" placeholder="Tên hàng hóa..."></td>
        <td><input type="number" class="table-input" value="1" min="1"></td>
        <td><input type="text" class="table-input" placeholder="Mục đích..."></td>
        <td><button type="button" class="btn-remove" onclick="removeRow(this)">×</button></td>
    `;
    
    tbody.appendChild(newRow);
};

// 2. Hàm xóa dòng
window.removeRow = function(btn) {
    const row = btn.closest('tr'); // Cách lấy dòng an toàn hơn parentNode
    const tbody = document.getElementById('itemsBody');
    
    // Đảm bảo luôn còn ít nhất 1 dòng để nhập liệu
    if (tbody.querySelectorAll('tr').length > 1) {
        row.style.opacity = '0';
        setTimeout(() => row.remove(), 300);
    } else {
        alert("🛡️ Hệ thống yêu cầu ít nhất một dòng dữ liệu!");
    }
};
//3. Tự động cập nhật ngày
window.openDeliveryModal = function() {
    const modal = document.getElementById('deliveryModal');
    if (modal) {
        modal.style.display = 'block';
        
        const dateInput = document.getElementById('transDate');
        if (dateInput) {
            // Lấy ngày hiện tại theo định dạng YYYY-MM-DD
            const today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
            
            // Xóa bỏ chặn nếu lỡ tay để readonly
            dateInput.readOnly = false;
        }
    }
};
//Hàm tạo mã lô tự động cho modal kho bãi 
// 1. Hàm tạo mã Lô tự động (RM-xxxxx)
function generateRMLot() {
    const randomNum = Math.floor(10000 + Math.random() * 90000); // Tạo 5 số ngẫu nhiên
    return `RM-${randomNum}`;
}

// 2. Mở Modal Nhập Nguyên Liệu
// Cập nhật hàm mở Modal của bạn
window.openRMModal = function() {
    const modal = document.getElementById('rmInputModal');
    if (!modal) {
        console.error("Không tìm thấy modal rmInputModal!");
        return;
    }
    
    modal.style.display = 'block';
    
    // Tìm tiêu đề để chạy hiệu ứng chữ
    const title = modal.querySelector('.glow-text-small');
    if (title) {
        // Đảm bảo thẻ h2 có thuộc tính data-text
        if (!title.getAttribute('data-text')) {
            title.setAttribute('data-text', title.innerText);
        }
        terminalType(title);
    }
    
    // Tự động tạo mã Lô
    const lotInput = document.getElementById('rmLot');
    if (lotInput) lotInput.value = generateRMLot();
};

// 3. Xử lý gửi Form Nhập Kho
document.getElementById('rmForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const rmData = {
        lot: document.getElementById('rmLot').value,
        date: document.getElementById('rmDate').value,
        name: document.getElementById('rmName').value,
        qty: document.getElementById('rmQty').value,
        unit: document.getElementById('rmUnit').value,
        supplier: document.getElementById('rmSupplier').value,
        invoice: document.getElementById('rmInvoice').value
    };

    console.log("Dữ liệu Nhập Kho:", rmData);
    alert(`⚡ Đã tiếp nhận Lô hàng: ${rmData.lot}`);
    closeModal();
});
