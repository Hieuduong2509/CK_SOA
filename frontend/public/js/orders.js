(function () {
    const grid = document.getElementById('ordersGrid');
    let currentUser = null;

    function placeholder(message) {
        grid.innerHTML = `<p style="color: var(--text-secondary);">${message}</p>`;
    }

    function statusChip(status) {
        const friendly = status.replace(/_/g, ' ');
        return `<span class="status-tag ${status.toLowerCase()}">${friendly}</span>`;
    }

    function renderProjects(projects) {
        if (!projects.length) {
            placeholder('Chưa có dự án nào. Hãy bắt đầu bằng cách đăng một project hoặc tham gia đấu thầu.');
            return;
        }

        grid.innerHTML = projects.map(project => `
            <div class="card project-card">
                <div class="project-card-header">
                    <h3>${project.title}</h3>
                    ${statusChip(project.status)}
                </div>
                <p>${project.description?.substring(0, 160) || ''}${project.description && project.description.length > 160 ? '…' : ''}</p>
                <div class="project-card-meta">
                    <span><i class="fas fa-coins"></i> Budget: $${project.budget}</span>
                    ${project.deadline ? `<span><i class="fas fa-calendar-alt"></i> Deadline: ${new Date(project.deadline).toLocaleDateString()}</span>` : ''}
                    ${project.category ? `<span><i class="fas fa-folder"></i> ${project.category}</span>` : ''}
                </div>
                <div class="project-card-actions">
                    <a class="btn btn-primary btn-small" href="workspace.html?project_id=${project.id}">Open Workspace</a>
                </div>
            </div>
        `).join('');
    }

    async function fetchProjects() {
        const token = getToken();
        if (!token) {
            placeholder('Vui lòng đăng nhập để xem danh sách đơn hàng và dự án của bạn.');
            return;
        }

        currentUser = getCurrentUserProfile();
        if (!currentUser) {
            currentUser = await fetchCurrentUser();
        }
        if (!currentUser) {
            placeholder('Vui lòng đăng nhập để xem danh sách đơn hàng và dự án của bạn.');
            return;
        }

        const params = new URLSearchParams();
        if (currentUser.role === 'client') {
            params.append('client_id', currentUser.id);
        } else if (currentUser.role === 'freelancer') {
            params.append('freelancer_id', currentUser.id);
        }

        try {
            const response = await fetch(`${API_BASE}/api/v1/projects?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) {
                placeholder('Không thể tải danh sách dự án. Vui lòng thử lại sau.');
                return;
            }
            const projects = await response.json();
            renderProjects(projects);
        } catch (error) {
            console.error('fetchProjects error', error);
            placeholder('Không thể tải danh sách dự án. Vui lòng thử lại sau.');
        }
    }

    document.addEventListener('DOMContentLoaded', fetchProjects);
})();
