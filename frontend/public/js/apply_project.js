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
  var formEl, titleEl, submitBtn, totalEl, tbodyEl, totalBidInputEl, countEl, projectNameEl, projectMetaEl, totalPercentEl;

  document.addEventListener('DOMContentLoaded', function () {
    formEl = document.getElementById('proposalForm');
    titleEl = document.getElementById('formTitle');
    submitBtn = document.getElementById('submitBtn');
    totalEl = document.getElementById('totalBidDisplay');
    tbodyEl = document.getElementById('milestoneBody');
    totalBidInputEl = document.getElementById('totalBidInput');
    countEl = document.getElementById('milestoneCount');
    projectNameEl = document.getElementById('projectName');
    projectMetaEl = document.getElementById('projectMeta');
    totalPercentEl = document.getElementById('totalPercentDisplay');

    if (formEl) formEl.addEventListener('submit', submitProposal);
    if (countEl) countEl.addEventListener('change', generateMilestonesFromTotal);
    if (totalBidInputEl) totalBidInputEl.addEventListener('input', recalcAllMilestones);

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

      var totalBid = myBid.price || 0;
      if (totalBidInputEl) totalBidInputEl.value = totalBid;
      document.getElementById('coverLetter').value = myBid.cover_letter || '';
      document.getElementById('deliveryTime').value = myBid.timeline_days || '';

      // reset rows
      tbodyEl.innerHTML = '';
      if (myBid.milestones && myBid.milestones.length) {
        myBid.milestones.forEach(function (m) {
          // Ưu tiên dùng percent từ database, nếu không có thì tính từ amount/totalBid
          var percent = m.percent || (totalBid > 0 ? ((m.amount || 0) / totalBid * 100) : 0);
          percent = parseFloat(percent).toFixed(1);
          addMilestoneRow(m.title, percent, m.amount, m.deadline);
        });
        updateSummary();
      } else {
        generateMilestonesFromTotal();
      }
    } catch (e) {
      console.error(e);
      alert('Không thể tải dữ liệu hồ sơ.');
    }
  }

  // --- LOGIC TÍNH TOÁN % VÀ TIỀN ---
  // 1. Hàm thêm dòng mới (Có gán sự kiện tính toán)
  window.addMilestoneRow = function addMilestoneRow(title, percent, amount, date) {
    title = title || '';
    percent = percent || '';
    amount = amount || '';
    date = date || '';
    var row = document.createElement('tr');
    var deleteDisabled = tbodyEl.querySelectorAll('tr').length <= 1 ? 'disabled' : '';
    
    row.innerHTML =
      '<td><input type="text" class="form-control m-title" value="' + (title || '').replace(/"/g, '&quot;') + '" placeholder="Tên giai đoạn..."></td>' +
      '<td><div class="input-group"><input type="number" class="form-control m-percent" value="' + (percent || '') + '" placeholder="0" min="0" max="100" step="0.1"><span class="input-group-text">%</span></div></td>' +
      '<td><input type="number" class="form-control m-amount" value="' + (amount || '') + '" placeholder="0"></td>' +
      '<td><input type="date" class="form-control m-date" value="' + (date ? String(date).split("T")[0] : '') + '"></td>' +
      '<td><button type="button" class="btn btn-danger btn-sm" ' + deleteDisabled + ' onclick="removeRow(this)" style="width: 100%;">X</button></td>';
    
    tbodyEl.appendChild(row);
    updateDeleteButtons();
    
    // Gán sự kiện "vừa gõ vừa tính"
    var percentInput = row.querySelector('.m-percent');
    var amountInput = row.querySelector('.m-amount');
    var isFirstRow = tbodyEl.children[0] === row;
    
    // A. Khi nhập % -> Tự tính ra Tiền (Làm tròn XUỐNG để an toàn)
    percentInput.addEventListener('input', function() {
      var totalBid = parseFloat(totalBidInputEl.value) || 0;
      var p = parseFloat(this.value) || 0;
      
      // Chặn nhập quá 100%
      if (p > 100) {
        p = 100;
        this.value = 100;
      }
      
      // Validation: Mốc đầu tiên không quá 50%
      if (isFirstRow && p > 50) {
        alert("Theo quy định an toàn, giai đoạn đặt cọc (Mốc 1) tối đa là 50%.");
        this.value = 50;
        p = 50;
      }
      
      if (totalBid > 0) {
        // QUAN TRỌNG: Làm tròn XUỐNG để tránh vượt tổng
        var calcAmount = Math.floor((totalBid * p) / 100);
        amountInput.value = calcAmount;
      }
      updateSummary();
    });
    
    // B. Khi nhập Tiền -> Tự tính ra % (Hiển thị 2 số thập phân)
    amountInput.addEventListener('input', function() {
      var totalBid = parseFloat(totalBidInputEl.value) || 0;
      var a = parseFloat(this.value) || 0;
      
      if (totalBid > 0) {
        var p = (a / totalBid) * 100;
        
        // Validation: Mốc đầu tiên không quá 50%
        if (isFirstRow && p > 50) {
          alert("Tiền cọc quá lớn! Giai đoạn 1 tối đa 50% tổng giá trị.");
          var maxAmount = Math.floor((totalBid * 50) / 100);
          this.value = maxAmount;
          percentInput.value = 50;
        } else {
          // Hiển thị 2 số thập phân để tương đối chính xác
          percentInput.value = p.toFixed(2);
        }
      }
      updateSummary();
    });
  };

  // 2. Hàm xóa dòng
  window.removeRow = function removeRow(btn) {
    btn.closest('tr').remove();
    updateSummary();
    updateDeleteButtons();
  };

  // 3. Hàm tính lại toàn bộ (Khi sửa Tổng ngân sách)
  // QUY TẮC: TỔNG TIỀN LÀ VUA - Làm tròn XUỐNG để tránh vượt tổng
  window.recalcAllMilestones = function recalcAllMilestones() {
    var totalBid = parseFloat(totalBidInputEl.value) || 0;
    var rows = tbodyEl.querySelectorAll('tr');
    
    rows.forEach(function(row) {
      var pInput = row.querySelector('.m-percent');
      var aInput = row.querySelector('.m-amount');
      var p = parseFloat(pInput.value) || 0;
      
      // Ưu tiên giữ % cố định, tính lại tiền (Làm tròn XUỐNG)
      if (p > 0 && totalBid > 0) {
        aInput.value = Math.floor((totalBid * p) / 100);
      }
    });
    updateSummary();
  };

  // 4. Hàm cập nhật thanh tổng kết bên dưới (QUY TẮC: TỔNG TIỀN LÀ VUA)
  window.updateSummary = function updateSummary() {
    var totalBid = parseFloat(totalBidInputEl.value) || 0;
    var totalPercent = 0;
    var totalAmount = 0;
    
    tbodyEl.querySelectorAll('tr').forEach(function(row) {
      totalPercent += parseFloat(row.querySelector('.m-percent').value) || 0;
      totalAmount += parseFloat(row.querySelector('.m-amount').value) || 0;
    });
    
    // Hiển thị tổng phần trăm
    if (totalPercentEl) {
      totalPercentEl.textContent = totalPercent.toFixed(1) + "%";
    }
    
    // Hiển thị tổng tiền
    if (totalEl) {
      totalEl.textContent = fmtCurrency(totalAmount);
    }
    
    // QUAN TRỌNG: Tính phần dư (remaining) để đảm bảo tổng tiền = giá bid
    var remaining = totalBid - totalAmount;
    
    // Xóa nút "Tự động điền" cũ nếu có
    var existingAutoBtn = document.getElementById('btnAutoFill');
    if (existingAutoBtn) existingAutoBtn.remove();
    
    // Tìm container để thêm nút (thường là thẻ chứa tổng kết)
    var summaryContainer = document.querySelector('.milestone-total');
    if (!summaryContainer) {
      // Fallback: tìm thẻ chứa totalEl
      summaryContainer = totalEl ? totalEl.parentElement : null;
    }
    
    // Hiển thị cảnh báo và nút tự động điền
    if (Math.abs(remaining) > 100 && summaryContainer && totalBid > 0) {
      // Lệch quá 100 đồng -> hiển thị cảnh báo
      if (totalPercentEl) {
        totalPercentEl.className = "text-danger fw-bold";
      }
      if (totalEl) {
        totalEl.className = "text-danger fw-bold";
      }
      
      // Thêm nút "Tự động điền phần còn lại" nếu còn dư tiền
      if (remaining > 0 && tbodyEl.querySelectorAll('tr').length > 0) {
        var btn = document.createElement('button');
        btn.id = 'btnAutoFill';
        btn.className = 'btn btn-sm btn-warning ms-2';
        btn.type = 'button';
        btn.innerHTML = '<i class="fas fa-magic"></i> Cộng ' + fmtCurrency(remaining) + ' vào mốc cuối';
        btn.onclick = function() {
          fillRemainingToLastRow(remaining, totalBid);
        };
        
        // Thêm vào sau totalEl hoặc summaryContainer
        if (totalEl && totalEl.parentElement) {
          totalEl.parentElement.appendChild(btn);
        } else if (summaryContainer) {
          summaryContainer.appendChild(btn);
        }
      }
    } else {
      // Đúng hoặc lệch nhỏ (< 100đ) -> hiển thị màu xanh
      if (totalPercentEl) {
        totalPercentEl.className = "text-success fw-bold";
      }
      if (totalEl) {
        totalEl.className = "text-success fw-bold";
      }
    }
    
    // Hiển thị cảnh báo phần trăm (nếu có element)
    var percentWarning = document.getElementById('percentWarning');
    if (percentWarning) {
      if (Math.abs(totalPercent - 100) < 0.1) {
        percentWarning.style.display = 'none';
        percentWarning.textContent = '';
      } else if (totalPercent > 100) {
        var excess = (totalPercent - 100).toFixed(1);
        percentWarning.style.display = 'inline';
        percentWarning.textContent = '(Vượt quá ' + excess + '%)';
        percentWarning.style.color = '#dc3545';
      } else {
        var missing = (100 - totalPercent).toFixed(1);
        percentWarning.style.display = 'inline';
        percentWarning.textContent = '(Thiếu ' + missing + '%)';
        percentWarning.style.color = '#ffc107';
      }
    }
  };
  
  // HÀM MAGIC: Cộng phần dư vào dòng cuối cùng
  window.fillRemainingToLastRow = function fillRemainingToLastRow(remaining, totalBid) {
    var rows = tbodyEl.querySelectorAll('tr');
    if (rows.length === 0) return;
    
    var lastRow = rows[rows.length - 1];
    var amountInput = lastRow.querySelector('.m-amount');
    var percentInput = lastRow.querySelector('.m-percent');
    
    // Cộng dồn tiền
    var currentAmount = parseFloat(amountInput.value) || 0;
    var newAmount = currentAmount + remaining;
    
    amountInput.value = newAmount;
    
    // Tính lại % cho dòng cuối (có thể lẻ, kệ nó)
    if (totalBid > 0) {
      percentInput.value = ((newAmount / totalBid) * 100).toFixed(2);
    }
    
    updateSummary(); // Cập nhật lại UI
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

  // Total helper (backward compatibility)
  window.updateTotal = function updateTotal() {
    updateSummary();
  };

  function generateMilestonesFromTotal(){
    var count = parseInt((countEl && countEl.value) || '2', 10);
    if (count < 1) count = 1;
    var total = parseFloat((totalBidInputEl && totalBidInputEl.value) || '0') || 0;
    tbodyEl.innerHTML = '';
    
    // SỬA LỖI: Ưu tiên đảm bảo tổng tiền = giá bid, sau đó tính percent từ amount thực tế
    var avgAmount = Math.floor(total / count);
    var remainder = total - (avgAmount * count); // Phần dư để đảm bảo tổng = total
    
    var today = new Date();
    var totalPercent = 0; // Để kiểm tra tổng phần trăm
    
    for (var i=0;i<count;i++){
      // Milestone cuối nhận phần dư để đảm bảo tổng tiền = total
      var amount = (i === count-1) ? (avgAmount + remainder) : avgAmount;
      
      // Tính percent từ amount thực tế (không làm tròn trước)
      var percent = total > 0 ? (amount / total * 100) : (100 / count);
      
      // Milestone cuối: đảm bảo tổng = 100%
      if (i === count-1) {
        percent = 100 - totalPercent;
      } else {
        totalPercent += percent;
      }
      
      var date = new Date(today); 
      date.setDate(today.getDate() + (7*(i+1)));
      var dateStr = date.toISOString().split('T')[0];
      
      // Hiển thị percent với 1 chữ số thập phân
      addMilestoneRow('Giai đoạn ' + (i+1), percent.toFixed(1), amount, dateStr);
    }
    updateSummary();
    updateDeleteButtons();
  }

  // 5. Hàm Validate trước khi Submit (QUY TẮC: TỔNG TIỀN LÀ VUA)
  function validateBeforeSubmit() {
    var totalBidInput = parseFloat(totalBidInputEl.value) || 0;
    
    // Check tổng ngân sách trước
    if (totalBidInput <= 0) {
      alert("Vui lòng nhập tổng ngân sách chào thầu.");
      return false;
    }
    
    // Validate các milestone
    var rows = tbodyEl.querySelectorAll('tr');
    if (rows.length === 0) {
      alert('Vui lòng thêm ít nhất một giai đoạn.');
      return false;
    }
    
    // Tính tổng tiền từ các dòng (Source of Truth)
    var currentTotalAmount = 0;
    rows.forEach(function(row) {
      currentTotalAmount += parseFloat(row.querySelector('.m-amount').value) || 0;
    });
    
    // Check lệch tiền (Cho phép sai số nhỏ < 1000đ) - QUY TẮC VÀNG
    if (Math.abs(totalBidInput - currentTotalAmount) > 1000) {
      alert('Tổng tiền các giai đoạn (' + fmtCurrency(currentTotalAmount) + ') chưa khớp với ngân sách tổng (' + fmtCurrency(totalBidInput) + '). Vui lòng kiểm tra lại hoặc bấm nút "Cộng phần còn lại vào mốc cuối".');
      return false;
    }
    
    // Kiểm tra phần trăm (cảnh báo nhẹ, không chặn submit)
    var totalPercent = parseFloat(totalPercentEl.textContent) || 0;
    if (Math.abs(totalPercent - 100) > 1) { // Cho phép sai số 1%
      var confirmMsg = 'Tổng tỉ lệ hiện tại là ' + totalPercent.toFixed(1) + '% (chưa đúng 100%). Bạn có muốn tiếp tục không?';
      if (!confirm(confirmMsg)) {
        return false;
      }
    }

    // Validate các milestone
    var rows = tbodyEl.querySelectorAll('tr');
    if (rows.length === 0) {
      alert('Vui lòng thêm ít nhất một giai đoạn.');
      return false;
    }
    
    // Validate mốc đầu tiên không quá 50%
    var firstRow = rows[0];
    if (firstRow) {
      var firstPercent = parseFloat(firstRow.querySelector('.m-percent').value) || 0;
      if (firstPercent > 50) {
        alert('Theo quy định an toàn, giai đoạn đặt cọc (Mốc 1) tối đa là 50%. Hiện tại là ' + firstPercent.toFixed(1) + '%');
        return false;
      }
    }

    // Validate các mốc sau không được quá nhỏ (< 5%)
    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      var percent = parseFloat(row.querySelector('.m-percent').value) || 0;
      if (percent < 5) {
        alert('Giai đoạn ' + (i+1) + ' quá nhỏ (' + percent.toFixed(1) + '%). Vui lòng gộp lại.');
        return false;
      }
    }
    
    return true;
  }

  // Submit
  async function submitProposal(ev) {
    ev.preventDefault();
    
    if (!validateBeforeSubmit()) {
      return;
    }
    
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
    var totalBid = parseFloat(totalBidInputEl.value) || 0;

    var milestones = [];
    var rows = tbodyEl.querySelectorAll('tr');
    var valid = true;
    rows.forEach(function (tr) {
      var t = tr.querySelector('.m-title').value.trim();
      var a = parseFloat(tr.querySelector('.m-amount').value) || 0;
      var d = tr.querySelector('.m-date').value;
      var p = parseFloat(tr.querySelector('.m-percent').value) || 0;
      if (!t || !a || !d) valid = false;
      milestones.push({ title: t, amount: a, deadline: d, percent: p });
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
      price: totalBid,
      timeline_days: deliveryTime,
      cover_letter: coverLetter,
      milestones: milestones
    };

    var url = API_BASE + '/api/v1/projects/' + projectId + '/bids';
    var method = 'POST';
    if (isEdit && bidId) {
      url = API_BASE + '/api/v1/projects/' + projectId + '/bids/' + bidId;
      method = 'PUT';
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
      window.location.href = 'orders.html';
    } catch (e) {
      alert('Lỗi: ' + e.message);
    } finally {
      submitBtn.disabled = false;
    }
  }
})();
