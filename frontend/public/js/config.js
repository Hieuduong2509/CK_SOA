// Global configuration - chỉ khai báo một lần
// Sử dụng var thay vì const để tránh lỗi redeclaration
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = window.location.origin;
}
// Export để các file khác có thể dùng
var API_BASE = window.API_BASE;

