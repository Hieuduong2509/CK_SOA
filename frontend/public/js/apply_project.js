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
  var formEl, addBtn, titleEl, submitBtn, totalEl, tbodyEl, totalBidEl, countEl, projectNameEl, projectMetaEl;

  document.addEventListener('DOMContentLoaded', function () {
    formEl = document.getElementById('proposalForm');
    addBtn = document.getElementById('addMilestoneBtn');
    titleEl = document.getElementById('formTitle');
    submitBtn = document.getElementById('submitBtn');
    totalEl = document.getElementById('totalBidDisplay');
    tbodyEl = document.getElementById('milestoneBody');
    totalBidEl = document.getElementById('totalBid');
    countEl = document.getElementById('milestoneCount');
    projectNameEl = document.getElementById('projectName');
    projectMetaEl = document.getElementById('projectMeta');

    if (addBtn) addBtn.addEventListener('click', function () { addMilestoneRow(); });
    if (formEl) formEl.addEventListener('submit', submitProposal);
    if (countEl) countEl.addEventListener('change', generateMilestonesFromTotal);
    if (totalBidEl) totalBidEl.addEventListener('input', generateMilestonesFromTotal);

    var mode = getParam('mode');
    var bidId = getParam('bid_id');
    var projectId = getParam('project_id');

    // Load project summary
    if (projectId) { loadProjectSummary(projectId); }

    if (mode === 'edit' && bidId && projectId) {
      titleEl.textContent = 'Cập nhật hồ sơ ứng tuyển';
      var submitBtnText = document.getElementById('submitBtnText');
      if (submitBtnText) submitBtnText.textContent = 'Lưu thay đổi';
      submitBtn.innerHTML = '<i class="fas fa-save"></i> <span id="submitBtnText">Lưu thay đổi</span>';
      loadBidData(projectId, bidId);
    } else {
      // default 2 milestones
      generateMilestonesFromTotal();
    }

    // Back button logic
    var backBtn = document.getElementById('backBtn');
    if (backBtn) {
      backBtn.addEventListener('click', function(e) {
        e.preventDefault();
        var referrer = document.referrer;
        if (referrer && referrer.includes('orders.html')) {
          window.location.href = 'orders.html';
        } else {
          window.location.href = 'dashboard_freelancer.html';
        }
      });
    }
  });

  async function loadProjectSummary(projectId){
    try {
      var token = localStorage.getItem('access_token');
      var res = await fetch(API_BASE + '/api/v1/projects/' + projectId, { headers: token ? { 'Authorization': 'Bearer ' + token } : {} });
      if (!res.ok) return;
      var p = await res.json();
      if (projectNameEl) projectNameEl.textContent = p.title || ('Dự án #' + projectId);
      if (projectMetaEl) {
        var moTa = (p.description || '').slice(0, 120);
        var dl = p.deadline ? new Date(p.deadline).toLocaleDateString('vi-VN') : '—';
        projectMetaEl.textContent = (moTa ? moTa + ' • ' : '') + 'Deadline: ' + dl;
      }
    } catch(_) {}
  }

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

      if (totalBidEl) totalBidEl.value = myBid.price || 0;
      document.getElementById('coverLetter').value = myBid.cover_letter || '';
      document.getElementById('deliveryTime').value = myBid.timeline_days || '';

      // reset rows
      tbodyEl.innerHTML = '';
      if (myBid.milestones && myBid.milestones.length) {
        myBid.milestones.forEach(function (m) {
          addMilestoneRow(m.title, m.amount, m.deadline);
        });
        updateTotal();
      } else {
        generateMilestonesFromTotal();
      }
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
    var deleteDisabled = tbodyEl.querySelectorAll('tr').length <= 1 ? 'disabled' : '';
    row.innerHTML =
      '<td><input type="text" class="form-control m-title" value="' + (title || '').replace(/"/g, '&quot;') + '" placeholder="Công việc..."></td>' +
      '<td><input type="number" class="form-control m-amount" value="' + (amount || '') + '" placeholder="0" onchange="updateTotal()"></td>' +
      '<td><input type="date" class="form-control m-date" value="' + (date ? String(date).split("T")[0] : '') + '"></td>' +
      '<td><button type="button" class="btn btn-danger btn-sm" ' + deleteDisabled + ' onclick="this.closest(\'tr\').remove(); updateTotal(); updateDeleteButtons()" style="width: 100%;">X</button></td>';
    tbodyEl.appendChild(row);
    updateDeleteButtons();
  };

  // Update delete buttons state
  window.updateDeleteButtons = function updateDeleteButtons() {
    var rows = tbodyEl.querySelectorAll('tr');
    var canDelete = rows.length > 1;
    rows.forEach(function(row) {
      var btn = row.querySelector('button.btn-danger');
      if (btn) {
        btn.disabled = !canDelete;
      }
    });
  };

  // Total helper
  window.updateTotal = function updateTotal() {
    var sum = 0;
    var nodes = document.querySelectorAll('.m-amount');
    for (var i = 0; i < nodes.length; i++) {
      sum += parseFloat(nodes[i].value) || 0;
    }
    if (totalEl) totalEl.textContent = fmtCurrency(sum);
  };

  function generateMilestonesFromTotal(){
    var count = parseInt((countEl && countEl.value) || '2', 10);
    if (count < 1) count = 1;
    var total = parseFloat((totalBidEl && totalBidEl.value) || '0') || 0;
    tbodyEl.innerHTML = '';
    var base = Math.floor(total / count);
    var remain = total - base * count;
    var today = new Date();
    for (var i=0;i<count;i++){
      var amount = base + (i === count-1 ? remain : 0);
      var date = new Date(today); date.setDate(today.getDate() + (7*(i+1)));
      var dateStr = date.toISOString().split('T')[0];
      addMilestoneRow('Giai đoạn ' + (i+1), amount, dateStr);
    }
    updateTotal();
    updateDeleteButtons();
  }

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
      // Redirect to orders page to see the updated proposal
      window.location.href = 'orders.html';
    } catch (e) {
      alert('Lỗi: ' + e.message);
    } finally {
      submitBtn.disabled = false;
    }
  }
})();


