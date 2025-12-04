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

    function createMobileMenuLink(href, icon, label, key) {
        const isActive = isActivePage(href);
        return `
            <a class="mobile-menu-item${isActive ? ' active' : ''}" data-key="${key}" href="${href}">
                <i class="${icon}"></i>
                <span>${label}</span>
                <span class="nav-badge" data-badge-for="${key}" style="display:none;">0</span>
            </a>
        `;
    }

    function renderClientNavbar(user) {
        const isAuthenticated = !!user;
        const navItems = [
            { href: 'freelancers.html', icon: 'fas fa-users', label: 'Chuyên gia', key: 'freelancers' },
            { href: 'favorites.html', icon: 'fas fa-heart', label: 'Yêu thích', key: 'favorites' },
            { href: 'orders.html', icon: 'fas fa-briefcase', label: 'Đơn hàng', key: 'orders' },
            { href: 'messages.html', icon: 'fas fa-comment-dots', label: 'Tin nhắn', key: 'messages' },
            { href: 'notifications.html', icon: 'fas fa-bell', label: 'Thông báo', key: 'notifications' }
        ];
        
        if (isAuthenticated && resolveUserRole(user) === 'client') {
            navItems.push({ href: 'post_project.html', icon: 'fas fa-plus-circle', label: 'Đăng bài', key: 'post-project' });
        }

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
                    ${navItems.map(item => createIconLink(item.href, item.icon, item.label, item.key)).join('')}
                    ${isAuthenticated ? renderUserSegment(user) : renderAuthSegment()}
                    <button class="mobile-menu-toggle" id="mobileMenuToggle" aria-label="Menu">
                        <i class="fas fa-bars"></i>
                    </button>
                </div>
            </nav>
            <div class="mobile-menu" id="mobileMenu">
                ${navItems.map(item => createMobileMenuLink(item.href, item.icon, item.label, item.key)).join('')}
                ${isAuthenticated ? `
                    <a class="mobile-menu-item" href="user.html">
                        <i class="fas fa-user"></i>
                        <span>Hồ sơ</span>
                    </a>
                    <a class="mobile-menu-item" href="#" id="mobileLogout">
                        <i class="fas fa-sign-out-alt"></i>
                        <span>Đăng xuất</span>
                    </a>
                ` : `
                    <a class="mobile-menu-item" href="login.html">
                        <i class="fas fa-sign-in-alt"></i>
                        <span>Đăng nhập</span>
                    </a>
                    <a class="mobile-menu-item" href="signup.html">
                        <i class="fas fa-user-plus"></i>
                        <span>Đăng ký</span>
                    </a>
                `}
            </div>
        `;
    }

    function renderFreelancerNavbar(user) {
        const isAuthenticated = !!user;
        const navItems = [
            { href: 'browse_projects.html', icon: 'fas fa-briefcase', label: 'Việc làm', key: 'browse-projects' },
            { href: 'orders.html', icon: 'fas fa-list-check', label: 'Đơn hàng', key: 'orders' },
            { href: 'dashboard_freelancer.html', icon: 'fas fa-th-large', label: 'Dashboard', key: 'freelancer-dashboard' },
            { href: 'messages.html', icon: 'fas fa-comment-dots', label: 'Tin nhắn', key: 'messages' },
            { href: 'notifications.html', icon: 'fas fa-bell', label: 'Thông báo', key: 'notifications' }
        ];

        return `
            <nav class="app-navbar">
                <div class="nav-left">
                    <a class="nav-logo${isActivePage('browse_projects.html') ? ' active' : ''}" href="browse_projects.html">
                        <i class="fas fa-code"></i>
                        <span>CodeDesign</span>
                    </a>
                </div>
                <div class="nav-right">
                    ${navItems.map(item => createIconLink(item.href, item.icon, item.label, item.key)).join('')}
                    ${isAuthenticated ? renderUserSegment(user) : ''}
                    <button class="mobile-menu-toggle" id="mobileMenuToggle" aria-label="Menu">
                        <i class="fas fa-bars"></i>
                    </button>
                </div>
            </nav>
            <div class="mobile-menu" id="mobileMenu">
                ${navItems.map(item => createMobileMenuLink(item.href, item.icon, item.label, item.key)).join('')}
                ${isAuthenticated ? `
                    <a class="mobile-menu-item" href="freelancer_profile.html">
                        <i class="fas fa-user"></i>
                        <span>Hồ sơ</span>
                    </a>
                    <a class="mobile-menu-item" href="#" id="mobileLogout">
                        <i class="fas fa-sign-out-alt"></i>
                        <span>Đăng xuất</span>
                    </a>
                ` : `
                    <a class="mobile-menu-item" href="login.html">
                        <i class="fas fa-sign-in-alt"></i>
                        <span>Đăng nhập</span>
                    </a>
                    <a class="mobile-menu-item" href="signup.html">
                        <i class="fas fa-user-plus"></i>
                        <span>Đăng ký</span>
                    </a>
                `}
            </div>
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
        // Mobile menu toggle
        const mobileMenuToggle = document.getElementById('mobileMenuToggle');
        const mobileMenu = document.getElementById('mobileMenu');
        if (mobileMenuToggle && mobileMenu) {
            mobileMenuToggle.addEventListener('click', () => {
                mobileMenu.classList.toggle('active');
                const icon = mobileMenuToggle.querySelector('i');
                if (icon) {
                    icon.classList.toggle('fa-bars');
                    icon.classList.toggle('fa-times');
                }
            });

            // Close mobile menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!mobileMenu.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
                    mobileMenu.classList.remove('active');
                    const icon = mobileMenuToggle.querySelector('i');
                    if (icon) {
                        icon.classList.remove('fa-times');
                        icon.classList.add('fa-bars');
                    }
                }
            });

            // Close mobile menu when clicking on a menu item
            const menuItems = mobileMenu.querySelectorAll('.mobile-menu-item');
            menuItems.forEach(item => {
                item.addEventListener('click', () => {
                    mobileMenu.classList.remove('active');
                    const icon = mobileMenuToggle.querySelector('i');
                    if (icon) {
                        icon.classList.remove('fa-times');
                        icon.classList.add('fa-bars');
                    }
                });
            });
        }

        // Mobile logout
        const mobileLogout = document.getElementById('mobileLogout');
        if (mobileLogout) {
            mobileLogout.addEventListener('click', (e) => {
                e.preventDefault();
                clearToken();
                window.location.href = 'login.html';
            });
        }

        // Handle click on notification icon - mark as viewed
        const notificationLinks = document.querySelectorAll('a[data-key="notifications"]');
        notificationLinks.forEach(link => {
            link.addEventListener('click', () => {
                localStorage.setItem('lastViewedNotifications', new Date().toISOString());
                const badges = document.querySelectorAll('.nav-badge[data-badge-for="notifications"]');
                badges.forEach(badge => badge.style.display = 'none');
            });
        });
        
        // Handle click on messages icon - mark as viewed
        const messagesLinks = document.querySelectorAll('a[data-key="messages"]');
        messagesLinks.forEach(link => {
            link.addEventListener('click', () => {
                localStorage.setItem('lastViewedMessages', new Date().toISOString());
                const badges = document.querySelectorAll('.nav-badge[data-badge-for="messages"]');
                badges.forEach(badge => badge.style.display = 'none');
            });
        });
        
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
