// Requires config.js & auth.js before load
(function () {
    var API_BASE = window.API_BASE || window.location.origin;
    var state = {
        projects: [],
        filtered: [],
        currentBidId: null // Lưu ID bid nếu đang sửa
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
        const budgetValue = formatCurrency(project.budget);
        const skills = (project.skills_required || project.tags || []).slice(0, 6);
        const createdAt = project.created_at ? new Date(project.created_at).toLocaleDateString('vi-VN') : 'Chưa rõ';

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
                    <button class="btn btn-primary btn-small" data-action="bid" data-id="${project.id}"><i class="fas fa-paper-plane"></i> Ứng tuyển / Xem</button>
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
    }

    // --- CÁC HÀM XỬ LÝ MODAL & EDIT BID ---

    function bindBidModalEvents() {
        const priceInput = document.getElementById('bidPrice');
        const milestoneSelect = document.getElementById('milestoneCount');
        if (priceInput) priceInput.oninput = () => generateMilestones();
        if (milestoneSelect) milestoneSelect.onchange = () => generateMilestones();
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
                   '<div style="flex:1">Số tiền (VND)</div>' +
                   '<div style="flex:1">Ngày xong</div>' +
                   '</div>';

        const avgAmount = Math.floor(totalAmount / count);
        const remainder = totalAmount - (avgAmount * count); 

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

            const dateStr = targetDate.toISOString().split('T')[0];
            const maxDateStr = projectDeadline ? projectDeadline.toISOString().split('T')[0] : '';
            
            let amountVal = (i === count) ? (avgAmount + remainder) : avgAmount;
            let titleVal = `Giai đoạn ${i}`;

            if (existingData && existingData[i-1]) {
                const old = existingData[i-1];
                titleVal = old.title;
                amountVal = old.amount;
                dateStr = old.deadline;
            }

            // QUAN TRỌNG: Thêm thuộc tính max="..." để khóa lịch
            html += `
            <div class="milestone-row" style="display:flex; gap:10px; margin-bottom:10px;">
                <div style="flex:2">
                    <input type="text" class="ms-title" value="${titleVal}" placeholder="Tên công việc" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
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
        const msAmounts = document.querySelectorAll('.ms-amount');
        const msDeadlines = document.querySelectorAll('.ms-deadline');
        
        const milestones = [];
        let maxDays = 0;
        let totalCheck = 0;
        
        // Parse deadline dự án để kiểm tra chặt chẽ
        let projectDeadline = null;
        if (deadlineElement && deadlineElement.value) {
            projectDeadline = new Date(deadlineElement.value);
            // Reset giờ về cuối ngày để so sánh công bằng
            projectDeadline.setHours(23, 59, 59, 999);
        }

        for(let i=0; i<msTitles.length; i++) {
            const amt = parseFloat(msAmounts[i].value) || 0;
            totalCheck += amt;
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

            milestones.push({ title: msTitles[i].value, amount: amt, deadline: dLineStr });
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
            cover_letter: fullCoverLetter
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
                const errData = await response.json().catch(()=>({}));
                throw new Error(errData.detail || 'Lỗi server');
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
            // Lấy current user ID
            const userResp = await fetch(`${API_BASE}/api/v1/auth/me`, { headers: {'Authorization': `Bearer ${token}`} });
            const user = await userResp.json();
            
            // Lấy danh sách bid của dự án
            const bidsResp = await fetch(`${API_BASE}/api/v1/projects/${projectId}/bids`, { headers: {'Authorization': `Bearer ${token}`} });
            const bids = await bidsResp.json();
            
            const myBid = bids.find(b => b.freelancer_id === user.id);
            
            if (myBid) {
                // --> CHUYỂN SANG CHẾ ĐỘ EDIT
                console.log("Found existing bid:", myBid);
                state.currentBidId = myBid.id;
                modalTitle.textContent = "Chỉnh sửa hồ sơ thầu";
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Cập nhật hồ sơ';
                
                // Fill dữ liệu cũ
                document.getElementById('bidPrice').value = myBid.price;
                
                // Bóc tách JSON milestones từ cover letter
                let milestonesData = null;
                let cleanCoverLetter = myBid.cover_letter;
                
                if (myBid.cover_letter && myBid.cover_letter.includes("DATA_JSON:")) {
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
                // --> CHẾ ĐỘ TẠO MỚI
                document.getElementById('bidForm').reset();
                generateMilestones(); // Tạo mặc định
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
            cover_letter: fullCoverLetter
        };

        submitBtn.disabled = true;
        
        try {
            const token = localStorage.getItem('access_token');
            let url = `${API_BASE}/api/v1/projects/${projectId}/bids`;
            let method = 'POST';

            // Nếu đang Edit -> Đổi URL và Method
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
                // Reload lại list để cập nhật UI nếu cần
            } else {
                throw new Error('Lỗi server');
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