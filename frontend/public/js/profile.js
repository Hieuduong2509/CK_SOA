// API_BASE is defined in config.js (must load config.js first)
var API_BASE = window.API_BASE || window.location.origin;

async function loadProfile(userId) {
    try {
        const [profileRes, portfolioRes, packagesRes, reviewsRes] = await Promise.all([
            fetch(`${API_BASE}/api/v1/users/${userId}`),
            fetch(`${API_BASE}/api/v1/users/${userId}/portfolio`),
            fetch(`${API_BASE}/api/v1/users/${userId}/packages`),
            fetch(`${API_BASE}/api/v1/users/${userId}/reviews`)
        ]);

        const profile = profileRes.ok ? await profileRes.json() : null;
        const portfolio = portfolioRes.ok ? await portfolioRes.json() : [];
        const packages = packagesRes.ok ? await packagesRes.json() : [];
        const reviews = reviewsRes.ok ? await reviewsRes.json() : [];

        const content = document.getElementById('profileContent');
        const level = profile ? (profile.level ?? Math.max(1, Math.floor((profile.total_stars || (profile.rating * profile.total_reviews || 0)) / 100) + 1)) : 1;
        const totalStars = profile ? Math.round(profile.total_stars || (profile.rating * profile.total_reviews || 0)) : 0;
        const startingPrice = profile?.starting_price ?? (packages[0]?.price ?? null);
        const badgesHtml = renderProfileBadges(profile?.badges || []);

        content.innerHTML = `
            <div style="background: white; border-radius: var(--radius-2xl); padding: 2rem; box-shadow: var(--shadow-md); margin-bottom: 2rem;">
                <div style="display: flex; gap: 2rem; align-items: start;">
                    <div class="freelancer-avatar" style="width: 120px; height: 120px; font-size: 3rem;">
                        ${profile?.avatar_url ? 
                            `<img src="${profile.avatar_url}" alt="${profile.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` :
                            '<i class="fas fa-user"></i>'
                        }
                    </div>
                    <div style="flex: 1;">
                        <h1 style="font-size: 2rem; margin-bottom: 0.5rem;">${profile?.display_name || profile?.name || 'Freelancer'}</h1>
                        ${profile?.headline ? `<p class="freelancer-headline" style="font-size: 1rem; margin-bottom: 0.75rem;">${profile.headline}</p>` : ''}
                        <div class="rating" style="margin-bottom: 1rem;">
                            <i class="fas fa-star" style="color: #FBBF24;"></i>
                            <span style="font-size: 1.25rem; font-weight: 600;">${(profile?.rating || 0).toFixed(1)}</span>
                            <span>(${profile?.total_reviews || 0} reviews)</span>
                        </div>
                        <div class="profile-meta-chips">
                            <span class="chip chip-level">Level ${level}</span>
                            <span class="chip"><i class="fas fa-star-half-alt"></i> ${totalStars} total stars</span>
                            ${startingPrice ? `<span class="chip"><i class="fas fa-dollar-sign"></i> Gói từ ${formatCurrency(startingPrice)}</span>` : ''}
                            ${profile?.response_time_label ? `<span class="chip"><i class="fas fa-bolt"></i> ${profile.response_time_label}</span>` : ''}
                        </div>
                        ${badgesHtml}
                        <p style="color: var(--text-secondary); margin: 1rem 0;">${profile?.bio || 'No bio available'}</p>
                        <div class="freelancer-skills">
                            ${(profile?.skills || []).map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
                        </div>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 2rem;">
                <div>
                    <h2 style="margin-bottom: 1rem;">Portfolio</h2>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem;">
                        ${portfolio.map(item => `
                            <div style="background: white; border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm);">
                                ${item.image_urls && item.image_urls[0] ? 
                                    `<img src="${item.image_urls[0]}" alt="${item.title}" style="width:100%;height:150px;object-fit:cover;">` :
                                    '<div style="width:100%;height:150px;background:var(--bg-gray);display:flex;align-items:center;justify-content:center;"><i class="fas fa-image"></i></div>'
                                }
                                <div style="padding: 1rem;">
                                    <h3 style="font-size: 1rem; margin-bottom: 0.5rem;">${item.title}</h3>
                                    <p style="font-size: 0.875rem; color: var(--text-secondary);">${item.description || ''}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <h2 style="margin-top: 2rem; margin-bottom: 1rem;">Reviews</h2>
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        ${reviews.map(review => `
                            <div style="background: white; border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-sm);">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                    <div class="rating">
                                        <i class="fas fa-star" style="color: #FBBF24;"></i>
                                        <span>${review.rating_overall}</span>
                                    </div>
                                </div>
                                <p>${review.comment || 'No comment'}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div>
                    <h2 style="margin-bottom: 1rem;">Service Packages</h2>
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        ${packages.map(pkg => `
                            <div style="background: white; border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-md); border: 2px solid var(--border-color);">
                                <h3 style="font-size: 1.25rem; margin-bottom: 0.5rem;">${pkg.name}</h3>
                                <p style="color: var(--text-secondary); margin-bottom: 1rem;">${pkg.description || ''}</p>
                                <div style="font-size: 2rem; font-weight: 700; color: var(--primary-color); margin-bottom: 1rem;">
                                    $${pkg.price}
                                </div>
                                <ul style="list-style: none; margin-bottom: 1rem;">
                                    ${pkg.deliverables.map(d => `<li style="margin-bottom: 0.5rem;"><i class="fas fa-check" style="color: var(--success-color); margin-right: 0.5rem;"></i>${d}</li>`).join('')}
                                </ul>
                                <button class="btn btn-primary" style="width: 100%;" onclick="event.preventDefault(); event.stopPropagation(); buyPackage(${pkg.id}); return false;">
                                    Mua ngay
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

function buyPackage(packageId) {
    // Get freelancer user_id from URL
    const urlParams = new URLSearchParams(window.location.search);
    const freelancerId = urlParams.get('id');
    console.log('buyPackage called with packageId:', packageId, 'freelancerId:', freelancerId);
    if (freelancerId && packageId) {
        window.location.href = `payment.html?freelancer_id=${freelancerId}&package_id=${packageId}`;
    } else {
        console.error('Missing freelancer_id or package_id', { freelancerId, packageId });
        alert('Lỗi: Không tìm thấy thông tin freelancer hoặc gói dịch vụ');
    }
}

// Expose buyPackage globally to ensure it's accessible from onclick
window.buyPackage = buyPackage;

function renderProfileBadges(badges) {
    if (!badges.length) return '';
    return `
        <div class="profile-badges">
            ${badges.map(b => `<span class="badge-tag ${badgeClass(b)}">${b}</span>`).join('')}
        </div>
    `;
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

function formatCurrency(value) {
    if (!value) return '0 nghìn đồng';
    // Convert to thousands (nghìn đồng)
    const thousands = value / 1000;
    return new Intl.NumberFormat('vi-VN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(thousands) + ' nghìn đồng';
}

