// js/payment.js
// API_BASE is defined in config.js
var API_BASE = window.API_BASE || window.location.origin;

let currentProjectId = null;
let currentBidId = null;

// Không dùng DOMContentLoaded vì script được load động sau khi DOM đã ready
// Sẽ được gọi từ payment.html sau khi script load xong

async function loadPaymentInfo() {
    const params = new URLSearchParams(window.location.search);
    currentProjectId = params.get('project_id');
    currentBidId = params.get('bid_id');
    const token = localStorage.getItem('access_token');

    if (!currentProjectId || !currentBidId || !token) {
        alert("Thiếu thông tin đơn hàng.");
        window.location.href = 'index.html';
        return;
    }

    try {
        // 1. Lấy thông tin Project
        const pjRes = await fetch(`${API_BASE}/api/v1/projects/${currentProjectId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!pjRes.ok) {
            throw new Error('Không thể tải thông tin dự án');
        }
        const project = await pjRes.json();
        document.getElementById('pj_title').innerText = project.title;

        // 1.5. Lấy thông tin Client (khách hàng)
        try {
            const clientRes = await fetch(`${API_BASE}/api/v1/users/${project.client_id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (clientRes.ok) {
                const client = await clientRes.json();
                document.getElementById('pj_client').innerText = client.display_name || client.name || `Client #${project.client_id}`;
            } else {
                document.getElementById('pj_client').innerText = `Client #${project.client_id}`;
            }
        } catch (e) {
            document.getElementById('pj_client').innerText = `Client #${project.client_id}`;
        }

        // 2. Lấy thông tin Bid để tính tiền cọc
        // QUAN TRỌNG: Fetch lại từ API để lấy đầy đủ thông tin milestones
        const bidRes = await fetch(`${API_BASE}/api/v1/projects/${currentProjectId}/bids`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!bidRes.ok) {
            throw new Error('Không thể tải thông tin đề xuất');
        }
        const bids = await bidRes.json();
        const myBid = bids.find(b => b.id == parseInt(currentBidId));

        if (!myBid) throw new Error("Không tìm thấy hồ sơ thầu.");
        
        // Debug: Log toàn bộ bid data để kiểm tra
        console.log('[Payment] Full bid data from API:', JSON.stringify(myBid, null, 2));
        
        // FALLBACK: Nếu milestones không có trong response, thử parse từ cover_letter
        // (Một số version cũ có thể lưu milestones trong cover_letter dưới dạng DATA_JSON:)
        if ((!myBid.milestones || (Array.isArray(myBid.milestones) && myBid.milestones.length === 0)) && myBid.cover_letter) {
            try {
                // Dùng cách parse đơn giản như các file khác (workspace.js, orders.js)
                if (myBid.cover_letter.includes('DATA_JSON:')) {
                    const parts = String(myBid.cover_letter).split('DATA_JSON:');
                    const jsonStr = (parts[1] || '').trim();
                    if (jsonStr) {
                        const parsedMilestones = JSON.parse(jsonStr);
                        if (Array.isArray(parsedMilestones) && parsedMilestones.length > 0) {
                            console.log('[Payment] Found milestones in cover_letter, using them:', parsedMilestones);
                            myBid.milestones = parsedMilestones;
                        } else {
                            console.warn('[Payment] Parsed milestones is not an array or empty:', parsedMilestones);
                        }
                    } else {
                        console.warn('[Payment] No JSON string found after DATA_JSON:');
                    }
                } else {
                    console.warn('[Payment] No DATA_JSON: pattern found in cover_letter');
                }
            } catch (e) {
                console.error('[Payment] Failed to parse milestones from cover_letter:', e);
                console.error('[Payment] Cover letter excerpt:', myBid.cover_letter.substring(0, 200));
            }
        }

        // 3. Lấy thông tin Freelancer
        try {
            const freelancerRes = await fetch(`${API_BASE}/api/v1/users/${myBid.freelancer_id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (freelancerRes.ok) {
                const freelancer = await freelancerRes.json();
                document.getElementById('pj_freelancer').innerText = freelancer.display_name || freelancer.name || `Freelancer #${myBid.freelancer_id}`;
            } else {
                document.getElementById('pj_freelancer').innerText = `Freelancer #${myBid.freelancer_id}`;
            }
        } catch (e) {
            document.getElementById('pj_freelancer').innerText = `Freelancer #${myBid.freelancer_id}`;
        }

        // 4. TÍNH TIỀN CỌC (Logic quan trọng)
        const totalPrice = myBid.price || 0;
        let depositAmount = totalPrice; // Mặc định là full nếu ko có milestone
        let milestoneName = "Thanh toán toàn bộ";

        // Debug: Log để kiểm tra
        console.log('[Payment] Bid data:', {
            bidId: myBid.id,
            price: myBid.price,
            milestones: myBid.milestones,
            milestonesType: typeof myBid.milestones,
            milestonesLength: myBid.milestones ? (Array.isArray(myBid.milestones) ? myBid.milestones.length : 'not array') : 'null/undefined',
            cover_letter: myBid.cover_letter ? myBid.cover_letter.substring(0, 100) + '...' : 'null'
        });

        // Kiểm tra xem có milestones proposed không
        // QUAN TRỌNG: milestones có thể là array of objects hoặc array of dicts từ backend
        let milestonesArray = null;
        
        if (myBid.milestones) {
            if (Array.isArray(myBid.milestones)) {
                milestonesArray = myBid.milestones;
                console.log('[Payment] Using milestones from response:', milestonesArray);
            } else if (typeof myBid.milestones === 'string') {
                // Nếu là string JSON, parse nó
                try {
                    milestonesArray = JSON.parse(myBid.milestones);
                    console.log('[Payment] Parsed milestones from JSON string:', milestonesArray);
                } catch (e) {
                    console.warn('[Payment] Failed to parse milestones JSON string:', e);
                }
            }
        }
        
        // Nếu vẫn chưa có milestones, log để debug
        if (!milestonesArray || milestonesArray.length === 0) {
            console.warn('[Payment] No milestones found after parsing. myBid.milestones =', myBid.milestones);
        }
        
        if (milestonesArray && Array.isArray(milestonesArray) && milestonesArray.length > 0) {
            const firstMs = milestonesArray[0];
            console.log('[Payment] First milestone:', firstMs);
            
            // Lấy amount từ milestone đầu tiên (QUAN TRỌNG: Phải có amount)
            // firstMs có thể là object hoặc dict
            let firstMsAmount = null;
            let firstMsPercent = null;
            let firstMsTitle = null;
            
            if (typeof firstMs === 'object' && firstMs !== null) {
                firstMsAmount = firstMs.amount !== undefined && firstMs.amount !== null ? parseFloat(firstMs.amount) : null;
                firstMsPercent = firstMs.percent !== undefined && firstMs.percent !== null ? parseFloat(firstMs.percent) : null;
                firstMsTitle = firstMs.title || 'Giai đoạn 1';
            }
            
            // Ưu tiên lấy amount trực tiếp
            if (firstMsAmount !== null && firstMsAmount > 0) {
                depositAmount = firstMsAmount;
            } else if (firstMsPercent !== null && firstMsPercent > 0 && totalPrice > 0) {
                // Nếu không có amount, tính từ percent
                depositAmount = Math.floor((totalPrice * firstMsPercent) / 100);
            } else {
                // Fallback: Nếu không có cả amount và percent, dùng totalPrice
                console.warn('[Payment] No amount or percent in first milestone, using totalPrice');
                depositAmount = totalPrice;
            }
            
            // Tính percent để hiển thị (ưu tiên từ milestone, nếu không thì tính từ amount)
            let displayPercent = firstMsPercent;
            if (displayPercent === null || displayPercent === undefined || displayPercent === 0) {
                displayPercent = totalPrice > 0 ? ((depositAmount / totalPrice) * 100) : 0;
            }
            milestoneName = firstMsTitle + ` (${parseFloat(displayPercent).toFixed(1)}%)`;
            
            console.log('[Payment] Calculated deposit:', {
                depositAmount,
                milestoneName,
                percent: parseFloat(displayPercent).toFixed(1) + '%',
                source: firstMsAmount !== null ? 'amount' : (firstMsPercent !== null ? 'percent' : 'fallback')
            });
        } else {
            console.warn('[Payment] No milestones found in bid, using full price as deposit');
            console.warn('[Payment] Bid milestones value:', myBid.milestones);
            // Fallback: Nếu không có data milestone, giả định 50% hoặc 100% tùy quy ước
            // Ở đây để an toàn ta hiện đúng giá trị bid
        }

        // Render ra màn hình
        document.getElementById('pj_total_price').innerText = formatMoney(totalPrice);
        document.getElementById('pj_deposit_amount').innerText = formatMoney(depositAmount);
        document.getElementById('pj_milestone_name').innerText = milestoneName;
        
        // Render danh sách milestones (LUÔN render, kể cả khi milestonesArray null để hiển thị thông báo)
        console.log('[Payment] Rendering milestones list, milestonesArray:', milestonesArray);
        renderMilestonesList(milestonesArray, totalPrice);

    } catch (error) {
        console.error(error);
        alert("Lỗi tải thông tin thanh toán: " + error.message);
        document.getElementById('pj_title').innerText = 'Lỗi tải thông tin';
    }
}

async function processPayment() {
    const btn = document.getElementById('btnConfirmPay');
    if (!btn) {
        console.error('Button not found');
        return;
    }
    
    // Validate projectId and bidId
    if (!currentProjectId || !currentBidId) {
        alert('Thiếu thông tin đơn hàng. Vui lòng tải lại trang.');
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';

    const token = localStorage.getItem('access_token');
    if (!token) {
        alert('Vui lòng đăng nhập lại.');
        window.location.href = 'login.html';
        return;
    }

    try {
        // Gọi API Accept Bid (Backend sẽ tự trừ tiền và tạo milestone)
        const response = await fetch(`${API_BASE}/api/v1/projects/${currentProjectId}/accept`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ bid_id: parseInt(currentBidId) })
        });

        if (response.ok) {
            alert("Thanh toán thành công! Dự án đã được kích hoạt.");
            window.location.href = `workspace.html?project_id=${currentProjectId}`;
        } else {
            const err = await response.json().catch(() => ({}));
            alert("Lỗi thanh toán: " + (err.detail || "Không xác định"));
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-lock me-2"></i> THANH TOÁN & KÍCH HOẠT DỰ ÁN';
        }
    } catch (error) {
        console.error(error);
        alert("Lỗi kết nối Server: " + error.message);
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-lock me-2"></i> THANH TOÁN & KÍCH HOẠT DỰ ÁN';
    }
}

