/**
 * Enterprise PDF Report Generator for Sitak Villa IT/ELV Infrastructure
 * Provides crystal-clear, high-resolution vector PDF export with 100% native
 * Kurdish/Arabic (RTL) text shaping, styled tables, status badges, and executive branding.
 */

const isRtlText = (text) => {
  if (!text || typeof text !== 'string') return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
};

/**
 * Creates and opens a printable PDF document window with auto-print
 */
function openPdfPrintWindow(htmlContent, title = 'Infrastructure_Report') {
  const printWindow = window.open('', '_blank', 'width=950,height=900,menubar=no,toolbar=no,location=no,status=no');
  if (!printWindow) {
    alert('Pop-up window was blocked. Please allow pop-ups for this site to export PDF.');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();

  // Wait for web fonts & styles to load before triggering print dialog
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 400);
  };
}

/**
 * Common HTML template wrapper for PDF reports
 */
function buildReportHtmlTemplate({ title, subtitle, isRtl, projectName, dateStr, bodyContent, isKu }) {
  const dir = isRtl ? 'rtl' : 'ltr';
  const textAlign = isRtl ? 'right' : 'left';

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${isKu ? 'ku' : 'en'}">
<head>
  <meta charset="utf-8" />
  <title>${title} - ${projectName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap');

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #0f172a;
      background-color: #f8fafc;
      padding: 0;
      margin: 0;
      direction: ${dir};
      text-align: ${textAlign};
    }

    /* Screen Action Bar (Hidden when printed or saved as PDF) */
    .screen-toolbar {
      position: sticky;
      top: 0;
      z-index: 9999;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      border-bottom: 2px solid #6366f1;
    }
    .screen-toolbar .btn-group {
      display: flex;
      gap: 10px;
    }
    .screen-btn {
      padding: 8px 18px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s ease;
      border: none;
    }
    .screen-btn-primary {
      background: #4f46e5;
      color: #ffffff;
    }
    .screen-btn-primary:hover {
      background: #4338ca;
    }
    .screen-btn-secondary {
      background: #334155;
      color: #e2e8f0;
    }
    .screen-btn-secondary:hover {
      background: #475569;
    }

    /* Printable Page Container */
    .page-container {
      max-width: 900px;
      margin: 20px auto;
      background: #ffffff;
      padding: 32px 36px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      border-radius: 12px;
    }

    /* Document Header */
    .doc-header {
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 18px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }
    .brand-title {
      font-size: 20pt;
      font-weight: 800;
      color: #1e1b4b;
      line-height: 1.2;
      letter-spacing: -0.5px;
    }
    .brand-sub {
      font-size: 11pt;
      font-weight: 600;
      color: #4f46e5;
      margin-top: 4px;
    }
    .meta-box {
      text-align: ${isRtl ? 'left' : 'right'};
      font-family: 'JetBrains Mono', monospace;
      font-size: 9pt;
      color: #64748b;
      line-height: 1.4;
    }
    .meta-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      background: #e0e7ff;
      color: #3730a3;
      font-weight: 700;
      margin-bottom: 4px;
    }

    /* Typography & Sections */
    h1, h2, h3, h4 {
      color: #0f172a;
      font-weight: 700;
      margin-top: 18px;
      margin-bottom: 10px;
    }
    h2 { font-size: 14pt; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; }
    h3 { font-size: 12pt; color: #334155; }
    p { margin-bottom: 12px; }
    ul, ol { margin-bottom: 14px; padding-${isRtl ? 'right' : 'left'}: 24px; }
    li { margin-bottom: 6px; }

    /* Tables */
    .report-table-wrapper {
      margin: 18px 0 24px 0;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      direction: ${dir};
      text-align: ${textAlign};
    }
    th {
      background-color: #1e1b4b;
      color: #ffffff;
      padding: 9px 12px;
      font-weight: 700;
      border-bottom: 2px solid #4338ca;
      font-family: 'JetBrains Mono', 'Vazirmatn', monospace;
      white-space: nowrap;
    }
    td {
      padding: 8px 12px;
      border-bottom: 1px solid #e2e8f0;
      color: #1e293b;
      vertical-align: middle;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    tr:last-child td {
      border-bottom: none;
    }

    /* Badges in tables */
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 12px;
      font-size: 8pt;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
    }
    .badge-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .badge-info { background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; }
    .badge-warning { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .badge-primary { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }

    .ip-code {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      color: #0284c7;
    }
    .label-code {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      color: #0f172a;
    }

    /* Footer */
    .doc-footer {
      margin-top: 36px;
      padding-top: 14px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8pt;
      color: #94a3b8;
    }

    /* Print Specific Rules */
    @page {
      size: A4 portrait;
      margin: 12mm 15mm 15mm 15mm;
    }
    @media print {
      body {
        background: #ffffff !important;
        font-size: 9.5pt;
      }
      .screen-toolbar {
        display: none !important;
      }
      .page-container {
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
      .report-table-wrapper {
        page-break-inside: auto;
      }
      tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
      thead {
        display: table-header-group;
      }
      tfoot {
        display: table-footer-group;
      }
    }
  </style>
</head>
<body>
  <!-- Floating screen control bar -->
  <div class="screen-toolbar no-print">
    <div>
      <strong style="font-size: 14px; color: #a5b4fc;">Gemini Infrastructure AI • PDF Export Preview</strong>
      <span style="font-size: 12px; color: #94a3b8; margin-${isRtl ? 'right' : 'left'}: 12px;">
        ${isKu ? 'لە پەنجەرەی چاپدا Destination بکە بە "Save as PDF"' : 'Select "Save as PDF" as the print destination to download.'}
      </span>
    </div>
    <div class="btn-group">
      <button class="screen-btn screen-btn-primary" onclick="window.print()">
        🖨️ ${isKu ? 'داگرتن یان چاپکردن بە PDF' : 'Save as PDF / Print'}
      </button>
      <button class="screen-btn screen-btn-secondary" onclick="window.close()">
        ✕ ${isKu ? 'داخستن' : 'Close'}
      </button>
    </div>
  </div>

  <!-- Document Page Container -->
  <div class="page-container">
    <header class="doc-header">
      <div>
        <div class="brand-title">${projectName || 'Iraq Sitak Villa Project'}</div>
        <div class="brand-sub">${title}</div>
      </div>
      <div class="meta-box">
        <div class="meta-badge">Gemini 2.5 Flash AI</div>
        <div><strong>Date:</strong> ${dateStr}</div>
        <div><strong>Ref:</strong> SITAK-ELV-${Date.now().toString().slice(-6)}</div>
      </div>
    </header>

    <main>
      ${bodyContent}
    </main>

    <footer class="doc-footer">
      <div>${projectName} • ELV & IT Network Infrastructure Management System</div>
      <div>Confidential • Autonomous AI Report</div>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Formats a 2D Array / Table into styled HTML
 */
function formatTableHtml(tableData, isRtl) {
  if (!Array.isArray(tableData) || tableData.length === 0) return '';
  const headers = tableData[0] || [];
  const rows = tableData.slice(1);

  let html = `<div class="report-table-wrapper"><table>`;
  html += `<thead><tr>`;
  headers.forEach((h) => {
    html += `<th>${h}</th>`;
  });
  html += `</tr></thead><tbody>`;

  rows.forEach((row) => {
    html += `<tr>`;
    row.forEach((cell, idx) => {
      const cellStr = String(cell || '').trim();
      const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cellStr);
      const isStatus = /verified|configured|operational|installed|pending/i.test(cellStr);

      let badgeClass = 'badge-info';
      if (/verified|operational/i.test(cellStr)) badgeClass = 'badge-success';
      else if (/installed/i.test(cellStr)) badgeClass = 'badge-primary';
      else if (/pending/i.test(cellStr)) badgeClass = 'badge-warning';

      let cellFormatted = cellStr;
      if (isIp) {
        cellFormatted = `<span class="ip-code">${cellStr}</span>`;
      } else if (isStatus) {
        cellFormatted = `<span class="badge ${badgeClass}">${cellStr}</span>`;
      } else if (idx === 0) {
        cellFormatted = `<span class="label-code">${cellStr}</span>`;
      }

      html += `<td>${cellFormatted}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table></div>`;
  return html;
}

/**
 * Export a single Table to a styled PDF Document
 */
export function exportTableToPdf({
  tableData = [],
  title = 'Infrastructure Table Report',
  subtitle = 'Detailed Equipment & Network Topology Breakdown',
  projectName = 'Iraq Sitak Villa Project',
  isKu = false,
}) {
  const isRtl = isKu || tableData.some((r) => r.some(isRtlText));
  const dateStr = new Date().toLocaleString(isKu ? 'en-US' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const tableHtml = formatTableHtml(tableData, isRtl);
  const bodyContent = `
    <div style="margin-bottom: 14px;">
      <p style="font-size: 11pt; color: #475569;">
        ${isKu
          ? `ئەم ڕاپۆرتە بە شێوەیەکی ئۆتۆماتیکی لە لایەن <strong>Gemini Infrastructure AI</strong> ئامادە کراوە لەسەر بنەمای داتای ڕاستەقینەی ئامێرەکان، سویچەکان و ڕاکەکانی پڕۆژەی <strong>${projectName}</strong>.`
          : `This report was synthesized autonomously by <strong>Gemini Infrastructure AI</strong> referencing live project equipment, switch ports, and rack topologies for <strong>${projectName}</strong>.`
        }
      </p>
    </div>
    ${tableHtml}
  `;

  const fullHtml = buildReportHtmlTemplate({
    title,
    subtitle,
    isRtl,
    projectName,
    dateStr,
    bodyContent,
    isKu,
  });

  openPdfPrintWindow(fullHtml, title.replace(/\s+/g, '_'));
}

/**
 * Export an entire Assistant Message (Text + Tables) to a styled PDF Document
 */
export function exportReportMessageToPdf({
  messageContent = '',
  title = 'Infrastructure Engineering Report',
  projectName = 'Iraq Sitak Villa Project',
  isKu = false,
}) {
  const isRtl = isKu || isRtlText(messageContent);
  const dateStr = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Parse lines: distinguish between text paragraphs, headers, and markdown tables
  const lines = messageContent.split('\n');
  let bodyHtml = '';
  let inTable = false;
  let currentTable = [];

  const flushTable = () => {
    if (currentTable.length > 0) {
      bodyHtml += formatTableHtml(currentTable, isRtl);
      currentTable = [];
    }
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('|') && line.endsWith('|')) {
      inTable = true;
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim().replace(/\*\*/g, '').replace(/`/g, ''));
      const isSep = cells.every((c) => /^:?-+:?$/.test(c.trim()));
      if (!isSep) {
        currentTable.push(cells);
      }
    } else {
      if (inTable) flushTable();

      if (!line) {
        bodyHtml += '<br/>';
      } else if (line.startsWith('### ')) {
        bodyHtml += `<h3>${line.replace('### ', '')}</h3>`;
      } else if (line.startsWith('## ')) {
        bodyHtml += `<h2>${line.replace('## ', '')}</h2>`;
      } else if (line.startsWith('# ')) {
        bodyHtml += `<h1>${line.replace('# ', '')}</h1>`;
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        const item = line.substring(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        bodyHtml += `<ul><li>${item}</li></ul>`;
      } else {
        const pText = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code class="ip-code">$1</code>');
        bodyHtml += `<p>${pText}</p>`;
      }
    }
  }

  if (inTable) flushTable();

  const fullHtml = buildReportHtmlTemplate({
    title,
    subtitle: isKu ? 'ڕاپۆرتی شیکاری و پەیوەندی ئامێرەکان' : 'Engineering Diagnostic & Topology Summary',
    isRtl,
    projectName,
    dateStr,
    bodyContent: bodyHtml,
    isKu,
  });

  openPdfPrintWindow(fullHtml, title.replace(/\s+/g, '_'));
}

