const fs = require('fs');

let app = fs.readFileSync('app.js', 'utf8');

// Find the existing thermal receipt section in app.js
const printStart = app.indexOf('// ==========================================\n// THERMAL RECEIPT PRINTING');
const printEnd = app.indexOf('// ==========================================\n// UNIVERSAL PRODUCT CRUD MODALS');

const upgradedPrintingSection = `// ==========================================
// PROFESSIONAL POS INVOICE & RECEIPT PRINTING
// ==========================================

AppState.activePrintingInvoiceId = null;
AppState.activePrintFormat = '80mm';

function generateReceiptHTML(invoice, format = '80mm') {
  const isA4 = format === 'a4';
  const widthStyle = isA4 ? 'max-w-3xl mx-auto p-8' : 'w-[80mm] mx-auto p-4';
  const fontSize = isA4 ? 'text-sm' : 'text-xs';

  const itemsRows = (invoice.items || []).map((item, idx) => \`
    <tr class="border-b border-gray-200">
      <td class="py-1.5 text-right font-medium">
        <div>\${item.name || 'صنف'}</div>
        \${item.barcode ? \`<div class="text-[10px] text-gray-500 font-mono">\${item.barcode}</div>\` : ''}
      </td>
      <td class="py-1.5 text-center font-mono font-bold">\${item.quantity || 1}</td>
      <td class="py-1.5 text-center font-mono">\${formatMoney(item.price || 0)}</td>
      <td class="py-1.5 text-left font-mono font-bold">\${formatMoney(item.total || (item.price * item.quantity))}</td>
    </tr>
  \`).join('');

  return \`
    <div id="thermal-receipt-printable" class="\${widthStyle} bg-white text-black font-sans leading-relaxed select-text" style="direction: rtl;">
      
      <!-- Store Header -->
      <div class="text-center pb-3 border-b-2 border-dashed border-gray-400">
        <div class="inline-block p-1 bg-black text-white rounded-lg mb-1 font-bold text-xs">HELMY POS</div>
        <h2 class="\${isA4 ? 'text-2xl' : 'text-lg'} font-black tracking-tight">حلمي سنترال وموبايل</h2>
        <p class="text-[11px] text-gray-700 font-medium mt-0.5">للهواتف الذكية والإكسسوارات والشواحن وخدمات فودافون كاش</p>
        <p class="text-[10px] text-gray-600 mt-0.5">الفرع الرئيسي • هاتف المبيعات: 01000000000</p>
      </div>

      <!-- Invoice Meta Details -->
      <div class="py-2.5 border-b border-dashed border-gray-300 text-[11px] space-y-1">
        <div class="flex justify-between items-center">
          <span class="text-gray-600">رقم الفاتورة:</span>
          <span class="font-mono font-bold text-black">\${invoice.invoiceNumber || 'INV-001'}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-gray-600">التاريخ والوقت:</span>
          <span class="font-mono">\${formatDate(invoice.timestamp)} - \${formatTime(invoice.timestamp)}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-gray-600">اسم الكاشير:</span>
          <span class="font-medium">\${invoice.cashier || 'أدمن الوردية • حلمي'}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-gray-600">العميل:</span>
          <span class="font-medium">\${invoice.customerName || 'عميل نقدي'} \${invoice.customerPhone ? \`(\${invoice.customerPhone})\` : ''}</span>
        </div>
      </div>

      <!-- Items Table -->
      <div class="py-2 border-b-2 border-dashed border-gray-400">
        <table class="w-full \${fontSize}">
          <thead>
            <tr class="border-b-2 border-black text-gray-800 text-[11px]">
              <th class="text-right py-1.5">الصنف</th>
              <th class="text-center py-1.5">الكمية</th>
              <th class="text-center py-1.5">السعر</th>
              <th class="text-left py-1.5">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            \${itemsRows}
          </tbody>
        </table>
      </div>

      <!-- Financial Calculation Summary -->
      <div class="py-2.5 border-b-2 border-dashed border-gray-400 text-xs space-y-1">
        <div class="flex justify-between items-center text-gray-700">
          <span>المجموع الفرعي:</span>
          <span class="font-mono font-bold">\${formatMoney(invoice.subtotal || invoice.totalAmount)} ج.م</span>
        </div>
        \${(invoice.discount || 0) > 0 ? \`
          <div class="flex justify-between items-center text-red-600 font-bold">
            <span>الخصم المباشر:</span>
            <span class="font-mono">-\${formatMoney(invoice.discount)} ج.م</span>
          </div>
        \` : ''}
        <div class="flex justify-between items-center py-1.5 border-t border-b border-black my-1 text-black font-black \${isA4 ? 'text-lg' : 'text-base'}">
          <span>صافي المطلوب:</span>
          <span class="font-mono">\${formatMoney(invoice.totalAmount)} ج.م</span>
        </div>
        <div class="flex justify-between items-center text-gray-800 pt-0.5">
          <span>المبلغ المدفوع:</span>
          <span class="font-mono font-bold">\${formatMoney(invoice.cashPaid || invoice.totalAmount)} ج.م</span>
        </div>
        <div class="flex justify-between items-center text-gray-800">
          <span>المتبقي للعميل (الباقي):</span>
          <span class="font-mono font-bold text-emerald-700">\${formatMoney(invoice.change || 0)} ج.م</span>
        </div>
      </div>

      <!-- Barcode Visual Representation -->
      <div class="py-3 text-center border-b border-dashed border-gray-300">
        <div class="inline-block tracking-widest font-mono font-bold text-sm bg-gray-100 px-3 py-1 rounded border border-gray-300 mb-1">
          *\${invoice.invoiceNumber || 'INV-001'}*
        </div>
        <div class="text-[9px] text-gray-500">امسح الكود بمسدس الباركود للاسترجاع السريع</div>
      </div>

      <!-- Policies & Thank you note -->
      <div class="pt-3 text-center text-[10px] text-gray-600 space-y-1">
        <p class="font-bold text-black">البضاعة المباعة ترد وتستبدل خلال 14 يوماً مع أصل الفاتورة</p>
        <p>القطع الإلكترونية والشواحن بضمان التجربة الفورية والاستبدال</p>
        <p class="pt-1 text-black font-medium">سعداء بخدمتكم دائماً في حلمي سنترال وموبايل 📱⚡</p>
        <div class="text-[8px] text-gray-400 pt-1">نظام حلمي كاشير سحابي • مدعوم بمزامنة لحظية</div>
      </div>

    </div>
  \`;
}

window.printInvoiceReceipt = (invoiceId, format = '80mm') => {
  const invoice = Store.salesInvoices.find(inv => inv.id === invoiceId) || Store.salesInvoices[0];
  if (!invoice) {
    showToast('لم يتم العثور على الفاتورة', 'warning');
    return;
  }

  AppState.activePrintingInvoiceId = invoice.id;
  AppState.activePrintFormat = format;

  const modal = document.getElementById('modal-thermal-receipt');
  const container = document.getElementById('thermal-receipt-content');

  if (modal && container) {
    container.innerHTML = generateReceiptHTML(invoice, format);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
};

window.setReceiptFormat = (format) => {
  AppState.activePrintFormat = format;
  if (AppState.activePrintingInvoiceId) {
    window.printInvoiceReceipt(AppState.activePrintingInvoiceId, format);
  }
};

window.closeThermalReceiptModal = () => {
  const modal = document.getElementById('modal-thermal-receipt');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

window.executePrintReceipt = (format = null) => {
  const useFormat = format || AppState.activePrintFormat || '80mm';
  const invoice = Store.salesInvoices.find(inv => inv.id === AppState.activePrintingInvoiceId) || Store.salesInvoices[0];
  if (!invoice) return;

  const receiptHtml = generateReceiptHTML(invoice, useFormat);

  // Hidden isolated iframe for flawless direct POS printing
  let iframe = document.getElementById('pos-receipt-print-frame');
  if (iframe) iframe.remove();

  iframe = document.createElement('iframe');
  iframe.id = 'pos-receipt-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(\`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>فاتورة \${invoice.invoiceNumber || ''}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Readex+Pro:wght@400;600;700&display=swap" rel="stylesheet">
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @page {
          size: \${useFormat === 'a4' ? 'A4 portrait' : '80mm auto'};
          margin: \${useFormat === 'a4' ? '12mm' : '2mm'};
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          margin: 0;
          padding: 0;
          background: #ffffff !important;
          color: #000000 !important;
          font-family: 'Cairo', 'Readex Pro', sans-serif;
        }
      </style>
    </head>
    <body onload="window.focus(); window.print();">
      \${receiptHtml}
    </body>
    </html>
  \`);
  doc.close();

  showToast('جاري إرسال الفاتورة إلى الطابعة...', 'print');
};
`;

app = app.replace(app.substring(printStart, printEnd), upgradedPrintingSection + '\n\n');
fs.writeFileSync('app.js', app, 'utf8');
console.log('Successfully upgraded receipt printing service in app.js!');
