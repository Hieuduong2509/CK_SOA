// Requires config.js and auth.js loaded beforehand
// API_BASE is already defined in config.js

async function loadNotifications() {
    const container = document.getElementById('notificationsList');
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    
    if (!container) return;
    
    container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Đang tải thông báo...</p></div>';
    
    try {
        const token = getToken();
        if (!token) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-lock"></i><p>Vui lòng đăng nhập để xem thông báo.</p></div>';
            return;
        }
        
        const response = await fetch(`${API_BASE}/api/v1/notifications?limit=50`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Không thể tải thông báo');
        }
        
        let notifications = await response.json();
        
        // Filter out chat_message notifications (handled by messaging badge)
        notifications = notifications.filter(n => n.type !== 'chat_message');
        
        if (!notifications || notifications.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-bell"></i>
                    <h3>Chưa có thông báo</h3>
                    <p>Bạn sẽ nhận thông báo tại đây khi có hoạt động liên quan đến tài khoản của mình.</p>
                </div>
            `;
            markAllReadBtn.style.display = 'none';
            return;
        }
        
        const unreadCount = notifications.filter(n => !n.is_read).length;
        if (unreadCount > 0) {
            markAllReadBtn.style.display = 'inline-flex';
        } else {
            markAllReadBtn.style.display = 'none';
        }
        
        container.innerHTML = notifications.map(notification => {
            const iconClass = getIconClass(notification.type);
            const timeAgo = formatTimeAgo(notification.created_at);
            const unreadClass = notification.is_read ? '' : 'unread';
            
            return `
                <div class="notification-item ${unreadClass}" data-notification-id="${notification.id}" data-read="${notification.is_read}">
                    <div class="notification-icon ${iconClass}">
                        <i class="${getIcon(notification.type)}"></i>
                    </div>
                    <div class="notification-content">
                        <div class="notification-title">${escapeHtml(notification.title)}</div>
                        <div class="notification-message">${escapeHtml(notification.message)}</div>
                        <div class="notification-time">${timeAgo}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Add click handlers
        container.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', () => {
                const notificationId = parseInt(item.getAttribute('data-notification-id'));
                const isRead = item.getAttribute('data-read') === 'true';
                
                if (!isRead) {
                    markAsRead(notificationId);
                    item.classList.remove('unread');
                    item.setAttribute('data-read', 'true');
                }
                
                // Navigate to relevant page if data has project_id
                // This can be enhanced based on notification type
            });
        });
        
    } catch (error) {
        console.error('Error loading notifications:', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Lỗi tải thông báo</h3>
                <p>${error.message || 'Không thể tải thông báo. Vui lòng thử lại sau.'}</p>
            </div>
        `;
    }
}

function getIconClass(type) {
    const iconMap = {
        'bid_received': 'bid_received',
        'service_purchased': 'service_purchased',
        'project_completed': 'project_completed',
        'chat_message': 'chat_message',
        'project_accepted': 'bid_received',
        'milestone_submitted': 'bid_received',
        'payment_released': 'project_completed'
    };
    return iconMap[type] || 'bid_received';
}

function getIcon(type) {
    const iconMap = {
        'bid_received': 'fas fa-user-plus',
        'service_purchased': 'fas fa-shopping-cart',
        'project_completed': 'fas fa-check-circle',
        'chat_message': 'fas fa-comment-dots',
        'project_accepted': 'fas fa-check',
        'milestone_submitted': 'fas fa-file-upload',
        'payment_released': 'fas fa-money-bill-wave'
    };
    return iconMap[type] || 'fas fa-bell';
}

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    
    return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

async function markAsRead(notificationId) {
    try {
        const token = getToken();
        if (!token) return;
        
        await fetch(`${API_BASE}/api/v1/notifications/${notificationId}/read`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        // Update navbar badge if exists
        updateNotificationBadge();
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

async function markAllAsRead() {
    try {
        const token = getToken();
        if (!token) return;
        
        await fetch(`${API_BASE}/api/v1/notifications/read-all`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        // Reload notifications
        loadNotifications();
        updateNotificationBadge();
    } catch (error) {
        console.error('Error marking all as read:', error);
        alert('Không thể đánh dấu tất cả đã đọc. Vui lòng thử lại.');
    }
}

async function updateNotificationBadge() {
    try {
        const token = getToken();
        if (!token) return;
        
        const response = await fetch(`${API_BASE}/api/v1/notifications?unread_only=true&limit=1`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const notifications = await response.json();
            const unreadCount = notifications.length;
            
            // Update navbar badge
            const badge = document.querySelector('[data-badge-for="notifications"]');
            if (badge) {
                if (unreadCount > 0) {
                    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                    badge.style.display = 'inline-block';
                } else {
                    badge.style.display = 'none';
                }
            }
        }
    } catch (error) {
        console.error('Error updating notification badge:', error);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadNotifications();
    
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', markAllAsRead);
    }
    
    // Refresh notifications every 30 seconds
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            loadNotifications();
        }
    }, 30000);
});

// Export for use in navbar
window.updateNotificationBadge = updateNotificationBadge;

