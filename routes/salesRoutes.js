const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const SalesHistory = require('../models/SalesHistory');

// POS Satış Endpoint - Beden ve Miktar ile
router.post('/api/satis', async (req, res) => {
  try {
    const { barcode, quantity, size, paymentMethod } = req.body;

    // Barkod validasyonu
    if (!barcode || barcode.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Hata: Barkod boş olamaz'
      });
    }

    // Miktar varsayılan 1
    const qty = parseInt(quantity) || 1;

    // Barkoda göre ürünü bul
    const product = await Product.findOne({ barcode: barcode.trim() });

    // Ürün bulunamadıysa
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Hata: Ürün bulunamadı'
      });
    }

    // Beden kontrolü
    const selectedSize = size || (product.sizeStock.length > 0 ? product.sizeStock[0].size : null);

    if (!selectedSize) {
      return res.status(400).json({
        success: false,
        message: 'Hata: Beden seçimi zorunludur'
      });
    }

    const sizeItem = product.sizeStock.find(s => s.size === selectedSize);

    if (!sizeItem) {
      return res.status(404).json({
        success: false,
        message: `Hata: "${selectedSize}" bedeni bulunamadı`
      });
    }

    // Stok yetersizse
    if (sizeItem.stock < qty) {
      return res.status(400).json({
        success: false,
        message: `Hata: Stok yetersiz. Mevcut: ${sizeItem.stock}`
      });
    }

    // Stok azalt ve kaydet
    sizeItem.stock -= qty;
    await product.save();

    // Satış geçmişine kaydet
    const totalPrice = product.price * qty;
    const sizeDisplay = product.category === 'Çocuk Giyim' ? `${selectedSize} Yaş` : selectedSize;

    await SalesHistory.create({
      productId: product._id,
      productName: product.name,
      category: product.category,
      size: selectedSize,
      quantity: qty,
      price: product.price,
      totalPrice,
      paymentMethod: paymentMethod || 'Nakit',
      cashier: 'Sistem'
    });

    res.json({
      success: true,
      message: `Başarılı: ${product.name} - ${sizeDisplay} (${qty} adet) satıldı. Kalan Stok: ${sizeItem.stock}`,
      product: {
        name: product.name,
        category: product.category,
        price: product.price,
        size: selectedSize,
        sizeDisplay,
        quantity: qty,
        remainingStock: sizeItem.stock
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Satış işleminde hata oluştu: ' + error.message
    });
  }
});

// Satış Fişi
router.get('/api/satis/:id/receipt', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Geçersiz satış ID' });
    }
    const sale = await SalesHistory.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Satış kaydı bulunamadı' });
    }

    const date = new Date(sale.createdAt);
    const dateStr = date.toLocaleDateString('tr-TR');
    const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const isAge = sale.category === 'Çocuk Giyim';
    const sizeDisplay = isAge && sale.size ? `${sale.size} Yaş` : (sale.size || '-');

    const html = `
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <title>Satış Fişi</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; font-size: 12px; background: #fff; padding: 10px; width: 80mm; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #333; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; margin: 3px 0; }
          .title { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
          .subtitle { font-size: 10px; color: #555; margin-bottom: 8px; }
          .total-row { font-size: 14px; font-weight: bold; }
          .footer { font-size: 10px; color: #555; margin-top: 8px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="title">ÖZ SPOR OUTDOOR</div>
          <div class="subtitle">Satış Fişi</div>
        </div>
        <div class="divider"></div>
        <div class="row"><span>Tarih:</span><span>${dateStr} ${timeStr}</span></div>
        <div class="row"><span>Fiş No:</span><span>${sale._id.toString().slice(-8).toUpperCase()}</span></div>
        <div class="row"><span>Kasiyer:</span><span>${sale.cashier || 'Sistem'}</span></div>
        <div class="divider"></div>
        <div class="bold" style="margin-bottom:4px;">ÜRÜN BİLGİLERİ</div>
        <div class="row"><span>Ürün:</span><span>${sale.productName || '-'}</span></div>
        <div class="row"><span>Kategori:</span><span>${sale.category || '-'}</span></div>
        <div class="row"><span>Beden:</span><span>${sizeDisplay}</span></div>
        <div class="row"><span>Birim Fiyat:</span><span>${sale.price ? sale.price.toFixed(2) + ' TL' : '-'}</span></div>
        <div class="row"><span>Adet:</span><span>${sale.quantity}</span></div>
        <div class="divider"></div>
        <div class="row total-row"><span>TOPLAM:</span><span>${sale.totalPrice ? sale.totalPrice.toFixed(2) + ' TL' : '-'}</span></div>
        <div class="row" style="margin-top:4px;"><span>Ödeme:</span><span>${sale.paymentMethod || 'Nakit'}</span></div>
        <div class="divider"></div>
        <div class="center footer">Bizi tercih ettiğiniz için teşekkürler!</div>
        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Fiş oluşturma hatası: ' + error.message });
  }
});

// Satış Geçmişi
router.get('/api/satis/history', async (req, res) => {
  try {
    const history = await SalesHistory.find().sort({ createdAt: -1 }).limit(200);
    res.json(history);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Satış geçmişi yüklenemedi: ' + error.message });
  }
});

module.exports = router;

