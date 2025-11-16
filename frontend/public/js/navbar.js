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
            </a>
        `;
    }

    function render(user) {
        const isAuthenticated = !!user;
        const currentPage = state.currentPage;
        
        root.innerHTML = `
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
                    ${isAuthenticated ? renderUserSegment(user) : renderAuthSegment()}
                </div>
            </nav>
        `;

        attachBehaviors();
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
                window.location.href = 'user.html';
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
