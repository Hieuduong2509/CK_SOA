// Requires config.js and auth.js loaded beforehand
(function () {
    const root = document.getElementById('navbar-root');
    if (!root) {
        return;
    }

    function getCurrentPage() {
        const path = window.location.pathname;
        const page = path.split('/').pop() || 'index.html';
        return page;
    }

    function isActivePage(href) {
        const current = getCurrentPage();
        const target = href.split('/').pop();
        return current === target || (current === '' && target === 'index.html');
    }

    const state = {
        user: getCurrentUserProfile(),
        currentPage: getCurrentPage()
    };

    function createIconLink(href, icon, label, key) {
        const isActive = isActivePage(href);
        return `
            <a class="nav-icon${isActive ? ' active' : ''}" data-key="${key}" href="${href}" title="${label}">
                <i class="${icon}"></i>
                <span>${label}</span>
                <span class="nav-badge" data-badge-for="${key}" style="display:none;">0</span>
            </a>
        `;
    }

    function resolveUserRole(user) {
        if (!user || !user.role) {
            return null;
        }
        let role = user.role;
        if (typeof role === 'object' && role.value) {
            role = role.value;
        } else if (typeof role === 'object' && role.name) {
            role = role.name.toLowerCase();
        }
        return String(role).toLowerCase();
    }

    function render(user) {
        const isFreelancer = resolveUserRole(user) === 'freelancer';
        root.innerHTML = isFreelancer
            ? renderFreelancerNavbar(user)
            : renderClientNavbar(user);

        attachBehaviors();
        if (user) {
            initBadges();
        }
    }

    function renderClientNavbar(user) {
        const isAuthenticated = !!user;
        return `
            <nav class="app-navbar">
                <div class="nav-left">
                    <a class="nav-logo${isActivePage('index.html') ? ' active' : ''}" href="index.html">
                        <i class="fas fa-code"></i>
                        <span>CodeDesign</span>
                    </a>
                    <div class="nav-search">
                        <i class="fas fa-search"></i>
                        <input type="text" id="navbarSearchInput" placeholder="Tìm freelancer, dịch vụ...">
                    </div>
                </div>
                <div class="nav-right">
                    ${createIconLink('freelancers.html', 'fas fa-users', 'Chuyên gia', 'freelancers')}
                    ${createIconLink('favorites.html', 'fas fa-heart', 'Yêu thích', 'favorites')}
                    ${createIconLink('orders.html', 'fas fa-briefcase', 'Đơn hàng', 'orders')}
                    ${createIconLink('messages.html', 'fas fa-comment-dots', 'Tin nhắn', 'messages')}
                    ${createIconLink('notifications.html', 'fas fa-bell', 'Thông báo', 'notifications')}
                    ${isAuthenticated && resolveUserRole(user) === 'client'
                        ? createIconLink('post_project.html', 'fas fa-plus-circle', 'Đăng bài', 'post-project')
                        : ''}
                    ${isAuthenticated ? renderUserSegment(user) : renderAuthSegment()}
                </div>
            </nav>
        `;
    }

    function renderFreelancerNavbar(user) {
        const isAuthenticated = !!user;
        return `
            <nav class="app-navbar">
                <div class="nav-left">
                    <a class="nav-logo${isActivePage('browse_projects.html') ? ' active' : ''}" href="browse_projects.html">
                        <i class="fas fa-code"></i>
                        <span>CodeDesign</span>
                    </a>
                </div>
                <div class="nav-right">
                    ${createIconLink('browse_projects.html', 'fas fa-briefcase', 'Việc làm', 'browse-projects')}
                    ${createIconLink('orders.html', 'fas fa-list-check', 'Đơn hàng', 'orders')}
                    ${createIconLink('dashboard_freelancer.html', 'fas fa-th-large', 'Dashboard', 'freelancer-dashboard')}
                    ${createIconLink('messages.html', 'fas fa-comment-dots', 'Tin nhắn', 'messages')}
                    ${createIconLink('notifications.html', 'fas fa-bell', 'Thông báo', 'notifications')}
                    ${isAuthenticated ? renderUserSegment(user) : ''}
                </div>
            </nav>
        `;
    }

    function renderAuthSegment() {
        const current = state.currentPage;
        const showLogin = current !== 'login.html';
        const showSignup = current !== 'signup.html';
        return `
            <div class="nav-auth">
                ${showLogin ? '<a class="btn-link" href="login.html">Đăng nhập</a>' : ''}
                ${showSignup ? '<a class="btn-primary" href="signup.html">Đăng ký</a>' : ''}
            </div>
        `;
    }

    function initialsFromName(name) {
        if (!name) return 'U';
        const parts = name.trim().split(' ');
        if (parts.length === 1) return parts[0][0]?.toUpperCase() || 'U';
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }

    function renderUserSegment(user) {
        const initials = initialsFromName(user.name);
        return `
            <div class="nav-user">
                <button class="nav-avatar" id="navbarAvatar" type="button">
                    <span class="avatar-circle">${initials}</span>
                    <span class="nav-username">${user.name}</span>
                </button>
                <button class="btn-link" id="navbarLogout" type="button">Đăng xuất</button>
            </div>
        `;
    }

    function attachBehaviors() {
        // Handle click on notification icon - mark as viewed
        const notificationLink = document.querySelector('a[data-key="notifications"]');
        if (notificationLink) {
            notificationLink.addEventListener('click', () => {
                // Save timestamp when user clicks on notifications
                localStorage.setItem('lastViewedNotifications', new Date().toISOString());
                // Hide badge immediately
                const badge = document.querySelector('.nav-badge[data-badge-for="notifications"]');
                if (badge) {
                    badge.style.display = 'none';
                }
            });
        }
        
        // Handle click on messages icon - mark as viewed
        const messagesLink = document.querySelector('a[data-key="messages"]');
        if (messagesLink) {
            messagesLink.addEventListener('click', () => {
                // Save timestamp when user clicks on messages
                localStorage.setItem('lastViewedMessages', new Date().toISOString());
                // Hide badge immediately
                const badge = document.querySelector('.nav-badge[data-badge-for="messages"]');
                if (badge) {
                    badge.style.display = 'none';
                }
            });
        }
        
        const searchInput = document.getElementById('navbarSearchInput');
        if (searchInput) {
            searchInput.value = new URLSearchParams(window.location.search).get('q') || '';
            searchInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    const query = searchInput.value.trim();
                    const params = new URLSearchParams();
                    if (query) params.set('q', query);
                    window.location.href = `freelancers.html${params.toString() ? '?' + params.toString() : ''}`;
                }
            });
        }

        const avatarBtn = document.getElementById('navbarAvatar');
        if (avatarBtn) {
            avatarBtn.addEventListener('click', () => {
                // Redirect based on user role
                const user = state.user || getCurrentUserProfile();
                if (!user || !user.role) {
                    window.location.href = 'user.html';
                    return;
                }
                
                // Handle role - could be string or enum object
                let role = user.role;
                if (typeof role === 'object' && role.value) {
                    role = role.value;
                } else if (typeof role === 'object' && role.name) {
                    role = role.name.toLowerCase();
                }
                role = String(role).toLowerCase();
                
                // Redirect based on role
                switch (role) {
                    case 'admin':
                        window.location.href = 'admin.html';
                        break;
                    case 'freelancer':
                        {
                            const targetId = user.id || user.user_id || null;
                            const profileUrl = targetId ? `freelancer_profile.html?id=${targetId}` : 'freelancer_profile.html';
                            window.location.href = profileUrl;
                        }
                        break;
                    case 'client':
                    default:
                        window.location.href = 'user.html';
                        break;
                }
            });
        }

        const logoutBtn = document.getElementById('navbarLogout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                clearToken();
                window.location.href = 'login.html';
            });
        }
    }

    async function initBadges() {
        try {
            await updateNotificationBadge();
            await updateMessagesBadge();
            setInterval(updateNotificationBadge, 60000);
            setInterval(updateMessagesBadge, 60000);
        } catch (e) {
            console.warn('initBadges error', e);
        }
    }

    async function updateNotificationBadge() {
        if (!getToken || !getToken()) return;
        try {
            // Get last viewed timestamp
            const lastViewed = localStorage.getItem('lastViewedNotifications');
            
            // Get all unread notifications
            const resp = await fetch(`${API_BASE}/api/v1/notifications?unread_only=true`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (!resp.ok) return;
            let list = await resp.json();
            
            // Filter out chat_message notifications
            list = list.filter(n => n.type !== 'chat_message');
            
            // If user has viewed notifications before, only count new ones
            if (lastViewed) {
                const lastViewedDate = new Date(lastViewed);
                list = list.filter(n => {
                    const createdDate = new Date(n.created_at);
                    return createdDate > lastViewedDate;
                });
            }
            
            const count = Array.isArray(list) ? list.length : 0;
            const badge = document.querySelector('.nav-badge[data-badge-for="notifications"]');
            if (!badge) return;
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : String(count);
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        } catch (e) {
            console.warn('updateNotificationBadge error', e);
        }
    }

    async function updateMessagesBadge() {
        if (!getToken || !getToken()) return;
        try {
            // Get last viewed timestamp
            const lastViewed = localStorage.getItem('lastViewedMessages');
            
            const resp = await fetch(`${API_BASE}/api/v1/chat/conversations`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (!resp.ok) return;
            const convs = await resp.json();
            let totalUnread = 0;
            
            if (Array.isArray(convs)) {
                if (lastViewed) {
                    // If user has viewed messages before, only count conversations with new messages
                    const lastViewedDate = new Date(lastViewed);
                    totalUnread = convs.reduce(function (sum, c) {
                        // Check if conversation has messages newer than last viewed
                        if (c.last_message && c.last_message.created_at) {
                            const lastMessageDate = new Date(c.last_message.created_at);
                            if (lastMessageDate > lastViewedDate) {
                                return sum + (c.unread_count || 0);
                            }
                        }
                        return sum;
                    }, 0);
                } else {
                    // First time, count all unread
                    totalUnread = convs.reduce(function (sum, c) {
                        return sum + (c.unread_count || 0);
                    }, 0);
                }
            }
            
            const badge = document.querySelector('.nav-badge[data-badge-for="messages"]');
            if (!badge) return;
            if (totalUnread > 0) {
                badge.textContent = totalUnread > 99 ? '99+' : String(totalUnread);
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        } catch (e) {
            console.warn('updateMessagesBadge error', e);
        }
    }

    async function init() {
        // Update current page state
        state.currentPage = getCurrentPage();
        
        // Fetch user if token exists
        if (!state.user && getToken()) {
            try {
                state.user = await fetchCurrentUser();
            } catch (error) {
                console.error('Failed to fetch current user:', error);
                state.user = null;
            }
        }
        
        render(state.user);
    }

    // Initialize on load
    init();
    
    // Re-render on navigation (for SPA-like behavior if needed)
    window.addEventListener('popstate', () => {
        state.currentPage = getCurrentPage();
        init();
    });
})();
