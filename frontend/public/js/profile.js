// API_BASE is defined in config.js (must load config.js first)
var API_BASE = window.API_BASE || window.location.origin;

async function loadProfile(userId) {
    try {
        const [profileRes, portfolioRes, reviewsRes] = await Promise.all([
            fetch(`${API_BASE}/api/v1/users/${userId}`),
            fetch(`${API_BASE}/api/v1/users/${userId}/portfolio`),
            fetch(`${API_BASE}/api/v1/users/${userId}/reviews`)
        ]);

        if (!profileRes.ok) {
            throw new Error('Không thể tải dữ liệu hồ sơ');
        }

        const profile = await profileRes.json();
        const portfolio = portfolioRes.ok ? await portfolioRes.json() : [];
        const reviews = reviewsRes.ok ? await reviewsRes.json() : [];

        renderProfileSummary(profile);
        renderOverview(profile);
        renderBadges(profile?.badges || []);
        renderPortfolio(portfolio);
        renderProjectHistory(reviews);
        renderReviews(reviews);
        renderRatingStats(profile, reviews);
    } catch (error) {
        console.error('Error loading profile:', error);
        const summary = document.getElementById('profileSummary');
        if (summary) {
            summary.innerHTML = `<p style="color: var(--danger-color);">${error.message}</p>`;
        }
    }
}

function renderProfileSummary(profile) {
    const summary = document.getElementById('profileSummary');
    if (!summary) return;

    const initials = profile?.display_name?.split(' ').map(p => p[0]).slice(0, 2).join('') || 'U';
    const avatar = profile?.avatar_url
        ? `<img src="${profile.avatar_url}" alt="${profile.display_name || 'Freelancer'}">`
        : `<span>${initials}</span>`;

    summary.innerHTML = `
        <div class="user-card-header">
            <div class="avatar-circle">${avatar}</div>
            <div>
                <h2>${profile?.display_name || profile?.name || 'Freelancer'}</h2>
                <p>${profile?.headline || 'Đang cập nhật mô tả'}</p>
            </div>
        </div>
        <div class="user-meta-list">
            <div><strong>Email:</strong> <span>${profile?.email || 'Chưa cập nhật'}</span></div>
            <div><strong>Điện thoại:</strong> <span>${profile?.phone || 'Chưa cập nhật'}</span></div>
            <div><strong>Vị trí:</strong> <span>${profile?.location || 'Không xác định'}</span></div>
            <div><strong>Ngôn ngữ:</strong> <span>${(profile?.languages || []).join(', ') || 'Chưa cập nhật'}</span></div>
            <div><strong>Dự án hoàn thành:</strong> <span>${profile?.total_projects || 0}</span></div>
            <div><strong>Tham gia từ:</strong> <span>${formatDate(profile?.created_at)}</span></div>
        </div>
    `;
}

function renderOverview(profile) {
    const overview = document.getElementById('overviewContent');
    const statusChip = document.getElementById('profileStatus');
    if (!overview) return;

    overview.innerHTML = `
        <p>${profile?.bio || 'Freelancer chưa cập nhật phần giới thiệu.'}</p>
        <div class="skill-stack">
            ${(profile?.skills || []).map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
        </div>
        <div class="stat-grid">
            <div class="stat-card">
                <strong>${(profile?.rating || 0).toFixed(1)}</strong>
                <span>Điểm đánh giá</span>
            </div>
            <div class="stat-card">
                <strong>${profile?.total_reviews || 0}</strong>
                <span>Lượt đánh giá</span>
            </div>
            <div class="stat-card">
                <strong>${profile?.total_projects || 0}</strong>
                <span>Dự án</span>
            </div>
            <div class="stat-card">
                <strong>${profile?.response_time_label || 'Nhanh chóng'}</strong>
                <span>Thời gian phản hồi</span>
            </div>
        </div>
    `;

    if (statusChip) {
        statusChip.textContent = profile?.experience_level
            ? `Cấp độ: ${profile.experience_level}`
            : 'Đang hoạt động';
    }
}

function renderBadges(badges) {
    const badgeContainer = document.getElementById('badgeList');
    if (!badgeContainer) return;

    if (!badges.length) {
        badgeContainer.innerHTML = '<p class="text-muted">Chưa có danh hiệu nào được gắn.</p>';
        return;
    }

    badgeContainer.innerHTML = badges
        .map(badge => `<span class="badge-tag ${badgeClass(badge)}">${badge}</span>`)
        .join('');
}

