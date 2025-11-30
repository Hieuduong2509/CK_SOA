(function () {
    const state = {
        serviceId: null,
        service: null
    };

    function initServiceDetail() {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        if (!id) {
            renderError('Không tìm thấy mã dịch vụ.');
            return;
        }
        state.serviceId = id;
        loadServiceDetail(id);
    }

    async function loadServiceDetail(serviceId) {
        try {
            const response = await fetch(`${API_BASE}/api/v1/services/${serviceId}`);
            if (!response.ok) {
                throw new Error('Không thể tải thông tin dịch vụ.');
            }
            const service = await response.json();
            state.service = service;
            if (typeof registerServiceForOrder === 'function') {
                registerServiceForOrder(service);
            }
            renderServiceHero(service);
            renderServiceDescription(service);
            renderRequirements(service);
            renderFAQ(service);
            renderFreelancerCard(service.profile);
            loadRelatedServices(service);
            bindActions(service);
        } catch (error) {
            renderError(error.message || 'Không thể tải thông tin dịch vụ.');
        }
    }

    function renderError(message) {
        const container = document.querySelector('.service-detail-page .container');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-circle-exclamation"></i>
                    <p>${message}</p>
                    <a href="services.html" class="btn btn-primary">Quay lại chợ dịch vụ</a>
                </div>
            `;
        }
    }

    function renderServiceHero(service) {
        document.getElementById('serviceCategory').textContent = service.category
            ? `${service.category} • ${service.delivery_days} ngày`
            : `Giao trong ${service.delivery_days} ngày`;
        document.getElementById('serviceTitle').textContent = service.name;
        document.getElementById('serviceSubtitle').textContent = service.description || '';
        document.getElementById('servicePrice').textContent = formatCurrency(service.price);
        document.getElementById('serviceRating').innerHTML = `<i class="fas fa-star"></i> ${formatRating(service.rating || service.profile?.rating)}`;

        const metaRow = document.getElementById('serviceMetaRow');
        if (metaRow) {
            metaRow.innerHTML = `
                <span><i class="fas fa-box"></i> ${service.deliverables?.length || 0} deliverable</span>
                <span><i class="fas fa-sync-alt"></i> ${service.revisions} lần chỉnh sửa</span>
                <span><i class="fas fa-language"></i> ${service.profile?.languages?.join(', ') || 'Vietnamese/English'}</span>
            `;
        }

        const gallery = document.getElementById('serviceGallery');
        if (gallery) {
            const images = service.gallery?.length ? service.gallery : [service.cover_image].filter(Boolean);
            if (!images.length) {
                gallery.innerHTML = `
                    <div class="empty-state small">
                        <i class="fas fa-image"></i>
                        <p>Chưa có ảnh mẫu cho dịch vụ này</p>
                    </div>
                `;
            } else {
                gallery.innerHTML = images.map((url, index) => `
                    <figure class="gallery-item ${index === 0 ? 'featured' : ''}">
                        <img src="${url}" alt="Ảnh minh họa dịch vụ ${service.name}">
                    </figure>
                `).join('');
            }
        }
    }

    function renderServiceDescription(service) {
        const description = document.getElementById('serviceDescription');
        if (description) {
            description.innerHTML = service.description
                ? `<p>${service.description.replace(/\n/g, '<br>')}</p>`
                : '<p class="text-muted">Freelancer chưa cập nhật mô tả chi tiết cho gói này.</p>';
        }

        const deliverablesList = document.getElementById('deliverablesList');
        if (deliverablesList) {
            const deliverables = service.deliverables || [];
            if (!deliverables.length) {
                deliverablesList.innerHTML = '<p class="text-muted">Freelancer chưa liệt kê đầu mục bàn giao.</p>';
            } else {
                deliverablesList.innerHTML = `
                    <h3>Bàn giao bao gồm</h3>
                    <ul>
                        ${deliverables.map(item => `<li><i class="fas fa-check-circle"></i> ${item}</li>`).join('')}
                    </ul>
                `;
            }
        }
    }

    function renderRequirements(service) {
        const section = document.getElementById('requirementsSection');
        const list = document.getElementById('requirementsList');
        if (!section || !list) return;
        const requirements = service.requirements || [];
        if (!requirements.length) {
            section.style.display = 'none';
            return;
        }
        section.style.display = 'block';
        list.innerHTML = requirements.map(req => `
            <li>
                <strong>${req.question || req.label || 'Yêu cầu'}</strong>
                ${req.hint ? `<span>${req.hint}</span>` : ''}
            </li>
        `).join('');
    }

    function renderFAQ(service) {
        const section = document.getElementById('faqSection');
        const list = document.getElementById('faqList');
        if (!section || !list) return;
        const faq = service.faq || [];
        if (!faq.length) {
            section.style.display = 'none';
            return;
        }
        section.style.display = 'block';
        list.innerHTML = faq.map(item => `
            <article class="faq-item">
                <h4>${item.question || 'Câu hỏi'}</h4>
                <p>${item.answer || 'Freelancer sẽ cập nhật nội dung này sau.'}</p>
            </article>
        `).join('');
    }

    function renderFreelancerCard(profile) {
        if (!profile) {
            document.getElementById('freelancerCard').style.display = 'none';
            return;
        }
        const avatarEl = document.getElementById('freelancerAvatar');
        avatarEl.src = profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name || 'Freelancer')}`;
        avatarEl.alt = profile.display_name || 'Freelancer';

        document.getElementById('freelancerName').textContent = profile.display_name || 'Freelancer ẩn danh';
        document.getElementById('freelancerHeadline').textContent = profile.headline || 'Chưa cập nhật mô tả';
        document.getElementById('freelancerRating').innerHTML = `<i class="fas fa-star"></i> ${formatRating(profile.rating)} (${profile.total_reviews || 0})`;
        document.getElementById('freelancerMeta').innerHTML = `
            <span><i class="fas fa-map-marker-alt"></i> ${profile.location || 'Remote'}</span>
            <span><i class="fas fa-briefcase"></i> ${profile.total_projects || 0} dự án</span>
            <span><i class="fas fa-tags"></i> ${(profile.categories || []).slice(0, 3).join(', ') || 'Đa lĩnh vực'}</span>
        `;
        const profileLink = document.getElementById('freelancerProfileLink');
        if (profile.user_id) {
            profileLink.href = `freelancer_profile.html?id=${profile.user_id}`;
        } else {
            profileLink.style.display = 'none';
        }
    }

    async function loadRelatedServices(service) {
        const listContainer = document.getElementById('relatedServicesList');
        if (!service?.profile?.user_id || !listContainer) {
            if (listContainer) {
                listContainer.innerHTML = '<p class="text-muted">Không tìm thấy dịch vụ khác.</p>';
            }
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/api/v1/users/${service.profile.user_id}/packages?status_filter=approved`);
            if (!response.ok) throw new Error();
            const packages = (await response.json()).filter(pkg => pkg.id !== service.id).slice(0, 3);
            if (!packages.length) {
                listContainer.innerHTML = '<p class="text-muted">Freelancer chưa có thêm gói nào.</p>';
                return;
            }
            listContainer.innerHTML = packages.map(pkg => {
                if (typeof registerServiceForOrder === 'function') {
                    registerServiceForOrder(pkg);
                }
                return `
                    <article class="related-item">
                        <div>
                            <a href="service_detail.html?id=${pkg.id}">${pkg.name}</a>
                            <small>${pkg.delivery_days} ngày • ${pkg.revisions} lần chỉnh sửa</small>
                        </div>
                        <strong>${formatCurrency(pkg.price)}</strong>
                        <button class="btn btn-link" onclick="orderService(${pkg.id})">Đặt</button>
                    </article>
                `;
            }).join('');
        } catch {
            listContainer.innerHTML = '<p class="text-danger">Không thể tải dịch vụ liên quan.</p>';
        }
    }

    function bindActions(service) {
        const contactBtn = document.getElementById('contactBtn');
        if (contactBtn) {
            if (service?.profile?.user_id) {
                contactBtn.addEventListener('click', () => contactFreelancer(
                    service.profile.user_id,
                    service.profile.display_name || 'Freelancer'
                ));
            } else {
                contactBtn.disabled = true;
            }
        }
        const orderBtn = document.getElementById('orderBtn');
        if (orderBtn) {
            orderBtn.addEventListener('click', () => orderService(service.id));
        }
    }

    function formatCurrency(value) {
        const amount = Number(value) || 0;
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            maximumFractionDigits: 0
        }).format(amount);
    }

    function formatRating(value) {
        const rating = Number(value) || 0;
        return rating.toFixed(1);
    }

    document.addEventListener('DOMContentLoaded', initServiceDetail);
})();

