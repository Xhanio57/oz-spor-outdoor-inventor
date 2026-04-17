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
    const { name, price, category, image, description } = req.body;
    
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { name, price, category, image, description },
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

// PDF İndir - Tüm Ürünleri (A4 Landscape - Excel Stilinde)
router.get('/api/products/export/pdf/:includeStock', async (req, res) => {
  try {
    const products = await Product.find().sort({ name: 1 });
    const includeStock = req.params.includeStock === 'true';

    const doc = new PDFDocument({ size: 'A4', margin: 20, layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="urunler.pdf"');
    doc.pipe(res);

    // Başlık
    doc.fontSize(16).font('Helvetica-Bold').text('Öz Spor & Outdoor - Stok Envanteri', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Tarih: ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR')}`, { align: 'center' });
    doc.moveDown(0.5);

    // Tablo başlığı yapısı
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

    // Tablo başlığı
    const headerY = doc.y;
    const headerColor = '#2563eb';
    
    doc.fillColor(headerColor).rect(20, headerY, pageWidth, 20).fill();
    doc.fillColor('white').font('Helvetica-Bold').fontSize(9);

    let x = 20;
    doc.text('S.N', x, headerY + 5, { width: colWidths.sn });
    x += colWidths.sn;
    doc.text('Ürün Adı', x, headerY + 5, { width: colWidths.ad });
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
    doc.text('Beden Detayları', x, headerY + 5, { width: colWidths.bedenleri });

    let rowY = headerY + 25;
    let sn = 1;
    let totalStock = 0;
    let totalRevenue = 0;

    doc.fillColor('black').font('Helvetica').fontSize(8);

    // Satırları yazma
    products.forEach(p => {
      const prodTotalStock = p.sizeStock.reduce((a, b) => a + b.stock, 0);
      const prodRevenue = p.price * prodTotalStock;
      
      totalStock += prodTotalStock;
      totalRevenue += prodRevenue;

      // Beden detayları
      const sizeDetails = p.sizeStock.map(s => `${s.size}(${s.stock})`).join(', ');

      // Satır yüksekliği kontrol
      let lineCount = 1;
      const nameLines = doc.heightOfString(p.name, { width: colWidths.ad });
      const sizeLines = doc.heightOfString(sizeDetails, { width: colWidths.bedenleri });
      lineCount = Math.max(Math.ceil(nameLines / 10), Math.ceil(sizeLines / 10), 1);
      const rowHeight = lineCount * 12 + 4;

      // Sayfa kontrol
      if (rowY + rowHeight > doc.page.height - 40) {
        doc.addPage({ layout: 'landscape' });
        rowY = 20;
      }

      // Satır arkaplanı
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
      doc.text(p.price.toFixed(2) + ' ₺', x, rowY + 2, { width: colWidths.fiyat, align: 'right' });
      x += colWidths.fiyat;

      const stockColor = prodTotalStock === 0 ? '#dc2626' : prodTotalStock < 10 ? '#f59e0b' : '#10b981';
      doc.fillColor(stockColor).text(prodTotalStock, x, rowY + 2, { width: colWidths.toplam, align: 'center' });
      doc.fillColor('black');
      x += colWidths.toplam;

      doc.text(prodRevenue.toFixed(2) + ' ₺', x, rowY + 2, { width: colWidths.ciro, align: 'right' });
      x += colWidths.ciro;
      doc.text(sizeDetails, x, rowY + 2, { width: colWidths.bedenleri, fontSize: 7 });

      // Satır sınırı
      doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(20, rowY + rowHeight).lineTo(doc.page.width - 20, rowY + rowHeight).stroke();

      rowY += rowHeight;
      sn++;
    });

    // Özet bölümü
    doc.moveDown(1);
    doc.fillColor('#f3f4f6').rect(20, doc.y, pageWidth, 80).fill();
    doc.fillColor('black').font('Helvetica-Bold').fontSize(11);

    const summaryY = doc.y + 10;
    doc.text('ÖZET', 30, summaryY);

    doc.font('Helvetica').fontSize(10);
    const summaryStartY = summaryY + 20;
    doc.text(`Toplam Ürün: ${products.length}`, 30, summaryStartY);
    doc.text(`Toplam Kategori: ${new Set(products.map(p => p.category)).size}`, 250, summaryStartY);
    doc.text(`Toplam Stok: ${totalStock} adet`, 30, summaryStartY + 20);
    doc.text(`Toplam Potansiyel Ciro: ${totalRevenue.toFixed(2)} ₺`, 250, summaryStartY + 20);

    doc.end();
  } catch (error) {
    res.status(500).json({ success: false, message: 'PDF oluşturma hatası: ' + error.message });
  }
});

router.get('/api/products/:id/label-pdf', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Ürün bulunamadı' });
    }

    const html = `
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <title>${product.name} - Etiket</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
          .label {
            width: 80mm;
            height: 120mm;
            background: white;
            padding: 10mm;
            margin: 0 auto;
            border: 1px solid #ddd;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            page-break-after: always;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .label-image {
            width: 100%;
            height: 50mm;
            object-fit: cover;
            border: 1px solid #ddd;
            border-radius: 4px;
          }
          .label-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 5px;
          }
          .label-name {
            font-size: 14px;
            font-weight: bold;
            color: #333;
            line-height: 1.2;
          }
          .label-category {
            font-size: 11px;
            color: #666;
          }
          .label-price {
            font-size: 16px;
            font-weight: bold;
            color: #2563eb;
          }
          .label-barcode-img {
            width: 100%;
            height: 50px;
            object-fit: contain;
            margin: 5px 0;
          }
          .label-barcode-text {
            font-size: 10px;
            text-align: center;
            font-family: 'Courier New', monospace;
            color: #333;
          }
          @media print {
            body { background: white; padding: 0; }
            .label { margin: 0; }
          }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
      </head>
      <body>
        <div class="label">
          <img src="${product.image}" alt="${product.name}" class="label-image" onerror="this.src='/images/default-product.svg'">
          <div class="label-info">
            <div class="label-name">${product.name}</div>
            <div class="label-category">${product.category}</div>
            <div class="label-price">${product.price.toFixed(2)} ₺</div>
            <svg id="barcode"></svg>
            <div class="label-barcode-text">${product.barcode}</div>
          </div>
        </div>

        <script>
          JsBarcode("#barcode", "${product.barcode}", {
            format: "CODE128",
            width: 1.5,
            height: 50,
            displayValue: false
          });
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Etiket oluşturma hatası: ' + error.message });
  }
});

module.exports = router;
