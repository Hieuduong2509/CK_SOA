var API_BASE = window.API_BASE || window.location.origin;

(function () {
    const biddingActiveListEl = document.getElementById('biddingActiveList');
    const gigActiveListEl = document.getElementById('gigActiveList');
    const tabButtons = document.querySelectorAll('.orders-tab-btn');
    const tabPanels = document.querySelectorAll('.orders-tab-panel');
    const clientFilterWrapper = document.getElementById('clientOrderFilters');
    const tabHeader = document.querySelector('.orders-tab-header');
    const urlParams = new URLSearchParams(window.location.search);
    const milestoneCache = {};

    let currentUser = null;
    let projects = [];
    let currentTab = 'bidding';
    let clientViewFilter = 'posted';
    let isFreelancerView = false;

    function switchOrdersTab(target) {
        currentTab = target;
        tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === target);
        });
        tabPanels.forEach(panel => {
            const panelId = panel.id === 'ordersTabBidding' ? 'bidding' : 'gig';
            panel.classList.toggle('active', panelId === target);
        });
    }

    function initTabs() {
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.tab;
                switchOrdersTab(target);
                if (clientFilterWrapper) {
                    const newFilter = target === 'gig' ? 'purchased' : 'posted';
                    setClientFilter(newFilter, false);
                }
            });
        });
        const initialTabParam = urlParams.get('tab');
        switchOrdersTab(initialTabParam === 'gig' ? 'gig' : 'bidding');
    }
    initTabs();

    function resolveRole(user) {
        if (!user) return '';
        const rawRole = typeof user.role === 'object' ? (user.role && (user.role.value || user.role.name)) : user.role;
        return String(rawRole || '').toLowerCase();
    }

    function isClient(user) {
        return resolveRole(user) === 'client';
    }

    function isFreelancer(user) {
        return resolveRole(user) === 'freelancer';
    }

    function showGlobalMessage(message) {
        if (biddingActiveListEl) biddingActiveListEl.innerHTML = `<p class="text-muted">${message}</p>`;
        if (gigActiveListEl) gigActiveListEl.innerHTML = `<p class="text-muted">${message}</p>`;
    }

    function statusChip(status) {
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
        const info = statusMap[statusLower] || { label: status || '—', class: statusLower };
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
                headers: { 'Authorization': `Bearer ${token}` }
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

    async function renderBiddingProjects(list) {
        if (!biddingActiveListEl) return;
        const activeStatuses = ['draft', 'pending_approval', 'open', 'in_progress', 'delivered'];

        if (!list.length) {
            biddingActiveListEl.innerHTML = `<p class="text-muted">Chưa có dự án nào đang xử lý.</p>`;
            return;
        }

        const enriched = await Promise.all(
            list.map(async (project) => {
                if (project.bids_count !== undefined && project.bids_count !== null) {
                    return project;
                }
                const bidsCount = await fetchBidsCount(project.id);
                return { ...project, bids_count: bidsCount };
            })
        );

        const activeProjects = enriched.filter(p => activeStatuses.includes((p.status || '').toLowerCase()));

        biddingActiveListEl.innerHTML = activeProjects.length
            ? activeProjects.map(renderBiddingCard).join('')
            : `<p class="text-muted">Chưa có dự án nào đang xử lý.</p>`;
    }

    function renderBiddingCard(project) {
        return `
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
                </div>
                <div class="project-card-actions">
                    ${isClient(currentUser) ? `
                        <button class="btn btn-primary btn-small" onclick="viewProjectBids(${project.id})">
                            <i class="fas fa-eye"></i> Xem người apply (${project.bids_count || 0})
                        </button>
                    ` : ''}
                    <a class="btn btn-secondary btn-small" href="workspace.html?project_id=${project.id}">
                        <i class="fas fa-briefcase"></i> Workspace
                    </a>
                    ${(project.status || '').toLowerCase() === 'draft' ? `
                        <button class="btn btn-warning btn-small" onclick="publishProject(${project.id})">
                            <i class="fas fa-paper-plane"></i> Gửi duyệt
                        </button>
                    ` : ''}
                    ${['draft', 'pending_approval', 'open'].includes((project.status || '').toLowerCase()) ? `
                        <button class="btn btn-danger btn-small" onclick="deleteProject(${project.id}, '${(project.title || '').replace(/'/g, "\\'")}')">
                            <i class="fas fa-trash"></i> Xóa
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    function renderGigOrders(list) {
        if (!gigActiveListEl) return;
        const activeStatuses = ['in_progress', 'open', 'pending_approval', 'delivered'];

        const activeOrders = list.filter(p => activeStatuses.includes((p.status || '').toLowerCase()));

        gigActiveListEl.innerHTML = activeOrders.length
            ? activeOrders.map(renderGigCard).join('')
            : `<p class="text-muted">Chưa có đơn hàng dịch vụ nào đang xử lý.</p>`;
    }

    function renderGigCard(project) {
        const status = (project.status || '').toLowerCase();
        const snapshot = project.service_snapshot || {};
        const viewerIsClient = isClient(currentUser);
        const actions = [];
        if (isFreelancer(currentUser) && status === 'in_progress') {
            actions.push(`
                <button class="btn btn-primary btn-small" onclick="deliverGigOrder(${project.id})">
                    <i class="fas fa-paper-plane"></i> Giao hàng
                </button>
            `);
        }
        if (isClient(currentUser) && status === 'in_progress') {
            actions.push(`
                <button class="btn btn-success btn-small" onclick="approveGigOrder(${project.id})">
                    <i class="fas fa-check"></i> Nghiệm thu & Thanh toán
                </button>
            `);
        }
        actions.push(`
            <a class="btn btn-secondary btn-small" href="workspace.html?project_id=${project.id}">
                <i class="fas fa-briefcase"></i> Workspace
            </a>
        `);

        const serviceTitle = snapshot.name || project.title || `Đơn dịch vụ #${project.id}`;
        const cover = snapshot.cover_image || (Array.isArray(snapshot.gallery) && snapshot.gallery[0]) || 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80';
        const freelancerName = snapshot.freelancer?.name || `Freelancer #${project.freelancer_id || ''}`;
        const categoryLabel = snapshot.category || project.category || 'Gói dịch vụ';
        const deliveryText = snapshot.delivery_days ? `${snapshot.delivery_days} ngày` : formatDate(project.deadline);
        const counterpart = viewerIsClient
            ? `<span><i class="fas fa-user"></i> Freelancer: ${freelancerName}</span>`
            : `<span><i class="fas fa-user"></i> Khách hàng #${project.client_id}</span>`;
        const serviceCode = snapshot.service_id ? `<span><i class="fas fa-barcode"></i> Gói #${snapshot.service_id}</span>` : '';

        return `
            <div class="gig-card">
                <img class="gig-card-cover" src="${cover}" alt="${serviceTitle}">
                <div class="gig-card-header">
                    <div>
                        <h3>${serviceTitle}</h3>
                        <p class="text-muted">${categoryLabel} • ${deliveryText || 'Chưa xác định'}</p>
                    </div>
                    ${statusChip(project.status)}
                </div>
                <div class="gig-card-meta">
                    <span><i class="fas fa-tag"></i> Giá trị gói: ${formatCurrency(project.budget)}</span>
                    <span><i class="fas fa-calendar-alt"></i> Tạo ngày: ${formatDate(project.created_at)}</span>
                    <span><i class="fas fa-calendar-check"></i> Deadline dự kiến: ${formatDate(project.deadline)}</span>
                    ${counterpart}
                    ${serviceCode}
                </div>
                <div class="gig-card-actions">
                    ${actions.join('')}
                </div>
            </div>
        `;
    }

    async function fetchProjects() {
        const token = getToken();
        if (!token) {
            showGlobalMessage('Vui lòng đăng nhập để xem danh sách đơn hàng và dự án của bạn.');
            return;
        }

        currentUser = getCurrentUserProfile();
        if (!currentUser) {
            currentUser = await fetchCurrentUser();
        }
        if (!currentUser) {
            showGlobalMessage('Vui lòng đăng nhập để xem danh sách đơn hàng và dự án của bạn.');
            return;
        }

        const params = new URLSearchParams();
        const initialTabParam = urlParams.get('tab');
        const postProjectBtn = document.getElementById('postProjectBtn');
        
        if (isClient(currentUser)) {
            params.append('client_id', currentUser.id);
            if (clientFilterWrapper) {
                clientFilterWrapper.style.display = 'flex';
                if (tabHeader) {
                    tabHeader.style.display = 'none';
                }
                initClientFilters(initialTabParam === 'gig' ? 'purchased' : 'posted');
            }
            // Hiển thị nút "Đăng dự án mới" cho client
            if (postProjectBtn) {
                postProjectBtn.style.display = 'inline-flex';
            }
        } else if (isFreelancer(currentUser)) {
            params.append('freelancer_id', currentUser.id);
            if (initialTabParam === 'gig') {
                switchOrdersTab('gig');
            }
            // Ẩn nút "Đăng dự án mới" cho freelancer
            if (postProjectBtn) {
                postProjectBtn.style.display = 'none';
            }
            // Hiển thị thanh filter giống như bên user (posted/purchased/completed)
            if (clientFilterWrapper) {
                clientFilterWrapper.style.display = 'flex';
                if (tabHeader) {
                    tabHeader.style.display = 'none';
                }
                // Mặc định: nếu có ?tab=gig -> chọn 'purchased', ngược lại 'posted'
                initClientFilters(initialTabParam === 'gig' ? 'purchased' : 'posted');
            }
        }

        try {
            const response = await fetch(`${API_BASE}/api/v1/projects?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                showGlobalMessage('Không thể tải danh sách dự án. Vui lòng thử lại sau.');
                return;
            }
            projects = await response.json();
            renderProjectsForCurrentFilter();
        } catch (error) {
            console.error('fetchProjects error', error);
            showGlobalMessage('Không thể tải danh sách dự án. Vui lòng thử lại sau.');
        }
    }

    function initClientFilters(defaultFilter) {
        if (!clientFilterWrapper) return;
        setClientFilter(defaultFilter || 'posted', false);
        clientFilterWrapper.addEventListener('click', (event) => {
            const btn = event.target.closest('button[data-filter]');
            if (!btn) return;
            setClientFilter(btn.dataset.filter || 'posted', true);
        });
    }

    function setClientFilter(filter, syncTab = true) {
        if (!clientFilterWrapper) return;
        clientViewFilter = filter;
        clientFilterWrapper.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        if (syncTab) {
            // Chỉ tự động chuyển tab khi chọn 2 filter chính:
            // - 'purchased' -> tab Đơn dịch vụ
            // - 'posted'    -> tab Dự án đấu thầu
            // Với filter 'completed' thì giữ nguyên tab hiện tại,
            // để người dùng xem riêng đơn hoàn thành của từng loại.
            if (filter === 'purchased') {
                switchOrdersTab('gig');
            } else if (filter === 'posted') {
                switchOrdersTab('bidding');
            }
        }
        renderProjectsForCurrentFilter();
    }

    function renderProjectsForCurrentFilter() {
        const completedSection = document.getElementById('completedOrdersSection');
        const completedBiddingList = document.getElementById('completedBiddingList');
        const completedGigList = document.getElementById('completedGigList');
        const biddingTabPanel = document.getElementById('ordersTabBidding');
        const gigTabPanel = document.getElementById('ordersTabGig');

        if (!Array.isArray(projects) || !projects.length) {
            renderBiddingProjects([]);
            renderGigOrders([]);
            if (completedSection && completedBiddingList && completedGigList) {
                completedSection.style.display = clientViewFilter === 'completed' ? 'block' : 'none';
                completedBiddingList.innerHTML = `<p class="text-muted">Chưa có dự án nào đã hoàn tất.</p>`;
                completedGigList.innerHTML = `<p class="text-muted">Chưa có đơn dịch vụ nào đã hoàn tất.</p>`;
            }
            if (biddingTabPanel && gigTabPanel) {
                const showTabs = clientViewFilter !== 'completed';
                biddingTabPanel.style.display = showTabs ? '' : 'none';
                gigTabPanel.style.display = showTabs ? '' : 'none';
            }
            return;
        }

        const visible = projects.slice();
        const gigProjects = visible.filter(p => String(p.project_type || '').toUpperCase() === 'GIG_ORDER');
        const biddingProjects = visible.filter(p => String(p.project_type || 'BIDDING').toUpperCase() !== 'GIG_ORDER');

        const activeStatuses = ['draft', 'pending_approval', 'open', 'in_progress', 'delivered'];
        const completedStatuses = ['completed', 'cancelled'];

        const completedBidding = biddingProjects.filter(p => completedStatuses.includes(String(p.status || '').toLowerCase()));
        const completedGigs = gigProjects.filter(p => completedStatuses.includes(String(p.status || '').toLowerCase()));

        // Tab “Dự án tôi đăng” / “Đơn dịch vụ tôi mua” chỉ hiện đang xử lý
        if (clientViewFilter === 'posted') {
            const activeBidding = biddingProjects.filter(p => activeStatuses.includes(String(p.status || '').toLowerCase()));
            renderBiddingProjects(activeBidding);
            renderGigOrders([]);
        } else if (clientViewFilter === 'purchased') {
            const activeGigs = gigProjects.filter(p => activeStatuses.includes(String(p.status || '').toLowerCase()));
            renderBiddingProjects([]);
            renderGigOrders(activeGigs);
        } else {
            // Filter 'completed' → ẩn 2 tab, chỉ show danh sách hoàn tất tổng
            renderBiddingProjects([]);
            renderGigOrders([]);
        }

        if (biddingTabPanel && gigTabPanel) {
            const showTabs = clientViewFilter !== 'completed';
            biddingTabPanel.style.display = showTabs ? '' : 'none';
            gigTabPanel.style.display = showTabs ? '' : 'none';
        }

        if (completedSection && completedBiddingList && completedGigList) {
            if (clientViewFilter === 'completed') {
                completedSection.style.display = 'block';

                completedBiddingList.innerHTML = completedBidding.length
                    ? completedBidding.map(p => `
                        <div class="card project-card" data-project-id="${p.id}">
                            <div class="project-card-header">
                                <h3>${p.title || `Dự án #${p.id}`}</h3>
                                ${statusChip(p.status)}
                            </div>
                            <div class="project-card-meta">
                                <div class="meta-row">
                                    <span><i class="fas fa-tag"></i> Dự án đấu thầu</span>
                                    <span><i class="fas fa-coins"></i> Giá: ${formatCurrency(p.budget)}</span>
                                </div>
                                <div class="meta-row">
                                    <span><i class="fas fa-calendar-alt"></i> Tạo ngày: ${formatDate(p.created_at)}</span>
                                    <span><i class="fas fa-calendar-check"></i> Deadline: ${formatDate(p.deadline)}</span>
                                </div>
                            </div>
                            <div class="project-card-actions">
                                <a class="btn btn-secondary btn-small" href="workspace.html?project_id=${p.id}">
                                    <i class="fas fa-briefcase"></i> Xem workspace
                                </a>
                            </div>
                        </div>
                    `).join('')
                    : `<p class="text-muted">Chưa có dự án nào đã hoàn tất.</p>`;

                completedGigList.innerHTML = completedGigs.length
                    ? completedGigs.map(p => {
                        const title = p.service_snapshot ? (p.service_snapshot.name || p.title || `Đơn #${p.id}`) : (p.title || `Đơn #${p.id}`);
                        return `
                            <div class="card project-card" data-project-id="${p.id}">
                                <div class="project-card-header">
                                    <h3>${title}</h3>
                                    ${statusChip(p.status)}
                                </div>
                                <div class="project-card-meta">
                                    <div class="meta-row">
                                        <span><i class="fas fa-tag"></i> Đơn dịch vụ</span>
                                        <span><i class="fas fa-coins"></i> Giá: ${formatCurrency(p.budget)}</span>
                                    </div>
                                    <div class="meta-row">
                                        <span><i class="fas fa-calendar-alt"></i> Tạo ngày: ${formatDate(p.created_at)}</span>
                                        <span><i class="fas fa-calendar-check"></i> Deadline: ${formatDate(p.deadline)}</span>
                                    </div>
                                </div>
                                <div class="project-card-actions">
                                    <a class="btn btn-secondary btn-small" href="workspace.html?project_id=${p.id}">
                                        <i class="fas fa-briefcase"></i> Xem workspace
                                    </a>
                                </div>
                            </div>
                        `;
                    }).join('')
                    : `<p class="text-muted">Chưa có đơn dịch vụ nào đã hoàn tất.</p>`;
            } else {
                completedSection.style.display = 'none';
            }
        }
    }

    async function getGigPrimaryMilestone(projectId) {
        if (milestoneCache[projectId]) {
            return milestoneCache[projectId];
        }
        const token = getToken();
        if (!token) throw new Error('Bạn cần đăng nhập lại.');
        const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/milestones`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error('Không thể lấy milestone của đơn hàng.');
        }
        const milestones = await response.json();
        if (!milestones.length) {
            throw new Error('Đơn hàng chưa có milestone.');
        }
        milestoneCache[projectId] = milestones[0];
        return milestoneCache[projectId];
    }

    window.deliverGigOrder = async function (projectId) {
        const note = prompt('Mô tả khi giao hàng:');
        if (note === null) return;
        const links = prompt('Nhập link file (tùy chọn, cách nhau bằng dấu phẩy):');
        const fileUrls = links ? links.split(',').map(item => item.trim()).filter(Boolean) : [];
        try {
            const milestone = await getGigPrimaryMilestone(projectId);
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/milestones/${milestone.id}/submit`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description: note || 'Đã bàn giao sản phẩm',
                    file_urls: fileUrls
                })
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.detail || 'Không thể giao hàng.');
            }
            alert('Đã gửi bài giao hàng cho khách.');
            await fetchProjects();
        } catch (error) {
            alert(error.message || 'Không thể giao hàng.');
        }
    };

    window.approveGigOrder = async function (projectId) {
        if (!confirm('Xác nhận nghiệm thu & thanh toán cho đơn này?')) return;
        try {
            const milestone = await getGigPrimaryMilestone(projectId);
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/milestones/${milestone.id}/approve`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.detail || 'Không thể nghiệm thu.');
            }
            alert('Đã nghiệm thu. Thanh toán sẽ tự động chuyển cho freelancer.');
            await fetchProjects();
        } catch (error) {
            alert(error.message || 'Không thể nghiệm thu.');
        }
    };

    // Existing modals and actions (bidding flow)
    window.viewProjectBids = async function (projectId) {
        const token = getToken();
        if (!token) return;

        try {
            const bidsResponse = await fetch(`${API_BASE}/api/v1/projects/${projectId}/bids`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!bidsResponse.ok) {
                alert('Không thể tải danh sách người apply.');
                return;
            }
            const bids = await bidsResponse.json();

            const projectResponse = await fetch(`${API_BASE}/api/v1/projects/${projectId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const project = projectResponse.ok ? await projectResponse.json() : null;

            const bidsWithProfiles = await Promise.all(
                bids.map(async (bid) => {
                    try {
                        const profileResponse = await fetch(`${API_BASE}/api/v1/users/${bid.freelancer_id}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
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

            const projectTitle = project && project.title ? project.title : 'Dự án';
            const currentStatus = project && project.status ? String(project.status).toLowerCase() : '';

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
                    <div class="modal-header">
                        <h2>Danh sách người apply - ${projectTitle}</h2>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        ${bidsWithProfiles.length === 0
                            ? '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Chưa có ai apply cho dự án này.</p>'
                            : bidsWithProfiles.map(bid => {
                                const profile = bid.profile;
                                return `
                                <div class="bid-card" style="border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 1rem;">
                                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                                        <div style="flex: 1;">
                                            <h3 style="margin: 0 0 0.5rem 0;">
                                                ${profile ? `<a href="freelancer_profile.html?id=${profile.user_id}" target="_blank" style="color: var(--primary-color); text-decoration: none;">${profile.headline || 'Freelancer'}</a>` : `Freelancer #${bid.freelancer_id}`}
                                            </h3>
                                            <p style="color: var(--text-secondary); margin: 0.5rem 0;">
                                                <strong>Giá đề xuất:</strong> ${formatCurrency(bid.price)} |
                                                <strong>Thời gian hoàn thành:</strong> ${bid.timeline_days} ngày
                                            </p>
                                        </div>
                                        <div style="display: flex; gap: 0.5rem; flex-shrink: 0;">
                                            <button class="btn btn-primary btn-small" onclick="startChat(${bid.freelancer_id}, ${projectId})" title="Nhắn tin">
                                                <i class="fas fa-comment"></i> Nhắn tin
                                            </button>
                                            ${currentStatus === 'open' ? `
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
                            }).join('')}
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

    window.acceptBid = async function (projectId, bidId) {
        if (!confirm('Bạn có chắc chắn muốn duyệt người apply này không? Bạn sẽ được chuyển đến trang thanh toán.')) return;
        // Redirect to payment page with project_id and bid_id
        window.location.href = `payment.html?project_id=${projectId}&bid_id=${bidId}`;
    };

    window.publishProject = async function (projectId) {
        if (!confirm('Bạn có muốn gửi dự án này để admin duyệt không?\n\nSau khi được duyệt, dự án sẽ hiển thị cho các freelancer.')) return;
        const token = getToken();
        if (!token) return;

        try {
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
                await fetchProjects();
            } else {
                const error = await response.json().catch(() => ({}));
                alert(error.detail || 'Không thể gửi duyệt. Vui lòng thử lại.');
            }
        } catch (error) {
            console.error('Error publishing project:', error);
            alert('Có lỗi xảy ra khi gửi duyệt dự án.');
        }
    };

    window.deleteProject = async function (projectId, projectTitle) {
        if (!confirm(`Bạn có chắc chắn muốn xóa dự án "${projectTitle || 'này'}" không?`)) return;
        const token = getToken();
        if (!token) {
            alert('Bạn cần đăng nhập để thực hiện thao tác này.');
            window.location.href = 'login.html';
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.ok) {
                alert('Đã xóa dự án thành công!');
                await fetchProjects();
            } else {
                const errorData = await response.json().catch(() => ({}));
                alert(errorData.detail || 'Không thể xóa dự án. Vui lòng thử lại.');
            }
        } catch (error) {
            console.error('Error deleting project:', error);
            alert('Có lỗi xảy ra khi xóa dự án.');
        }
    };

    window.startChat = async function (freelancerId, projectId) {
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
                const error = await response.json().catch(() => ({}));
                alert(error.detail || 'Không thể bắt đầu cuộc trò chuyện.');
            }
        } catch (error) {
            console.error('Error starting chat:', error);
            alert('Có lỗi xảy ra khi bắt đầu cuộc trò chuyện.');
        }
    };

    if (urlParams.get('created') === 'true') {
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
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    document.addEventListener('DOMContentLoaded', fetchProjects);
    window.addEventListener('focus', () => {
        if (document.visibilityState === 'visible') {
            fetchProjects();
        }
    });
})();

