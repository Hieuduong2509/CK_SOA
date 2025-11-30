(function () {
    var state = {
        projectId: null,
        freelancerId: null,
        project: null,
        user: null,
        submitting: false
    };

    var selectors = {
        info: document.getElementById('reviewProjectInfo'),
        starsContainer: document.getElementById('reviewPageStars'),
        ratingInput: document.getElementById('reviewPageRatingValue'),
        commentInput: document.getElementById('reviewPageComment'),
        error: document.getElementById('reviewPageError'),
        submitBtn: document.getElementById('reviewSubmitBtn')
    };

    document.addEventListener('DOMContentLoaded', initReviewPage);

    async function initReviewPage() {
        var params = new URLSearchParams(window.location.search);
        var projectId = params.get('project_id');
        var freelancerIdParam = params.get('freelancer_id');
        if (!projectId) {
            renderErrorInfo('Không tìm thấy thông tin dự án để đánh giá.');
            return;
        }
        state.projectId = Number(projectId);
        if (freelancerIdParam) {
            state.freelancerId = Number(freelancerIdParam);
        }

        var token = getToken();
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        state.user = getCurrentUserProfile() || await fetchCurrentUser();
        if (!state.user) {
            window.location.href = 'login.html';
            return;
        }

        bindStarEvents();
        if (selectors.submitBtn) {
            selectors.submitBtn.addEventListener('click', handleSubmitReview);
        }

        await loadProjectAndValidate();
    }

    function bindStarEvents() {
        if (!selectors.starsContainer || !selectors.ratingInput) return;
        var stars = selectors.starsContainer.querySelectorAll('.star');
        stars.forEach(function (star) {
            star.addEventListener('click', function () {
                var value = Number(this.getAttribute('data-value') || '0');
                selectors.ratingInput.value = String(value);
                stars.forEach(function (s) {
                    var v = Number(s.getAttribute('data-value') || '0');
                    s.style.color = v <= value ? '#F59E0B' : '#d1d5db';
                });
            });
        });
    }

    async function loadProjectAndValidate() {
        try {
            var token = getToken();
            var resp = await fetch(API_BASE + "/api/v1/projects/" + state.projectId, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!resp.ok) {
                renderErrorInfo('Không thể tải thông tin dự án để đánh giá.');
                return;
            }
            var project = await resp.json();
            state.project = project;
            if (project.client_id !== state.user.id) {
                renderErrorInfo('Bạn chỉ có thể đánh giá các dự án của chính bạn.');
                return;
            }
            var statusVal = String(project.status || '').toUpperCase();
            if (statusVal !== 'COMPLETED') {
                renderErrorInfo('Chỉ có thể đánh giá sau khi dự án đã hoàn thành.');
                return;
            }

            if (!state.freelancerId) {
                if (project.freelancer_id) {
                    state.freelancerId = project.freelancer_id;
                }
            }

            renderProjectInfo(project);
        } catch (e) {
            console.error('loadProjectAndValidate error', e);
            renderErrorInfo('Không thể tải thông tin dự án để đánh giá.');
        }
    }

    function renderProjectInfo(project) {
        if (!selectors.info) return;
        var createdAt = formatDate(project.created_at);
        var typeLabel = String(project.project_type || '').toUpperCase() === 'GIG_ORDER'
            ? 'Đơn hàng dịch vụ'
            : 'Dự án đấu thầu';
        selectors.info.innerHTML = ''
            + '<h2>' + escapeHtml(project.title || 'Dự án') + '</h2>'
            + '<p class="text-muted">' + typeLabel + ' • Tạo ngày ' + createdAt + '</p>'
            + '<p>' + escapeHtml(project.description || '') + '</p>';
    }

    function renderErrorInfo(message) {
        if (selectors.info) {
            selectors.info.innerHTML = ''
                + '<div class="empty-state small">'
                + '<i class="fas fa-triangle-exclamation"></i>'
                + '<p>' + escapeHtml(message) + '</p>'
                + '<a href="orders.html" class="btn btn-primary"><i class="fas fa-arrow-left"></i> Quay lại đơn hàng</a>'
                + '</div>';
        }
        if (selectors.submitBtn) {
            selectors.submitBtn.disabled = true;
        }
    }

    async function handleSubmitReview() {
        if (state.submitting) return;
        hideError();
        if (!state.project || !state.freelancerId) {
            showError('Không xác định được freelancer để đánh giá.');
            return;
        }
        var rating = Number(selectors.ratingInput ? selectors.ratingInput.value : '0');
        var comment = selectors.commentInput ? selectors.commentInput.value.trim() : '';
        if (!rating || rating < 1) {
            showError('Vui lòng chọn số sao.');
            return;
        }

        var token = getToken();
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        state.submitting = true;
        setSubmitLoading(true);
        try {
            var resp = await fetch(API_BASE + "/api/v1/users/" + state.user.id + "/reviews", {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    reviewee_id: state.freelancerId,
                    project_id: state.projectId,
                    rating_overall: rating,
                    comment: comment
                })
            });
            if (!resp.ok) {
                var err = await resp.json().catch(function () { return {}; });
                showError(err.detail || 'Không thể gửi đánh giá.');
                return;
            }
            alert('Cảm ơn bạn đã đánh giá freelancer!');
            if (state.freelancerId) {
                window.location.href = 'freelancer_profile.html?id=' + state.freelancerId;
            } else {
                window.location.href = 'orders.html';
            }
        } catch (e) {
            console.error('handleSubmitReview error', e);
            showError('Không thể gửi đánh giá ngay lúc này.');
        } finally {
            state.submitting = false;
            setSubmitLoading(false);
        }
    }

    function showError(message) {
        if (!selectors.error) return;
        selectors.error.textContent = message || '';
        selectors.error.style.display = message ? 'block' : 'none';
    }

    function hideError() {
        showError('');
    }

    function setSubmitLoading(isLoading) {
        if (!selectors.submitBtn) return;
        selectors.submitBtn.disabled = !!isLoading;
        selectors.submitBtn.innerHTML = isLoading
            ? '<i class="fas fa-spinner fa-spin"></i> Đang gửi...'
            : '<i class="fas fa-paper-plane"></i> Gửi đánh giá';
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatDate(dateString) {
        if (!dateString) return 'Chưa có';
        var date = new Date(dateString);
        return date.toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
})();


