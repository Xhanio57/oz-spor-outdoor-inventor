const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const PDFDocument = require('pdfkit');

router.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Ürünler yüklenemedi: ' + error.message });
  }
});

router.post('/api/products', async (req, res) => {
  try {
    const { name, price, category, barcode, image, description } = req.body;

    if (!name || !price || !category) {
      return res.status(400).json({
        success: false,
        message: 'Ürün adı, fiyat ve kategori zorunludur'
      });
    }

    const newProduct = new Product({
      name,
      price: parseFloat(price),
      category,
      barcode: barcode && barcode.trim() ? barcode.trim() : undefined,
      image: image || undefined,
      description: description || ''
    });

    await newProduct.save();

    res.status(201).json({
      success: true,
      message: `Ürün "${name}" başarıyla eklendi. Barkod: ${newProduct.barcode}`,
      product: newProduct
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Bu barkod numarası zaten kullanılıyor'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Ürün eklenirken hata oluştu: ' + error.message
    });
  }
});

router.put('/api/products/:id', async (req, res) => {
  try {
    const { name, price, category, image, description, discountType, discountValue, discountLabel, labelText } = req.body;
    
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { name, price, category, image, description, discountType, discountValue, discountLabel, labelText },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Ürün bulunamadı' });
    }

    res.json({
      success: true,
      message: 'Ürün başarıyla güncellendi',
      product
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Güncelleme hatası: ' + error.message });
  }
});

router.patch('/api/products/:id/size-stock', async (req, res) => {
  try {
    const { size, quantity } = req.body;

    if (!size || quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Beden ve miktar zorunludur'
      });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Ürün bulunamadı' });
    }

    const sizeItem = product.sizeStock.find(s => s.size === size);

    if (!sizeItem) {
      return res.status(404).json({ success: false, message: 'Beden bulunamadı' });
    }

    sizeItem.stock += parseInt(quantity);

    if (sizeItem.stock < 0) {
      sizeItem.stock = 0;
    }

    await product.save();

    res.json({
      success: true,
      message: `${size} bedeninin stoku güncellendi: ${sizeItem.stock}`,
      product
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Stok güncelleme hatası: ' + error.message });
  }
});

router.delete('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Ürün bulunamadı' });
    }

    res.json({
      success: true,
      message: `Ürün "${product.name}" başarıyla silindi`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Silme hatası: ' + error.message });
  }
});

