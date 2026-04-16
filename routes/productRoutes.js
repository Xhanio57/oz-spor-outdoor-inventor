const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

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
