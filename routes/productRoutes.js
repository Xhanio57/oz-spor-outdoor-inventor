const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const PDFDocument = require('pdfkit');
const htmlPdf = require('html-pdf');
const path = require('path');

const formatLabelSize = (category, size) => {
  if (!size) return '';
  if (category === 'Çocuk Giyim') return `${size} Yaş`;
  return size;
};

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

// PDF İndir - Tüm Ürünleri (HTML-PDF ile Türkçe Desteği)
router.get('/api/products/export/pdf/:includeStock', async (req, res) => {
  try {
    const products = await Product.find().sort({ name: 1 });
    const includeStock = req.params.includeStock === 'true';

    let totalStock = 0;
    let totalRevenue = 0;

    let tableRows = products.map((p, idx) => {
      const prodTotalStock = p.sizeStock.reduce((a, b) => a + b.stock, 0);
      const prodRevenue = p.price * prodTotalStock;
      
      totalStock += prodTotalStock;
      totalRevenue += prodRevenue;

      const sizeDetails = p.sizeStock.map(s => `${s.size}(${s.stock})`).join(', ');
      const bgColor = idx % 2 === 0 ? '#ffffff' : '#f3f4f6';

      return `
        <tr style="background-color: ${bgColor};">
          <td style="text-align: center;">${idx + 1}</td>
          <td>${p.name}</td>
          <td>${p.category}</td>
          <td style="text-align: center;">${p.barcode}</td>
          <td style="text-align: right;">${p.price.toFixed(2)} TL</td>
          <td style="text-align: center; color: ${prodTotalStock === 0 ? '#dc2626' : prodTotalStock < 10 ? '#f59e0b' : '#10b981'}; font-weight: bold;">${prodTotalStock}</td>
          <td style="text-align: right;">${prodRevenue.toFixed(2)} TL</td>
          <td>${sizeDetails}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <title>Stok Envanteri</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #333;
          }
          h1 {
            text-align: center;
            font-size: 24px;
            margin-bottom: 5px;
          }
          .subtitle {
            text-align: center;
            font-size: 12px;
            color: #666;
            margin-bottom: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          th {
            background-color: #2563eb;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: bold;
            font-size: 13px;
          }
          td {
            padding: 10px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 12px;
          }
          .summary {
            background-color: #f3f4f6;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
          }
          .summary h3 {
            margin-top: 0;
            font-size: 14px;
            color: #2563eb;
          }
          .summary-items {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
          }
          .summary-item {
            font-size: 13px;
          }
          .summary-item strong {
            color: #2563eb;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <h1>Öz Spor & Outdoor - Stok Envanteri</h1>
        <div class="subtitle">Tarih: ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR')}</div>
        
        <table>
          <thead>
            <tr>
              <th style="width: 5%;">S.N</th>
              <th style="width: 20%;">Ürün Adı</th>
              <th style="width: 12%;">Kategori</th>
              <th style="width: 10%;">Barkod</th>
              <th style="width: 10%;">Birim Fiyat</th>
              <th style="width: 10%;">Toplam Stok</th>
              <th style="width: 12%;">Potansiyel Ciro</th>
              <th style="width: 21%;">Beden Detayları</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="summary">
          <h3>ÖZET</h3>
          <div class="summary-items">
            <div class="summary-item">Toplam Ürün: <strong>${products.length}</strong></div>
            <div class="summary-item">Toplam Kategori: <strong>${new Set(products.map(p => p.category)).size}</strong></div>
            <div class="summary-item">Toplam Stok: <strong>${totalStock} adet</strong></div>
            <div class="summary-item">Toplam Potansiyel Ciro: <strong>${totalRevenue.toFixed(2)} TL</strong></div>
          </div>
        </div>
      </body>
      </html>
    `;

    const options = {
      format: 'A4',
      orientation: 'landscape',
      margin: '10mm'
    };

    htmlPdf.create(html, options).toStream((err, stream) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'PDF oluşturma hatası: ' + err.message });
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="urunler.pdf"');
      stream.pipe(res);
    });

  } catch (error) {
    console.error('PDF hatası:', error);
    res.status(500).json({ success: false, message: 'PDF oluşturma hatası: ' + error.message });
  }
});