// PDF İndir - Tüm Ürünleri
router.get('/api/products/export/pdf/:includeStock', async (req, res) => {
  try {
    const products = await Product.find().sort({ name: 1 });
    const includeStock = req.params.includeStock === 'true';

    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 20, 
      layout: 'landscape',
      bufferPages: true
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="urunler.pdf"');
    doc.pipe(res);

    doc.fontSize(16).font('Helvetica-Bold').text('Oz Spor & Outdoor - Stok Envanteri', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Tarih: ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR')}`, { align: 'center' });
    doc.moveDown(0.5);

    const pageWidth = doc.page.width - 40;
    const colWidths = {
      sn: 25,
      ad: 120,
      kategori: 80,
      barkod: 70,
      fiyat: 50,
      toplam: 50,
      ciro: 60,
      bedenleri: pageWidth - 25 - 120 - 80 - 70 - 50 - 50 - 60
    };

    const headerY = doc.y;
    const headerColor = '#2563eb';
    
    doc.fillColor(headerColor).rect(20, headerY, pageWidth, 20).fill();
    doc.fillColor('white').font('Helvetica-Bold').fontSize(9);

    let x = 20;
    doc.text('S.N', x, headerY + 5, { width: colWidths.sn });
    x += colWidths.sn;
    doc.text('Urun Adi', x, headerY + 5, { width: colWidths.ad });
    x += colWidths.ad;
    doc.text('Kategori', x, headerY + 5, { width: colWidths.kategori });
    x += colWidths.kategori;
    doc.text('Barkod', x, headerY + 5, { width: colWidths.barkod });
    x += colWidths.barkod;
    doc.text('Birim Fiyat', x, headerY + 5, { width: colWidths.fiyat });
    x += colWidths.fiyat;
    doc.text('Toplam Stok', x, headerY + 5, { width: colWidths.toplam });
    x += colWidths.toplam;
    doc.text('Potansiyel Ciro', x, headerY + 5, { width: colWidths.ciro });
    x += colWidths.ciro;
    doc.text('Beden Detaylari', x, headerY + 5, { width: colWidths.bedenleri });

    let rowY = headerY + 25;
    let sn = 1;
    let totalStock = 0;
    let totalRevenue = 0;

    doc.fillColor('black').font('Helvetica').fontSize(8);

    products.forEach(p => {
      const prodTotalStock = p.sizeStock.reduce((a, b) => a + b.stock, 0);
      const prodRevenue = p.price * prodTotalStock;
      
      totalStock += prodTotalStock;
      totalRevenue += prodRevenue;

      const sizeDetails = p.sizeStock.map(s => `${s.size}(${s.stock})`).join(', ');

      let lineCount = 1;
      const nameLines = doc.heightOfString(p.name, { width: colWidths.ad });
      const sizeLines = doc.heightOfString(sizeDetails, { width: colWidths.bedenleri });
      lineCount = Math.max(Math.ceil(nameLines / 10), Math.ceil(sizeLines / 10), 1);
      const rowHeight = lineCount * 12 + 4;

      if (rowY + rowHeight > doc.page.height - 40) {
        doc.addPage({ layout: 'landscape' });
        rowY = 20;
      }

      if (sn % 2 === 0) {
        doc.fillColor('#f3f4f6').rect(20, rowY, pageWidth, rowHeight).fill();
      }

      doc.fillColor('black');

      x = 20;
      doc.text(sn, x, rowY + 2, { width: colWidths.sn, align: 'center' });
      x += colWidths.sn;
      doc.text(p.name, x, rowY + 2, { width: colWidths.ad });
      x += colWidths.ad;
      doc.text(p.category, x, rowY + 2, { width: colWidths.kategori });
      x += colWidths.kategori;
      doc.text(p.barcode, x, rowY + 2, { width: colWidths.barkod, align: 'center' });
      x += colWidths.barkod;
      doc.text(p.price.toFixed(2) + ' TL', x, rowY + 2, { width: colWidths.fiyat, align: 'right' });
      x += colWidths.fiyat;

      const stockColor = prodTotalStock === 0 ? '#dc2626' : prodTotalStock < 10 ? '#f59e0b' : '#10b981';
      doc.fillColor(stockColor).text(prodTotalStock, x, rowY + 2, { width: colWidths.toplam, align: 'center' });
      doc.fillColor('black');
      x += colWidths.toplam;

      doc.text(prodRevenue.toFixed(2) + ' TL', x, rowY + 2, { width: colWidths.ciro, align: 'right' });
      x += colWidths.ciro;
      doc.text(sizeDetails, x, rowY + 2, { width: colWidths.bedenleri, fontSize: 7 });

      doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(20, rowY + rowHeight).lineTo(doc.page.width - 20, rowY + rowHeight).stroke();

      rowY += rowHeight;
      sn++;
    });

    doc.moveDown(1);
    doc.fillColor('#f3f4f6').rect(20, doc.y, pageWidth, 80).fill();
    doc.fillColor('black').font('Helvetica-Bold').fontSize(11);

    const summaryY = doc.y + 10;
    doc.text('OZET', 30, summaryY);

    doc.font('Helvetica').fontSize(10);
    const summaryStartY = summaryY + 20;
    doc.text(`Toplam Urun: ${products.length}`, 30, summaryStartY);
    doc.text(`Toplam Kategori: ${new Set(products.map(p => p.category)).size}`, 250, summaryStartY);
    doc.text(`Toplam Stok: ${totalStock} adet`, 30, summaryStartY + 20);
    doc.text(`Toplam Potansiyel Ciro: ${totalRevenue.toFixed(2)} TL`, 250, summaryStartY + 20);

    doc.end();
  } catch (error) {
    res.status(500).json({ success: false, message: 'PDF olusturma hatasi: ' + error.message });
  }
});

// Etiket PDF
router.get('/api/products/:id/label-pdf', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    const oldPrice = req.query.oldPrice ? parseFloat(req.query.oldPrice) : null;
    const labelNote = req.query.labelNote || '';
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Urun bulunamadi' });
    }

    // Final fiyatı hesapla
    let finalPrice = product.price;
    let discountInfo = '';

    if (product.discountType === 'percentage' && product.discountValue > 0) {
      finalPrice = product.price * (1 - product.discountValue / 100);
      discountInfo = `${product.price.toFixed(2)} TL → ${finalPrice.toFixed(2)} TL (-%${product.discountValue})`;
    } else if (product.discountType === 'fixed' && product.discountValue > 0) {
      finalPrice = Math.max(0, product.price - product.discountValue);
      discountInfo = `${product.price.toFixed(2)} TL → ${finalPrice.toFixed(2)} TL (-${product.discountValue.toFixed(2)} TL)`;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <title>${product.name} - Etiket</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            background: #f5f5f5; 
            padding: 5mm;
            margin: 0;
          }
          .labels-container {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 5mm;
            padding: 5mm;
          }
          .label {
            width: 40mm;
            height: 60mm;
            background: white;
            border: 2px solid #000;
            padding: 2.5mm;
            display: flex;
            flex-direction: column;
            gap: 1.5mm;
            box-sizing: border-box;
            page-break-inside: avoid;
          }
          .label-image {
            width: 100%;
            height: 15mm;
            object-fit: cover;
            border: 0.5px solid #ddd;
            border-radius: 2px;
          }
          .label-name {
            font-size: 9px;
            font-weight: bold;
            color: #333;
            line-height: 1.1;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }
          .label-category {
            font-size: 7px;
            color: #666;
          }
          .price-section {
            border-top: 0.5px solid #ddd;
            border-bottom: 0.5px solid #ddd;
            padding: 1.5mm 0;
          }
          .price-original {
            font-size: 11px;
            color: #999;
            text-decoration: line-through;
          }
          .price-final {
            font-size: 12px;
            font-weight: bold;
            color: #2563eb;
          }
          .discount-info {
            font-size: 6px;
            color: #dc2626;
            text-align: center;
            margin-top: 1mm;
          }
          .label-barcode-img {
            width: 100%;
            height: 10mm;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .label-barcode-img svg {
            width: 100%;
            height: 100%;
          }
          .label-barcode-text {
            font-size: 6px;
            text-align: center;
            font-family: 'Courier New', monospace;
            color: #333;
            font-weight: bold;
          }
          .label-special-text {
            font-size: 8px;
            color: #10b981;
            font-weight: bold;
            text-align: center;
            border-top: 0.5px solid #10b981;
            padding-top: 1mm;
          }
          .label-note {
            font-size: 8px;
            color: #dc2626;
            text-align: center;
            border-top: 0.5px solid #ddd;
            padding-top: 1mm;
            flex-grow: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            line-height: 1.2;
          }
          @media print {
            body { background: white; padding: 0; margin: 0; }
            .labels-container { gap: 0; padding: 0; }
            .label { border: 2px solid #000; }
          }
        </style>
      </head>
      <body>
        <div class="labels-container" id="labels"></div>
        <script>
          const product = {
            name: '${product.name.replace(/'/g, "\\'")}',
            category: '${product.category.replace(/'/g, "\\'")}',
            price: ${product.price},
            finalPrice: ${finalPrice},
            discountInfo: '${discountInfo.replace(/'/g, "\\'")}',
            barcode: '${product.barcode}',
            image: '${product.image}',
            labelText: '${product.labelText ? product.labelText.replace(/'/g, "\\'") : ''}',
            oldPrice: ${oldPrice || 'null'},
            labelNote: '${labelNote.replace(/'/g, "\\'")}'
          };

          function createLabel(index) {
            const label = document.createElement('div');
            label.className = 'label';
            
            let priceHtml = '';
            if (product.oldPrice) {
              priceHtml = \`
                <div class="price-section">
                  <div class="price-original">\${product.oldPrice.toFixed(2)} TL</div>
                  <div class="price-final">\${product.price.toFixed(2)} TL</div>
                </div>
              \`;
            } else if (product.discountInfo) {
              priceHtml = \`
                <div class="price-section">
                  <div class="price-original">\${product.price.toFixed(2)} TL</div>
                  <div class="price-final">\${product.finalPrice.toFixed(2)} TL</div>
                  <div class="discount-info">\${product.discountInfo}</div>
                </div>
              \`;
            } else {
              priceHtml = \`<div class="price-section"><div class="price-final">\${product.price.toFixed(2)} TL</div></div>\`;
            }

            let specialText = '';
            if (product.labelText) {
              specialText = \`<div class="label-special-text">\${product.labelText}</div>\`;
            }

            let noteHtml = '';
            if (product.labelNote) {
              noteHtml = \`<div class="label-note">\${product.labelNote}</div>\`;
            } else {
              noteHtml = '<div class="label-note"></div>';
            }

            label.innerHTML = \`
              <img src="\${product.image}" alt="\${product.name}" class="label-image" onerror="this.src='/images/default-product.svg'">
              <div class="label-name">\${product.name}</div>
              <div class="label-category">\${product.category}</div>
              \${priceHtml}
              <div class="label-barcode-img">
                <svg id="barcode-\${index}"></svg>
              </div>
              <div class="label-barcode-text">\${product.barcode}</div>
              \${specialText}
              \${noteHtml}
            \`;
            return label;
          }

          const container = document.getElementById('labels');
          
          for (let i = 0; i < 20; i++) {
            const label = createLabel(i);
            container.appendChild(label);
            
            if ((i + 1) % 20 === 0 && i < 99) {
              const pageBreak = document.createElement('div');
              pageBreak.style.pageBreakAfter = 'always';
              container.appendChild(pageBreak);
            }
          }

          for (let i = 0; i < 20; i++) {
            try {
              JsBarcode('#barcode-' + i, product.barcode, {
                format: 'CODE128',
                width: 1.2,
                height: 24,
                displayValue: false,
                margin: 0
              });
            } catch(e) {
              console.error('Barkod hatasi:', e);
            }
          }

          window.onload = function() {
            setTimeout(() => window.print(), 500);
          };
        </script>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Etiket olusturma hatasi: ' + error.message });
  }
});

module.exports = router;
