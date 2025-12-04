(function () {
    const state = {
        serviceId: null,
        service: null,
        isSubmitting: false
    };

    const CHECKOUT_CACHE_KEY = 'service_checkout_cache';
    const CACHE_TTL = 5 * 60 * 1000;

    const selectors = {
        title: document.getElementById('checkoutServiceTitle'),
        subtitle: document.getElementById('checkoutServiceSubtitle'),
        badge: document.getElementById('checkoutServiceBadge'),
        gallery: document.getElementById('checkoutGallery'),
        meta: document.getElementById('checkoutMeta'),
        description: document.getElementById('checkoutDescription'),
        price: document.getElementById('checkoutPrice'),
        delivery: document.getElementById('checkoutDelivery'),
        freelancer: document.getElementById('checkoutFreelancer'),
        extras: document.getElementById('checkoutExtras'),
        payBtn: document.getElementById('payNowBtn'),
        error: document.getElementById('checkoutError')
    };

    document.addEventListener('DOMContentLoaded', initCheckoutPage);

    async function initCheckoutPage() {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        if (!id) {
            renderError('Không tìm thấy mã gói dịch vụ.');
            return;
        }
        state.serviceId = Number(id);

        const cached = consumeCheckoutCache(id);
        if (cached) {
            state.service = cached;
            renderServiceSummary(cached);
        }

        await loadServiceDetail(id, Boolean(cached));
        bindEvents();
    }

    async function loadServiceDetail(serviceId, silent = false) {
        try {
            if (!silent) {
                setLoading(true);
            }
            const service = await resolveServiceFetcher()(serviceId);
            if (!service) {
                renderError('Không thể tải thông tin gói dịch vụ.');
                return;
            }
            state.service = service;
            renderServiceSummary(service);
            persistCheckoutCache(service);
        } catch (error) {
            console.error('loadServiceDetail error', error);
            renderError('Không thể tải thông tin gói dịch vụ.');
        } finally {
            if (!silent) {
            setLoading(false);
            }
        }
    }

    function renderServiceSummary(service) {
        if (selectors.title) selectors.title.textContent = service.name || 'Gói dịch vụ';
        if (selectors.subtitle) selectors.subtitle.textContent = service.description || 'Freelancer sẽ cập nhật chi tiết sau.';
        if (selectors.badge) selectors.badge.textContent = service.category || 'Gói dịch vụ';

        if (selectors.price) selectors.price.textContent = formatCurrency(service.price);
        if (selectors.delivery) selectors.delivery.textContent = `${service.delivery_days || 0} ngày`;

        // Render requirements form if exists
        renderRequirementsForm(service.requirements || []);

        if (selectors.gallery) {
            const gallery = service.gallery?.length ? service.gallery : [service.cover_image].filter(Boolean);
            if (!gallery.length) {
                selectors.gallery.innerHTML = `
                    <div class="empty-state small">
                        <i class="fas fa-image"></i>
                        <p>Gói chưa có hình ảnh minh họa</p>
                    </div>
                `;
            } else {
                selectors.gallery.innerHTML = gallery.map((url, index) => `
                    <figure class="checkout-gallery-item ${index === 0 ? 'highlight' : ''}">
                        <img src="${url}" alt="Media ${index + 1}">
                    </figure>
                `).join('');
            }
        }

        if (selectors.meta) {
            selectors.meta.innerHTML = `
                <div>
                    <span>Danh mục</span>
                    <strong>${service.category || 'Chưa phân loại'}</strong>
                </div>
                <div>
                    <span>Số lần chỉnh sửa</span>
                    <strong>${service.revisions || 0}</strong>
                </div>
                <div>
                    <span>Tổng đánh giá</span>
                    <strong>${formatRating(service.rating || service.profile?.rating)} ⭐</strong>
                </div>
            `;
        }

        if (selectors.description) {
            selectors.description.innerHTML = service.description
                ? `<p>${service.description.replace(/\n/g, '<br>')}</p>`
                : '<p class="text-muted">Freelancer chưa cập nhật mô tả chi tiết.</p>';
        }

        if (selectors.freelancer) {
            const avatar = service.profile?.avatar_url
                || `https://ui-avatars.com/api/?background=random&name=${encodeURIComponent(service.profile?.display_name || 'Freelancer')}`;
            selectors.freelancer.querySelector('img').src = avatar;
            selectors.freelancer.querySelector('p').textContent = service.profile?.display_name || 'Freelancer ẩn danh';
        }

        if (selectors.extras) {
            const deliverables = service.deliverables || [];
            selectors.extras.innerHTML = `
                <li><i class="fas fa-check-circle"></i> ${deliverables.length ? `${deliverables.length} hạng mục bàn giao` : 'Freelancer sẽ xác nhận deliverable sau'}</li>
                <li><i class="fas fa-shield-alt"></i> Thanh toán an toàn qua escrow</li>
                <li><i class="fas fa-comments"></i> Hỗ trợ chat & workspace ngay sau khi tạo đơn</li>
            `;
        }
    }

    function bindEvents() {
        if (selectors.payBtn) {
            selectors.payBtn.addEventListener('click', handlePayNow);
        }
    }

    async function handlePayNow() {
        if (!state.service || state.isSubmitting) return;
        if (typeof getToken !== 'function' || !getToken()) {
            const goLogin = confirm('Bạn cần đăng nhập để thanh toán. Chuyển tới trang đăng nhập?');
            if (goLogin) window.location.href = 'login.html';
            return;
        }

        // Validate requirements form
        const requirementsAnswers = collectRequirementsAnswers();
        if (!validateRequirements(requirementsAnswers)) {
            showError('Vui lòng trả lời đầy đủ các câu hỏi bắt buộc.');
            return;
        }

        // Store requirements answers in sessionStorage for payment page
        if (requirementsAnswers.length > 0) {
            sessionStorage.setItem('service_requirements_answers', JSON.stringify(requirementsAnswers));
        }

        // Chuyển sang trang payment với service_id
        window.location.href = `payment.html?service_id=${state.service.id}`;
    }

    function setLoading(isLoading) {
        document.body.classList.toggle('loading', !!isLoading);
        if (selectors.payBtn) selectors.payBtn.disabled = !!isLoading;
    }

    function setSubmitLoading(isLoading) {
        if (!selectors.payBtn) return;
        selectors.payBtn.disabled = !!isLoading;
        selectors.payBtn.innerHTML = isLoading
            ? '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...'
            : '<i class="fas fa-shield-check"></i> Thanh toán & tạo đơn hàng';
    }

    function showError(message) {
        if (!selectors.error) return;
        selectors.error.textContent = message;
        selectors.error.style.display = 'block';
    }

    function hideError() {
        if (!selectors.error) return;
        selectors.error.textContent = '';
        selectors.error.style.display = 'none';
    }

    function renderError(message) {
        const container = document.querySelector('.service-checkout-page .container');
        if (!container) return;
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-circle-exclamation"></i>
                <p>${message}</p>
                <a href="services.html" class="btn btn-primary">
                    <i class="fas fa-arrow-left"></i> Quay lại chợ dịch vụ
                </a>
            </div>
        `;
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

    function consumeCheckoutCache(serviceId) {
        if (typeof sessionStorage === 'undefined') return null;
        try {
            const raw = sessionStorage.getItem(CHECKOUT_CACHE_KEY);
            if (!raw) return null;
            const payload = JSON.parse(raw);
            if (Number(payload?.id) !== Number(serviceId)) {
                return null;
            }
            if (payload.expiresAt && payload.expiresAt < Date.now()) {
                sessionStorage.removeItem(CHECKOUT_CACHE_KEY);
                return null;
            }
            sessionStorage.removeItem(CHECKOUT_CACHE_KEY);
            return payload.data || null;
        } catch (error) {
            console.warn('consumeCheckoutCache error', error);
            return null;
        }
    }

    function persistCheckoutCache(service) {
        if (!service || typeof sessionStorage === 'undefined') return;
        try {
            sessionStorage.setItem(CHECKOUT_CACHE_KEY, JSON.stringify({
                id: service.id,
                data: service,
                expiresAt: Date.now() + CACHE_TTL
            }));
        } catch (error) {
            console.warn('persistCheckoutCache error', error);
        }
    }

    function resolveServiceFetcher() {
        if (typeof fetchServiceDetailForOrder === 'function') {
            return fetchServiceDetailForOrder;
        }
        return fetchServiceDetailDirect;
    }

    async function fetchServiceDetailDirect(serviceId) {
        try {
            const response = await fetch(`${API_BASE}/api/v1/services/${serviceId}`);
            if (!response.ok) {
                throw new Error('Không thể tải thông tin gói dịch vụ.');
            }
            return await response.json();
        } catch (error) {
            console.error('fetchServiceDetailDirect error', error);
            return null;
        }
    }

    function renderRequirementsForm(requirements) {
        const section = document.getElementById('requirementsSection');
        const form = document.getElementById('requirementsForm');
        if (!section || !form) return;

        if (!requirements || requirements.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        form.innerHTML = requirements.map((req, index) => {
            const reqId = `req_${index}`;
            const isRequired = req.required !== false; // Default to required if not specified
            const reqType = req.type || 'text';

            let inputHtml = '';
            if (reqType === 'textarea') {
                inputHtml = `
                    <textarea 
                        id="${reqId}" 
                        name="${reqId}" 
                        class="form-control" 
                        rows="4" 
                        placeholder="${req.placeholder || 'Nhập câu trả lời...'}"
                        ${isRequired ? 'required' : ''}
                    ></textarea>
                `;
            } else if (reqType === 'select' && req.options && Array.isArray(req.options)) {
                inputHtml = `
                    <select 
                        id="${reqId}" 
                        name="${reqId}" 
                        class="form-control"
                        ${isRequired ? 'required' : ''}
                    >
                        <option value="">-- Chọn --</option>
                        ${req.options.map(opt => `
                            <option value="${typeof opt === 'string' ? opt : opt.value || opt.label || opt}">
                                ${typeof opt === 'string' ? opt : opt.label || opt.value || opt}
                            </option>
                        `).join('')}
                    </select>
                `;
            } else if (reqType === 'checkbox' && req.options && Array.isArray(req.options)) {
                inputHtml = `
                    <div class="checkbox-group">
                        ${req.options.map((opt, optIdx) => {
                            const optId = `${reqId}_${optIdx}`;
                            const optValue = typeof opt === 'string' ? opt : opt.value || opt.label || opt;
                            const optLabel = typeof opt === 'string' ? opt : opt.label || opt.value || opt;
                            return `
                                <label class="checkbox-label">
                                    <input 
                                        type="checkbox" 
                                        id="${optId}" 
                                        name="${reqId}" 
                                        value="${optValue}"
                                        ${isRequired && optIdx === 0 ? 'required' : ''}
                                    >
                                    <span>${optLabel}</span>
                                </label>
                            `;
                        }).join('')}
                    </div>
                `;
            } else {
                // Default: text input
                inputHtml = `
                    <input 
                        type="text" 
                        id="${reqId}" 
                        name="${reqId}" 
                        class="form-control" 
                        placeholder="${req.placeholder || 'Nhập câu trả lời...'}"
                        ${isRequired ? 'required' : ''}
                    >
                `;
            }

            return `
                <div class="form-group requirement-item">
                    <label for="${reqId}">
                        ${req.question || 'Câu hỏi'}
                        ${isRequired ? '<span class="text-danger">*</span>' : ''}
                    </label>
                    ${inputHtml}
                    ${req.hint ? `<small class="form-hint text-muted">${req.hint}</small>` : ''}
                </div>
            `;
        }).join('');

        // Store requirements structure for validation
        state.requirements = requirements;
    }

    function collectRequirementsAnswers() {
        if (!state.requirements || state.requirements.length === 0) {
            return [];
        }

        return state.requirements.map((req, index) => {
            const reqId = `req_${index}`;
            const reqType = req.type || 'text';
            let answer = null;

            if (reqType === 'checkbox') {
                const checkboxes = document.querySelectorAll(`input[name="${reqId}"]:checked`);
                answer = Array.from(checkboxes).map(cb => cb.value);
            } else {
                const input = document.getElementById(reqId);
                if (input) {
                    answer = input.value.trim();
                }
            }

            return {
                question: req.question || `Câu hỏi ${index + 1}`,
                answer: answer || '',
                type: reqType
            };
        });
    }

    function validateRequirements(answers) {
        if (!state.requirements || state.requirements.length === 0) {
            return true; // No requirements, validation passes
        }

        for (let i = 0; i < state.requirements.length; i++) {
            const req = state.requirements[i];
            const isRequired = req.required !== false;
            const answer = answers[i];

            if (isRequired) {
                if (!answer || !answer.answer || 
                    (Array.isArray(answer.answer) && answer.answer.length === 0) ||
                    (typeof answer.answer === 'string' && answer.answer.trim() === '')) {
                    // Scroll to the first invalid field
                    const reqId = `req_${i}`;
                    const input = document.getElementById(reqId);
                    if (input) {
                        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        input.focus();
                    }
                    return false;
                }
            }
        }

        return true;
    }
})();