function formatMoney(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function renderMilestonesList(milestonesArray, totalPrice) {
    const milestonesListEl = document.getElementById('milestonesList');
    if (!milestonesListEl) return;
    
    if (!milestonesArray || !Array.isArray(milestonesArray) || milestonesArray.length === 0) {
        milestonesListEl.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Chưa có lộ trình thanh toán chi tiết.</p>';
        return;
    }
    
    milestonesListEl.innerHTML = `
        <table class="table" style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="border-bottom: 2px solid var(--border-color);">
                    <th style="text-align: left; padding: 0.75rem; font-weight: 600;">Giai đoạn</th>
                    <th style="text-align: right; padding: 0.75rem; font-weight: 600;">Tỉ lệ (%)</th>
                    <th style="text-align: right; padding: 0.75rem; font-weight: 600;">Số tiền</th>
                    <th style="text-align: right; padding: 0.75rem; font-weight: 600;">Hạn chót</th>
                    <th style="text-align: center; padding: 0.75rem; font-weight: 600;">Trạng thái</th>
                </tr>
            </thead>
            <tbody>
                ${milestonesArray.map((m, index) => {
                    const amount = parseFloat(m.amount || 0);
                    const percent = m.percent || (totalPrice > 0 ? ((amount / totalPrice) * 100) : 0);
                    const deadline = m.deadline ? new Date(m.deadline).toLocaleDateString('vi-VN') : 'Chưa có';
                    const isFirst = index === 0;
                    const statusLabel = isFirst ? 'Đặt cọc (Thanh toán ngay)' : 'Thanh toán sau';
                    const statusClass = isFirst ? 'status-pending' : 'status-info';
                    
                    return `
                        <tr style="border-bottom: 1px solid var(--border-color); ${isFirst ? 'background: #FEF3C7;' : ''}">
                            <td style="padding: 0.75rem; font-weight: 500;">${escapeHtml(m.title || `Giai đoạn ${index + 1}`)}</td>
                            <td style="text-align: right; padding: 0.75rem; color: var(--text-secondary);">${parseFloat(percent).toFixed(1)}%</td>
                            <td style="text-align: right; padding: 0.75rem; font-weight: 600; color: var(--primary-color);">${formatMoney(amount)}</td>
                            <td style="text-align: right; padding: 0.75rem; color: var(--text-secondary);">${deadline}</td>
                            <td style="text-align: center; padding: 0.75rem;">
                                <span style="padding: 0.25rem 0.75rem; border-radius: 99px; font-size: 0.85rem; font-weight: 600; 
                                    ${isFirst ? 'background: #FCD34D; color: #92400E;' : 'background: #DBEAFE; color: #1E40AF;'}">
                                    ${statusLabel}
                                </span>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
            <tfoot>
                <tr style="border-top: 2px solid var(--border-color); background: var(--bg-gray);">
                    <td style="padding: 0.75rem; font-weight: 700;">TỔNG CỘNG</td>
                    <td style="text-align: right; padding: 0.75rem; font-weight: 700; color: var(--success-color);">100%</td>
                    <td style="text-align: right; padding: 0.75rem; font-weight: 700; color: var(--primary-color); font-size: 1.1rem;">${formatMoney(totalPrice)}</td>
                    <td style="padding: 0.75rem;"></td>
                    <td style="padding: 0.75rem;"></td>
                </tr>
            </tfoot>
        </table>
    `;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Expose to global scope for onclick handler and script loading
window.processPayment = processPayment;
window.loadPaymentInfo = loadPaymentInfo;

