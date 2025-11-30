// API_BASE is defined in config.js (must load config.js first)
var API_BASE = window.API_BASE || window.location.origin;
async function loadProfile(userId) {
    try {
        const [profileRes, portfolioRes, reviewsRes, packagesRes] = await Promise.all([
            fetch(`${API_BASE}/api/v1/users/${userId}`),
            fetch(`${API_BASE}/api/v1/users/${userId}/portfolio`),
            fetch(`${API_BASE}/api/v1/users/${userId}/reviews`),
            fetch(`${API_BASE}/api/v1/users/${userId}/packages`)
        ]);

        if (!profileRes.ok) {
            throw new Error('Không thể tải dữ liệu hồ sơ');
        }

        const profile = await profileRes.json();
        const portfolio = portfolioRes.ok ? await portfolioRes.json() : [];
        const reviews = reviewsRes.ok ? await reviewsRes.json() : [];
        const packages = packagesRes.ok ? await packagesRes.json() : [];

        renderProfileSummary(profile);
        renderOverview(profile);
        renderBadges(profile?.badges || []);
        renderPortfolio(portfolio);
        renderProjectHistory(reviews);
        renderReviews(reviews);
        renderRatingStats(profile, reviews);
        renderServicePackages(packages);
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
    
    const userId = profile?.user_id || profile?.id;
    const displayName = profile?.display_name || profile?.name || 'User';
    const displayNameSafe = displayName.replace(/'/g, "\\'");
    
    // Check if current user is viewing their own profile
    const currentUser = getCurrentUserProfile();
    const isOwnProfile = currentUser && (currentUser.id === userId || currentUser.id === profile?.id);
    
    const contactButton = !isOwnProfile ? `
        <div class="profile-action-buttons" style="padding: 1rem 0; border-top: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); margin: 1rem 0;">
            <button class="btn btn-primary" onclick="contactFreelancer(${userId}, '${displayNameSafe}')" style="width: 100%;">
                <i class="fas fa-comment-dots"></i> Nhắn tin
            </button>
        </div>
    ` : '';
    
    const editButton = isOwnProfile ? `
        <div class="profile-action-buttons" style="padding: 1rem 0; border-top: 1px solid var(--border-color); margin-top: 1rem;">
            <button class="btn btn-primary" id="editProfileBtn" style="width: 100%;">
                <i class="fas fa-edit"></i> Chỉnh sửa hồ sơ
            </button>
        </div>
    ` : '';

    // Display level badge next to name
    const level = profile?.level || 0;
    const levelBadge = level > 0 ? `<span class="level-badge" title="Level ${level}: Cấp độ thành tích">Level ${level}</span>` : '';
    
    // Display role badge (User or Freelancer)
    const role = profile?.role || 'client';
    const roleLabel = role === 'freelancer' ? 'Freelancer' : 'User';
    const roleBadge = `<span class="role-badge ${role}" title="${roleLabel}">${roleLabel}</span>`;
    
    summary.innerHTML = `
        <div class="user-card-header">
            <div class="avatar-circle">${avatar}</div>
            <div>
                <h2 style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    ${displayName}
                    ${roleBadge}
                    ${levelBadge}
                </h2>
                <p>${profile?.headline || 'Đang cập nhật mô tả'}</p>
            </div>
        </div>
        ${contactButton}
        <div class="user-meta-list">
            <div><strong>Email:</strong> <span>${profile?.email || 'Chưa cập nhật'}</span></div>
            <div><strong>Điện thoại:</strong> <span>${profile?.phone || 'Chưa cập nhật'}</span></div>
            <div><strong>Vị trí:</strong> <span>${profile?.location || 'Không xác định'}</span></div>
            <div><strong>Ngôn ngữ:</strong> <span>${(profile?.languages || []).join(', ') || 'Chưa cập nhật'}</span></div>
            <div><strong>Dự án hoàn thành:</strong> <span>${profile?.total_projects || 0}</span></div>
            <div><strong>Tham gia từ:</strong> <span>${formatDate(profile?.created_at)}</span></div>
        </div>
        ${editButton}
    `;
    
    // Setup edit button event listener
    if (isOwnProfile) {
        setTimeout(() => {
            const editBtn = document.getElementById('editProfileBtn');
            if (editBtn) {
                editBtn.addEventListener('click', () => openEditProfileModal(profile));
            }
        }, 100);
    }
}

function renderOverview(profile) {
    const overview = document.getElementById('overviewContent');
    const statusChip = document.getElementById('profileStatus');
    if (!overview) return;

    const userId = profile?.user_id || profile?.id;
    const displayName = profile?.display_name || profile?.name || 'User';
    const displayNameSafe = displayName.replace(/'/g, "\\'");
    
    // Check if current user is viewing their own profile
    const currentUser = getCurrentUserProfile();
    const isOwnProfile = currentUser && (currentUser.id === userId || currentUser.id === profile?.id);
    
    const contactButton = !isOwnProfile ? `
        <div style="margin-bottom: 1.5rem;">
        </div>
    ` : '';

    overview.innerHTML = `
        ${contactButton}
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

    // Badge descriptions for tooltips
    const badgeDescriptions = {
        "top_rated": "Top Rated: Hoàn thành >50 đơn, đánh giá 4.9+",
        "high_earner": "High Earner: Tổng doanh thu >50M VND, hoàn thành >15 dự án",
        "client_favorite": "Client Favorite: Tỷ lệ khách quay lại >50%, hoàn thành >5 dự án",
        "fast_delivery": "Fast Delivery: Tỷ lệ giao hàng đúng hạn >95%, hoàn thành >5 dự án",
        "reliable_partner": "Reliable Partner: Tỷ lệ hủy <5%, tranh chấp <1%, hoàn thành >10 dự án",
        "rising_talent": "Rising Talent: Hoàn thành >5 dự án trong 90 ngày đầu",
    };

    badgeContainer.innerHTML = badges
        .map(badge => {
            const badgeKey = badge.toLowerCase();
            const description = badgeDescriptions[badgeKey] || 
                (badgeKey.startsWith("level_") ? `Level ${badgeKey.split("_")[1]}: Cấp độ thành tích của freelancer` : badge);
            const icon = getBadgeIcon(badgeKey);
            const displayName = getBadgeDisplayName(badgeKey);
            
            return `<span 
                class="badge-tag ${badgeClass(badge)}" 
                title="${description}"
                data-badge="${badgeKey}"
            >
                <i class="${icon}"></i> ${displayName}
            </span>`;
        })
        .join('');
}

function getBadgeIcon(badgeKey) {
    const icons = {
        "top_rated": "fas fa-star",
        "high_earner": "fas fa-dollar-sign",
        "client_favorite": "fas fa-heart",
        "fast_delivery": "fas fa-bolt",
        "reliable_partner": "fas fa-shield-alt",
        "rising_talent": "fas fa-rocket",
    };
    
    if (badgeKey.startsWith("level_")) {
        return "fas fa-trophy";
    }
    
    return icons[badgeKey] || "fas fa-award";
}

function getBadgeDisplayName(badgeKey) {
    const names = {
        "top_rated": "Top Rated",
        "high_earner": "High Earner",
        "client_favorite": "Client Favorite",
        "fast_delivery": "Fast Delivery",
        "reliable_partner": "Reliable Partner",
        "rising_talent": "Rising Talent",
    };
    
    if (badgeKey.startsWith("level_")) {
        const levelNum = badgeKey.split("_")[1];
        return `Level ${levelNum}`;
    }
    
    return names[badgeKey] || badgeKey;
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

function renderServicePackages(packages) {
    const section = document.getElementById('servicesSection');
    const grid = document.getElementById('packagesGrid');
    const hint = document.getElementById('servicesHint');
    if (!section || !grid) return;

    const approvedPackages = (packages || []).filter(pkg => (pkg.status || '').toLowerCase() === 'approved');
    if (!approvedPackages.length) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    if (hint) {
        hint.textContent = `Hiển thị tối đa 3 gói (${approvedPackages.length} gói đã xuất bản).`;
    }

    const featured = approvedPackages.slice(0, 3);
    grid.innerHTML = featured.map(pkg => {
        if (typeof registerServiceForOrder === 'function') {
            registerServiceForOrder(pkg);
        }
        const deliverables = (pkg.deliverables || []).slice(0, 3).map(item => `<li>${item}</li>`).join('');
        return `
            <article class="service-package-card">
                <header>
                    <h3>${pkg.name}</h3>
                    <small class="text-muted">${pkg.category || 'Không có danh mục'}</small>
                    <span class="price-tag">${formatCurrency(pkg.price)}</span>
                </header>
                <div class="service-card-meta">
                    <span><i class="fas fa-shipping-fast"></i> Giao trong ${pkg.delivery_days || 0} ngày</span>
                    <span><i class="fas fa-sync"></i> ${pkg.revisions || 0} lần chỉnh sửa</span>
                </div>
                ${deliverables ? `
                    <div>
                        <strong>Bàn giao:</strong>
                        <ul>${deliverables}</ul>
                    </div>` : ''}
                <footer>
                    <button class="btn btn-primary btn-small" onclick="orderService(${pkg.id})">
                        <i class="fas fa-shopping-cart"></i> Mua ngay
                    </button>
                </footer>
            </article>
        `;
    }).join('');
}

function formatDate(value) {
    if (!value) return 'Chưa rõ';
    try {
        return new Date(value).toLocaleDateString('vi-VN');
    } catch {
        return value;
    }
}

function formatCurrency(value) {
    const amount = Number(value) || 0;
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0
    }).format(amount);
}

// Edit Profile Functions
let currentProfileData = null;

function openEditProfileModal(profile) {
    currentProfileData = profile;
    const modal = document.getElementById('editProfileModal');
    if (!modal) return;
    
    // Fill form with current data
    document.getElementById('editDisplayName').value = profile?.display_name || profile?.name || '';
    document.getElementById('editHeadline').value = profile?.headline || '';
    document.getElementById('editEmail').value = profile?.email || '';
    document.getElementById('editPhone').value = profile?.phone || '';
    document.getElementById('editLocation').value = profile?.location || '';
    document.getElementById('editBio').value = profile?.bio || '';
    document.getElementById('editSkills').value = (profile?.skills || []).join('\n');
    document.getElementById('editLanguages').value = (profile?.languages || []).join('\n');
    document.getElementById('editResponseTime').value = profile?.response_time_label || '';
    
    // Hide error
    const errorDiv = document.getElementById('editProfileError');
    if (errorDiv) {
        errorDiv.textContent = '';
        errorDiv.style.display = 'none';
    }
    
    modal.style.display = 'flex';
}

function closeEditProfileModal() {
    const modal = document.getElementById('editProfileModal');
    if (modal) {
        modal.style.display = 'none';
    }
    currentProfileData = null;
}

async function saveProfileChanges() {
    if (!currentProfileData) return;
    
    const userId = currentProfileData.user_id || currentProfileData.id;
    const token = getToken();
    if (!token) {
        alert('Vui lòng đăng nhập lại');
        return;
    }
    
    // Collect form data
    const skills = document.getElementById('editSkills').value
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    
    const languages = document.getElementById('editLanguages').value
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);
    
    const payload = {
        display_name: document.getElementById('editDisplayName').value.trim(),
        headline: document.getElementById('editHeadline').value.trim() || null,
        email: document.getElementById('editEmail').value.trim() || null,
        phone: document.getElementById('editPhone').value.trim() || null,
        location: document.getElementById('editLocation').value.trim() || null,
        bio: document.getElementById('editBio').value.trim() || null,
        skills: skills.length > 0 ? skills : null,
        languages: languages.length > 0 ? languages : null,
        response_time_label: document.getElementById('editResponseTime').value || null,
    };
    
    // Remove null values
    Object.keys(payload).forEach(key => {
        if (payload[key] === null || payload[key] === '') {
            delete payload[key];
        }
    });
    
    const errorDiv = document.getElementById('editProfileError');
    const submitBtn = document.querySelector('#editProfileForm button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';
        
        const response = await fetch(`${API_BASE}/api/v1/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || 'Không thể cập nhật hồ sơ');
        }
        
        const updatedProfile = await response.json();
        
        // Reload profile data
        await loadProfile(userId);
        
        // Close modal
        closeEditProfileModal();
        
        // Show success message
        alert('Đã cập nhật hồ sơ thành công!');
        
    } catch (error) {
        console.error('saveProfileChanges error:', error);
        if (errorDiv) {
            errorDiv.textContent = error.message || 'Có lỗi xảy ra khi lưu thay đổi';
            errorDiv.style.display = 'block';
            // Scroll to error
            errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            alert('Lỗi: ' + (error.message || 'Không thể cập nhật hồ sơ'));
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// Setup modal event listeners
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('editProfileModal');
    if (modal) {
        const closeBtn = document.getElementById('closeEditModalBtn');
        const cancelBtn = document.getElementById('cancelEditBtn');
        const form = document.getElementById('editProfileForm');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', closeEditProfileModal);
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', closeEditProfileModal);
        }
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                saveProfileChanges();
            });
        }
        
        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeEditProfileModal();
            }
        });
    }
});
