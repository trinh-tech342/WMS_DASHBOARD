// 1. CẤU HÌNH URL
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyyirpjAXVywxvtEB7WIaZ_xZBUrq7b86mB1MBAOi0Fg3JcUQRRwcFntooidR6qYPNS/exec"; 

// Thay các link dưới đây bằng link Google Form hoặc báo cáo thật của bạn
const IFRAME_URLS = {
    "Xưởng Chế Biến": "https://forms.google.com/your-form-link-1", 
    "Xưởng Đóng Gói": "https://forms.google.com/your-form-link-2",
    "Xuất Kho": "https://docs.google.com/spreadsheets/d/your-sheet-link/preview"
};

let inventoryData = [];

document.addEventListener("DOMContentLoaded", () => {
    // Các phần tử giao diện
    const skuTableBody = document.querySelector("#sku-table tbody");
    const searchInput = document.querySelector("#skuSearch");
    const navButtons = document.querySelectorAll(".nav-btn");
    
    // Các phần tử chuyển đổi hiển thị
    const overviewSection = document.getElementById("overview-section");
    const iframeSection = document.getElementById("iframe-section");
    const magicFrame = document.getElementById("magic-frame");

    // --- PHẦN 1: LOGIC LẤY DỮ LIỆU TỪ SHEETS (CHO TỔNG QUAN) ---
    async function fetchData() {
        if (!skuTableBody) return;
        skuTableBody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>🔮 Đang triệu hồi dữ liệu...</td></tr>";
        
        try {
            const response = await fetch(APPS_SCRIPT_URL);
            const data = await response.json();
            inventoryData = data; 
            renderTable(data);
            updateKPIs(data);
        } catch (error) {
            console.error("Lỗi:", error);
            if(skuTableBody) skuTableBody.innerHTML = "<tr><td colspan='4' style='color:red;'>⚠️ Thất bại khi kết nối kho vận!</td></tr>";
        }
    }

    const renderTable = (data) => {
        if (!skuTableBody) return;
        skuTableBody.innerHTML = data.map(item => `
            <tr class="${item.pqc_status === 'FAIL' ? 'row-fail' : ''}">
                <td>${item.sku || item.product_name || 'N/A'}</td>
                <td style="color: #9d50bb; font-weight: bold;">#${item.order_id || '---'}</td>
                <td class="glow-val">${item.qty || item.stock_quantity || 0}</td>
                <td><span class="status-badge ${getStatusClass(item.status || item.order_status)}">${item.status || item.order_status || 'Chờ'}</span></td>
            </tr>
        `).join('');
    };

    const getStatusClass = (status) => {
        if (!status) return "";
        const s = status.toUpperCase();
        if (s.includes("ĐỦ") || s.includes("HOÀN") || s.includes("PASS")) return "ok";
        if (s.includes("THIẾU") || s.includes("FAIL")) return "error";
        return "processing";
    };

    const updateKPIs = (data) => {
        const total = data.reduce((sum, item) => sum + (Number(item.qty || item.stock_quantity) || 0), 0);
        animateNumber("total-qty", total);
        animateNumber("order-pending", data.length);
    };

    // --- PHẦN 2: LOGIC CHUYỂN ĐỔI TAB (TỔNG QUAN VS IFRAME) ---
    navButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            // Đổi trạng thái nút active
            navButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const btnText = btn.innerText.replace(/[📊🧪📦🚚]/g, '').trim();

            if (btnText === "Tổng Quan") {
                // Hiện lại Dashboard
                overviewSection.style.display = "block";
                iframeSection.style.display = "none";
                magicFrame.src = "";
                fetchData(); // Cập nhật lại dữ liệu khi quay về
            } else {
                // Hiện Iframe nhúng URL
                const targetUrl = IFRAME_URLS[btnText];
                if (targetUrl) {
                    overviewSection.style.display = "none";
                    iframeSection.style.display = "block";
                    magicFrame.src = targetUrl;
                }
            }
        });
    });

    // --- PHẦN 3: TÌM KIẾM ---
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const keyword = e.target.value.toLowerCase();
            const filteredData = inventoryData.filter(item => 
                (item.sku && item.sku.toLowerCase().includes(keyword)) || 
                (item.order_id && item.order_id.toString().toLowerCase().includes(keyword))
            );
            renderTable(filteredData);
        });
    }

    // Khởi chạy lấy dữ liệu lần đầu
    fetchData();
});

// Hàm hiệu ứng số chạy
function animateNumber(id, target) {
    const element = document.getElementById(id);
    if(!element) return;
    let current = 0;
    const step = Math.ceil(target / 20) || 1;
    const timer = setInterval(() => {
        current += step;
        if (current >= target) {
            element.innerText = target.toLocaleString();
            clearInterval(timer);
        } else {
            element.innerText = current.toLocaleString();
        }
    }, 30);
}
