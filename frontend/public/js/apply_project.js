(function () {
  var API_BASE = window.API_BASE || window.location.origin;

  // Helpers
  function getParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }
  function fmtCurrency(n) {
    try { return Number(n || 0).toLocaleString('vi-VN'); } catch { return String(n || 0); }
  }

  // DOM
  var formEl, addBtn, titleEl, submitBtn, totalEl, tbodyEl;

  document.addEventListener('DOMContentLoaded', function () {
    formEl = document.getElementById('proposalForm');
    addBtn = document.getElementById('addMilestoneBtn');
    titleEl = document.getElementById('formTitle');
    submitBtn = document.getElementById('submitBtn');
    totalEl = document.getElementById('totalBidDisplay');
    tbodyEl = document.getElementById('milestoneBody');

    if (addBtn) addBtn.addEventListener('click', function () { addMilestoneRow(); });
    if (formEl) formEl.addEventListener('submit', submitProposal);

    var mode = getParam('mode');
    var bidId = getParam('bid_id');
    var projectId = getParam('project_id');

    if (mode === 'edit' && bidId && projectId) {
      titleEl.textContent = 'Cập nhật hồ sơ ứng tuyển';
      submitBtn.innerHTML = '<i class="fas fa-save"></i> Lưu thay đổi';
      loadBidData(projectId, bidId);
    }
  });

  // Load old bid to edit
  async function loadBidData(projectId, bidId) {
    try {
      var token = localStorage.getItem('access_token');
      var res = await fetch(API_BASE + '/api/v1/projects/' + projectId + '/bids', {
        headers: token ? { 'Authorization': 'Bearer ' + token } : {}
      });
      if (!res.ok) throw new Error('Không thể tải dữ liệu thầu');
      var bids = await res.json();
      var myBid = bids.find(function (b) { return String(b.id) === String(bidId); });
      if (!myBid) return;

      document.getElementById('coverLetter').value = myBid.cover_letter || '';
      document.getElementById('deliveryTime').value = myBid.timeline_days || '';

      // reset rows
      tbodyEl.innerHTML = '';
      if (myBid.milestones && myBid.milestones.length) {
        myBid.milestones.forEach(function (m) {
          addMilestoneRow(m.title, m.amount, m.deadline);
        });
      } else {
        addMilestoneRow('Hoàn thành dự án', myBid.price || 0, '');
      }
      updateTotal();
    } catch (e) {
      console.error(e);
      alert('Không thể tải dữ liệu hồ sơ.');
    }
  }

  // Add row helper
  window.addMilestoneRow = function addMilestoneRow(title, amount, date) {
    title = title || '';
    amount = amount || '';
    date = date || '';
    var row = document.createElement('tr');
    row.innerHTML =
      '<td><input type="text" class="form-control m-title" value="' + title + '" placeholder="Công việc..."></td>' +
      '<td><input type="number" class="form-control m-amount" value="' + amount + '" placeholder="0" onchange="updateTotal()"></td>' +
      '<td><input type="date" class="form-control m-date" value="' + (date ? String(date).split("T")[0] : '') + '"></td>' +
      '<td><button type="button" class="btn btn-danger btn-sm" onclick="this.closest(\'tr\').remove(); updateTotal()">X</button></td>';
    tbodyEl.appendChild(row);
  };

  // Total helper
  window.updateTotal = function updateTotal() {
    var sum = 0;
    var nodes = document.querySelectorAll('.m-amount');
    for (var i = 0; i < nodes.length; i++) {
      sum += parseFloat(nodes[i].value) || 0;
    }
    totalEl.textContent = fmtCurrency(sum);
  };

  // Submit
  async function submitProposal(ev) {
    ev.preventDefault();
    var token = localStorage.getItem('access_token');
    if (!token) {
      alert('Vui lòng đăng nhập.');
      window.location.href = 'login.html';
      return;
    }

    var params = new URLSearchParams(window.location.search);
    var projectId = params.get('project_id');
    var bidId = params.get('bid_id');
    var isEdit = params.get('mode') === 'edit';

    var coverLetter = document.getElementById('coverLetter').value.trim();
    var deliveryTime = parseInt(document.getElementById('deliveryTime').value || '0');

    var milestones = [];
    var rows = tbodyEl.querySelectorAll('tr');
    var valid = true;
    var total = 0;
    rows.forEach(function (tr) {
      var t = tr.querySelector('.m-title').value.trim();
      var a = parseFloat(tr.querySelector('.m-amount').value) || 0;
      var d = tr.querySelector('.m-date').value;
      if (!t || !a || !d) valid = false;
      total += a;
      milestones.push({ title: t, amount: a, deadline: d });
    });
    if (!valid) {
      alert('Vui lòng nhập đầy đủ thông tin các giai đoạn.');
      return;
    }
    if (!deliveryTime || deliveryTime < 1) {
      alert('Thời gian dự kiến chưa hợp lệ.');
      return;
    }

    var payload = {
      price: total,
      timeline_days: deliveryTime,
      cover_letter: coverLetter,
      milestones: milestones
    };

    var url = API_BASE + '/api/v1/projects/' + projectId + '/bids';
    var method = 'POST';
    if (isEdit && bidId) {
      url = API_BASE + '/api/v1/projects/' + projectId + '/bids/' + bidId;
      method = 'PUT'; // Backend hiện hỗ trợ PUT cho update
    }

    submitBtn.disabled = true;
    try {
      var res = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        var err = await res.json().catch(function () { return {}; });
        throw new Error(err.detail || 'Không thể gửi hồ sơ');
      }
      alert(isEdit ? 'Cập nhật thành công!' : 'Nộp hồ sơ thành công!');
      window.location.href = 'dashboard_freelancer.html';
    } catch (e) {
      alert('Lỗi: ' + e.message);
    } finally {
      submitBtn.disabled = false;
    }
  }
})();


