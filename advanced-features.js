// Advanced Request Manager - Module with Edit, Delete, Print, Export features

class RequestManagerPro {
  constructor() {
    this.requests = JSON.parse(localStorage.getItem('requests')) || [];
    this.settings = JSON.parse(localStorage.getItem('settings')) || this.defaultSettings();
  }

  // Edit Request
  editRequest(id, data) {
    const idx = this.requests.findIndex(r => r.id === id);
    if (idx !== -1) {
      this.requests[idx] = {...this.requests[idx], ...data, updatedAt: Date.now()};
      this.save();
      return true;
    }
    return false;
  }

  // Delete Request with confirmation
  deleteRequest(id) {
    const idx = this.requests.findIndex(r => r.id === id);
    if (idx !== -1) {
      this.requests.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  // Print Request - Opens in new window
  printRequest(id) {
    const req = this.requests.find(r => r.id === id);
    if (!req) return;
    const printWin = window.open('', '_blank');
    printWin.document.write(this.generatePrintHTML(req));
    printWin.document.close();
    printWin.onload = () => printWin.print();
  }

  generatePrintHTML(req) {
    return `<!DOCTYPE html>
    <html dir="rtl">
    <head><title>Print Request</title>
    <style>
      body {font-family: Arial, sans-serif; padding: 20px; direction: rtl;}
      .header {text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px;}
      .header h1 {color: #1e40af; margin: 0;}
      .content {margin: 20px 0;}
      .field {padding: 10px; margin: 10px 0; background: #f3f4f6; border-right: 3px solid #2563eb;}
      .label {font-weight: bold; color: #1e40af;}
      .footer {margin-top: 40px; text-align: center; border-top: 2px solid #e5e7eb; padding-top: 20px;}
    </style>
    </head>
    <body>
      <div class="header"><h1>مكتب النائب أحمد الحديدي - تقرير الطلب</h1></div>
      <div class="content">
        <div class="field"><span class="label">رقم الطلب:</span> ${req.id}</div>
        <div class="field"><span class="label">الاسم:</span> ${req.name}</div>
        <div class="field"><span class="label">الوزارة:</span> ${req.ministry}</div>
        <div class="field"><span class="label">التفاصيل:</span> ${req.details}</div>
        <div class="field"><span class="label">الحالة:</span> ${this.getStatusAr(req.status)}</div>
        <div class="field"><span class="label">التاريخ:</span> ${new Date(req.createdAt).toLocaleDateString('ar')}</div>
      </div>
      <div class="footer"><p>تم الطباعة: ${new Date().toLocaleDateString('ar')}</p></div>
    </body>
    </html>`;
  }

  // Export to Excel with formatted borders and colors
  exportExcel(filter = null) {
    let data = this.requests;
    if (filter) data = data.filter(r => r.status === filter);
    if (!data.length) {alert('No data'); return;}
    
    let html = '<html dir="rtl"><head><meta charset="utf-8"></head><body>';
    html += '<table border="1" cellpadding="10" cellspacing="0" style="border-collapse:collapse;width:100%">';
    html += `<tr style="background:#2563eb;color:white;font-weight:bold;">`;
    html += '<th style="border:2px solid #1e40af;padding:15px">رقم</th>';
    html += '<th style="border:2px solid #1e40af;padding:15px">الطلب</th>';
    html += '<th style="border:2px solid #1e40af;padding:15px">الاسم</th>';
    html += '<th style="border:2px solid #1e40af;padding:15px">الوزارة</th>';
    html += '<th style="border:2px solid #1e40af;padding:15px">الحالة</th>';
    html += '<th style="border:2px solid #1e40af;padding:15px">التاريخ</th>';
    html += '</tr>';
    
    data.forEach((r, i) => {
      const statusColor = r.status === 'completed' ? '#dcfce7' : (r.status === 'inprogress' ? '#dbeafe' : '#fef08a');
      html += `<tr style="background:${i%2?'#f9fafb':'white'}">`;
      html += `<td style="border:1px solid #d1d5db;padding:12px;text-align:center">${i+1}</td>`;
      html += `<td style="border:1px solid #d1d5db;padding:12px">${r.id}</td>`;
      html += `<td style="border:1px solid #d1d5db;padding:12px">${r.name}</td>`;
      html += `<td style="border:1px solid #d1d5db;padding:12px">${r.ministry}</td>`;
      html += `<td style="border:1px solid #d1d5db;padding:12px;background:${statusColor};font-weight:bold">${this.getStatusAr(r.status)}</td>`;
      html += `<td style="border:1px solid #d1d5db;padding:12px">${new Date(r.createdAt).toLocaleDateString('ar')}</td>`;
      html += '</tr>';
    });
    
    html += '</table></body></html>';
    const blob = new Blob([html], {type: 'application/vnd.ms-excel;charset=utf-8'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Requests_${Date.now()}.xls`;
    link.click();
  }

  // Notification Settings
  updateNotificationSettings(settings) {
    this.settings = {...this.settings, ...settings};
    this.saveSettings();
  }

  defaultSettings() {
    return {
      notifyNew: true,
      notifyStatus: true,
      notifyComplete: true,
      notifyEmail: true,
      notifyUrgent: true,
      soundEnabled: true
    };
  }

  getStatusAr(status) {
    const map = {pending: 'قيد المراجعة', inprogress: 'قيد التنفيذ', completed: 'مكتمل'};
    return map[status] || status;
  }

  save() {localStorage.setItem('requests', JSON.stringify(this.requests));}
  saveSettings() {localStorage.setItem('settings', JSON.stringify(this.settings));}
}

const requestMgr = new RequestManagerPro();
