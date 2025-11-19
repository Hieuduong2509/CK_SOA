// API_BASE is defined in config.js (must load config.js first)
var API_BASE = window.API_BASE || window.location.origin;

// Handle toggle favorite button click
async function handleToggleFavorite(buttonElement, profileId, userId) {
    await toggleFavorite(profileId, userId, buttonElement);
}

// Load all freelancers and categorize them
async function loadAllFreelancersByCategory() {
    const developersGrid = document.getElementById('developersGrid');
    const designersGrid = document.getElementById('designersGrid');
    
    if (!developersGrid || !designersGrid) {
        // Not on homepage, skip
        return;
    }

    try {
        // Load all freelancers (no limit)
        const response = await fetch(`${API_BASE}/api/v1/users?limit=100`);
        if (!response.ok) {
            throw new Error(`Failed to load freelancers: ${response.status} ${response.statusText}`);
        }
        
        const allFreelancers = await response.json();
        console.log('Loaded freelancers:', allFreelancers.length, allFreelancers);
        
        // Load favorites if user is logged in
        const favorites = await loadFavorites();
        
        // Categorize freelancers
        const developers = [];
        const designers = [];
        
        allFreelancers.forEach(freelancer => {
            const categories = (freelancer.categories || []).map(c => String(c).toLowerCase());
            const skills = (freelancer.skills || []).map(s => String(s).toLowerCase());
            
            // Check if developer (web-development, backend, frontend, mobile, etc.)
            const isDeveloper = categories.some(cat => 
                cat.includes('web-development') || 
                cat.includes('backend') || 
                cat.includes('frontend') ||
                cat.includes('mobile') ||
                cat.includes('product')
            ) || skills.some(skill => 
                skill.includes('python') || 
                skill.includes('javascript') || 
                skill.includes('react') ||
                skill.includes('node') ||
                skill.includes('java') ||
                skill.includes('php') ||
                skill.includes('api') ||
                skill.includes('django') ||
                skill.includes('express') ||
                skill.includes('mongodb') ||
                skill.includes('postgresql')
            );
            
            // Check if designer (design, branding, ui/ux, etc.)
            const isDesigner = categories.some(cat => 
                cat.includes('design') || 
                cat.includes('branding') ||
                cat.includes('ui') ||
                cat.includes('ux')
            ) || skills.some(skill => 
                skill.includes('ui') || 
                skill.includes('ux') || 
                skill.includes('figma') ||
                skill.includes('photoshop') ||
                skill.includes('illustrator') ||
                skill.includes('design') ||
                skill.includes('prototyping')
            );
            
            if (isDeveloper) {
                developers.push(freelancer);
            }
            if (isDesigner) {
                designers.push(freelancer);
            }
            
            // If no clear category, add to developers by default
            if (!isDeveloper && !isDesigner) {
                developers.push(freelancer);
            }
        });
        
        console.log('Developers:', developers.length, developers);
        console.log('Designers:', designers.length, designers);
        
        // Render developers
        if (developers.length > 0) {
            developersGrid.innerHTML = developers.map(f => {
                const isFav = isFavorited(f.user_id, favorites);
                return createFreelancerCard(f, isFav);
            }).join('');
        } else {
            developersGrid.innerHTML = '<div class="freelancer-empty"><i class="fas fa-user-slash"></i><strong>Chưa có Developer nào</strong><span>Hệ thống chưa có dữ liệu freelancer. Vui lòng chạy script seed_data.py để tạo dữ liệu mẫu.</span></div>';
        }
        
        // Render designers
        if (designers.length > 0) {
            designersGrid.innerHTML = designers.map(f => {
                const isFav = isFavorited(f.user_id, favorites);
                return createFreelancerCard(f, isFav);
            }).join('');
        } else {
            designersGrid.innerHTML = '<div class="freelancer-empty"><i class="fas fa-user-slash"></i><strong>Chưa có Designer nào</strong><span>Hệ thống chưa có dữ liệu freelancer. Vui lòng chạy script seed_data.py để tạo dữ liệu mẫu.</span></div>';
        }
        
    } catch (error) {
        console.error('Error loading freelancers by category:', error);
        const errorMsg = error.message || 'Không thể tải danh sách freelancer';
        if (developersGrid) {
            developersGrid.innerHTML = `<div class="freelancer-empty"><i class="fas fa-exclamation-triangle"></i><strong>Lỗi tải dữ liệu</strong><span>${errorMsg}. Vui lòng kiểm tra console để biết thêm chi tiết.</span></div>`;
        }
        if (designersGrid) {
            designersGrid.innerHTML = `<div class="freelancer-empty"><i class="fas fa-exclamation-triangle"></i><strong>Lỗi tải dữ liệu</strong><span>${errorMsg}. Vui lòng kiểm tra console để biết thêm chi tiết.</span></div>`;
        }
    }
}

