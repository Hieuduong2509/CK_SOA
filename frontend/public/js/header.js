var API_BASE = window.API_BASE || window.location.origin;

function activePathMatches(pathnames) {
    const current = window.location.pathname.replace(/\/index\.html$/, '/');
    return pathnames.some(p => current.endsWith(p));
}

function createNavItem({ id, icon, label, href, active }) {
    const activeClass = active ? 'nav-icon active-nav' : 'nav-icon';
    return `
        <button class="${activeClass}" data-id="${id}" data-href="${href}">
            <i class="${icon}"></i>
            <span>${label}</span>
        </button>
    `;
}

function renderHeader() {
    const header = document.getElementById('mainHeader');
    if (!header) return;

    const user = getCurrentUserProfile();

    const navItems = [
        {
            id: 'home',
            icon: 'fas fa-house',
            label: 'Home',
            href: 'index.html',
            active: activePathMatches(['/', '/index.html'])
        },
        {
            id: 'freelancers',
            icon: 'fas fa-users',
            label: 'Freelancers',
            href: 'freelancers.html',
            active: activePathMatches(['/freelancers.html'])
        },
        {
            id: 'orders',
            icon: 'fas fa-briefcase',
            label: 'Orders',
            href: user && user.role === 'freelancer' ? 'dashboard_freelancer.html' : 'post_project.html',
            active: activePathMatches(['/post_project.html', '/dashboard_freelancer.html'])
        },
        {
            id: 'favorites',
            icon: 'fas fa-bookmark',
            label: 'Favorites',
            href: 'favorites.html',
            active: activePathMatches(['/favorites.html'])
        },
        {
            id: 'messages',
            icon: 'fas fa-envelope',
            label: 'Messages',
            href: 'workspace.html',
            active: activePathMatches(['/workspace.html'])
        },
        {
            id: 'notifications',
            icon: 'fas fa-bell',
            label: 'Alerts',
            href: '#notifications',
            active: false
        }
    ];

    const navIcons = navItems.map(item => createNavItem(item)).join('');

    const searchBar = `
        <form id="globalSearchForm" class="nav-search">
            <i class="fas fa-search"></i>
            <input id="globalSearchInput" type="text" placeholder="Search freelancers, skills..." />
        </form>
    `;

    let authSection;
    if (user) {
        const initials = user.name ? user.name.charAt(0).toUpperCase() : 'U';
        authSection = `
            <div class="nav-user">
                <div class="nav-avatar" id="navAvatar" title="${user.name}">
                    ${initials}
                </div>
                <button class="btn btn-secondary" id="logoutButtonNav">Đăng xuất</button>
            </div>
        `;
    } else {
        authSection = `
            <div class="nav-auth">
                <a href="login.html" class="nav-link">Đăng nhập</a>
                <a href="signup.html" class="btn btn-primary">Đăng ký</a>
            </div>
        `;
    }

    header.innerHTML = `
        <div class="top-nav">
            <div class="nav-left">
                <a href="index.html" class="logo-link">
                    <i class="fas fa-code"></i>
                    <span>CodeDesign</span>
                </a>
                ${searchBar}
            </div>
            <div class="nav-right">
                <div class="nav-icons">${navIcons}</div>
                ${authSection}
            </div>
        </div>
    `;

    const searchForm = document.getElementById('globalSearchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = document.getElementById('globalSearchInput').value.trim();
            const url = new URL('freelancers.html', window.location.origin);
            if (query) {
                url.searchParams.set('q', query);
            }
            window.location.href = url.toString();
        });
    }

    document.querySelectorAll('.nav-icon').forEach(button => {
        button.addEventListener('click', () => {
            const href = button.getAttribute('data-href');
            if (href && href !== '#notifications') {
                window.location.href = href;
            } else if (href === '#notifications') {
                alert('Thông báo sẽ sớm có mặt!');
            }
        });
    });

    if (user) {
        const avatar = document.getElementById('navAvatar');
        if (avatar) {
            avatar.addEventListener('click', () => {
                window.location.href = `user.html?id=${user.id}`;
            });
        }
        const logoutButton = document.getElementById('logoutButtonNav');
        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                logout();
            });
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderHeader);
} else {
    renderHeader();
}
