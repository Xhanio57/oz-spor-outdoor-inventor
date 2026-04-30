const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Product = require('../models/Product');

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Returns size label without duplicating "Yaş" suffix
function getSizeDisplay(category, size) {
  if (category === 'Çocuk Giyim') {
    return size.endsWith(' Yaş') ? size : `${size} Yaş`;
  }
  return size;
}

// Shared label HTML builder — same template for both single and bulk labels.
// labels: [{ name, category, description, sizeDisplay, price, barcode }]
function buildLabelsHtml(labels, title) {
  const LABELS_PER_PAGE = 20;
  const pages = [];
  for (let i = 0; i < labels.length; i += LABELS_PER_PAGE) {
    pages.push(labels.slice(i, i + LABELS_PER_PAGE));
  }

  let barcodeScript = '';
  let labelIndex = 0;

  const pageHtml = pages.map((pageLbls, pi) => {
    const isLast = pi === pages.length - 1;
    const labelDivs = pageLbls.map((lbl) => {
      const bcId = `bc-${labelIndex++}`;
      const safeBarcode = lbl.barcode.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      barcodeScript += `try{JsBarcode(document.getElementById('${bcId}'),'${safeBarcode}',{format:'CODE128',width:0.9,height:22,displayValue:false,margin:0});}catch(e){}\n`;

      const metaParts = [lbl.category];
      if (lbl.description) metaParts.push(lbl.description);

      return `
        <div class="label">
          <div class="lbl-header">
            <img src="/images/default-product.png" alt="Logo" class="lbl-logo" onerror="this.style.display='none'">
            <span class="lbl-price">${lbl.price.toFixed(2)}&nbsp;₺</span>
          </div>
          <div class="lbl-name">${lbl.name}</div>
          <div class="lbl-meta">${metaParts.join(' · ')}</div>
          <div class="lbl-size-row">${lbl.sizeDisplay ? `<span class="lbl-size">${lbl.sizeDisplay}</span>` : ''}</div>
          <svg id="${bcId}" class="lbl-barcode"></svg>
          <div class="lbl-barcode-num">${lbl.barcode}</div>
        </div>`;
    }).join('');
    return `<div class="label-page${isLast ? ' last' : ''}">${labelDivs}</div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

    /* A4 printable area with 8mm margins: ~194mm × 281mm → 5 cols × 4 rows = 20 labels */
    .label-page {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      grid-template-rows: repeat(4, 1fr);
      gap: 1.5mm;
      width: 194mm;
      height: 281mm;
      page-break-after: always;
    }
    .label-page.last { page-break-after: auto; }

    /* Each label: ~37mm wide × 69mm tall */
    .label {
      border: 0.5pt solid #c8c8c8;
      padding: 1.5mm 1.5mm 1mm;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: white;
    }

    /* Header row: logo (left) + price (right) */
    .lbl-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 0.5pt solid #e0e0e0;
      padding-bottom: 1mm;
      margin-bottom: 1mm;
      flex-shrink: 0;
    }
    .lbl-logo {
      height: 5.5mm;
      max-width: 16mm;
      object-fit: contain;
    }
    .lbl-price {
      font-size: 11pt;
      font-weight: 800;
      color: #1d4ed8;
      white-space: nowrap;
      line-height: 1;
    }

    /* Product name — 2 lines max */
    .lbl-name {
      font-size: 8pt;
      font-weight: 700;
      color: #111;
      line-height: 1.25;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      flex-shrink: 0;
      margin-bottom: 0.6mm;
    }

    /* Category + description */
    .lbl-meta {
      font-size: 5pt;
      color: #777;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex-shrink: 0;
      margin-bottom: 0.5mm;
    }

    /* Size badge — fills remaining vertical space, centered */
    .lbl-size-row {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .lbl-size {
      font-size: 14pt;
      font-weight: 800;
      color: #fff;
      background: #2563eb;
      padding: 2pt 8pt;
      border-radius: 3pt;
      letter-spacing: 0.5pt;
      display: inline-block;
    }

    /* Barcode */
    .lbl-barcode {
      width: 100%;
      display: block;
      flex-shrink: 0;
    }
    .lbl-barcode-num {
      font-size: 4.5pt;
      text-align: center;
      font-family: 'Courier New', monospace;
      color: #555;
      letter-spacing: 0.5pt;
      flex-shrink: 0;
      margin-top: 0.3mm;
    }

    @media print {
      body { background: white; }
      .label { border: 0.5pt solid #bbb; }
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
</head>
<body>
  ${pageHtml}
  <script>
    window.onload = function() {
      ${barcodeScript}
      window.print();
    };
  </script>
</body>
</html>`;
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

// Toplu Etiket PDF - seçili ürünler, sayfa başına 20 etiket (4×5 grid)
router.get('/api/products/bulk-labels-pdf', async (req, res) => {
  try {
    const ids = req.query.ids ? req.query.ids.split(',').filter(Boolean) : [];
    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: 'En az bir ürün seçin' });
    }

    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
    const products = await Product.find({ _id: { $in: validIds } }).sort({ category: 1, name: 1 });

    const allLabels = [];
    for (const product of products) {
      const safeName = product.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeDesc = (product.description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      for (const s of product.sizeStock) {
        allLabels.push({
          name: safeName,
          category: product.category,
          description: safeDesc,
          sizeDisplay: getSizeDisplay(product.category, s.size),
          price: product.price,
          barcode: product.barcode
        });
      }
    }

    if (allLabels.length === 0) {
      return res.status(404).json({ success: false, message: 'Seçili ürünler bulunamadı' });
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(buildLabelsHtml(allLabels, 'Toplu Ürün Etiketleri'));
  } catch (error) {
    res.status(500).json({ success: false, message: 'Toplu etiket oluşturma hatası: ' + error.message });
  }
});

// PDF Etiket İndir (beden başına stok adeti kadar etiket, aynı 4×5 A4 şablonu)
router.get('/api/products/:id/label-pdf', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Geçersiz ürün ID' });
    }
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Ürün bulunamadı' });
    }

    const safeName = product.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeDesc = (product.description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const labelEntries = [];
    for (const s of product.sizeStock) {
      const sizeDisplay = getSizeDisplay(product.category, s.size);
      const count = Math.max(s.stock, 1); // at least 1 for preview
      for (let i = 0; i < count; i++) {
        labelEntries.push({
          name: safeName,
          category: product.category,
          description: safeDesc,
          sizeDisplay,
          price: product.price,
          barcode: product.barcode
        });
      }
    }
    if (labelEntries.length === 0) {
      labelEntries.push({ name: safeName, category: product.category, description: safeDesc, sizeDisplay: '', price: product.price, barcode: product.barcode });
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(buildLabelsHtml(labelEntries, `${safeName} - Etiketler`));
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