function createFreelancerCard(freelancer, isFavorited = false) {
    const skills = (freelancer.skills || []).slice(0, 3);
    const rating = freelancer.rating || 0;
    const totalReviews = freelancer.total_reviews || 0;
    const totalStars = freelancer.total_stars ?? (rating * totalReviews);
    const level = freelancer.level ?? Math.max(1, Math.floor(totalStars / 100) + 1);
    const startingPrice = freelancer.starting_price ?? (freelancer.packages && freelancer.packages[0] ? freelancer.packages[0].price : null);
    const displayName = freelancer.display_name || freelancer.name || 'Freelancer';
    // profile.id is required for favorites API
    const profileId = freelancer.id || freelancer.profile_id || null;
    const userId = freelancer.user_id; // user.id
    
    // Skip favorite button if profileId is missing
    if (!profileId) {
        console.warn('Freelancer missing profile.id:', freelancer);
    }
    
    const favoriteClass = isFavorited ? 'favorited' : '';
    const favoriteIcon = isFavorited ? 'fas' : 'far';

    return `
        <div class="freelancer-card" onclick="window.location.href='freelancer_profile.html?id=${userId}'">
            <div class="freelancer-card-header">
                <div class="freelancer-avatar">
                    ${freelancer.avatar_url ? 
                        `<img src="${freelancer.avatar_url}" alt="${displayName}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` :
                        `<span>${displayName.charAt(0).toUpperCase()}</span>`
                    }
                </div>
                <div class="freelancer-info">
                    <h3 class="freelancer-name">${displayName}</h3>
                    <p class="freelancer-headline">${freelancer.headline || '&nbsp;'}</p>
                    <div class="rating">
                        <i class="fas fa-star" style="color: #FBBF24;"></i>
                        <span>${rating.toFixed(1)}</span>
                        <span>(${totalReviews})</span>
                        <span class="freelancer-level">Level ${level}</span>
                    </div>
                    ${renderBadges(freelancer.badges)}
                </div>
            </div>
            <div class="freelancer-skills">
                ${skills.length > 0 ? skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('') : '<span class="skill-tag skill-empty">&nbsp;</span>'}
            </div>
            <div class="freelancer-metrics">
                <span class="metric-item"><i class="fas fa-dollar-sign"></i> ${startingPrice ? `Giá từ ${formatCurrency(startingPrice)}` : 'Liên hệ báo giá'}</span>
                <span class="metric-item"><i class="fas fa-star-half-alt"></i> ${Math.round(totalStars)} sao tích lũy</span>
                <span class="metric-item ${!freelancer.response_time_label ? 'metric-empty' : ''}">${freelancer.response_time_label ? `<i class="fas fa-bolt"></i> ${freelancer.response_time_label}` : ''}</span>
            </div>
            <div class="freelancer-card-actions">
                <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); window.location.href='freelancer_profile.html?id=${userId}'">
                    Xem hồ sơ
                </button>
                ${profileId ? `
                <button class="btn btn-outline btn-small favorite-btn ${favoriteClass}" 
                        data-profile-id="${profileId}" 
                        data-user-id="${userId}"
                        onclick="event.stopPropagation(); handleToggleFavorite(this, ${profileId}, ${userId})">
                    <i class="${favoriteIcon} fa-heart"></i>
                </button>
                ` : ''}
            </div>
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

function renderBadges(badges) {
    // Always render 2 badge slots, even if empty
    const badgeList = badges && badges.length ? badges : [];
    const badge1 = badgeList[0] || null;
    const badge2 = badgeList[1] || null;
    
    return `
        <div class="freelancer-badges">
            <span class="badge-slot ${badge1 ? `badge-tag ${badgeClass(badge1)}` : 'badge-empty'}">${badge1 || ''}</span>
            <span class="badge-slot ${badge2 ? `badge-tag ${badgeClass(badge2)}` : 'badge-empty'}">${badge2 || ''}</span>
        </div>
    `;
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

function formatCurrencyOld(value) {
    if (value == null) return '';
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
    } catch (error) {
        return `$${value}`;
    }
}

function hireFreelancer(freelancerId) {
    window.location.href = `payment.html?freelancer_id=${freelancerId}`;
}

// Check if a freelancer is favorited
let favoritesCache = null;
let favoritesCacheTime = 0;
const FAVORITES_CACHE_TTL = 60000; // 1 minute

