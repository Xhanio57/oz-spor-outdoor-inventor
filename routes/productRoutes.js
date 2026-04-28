const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Product = require('../models/Product');

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Tüm ürünleri listele
router.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Ürünler yüklenemedi: ' + error.message });
  }
});

// Stok raporu PDF (must be before /:id routes to avoid route conflict)
router.get('/api/products/report-pdf', async (req, res) => {
  try {
    const products = await Product.find().sort({ category: 1, name: 1 });

    const rows = products.map((p, idx) => {
      const totalStock = p.sizeStock.reduce((sum, s) => sum + s.stock, 0);
      const sizeDetails = p.sizeStock.map(s => {
        const label = p.category === 'Çocuk Giyim' ? `${s.size} Yaş` : s.size;
        return `${label}(${s.stock})`;
      }).join(', ');
      const bgColor = idx % 2 === 0 ? '#ffffff' : '#f3f4f6';

      return `
        <tr style="background-color: ${bgColor};">
          <td style="padding:8px;text-align:center;">${idx + 1}</td>
          <td style="padding:8px;">${p.name}</td>
          <td style="padding:8px;">${p.category}</td>
          <td style="padding:8px;text-align:center;font-family:monospace;">${p.barcode}</td>
          <td style="padding:8px;text-align:right;">${p.price.toFixed(2)} TL</td>
          <td style="padding:8px;text-align:center;color:${totalStock === 0 ? '#dc2626' : totalStock < 10 ? '#f59e0b' : '#10b981'};font-weight:bold;">${totalStock}</td>
          <td style="padding:8px;font-size:12px;">${sizeDetails}</td>
        </tr>
      `;
    }).join('');

    const totalStockAll = products.reduce((sum, p) => sum + p.sizeStock.reduce((s, i) => s + i.stock, 0), 0);
    const totalValueAll = products.reduce((sum, p) => {
      const stock = p.sizeStock.reduce((s, i) => s + i.stock, 0);
      return sum + p.price * stock;
    }, 0);

    const html = `
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <title>Stok Raporu</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 13px; color: #333; }
          h1 { color: #2563eb; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #2563eb; color: white; padding: 10px 8px; text-align: left; }
          td { border-bottom: 1px solid #e5e7eb; }
          tfoot tr { background: #eff6ff; font-weight: bold; }
          tfoot td { border-top: 2px solid #2563eb; padding: 10px 8px; }
          @media print { body { margin: 20px; } }
        </style>
      </head>
      <body>
        <h1>📦 Stok Raporu</h1>
        <p>Tarih: ${new Date().toLocaleDateString('tr-TR')} | Toplam Ürün: ${products.length} | Toplam Stok: ${totalStockAll} adet | Stok Değeri: ${totalValueAll.toFixed(2)} TL</p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Ürün Adı</th>
              <th>Kategori</th>
              <th>Barkod</th>
              <th>Fiyat</th>
              <th>Toplam Stok</th>
              <th>Beden Stokları</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr>
              <td colspan="4" style="text-align:right;">GENEL TOPLAM</td>
              <td style="text-align:right;">${totalValueAll.toFixed(2)} TL</td>
              <td style="text-align:center;">${totalStockAll} adet</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Rapor oluşturma hatası: ' + error.message });
  }
});

// Toplu Etiket PDF - tüm ürünler için
router.get('/api/products/bulk-labels-pdf', async (req, res) => {
  try {
    const products = await Product.find().sort({ category: 1, name: 1 });

    let allLabelDivs = '';
    let barcodeScripts = '';
    let labelIndex = 0;

    for (const product of products) {
      const isAge = product.category === 'Çocuk Giyim';
      const safeName = product.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeBarcode = product.barcode.replace(/'/g, "\\'").replace(/\\/g, '\\\\');

      for (const s of product.sizeStock) {
        const count = Math.max(s.stock, 1);
        const sizeDisplay = isAge ? `${s.size} Yaş` : s.size;

        for (let i = 0; i < count; i++) {
          const slotId = `barcode-slot-${labelIndex}`;
          const templateId = `barcode-tmpl-${labelIndex}`;
          allLabelDivs += `
            <div class="label">
              <img src="${product.image}" alt="${safeName}" class="label-image" onerror="this.src='/images/default-product.svg'">
              <div class="label-info">
                <div class="label-name">${safeName}</div>
                <div class="label-category">${product.category}</div>
                ${sizeDisplay ? `<div class="label-size">${sizeDisplay}</div>` : ''}
                <div class="label-price">${product.price.toFixed(2)} ₺</div>
                <svg id="${slotId}" style="width:100%;height:40px;"></svg>
                <div class="label-barcode-text">${product.barcode}</div>
              </div>
            </div>
          `;
          barcodeScripts += `
            JsBarcode(document.getElementById('${slotId}'), '${safeBarcode}', {
              format: 'CODE128', width: 1.5, height: 38, displayValue: false
            });
          `;
          labelIndex++;
        }
      }
    }

    const html = `
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <title>Toplu Ürün Etiketleri</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
          .label {
            width: 80mm;
            background: white;
            padding: 8mm;
            margin: 0 auto 10px;
            border: 1px solid #ddd;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            page-break-after: always;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .label-image {
            width: 100%;
            height: 40mm;
            object-fit: cover;
            border: 1px solid #ddd;
            border-radius: 4px;
          }
          .label-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .label-name {
            font-size: 13px;
            font-weight: bold;
            color: #333;
            line-height: 1.2;
          }
          .label-category {
            font-size: 10px;
            color: #666;
          }
          .label-size {
            font-size: 17px;
            font-weight: bold;
            color: #fff;
            background: #2563eb;
            padding: 3px 10px;
            border-radius: 4px;
            display: inline-block;
            align-self: flex-start;
          }
          .label-price {
            font-size: 15px;
            font-weight: bold;
            color: #2563eb;
          }
          .label-barcode-text {
            font-size: 9px;
            text-align: center;
            font-family: 'Courier New', monospace;
            color: #333;
          }
          @media print {
            body { background: white; padding: 0; }
            .label { margin: 0; box-shadow: none; border: none; }
          }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
      </head>
      <body>
        ${allLabelDivs}
        <script>
          window.onload = function() {
            ${barcodeScripts}
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Toplu etiket oluşturma hatası: ' + error.message });
  }
});

// PDF Etiket İndir (beden başına stok adeti kadar etiket)
router.get('/api/products/:id/label-pdf', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Geçersiz ürün ID' });
    }
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Ürün bulunamadı' });
    }

    const isAge = product.category === 'Çocuk Giyim';

    // Her beden için stok adeti kadar etiket oluştur
    const labelEntries = [];
    for (const s of product.sizeStock) {
      const sizeDisplay = isAge ? `${s.size} Yaş` : s.size;
      const count = Math.max(s.stock, 1); // Stok 0 olsa bile önizleme için 1 etiket
      for (let i = 0; i < count; i++) {
        labelEntries.push({ size: s.size, sizeDisplay });
      }
    }
    if (labelEntries.length === 0) {
      labelEntries.push({ size: '', sizeDisplay: '' });
    }

    const safeBarcode = product.barcode.replace(/'/g, "\\'");
    const safeName = product.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const labelDivs = labelEntries.map((entry, i) => `
      <div class="label" ${i === labelEntries.length - 1 ? 'style="page-break-after:auto;"' : ''}>
        <img src="${product.image}" alt="${safeName}" class="label-image" onerror="this.src='/images/default-product.svg'">
        <div class="label-info">
          <div class="label-name">${safeName}</div>
          <div class="label-category">${product.category}</div>
          ${entry.sizeDisplay ? `<div class="label-size">${entry.sizeDisplay}</div>` : ''}
          <div class="label-price">${product.price.toFixed(2)} ₺</div>
          <svg class="barcode-slot" style="width:100%;height:40px;"></svg>
          <div class="label-barcode-text">${product.barcode}</div>
        </div>
      </div>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <title>${safeName} - Etiketler</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
          .label {
            width: 80mm;
            background: white;
            padding: 8mm;
            margin: 0 auto 10px;
            border: 1px solid #ddd;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            page-break-after: always;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .label-image {
            width: 100%;
            height: 40mm;
            object-fit: cover;
            border: 1px solid #ddd;
            border-radius: 4px;
          }
          .label-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .label-name {
            font-size: 13px;
            font-weight: bold;
            color: #333;
            line-height: 1.2;
          }
          .label-category {
            font-size: 10px;
            color: #666;
          }
          .label-size {
            font-size: 17px;
            font-weight: bold;
            color: #fff;
            background: #2563eb;
            padding: 3px 10px;
            border-radius: 4px;
            display: inline-block;
            align-self: flex-start;
          }
          .label-price {
            font-size: 15px;
            font-weight: bold;
            color: #2563eb;
          }
          .label-barcode-text {
            font-size: 9px;
            text-align: center;
            font-family: 'Courier New', monospace;
            color: #333;
          }
          @media print {
            body { background: white; padding: 0; }
            .label { margin: 0; box-shadow: none; border: none; }
          }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
      </head>
      <body>
        <svg id="barcode-template" style="display:none;"></svg>
        ${labelDivs}
        <script>
          window.onload = function() {
            var template = document.getElementById('barcode-template');
            JsBarcode(template, '${safeBarcode}', {
              format: 'CODE128',
              width: 1.5,
              height: 38,
              displayValue: false
            });
            var slots = document.querySelectorAll('.barcode-slot');
            slots.forEach(function(slot) {
              var clone = template.cloneNode(true);
              clone.removeAttribute('id');
              clone.style.display = '';
              clone.style.width = '100%';
              clone.style.height = '40px';
              slot.parentNode.replaceChild(clone, slot);
            });
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

// Yeni ürün ekle
router.post('/api/products', async (req, res) => {
  try {
    const { name, price, category, barcode, image, description, customSizes } = req.body;

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

    // Özel beden listesi gönderildiyse (örn. Çocuk Giyim için seçilen yaşlar)
    if (customSizes && Array.isArray(customSizes) && customSizes.length > 0) {
      newProduct.sizeStock = customSizes.map(size => ({ size, stock: 0 }));
    }

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

// Ürün güncelle
router.put('/api/products/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Geçersiz ürün ID' });
    }
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

// Beden bazlı stok güncelle
router.patch('/api/products/:id/size-stock', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Geçersiz ürün ID' });
    }
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

    const qty = parseInt(quantity);

    // Negatif stok kontrolü
    if (qty < 0 && Math.abs(qty) > sizeItem.stock) {
      return res.status(400).json({
        success: false,
        message: `Negatif stok yapılamaz. Mevcut stok: ${sizeItem.stock}`
      });
    }

    sizeItem.stock += qty;

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

// Çoklu beden stok güncelle
router.patch('/api/products/:id/bulk-size-stock', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Geçersiz ürün ID' });
    }
    const { sizes, quantity } = req.body;

    if (!Array.isArray(sizes) || sizes.length === 0 || quantity === undefined) {
      return res.status(400).json({ success: false, message: 'Beden listesi ve miktar zorunludur' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Ürün bulunamadı' });
    }

    const qty = parseInt(quantity);
    const errors = [];

    for (const size of sizes) {
      const sizeItem = product.sizeStock.find(s => s.size === size);
      if (!sizeItem) {
        errors.push(`"${size}" bedeni bulunamadı`);
        continue;
      }
      if (qty < 0 && Math.abs(qty) > sizeItem.stock) {
        errors.push(`${size}: negatif stok yapılamaz (mevcut: ${sizeItem.stock})`);
        continue;
      }
      sizeItem.stock = Math.max(0, sizeItem.stock + qty);
    }

    if (errors.length === sizes.length) {
      return res.status(400).json({ success: false, message: errors.join(' | ') });
    }

    await product.save();

    const successCount = sizes.length - errors.length;
    const sign = qty > 0 ? `+${qty}` : String(qty);
    const msg = errors.length > 0
      ? `${successCount} beden güncellendi. Hata: ${errors.join(' | ')}`
      : `${successCount} beden ${sign} stok ile güncellendi`;

    res.json({ success: true, message: msg, product });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Toplu stok güncelleme hatası: ' + error.message });
  }
});

// Ürün sil
router.delete('/api/products/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Geçersiz ürün ID' });
    }
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

module.exports = router;