// TOPLU ETİKET PDF
router.get('/api/products/bulk-labels-pdf', async (req, res) => {
  try {
    const { products: productsStr, oldPrice, labelNote, useStockQty } = req.query;

    if (!productsStr) {
      return res.status(400).json({ success: false, message: 'Ürün seçin' });
    }

    const productIds = JSON.parse(decodeURIComponent(productsStr));
    const parsedOldPrice = oldPrice && oldPrice !== '' ? parseFloat(oldPrice) : null;
    const useStock = useStockQty === 'true';

    // Seçili ürünleri getir
    const selectedProducts = await Product.find({ _id: { $in: productIds } });

    if (selectedProducts.length === 0) {
      return res.status(404).json({ success: false, message: 'Ürün bulunamadı' });
    }

    // Etiketleri oluştur
    let labels = [];
    selectedProducts.forEach(product => {
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

      if (useStock) {
        const sizeStocks = Array.isArray(product.sizeStock) ? product.sizeStock : [];
        sizeStocks.forEach(sizeItem => {
          const stockQty = Number(sizeItem.stock) || 0;
          if (stockQty <= 0) return;
          const formattedSize = formatLabelSize(product.category, sizeItem.size);

          for (let i = 0; i < stockQty; i++) {
            labels.push({
              name: product.name,
              category: product.category,
              size: formattedSize,
              price: product.price,
              finalPrice: finalPrice,
              discountInfo: discountInfo,
              barcode: product.barcode,
              image: product.image,
              labelText: product.labelText || '',
              oldPrice: parsedOldPrice,
              labelNote: labelNote || ''
            });
          }
        });
      } else {
        labels.push({
          name: product.name,
          category: product.category,
          size: '',
          price: product.price,
          finalPrice: finalPrice,
          discountInfo: discountInfo,
          barcode: product.barcode,
          image: product.image,
          labelText: product.labelText || '',
          oldPrice: parsedOldPrice,
          labelNote: labelNote || ''
        });
      }
    });

    // HTML oluştur
    let labelHtml = '';
    labels.forEach((label, idx) => {
      let priceHtml = '';
      if (label.oldPrice) {
        priceHtml = `
          <div class="price-section">
            <div class="price-original">
              ${label.oldPrice.toFixed(2)} TL
              <svg viewBox="0 0 100 2" preserveAspectRatio="none">
                <line x1="0" y1="1" x2="100" y2="1" stroke="black" stroke-width="1.5"/>
              </svg>
            </div>
            <div class="price-final">${label.price.toFixed(2)} TL</div>
          </div>
        `;
      } else if (label.discountInfo) {
        priceHtml = `
          <div class="price-section">
            <div class="price-original">
              ${label.price.toFixed(2)} TL
              <svg viewBox="0 0 100 2" preserveAspectRatio="none">
                <line x1="0" y1="1" x2="100" y2="1" stroke="black" stroke-width="1.5"/>
              </svg>
            </div>
            <div class="price-final">${label.finalPrice.toFixed(2)} TL</div>
            <div class="discount-info">${label.discountInfo}</div>
          </div>
        `;
      } else {
        priceHtml = `<div class="price-section"><div class="price-final">${label.price.toFixed(2)} TL</div></div>`;
      }

      let specialText = '';
      if (label.labelText) {
        specialText = `<div class="label-special-text">${label.labelText}</div>`;
      }

      let noteHtml = '';
      if (label.labelNote) {
        noteHtml = `<div class="label-note">${label.labelNote}</div>`;
      } else {
        noteHtml = '<div class="label-note"></div>';
      }

      let sizeHtml = '';
      if (label.size) {
        sizeHtml = `<div class="label-size">Beden: ${label.size}</div>`;
      }

      labelHtml += `
        <div class="label">
          <img src="${label.image}" alt="${label.name}" class="label-image" onerror="this.src='/images/default-product.svg'">
          <div class="label-name">${label.name}</div>
          <div class="label-category">${label.category}</div>
          ${sizeHtml}
          ${priceHtml}
          <div class="label-barcode-img">
            <svg id="barcode-${idx}"></svg>
          </div>
          <div class="label-barcode-text">${label.barcode}</div>
          ${specialText}
          ${noteHtml}
        </div>
      `;
    });

    const html = `
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <title>Toplu Etiketler</title>
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
            position: relative;
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
          .label-size {
            font-size: 7px;
            color: #111;
            font-weight: bold;
          }
          .price-section {
            border-top: 0.5px solid #ddd;
            border-bottom: 0.5px solid #ddd;
            padding: 1.5mm 0;
            position: relative;
          }
          .price-original {
            font-size: 7px;
            color: #999;
            text-decoration: line-through;
            position: relative;
          }
          .price-original svg {
            position: absolute;
            top: 50%;
            left: 0;
            transform: translateY(-50%);
            width: 100%;
            height: 2px;
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
        <div class="labels-container" id="labels">${labelHtml}</div>
        <script>
          const labels = ${JSON.stringify(labels)};
          
          for (let i = 0; i < labels.length; i++) {
            try {
              JsBarcode('#barcode-' + i, labels[i].barcode, {
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
    console.error('Toplu etiket hatası:', error);
    res.status(500).json({ success: false, message: 'Etiket oluşturma hatası: ' + error.message });
  }
});

// Tek etiket PDF
router.get('/api/products/:id/label-pdf', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    const oldPrice = req.query.oldPrice ? parseFloat(req.query.oldPrice) : null;
    const labelNote = req.query.labelNote || '';
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Ürün bulunamadı' });
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
            position: relative;
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
            position: relative;
          }
          .price-original {
            font-size: 7px;
            color: #999;
            text-decoration: line-through;
            position: relative;
          }
          .price-original svg {
            position: absolute;
            top: 50%;
            left: 0;
            transform: translateY(-50%);
            width: 100%;
            height: 2px;
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
                  <div class="price-original">
                    \${product.oldPrice.toFixed(2)} TL
                    <svg viewBox="0 0 100 2" preserveAspectRatio="none">
                      <line x1="0" y1="1" x2="100" y2="1" stroke="black" stroke-width="1.5"/>
                    </svg>
                  </div>
                  <div class="price-final">\${product.price.toFixed(2)} TL</div>
                </div>
              \`;
            } else if (product.discountInfo) {
              priceHtml = \`
                <div class="price-section">
                  <div class="price-original">
                    \${product.price.toFixed(2)} TL
                    <svg viewBox="0 0 100 2" preserveAspectRatio="none">
                      <line x1="0" y1="1" x2="100" y2="1" stroke="black" stroke-width="1.5"/>
                    </svg>
                  </div>
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
              console.error('Barkod hatası:', e);
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
    res.status(500).json({ success: false, message: 'Etiket oluşturma hatası: ' + error.message });
  }
});

module.exports = router;