async function loadFavorites() {
    const token = getToken();
    if (!token) return [];
    
    const now = Date.now();
    if (favoritesCache && (now - favoritesCacheTime) < FAVORITES_CACHE_TTL) {
        return favoritesCache;
    }
    
    const user = getCurrentUserProfile() || await fetchCurrentUser();
    if (!user) return [];
    
    try {
        const response = await fetch(`${API_BASE}/api/v1/users/${user.id}/favorites`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (response.ok) {
            const favorites = await response.json();
            favoritesCache = favorites;
            favoritesCacheTime = now;
            return favorites;
        }
    } catch (error) {
        console.error('loadFavorites error', error);
    }
    return [];
}

function isFavorited(freelancerId, favorites) {
    if (!favorites || !favorites.length) return false;
    return favorites.some(fav => fav.freelancer.user_id === freelancerId || fav.freelancer.id === freelancerId);
}

async function toggleFavorite(profileId, freelancerId, buttonElement) {
    const token = getToken();
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    const user = getCurrentUserProfile() || await fetchCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    // Validate profileId
    if (!profileId || profileId === 'undefined' || profileId === 'null') {
        console.error('Invalid profileId:', profileId);
        showNotification('Lỗi: Không tìm thấy thông tin freelancer', 'error');
        return;
    }
    
    const favorites = await loadFavorites();
    const isFav = isFavorited(freelancerId, favorites);
    
    try {
        if (isFav) {
            // Remove favorite
            const favorite = favorites.find(fav => fav.freelancer.user_id === freelancerId || fav.freelancer.id === freelancerId);
            if (favorite) {
                const response = await fetch(`${API_BASE}/api/v1/users/${user.id}/favorites/${favorite.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    favoritesCache = null; // Clear cache
                    if (buttonElement) {
                        buttonElement.innerHTML = '<i class="far fa-heart"></i>';
                        buttonElement.classList.remove('favorited');
                    }
                    // Show success message
                    showNotification('Đã xóa khỏi yêu thích', 'success');
                } else {
                    const error = await response.json().catch(() => ({}));
                    console.error('removeFavorite error', error);
                    showNotification('Không thể xóa khỏi yêu thích', 'error');
                }
            }
        } else {
            // Add favorite - ensure profileId is a number
            const profileIdNum = parseInt(profileId, 10);
            if (isNaN(profileIdNum)) {
                console.error('Invalid profileId (not a number):', profileId);
                showNotification('Lỗi: ID freelancer không hợp lệ', 'error');
                return;
            }
            
            const response = await fetch(`${API_BASE}/api/v1/users/${user.id}/favorites`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ freelancer_profile_id: profileIdNum })
            });
            
            if (response.ok) {
                favoritesCache = null; // Clear cache
                if (buttonElement) {
                    buttonElement.innerHTML = '<i class="fas fa-heart"></i>';
                    buttonElement.classList.add('favorited');
                }
                // Show success message
                showNotification('Đã thêm vào yêu thích', 'success');
            } else {
                const error = await response.json().catch(() => ({}));
                console.error('addFavorite error', response.status, error);
                const errorMsg = error.detail || error.message || 'Không thể thêm vào yêu thích';
                showNotification(errorMsg, 'error');
            }
        }
    } catch (error) {
        console.error('toggleFavorite error', error);
        showNotification('Có lỗi xảy ra: ' + error.message, 'error');
    }
}

function showNotification(message, type = 'info') {
    // Simple notification - you can enhance this later
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 24px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Legacy function for backward compatibility
async function addFavorite(profileId) {
    const token = getToken();
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    const user = getCurrentUserProfile() || await fetchCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    await toggleFavorite(profileId, null, null);
}

// Expose functions globally for use in other scripts
window.loadFavorites = loadFavorites;
window.isFavorited = isFavorited;
window.toggleFavorite = toggleFavorite;
window.handleToggleFavorite = handleToggleFavorite;
window.createFreelancerCard = createFreelancerCard;

function initHeroSearch() {
    const searchButton = document.getElementById('heroSearchButton');
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    // Debounce function for auto-search
    let searchTimeout;
    function debounceSearch(func, delay = 800) {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(func, delay);
    }

    const triggerSearch = () => {
        const query = searchInput.value.trim();
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        window.location.href = `freelancers.html${params.toString() ? '?' + params.toString() : ''}`;
    };

    // Auto-redirect to search page when typing (with debounce)
    searchInput.addEventListener('input', function() {
        debounceSearch(triggerSearch);
    });

    if (searchButton) {
        searchButton.addEventListener('click', triggerSearch);
    }
    searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            clearTimeout(searchTimeout); // Cancel debounce if Enter is pressed
            triggerSearch();
        }
    });
}

function initializeHomepage() {
    loadAllFreelancersByCategory();
    initHeroSearch();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeHomepage);
} else {
    initializeHomepage();
}

