(function () {
    const registry = {};
    const CHECKOUT_CACHE_KEY = "service_checkout_cache";
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    function registerServiceForOrder(service) {
        if (service && typeof service === "object" && service.id) {
            registry[service.id] = service;
        }
        return service;
    }

    function getRegisteredService(serviceId) {
        return registry[serviceId] || null;
    }

    async function fetchServiceDetail(serviceId) {
        try {
            const response = await fetch(`${API_BASE}/api/v1/services/${serviceId}`);
            if (!response.ok) {
                throw new Error("Không thể tải thông tin gói dịch vụ.");
            }
            const service = await response.json();
            return registerServiceForOrder(service);
        } catch (error) {
            console.error("fetchServiceDetail error", error);
            return null;
        }
    }

    function persistCheckoutCache(service) {
        if (!service || !service.id || typeof sessionStorage === "undefined") return;
        try {
            const payload = {
                id: service.id,
                data: service,
                expiresAt: Date.now() + CACHE_TTL
            };
            sessionStorage.setItem(CHECKOUT_CACHE_KEY, JSON.stringify(payload));
        } catch (error) {
            console.warn("persistCheckoutCache error", error);
        }
    }

    async function orderService(serviceId, options = {}) {
        const token = typeof getToken === "function" ? getToken() : null;
        if (!token) {
            const goLogin = confirm("Bạn cần đăng nhập để đặt gói dịch vụ. Chuyển tới trang đăng nhập?");
            if (goLogin) {
                window.location.href = "login.html";
            }
            return;
        }

        let service = options.service || getRegisteredService(serviceId);
        if (!service) {
            service = await fetchServiceDetail(serviceId);
        }

        if (service) {
            persistCheckoutCache(service);
        }

        window.location.href = `service_checkout.html?id=${serviceId}`;
    }

    async function submitServiceOrder(serviceId, requirementsAnswers) {
        const token = typeof getToken === "function" ? getToken() : null;
        if (!token) {
            throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        }

        const response = await fetch(`${API_BASE}/api/v1/projects/create-from-service`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                service_id: serviceId,
                requirements_answers: requirementsAnswers || []
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || "Không thể đặt gói ngay lúc này.");
        }

        return response.json();
    }

    window.registerServiceForOrder = registerServiceForOrder;
    window.orderService = orderService;
    window.submitServiceOrderRequest = submitServiceOrder;
    window.fetchServiceDetailForOrder = fetchServiceDetail;
})();

