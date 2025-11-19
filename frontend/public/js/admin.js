// API_BASE is defined in config.js (must load config.js first)
var API_BASE = window.API_BASE || window.location.origin;

const adminState = {
    currentPanel: 'projects'
};

const ACCOUNT_ROLES = ['client', 'freelancer'];

document.addEventListener('DOMContentLoaded', initAdminDashboard);

async function initAdminDashboard() {
    redirectIfNotAuthenticated();
    const adminUser = await ensureAdminAccount();
    if (!adminUser) return;

    bindNavigation();
    bindRefreshButtons();
    document.getElementById('adminLogoutBtn')?.addEventListener('click', logout);

    await Promise.allSettled([
        loadPendingProjects(),
        loadAccounts('client'),
        loadAccounts('freelancer'),
        loadDisputes(),
        loadAnalytics()
    ]);
}

async function ensureAdminAccount() {
    let user = getCurrentUserProfile();
    if (!user) {
        user = await fetchCurrentUser();
    }

    if (!user) {
        logout();
        return null;
    }

    const role = normalizeRole(user.role);
    if (role !== 'admin') {
        alert('Bạn không có quyền truy cập trang quản trị.');
        window.location.href = 'index.html';
        return null;
    }

    const badge = document.getElementById('adminUserBadge');
    if (badge) {
        badge.querySelector('#adminName').textContent = user.name || 'Admin';
        const avatar = badge.querySelector('.avatar-placeholder');
        if (avatar) {
            avatar.textContent = (user.name || 'A').charAt(0).toUpperCase();
        }
    }
    return user;
}

function normalizeRole(role) {
    if (!role) return '';
    if (typeof role === 'string') return role.toLowerCase();
    if (typeof role === 'object') {
        return (role.value || role.name || '').toLowerCase();
    }
    return '';
}

function bindNavigation() {
    document.querySelectorAll('.admin-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-panel');
            switchPanel(target);
        });
    });
}

function switchPanel(panelName) {
    if (!panelName || adminState.currentPanel === panelName) return;
    adminState.currentPanel = panelName;
    document.querySelectorAll('.admin-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-panel') === panelName);
    });
    document.querySelectorAll('.admin-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `admin-panel-${panelName}`);
    });
}

function bindRefreshButtons() {
    document.getElementById('refreshProjectsBtn')?.addEventListener('click', loadPendingProjects);
    document.getElementById('refreshClientAccountsBtn')?.addEventListener('click', () => loadAccounts('client'));
    document.getElementById('refreshFreelancerAccountsBtn')?.addEventListener('click', () => loadAccounts('freelancer'));
    document.getElementById('refreshDisputesBtn')?.addEventListener('click', loadDisputes);
    document.getElementById('refreshAnalyticsBtn')?.addEventListener('click', loadAnalytics);
}

async function fetchJson(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    });
    if (!response.ok) {
        let detail = 'Request failed';
        try {
            const errorData = await response.json();
            detail = errorData.detail || JSON.stringify(errorData);
        } catch {
            detail = response.statusText;
        }
        const message = typeof detail === 'string' ? detail : JSON.stringify(detail);
        throw new Error(message);
    }
    if (response.status === 204) {
        return {};
    }
    return response.json();
}

function formatCurrency(value) {
    if (!value) return '0';
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0
    }).format(value);
}

function formatDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

