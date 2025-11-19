var API_BASE = window.API_BASE || window.location.origin;

(function () {
    let currentUser = null;

    function ensureFreelancer(user) {
        if (!user || !user.role) return false;
        const role = typeof user.role === 'string'
            ? user.role.toLowerCase()
            : (user.role.value || user.role.name || '').toLowerCase();
        return role === 'freelancer';
    }

    function formatCurrency(amount) {
        if (!amount && amount !== 0) return 'Thỏa thuận';
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            maximumFractionDigits: 0
        }).format(amount);
    }

    function formatDate(dateString) {
        if (!dateString) return 'Chưa rõ';
        try {
            return new Date(dateString).toLocaleDateString('vi-VN');
        } catch {
            return dateString;
        }
    }

    function renderOrders(containerId, orders, type) {
        const container = document.getElementById(containerId);
        const countLabel = document.getElementById(type === 'active' ? 'activeCount' : 'pendingCount');
        if (!container || !countLabel) return;

        countLabel.textContent = `${orders.length} đơn hàng`;

        if (!orders.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas ${type === 'active' ? 'fa-clipboard-check' : 'fa-inbox'}"></i>
                    <p>${type === 'active'
                        ? 'Chưa có đơn hàng nào được giao.'
                        : 'Chưa có đơn hàng apply nào đang chờ duyệt.'}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = orders.map(entry => {
            const project = entry.project;
            const statusLabel = (project.status || '').replace(/_/g, ' ').toLowerCase();
            const pillsClass = entry.order_state === 'active' ? 'pill-success' : 'pill-warning';
            const workspaceLink = `workspace.html?project_id=${project.id}`;

            return `
                <article class="order-card ${entry.order_state}">
                    <header>
                        <div>
                            <h3>${project.title}</h3>
                            <p>${project.category || 'Danh mục khác'}</p>
                        </div>
                        <span class="order-pill ${pillsClass}">
                            ${entry.order_state === 'active' ? 'Đang tham gia' : 'Chờ duyệt'}
                        </span>
                    </header>
                    <p class="order-description">${project.description || 'Chưa có mô tả chi tiết.'}</p>
                    <div class="order-meta">
                        <span><i class="fas fa-money-bill-wave"></i> ${formatCurrency(project.budget)} (${project.budget_type})</span>
                        <span><i class="fas fa-calendar"></i> Đăng ngày ${formatDate(project.created_at)}</span>
                        <span><i class="fas fa-hourglass-half"></i> Timeline đề xuất: ${entry.bid_timeline_days} ngày</span>
                    </div>
                    <footer>
                        <div class="order-status">
                            <small>Trạng thái dự án:</small>
                            <strong>${statusLabel}</strong>
                        </div>
                        <div class="order-actions">
                            <a class="btn btn-outline btn-small" href="browse_projects.html">
                                <i class="fas fa-briefcase"></i> Tìm thêm việc
                            </a>
                            <a class="btn btn-primary btn-small" href="${workspaceLink}">
                                <i class="fas fa-door-open"></i> Vào workspace
                            </a>
                        </div>
                    </footer>
                </article>
            `;
        }).join('');
    }

    async function loadOrders() {
        const token = getToken();
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        currentUser = getCurrentUserProfile();
        if (!currentUser) {
            currentUser = await fetchCurrentUser();
        }

        if (!ensureFreelancer(currentUser)) {
            window.location.href = 'orders.html';
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/v1/projects/freelancers/${currentUser.id}/orders`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Không thể tải thông tin đơn hàng');
            }

            const orders = await response.json();
            const activeOrders = orders.filter(order => order.order_state === 'active');
            const pendingOrders = orders.filter(order => order.order_state === 'pending');

            renderOrders('activeOrders', activeOrders, 'active');
            renderOrders('pendingOrders', pendingOrders, 'pending');
        } catch (error) {
            console.error(error);
            ['activeOrders', 'pendingOrders'].forEach(id => {
                const container = document.getElementById(id);
                if (container) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-triangle-exclamation"></i>
                            <p>${error.message || 'Không thể tải dữ liệu.'}</p>
                        </div>
                    `;
                }
            });
        }
    }

    document.addEventListener('DOMContentLoaded', loadOrders);
})();

