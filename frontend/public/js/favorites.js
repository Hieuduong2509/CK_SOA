(function () {
    // API_BASE is defined in config.js
    var API_BASE = window.API_BASE || window.location.origin;
    
    const grid = document.getElementById('favoritesGrid');
    let currentUser = null;

    function placeholder(message) {
        grid.innerHTML = `<p style="color: var(--text-secondary);">${message}</p>`;
    }

    function initialsFromName(name) {
        if (!name) return 'U';
        const parts = name.trim().split(' ');
        if (parts.length === 1) return parts[0][0]?.toUpperCase() || 'U';
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }

    function renderFavorites(favorites) {
        if (!favorites.length) {
            placeholder('Bạn chưa lưu freelancer nào. Hãy khám phá và lưu những freelancer phù hợp.');
            return;
        }

        grid.innerHTML = favorites.map(fav => {
            const freelancer = fav.freelancer;
            const badges = freelancer.badges && freelancer.badges.length ? freelancer.badges.join(', ') : '—';
            const rating = freelancer.rating ? freelancer.rating.toFixed(1) : '—';
            const level = freelancer.level || 1;
            return `
                <div class="favorite-card">
                    <div class="favorite-header">
                        <div class="avatar-circle">${initialsFromName(freelancer.display_name || freelancer.name)}</div>
                        <div>
                            <h3>${freelancer.display_name || freelancer.name || 'Freelancer'}</h3>
                            <p>${freelancer.headline || ''}</p>
                        </div>
                    </div>
                    <div class="favorite-meta">
                        <span><i class="fas fa-star"></i> ${rating} (${freelancer.total_reviews || 0} reviews)</span>
                        <span>Level ${level}</span>
                        <span>${badges}</span>
                        ${freelancer.starting_price ? `<span>Giá từ $${freelancer.starting_price}</span>` : ''}
                    </div>
                    <div class="favorite-actions">
                        <a class="btn btn-primary btn-small" href="freelancer_profile.html?id=${freelancer.user_id}">
                            <i class="fas fa-user"></i> Xem hồ sơ
                        </a>
                        <button class="btn btn-outline btn-small btn-danger" onclick="event.stopPropagation(); removeFavorite(${fav.id}, ${freelancer.user_id})" title="Hủy yêu thích">
                            <i class="fas fa-times-circle"></i> Hủy yêu thích
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    async function fetchFavorites() {
        const token = getToken();
        if (!token) {
            placeholder('Vui lòng đăng nhập để xem danh sách freelancer yêu thích của bạn.');
            return;
        }

        currentUser = getCurrentUserProfile();
        if (!currentUser) {
            currentUser = await fetchCurrentUser();
        }

        if (!currentUser) {
            placeholder('Vui lòng đăng nhập để xem danh sách freelancer yêu thích của bạn.');
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/v1/users/${currentUser.id}/favorites`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) {
                placeholder('Không thể tải danh sách yêu thích. Vui lòng thử lại sau.');
                return;
            }
            const favorites = await response.json();
            renderFavorites(favorites);
        } catch (error) {
            console.error('fetchFavorites error', error);
            placeholder('Không thể tải danh sách yêu thích. Vui lòng thử lại sau.');
        }
    }

    async function removeFavorite(favoriteId, freelancerUserId) {
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
        
        if (!confirm('Bạn có chắc chắn muốn xóa freelancer này khỏi danh sách yêu thích?')) {
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/api/v1/users/${user.id}/favorites/${favoriteId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                // Reload favorites
                await fetchFavorites();
                // Show success message
                showNotification('Đã xóa khỏi yêu thích', 'success');
            } else {
                showNotification('Không thể xóa khỏi yêu thích', 'error');
            }
        } catch (error) {
            console.error('removeFavorite error', error);
            showNotification('Có lỗi xảy ra', 'error');
        }
    }
    
    function showNotification(message, type = 'info') {
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
    
    window.removeFavorite = removeFavorite;

    document.addEventListener('DOMContentLoaded', fetchFavorites);
})();
