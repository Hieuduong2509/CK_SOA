var API_BASE = window.API_BASE || window.location.origin;

(function () {
    const grid = document.getElementById('ordersGrid');
    let currentUser = null;
    let projects = [];

    function placeholder(message) {
        grid.innerHTML = `<p style="color: var(--text-secondary);">${message}</p>`;
    }

    function statusChip(status) {
        // Normalize status to lowercase for comparison
        const statusLower = (status || '').toLowerCase();
        const statusMap = {
            'draft': { label: 'Nháp', class: 'draft' },
            'pending_approval': { label: 'Đang đợi duyệt', class: 'pending-approval' },
            'open': { label: 'Mở', class: 'open' },
            'in_progress': { label: 'Đang thực hiện', class: 'in-progress' },
            'completed': { label: 'Hoàn thành', class: 'completed' },
            'cancelled': { label: 'Đã hủy', class: 'cancelled' },
            'disputed': { label: 'Tranh chấp', class: 'disputed' }
        };
        const info = statusMap[statusLower] || { label: status, class: statusLower };
        return `<span class="status-tag ${info.class}">${info.label}</span>`;
    }

    function formatDate(dateString) {
        if (!dateString) return 'Chưa có';
        const date = new Date(dateString);
        return date.toLocaleDateString('vi-VN', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }

    function formatCurrency(amount) {
        if (!amount) return '0 nghìn đồng';
        // Convert to thousands (nghìn đồng)
        const thousands = amount / 1000;
        return new Intl.NumberFormat('vi-VN', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(thousands) + ' nghìn đồng';
    }

    async function fetchBidsCount(projectId) {
        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/bids`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const bids = await response.json();
                return bids.length;
            }
        } catch (error) {
            console.error('Error fetching bids count:', error);
        }
        return 0;
    }

    async function renderProjects(projectsList) {
        if (!projectsList.length) {
            placeholder('Chưa có dự án nào. Hãy bắt đầu bằng cách đăng một project hoặc tham gia đấu thầu.');
            return;
        }

        // Fetch bids count for each project
        const projectsWithBids = await Promise.all(
            projectsList.map(async (project) => {
                const bidsCount = await fetchBidsCount(project.id);
                return { ...project, bids_count: bidsCount };
            })
        );

        grid.innerHTML = projectsWithBids.map(project => `
            <div class="card project-card" data-project-id="${project.id}">
                <div class="project-card-header">
                    <h3>${project.title}</h3>
                    ${statusChip(project.status)}
                </div>
                <div class="project-description-full">
                    <p><strong>Mô tả chi tiết:</strong></p>
                    <p>${project.description || 'Chưa có mô tả'}</p>
                </div>
                <div class="project-card-meta">
                    <div class="meta-row">
                        <span><i class="fas fa-coins"></i> <strong>Giá:</strong> ${formatCurrency(project.budget)}</span>
                        <span><i class="fas fa-calendar-alt"></i> <strong>Ngày đăng:</strong> ${formatDate(project.created_at)}</span>
                    </div>
                    <div class="meta-row">
                        <span><i class="fas fa-calendar-check"></i> <strong>Hạn chót:</strong> ${formatDate(project.deadline)}</span>
                        <span><i class="fas fa-folder"></i> <strong>Ngành:</strong> ${project.category || 'Chưa chọn'}</span>
                    </div>
                    <div class="meta-row">
                        <span><i class="fas fa-users"></i> <strong>Số người apply:</strong> ${project.bids_count || 0}</span>
                        ${project.minimum_badge ? `<span><i class="fas fa-award"></i> <strong>Danh hiệu tối thiểu:</strong> ${project.minimum_badge}</span>` : ''}
                    </div>
                    ${project.minimum_level ? `
                        <div class="meta-row">
                            <span><i class="fas fa-star"></i> <strong>Level tối thiểu:</strong> ${project.minimum_level}</span>
                        </div>
                    ` : ''}
                    ${project.skills_required && project.skills_required.length > 0 ? `
                        <div class="meta-row">
                            <span><i class="fas fa-tools"></i> <strong>Kỹ năng yêu cầu:</strong> ${project.skills_required.join(', ')}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="project-card-actions">
                    <button class="btn btn-primary btn-small" onclick="viewProjectBids(${project.id})">
                        <i class="fas fa-eye"></i> Xem người apply (${project.bids_count || 0})
                    </button>
                    <a class="btn btn-secondary btn-small" href="workspace.html?project_id=${project.id}">
                        <i class="fas fa-briefcase"></i> Workspace
                    </a>
                    ${(project.status || '').toLowerCase() === 'draft' ? `
                        <button class="btn btn-warning btn-small" onclick="publishProject(${project.id})" title="Gửi duyệt">
                            <i class="fas fa-paper-plane"></i> Gửi duyệt
                        </button>
                    ` : ''}
                    ${['draft', 'pending_approval', 'open'].includes((project.status || '').toLowerCase()) ? `
                        <button class="btn btn-danger btn-small" onclick="deleteProject(${project.id}, '${(project.title || '').replace(/'/g, "\\'")}')" title="Xóa dự án">
                            <i class="fas fa-trash"></i> Xóa
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');

        projects = projectsWithBids;
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
        if (currentUser.role === 'client' || (typeof currentUser.role === 'object' && currentUser.role.value === 'client')) {
            params.append('client_id', currentUser.id);
        } else if (currentUser.role === 'freelancer' || (typeof currentUser.role === 'object' && currentUser.role.value === 'freelancer')) {
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
            const projectsList = await response.json();
            await renderProjects(projectsList);
        } catch (error) {
            console.error('fetchProjects error', error);
            placeholder('Không thể tải danh sách dự án. Vui lòng thử lại sau.');
        }
    }

    // View project bids modal
    window.viewProjectBids = async function(projectId) {
        const token = getToken();
        if (!token) return;

        try {
            // Fetch bids
            const bidsResponse = await fetch(`${API_BASE}/api/v1/projects/${projectId}/bids`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!bidsResponse.ok) {
                alert('Không thể tải danh sách người apply.');
                return;
            }
            const bids = await bidsResponse.json();

            // Fetch project details
            const projectResponse = await fetch(`${API_BASE}/api/v1/projects/${projectId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const project = projectResponse.ok ? await projectResponse.json() : null;

            // Fetch freelancer profiles for each bid
            const bidsWithProfiles = await Promise.all(
                bids.map(async (bid) => {
                    try {
                        const profileResponse = await fetch(`${API_BASE}/api/v1/users/${bid.freelancer_id}`, {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        if (profileResponse.ok) {
                            const profile = await profileResponse.json();
                            return { ...bid, profile };
                        }
                    } catch (error) {
                        console.error(`Error fetching profile for freelancer ${bid.freelancer_id}:`, error);
                    }
                    return { ...bid, profile: null };
                })
            );

            // Create modal
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
                    <div class="modal-header">
                        <h2>Danh sách người apply - ${project?.title || 'Dự án'}</h2>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        ${bidsWithProfiles.length === 0 ? 
                            '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Chưa có ai apply cho dự án này.</p>' :
                            bidsWithProfiles.map(bid => {
                                const profile = bid.profile;
                                return `
                                <div class="bid-card" style="border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 1rem;">
                                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                                        <div style="flex: 1;">
                                            <h3 style="margin: 0 0 0.5rem 0;">
                                                ${profile ? `<a href="freelancer_profile.html?id=${profile.user_id}" target="_blank" style="color: var(--primary-color); text-decoration: none;">${profile.headline || 'Freelancer'}</a>` : `Freelancer #${bid.freelancer_id}`}
                                            </h3>
                                            ${profile ? `
                                                <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.5rem;">
                                                    ${profile.rating ? `<span><i class="fas fa-star" style="color: #FFD700;"></i> ${profile.rating.toFixed(1)} (${profile.total_reviews || 0} đánh giá)</span>` : ''}
                                                    ${profile.level ? `<span><i class="fas fa-level-up-alt"></i> Level ${profile.level}</span>` : ''}
                                                    ${profile.location ? `<span><i class="fas fa-map-marker-alt"></i> ${profile.location}</span>` : ''}
                                                </div>
                                                ${profile.badges && profile.badges.length > 0 ? `
                                                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem;">
                                                        ${profile.badges.map(badge => `<span class="badge-tag" style="background: rgba(0, 102, 255, 0.1); color: var(--primary-color); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">${badge}</span>`).join('')}
                                                    </div>
                                                ` : ''}
                                            ` : ''}
                                            <p style="color: var(--text-secondary); margin: 0.5rem 0;">
                                                <strong>Giá đề xuất:</strong> ${formatCurrency(bid.price)} | 
                                                <strong>Thời gian hoàn thành:</strong> ${bid.timeline_days} ngày
                                            </p>
                                        </div>
                                        <div style="display: flex; gap: 0.5rem; flex-shrink: 0;">
                                            <button class="btn btn-primary btn-small" onclick="startChat(${bid.freelancer_id}, ${projectId})" title="Nhắn tin">
                                                <i class="fas fa-comment"></i> Nhắn tin
                                            </button>
                                            ${project?.status === 'open' ? `
                                                <button class="btn btn-success btn-small" onclick="acceptBid(${projectId}, ${bid.id})" title="Duyệt">
                                                    <i class="fas fa-check"></i> Duyệt
                                                </button>
                                            ` : ''}
                                        </div>
                                    </div>
                                    ${bid.cover_letter ? `
                                        <div style="background: var(--bg-gray); padding: 1rem; border-radius: var(--radius-md); margin-top: 1rem;">
                                            <strong>Thư giới thiệu:</strong>
                                            <p style="margin: 0.5rem 0 0 0; color: var(--text-secondary); white-space: pre-wrap;">${bid.cover_letter}</p>
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                            }).join('')
                        }
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });
        } catch (error) {
            console.error('Error loading bids:', error);
            alert('Có lỗi xảy ra khi tải danh sách người apply.');
        }
    };

    // Accept bid
    window.acceptBid = async function(projectId, bidId) {
        if (!confirm('Bạn có chắc chắn muốn duyệt người apply này không?')) {
            return;
        }

        const token = getToken();
        if (!token) return;

        try {
            const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/accept`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ bid_id: bidId })
            });

            if (response.ok) {
                alert('Đã duyệt thành công! Dự án đã được chuyển sang trạng thái "Đang thực hiện".');
                document.querySelector('.modal-overlay')?.remove();
                await fetchProjects(); // Refresh projects list
            } else {
                const error = await response.json();
                alert(error.detail || 'Không thể duyệt. Vui lòng thử lại.');
            }
        } catch (error) {
            console.error('Error accepting bid:', error);
            alert('Có lỗi xảy ra khi duyệt.');
        }
    };

    // Publish project (send for admin approval) - change status from draft to pending_approval
    window.publishProject = async function(projectId) {
        if (!confirm('Bạn có muốn gửi dự án này để admin duyệt không?\n\nSau khi được admin duyệt, dự án sẽ hiển thị cho các freelancer.')) {
            return;
        }

        const token = getToken();
        if (!token) return;

        try {
            // Update project status from draft to pending_approval
            const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: 'pending_approval' })
            });

            if (response.ok) {
                alert('Đã gửi dự án để admin duyệt!');
                await fetchProjects(); // Refresh projects list
            } else {
                const error = await response.json().catch(() => ({ detail: 'Không thể gửi duyệt. Vui lòng thử lại.' }));
                alert(error.detail || 'Không thể gửi duyệt. Vui lòng thử lại.');
            }
        } catch (error) {
            console.error('Error publishing project:', error);
            alert('Có lỗi xảy ra khi gửi duyệt dự án.');
        }
    };

    // Delete project
    window.deleteProject = async function(projectId, projectTitle) {
        if (!confirm(`Bạn có chắc chắn muốn xóa dự án "${projectTitle || 'này'}" không?\n\nLưu ý: Chỉ có thể xóa các dự án ở trạng thái "Nháp", "Đang đợi duyệt" hoặc "Mở".`)) {
            return;
        }

        const token = getToken();
        if (!token) {
            alert('Bạn cần đăng nhập để thực hiện thao tác này.');
            window.location.href = 'login.html';
            return;
        }

        console.log('Deleting project:', projectId, 'API_BASE:', API_BASE);

        try {
            const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Delete response status:', response.status);

            if (response.ok) {
                alert('Đã xóa dự án thành công!');
                await fetchProjects(); // Refresh projects list
            } else {
                if (response.status === 401) {
                    alert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
                    clearToken();
                    window.location.href = 'login.html';
                    return;
                }
                const errorData = await response.json().catch(() => ({ detail: 'Không thể xóa dự án. Vui lòng thử lại.' }));
                alert(errorData.detail || 'Không thể xóa dự án. Vui lòng thử lại.');
            }
        } catch (error) {
            console.error('Error deleting project:', error);
            alert('Có lỗi xảy ra khi xóa dự án. Vui lòng thử lại.');
        }
    };

    // Start chat
    window.startChat = async function(freelancerId, projectId) {
        const token = getToken();
        if (!token) return;

        try {
            const response = await fetch(`${API_BASE}/api/v1/chat/start`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    participant2_id: freelancerId,
                    project_id: projectId
                })
            });

            if (response.ok) {
                const conversation = await response.json();
                window.location.href = `messages.html?conversation_id=${conversation.id}`;
            } else {
                const error = await response.json();
                alert(error.detail || 'Không thể bắt đầu cuộc trò chuyện.');
            }
        } catch (error) {
            console.error('Error starting chat:', error);
            alert('Có lỗi xảy ra khi bắt đầu cuộc trò chuyện.');
        }
    };

    // Auto-refresh when coming back from post_project.html
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('created') === 'true') {
        // Show success message
        setTimeout(() => {
            const successMsg = document.createElement('div');
            successMsg.style.cssText = 'position: fixed; top: 80px; right: 20px; background: var(--success-color); color: white; padding: 1rem 1.5rem; border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); z-index: 1001; animation: slideIn 0.3s ease-out;';
            successMsg.innerHTML = '<i class="fas fa-check-circle"></i> Đã tạo dự án thành công!';
            document.body.appendChild(successMsg);
            setTimeout(() => {
                successMsg.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => successMsg.remove(), 300);
            }, 3000);
        }, 100);
        // Remove query param
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    document.addEventListener('DOMContentLoaded', fetchProjects);
    
    // Refresh on focus (when user comes back from another tab)
    window.addEventListener('focus', () => {
        if (document.visibilityState === 'visible') {
            fetchProjects();
        }
    });
})();
