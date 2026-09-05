const fs = require('fs');
const path = require('path');

const products = JSON.parse(fs.readFileSync(path.join(__dirname, 'products_formatted.json'), 'utf8'));
const productsJSON = JSON.stringify(products, null, 2);

const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>نظام إدارة قائمة المنتجات | Product Management System</title>
  <!-- Google Fonts: Cairo for AR & Inter for EN -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <!-- Font Awesome Icons -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    :root {
      --primary: #ea580c;
      --primary-hover: #c2410c;
      --primary-light: rgba(234, 88, 12, 0.12);
      --primary-border: rgba(234, 88, 12, 0.28);
      --bg-gradient: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
      --card-bg: rgba(30, 41, 59, 0.75);
      --card-border: rgba(255, 255, 255, 0.12);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-bold: #ffffff;
      --table-header-bg: rgba(15, 23, 42, 0.9);
      --table-row-hover: rgba(234, 88, 12, 0.08);
      --table-row-alt: rgba(255, 255, 255, 0.02);
      --input-bg: rgba(15, 23, 42, 0.65);
      --input-border: rgba(255, 255, 255, 0.18);
      --modal-bg: #1e293b;
      --shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
      --badge-bg: rgba(59, 130, 246, 0.15);
      --badge-color: #60a5fa;
      --radius-sm: 8px;
      --radius-md: 12px;
      --radius-lg: 18px;
      --transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    [data-theme="light"] {
      --bg-gradient: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 50%, #f8fafc 100%);
      --card-bg: rgba(255, 255, 255, 0.9);
      --card-border: rgba(0, 0, 0, 0.08);
      --text-main: #1e293b;
      --text-muted: #64748b;
      --text-bold: #0f172a;
      --table-header-bg: #f8fafc;
      --table-row-hover: rgba(234, 88, 12, 0.06);
      --table-row-alt: rgba(241, 245, 249, 0.6);
      --input-bg: #ffffff;
      --input-border: rgba(0, 0, 0, 0.18);
      --modal-bg: #ffffff;
      --shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
      --badge-bg: rgba(37, 99, 235, 0.1);
      --badge-color: #1d4ed8;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Cairo', 'Inter', system-ui, -apple-system, sans-serif;
      background: var(--bg-gradient);
      color: var(--text-main);
      min-height: 100vh;
      line-height: 1.6;
      padding: 24px 16px;
      transition: var(--transition);
    }

    /* Container */
    .app-container {
      max-width: 1380px;
      margin: 0 auto;
    }

    /* Header Styling */
    .app-header {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-lg);
      padding: 22px 28px;
      margin-bottom: 24px;
      box-shadow: var(--shadow-lg);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }

    .brand-section {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .brand-logo {
      width: 54px;
      height: 54px;
      background: linear-gradient(135deg, #ea580c, #f97316);
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 1.7rem;
      box-shadow: 0 10px 15px -3px rgba(234, 88, 12, 0.4);
    }

    .brand-title h1 {
      font-size: 1.55rem;
      font-weight: 800;
      color: var(--text-bold);
      letter-spacing: -0.5px;
    }

    .brand-title p {
      font-size: 0.9rem;
      color: var(--text-muted);
      font-weight: 600;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 18px;
      font-size: 0.92rem;
      font-weight: 700;
      border-radius: var(--radius-md);
      border: none;
      cursor: pointer;
      transition: var(--transition);
      font-family: inherit;
      white-space: nowrap;
      user-select: none;
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--primary), #f97316);
      color: white;
      box-shadow: 0 4px 12px rgba(234, 88, 12, 0.35);
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(234, 88, 12, 0.5);
    }

    .btn-secondary {
      background: var(--input-bg);
      color: var(--text-main);
      border: 1px solid var(--card-border);
    }
    .btn-secondary:hover {
      background: var(--primary-light);
      border-color: var(--primary-border);
      color: var(--primary);
    }

    .btn-lang {
      background: rgba(234, 88, 12, 0.15);
      color: var(--primary);
      border: 1px solid var(--primary-border);
      font-weight: 800;
    }
    .btn-lang:hover {
      background: var(--primary);
      color: white;
    }

    .btn-sm {
      padding: 6px 12px;
      font-size: 0.82rem;
      border-radius: var(--radius-sm);
    }

    .btn-icon {
      width: 40px;
      height: 40px;
      padding: 0;
      border-radius: var(--radius-md);
    }

    /* Stats Overview Cards */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: var(--card-bg);
      backdrop-filter: blur(12px);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-md);
      padding: 18px 22px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: var(--shadow-lg);
      transition: var(--transition);
    }
    .stat-card:hover {
      transform: translateY(-3px);
      border-color: var(--primary-border);
    }

    .stat-info h3 {
      font-size: 0.88rem;
      color: var(--text-muted);
      font-weight: 600;
      margin-bottom: 4px;
    }
    .stat-info .stat-value {
      font-size: 1.8rem;
      font-weight: 900;
      color: var(--text-bold);
    }

    .stat-icon {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-md);
      background: var(--primary-light);
      color: var(--primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.4rem;
    }

    /* Search & Filter Bar Section */
    .controls-card {
      background: var(--card-bg);
      backdrop-filter: blur(12px);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-lg);
      padding: 20px 24px;
      margin-bottom: 24px;
      box-shadow: var(--shadow-lg);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .controls-row {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
    }

    .search-wrapper {
      position: relative;
      flex: 1;
      min-width: 280px;
    }

    .search-wrapper i.search-icon {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      font-size: 1.1rem;
      pointer-events: none;
    }
    [dir="rtl"] .search-wrapper i.search-icon { right: 16px; }
    [dir="ltr"] .search-wrapper i.search-icon { left: 16px; }

    .search-input {
      width: 100%;
      padding: 12px 48px;
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: var(--radius-md);
      color: var(--text-main);
      font-family: inherit;
      font-size: 0.95rem;
      outline: none;
      transition: var(--transition);
    }

    .search-input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px var(--primary-light);
    }

    .clear-search-btn {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 1rem;
      display: none;
      padding: 4px;
    }
    [dir="rtl"] .clear-search-btn { left: 14px; }
    [dir="ltr"] .clear-search-btn { right: 14px; }
    .clear-search-btn:hover { color: var(--primary); }

    .filter-select {
      padding: 12px 18px;
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: var(--radius-md);
      color: var(--text-main);
      font-family: inherit;
      font-size: 0.92rem;
      outline: none;
      cursor: pointer;
      min-width: 220px;
      transition: var(--transition);
    }
    .filter-select:focus {
      border-color: var(--primary);
    }

    /* Counter Badge & Active Filters */
    .counter-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--card-border);
      font-size: 0.92rem;
    }

    .counter-text {
      color: var(--text-muted);
      font-weight: 600;
    }

    .counter-number {
      color: var(--primary);
      font-weight: 800;
      font-size: 1.05rem;
    }

    /* Table Container & Design */
    .table-card {
      background: var(--card-bg);
      backdrop-filter: blur(12px);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-lg);
      overflow: hidden;
      box-shadow: var(--shadow-lg);
      margin-bottom: 24px;
    }

    .table-wrapper {
      width: 100%;
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: start;
    }

    th {
      background: var(--table-header-bg);
      color: var(--text-muted);
      font-weight: 800;
      font-size: 0.88rem;
      padding: 16px 20px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 2px solid var(--card-border);
      white-space: nowrap;
    }

    td {
      padding: 16px 20px;
      border-bottom: 1px solid var(--card-border);
      font-size: 0.96rem;
      vertical-align: middle;
      transition: var(--transition);
    }

    tbody tr {
      transition: var(--transition);
    }

    tbody tr:nth-child(even) {
      background: var(--table-row-alt);
    }

    tbody tr:hover {
      background: var(--table-row-hover);
    }

    /* CRITICAL TECHNICAL SPECIFICATION: Product Name MUST be Bold */
    .product-name-bold {
      font-weight: 800 !important;
      color: var(--text-bold) !important;
      font-size: 1.04rem;
      letter-spacing: -0.2px;
      line-height: 1.45;
    }

    .product-code-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: 'Inter', monospace;
      font-weight: 700;
      background: rgba(148, 163, 184, 0.12);
      color: var(--text-main);
      padding: 5px 12px;
      border-radius: var(--radius-sm);
      border: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 0.88rem;
    }

    .category-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 14px;
      border-radius: 20px;
      font-size: 0.84rem;
      font-weight: 700;
      background: var(--primary-light);
      color: var(--primary);
      border: 1px solid var(--primary-border);
      white-space: nowrap;
    }

    .serial-col {
      font-weight: 800;
      color: var(--text-muted);
      width: 70px;
      text-align: center;
    }

    .actions-cell {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    /* Empty State */
    .empty-state {
      padding: 60px 20px;
      text-align: center;
      color: var(--text-muted);
    }

    .empty-state i {
      font-size: 3.5rem;
      color: var(--primary);
      margin-bottom: 16px;
      opacity: 0.7;
    }

    .empty-state h4 {
      font-size: 1.25rem;
      font-weight: 800;
      color: var(--text-bold);
      margin-bottom: 6px;
    }

    /* Pagination Footer */
    .pagination-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: var(--table-header-bg);
      border-top: 1px solid var(--card-border);
      flex-wrap: wrap;
      gap: 16px;
    }

    .page-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .page-num {
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-sm);
      background: var(--input-bg);
      color: var(--text-main);
      border: 1px solid var(--input-border);
      font-weight: 800;
      cursor: pointer;
      transition: var(--transition);
    }

    .page-num.active {
      background: var(--primary);
      color: white;
      border-color: var(--primary);
      box-shadow: 0 4px 10px rgba(234, 88, 12, 0.4);
    }

    /* Modal Dialogs */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      opacity: 0;
      visibility: hidden;
      transition: var(--transition);
      padding: 16px;
    }

    .modal-overlay.active {
      opacity: 1;
      visibility: visible;
    }

    .modal-box {
      background: var(--modal-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-lg);
      width: 100%;
      max-width: 550px;
      box-shadow: var(--shadow-lg);
      overflow: hidden;
      transform: translateY(20px);
      transition: var(--transition);
    }

    .modal-overlay.active .modal-box {
      transform: translateY(0);
    }

    .modal-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--card-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-header h3 {
      font-size: 1.25rem;
      font-weight: 800;
      color: var(--text-bold);
    }

    .modal-body {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-group label {
      font-size: 0.88rem;
      font-weight: 700;
      color: var(--text-main);
    }

    .form-control {
      width: 100%;
      padding: 11px 16px;
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: var(--radius-md);
      color: var(--text-main);
      font-family: inherit;
      font-size: 0.95rem;
      outline: none;
      transition: var(--transition);
    }

    .form-control:focus {
      border-color: var(--primary);
    }

    .modal-footer {
      padding: 16px 24px;
      border-top: 1px solid var(--card-border);
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      background: rgba(0, 0, 0, 0.15);
    }

    /* Responsive Design Adjustments */
    @media (max-width: 768px) {
      .app-header { flex-direction: column; align-items: flex-start; }
      .header-actions { width: 100%; justify-content: space-between; }
      .controls-row { flex-direction: column; align-items: stretch; }
      .search-wrapper, .filter-select { width: 100%; min-width: 100%; }
      th, td { padding: 12px 14px; font-size: 0.88rem; }
    }
  </style>
</head>
<body>

  <div class="app-container">

    <!-- Header Section -->
    <header class="app-header">
      <div class="brand-section">
        <div class="brand-logo">
          <i class="fa-solid fa-boxes-stacked"></i>
        </div>
        <div class="brand-title">
          <h1 id="ui-title">قائمة منتجات المتجر</h1>
          <p id="ui-subtitle">إدارة وتصفح 256 منتجاً مع الأكواد والفئات بكل سهولة</p>
        </div>
      </div>

      <div class="header-actions">
        <button id="lang-toggle-btn" class="btn btn-lang" title="Switch Language / تغيير اللغة">
          <i class="fa-solid fa-globe"></i>
          <span id="lang-btn-text">English (LTR)</span>
        </button>

        <button id="theme-toggle-btn" class="btn btn-secondary btn-icon" title="Toggle Theme">
          <i class="fa-solid fa-moon"></i>
        </button>

        <button id="add-product-btn" class="btn btn-primary">
          <i class="fa-solid fa-plus"></i>
          <span id="add-btn-text">إضافة منتج جديد</span>
        </button>

        <button id="export-btn" class="btn btn-secondary" title="Export CSV">
          <i class="fa-solid fa-file-csv"></i>
          <span id="export-btn-text">تصدير CSV</span>
        </button>
      </div>
    </header>

    <!-- Stats Cards Overview -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-info">
          <h3 id="stat-total-label">إجمالي المنتجات</h3>
          <div class="stat-value" id="stat-total-val">256</div>
        </div>
        <div class="stat-icon">
          <i class="fa-solid fa-box"></i>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-info">
          <h3 id="stat-showing-label">المنتجات المعروضة</h3>
          <div class="stat-value" id="stat-showing-val">256</div>
        </div>
        <div class="stat-icon" style="background: rgba(59, 130, 246, 0.15); color: #3b82f6;">
          <i class="fa-solid fa-filter"></i>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-info">
          <h3 id="stat-cats-label">إجمالي الفئات</h3>
          <div class="stat-value" id="stat-cats-val">23</div>
        </div>
        <div class="stat-icon" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">
          <i class="fa-solid fa-tags"></i>
        </div>
      </div>
    </div>

    <!-- Search & Filter Controls Card -->
    <div class="controls-card">
      <div class="controls-row">
        <!-- Smart Search Bar -->
        <div class="search-wrapper">
          <i class="fa-solid fa-magnifying-glass search-icon"></i>
          <input type="text" id="search-input" class="search-input" placeholder="ابحث باسم المنتج، الكود، أو الفئة...">
          <button id="clear-search-btn" class="clear-search-btn"><i class="fa-solid fa-circle-xmark"></i></button>
        </div>

        <!-- Category Dropdown Filter -->
        <select id="category-filter" class="filter-select">
          <option value="ALL">جميع الفئات (All Categories)</option>
        </select>

        <!-- Reset Button -->
        <button id="reset-btn" class="btn btn-secondary" title="إعادة ضبط القائمة الأولية (256 منتج)">
          <i class="fa-solid fa-rotate-right"></i>
          <span id="reset-btn-text">إعادة ضبط البيانات</span>
        </button>
      </div>

      <!-- Realtime Product Counter -->
      <div class="counter-bar">
        <div class="counter-text">
          <i class="fa-solid fa-list-check" style="margin-inline-end: 6px; color: var(--primary);"></i>
          <span id="counter-label">نتائج البحث:</span>
          <span id="counter-detail" class="counter-number">عرض 256 من إجمالي 256 منتج</span>
        </div>
      </div>
    </div>

    <!-- Main Products Table Card -->
    <div class="table-card">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th class="serial-col" id="th-sn">#</th>
              <th id="th-code">الكود (ID)</th>
              <th id="th-name">اسم المنتج (Product Name)</th>
              <th id="th-category">الفئة (Category)</th>
              <th style="text-align: end;" id="th-actions">الإجراءات</th>
            </tr>
          </thead>
          <tbody id="products-tbody">
            <!-- Dynamic Rows rendered via JavaScript -->
          </tbody>
        </table>
      </div>

      <!-- Empty Results State -->
      <div id="empty-state" class="empty-state" style="display: none;">
        <i class="fa-solid fa-magnifying-glass-minus"></i>
        <h4 id="empty-title">لم يتم العثور على أي نتائج</h4>
        <p id="empty-desc">جرب البحث بكلمات أخرى أو قم بتغيير الفئة المحددة</p>
      </div>

      <!-- Pagination Footer -->
      <div class="pagination-bar">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span id="page-size-label" style="color: var(--text-muted); font-size: 0.88rem;">عدد العناصر بالصفحة:</span>
          <select id="page-size-select" class="filter-select" style="min-width: auto; padding: 6px 12px; font-size: 0.85rem;">
            <option value="25">25</option>
            <option value="50" selected>50</option>
            <option value="100">100</option>
            <option value="9999">الكل (All)</option>
          </select>
        </div>

        <div class="page-controls" id="pagination-controls">
          <!-- Dynamic Page Buttons -->
        </div>
      </div>
    </div>

  </div>

  <!-- Add / Edit Modal -->
  <div id="product-modal" class="modal-overlay">
    <div class="modal-box">
      <div class="modal-header">
        <h3 id="modal-title">إضافة منتج جديد</h3>
        <button id="close-modal-btn" class="btn btn-secondary btn-icon"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <form id="product-form">
        <div class="modal-body">
          <input type="hidden" id="form-product-id">
          
          <div class="form-group">
            <label id="lbl-form-code">رقم كود المنتج (Product Code) *</label>
            <input type="text" id="form-code" class="form-control" required placeholder="مثال: 15041002">
          </div>

          <div class="form-group">
            <label id="lbl-form-name-ar">اسم المنتج بالعربية (Name AR) *</label>
            <input type="text" id="form-name-ar" class="form-control" required placeholder="مثال: دونات بوسطن كرايم">
          </div>

          <div class="form-group">
            <label id="lbl-form-name-en">اسم المنتج بالإنجليزية (Name EN) *</label>
            <input type="text" id="form-name-en" class="form-control" required placeholder="Example: Boston Kreme Donut">
          </div>

          <div class="form-group">
            <label id="lbl-form-cat-ar">الفئة بالعربية (Category AR) *</label>
            <input type="text" id="form-cat-ar" class="form-control" required placeholder="مثال: دونات فانسى ومميز">
          </div>

          <div class="form-group">
            <label id="lbl-form-cat-en">الفئة بالإنجليزية (Category EN) *</label>
            <input type="text" id="form-cat-en" class="form-control" required placeholder="Example: Fancy Donuts">
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" id="cancel-modal-btn" class="btn btn-secondary">إلغاء</button>
          <button type="submit" class="btn btn-primary" id="save-modal-btn">حفظ البيانات</button>
        </div>
      </form>
    </div>
  </div>

  <!-- JavaScript Engine -->
  <script>
    // 256 Embedded Dunkin Products Dataset
    const INITIAL_PRODUCTS = ${productsJSON};

    // Dictionary for Multilingual Translations
    const TRANSLATIONS = {
      ar: {
        appTitle: 'قائمة منتجات المتجر',
        appSubtitle: 'إدارة وتصفح 256 منتجاً مع الأكواد والفئات بكل سهولة',
        langBtnText: 'English (LTR)',
        addBtnText: 'إضافة منتج جديد',
        exportBtnText: 'تصدير CSV',
        resetBtnText: 'إعادة ضبط البيانات',
        statTotal: 'إجمالي المنتجات',
        statShowing: 'المنتجات المعروضة',
        statCats: 'إجمالي الفئات',
        searchPlaceholder: 'ابحث باسم المنتج، الكود، أو الفئة...',
        allCategories: 'جميع الفئات (All Categories)',
        counterLabel: 'نتائج البحث:',
        showingOf: (showing, total) => \`عرض \${showing} من إجمالي \${total} منتج\`,
        thSn: '#',
        thCode: 'الكود (ID)',
        thName: 'اسم المنتج (Product Name)',
        thCategory: 'الفئة (Category)',
        thActions: 'الإجراءات',
        emptyTitle: 'لم يتم العثور على أي نتائج',
        emptyDesc: 'جرب البحث بكلمات أخرى أو قم بتغيير الفئة المحددة',
        pageSizeLabel: 'عدد العناصر بالصفحة:',
        all: 'الكل (All)',
        modalAddTitle: 'إضافة منتج جديد',
        modalEditTitle: 'تعديل بيانات المنتج',
        lblCode: 'رقم كود المنتج (Product Code) *',
        lblNameAr: 'اسم المنتج بالعربية (Name AR) *',
        lblNameEn: 'اسم المنتج بالإنجليزية (Name EN) *',
        lblCatAr: 'الفئة بالعربية (Category AR) *',
        lblCatEn: 'الفئة بالإنجليزية (Category EN) *',
        btnCancel: 'إلغاء',
        btnSave: 'حفظ البيانات',
        confirmDelete: 'هل أنت تأكد من رغبتك في حذف هذا المنتج؟',
        confirmReset: 'هل تريد إعادة ضبط القائمة وإستعادة الـ 256 منتج الأصلية؟',
        btnEdit: 'تعديل',
        btnDelete: 'حذف'
      },
      en: {
        appTitle: 'Store Product Catalog',
        appSubtitle: 'Manage and explore 256 products with codes & categories smoothly',
        langBtnText: 'العربية (RTL)',
        addBtnText: 'Add New Product',
        exportBtnText: 'Export CSV',
        resetBtnText: 'Reset Dataset',
        statTotal: 'Total Products',
        statShowing: 'Displayed Products',
        statCats: 'Total Categories',
        searchPlaceholder: 'Search by product name, code, or category...',
        allCategories: 'All Categories',
        counterLabel: 'Search Results:',
        showingOf: (showing, total) => \`Showing \${showing} of \${total} products\`,
        thSn: '#',
        thCode: 'Code (ID)',
        thName: 'Product Name',
        thCategory: 'Category',
        thActions: 'Actions',
        emptyTitle: 'No products found',
        emptyDesc: 'Try searching with different terms or select another category',
        pageSizeLabel: 'Items per page:',
        all: 'All',
        modalAddTitle: 'Add New Product',
        modalEditTitle: 'Edit Product Details',
        lblCode: 'Product Code (ID) *',
        lblNameAr: 'Product Name (Arabic) *',
        lblNameEn: 'Product Name (English) *',
        lblCatAr: 'Category (Arabic) *',
        lblCatEn: 'Category (English) *',
        btnCancel: 'Cancel',
        btnSave: 'Save Product',
        confirmDelete: 'Are you sure you want to delete this product?',
        confirmReset: 'Are you sure you want to reset dataset back to original 256 products?',
        btnEdit: 'Edit',
        btnDelete: 'Delete'
      }
    };

    // State Management
    let currentLang = localStorage.getItem('dunkin_app_lang') || 'ar';
    let currentTheme = localStorage.getItem('dunkin_app_theme') || 'dark';
    let products = JSON.parse(localStorage.getItem('dunkin_products_256')) || INITIAL_PRODUCTS;
    let filteredProducts = [...products];
    let currentPage = 1;
    let pageSize = 50;

    // Helper: Normalize Arabic string for forgiving search
    function normalizeStr(str) {
      if (!str) return '';
      return String(str)
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .trim();
    }

    // DOM Elements
    const langToggleBtn = document.getElementById('lang-toggle-btn');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const categoryFilter = document.getElementById('category-filter');
    const resetBtn = document.getElementById('reset-btn');
    const addProductBtn = document.getElementById('add-product-btn');
    const exportBtn = document.getElementById('export-btn');
    const pageSizeSelect = document.getElementById('page-size-select');
    
    const modal = document.getElementById('product-modal');
    const productForm = document.getElementById('product-form');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelModalBtn = document.getElementById('cancel-modal-btn');

    // Initialize Application
    function initApp() {
      applyTheme(currentTheme);
      applyLanguage(currentLang);
      populateCategoryDropdown();
      filterProducts();

      // Setup Listeners
      langToggleBtn.addEventListener('click', toggleLanguage);
      themeToggleBtn.addEventListener('click', toggleTheme);
      searchInput.addEventListener('input', handleSearchInput);
      clearSearchBtn.addEventListener('click', clearSearch);
      categoryFilter.addEventListener('change', () => { currentPage = 1; filterProducts(); });
      pageSizeSelect.addEventListener('change', (e) => { pageSize = parseInt(e.target.value); currentPage = 1; renderTable(); });
      resetBtn.addEventListener('click', resetDataset);
      addProductBtn.addEventListener('click', () => openModal('add'));
      exportBtn.addEventListener('click', exportToCSV);

      closeModalBtn.addEventListener('click', closeModal);
      cancelModalBtn.addEventListener('click', closeModal);
      productForm.addEventListener('submit', handleFormSubmit);
    }

    // Language Switch Engine
    function toggleLanguage() {
      currentLang = currentLang === 'ar' ? 'en' : 'ar';
      localStorage.setItem('dunkin_app_lang', currentLang);
      applyLanguage(currentLang);
      populateCategoryDropdown();
      renderTable();
    }

    function applyLanguage(lang) {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

      const t = TRANSLATIONS[lang];
      document.getElementById('ui-title').innerText = t.appTitle;
      document.getElementById('ui-subtitle').innerText = t.appSubtitle;
      document.getElementById('lang-btn-text').innerText = t.langBtnText;
      document.getElementById('add-btn-text').innerText = t.addBtnText;
      document.getElementById('export-btn-text').innerText = t.exportBtnText;
      document.getElementById('reset-btn-text').innerText = t.resetBtnText;
      document.getElementById('stat-total-label').innerText = t.statTotal;
      document.getElementById('stat-showing-label').innerText = t.statShowing;
      document.getElementById('stat-cats-label').innerText = t.statCats;
      
      searchInput.placeholder = t.searchPlaceholder;
      document.getElementById('counter-label').innerText = t.counterLabel;

      document.getElementById('th-sn').innerText = t.thSn;
      document.getElementById('th-code').innerText = t.thCode;
      document.getElementById('th-name').innerText = t.thName;
      document.getElementById('th-category').innerText = t.thCategory;
      document.getElementById('th-actions').innerText = t.thActions;

      document.getElementById('empty-title').innerText = t.emptyTitle;
      document.getElementById('empty-desc').innerText = t.emptyDesc;
      document.getElementById('page-size-label').innerText = t.pageSizeLabel;

      // Update Modal Strings
      document.getElementById('lbl-form-code').innerText = t.lblCode;
      document.getElementById('lbl-form-name-ar').innerText = t.lblNameAr;
      document.getElementById('lbl-form-name-en').innerText = t.lblNameEn;
      document.getElementById('lbl-form-cat-ar').innerText = t.lblCatAr;
      document.getElementById('lbl-form-cat-en').innerText = t.lblCatEn;
      document.getElementById('cancel-modal-btn').innerText = t.btnCancel;
      document.getElementById('save-modal-btn').innerText = t.btnSave;
    }

    // Theme Switch Engine
    function toggleTheme() {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('dunkin_app_theme', currentTheme);
      applyTheme(currentTheme);
    }

    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      themeToggleBtn.innerHTML = theme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    }

    // Populate Category Dropdown
    function populateCategoryDropdown() {
      const selectedVal = categoryFilter.value || 'ALL';
      const categoriesMap = new Map();

      products.forEach(p => {
        const catKey = p.category_ar + '___' + p.category_en;
        const catLabel = currentLang === 'ar' ? p.category_ar : p.category_en;
        categoriesMap.set(catKey, catLabel);
      });

      categoryFilter.innerHTML = \`<option value="ALL">\${TRANSLATIONS[currentLang].allCategories}</option>\`;

      Array.from(categoriesMap.entries()).sort((a, b) => a[1].localeCompare(b[1])).forEach(([key, label]) => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.innerText = label;
        if (key === selectedVal) opt.selected = true;
        categoryFilter.appendChild(opt);
      });

      document.getElementById('stat-cats-val').innerText = categoriesMap.size;
    }

    // Search and Filter Logic
    function handleSearchInput(e) {
      clearSearchBtn.style.display = e.target.value ? 'block' : 'none';
      currentPage = 1;
      filterProducts();
    }

    function clearSearch() {
      searchInput.value = '';
      clearSearchBtn.style.display = 'none';
      currentPage = 1;
      filterProducts();
      searchInput.focus();
    }

    function filterProducts() {
      const query = normalizeStr(searchInput.value);
      const catVal = categoryFilter.value;

      filteredProducts = products.filter(p => {
        // Category Filter Match
        if (catVal !== 'ALL') {
          const catKey = p.category_ar + '___' + p.category_en;
          if (catKey !== catVal) return false;
        }

        // Search Term Match
        if (!query) return true;

        const codeMatch = normalizeStr(p.code).includes(query);
        const nameArMatch = normalizeStr(p.name_ar).includes(query);
        const nameEnMatch = normalizeStr(p.name_en).includes(query);
        const catArMatch = normalizeStr(p.category_ar).includes(query);
        const catEnMatch = normalizeStr(p.category_en).includes(query);

        return codeMatch || nameArMatch || nameEnMatch || catArMatch || catEnMatch;
      });

      updateStatsAndCounter();
      renderTable();
    }

    // Stats & Counter Update
    function updateStatsAndCounter() {
      const t = TRANSLATIONS[currentLang];
      document.getElementById('stat-total-val').innerText = products.length;
      document.getElementById('stat-showing-val').innerText = filteredProducts.length;
      document.getElementById('counter-detail').innerText = t.showingOf(filteredProducts.length, products.length);
    }

    // Render Table Rows
    function renderTable() {
      const tbody = document.getElementById('products-tbody');
      const emptyState = document.getElementById('empty-state');
      tbody.innerHTML = '';

      if (filteredProducts.length === 0) {
        emptyState.style.display = 'block';
        document.getElementById('pagination-controls').innerHTML = '';
        return;
      }

      emptyState.style.display = 'none';

      // Pagination Calculation
      const totalPages = Math.ceil(filteredProducts.length / pageSize);
      if (currentPage > totalPages) currentPage = totalPages || 1;

      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, filteredProducts.length);
      const pageItems = filteredProducts.slice(startIndex, endIndex);

      const t = TRANSLATIONS[currentLang];

      pageItems.forEach((p, idx) => {
        const tr = document.createElement('tr');
        
        const serialNo = startIndex + idx + 1;
        const productName = currentLang === 'ar' ? p.name_ar : p.name_en;
        const categoryName = currentLang === 'ar' ? p.category_ar : p.category_en;

        tr.innerHTML = \`
          <td class="serial-col">\${serialNo}</td>
          <td>
            <span class="product-code-badge">
              <i class="fa-solid fa-barcode" style="opacity: 0.6;"></i>
              \${escapeHtml(p.code)}
            </span>
          </td>
          <!-- CRITICAL BOLD STYLING REQUIREMENT -->
          <td class="product-name-bold">\${escapeHtml(productName)}</td>
          <td>
            <span class="category-badge">
              <i class="fa-solid fa-tag"></i>
              \${escapeHtml(categoryName)}
            </span>
          </td>
          <td>
            <div class="actions-cell">
              <button class="btn btn-secondary btn-sm" onclick="openModal('edit', '\${p.id}')" title="\${t.btnEdit}">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="btn btn-secondary btn-sm" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" onclick="deleteProduct('\${p.id}')" title="\${t.btnDelete}">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </td>
        \`;

        tbody.appendChild(tr);
      });

      renderPaginationControls(totalPages);
    }

    // Pagination Controls Render
    function renderPaginationControls(totalPages) {
      const container = document.getElementById('pagination-controls');
      container.innerHTML = '';

      if (totalPages <= 1) return;

      // Prev Button
      const prevBtn = document.createElement('button');
      prevBtn.className = 'page-num';
      prevBtn.innerHTML = currentLang === 'ar' ? '<i class="fa-solid fa-chevron-right"></i>' : '<i class="fa-solid fa-chevron-left"></i>';
      prevBtn.disabled = currentPage === 1;
      prevBtn.style.opacity = currentPage === 1 ? '0.5' : '1';
      prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; renderTable(); } };
      container.appendChild(prevBtn);

      // Page numbers range
      let startPage = Math.max(1, currentPage - 2);
      let endPage = Math.min(totalPages, currentPage + 2);

      for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.className = \`page-num \${i === currentPage ? 'active' : ''}\`;
        btn.innerText = i;
        btn.onclick = () => { currentPage = i; renderTable(); };
        container.appendChild(btn);
      }

      // Next Button
      const nextBtn = document.createElement('button');
      nextBtn.className = 'page-num';
      nextBtn.innerHTML = currentLang === 'ar' ? '<i class="fa-solid fa-chevron-left"></i>' : '<i class="fa-solid fa-chevron-right"></i>';
      nextBtn.disabled = currentPage === totalPages;
      nextBtn.style.opacity = currentPage === totalPages ? '0.5' : '1';
      nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; renderTable(); } };
      container.appendChild(nextBtn);
    }

    // CRUD Modal Actions
    function openModal(mode, productId = null) {
      const t = TRANSLATIONS[currentLang];
      modal.classList.add('active');

      if (mode === 'add') {
        document.getElementById('modal-title').innerText = t.modalAddTitle;
        document.getElementById('form-product-id').value = '';
        productForm.reset();
        document.getElementById('form-code').value = String(Date.now()).slice(-8);
      } else if (mode === 'edit') {
        document.getElementById('modal-title').innerText = t.modalEditTitle;
        const p = products.find(prod => prod.id === productId);
        if (p) {
          document.getElementById('form-product-id').value = p.id;
          document.getElementById('form-code').value = p.code;
          document.getElementById('form-name-ar').value = p.name_ar;
          document.getElementById('form-name-en').value = p.name_en;
          document.getElementById('form-cat-ar').value = p.category_ar;
          document.getElementById('form-cat-en').value = p.category_en;
        }
      }
    }

    function closeModal() {
      modal.classList.remove('active');
    }

    function handleFormSubmit(e) {
      e.preventDefault();
      const id = document.getElementById('form-product-id').value;
      const code = document.getElementById('form-code').value.trim();
      const name_ar = document.getElementById('form-name-ar').value.trim();
      const name_en = document.getElementById('form-name-en').value.trim();
      const category_ar = document.getElementById('form-cat-ar').value.trim();
      const category_en = document.getElementById('form-cat-en').value.trim();

      if (id) {
        // Edit existing product
        const idx = products.findIndex(p => p.id === id);
        if (idx !== -1) {
          products[idx] = { id, code, name_ar, name_en, category_ar, category_en };
        }
      } else {
        // Add new product
        const newProduct = {
          id: 'prod_' + Date.now(),
          code,
          name_ar,
          name_en,
          category_ar,
          category_en
        };
        products.unshift(newProduct);
      }

      saveAndRefresh();
      closeModal();
    }

    function deleteProduct(id) {
      const t = TRANSLATIONS[currentLang];
      if (confirm(t.confirmDelete)) {
        products = products.filter(p => p.id !== id);
        saveAndRefresh();
      }
    }

    function resetDataset() {
      const t = TRANSLATIONS[currentLang];
      if (confirm(t.confirmReset)) {
        products = [...INITIAL_PRODUCTS];
        saveAndRefresh();
      }
    }

    function saveAndRefresh() {
      localStorage.setItem('dunkin_products_256', JSON.stringify(products));
      populateCategoryDropdown();
      filterProducts();
    }

    // Export to CSV Functionality
    function exportToCSV() {
      const headers = ['#', 'Product Code', 'Product Name (AR)', 'Product Name (EN)', 'Category (AR)', 'Category (EN)'];
      const rows = filteredProducts.map((p, idx) => [
        idx + 1,
        \`"\${p.code}"\`,
        \`"\${p.name_ar.replace(/"/g, '""')}"\`,
        \`"\${p.name_en.replace(/"/g, '""')}"\`,
        \`"\${p.category_ar.replace(/"/g, '""')}"\`,
        \`"\${p.category_en.replace(/"/g, '""')}"\`
      ]);

      const csvContent = '\\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', \`products_catalog_\${Date.now()}.csv\`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    // Helper: Security escape HTML
    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // Boot App
    document.addEventListener('DOMContentLoaded', initApp);
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'build_index.html'), htmlContent, 'utf8');
console.log('build_index.html generated!');
