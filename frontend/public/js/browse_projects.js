// Requires config.js & auth.js before load
(function () {
    var API_BASE = window.API_BASE || window.location.origin;
    var state = {
        projects: [],
        filtered: []
    };

    var elements = {};

    function init() {
        elements.list = document.getElementById('projectsList');
        elements.count = document.getElementById('projectCount');
        elements.searchInput = document.getElementById('projectSearchInput');
        elements.searchButton = document.getElementById('projectSearchButton');
        elements.skillsInput = document.getElementById('skillsFilter');
        elements.budgetFilter = document.getElementById('budgetFilter');
        elements.budgetTypeFilter = document.getElementById('budgetTypeFilter');

        bindEvents();
        loadProjects();
    }

    function bindEvents() {
        if (elements.searchButton) {
            elements.searchButton.addEventListener('click', applyFilters);
        }

        if (elements.searchInput) {
            elements.searchInput.addEventListener('keydown', function (event) {
                if (event.key === 'Enter') {
                    applyFilters();
                }
            });
        }

        if (elements.skillsInput) {
            elements.skillsInput.addEventListener('change', applyFilters);
        }

        if (elements.budgetFilter) {
            elements.budgetFilter.addEventListener('change', applyFilters);
        }

        if (elements.budgetTypeFilter) {
            elements.budgetTypeFilter.addEventListener('change', applyFilters);
        }
    }

    async function loadProjects() {
        if (!elements.list) return;
        elements.list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Đang tải dự án...</p>
            </div>
        `;

        try {
            const params = new URLSearchParams({ status_filter: 'OPEN' });
            const response = await fetch(`${API_BASE}/api/v1/projects?${params.toString()}`);
            if (!response.ok) {
                throw new Error(`Failed to load projects (${response.status})`);
            }
            state.projects = await response.json();
            applyFilters();
        } catch (error) {
            console.error('Error loading projects:', error);
            elements.list.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-face-frown"></i>
                    <p>Không thể tải danh sách dự án. Vui lòng thử lại sau.</p>
                </div>
            `;
        }
    }

    function applyFilters() {
        const query = (elements.searchInput?.value || '').trim().toLowerCase();
        const skillsRaw = (elements.skillsInput?.value || '').trim().toLowerCase();
        const skillTokens = skillsRaw
            ? skillsRaw.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
            : [];
        const budgetFilter = elements.budgetFilter?.value || 'all';
        const budgetTypeFilter = elements.budgetTypeFilter?.value || 'all';

        state.filtered = state.projects.filter(function (project) {
            const title = (project.title || '').toLowerCase();
            const description = (project.description || '').toLowerCase();
            const budget = Number(project.budget) || 0;
            const budgetType = (project.budget_type || '').toUpperCase();
            const skills = []
                .concat(project.skills_required || [])
                .concat(project.tags || [])
                .map(function (skill) { return String(skill).toLowerCase(); });

            const matchesQuery = !query || title.includes(query) || description.includes(query);
            const matchesSkills = !skillTokens.length || skillTokens.every(function (token) {
                return skills.some(function (skill) { return skill.includes(token); });
            });
            const matchesBudget = filterBudget(budget, budgetFilter);
            const matchesBudgetType = budgetTypeFilter === 'all' || budgetType === budgetTypeFilter;

            return matchesQuery && matchesSkills && matchesBudget && matchesBudgetType;
        });

        renderProjects();
    }

    function filterBudget(budget, filterValue) {
        switch (filterValue) {
            case 'low':
                return budget < 10000000;
            case 'mid':
                return budget >= 10000000 && budget <= 50000000;
            case 'high':
                return budget > 50000000;
            default:
                return true;
        }
    }

    function renderProjects() {
        if (!elements.list) return;

        if (!state.filtered.length) {
            elements.list.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <p>Không có dự án nào phù hợp với bộ lọc hiện tại.</p>
                </div>
            `;
            updateProjectCount(0);
            return;
        }

        const cards = state.filtered.map(function (project) {
            return renderProjectCard(project);
        }).join('');

        elements.list.innerHTML = cards;
        updateProjectCount(state.filtered.length);
    }

    function updateProjectCount(count) {
        if (elements.count) {
            elements.count.textContent = `${count} dự án phù hợp`;
        }
    }

    function renderProjectCard(project) {
        const budgetType = project.budget_type === 'HOURLY' ? 'Theo giờ' : 'Trọn gói';
        const budgetValue = formatCurrency(project.budget);
        const skills = (project.skills_required || project.tags || []).slice(0, 6);
        const createdAt = project.created_at ? new Date(project.created_at) : null;
        const dateLabel = createdAt ? createdAt.toLocaleDateString('vi-VN') : 'Chưa rõ';

        return `
            <article class="project-card">
                <div class="project-card-header">
                    <div>
                        <h3>${project.title || 'Không có tiêu đề'}</h3>
                        <p class="project-description">${truncate(project.description || '', 220)}</p>
                    </div>
                    <span class="status-tag">Open</span>
                </div>
                <div class="project-card-meta">
                    <div class="meta-row">
                        <span><i class="fas fa-money-bill-wave"></i> ${budgetValue} · ${budgetType}</span>
                        <span><i class="fas fa-calendar-day"></i> Đăng ngày ${dateLabel}</span>
                        ${project.deadline ? `<span><i class="fas fa-hourglass-half"></i> Deadline ${formatDeadline(project.deadline)}</span>` : ''}
                    </div>
                </div>
                ${skills.length ? `
                    <div class="tag-list">
                        ${skills.map(function (skill) {
                            return `<span class="category-tag">${skill}</span>`;
                        }).join('')}
                    </div>
                ` : ''}
                <div class="project-card-actions">
                    <button class="btn btn-outline btn-small" data-action="view" data-id="${project.id}">
                        <i class="fas fa-eye"></i> Xem chi tiết
                    </button>
                    <button class="btn btn-primary btn-small" data-action="bid" data-id="${project.id}">
                        <i class="fas fa-paper-plane"></i> Ứng tuyển
                    </button>
                </div>
            </article>
        `;
    }

    function truncate(text, limit) {
        if (text.length <= limit) return text;
        return text.slice(0, limit).trim() + '...';
    }

    function formatCurrency(value) {
        if (!value && value !== 0) return 'Thỏa thuận';
        try {
            return Number(value).toLocaleString('vi-VN', {
                style: 'currency',
                currency: 'VND',
                maximumFractionDigits: 0
            });
        } catch {
            return `${value} VND`;
        }
    }

    function formatDeadline(deadline) {
        const date = new Date(deadline);
        if (Number.isNaN(date.getTime())) {
            return 'Không rõ';
        }
        return date.toLocaleDateString('vi-VN');
    }

    function handleListClick(event) {
        const target = event.target.closest('button[data-action]');
        if (!target) return;

        const projectId = target.getAttribute('data-id');
        const action = target.getAttribute('data-action');

        if (action === 'view') {
            window.location.href = `workspace.html?project_id=${projectId}`;
        } else if (action === 'bid') {
            window.location.href = `workspace.html?project_id=${projectId}#bids`;
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        init();
        if (elements.list) {
            elements.list.addEventListener('click', handleListClick);
        }
    });
})();

