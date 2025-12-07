// Requires config.js & auth.js before load
(function () {
    var API_BASE = window.API_BASE || window.location.origin;
    var state = {
        projects: [],
        filtered: [],
        currentBidId: null, // Lưu ID bid nếu đang sửa
        myBidsByProjectId: {}, // { [projectId]: bid or null }
        isFreelancer: false
    };

    var elements = {};

    function init() {
        elements.list = document.getElementById('projectsList');
        elements.count = document.getElementById('projectCount');
        elements.searchInput = document.getElementById('projectSearchInput');
        elements.searchButton = document.getElementById('projectSearchButton');
        elements.skillsInput = document.getElementById('skillsFilter');
        elements.budgetFilter = document.getElementById('budgetFilter');
        elements.budgetTypeFilter = document.getElementById('budgetTypeFilter');

        bindEvents();
        loadProjects();
    }

    function bindEvents() {
        if (elements.searchButton) elements.searchButton.addEventListener('click', applyFilters);
        if (elements.searchInput) {
            elements.searchInput.addEventListener('keydown', function (event) {
                if (event.key === 'Enter') applyFilters();
            });
        }
        if (elements.skillsInput) elements.skillsInput.addEventListener('change', applyFilters);
        if (elements.budgetFilter) elements.budgetFilter.addEventListener('change', applyFilters);
        if (elements.budgetTypeFilter) elements.budgetTypeFilter.addEventListener('change', applyFilters);
    }

    async function loadProjects() {
        if (!elements.list) return;
        elements.list.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Đang tải dự án...</p></div>`;

        try {
            const params = new URLSearchParams({ status_filter: 'OPEN' });
            const response = await fetch(`${API_BASE}/api/v1/projects?${params.toString()}`);
            if (!response.ok) throw new Error(`Failed to load projects (${response.status})`);
            
            state.projects = await response.json();
            // Nếu đang đăng nhập là freelancer, lấy các bid của chính mình để hiển thị nút chỉnh sửa/rút hồ sơ
            try {
                const token = localStorage.getItem('access_token');
                const meResp = token ? await fetch(`${API_BASE}/api/v1/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } }) : null;
                const me = meResp && meResp.ok ? await meResp.json() : null;
                const role = me && (typeof me.role === 'string' ? me.role : (me.role && (me.role.value || me.role.name)));
                state.isFreelancer = String(role || '').toLowerCase() === 'freelancer';
                if (state.isFreelancer) {
                    const checks = state.projects.map(async (p) => {
                        try {
                            const r = await fetch(`${API_BASE}/api/v1/projects/${p.id}/bids/me`, { headers: { 'Authorization': `Bearer ${token}` } });
                            if (r.ok) {
                                const bid = await r.json();
                                state.myBidsByProjectId[p.id] = bid;
                            } else {
                                state.myBidsByProjectId[p.id] = null;
                            }
                        } catch(_) {
                            state.myBidsByProjectId[p.id] = null;
                        }
                    });
                    await Promise.all(checks);
                } else {
                    state.myBidsByProjectId = {};
                }
            } catch(_) {
                state.myBidsByProjectId = {};
            }
            applyFilters();
        } catch (error) {
            console.error('Error loading projects:', error);
            elements.list.innerHTML = `<div class="empty-state"><i class="fas fa-face-frown"></i><p>Không thể tải danh sách dự án.</p></div>`;
        }
    }

    function applyFilters() {
        // ... (Giữ nguyên logic filter cũ) ...
        const query = (elements.searchInput?.value || '').trim().toLowerCase();
        const skillsRaw = (elements.skillsInput?.value || '').trim().toLowerCase();
        const skillTokens = skillsRaw ? skillsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
        const budgetFilter = elements.budgetFilter?.value || 'all';
        const budgetTypeFilter = elements.budgetTypeFilter?.value || 'all';

        state.filtered = state.projects.filter(function (project) {
            const title = (project.title || '').toLowerCase();
            const description = (project.description || '').toLowerCase();
            const budget = Number(project.budget) || 0;
            const budgetType = (project.budget_type || '').toUpperCase();
            const skills = [].concat(project.skills_required || [], project.tags || []).map(s => String(s).toLowerCase());

            const matchesQuery = !query || title.includes(query) || description.includes(query);
            const matchesSkills = !skillTokens.length || skillTokens.every(t => skills.some(s => s.includes(t)));
            const matchesBudget = filterBudget(budget, budgetFilter);
            const matchesBudgetType = budgetTypeFilter === 'all' || budgetType === budgetTypeFilter;

            return matchesQuery && matchesSkills && matchesBudget && matchesBudgetType;
        });

        renderProjects();
    }

    function filterBudget(budget, filterValue) {
        switch (filterValue) {
            case 'low': return budget < 10000000;
            case 'mid': return budget >= 10000000 && budget <= 50000000;
            case 'high': return budget > 50000000;
            default: return true;
        }
    }

    function renderProjects() {
        if (!elements.list) return;
        if (!state.filtered.length) {
            elements.list.innerHTML = `<div class="empty-state"><i class="fas fa-folder-open"></i><p>Không có dự án nào phù hợp.</p></div>`;
            updateProjectCount(0);
            return;
        }
        const cards = state.filtered.map(renderProjectCard).join('');
        elements.list.innerHTML = cards;
        updateProjectCount(state.filtered.length);
    }

    function updateProjectCount(count) {
        if (elements.count) elements.count.textContent = `${count} dự án phù hợp`;
    }

    function renderProjectCard(project) {
        // ... (Giữ nguyên logic render card cũ) ...
        const budgetType = project.budget_type === 'HOURLY' ? 'Theo giờ' : 'Trọn gói';
        // Bảo mật ngân sách: freelancer không thấy ngân sách khi dự án còn OPEN
        const showBudget = !state.isFreelancer;
        const budgetValue = showBudget ? formatCurrency(project.budget) : '—';
        const skills = (project.skills_required || project.tags || []).slice(0, 6);
        const createdAt = project.created_at ? new Date(project.created_at).toLocaleDateString('vi-VN') : 'Chưa rõ';
        const myBid = state.myBidsByProjectId[project.id];

        return `
            <article class="project-card">
                <div class="project-card-header">
                    <div>
                        <h3>${project.title || 'Không có tiêu đề'}</h3>
                        <p class="project-description">${truncate(project.description || '', 220)}</p>
                    </div>
                    <span class="status-tag">Open</span>
                </div>
                <div class="project-card-meta">
                    <div class="meta-row">
                        <span><i class="fas fa-money-bill-wave"></i> ${budgetValue} · ${budgetType}</span>
                        <span><i class="fas fa-calendar-day"></i> Đăng ngày ${createdAt}</span>
                    </div>
                </div>
                ${skills.length ? `<div class="tag-list">${skills.map(s => `<span class="category-tag">${s}</span>`).join('')}</div>` : ''}
                <div class="project-card-actions">
                    <button class="btn btn-outline btn-small" data-action="view" data-id="${project.id}"><i class="fas fa-eye"></i> Xem chi tiết</button>
                    ${myBid ? `
                        <button class="btn btn-primary btn-small" data-action="bid" data-id="${project.id}"><i class="fas fa-edit"></i> Chỉnh sửa hồ sơ</button>
                        <button class="btn btn-danger btn-small" data-action="withdraw" data-id="${project.id}"><i class="fas fa-times"></i> Rút hồ sơ</button>
                    ` : `
                        <button class="btn btn-primary btn-small" data-action="bid" data-id="${project.id}"><i class="fas fa-paper-plane"></i> Ứng tuyển</button>
                    `}
                </div>
            </article>
        `;
    }

    // ... (Giữ nguyên các hàm helper formatCurrency, truncate...) ...
    function truncate(text, limit) { return text.length <= limit ? text : text.slice(0, limit).trim() + '...'; }
    function formatCurrency(value) {
        if (!value && value !== 0) return 'Thỏa thuận';
        try { return Number(value).toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }); } catch { return `${value} VND`; }
    }
    function formatDeadline(deadline) {
        const date = new Date(deadline);
        return Number.isNaN(date.getTime()) ? 'Không rõ' : date.toLocaleDateString('vi-VN');
    }

    function handleListClick(event) {
        const target = event.target.closest('button[data-action]');
        if (!target) return;
        const projectId = target.getAttribute('data-id');
        const action = target.getAttribute('data-action');

        if (action === 'view') window.location.href = `workspace.html?project_id=${projectId}`;
        else if (action === 'bid') openBidModal(projectId);
        else if (action === 'withdraw') withdrawMyBid(projectId);
    }

    // --- CÁC HÀM XỬ LÝ MODAL & EDIT BID ---

    function bindBidModalEvents() {
        const priceInput = document.getElementById('bidPrice');
        const milestoneSelect = document.getElementById('milestoneCount');
        if (priceInput) priceInput.oninput = () => generateMilestones();
        if (milestoneSelect) milestoneSelect.onchange = () => generateMilestones();
    }

    async function withdrawMyBid(projectId) {
        const token = localStorage.getItem('access_token');
        if (!token) { alert('Vui lòng đăng nhập để rút hồ sơ.'); return; }
        if (!confirm('Bạn chắc chắn muốn rút hồ sơ thầu cho dự án này?')) return;
        try {
            // Tìm bid id hiện tại (ưu tiên cache)
            let bidId = state.myBidsByProjectId[projectId]?.id || null;
            if (!bidId) {
                const meResp = await fetch(`${API_BASE}/api/v1/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } });
                const me = meResp.ok ? await meResp.json() : null;
                const listResp = await fetch(`${API_BASE}/api/v1/projects/${projectId}/bids`, { headers: { 'Authorization': `Bearer ${token}` } });
                const bids = listResp.ok ? await listResp.json() : [];
                const my = me ? bids.find(b => b.freelancer_id === me.id) : null;
                if (my) bidId = my.id;
            }
            if (!bidId) throw new Error('Không tìm thấy hồ sơ để rút.');

            const resp = await fetch(`${API_BASE}/api/v1/projects/${projectId}/bids/${bidId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resp.status === 204) {
                alert('Đã rút hồ sơ thầu.');
                state.myBidsByProjectId[projectId] = null;
                renderProjects();
            } else {
                const errText = await resp.text().catch(()=> '');
                let msg = 'Không thể rút hồ sơ.';
                try { const j = JSON.parse(errText); if (j.detail) msg = j.detail; } catch(_) { if (errText) msg = errText; }
                alert(msg);
            }
        } catch (e) {
            alert('Lỗi kết nối. Không thể rút hồ sơ.');
        }
    }

    // Hàm generateMilestones phiên bản "Thông minh" (Hỗ trợ load dữ liệu cũ)
    // --- 1. HÀM TẠO MILESTONE (STRICT MODE - CHẶN NẾU LỐ NGÀY) ---
    function generateMilestones(existingData = null) {
        const priceElement = document.getElementById('bidPrice');
        const countElement = document.getElementById('milestoneCount');
        const container = document.getElementById('milestoneContainer');
        const deadlineElement = document.getElementById('bidProjectDeadline');
        
        if (!priceElement || !countElement || !container) return;

        let count = existingData ? existingData.length : (parseInt(countElement.value) || 1);
        countElement.value = count; 

        const totalAmount = parseFloat(priceElement.value) || 0;
        
        // --- TÍNH TOÁN NGÀY ---
        const today = new Date();
        today.setHours(0,0,0,0);
        
        let projectDeadline = null;
        let daysAvailable = 365; 

        if (deadlineElement && deadlineElement.value) {
            projectDeadline = new Date(deadlineElement.value);
            const timeDiff = projectDeadline.getTime() - today.getTime();
            daysAvailable = Math.floor(timeDiff / (1000 * 3600 * 24));
            
            // Nếu deadline là hôm nay hoặc đã qua
            if (daysAvailable < 0) daysAvailable = 0;
        }

        // --- VALIDATION: NGHIÊM KHẮC ---
        // Nếu có deadline và số mốc > số ngày còn lại -> CHẶN LUÔN
        if (projectDeadline && count > daysAvailable) {
             container.innerHTML = `
                <div style="background-color: #fee2e2; color: #991b1b; padding: 15px; border-radius: 4px; border: 1px solid #fecaca; text-align: center;">
                    <i class="fas fa-ban"></i> 
                    <strong>Không thể chia ${count} giai đoạn!</strong><br>
                    Dự án hết hạn vào <strong>${projectDeadline.toLocaleDateString('vi-VN')}</strong> (còn ${daysAvailable} ngày).<br>
                    Thời gian quá ngắn để chia làm ${count} mốc. Vui lòng giảm số lượng giai đoạn.
                </div>
             `;
             return; 
        }

        // Tính khoảng cách ngày (chia đều)
        let intervalDays = 7;
        if (projectDeadline && daysAvailable > 0) {
            intervalDays = Math.floor(daysAvailable / count);
            if (intervalDays < 1) intervalDays = 1;
        }

        let html = '<div style="display:flex; font-weight:600; margin-bottom:10px; font-size:0.9em; color:#666;">' +
                   '<div style="flex:2">Giai đoạn</div>' +
                   '<div style="flex:1">Tỉ lệ (%)</div>' +
                   '<div style="flex:1">Số tiền (VND)</div>' +
                   '<div style="flex:1">Ngày xong</div>' +
                   '</div>';

        const avgAmount = Math.floor(totalAmount / count);
        const remainder = totalAmount - (avgAmount * count); 

        let totalPercentCalculated = 0; // Để đảm bảo tổng = 100%

        for (let i = 1; i <= count; i++) {
            const date = new Date(); 
            // Logic cộng ngày an toàn
            const daysToAdd = i * intervalDays;
            
            // Nếu cộng ra ngày lố deadline -> Ép về đúng deadline
            let targetDate = new Date(today);
            targetDate.setDate(today.getDate() + daysToAdd);
            
            if (projectDeadline && targetDate > projectDeadline) {
                targetDate = new Date(projectDeadline);
            }

            let dateStr = targetDate.toISOString().split('T')[0];
            const maxDateStr = projectDeadline ? projectDeadline.toISOString().split('T')[0] : '';
            
            // Milestone cuối nhận phần dư để đảm bảo tổng tiền = totalAmount
            let amountVal = (i === count) ? (avgAmount + remainder) : avgAmount;
            let titleVal = `Giai đoạn ${i}`;
            
            // Tính percent từ amount thực tế
            let percentVal;
            if (i === count) {
                // Milestone cuối: đảm bảo tổng = 100%
                percentVal = (100 - totalPercentCalculated).toFixed(1);
            } else {
                percentVal = totalAmount > 0 ? ((amountVal / totalAmount) * 100).toFixed(1) : (100 / count).toFixed(1);
                totalPercentCalculated += parseFloat(percentVal);
            }

            if (existingData && existingData[i-1]) {
                const old = existingData[i-1];
                titleVal = old.title;
                amountVal = old.amount;
                dateStr = old.deadline;
                // Ưu tiên dùng percent từ database, nếu không có thì tính từ amount/totalAmount
                percentVal = old.percent || (totalAmount > 0 ? ((old.amount || 0) / totalAmount * 100) : 0);
                percentVal = parseFloat(percentVal).toFixed(1);
            }

            // QUAN TRỌNG: Thêm thuộc tính max="..." để khóa lịch
            html += `
            <div class="milestone-row" style="display:flex; gap:10px; margin-bottom:10px;">
                <div style="flex:2">
                    <input type="text" class="ms-title" value="${titleVal}" placeholder="Tên công việc" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                </div>
                <div style="flex:1">
                    <div style="display:flex; align-items:center;">
                        <input type="number" class="ms-percent" value="${percentVal}" min="0" max="100" step="0.1" placeholder="0" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px 0 0 4px; border-right:none;">
                        <span style="padding:8px 10px; background:#f8f9fa; border:1px solid #ddd; border-left:none; border-radius:0 4px 4px 0; font-size:0.9em; color:#666;">%</span>
                    </div>
                </div>
                <div style="flex:1">
                    <input type="number" class="ms-amount" value="${amountVal}" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                </div>
                <div style="flex:1">
                    <input type="date" class="ms-deadline" value="${dateStr}" 
                           min="${new Date().toISOString().split('T')[0]}" 
                           ${maxDateStr ? `max="${maxDateStr}"` : ''} 
                           style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                </div>
            </div>`;
        }
        
        container.innerHTML = html;
        
        // Thêm phần tổng kết và cảnh báo
        const summaryHtml = `
            <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #e9ecef; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    <span style="font-weight: 600; color: #666;">Đã chia: </span>
                    <span id="bidTotalPercentDisplay" style="font-weight: 700;">0%</span>
                    <span id="bidPercentWarning" style="display: none; color: #dc3545; font-weight: 600; font-size: 0.95rem;"></span>
                </div>
                <div>
                    <span style="font-weight: 600; color: #666;">Tổng: </span>
                    <span id="bidTotalAmountDisplay" style="font-weight: 700; color: #0066ff;">0</span> VND
                </div>
            </div>
        `;
        container.innerHTML += summaryHtml;
        
        // Gán event listeners cho tính toán 2 chiều
        attachMilestoneCalculators();
        
        // Cập nhật tổng kết ban đầu
        updateBidSummary();
    }
    
    // Hàm gán event listeners cho tính toán % và tiền
    function attachMilestoneCalculators() {
        const container = document.getElementById('milestoneContainer');
        if (!container) return;
        
        const rows = container.querySelectorAll('.milestone-row');
        const totalBidInput = document.getElementById('bidPrice');
        
        rows.forEach(function(row, index) {
            const percentInput = row.querySelector('.ms-percent');
            const amountInput = row.querySelector('.ms-amount');
            
            if (!percentInput || !amountInput) return;
            
            // Khi nhập % -> tính tiền
            percentInput.addEventListener('input', function() {
                const totalBid = parseFloat(totalBidInput.value) || 0;
                const p = parseFloat(this.value) || 0;
                
                // Validation: Mốc đầu tiên không quá 50%
                if (index === 0 && p > 50) {
                    alert("Theo quy định an toàn, giai đoạn đặt cọc (Mốc 1) tối đa là 50%.");
                    this.value = 50;
                    amountInput.value = Math.round((totalBid * 50) / 100);
                } else {
                    amountInput.value = Math.round((totalBid * p) / 100);
                }
                updateBidSummary();
            });
            
            // Khi nhập tiền -> tính %
            amountInput.addEventListener('input', function() {
                const totalBid = parseFloat(totalBidInput.value) || 0;
                const a = parseFloat(this.value) || 0;
                
                if (totalBid > 0) {
                    let p = (a / totalBid) * 100;
                    
                    // Validation: Mốc đầu tiên không quá 50%
                    if (index === 0 && p > 50) {
                        alert("Tiền cọc quá lớn! Giai đoạn 1 tối đa 50% tổng giá trị.");
                        this.value = Math.round((totalBid * 50) / 100);
                        percentInput.value = 50;
                    } else {
                        percentInput.value = p.toFixed(1);
                    }
                }
                updateBidSummary();
            });
        });
        
        // Khi thay đổi tổng giá trị thầu -> tính lại tất cả tiền dựa trên %
        if (totalBidInput) {
            totalBidInput.addEventListener('input', function() {
                const totalBid = parseFloat(this.value) || 0;
                const rows = container.querySelectorAll('.milestone-row');
                
                rows.forEach(function(row) {
                    const percentInput = row.querySelector('.ms-percent');
                    const amountInput = row.querySelector('.ms-amount');
                    if (percentInput && amountInput) {
                        const p = parseFloat(percentInput.value) || 0;
                        amountInput.value = Math.round((totalBid * p) / 100);
                    }
                });
                updateBidSummary();
            });
        }
    }
    
    // Hàm cập nhật tổng kết
    function updateBidSummary() {
        const container = document.getElementById('milestoneContainer');
        if (!container) return;
        
        const rows = container.querySelectorAll('.milestone-row');
        let totalPercent = 0;
        let totalAmount = 0;
        
        rows.forEach(function(row) {
            const percentInput = row.querySelector('.ms-percent');
            const amountInput = row.querySelector('.ms-amount');
            if (percentInput) totalPercent += parseFloat(percentInput.value) || 0;
            if (amountInput) totalAmount += parseFloat(amountInput.value) || 0;
        });
        
        const totalPercentEl = document.getElementById('bidTotalPercentDisplay');
        const totalAmountEl = document.getElementById('bidTotalAmountDisplay');
        const percentWarning = document.getElementById('bidPercentWarning');
        
        if (totalPercentEl) {
            totalPercentEl.textContent = totalPercent.toFixed(1) + "%";
            
            // Xử lý hiển thị cảnh báo
            if (Math.abs(totalPercent - 100) < 0.1) {
                // Đúng 100%
                totalPercentEl.style.color = "#10b981";
                if (percentWarning) {
                    percentWarning.style.display = 'none';
                    percentWarning.textContent = '';
                }
            } else if (totalPercent > 100) {
                // Vượt quá 100%
                totalPercentEl.style.color = "#dc3545";
                if (percentWarning) {
                    const excess = (totalPercent - 100).toFixed(1);
                    percentWarning.style.display = 'inline';
                    percentWarning.textContent = '(Vượt quá ' + excess + '%)';
                    percentWarning.style.color = '#dc3545';
                }
            } else {
                // Chưa đủ 100%
                totalPercentEl.style.color = "#ffc107";
                if (percentWarning) {
                    const missing = (100 - totalPercent).toFixed(1);
                    percentWarning.style.display = 'inline';
                    percentWarning.textContent = '(Thiếu ' + missing + '%)';
                    percentWarning.style.color = '#ffc107';
                }
            }
        }
        
        if (totalAmountEl) {
            totalAmountEl.textContent = totalAmount.toLocaleString('vi-VN');
        }
    }

    // --- 2. HÀM XỬ LÝ GỬI (STRICT CHECK) ---
    async function handleBidSubmit(event) {
        event.preventDefault();
        const errorDiv = document.getElementById('bidErrorMessage');
        const submitBtn = document.getElementById('submitBidBtn');
        const price = parseFloat(document.getElementById('bidPrice').value);
        const coverLetter = document.getElementById('bidCoverLetter').value.trim();
        const projectId = document.getElementById('bidProjectId').value;
        const deadlineElement = document.getElementById('bidProjectDeadline');

        if (!price || price <= 0) {
            if(errorDiv) { errorDiv.textContent = 'Giá không hợp lệ'; errorDiv.style.display = 'block'; }
            return;
        }
        if (coverLetter.length < 20) {
            if(errorDiv) { errorDiv.textContent = 'Thư ngỏ quá ngắn'; errorDiv.style.display = 'block'; }
            return;
        }

        const msTitles = document.querySelectorAll('.ms-title');
        const msPercents = document.querySelectorAll('.ms-percent');
        const msAmounts = document.querySelectorAll('.ms-amount');
        const msDeadlines = document.querySelectorAll('.ms-deadline');
        
        const milestones = [];
        let maxDays = 0;
        let totalCheck = 0;
        let totalPercentCheck = 0;
        
        // Parse deadline dự án để kiểm tra chặt chẽ
        let projectDeadline = null;
        if (deadlineElement && deadlineElement.value) {
            projectDeadline = new Date(deadlineElement.value);
            // Reset giờ về cuối ngày để so sánh công bằng
            projectDeadline.setHours(23, 59, 59, 999);
        }

        for(let i=0; i<msTitles.length; i++) {
            const amt = parseFloat(msAmounts[i].value) || 0;
            const pct = parseFloat(msPercents[i] ? msPercents[i].value : 0) || 0;
            totalCheck += amt;
            totalPercentCheck += pct;
            const dLineStr = msDeadlines[i].value;
            const itemDate = new Date(dLineStr);
            
            // --- CHECK LỖI: VƯỢT DEADLINE ---
            if (projectDeadline && itemDate > projectDeadline) {
                if(errorDiv) {
                    errorDiv.innerHTML = `<strong>Lỗi:</strong> Giai đoạn ${i+1} (${dLineStr}) vượt quá hạn chót dự án (${deadlineElement.value}).<br>Vui lòng chọn ngày sớm hơn.`;
                    errorDiv.style.display = 'block';
                }
                return; // Chặn gửi ngay lập tức
            }

            const diff = Math.ceil((itemDate - new Date()) / (86400000));
            if (diff > maxDays) maxDays = diff;

            milestones.push({ 
                title: msTitles[i].value, 
                amount: amt, 
                percent: pct,
                deadline: dLineStr 
            });
        }
        
        // Kiểm tra tổng phần trăm
        if (Math.abs(totalPercentCheck - 100) > 0.5) {
            if(errorDiv) {
                errorDiv.textContent = `Tổng tỉ lệ chia mốc phải là 100%. Hiện tại là ${totalPercentCheck.toFixed(1)}%.`;
                errorDiv.style.display = 'block';
            }
            return;
        }

        if (Math.abs(totalCheck - price) > 1000) {
            if(errorDiv) {
                errorDiv.textContent = `Tổng tiền các mốc (${formatCurrency(totalCheck)}) không khớp giá thầu.`;
                errorDiv.style.display = 'block';
            }
            return;
        }

        const fullCoverLetter = `${coverLetter}\n\nDATA_JSON:${JSON.stringify(milestones)}`;
        const bidData = {
            price: price,
            timeline_days: maxDays > 0 ? maxDays : 7,
            cover_letter: fullCoverLetter,
            milestones: milestones
        };

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';
        
        try {
            const token = localStorage.getItem('access_token');
            let url = `${API_BASE}/api/v1/projects/${projectId}/bids`;
            let method = 'POST';

            if (state.currentBidId) {
                url = `${API_BASE}/api/v1/projects/${projectId}/bids/${state.currentBidId}`;
                method = 'PUT';
            }

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(bidData)
            });

            if (response.ok) {
                alert(state.currentBidId ? 'Cập nhật thành công!' : 'Gửi thầu thành công!');
                closeBidModal();
                // Tải lại để cập nhật nút bấm nếu cần
                // loadProjects(); 
            } else {
                // Nếu là 404 khi PUT /bids/{id}: có thể id lệch -> refetch và retry
                if (response.status === 404 && method === 'PUT') {
                    state.currentBidId = null;
                    try {
                        const tokenR = localStorage.getItem('access_token');
                        const meResp = await fetch(`${API_BASE}/api/v1/auth/me`, { headers: { 'Authorization': `Bearer ${tokenR}` } });
                        const me = meResp.ok ? await meResp.json() : null;
                        const listResp = await fetch(`${API_BASE}/api/v1/projects/${projectId}/bids`, { headers: { 'Authorization': `Bearer ${tokenR}` } });
                        const bids = listResp.ok ? await listResp.json() : [];
                        const my = me ? bids.find(b => b.freelancer_id === me.id) : null;
                        if (my) {
                            state.currentBidId = my.id;
                            const retry = await fetch(`${API_BASE}/api/v1/projects/${projectId}/bids/${state.currentBidId}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenR}` },
                                body: JSON.stringify(bidData)
                            });
                            if (retry.ok) {
                                alert('Cập nhật thành công!');
                                closeBidModal();
                                return;
                            }
                        }
                    } catch(_) {}
                }

                const errText = await response.text().catch(()=>'');
                let errMsg = 'Lỗi server';
                try {
                    const errJson = JSON.parse(errText);
                    errMsg = errJson.detail || errMsg;
                } catch(_) {
                    errMsg = errText || errMsg;
                }
                throw new Error(errMsg);
            }
        } catch (error) {
            if(errorDiv) {
                errorDiv.textContent = 'Lỗi: ' + error.message;
                errorDiv.style.display = 'block';
            }
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi Thầu';
        }
    }

    async function openBidModal(projectId) {
        const project = state.projects.find(p => p.id === parseInt(projectId));
        if (!project) return alert('Không tìm thấy dự án.');

        const token = localStorage.getItem('access_token');
        if (!token) {
            alert('Vui lòng đăng nhập.');
            return window.location.href = 'login.html';
        }

        // Reset trạng thái
        state.currentBidId = null;
        const submitBtn = document.getElementById('submitBidBtn');
        const modalTitle = document.querySelector('#bidModal h2');
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi Thầu';
        modalTitle.textContent = "Nộp thầu dự án";
        // Remove withdraw button if exists (from previous edit mode)
        const oldWithdraw = document.getElementById('withdrawBidBtn');
        if (oldWithdraw && oldWithdraw.parentElement) {
            oldWithdraw.parentElement.removeChild(oldWithdraw);
        }
        
        document.getElementById('bidProjectId').value = projectId;
        if(document.getElementById('bidProjectDeadline')) 
            document.getElementById('bidProjectDeadline').value = project.deadline || '';

        // Hiển thị thông tin dự án
        document.getElementById('bidProjectInfo').innerHTML = `
            <div class="bid-project-card">
                <h3>${project.title}</h3>
                <p class="bid-project-description">${truncate(project.description || '', 200)}</p>
                <div class="bid-project-meta"><span>${formatCurrency(project.budget)}</span></div>
            </div>
        `;

        // CHECK XEM ĐÃ BID CHƯA
        try {
            // Lấy hồ sơ thầu của chính mình (server đảm bảo đúng tài khoản)
            const myBidResp = await fetch(`${API_BASE}/api/v1/projects/${projectId}/bids/me`, { headers: {'Authorization': `Bearer ${token}`} });
            if (myBidResp.ok) {
                const myBid = await myBidResp.json();
                // --> CHUYỂN SANG CHẾ ĐỘ EDIT
                console.log("Found existing bid:", myBid);
                state.currentBidId = myBid.id;
                modalTitle.textContent = "Chỉnh sửa hồ sơ thầu";
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Cập nhật hồ sơ';
                // Add withdraw button for freelancer
                try {
                    const bar = submitBtn.parentElement;
                    if (bar && !document.getElementById('withdrawBidBtn')) {
                        const w = document.createElement('button');
                        w.id = 'withdrawBidBtn';
                        w.type = 'button';
                        w.className = 'btn btn-outline';
                        w.innerHTML = '<i class=\"fas fa-times\"></i> Rút hồ sơ';
                        w.onclick = async function () {
                            if (!confirm('Bạn chắc chắn muốn rút hồ sơ thầu?')) return;
                            const tk = localStorage.getItem('access_token');
                            try {
                                const delResp = await fetch(`${API_BASE}/api/v1/projects/${projectId}/bids/me`, {
                                    method: 'DELETE',
                                    headers: { 'Authorization': `Bearer ${tk}` }
                                });
                                if (delResp.status === 204) {
                                    alert('Đã rút hồ sơ thầu.');
                                    state.currentBidId = null;
                                    closeBidModal();
                                } else {
                                    const errText = await delResp.text().catch(()=> '');
                                    let msg = 'Không thể rút hồ sơ.';
                                    try { const j = JSON.parse(errText); if (j.detail) msg = j.detail; } catch(_) { if (errText) msg = errText; }
                                    alert(msg);
                                }
                            } catch (e) {
                                alert('Lỗi kết nối. Không thể rút hồ sơ.');
                            }
                        };
                        bar.appendChild(w);
                    }
                } catch (_) {}
                
                // Fill dữ liệu cũ
                document.getElementById('bidPrice').value = myBid.price;
                
                // Bóc tách JSON milestones từ cover letter
                let milestonesData = null;
                let cleanCoverLetter = myBid.cover_letter;
                
                // Ưu tiên dùng cột milestones nếu có
                if (Array.isArray(myBid.milestones) && myBid.milestones.length) {
                    milestonesData = myBid.milestones;
                } else if (myBid.cover_letter && myBid.cover_letter.includes("DATA_JSON:")) {
                    const parts = myBid.cover_letter.split("DATA_JSON:");
                    cleanCoverLetter = parts[0].trim();
                    try {
                        milestonesData = JSON.parse(parts[1].trim());
                    } catch(e) { console.error("Parse JSON fail", e); }
                }
                
                document.getElementById('bidCoverLetter').value = cleanCoverLetter;
                
                // Generate milestones với dữ liệu cũ
                generateMilestones(milestonesData);
            } else {
                // Fallback: nếu 404 từ /bids/me, thử lấy danh sách bids và khớp theo user id
                if (myBidResp.status === 404) {
                    try {
                        const meResp = await fetch(`${API_BASE}/api/v1/auth/me`, { headers: {'Authorization': `Bearer ${token}`} });
                        const me = meResp.ok ? await meResp.json() : null;
                        const listResp = await fetch(`${API_BASE}/api/v1/projects/${projectId}/bids`, { headers: {'Authorization': `Bearer ${token}`} });
                        const list = listResp.ok ? await listResp.json() : [];
                        const myBid = me ? list.find(function(b){ return b.freelancer_id === me.id; }) : null;
                        if (myBid) {
                            // --> CHUYỂN SANG CHẾ ĐỘ EDIT
                            console.log("Found existing bid via fallback:", myBid);
                            state.currentBidId = myBid.id;
                            modalTitle.textContent = "Chỉnh sửa hồ sơ thầu";
                            submitBtn.innerHTML = '<i class="fas fa-save"></i> Cập nhật hồ sơ';
                            // Add withdraw button (fallback branch)
                            try {
                                const bar = submitBtn.parentElement;
                                if (bar && !document.getElementById('withdrawBidBtn')) {
                                    const w = document.createElement('button');
                                    w.id = 'withdrawBidBtn';
                                    w.type = 'button';
                                    w.className = 'btn btn-outline';
                                    w.innerHTML = '<i class=\"fas fa-times\"></i> Rút hồ sơ';
                                    w.onclick = async function () {
                                        if (!confirm('Bạn chắc chắn muốn rút hồ sơ thầu?')) return;
                                        const tk = localStorage.getItem('access_token');
                                        try {
                                            const delResp = await fetch(`${API_BASE}/api/v1/projects/${projectId}/bids/me`, {
                                                method: 'DELETE',
                                                headers: { 'Authorization': `Bearer ${tk}` }
                                            });
                                            if (delResp.status === 204) {
                                                alert('Đã rút hồ sơ thầu.');
                                                state.currentBidId = null;
                                                closeBidModal();
                                            } else {
                                                const errText = await delResp.text().catch(()=> '');
                                                let msg = 'Không thể rút hồ sơ.';
                                                try { const j = JSON.parse(errText); if (j.detail) msg = j.detail; } catch(_) { if (errText) msg = errText; }
                                                alert(msg);
                                            }
                                        } catch (e) {
                                            alert('Lỗi kết nối. Không thể rút hồ sơ.');
                                        }
                                    };
                                    bar.appendChild(w);
                                }
                            } catch (_) {}
                            
                            document.getElementById('bidPrice').value = myBid.price;
                            let milestonesData = null;
                            let cleanCoverLetter = myBid.cover_letter;
                            if (Array.isArray(myBid.milestones) && myBid.milestones.length) {
                                milestonesData = myBid.milestones;
                            } else if (myBid.cover_letter && myBid.cover_letter.includes("DATA_JSON:")) {
                                const parts = myBid.cover_letter.split("DATA_JSON:");
                                cleanCoverLetter = parts[0].trim();
                                try { milestonesData = JSON.parse(parts[1].trim()); } catch(e) {}
                            }
                            document.getElementById('bidCoverLetter').value = cleanCoverLetter;
                            generateMilestones(milestonesData);
                        } else {
                            // --> CHẾ ĐỘ TẠO MỚI
                            document.getElementById('bidForm').reset();
                            generateMilestones(); // Tạo mặc định
                        }
                    } catch (_e) {
                        // --> CHẾ ĐỘ TẠO MỚI
                        document.getElementById('bidForm').reset();
                        generateMilestones(); // Tạo mặc định
                    }
                } else {
                    // --> CHẾ ĐỘ TẠO MỚI
                    document.getElementById('bidForm').reset();
                    generateMilestones(); // Tạo mặc định
                }
            }
        } catch (e) {
            console.error("Error checking existing bid", e);
        }

        bindBidModalEvents();
        document.getElementById('bidModal').style.display = 'flex';
    }

    function closeBidModal() {
        document.getElementById('bidModal').style.display = 'none';
        document.getElementById('bidForm').reset();
    }

    async function handleBidSubmit(event) {
        event.preventDefault();
        const errorDiv = document.getElementById('bidErrorMessage');
        const submitBtn = document.getElementById('submitBidBtn');
        const price = parseFloat(document.getElementById('bidPrice').value);
        const coverLetter = document.getElementById('bidCoverLetter').value.trim();
        const projectId = document.getElementById('bidProjectId').value;

        // Validation (như cũ)
        if (!price || price <= 0) return alert('Giá không hợp lệ');
        if (coverLetter.length < 20) return alert('Thư ngỏ quá ngắn');

        // Thu thập Milestone
        const msTitles = document.querySelectorAll('.ms-title');
        const msAmounts = document.querySelectorAll('.ms-amount');
        const msDeadlines = document.querySelectorAll('.ms-deadline');
        
        const milestones = [];
        let maxDays = 0;
        let totalCheck = 0;

        for(let i=0; i<msTitles.length; i++) {
            const amt = parseFloat(msAmounts[i].value) || 0;
            totalCheck += amt;
            const dLine = msDeadlines[i].value;
            
            const diff = Math.ceil((new Date(dLine) - new Date()) / (86400000));
            if (diff > maxDays) maxDays = diff;

            milestones.push({ title: msTitles[i].value, amount: amt, deadline: dLine });
        }

        if (Math.abs(totalCheck - price) > 1000) {
            errorDiv.textContent = `Tổng tiền milestone (${formatCurrency(totalCheck)}) không khớp giá thầu.`;
            errorDiv.style.display = 'block';
            return;
        }

        // Đóng gói data
        const fullCoverLetter = `${coverLetter}\n\nDATA_JSON:${JSON.stringify(milestones)}`;
        const bidData = {
            price: price,
            timeline_days: maxDays > 0 ? maxDays : 7,
            cover_letter: fullCoverLetter,
            milestones: milestones
        };

        submitBtn.disabled = true;
        
        try {
            const token = localStorage.getItem('access_token');
            let url = `${API_BASE}/api/v1/projects/${projectId}/bids`;
            let method = 'POST';

            // Nếu đang Edit -> Đổi URL và Method
            if (state.currentBidId) {
                url = `${API_BASE}/api/v1/projects/${projectId}/bids/me`;
                method = 'PUT';
            }

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(bidData)
            });

            if (response.ok) {
                alert(state.currentBidId ? 'Cập nhật thành công!' : 'Gửi thầu thành công!');
                closeBidModal();
                // Reload lại list để cập nhật UI nếu cần
            } else {
                // Nếu là 404 khi PUT /bids/me: chưa có hồ sơ thầu cho dự án này dưới tài khoản hiện tại
                if (response.status === 404 && method === 'PUT') {
                    state.currentBidId = null;
                    const modalTitleNow = document.querySelector('#bidModal h2');
                    const submitBtnNow = document.getElementById('submitBidBtn');
                    if (modalTitleNow) modalTitleNow.textContent = "Nộp thầu dự án";
                    if (submitBtnNow) submitBtnNow.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi Thầu';
                    const errTextLocal = await response.text().catch(()=>'');                    
                    let errMsgLocal = 'Không tìm thấy hồ sơ thầu của bạn cho dự án này. Vui lòng gửi mới.';
                    try {
                        const errJson = JSON.parse(errTextLocal);
                        if (errJson.detail) errMsgLocal = errJson.detail;
                    } catch(_) {}
                    throw new Error(errMsgLocal);
                }

                const errText = await response.text().catch(()=>'');
                let errMsg = 'Lỗi server';
                try {
                    const errJson = JSON.parse(errText);
                    errMsg = errJson.detail || errMsg;
                } catch(_) {
                    errMsg = errText || errMsg;
                }
                throw new Error(errMsg);
            }
        } catch (error) {
            alert('Có lỗi xảy ra: ' + error.message);
        } finally {
            submitBtn.disabled = false;
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        init();
        if (elements.list) elements.list.addEventListener('click', handleListClick);
        
        const bidForm = document.getElementById('bidForm');
        if (bidForm) bidForm.addEventListener('submit', handleBidSubmit);
        
        const closeBtn = document.getElementById('closeBidModal');
        if (closeBtn) closeBtn.addEventListener('click', closeBidModal);
        
        const cancelBtn = document.getElementById('cancelBidBtn');
        if (cancelBtn) cancelBtn.addEventListener('click', closeBidModal);
    });
})();