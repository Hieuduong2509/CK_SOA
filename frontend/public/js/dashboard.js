// API_BASE is defined in config.js (must load config.js first)
var API_BASE = window.API_BASE || window.location.origin;

async function loadWallet() {
    const balanceEl = document.getElementById('balance');
    if (!balanceEl) return;
    try {
        const response = await fetch(`${API_BASE}/api/v1/payments/wallet`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });
        if (response.ok) {
            const wallet = await response.json();
            balanceEl.textContent = `$${wallet.balance.toFixed(2)}`;
        }
    } catch (error) {
        console.error('Error loading wallet:', error);
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
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadDashboard);
} else {
    loadDashboard();
}

