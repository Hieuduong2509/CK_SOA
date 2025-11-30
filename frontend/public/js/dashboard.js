// API_BASE is defined in config.js (must load config.js first)
var API_BASE = window.API_BASE || window.location.origin;

const serviceManager = {
    userId: null,
    services: [],
    modalStep: 1,
    mode: 'create',
    editingId: null,
    formData: {
        cover_image: '',
        gallery: []
    }
};

async function authedJson(path, options = {}) {
    const token = getToken();
    if (!token) {
        throw new Error('Bạn cần đăng nhập lại');
    }
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {})
    };
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });
    if (!response.ok) {
        let detail = 'Request failed';
        try {
            const errorData = await response.json();
            // Nếu detail là object, stringify nó để có thể parse lại sau
            if (typeof errorData.detail === 'object') {
                detail = JSON.stringify(errorData.detail);
            } else {
                detail = errorData.detail || errorData.message || JSON.stringify(errorData);
            }
        } catch {
            detail = response.statusText;
        }
        throw new Error(detail);
    }
    if (response.status === 204) {
        return null;
    }
    return response.json();
}

async function loadWallet() {
    const balanceEl = document.getElementById('balance');
    const walletBalanceEl = document.getElementById('walletBalance');
    const availableBalanceEl = document.getElementById('availableBalance');
    const modalBalanceEl = document.getElementById('modalAvailableBalance');
    
    try {
        const token = getToken();
        if (!token) return;
        
        const response = await fetch(`${API_BASE}/api/v1/payments/wallet`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (response.ok) {
            const wallet = await response.json();
            const balance = wallet.balance || 0;
            const formattedBalance = formatCurrency(balance);
            
            if (balanceEl) balanceEl.textContent = formattedBalance;
            if (walletBalanceEl) walletBalanceEl.textContent = formattedBalance;
            if (availableBalanceEl) availableBalanceEl.textContent = formattedBalance;
            if (modalBalanceEl) modalBalanceEl.textContent = formattedBalance;
        }
    } catch (error) {
        console.error('Error loading wallet:', error);
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

async function loadTransactionHistory() {
    const container = document.getElementById('transactionHistory');
    if (!container) return;
    
    try {
        const token = getToken();
        if (!token) {
            container.innerHTML = '<div class="empty-state small"><p>Chưa đăng nhập</p></div>';
            return;
        }
        
        const response = await fetch(`${API_BASE}/api/v1/payments/history?limit=20`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Không thể tải lịch sử giao dịch');
        }
        
        const transactions = await response.json();
        
        if (!transactions || transactions.length === 0) {
            container.innerHTML = '<div class="empty-state small"><i class="fas fa-receipt"></i><p>Chưa có giao dịch nào</p></div>';
            updatePaymentStats([]);
            return;
        }
        
        // Calculate stats
        updatePaymentStats(transactions);
        
        // Render transactions
        container.innerHTML = transactions.map(tx => {
            const isIncome = tx.transaction_type === 'ESCROW_RELEASE' || tx.transaction_type === 'DEPOSIT';
            const isWithdraw = tx.transaction_type === 'WITHDRAW';
            const amountClass = isIncome ? 'color: var(--success-color);' : isWithdraw ? 'color: var(--danger-color);' : '';
            const icon = isIncome ? 'fa-arrow-down' : isWithdraw ? 'fa-arrow-up' : 'fa-exchange-alt';
            const statusClass = tx.status === 'COMPLETED' ? 'status-success' : tx.status === 'PENDING' ? 'status-pending' : 'status-failed';
            
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid var(--border-color);">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
                            <i class="fas ${icon}" style="color: var(--primary-color);"></i>
                            <div>
                                <div style="font-weight: 600;">${getTransactionTypeLabel(tx.transaction_type)}</div>
                                <div style="font-size: 0.85rem; color: var(--text-secondary);">
                                    ${tx.description || 'Không có mô tả'}
                                </div>
                            </div>
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">
                            ${new Date(tx.created_at).toLocaleString('vi-VN')}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 1.1rem; font-weight: 700; ${amountClass}">
                            ${isIncome ? '+' : '-'}${formatCurrency(Math.abs(tx.amount))}
                        </div>
                        <span class="status-tag ${statusClass}" style="font-size: 0.75rem; margin-top: 0.25rem; display: inline-block;">
                            ${getStatusLabel(tx.status)}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading transaction history:', error);
        const container = document.getElementById('transactionHistory');
        if (container) {
            container.innerHTML = `<div class="empty-state small text-danger"><p>Lỗi: ${error.message}</p></div>`;
        }
    }
}

function getTransactionTypeLabel(type) {
    const labels = {
        'DEPOSIT': 'Nạp tiền',
        'WITHDRAW': 'Rút tiền',
        'ESCROW_DEPOSIT': 'Ký quỹ',
        'ESCROW_RELEASE': 'Nhận thanh toán',
        'REFUND': 'Hoàn tiền'
    };
    return labels[type] || type;
}

function getStatusLabel(status) {
    const labels = {
        'PENDING': 'Đang xử lý',
        'COMPLETED': 'Thành công',
        'FAILED': 'Thất bại',
        'CANCELLED': 'Đã hủy'
    };
    return labels[status] || status;
}

function updatePaymentStats(transactions) {
    let totalEarnings = 0;
    let totalWithdrawn = 0;
    
    transactions.forEach(tx => {
        if (tx.transaction_type === 'ESCROW_RELEASE' && tx.status === 'COMPLETED') {
            totalEarnings += tx.amount;
        } else if (tx.transaction_type === 'WITHDRAW' && tx.status === 'COMPLETED') {
            totalWithdrawn += tx.amount;
        }
    });
    
    const totalEarningsEl = document.getElementById('totalEarnings');
    const totalWithdrawnEl = document.getElementById('totalWithdrawn');
    
    if (totalEarningsEl) {
        totalEarningsEl.textContent = formatCurrency(totalEarnings);
    }
    if (totalWithdrawnEl) {
        totalWithdrawnEl.textContent = formatCurrency(totalWithdrawn);
    }
}

function renderUserHeader(user) {
    const greetingEl = document.getElementById('userGreeting');
    const subtitleEl = document.getElementById('userSubtitle');
    if (greetingEl) greetingEl.textContent = `Xin chào, ${user.name}`;
    if (subtitleEl) subtitleEl.textContent = user.headline || `Đăng nhập với vai trò ${user.role}`;
}

function renderClientMeta(user) {
    const metaEl = document.getElementById('userMeta');
    if (!metaEl) return;
    metaEl.innerHTML = `
        <div>
            <strong>Email</strong>
            <p>${user.email}</p>
        </div>
        <div>
            <strong>Số điện thoại</strong>
            <p>${user.phone || 'Chưa cập nhật'}</p>
        </div>
        <div>
            <strong>Vai trò</strong>
            <p>${user.role}</p>
        </div>
    `;
}

function renderFreelancerMeta(profile) {
    const metaEl = document.getElementById('freelancerMeta');
    if (!metaEl) return;
    metaEl.innerHTML = `
        <div>
            <strong>Email</strong>
            <p>${profile.email || '—'}</p>
        </div>
        <div>
            <strong>Số điện thoại</strong>
            <p>${profile.phone || '—'}</p>
        </div>
        <div>
            <strong>Kỹ năng</strong>
            <p>${(profile.skills || []).join(', ') || '—'}</p>
        </div>
        <div>
            <strong>Danh hiệu</strong>
            <p>${(profile.badges || []).join(', ') || '—'}</p>
        </div>
        <div>
            <strong>Ngôn ngữ</strong>
            <p>${(profile.languages || []).join(', ') || '—'}</p>
        </div>
        <div>
            <strong>Mức giá mỗi giờ</strong>
            <p>${profile.hourly_rate ? `$${profile.hourly_rate}/h` : '—'}</p>
        </div>
    `;
}

function renderProjectsList(projects) {
    const listEl = document.getElementById('projectsList');
    if (!listEl) return;
    if (!projects.length) {
        listEl.innerHTML = '<p style="color: var(--text-secondary);">Chưa có dự án nào.</p>';
        return;
    }
    listEl.innerHTML = projects.map(project => `
        <div style="background: white; padding: 1.5rem; border-radius: var(--radius-xl); box-shadow: var(--shadow-sm); margin-bottom: 1rem;">
            <h3 style="margin-bottom: 0.5rem;">${project.title}</h3>
            <p style="color: var(--text-secondary); margin-bottom: 0.75rem;">${project.description}</p>
            <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; font-size: 0.875rem; color: var(--text-secondary);">
                <span>Ngân sách: $${project.budget}</span>
                <span>Loại: ${project.budget_type}</span>
                <span>Trạng thái: ${project.status}</span>
            </div>
        </div>
    `).join('');
}

function renderArticles(articles) {
    const articlesEl = document.getElementById('articlesList');
    if (!articlesEl) return;
    if (!articles.length) {
        articlesEl.innerHTML = '<p style="color: var(--text-secondary);">Chưa có bài viết nào.</p>';
        return;
    }
    articlesEl.innerHTML = articles.map(article => `
        <div style="background: var(--bg-white); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1rem;">
            <h3 style="margin-bottom: 0.5rem;">${article.title}</h3>
            <p style="color: var(--text-secondary); margin-bottom: 0.75rem;">${article.content || ''}</p>
            <div style="color: var(--text-secondary); font-size: 0.875rem;">${(article.tags || []).map(tag => `#${tag}`).join(' ')}</div>
        </div>
    `).join('');
}

async function fetchProjectsForUser(user) {
    try {
        let url = `${API_BASE}/api/v1/projects`;
        if (user.role === 'client') {
            url += `?client_id=${user.id}`;
        } else if (user.role === 'freelancer') {
            url += `?freelancer_id=${user.id}`;
        }
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('fetchProjectsForUser error', error);
    }
    return [];
}

async function fetchFreelancerProfile(userId) {
    try {
        const response = await fetch(`${API_BASE}/api/v1/users/${userId}`);
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('fetchFreelancerProfile error', error);
    }
    return null;
}

async function fetchFreelancerArticles(userId) {
    try {
        const response = await fetch(`${API_BASE}/api/v1/users/${userId}/articles`);
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('fetchFreelancerArticles error', error);
    }
    return [];
}

async function handleCreateArticle(userId) {
    const title = prompt('Tiêu đề bài viết');
    if (!title) return;
    const content = prompt('Nội dung bài viết (có thể bỏ trống)');
    try {
        const response = await fetch(`${API_BASE}/api/v1/users/${userId}/articles`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, content })
        });
        if (response.ok) {
            const article = await response.json();
            const articles = await fetchFreelancerArticles(userId);
            renderArticles(articles);
        }
    } catch (error) {
        console.error('handleCreateArticle error', error);
    }
}

async function loadDashboard() {
    let user = getCurrentUserProfile();
    if (!user) {
        user = await fetchCurrentUser();
    }
    if (!user) {
        clearToken();
        window.location.href = 'login.html';
        return;
    }

    renderUserHeader(user);
    await loadWallet();
    await loadTransactionHistory();

    const projects = await fetchProjectsForUser(user);
    renderProjectsList(projects);

    if (user.role === 'client') {
        renderClientMeta(user);
    }

    if (user.role === 'freelancer') {
        const profile = await fetchFreelancerProfile(user.id);
        if (profile) {
            renderFreelancerMeta(profile);
            const viewProfileBtn = document.getElementById('viewProfileButton');
            if (viewProfileBtn) {
                viewProfileBtn.href = `freelancer_profile.html?id=${user.id}`;
            }
        }
        const articles = await fetchFreelancerArticles(user.id);
        renderArticles(articles);
        const createBtn = document.getElementById('createArticleButton');
        if (createBtn) {
            createBtn.addEventListener('click', () => handleCreateArticle(user.id));
        }
        initServiceManagement(user);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadDashboard);
} else {
    loadDashboard();
}

function initServiceManagement(user) {
    serviceManager.userId = user.id;
    bindServiceEvents();
    loadFreelancerServices();
    updateServiceLimitDisplay(user.id);
}

async function updateServiceLimitDisplay(userId) {
    try {
        const profile = await fetchFreelancerProfile(userId);
        if (!profile) return;
        
        const totalStars = (profile.rating || 0) * (profile.total_reviews || 0);
        const level = Math.max(1, Math.floor(totalStars / 100) + 1);
        
        // Tính giới hạn (giống logic backend)
        const baseLimit = 1;
        const levelBonus = Math.floor(level / 5) * 1;
        const levelLimit = baseLimit + levelBonus;
        const starBonus = Math.floor(totalStars / 25) * 1;
        const starLimit = baseLimit + starBonus;
        const serviceLimit = Math.min(Math.max(levelLimit, starLimit), 10);
        
        // Đếm số service hiện tại (không bao gồm draft)
        const services = serviceManager.services || [];
        const currentCount = services.filter(s => s.status !== 'draft').length;
        
        // Cập nhật header
        const headerDiv = document.querySelector('#serviceManagerCard .dashboard-card-header > div');
        if (headerDiv) {
            const existingLimit = headerDiv.querySelector('.service-limit-info');
            if (existingLimit) {
                existingLimit.remove();
            }
            
            const limitInfo = document.createElement('div');
            limitInfo.className = 'service-limit-info';
            limitInfo.style.cssText = 'margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-secondary);';
            
            const isNearLimit = currentCount >= serviceLimit * 0.8;
            const color = isNearLimit ? (currentCount >= serviceLimit ? 'var(--danger)' : 'var(--warning)') : 'var(--text-secondary)';
            
            limitInfo.innerHTML = `
                <span style="color: ${color};">
                    <i class="fas fa-${currentCount >= serviceLimit ? 'lock' : 'chart-line'}"></i>
                    ${currentCount}/${serviceLimit} gói dịch vụ
                </span>
                ${currentCount >= serviceLimit ? `
                    <span style="margin-left: 0.5rem; color: var(--primary);">
                        <i class="fas fa-info-circle"></i>
                        Nâng cấp level hoặc số sao để mở khóa thêm slot!
                    </span>
                ` : ''}
            `;
            headerDiv.appendChild(limitInfo);
        }
    } catch (error) {
        console.error('updateServiceLimitDisplay error:', error);
    }
}

function bindServiceEvents() {
    const createBtn = document.getElementById('createServiceBtn');
    const modal = document.getElementById('serviceModal');
    if (!modal) {
        return;
    }
    createBtn?.addEventListener('click', () => openServiceModal('create'));
    document.getElementById('closeServiceModalBtn')?.addEventListener('click', closeServiceModal);
    document.getElementById('servicePrevStepBtn')?.addEventListener('click', () => changeServiceStep(serviceManager.modalStep - 1));
    document.getElementById('serviceNextStepBtn')?.addEventListener('click', () => changeServiceStep(serviceManager.modalStep + 1));
    document.getElementById('saveServiceDraftBtn')?.addEventListener('click', saveServiceDraft);
    document.getElementById('submitServiceForReviewBtn')?.addEventListener('click', submitCurrentService);
    document.getElementById('serviceCoverInput')?.addEventListener('change', handleCoverUpload);
    document.getElementById('serviceGalleryInput')?.addEventListener('change', handleGalleryUpload);
    document.querySelectorAll('.service-step-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const step = Number(btn.dataset.step);
            changeServiceStep(step);
        });
    });
}

function formatCurrency(value) {
    const amount = Number(value) || 0;
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0
    }).format(amount);
}

async function loadFreelancerServices() {
    const listEl = document.getElementById('serviceList');
    const emptyState = document.getElementById('servicesEmptyState');
    if (!listEl) return;
    listEl.innerHTML = `<div class="empty-state">Đang tải dữ liệu...</div>`;
    try {
        const response = await fetch(`${API_BASE}/api/v1/users/${serviceManager.userId}/packages?include_all=true`);
        const data = response.ok ? await response.json() : [];
        serviceManager.services = data || [];
        renderServiceList();
        // Cập nhật hiển thị giới hạn sau khi load services
        await updateServiceLimitDisplay(serviceManager.userId);
    } catch (error) {
        console.error('loadFreelancerServices', error);
        listEl.innerHTML = `<div class="empty-state text-danger">Không thể tải gói dịch vụ.</div>`;
        if (emptyState) emptyState.style.display = 'none';
    }
}

function renderServiceList() {
    const listEl = document.getElementById('serviceList');
    const emptyState = document.getElementById('servicesEmptyState');
    if (!listEl) return;
    if (!serviceManager.services.length) {
        listEl.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    if (emptyState) emptyState.style.display = 'none';
    listEl.innerHTML = serviceManager.services.map(renderServiceCard).join('');
    listEl.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', () => openServiceModal('edit', findServiceById(Number(btn.dataset.serviceId))));
    });
    listEl.querySelectorAll('[data-action="submit"]').forEach(btn => {
        btn.addEventListener('click', () => submitServiceForReview(Number(btn.dataset.serviceId)));
    });
}

function renderServiceCard(service) {
    const badge = renderServiceStatusBadge(service.status);
    const reasonBlock = service.rejection_reason ? `<p class="text-danger" style="font-size:0.85rem;">Lý do: ${service.rejection_reason}</p>` : '';
    const canSubmit = ['draft', 'rejected'].includes(service.status);
    const canEdit = service.status !== 'pending';
    return `
        <article class="service-card">
            <div class="service-card-header">
                <div>
                    <h3 style="margin:0;">${service.name || 'Chưa đặt tên'}</h3>
                    <p class="text-muted" style="font-size:0.85rem;">${service.category || 'Không có danh mục'}</p>
                </div>
                ${badge}
            </div>
            <div class="service-meta-grid">
                <span><strong>Giá:</strong> ${formatCurrency(service.price || 0)}</span>
                <span><strong>Giao hàng:</strong> ${service.delivery_days || 0} ngày</span>
                <span><strong>Chỉnh sửa:</strong> ${service.revisions || 0}</span>
            </div>
            ${reasonBlock}
            <div class="service-card-actions">
                ${canEdit ? `<button class="btn btn-secondary btn-small" data-action="edit" data-service-id="${service.id}">
                    <i class="fas fa-edit"></i> Chỉnh sửa
                </button>` : ''}
                ${canSubmit ? `<button class="btn btn-success btn-small" data-action="submit" data-service-id="${service.id}">
                    <i class="fas fa-paper-plane"></i> Gửi duyệt
                </button>` : ''}
            </div>
        </article>
    `;
}

function renderServiceStatusBadge(status) {
    const normalized = (status || '').toLowerCase();
    const labelMap = {
        draft: 'Bản nháp',
        pending: 'Chờ duyệt',
        approved: 'Đang hiển thị',
        rejected: 'Bị từ chối',
        hidden: 'Ẩn tạm thời'
    };
    return `<span class="service-status-badge ${normalized}">${labelMap[normalized] || normalized}</span>`;
}

function findServiceById(id) {
    return serviceManager.services.find(item => item.id === id);
}

function openServiceModal(mode = 'create', service = null) {
    serviceManager.mode = mode;
    serviceManager.editingId = service?.id || null;
    serviceManager.formData = {
        cover_image: service?.cover_image || '',
        gallery: service?.gallery ? [...service.gallery] : []
    };
    document.getElementById('serviceNameInput').value = service?.name || '';
    document.getElementById('serviceCategoryInput').value = service?.category || '';
    document.getElementById('serviceDescriptionInput').value = service?.description || '';
    document.getElementById('servicePriceInput').value = service?.price || '';
    document.getElementById('serviceDeliveryInput').value = service?.delivery_days || '';
    document.getElementById('serviceRevisionsInput').value = service?.revisions || 1;
    document.getElementById('serviceDeliverablesInput').value = (service?.deliverables || []).join('\n');
    document.getElementById('serviceRequirementsInput').value = (service?.requirements || []).map(item => item.question || item.label || item).join('\n');
    document.getElementById('serviceModalTitle').textContent = mode === 'create' ? 'Tạo gói dịch vụ' : 'Chỉnh sửa gói';
    document.getElementById('serviceModalSubtitle').textContent = mode === 'create'
        ? 'Điền thông tin chi tiết cho gói của bạn'
        : `Đang chỉnh sửa gói #${service?.id}`;
    renderServiceMediaPreview();
    changeServiceStep(1);
    const modal = document.getElementById('serviceModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeServiceModal() {
    const modal = document.getElementById('serviceModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function changeServiceStep(step) {
    if (step < 1 || step > 3) return;
    serviceManager.modalStep = step;
    document.querySelectorAll('.service-step-btn').forEach(btn => {
        btn.classList.toggle('active', Number(btn.dataset.step) === step);
    });
    document.querySelectorAll('.service-step-panel').forEach(panel => {
        panel.classList.toggle('active', Number(panel.dataset.stepPanel) === step);
    });
}

function collectServicePayload() {
    const deliverables = document.getElementById('serviceDeliverablesInput').value
        .split('\n').map(item => item.trim()).filter(Boolean);
    const requirements = document.getElementById('serviceRequirementsInput').value
        .split('\n').map(item => item.trim()).filter(Boolean)
        .map(question => ({ question }));
    return {
        name: document.getElementById('serviceNameInput').value.trim(),
        category: document.getElementById('serviceCategoryInput').value.trim(),
        description: document.getElementById('serviceDescriptionInput').value.trim(),
        price: Number(document.getElementById('servicePriceInput').value || 0),
        delivery_days: Number(document.getElementById('serviceDeliveryInput').value || 0),
        revisions: Number(document.getElementById('serviceRevisionsInput').value || 1),
        deliverables,
        requirements,
        cover_image: serviceManager.formData.cover_image,
        gallery: serviceManager.formData.gallery,
        tags: []
    };
}

async function saveServiceDraft() {
    const payload = collectServicePayload();
    try {
        let saved;
        if (serviceManager.mode === 'edit' && serviceManager.editingId) {
            saved = await authedJson(`/api/v1/users/${serviceManager.userId}/packages/${serviceManager.editingId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
        } else {
            saved = await authedJson(`/api/v1/users/${serviceManager.userId}/services`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            serviceManager.editingId = saved.id;
            serviceManager.mode = 'edit';
        }
        alert('Đã lưu gói dịch vụ.');
        await loadFreelancerServices();
        renderServiceMediaPreview();
    } catch (error) {
        // Xử lý lỗi giới hạn service
        try {
            const errorData = JSON.parse(error.message);
            if (errorData.current_limit !== undefined) {
                const nextTier = errorData.next_tier;
                const message = `${errorData.message}\n\n` +
                    `📊 Thống kê:\n` +
                    `- Level hiện tại: ${errorData.level}\n` +
                    `- Tổng sao: ${errorData.total_stars.toFixed(1)}\n` +
                    `- Giới hạn hiện tại: ${errorData.current_count}/${errorData.current_limit} gói\n\n` +
                    `🎯 Để mở khóa thêm ${nextTier.bonus} slot:\n` +
                    `- Đạt level ${nextTier.level} HOẶC\n` +
                    `- Đạt ${nextTier.stars} sao\n\n` +
                    `${errorData.hint}`;
                alert(message);
            } else {
                alert(`Không thể lưu gói: ${error.message}`);
            }
        } catch {
            alert(`Không thể lưu gói: ${error.message}`);
        }
    }
}

async function submitCurrentService() {
    if (!serviceManager.editingId) {
        await saveServiceDraft();
        if (!serviceManager.editingId) {
            return;
        }
    }
    try {
        await authedJson(`/api/v1/users/${serviceManager.userId}/packages/${serviceManager.editingId}/submit`, {
            method: 'POST'
        });
        alert('Đã gửi duyệt gói dịch vụ.');
        closeServiceModal();
        await loadFreelancerServices();
    } catch (error) {
        alert(`Không thể gửi duyệt: ${error.message}`);
    }
}

async function submitServiceForReview(serviceId) {
    if (!confirm('Gửi gói này cho admin duyệt?')) return;
    try {
        await authedJson(`/api/v1/users/${serviceManager.userId}/packages/${serviceId}/submit`, {
            method: 'POST'
        });
        alert('Đã gửi duyệt.');
        await loadFreelancerServices();
    } catch (error) {
        alert(`Không thể gửi duyệt: ${error.message}`);
    }
}

async function handleCoverUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
        const url = await uploadServiceFile(file);
        serviceManager.formData.cover_image = url;
        renderServiceMediaPreview();
    } catch (error) {
        alert(`Không thể tải ảnh bìa: ${error.message}`);
    }
}

async function handleGalleryUpload(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    try {
        for (const file of files.slice(0, 5)) {
            if (serviceManager.formData.gallery.length >= 5) break;
            const url = await uploadServiceFile(file);
            serviceManager.formData.gallery.push(url);
        }
        renderServiceMediaPreview();
    } catch (error) {
        alert(`Không thể tải media: ${error.message}`);
    }
}

async function uploadServiceFile(file) {
    const token = getToken();
    if (!token) throw new Error('Bạn cần đăng nhập lại');
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/api/v1/users/${serviceManager.userId}/packages/media`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Upload thất bại');
    }
    const data = await response.json();
    return data.url;
}

function renderServiceMediaPreview() {
    const coverEl = document.getElementById('serviceCoverPreview');
    const galleryEl = document.getElementById('serviceGalleryPreview');
    if (coverEl) {
        coverEl.innerHTML = serviceManager.formData.cover_image
            ? `<img src="${serviceManager.formData.cover_image}" alt="Cover">`
            : '<small>Chưa có ảnh bìa</small>';
    }
    if (galleryEl) {
        if (!serviceManager.formData.gallery.length) {
            galleryEl.innerHTML = '<small>Chưa có media</small>';
            return;
        }
        galleryEl.innerHTML = serviceManager.formData.gallery.map((url, index) => `
            <div class="service-gallery-item">
                ${url.match(/\\.mp4|\\.webm|\\.ogg/i)
                    ? `<video src="${url}" muted loop></video>`
                    : `<img src="${url}" alt="Gallery item">`}
                <button class="gallery-remove-btn" type="button" onclick="removeGalleryItem(${index})">&times;</button>
            </div>
        `).join('');
    }
}

function removeGalleryItem(index) {
    serviceManager.formData.gallery.splice(index, 1);
    renderServiceMediaPreview();
}

window.submitServiceForReview = submitServiceForReview;
window.removeGalleryItem = removeGalleryItem;

