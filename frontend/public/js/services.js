(function () {
    const state = {
        query: '',
        category: '',
        minPrice: '',
        maxPrice: '',
        maxDeliveryDays: '',
        minRating: '',
        tags: [],
        sort: 'recent',
        limit: 30,
        services: [],
        loading: false
    };

    const FEATURED_CATEGORIES = [
        { value: 'web-development', label: 'Website / FE Dev' },
        { value: 'mobile-app', label: 'Ứng dụng Mobile' },
        { value: 'ui-ux', label: 'UI/UX Design' },
        { value: 'branding', label: 'Branding' },
        { value: 'product-design', label: 'Product Design' },
        { value: 'no-code', label: 'No-code / Automation' }
    ];

    function initServiceMarketplace() {
        buildCategoryPills();
        bindFilters();
        hydrateFromQuery();
        fetchAndRender();
    }

    function buildCategoryPills() {
        const container = document.getElementById('categoryPills');
        if (!container) return;
        container.innerHTML = FEATURED_CATEGORIES.map(cat => `
            <button class="pill-btn" data-category="${cat.value}">
                ${cat.label}
            </button>
        `).join('');

        container.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-category]');
            if (!button) return;
            const current = button.dataset.category;
            if (state.category === current) {
                state.category = '';
            } else {
                state.category = current;
            }
            syncFilterInputs();
            highlightActivePills();
            fetchAndRender();
        });
    }

    function highlightActivePills() {
        document.querySelectorAll('.pill-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === state.category && state.category);
        });
    }

    function bindFilters() {
        const searchInput = document.getElementById('serviceSearchInput');
        const searchButton = document.getElementById('serviceSearchButton');
        const categorySelect = document.getElementById('serviceCategorySelect');
        const minPrice = document.getElementById('minPriceInput');
        const maxPrice = document.getElementById('maxPriceInput');
        const deliverySelect = document.getElementById('deliveryFilter');
        const ratingSelect = document.getElementById('ratingFilter');
        const tagInput = document.getElementById('tagInput');
        const sortSelect = document.getElementById('sortSelect');
        const clearBtn = document.getElementById('clearFiltersBtn');

        const debounce = (fn, delay = 400) => {
            let timeout;
            return (...args) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => fn.apply(null, args), delay);
            };
        };

        if (searchInput && searchButton) {
            searchButton.addEventListener('click', () => {
                state.query = searchInput.value.trim();
                fetchAndRender();
            });
            searchInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    state.query = searchInput.value.trim();
                    fetchAndRender();
                }
            });
        }

        if (categorySelect) {
            categorySelect.addEventListener('change', () => {
                state.category = categorySelect.value;
                highlightActivePills();
                fetchAndRender();
            });
        }

        if (minPrice) {
            minPrice.addEventListener('input', debounce(() => {
                state.minPrice = minPrice.value;
                fetchAndRender();
            }));
        }
        if (maxPrice) {
            maxPrice.addEventListener('input', debounce(() => {
                state.maxPrice = maxPrice.value;
                fetchAndRender();
            }));
        }
        if (deliverySelect) {
            deliverySelect.addEventListener('change', () => {
                state.maxDeliveryDays = deliverySelect.value;
                fetchAndRender();
            });
        }
        if (ratingSelect) {
            ratingSelect.addEventListener('change', () => {
                state.minRating = ratingSelect.value;
                fetchAndRender();
            });
        }
        if (tagInput) {
            tagInput.addEventListener('input', debounce(() => {
                const raw = tagInput.value.split(',').map(tag => tag.trim()).filter(Boolean);
                state.tags = raw;
                fetchAndRender();
            }, 600));
        }
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                state.sort = sortSelect.value || 'recent';
                fetchAndRender();
            });
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                Object.assign(state, {
                    query: '',
                    category: '',
                    minPrice: '',
                    maxPrice: '',
                    maxDeliveryDays: '',
                    minRating: '',
                    tags: [],
                    sort: 'recent'
                });
                syncFilterInputs();
                highlightActivePills();
                fetchAndRender();
            });
        }
    }

    function syncFilterInputs() {
        const searchInput = document.getElementById('serviceSearchInput');
        if (searchInput) searchInput.value = state.query;
        const categorySelect = document.getElementById('serviceCategorySelect');
        if (categorySelect) categorySelect.value = state.category;
        const minPrice = document.getElementById('minPriceInput');
        if (minPrice) minPrice.value = state.minPrice;
        const maxPrice = document.getElementById('maxPriceInput');
        if (maxPrice) maxPrice.value = state.maxPrice;
        const deliverySelect = document.getElementById('deliveryFilter');
        if (deliverySelect) deliverySelect.value = state.maxDeliveryDays;
        const ratingSelect = document.getElementById('ratingFilter');
        if (ratingSelect) ratingSelect.value = state.minRating;
        const tagInput = document.getElementById('tagInput');
        if (tagInput) tagInput.value = state.tags.join(', ');
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) sortSelect.value = state.sort;
    }

    function hydrateFromQuery() {
        const params = new URLSearchParams(window.location.search);
        state.query = params.get('q') || '';
        state.category = params.get('category') || '';
        state.minPrice = params.get('min_price') || '';
        state.maxPrice = params.get('max_price') || '';
        state.maxDeliveryDays = params.get('max_delivery') || '';
        state.minRating = params.get('min_rating') || '';
        const tagsParam = params.get('tags');
        state.tags = tagsParam ? tagsParam.split(',').map(t => t.trim()).filter(Boolean) : [];
        state.sort = params.get('sort') || 'recent';
        syncFilterInputs();
        highlightActivePills();
    }

    async function fetchAndRender() {
        const grid = document.getElementById('servicesGrid');
        const counter = document.getElementById('servicesCount');
        if (!grid) return;
        state.loading = true;
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Đang tải các gói dịch vụ...</p>
            </div>
        `;

        try {
            const params = new URLSearchParams();
            params.set('limit', String(state.limit));
            params.set('status_filter', 'approved');
            if (state.query) params.set('query', state.query);
            if (state.category) params.set('category', state.category);
            if (state.minPrice) params.set('min_price', state.minPrice);
            if (state.maxPrice) params.set('max_price', state.maxPrice);
            if (state.maxDeliveryDays) params.set('max_delivery_days', state.maxDeliveryDays);
            if (state.minRating) params.set('min_rating', state.minRating);
            if (state.tags.length) params.set('tags', state.tags.join(','));
            if (state.sort) params.set('sort', state.sort);

            const response = await fetch(`${API_BASE}/api/v1/services?${params.toString()}`);
            if (!response.ok) {
                throw new Error('Không thể tải danh sách dịch vụ.');
            }
            const services = await response.json();
            state.services = services;
            if (counter) {
                counter.textContent = `${services.length} gói`;
            }
            renderServicesGrid(services);
        } catch (error) {
            console.error('fetch services error', error);
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-circle-exclamation"></i>
                    <p>${error.message || 'Không thể tải danh sách dịch vụ.'}</p>
                </div>
            `;
            if (counter) {
                counter.textContent = '0 gói';
            }
        } finally {
            state.loading = false;
        }
    }

    function renderServicesGrid(services) {
        const grid = document.getElementById('servicesGrid');
        if (!grid) return;
        if (!services.length) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-boxes-stacked"></i>
                    <p>Không có gói phù hợp với bộ lọc hiện tại.</p>
                </div>
            `;
            return;
        }
        grid.innerHTML = services.map(service => {
            if (typeof registerServiceForOrder === 'function') {
                registerServiceForOrder(service);
            }
            return renderServiceCard(service);
        }).join('');
        grid.classList.toggle('masonry', services.length > 6);
    }

    function renderServiceCard(service) {
        const thumbnail = (service.gallery && service.gallery[0]) || service.cover_image || 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=600&q=80';
        const price = formatCurrency(service.price);
        const rating = formatRating(service.rating || service.profile?.rating);
        const freelancer = service.profile;
        const profileName = freelancer?.display_name || 'Freelancer ẩn danh';
        const avatar = freelancer?.avatar_url || 'https://ui-avatars.com/api/?background=random&name=' + encodeURIComponent(profileName);
        const profileLink = freelancer?.user_id ? `freelancer_profile.html?id=${freelancer.user_id}` : '#';
        const contactAction = freelancer?.user_id
            ? `contactFreelancer(${freelancer.user_id}, '${profileName.replace(/'/g, "\\'")}')`
            : `alert('Không thể liên hệ freelancer này.')`;

        return `
            <article class="service-card">
                <a class="service-thumb" href="service_detail.html?id=${service.id}" aria-label="Xem chi tiết dịch vụ ${service.name}">
                    <img src="${thumbnail}" alt="${service.name}">
                    <span class="service-delivery"><i class="fas fa-clock"></i> ${service.delivery_days} ngày</span>
                </a>
                <div class="service-info">
                    <div class="freelancer-mini-profile">
                        <img src="${avatar}" alt="${profileName}">
                        <div>
                            <a href="${profileLink}" class="freelancer-name">${profileName}</a>
                            <p class="freelancer-headline">${freelancer?.headline || 'Freelancer chuyên nghiệp'}</p>
                        </div>
                        <span class="rating-chip"><i class="fas fa-star"></i> ${rating}</span>
                    </div>
                    <a href="service_detail.html?id=${service.id}" class="service-title">${service.name}</a>
                    <p class="service-desc">${(service.description || '').slice(0, 120)}${service.description && service.description.length > 120 ? '...' : ''}</p>
                    <div class="service-meta">
                        <span><i class="fas fa-tags"></i> ${service.category || 'Không phân loại'}</span>
                        <span><i class="fas fa-sync"></i> ${service.revisions} lần chỉnh sửa</span>
                    </div>
                </div>
                <div class="service-card-footer">
                    <div class="service-price">
                        <span>Bắt đầu từ</span>
                        <strong>${price}</strong>
                    </div>
                    <div class="service-actions">
                        <button class="btn btn-light" onclick="${contactAction}">
                            <i class="fas fa-comment"></i> Liên hệ
                        </button>
                        <button class="btn btn-primary" onclick="orderService(${service.id})">
                            <i class="fas fa-cart-plus"></i> Đặt ngay
                        </button>
                    </div>
                </div>
            </article>
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

    document.addEventListener('DOMContentLoaded', initServiceMarketplace);
})();

