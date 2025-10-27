import React from 'react';
import { useSelector } from 'react-redux';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download as DownloadIcon, FileSpreadsheet, FileText, File } from 'lucide-react';

export default function Download() {
  const invoices = useSelector(s => s.invoices.list);
  const products = useSelector(s => s.products.list);
  const customers = useSelector(s => s.customers.list);

  const hasData = invoices.length > 0 || products.length > 0 || customers.length > 0;

  if (!hasData) return null;

  // -------------------- Excel Export --------------------
  const downloadExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    
    // Invoices sheet
    if (invoices.length > 0) {
      const invoiceSheet = workbook.addWorksheet('Invoices');
      invoiceSheet.columns = [
        { header: 'Serial', key: 'serial', width: 15 },
        { header: 'Customer', key: 'customer', width: 25 },
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Taxable Amount', key: 'taxableAmount', width: 15 },
        { header: 'Tax Total', key: 'taxTotal', width: 12 },
        { header: 'Charges', key: 'chargesTotal', width: 12 },
        { header: 'Total', key: 'total', width: 12 },
        { header: 'Items', key: 'items', width: 50 }
      ];
      
      invoices.forEach(inv => {
        const itemsStr = (inv.items || [])
          .map(it => `${it.name} x${it.qty || 1} @₹${it.unitPrice || '-'}`)
          .join('; ');
        
        invoiceSheet.addRow({
          serial: inv.serial || '-',
          customer: inv.customer || '-',
          date: inv.date || '-',
          taxableAmount: inv.taxableAmount || 0,
          taxTotal: inv.taxTotal || 0,
          chargesTotal: inv.chargesTotal || 0,
          total: inv.total || 0,
          items: itemsStr
        });
      });
      
      // Style header
      invoiceSheet.getRow(1).font = { bold: true };
      invoiceSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' }
      };
      invoiceSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    }

    // Products sheet
    if (products.length > 0) {
      const productSheet = workbook.addWorksheet('Products');
      productSheet.columns = [
        { header: 'Name', key: 'name', width: 30 },
        { header: 'Quantity', key: 'quantity', width: 12 },
        { header: 'Unit Price', key: 'unitPrice', width: 12 },
        { header: 'Tax', key: 'tax', width: 12 },
        { header: 'Price w/ Tax', key: 'priceWithTax', width: 15 }
      ];
      
      products.forEach(p => {
        productSheet.addRow({
          name: p.name || '-',
          quantity: p.quantity || 0,
          unitPrice: p.unitPrice || '-',
          tax: p.tax || '-',
          priceWithTax: p.priceWithTax || '-'
        });
      });
      
      productSheet.getRow(1).font = { bold: true };
      productSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' }
      };
      productSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    }

    // Customers sheet
    if (customers.length > 0) {
      const customerSheet = workbook.addWorksheet('Customers');
      customerSheet.columns = [
        { header: 'Name', key: 'name', width: 30 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Total Purchase', key: 'totalPurchase', width: 15 }
      ];
      
      customers.forEach(c => {
        customerSheet.addRow({
          name: c.name || '-',
          phone: c.phone || '-',
          totalPurchase: c.totalPurchase || 0
        });
      });
      
      customerSheet.getRow(1).font = { bold: true };
      customerSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' }
      };
      customerSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    }

    // Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice_data_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // -------------------- CSV Export --------------------
  const downloadCSV = () => {
    let csv = '';

    // Invoices
    if (invoices.length > 0) {
      csv += 'INVOICES\n';
      csv += 'Serial,Customer,Date,Taxable Amount,Tax Total,Charges,Total,Items\n';
      invoices.forEach(inv => {
        const itemsStr = (inv.items || [])
          .map(it => `${it.name} x${it.qty || 1} @₹${it.unitPrice || '-'}`)
          .join('; ');
        csv += `"${inv.serial || '-'}","${inv.customer || '-'}","${inv.date || '-'}",${inv.taxableAmount || 0},${inv.taxTotal || 0},${inv.chargesTotal || 0},${inv.total || 0},"${itemsStr}"\n`;
      });
      csv += '\n';
    }

    // Products
    if (products.length > 0) {
      csv += 'PRODUCTS\n';
      csv += 'Name,Quantity,Unit Price,Tax,Price w/ Tax\n';
      products.forEach(p => {
        csv += `"${p.name || '-'}",${p.quantity || 0},${p.unitPrice || '-'},"${p.tax || '-'}",${p.priceWithTax || '-'}\n`;
      });
      csv += '\n';
    }

    // Customers
    if (customers.length > 0) {
      csv += 'CUSTOMERS\n';
      csv += 'Name,Phone,Total Purchase\n';
      customers.forEach(c => {
        csv += `"${c.name || '-'}","${c.phone || '-'}",${c.totalPurchase || 0}\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice_data_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // -------------------- PDF Export --------------------
  const downloadPDF = () => {
    try {
      const doc = new jsPDF();
      let yPos = 20;

      // Title
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text('Invoice Management System - Extracted Data', 14, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, yPos);
      yPos += 10;

      // Invoices
      if (invoices.length > 0) {
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Invoices', 14, yPos);
        yPos += 5;

        const invoiceData = invoices.map(inv => [
          inv.serial || '-',
          inv.customer || '-',
          inv.date || '-',
          `₹${inv.total || 0}`
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Serial', 'Customer', 'Date', 'Total']],
          body: invoiceData,
          theme: 'grid',
          headStyles: { fillColor: [37, 99, 235], textColor: 255 },
          margin: { left: 14 }
        });

        yPos = doc.lastAutoTable.finalY + 10;
      }

      // Products
      if (products.length > 0) {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Products', 14, yPos);
        yPos += 5;

        const productData = products.map(p => [
          p.name || '-',
          p.quantity || 0,
          `₹${p.unitPrice || '-'}`,
          p.tax || '-'
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Name', 'Quantity', 'Unit Price', 'Tax']],
          body: productData,
          theme: 'grid',
          headStyles: { fillColor: [37, 99, 235], textColor: 255 },
          margin: { left: 14 }
        });

        yPos = doc.lastAutoTable.finalY + 10;
      }

      // Customers
      if (customers.length > 0) {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Customers', 14, yPos);
        yPos += 5;

        const customerData = customers.map(c => [
          c.name || '-',
          c.phone || '-',
          `₹${c.totalPurchase || 0}`
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Name', 'Phone', 'Total Purchase']],
          body: customerData,
          theme: 'grid',
          headStyles: { fillColor: [37, 99, 235], textColor: 255 },
          margin: { left: 14 }
        });
      }

      doc.save(`invoice_data_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Error generating PDF. Please check console for details.');
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-blue-900 flex items-center">
            <DownloadIcon className="w-5 h-5 mr-2" />
            Download Extracted Data
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Export your data in multiple formats
          </p>
        </div>
        <div className="text-sm text-gray-500">
          {invoices.length} invoice(s), {products.length} product(s), {customers.length} customer(s)
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={downloadExcel}
          className="flex items-center px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-semibold shadow-md hover:from-green-700 hover:to-green-800 hover:shadow-lg transition-all"
        >
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Excel (.xlsx)
        </button>

        <button
          onClick={downloadCSV}
          className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold shadow-md hover:from-blue-700 hover:to-blue-800 hover:shadow-lg transition-all"
        >
          <File className="w-4 h-4 mr-2" />
          CSV (.csv)
        </button>

        <button
          onClick={downloadPDF}
          className="flex items-center px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-semibold shadow-md hover:from-red-700 hover:to-red-800 hover:shadow-lg transition-all"
        >
          <FileText className="w-4 h-4 mr-2" />
          PDF (.pdf)
        </button>
      </div>
    </div>
  );
}