function renderPortfolio(items) {
    const grid = document.getElementById('portfolioGrid');
    if (!grid) return;

    if (!items.length) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-briefcase"></i>
                <p>Freelancer chưa cập nhật dự án nào trong portfolio.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = items.map(item => `
        <article class="portfolio-card">
            <div class="portfolio-cover">
                ${item.image_urls && item.image_urls[0]
                    ? `<img src="${item.image_urls[0]}" alt="${item.title}">`
                    : '<div class="portfolio-placeholder"><i class="fas fa-image"></i></div>'}
            </div>
            <div class="portfolio-body">
                <h3>${item.title}</h3>
                <p>${item.description || 'Không có mô tả chi tiết.'}</p>
                <div class="tag-list">
                    ${(item.tags || []).map(tag => `<span class="category-tag">${tag}</span>`).join('')}
                </div>
            </div>
        </article>
    `).join('');
}

function renderProjectHistory(reviews) {
    const container = document.getElementById('projectHistoryList');
    if (!container) return;

    const projects = reviews
        .filter(review => review.project_id)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (!projects.length) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <p>Chưa có dự án nào được ghi nhận từ khách hàng.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = projects.map(review => `
        <div class="project-timeline-card">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
                <div class="timeline-header">
                    <span class="project-label">Dự án #${review.project_id}</span>
                    <span class="timeline-date">${formatDate(review.created_at)}</span>
                </div>
                <div class="rating">
                    <i class="fas fa-star"></i>
                    <span>${Number(review.rating_overall || 0).toFixed(1)} / 5</span>
                </div>
                <p>${review.comment || 'Khách hàng không để lại đánh giá chi tiết.'}</p>
            </div>
        </div>
    `).join('');
}

function renderReviews(reviews) {
    const list = document.getElementById('reviewsList');
    if (!list) return;

    if (!reviews.length) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-comments"></i>
                <p>Freelancer chưa nhận được đánh giá nào.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = reviews.map(review => `
        <article class="review-card">
            <header>
                <div class="rating">
                    <i class="fas fa-star"></i>
                    <strong>${Number(review.rating_overall || 0).toFixed(1)}</strong>
                </div>
                <span>${formatDate(review.created_at)}</span>
            </header>
            <p>${review.comment || 'Không có mô tả.'}</p>
            <footer>
                <small>Dự án #${review.project_id || 'N/A'}</small>
            </footer>
        </article>
    `).join('');
}

function renderRatingStats(profile, reviews) {
    const avgValue = document.getElementById('averageRatingValue');
    const avgCount = document.getElementById('averageRatingCount');
    const chart = document.getElementById('starChart');
    if (!chart) return;

    const average = Number(profile?.rating || 0);
    const total = profile?.total_reviews || reviews.length || 0;
    if (avgValue) avgValue.textContent = average.toFixed(1);
    if (avgCount) avgCount.textContent = total
        ? `${total} lượt đánh giá`
        : 'Chưa có đánh giá';

    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(review => {
        const star = Math.round(review.rating_overall || 0);
        const clamped = Math.min(5, Math.max(1, star));
        distribution[clamped] += 1;
    });

    const maxCount = Math.max(...Object.values(distribution), 1);
    chart.innerHTML = Object.keys(distribution).sort((a, b) => b - a).map(star => {
        const count = distribution[star];
        const width = (count / maxCount) * 100;
        return `
            <div class="star-row">
                <span>${star} sao</span>
                <div class="star-bar">
                    <div class="star-bar-fill" style="width: ${width}%;"></div>
                </div>
                <span class="count">${count}</span>
            </div>
        `;
    }).join('');
}

function badgeClass(badge) {
    if (!badge) return '';
    const normalized = badge.toLowerCase();
    if (normalized.includes('top')) return 'badge-top-rated';
    if (normalized.includes('fast')) return 'badge-fast-response';
    if (normalized.includes('premium')) return 'badge-premium';
    if (normalized.includes('favorite')) return 'badge-favorite';
    return 'badge-generic';
}

function formatDate(value) {
    if (!value) return 'Chưa rõ';
    try {
        return new Date(value).toLocaleDateString('vi-VN');
    } catch {
        return value;
    }
}