async function loadPendingProjects() {
    const tbody = document.getElementById('pendingProjectsBody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="text-muted">Đang tải dữ liệu...</td></tr>`;
    try {
        const projects = await fetchJson('/api/v1/admin/pending-projects');
        if (!projects.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-muted">Hiện chưa có dự án nào chờ duyệt.</td></tr>`;
            return;
        }
        tbody.innerHTML = projects.map(renderProjectRow).join('');
    } catch (error) {
        console.error('loadPendingProjects', error);
        tbody.innerHTML = `<tr><td colspan="6" class="text-danger">Không thể tải dữ liệu: ${error.message}</td></tr>`;
    }
}

function renderProjectRow(project) {
    const clientLabel = project.client_id ? `#${project.client_id}` : 'N/A';
    return `
        <tr>
            <td>${project.id}</td>
            <td>
                <strong>${project.title || 'Chưa có tiêu đề'}</strong>
                <div class="text-muted" style="font-size:0.85rem;">${project.category || 'Không có danh mục'}</div>
            </td>
            <td>${formatCurrency(project.budget)}</td>
            <td>${clientLabel}</td>
            <td>${formatDateTime(project.created_at)}</td>
            <td>
                <button class="btn btn-success btn-small" onclick="approvePendingProject(${project.id})">
                    <i class="fas fa-check"></i> Duyệt
                </button>
                <button class="btn btn-danger btn-small" onclick="deleteProject(${project.id})">
                    <i class="fas fa-trash"></i> Xóa
                </button>
            </td>
        </tr>
    `;
}

async function approvePendingProject(projectId) {
    if (!confirm('Xác nhận duyệt bài đăng này?')) return;
    try {
        await fetchJson(`/api/v1/admin/projects/${projectId}/approve`, { method: 'POST' });
        loadPendingProjects();
    } catch (error) {
        alert(`Không thể duyệt dự án: ${error.message}`);
    }
}

async function deleteProject(projectId) {
    if (!confirm('Bạn chắc chắn muốn xóa dự án này?')) return;
    try {
        await fetchJson(`/api/v1/admin/projects/${projectId}`, { method: 'DELETE' });
        loadPendingProjects();
    } catch (error) {
        alert(`Không thể xóa dự án: ${error.message}`);
    }
}

async function loadAccounts(role) {
    const container = document.getElementById(`${role}AccountsList`);
    if (!container) return;
    container.innerHTML = `<div class="empty-state">Đang tải dữ liệu...</div>`;
    try {
        const users = await fetchJson(`/api/v1/admin/users?role=${role}`);
        if (!users.length) {
            container.innerHTML = `<div class="empty-state">Không có tài khoản nào.</div>`;
            return;
        }
        container.innerHTML = users.map(user => renderAccountCard(user, role)).join('');
    } catch (error) {
        console.error('loadAccounts', error);
        container.innerHTML = `<div class="empty-state text-danger">Lỗi tải dữ liệu: ${error.message}</div>`;
    }
}

function renderAccountCard(user, role) {
    const badges = [];
    if (user.is_banned) {
        badges.push('<span class="account-status-badge danger">Đã khóa</span>');
    }
    if (user.suspended_until) {
        badges.push(`<span class="account-status-badge warning">Tạm khóa đến ${formatDateTime(user.suspended_until)}</span>`);
    }
    if (!user.is_verified) {
        badges.push('<span class="account-status-badge">Chưa xác minh</span>');
    }
    return `
        <article class="admin-user-card">
            <h4>${user.name || 'Người dùng'} <span class="text-muted">#${user.id}</span></h4>
            <p><i class="fas fa-envelope"></i> ${user.email}</p>
            ${user.phone ? `<p><i class="fas fa-phone"></i> ${user.phone}</p>` : ''}
            ${user.headline ? `<p>${user.headline}</p>` : ''}
            <p class="text-muted">Tạo ngày: ${formatDateTime(user.created_at)}</p>
            ${badges.length ? `<div class="account-status-badges">${badges.join('')}</div>` : ''}
            <footer>
                ${user.suspended_until ? `
                    <button class="btn btn-secondary btn-small" onclick="unsuspendUser(${user.id}, '${role}')">
                        <i class="fas fa-unlock"></i> Gỡ tạm khóa
                    </button>
                ` : `
                    <button class="btn btn-warning btn-small" onclick="suspendUser(${user.id}, '${role}', 30)">
                        <i class="fas fa-user-clock"></i> Tạm khóa 30 ngày
                    </button>
                `}
                ${user.is_banned ? `
                    <button class="btn btn-secondary btn-small" onclick="unbanUser(${user.id}, '${role}')">
                        <i class="fas fa-shield"></i> Gỡ khóa
                    </button>
                ` : `
                    <button class="btn btn-danger btn-small" onclick="banUser(${user.id}, '${role}')">
                        <i class="fas fa-ban"></i> Khóa tài khoản
                    </button>
                `}
                <button class="btn btn-danger btn-small" onclick="deleteUser(${user.id}, '${role}')">
                    <i class="fas fa-trash"></i> Xóa
                </button>
            </footer>
        </article>
    `;
}

async function suspendUser(userId, role, days = 30) {
    if (!confirm('Tạm khóa tài khoản trong 30 ngày?')) return;
    try {
        await fetchJson(`/api/v1/admin/users/${userId}/suspend`, {
            method: 'POST',
            body: JSON.stringify({ days })
        });
        loadAccounts(role);
    } catch (error) {
        alert(`Không thể tạm khóa: ${error.message}`);
    }
}

async function unsuspendUser(userId, role) {
    try {
        await fetchJson(`/api/v1/admin/users/${userId}/unsuspend`, { method: 'POST' });
        loadAccounts(role);
    } catch (error) {
        alert(`Không thể gỡ tạm khóa: ${error.message}`);
    }
}

async function banUser(userId, role) {
    if (!confirm('Khóa vĩnh viễn tài khoản này?')) return;
    try {
        await fetchJson(`/api/v1/admin/users/${userId}/ban`, { method: 'POST' });
        loadAccounts(role);
    } catch (error) {
        alert(`Không thể khóa tài khoản: ${error.message}`);
    }
}

async function unbanUser(userId, role) {
    try {
        await fetchJson(`/api/v1/admin/users/${userId}/unban`, { method: 'POST' });
        loadAccounts(role);
    } catch (error) {
        alert(`Không thể gỡ khóa: ${error.message}`);
    }
}

async function deleteUser(userId, role) {
    if (!confirm('Xóa tài khoản này và toàn bộ dữ liệu liên quan?')) return;
    try {
        await fetchJson(`/api/v1/admin/users/${userId}`, { method: 'DELETE' });
        loadAccounts(role);
    } catch (error) {
        alert(`Không thể xóa tài khoản: ${error.message}`);
    }
}

async function loadDisputes() {
    const container = document.getElementById('disputesList');
    if (!container) return;
    container.innerHTML = `<div class="empty-state">Đang tải dữ liệu...</div>`;
    try {
        const disputes = await fetchJson('/api/v1/admin/disputes');
        if (!disputes.length) {
            container.innerHTML = `<div class="empty-state">Không có tranh chấp nào đang mở.</div>`;
            return;
        }
        container.innerHTML = disputes.map(renderDisputeCard).join('');
    } catch (error) {
        console.error('loadDisputes', error);
        container.innerHTML = `<div class="empty-state text-danger">Không thể tải tranh chấp: ${error.message}</div>`;
    }
}

function renderDisputeCard(dispute) {
    return `
        <article class="dispute-card">
            <h4>Project #${dispute.project_id}</h4>
            <p>${dispute.reason || 'Không có mô tả'}</p>
            <p class="text-muted">Trạng thái: ${dispute.status}</p>
            <footer>
                <button class="btn btn-success btn-small" onclick="resolveDispute(${dispute.id}, 'release_to_freelancer')">
                    <i class="fas fa-arrow-up"></i> Trả cho freelancer
                </button>
                <button class="btn btn-danger btn-small" onclick="resolveDispute(${dispute.id}, 'refund_to_client')">
                    <i class="fas fa-arrow-down"></i> Hoàn tiền khách
                </button>
            </footer>
        </article>
    `;
}

async function resolveDispute(disputeId, action) {
    const reason = prompt('Nhập ghi chú xử lý tranh chấp:');
    if (!reason) return;
    try {
        await fetchJson('/api/v1/admin/resolve_dispute', {
            method: 'POST',
            body: JSON.stringify({
                dispute_id: disputeId,
                resolution: reason,
                escrow_action: action
            })
        });
        loadDisputes();
    } catch (error) {
        alert(`Không thể xử lý tranh chấp: ${error.message}`);
    }
}

async function loadAnalytics() {
    const grid = document.getElementById('analyticsGrid');
    if (!grid) return;
    grid.innerHTML = `<div class="empty-state">Đang tải dữ liệu...</div>`;
    try {
        const stats = await fetchJson('/api/v1/analytics/summary');
        grid.innerHTML = `
            <div class="analytics-card">
                <h4>Tổng người dùng</h4>
                <div class="value">${stats.total_users || 0}</div>
            </div>
            <div class="analytics-card">
                <h4>Tổng dự án</h4>
                <div class="value">${stats.total_projects || 0}</div>
            </div>
            <div class="analytics-card">
                <h4>Doanh thu</h4>
                <div class="value" style="color: var(--success-color);">
                    ${formatCurrency(stats.total_revenue || 0)}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('loadAnalytics', error);
        grid.innerHTML = `<div class="empty-state text-danger">Không thể tải thống kê: ${error.message}</div>`;
    }
}

window.approvePendingProject = approvePendingProject;
window.deleteProject = deleteProject;
window.resolveDispute = resolveDispute;
window.suspendUser = suspendUser;
window.unsuspendUser = unsuspendUser;
window.banUser = banUser;
window.unbanUser = unbanUser;
window.deleteUser = deleteUser;

