const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const SalesHistory = require('../models/SalesHistory');

// POS Satış Endpoint - Beden ve Miktar ile
router.post('/api/satis', async (req, res) => {
  try {
    const { barcode, quantity, size, paymentMethod, transactionId } = req.body;

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
      cashier: 'Sistem',
      transactionId: transactionId || undefined
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

// Satış Fişi - tek kayıt veya aynı transactionId'ye ait tüm kalemleri gösterir
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

    // Aynı işleme (transactionId) ait tüm kalemleri getir
    let sales;
    if (sale.transactionId) {
      sales = await SalesHistory.find({ transactionId: sale.transactionId }).sort({ createdAt: 1 });
    } else {
      sales = [sale];
    }

    const date = new Date(sales[0].createdAt);
    const dateStr = date.toLocaleDateString('tr-TR');
    const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const fisNo = sale.transactionId
      ? sale.transactionId.replace('TXN-', '').slice(-10).toUpperCase()
      : sale._id.toString().slice(-8).toUpperCase();

    const itemRows = sales.map((s, i) => {
      const isAge = s.category === 'Çocuk Giyim';
      const sizeDisplay = isAge && s.size ? `${s.size} Yaş` : (s.size || '-');
      return `
        <div class="item-row">
          <span class="item-num">${i + 1}.</span>
          <span class="item-name">${s.productName || '-'} (${sizeDisplay})</span>
          <span class="item-qty">x${s.quantity}</span>
          <span class="item-total">${s.totalPrice ? s.totalPrice.toFixed(2) + ' TL' : '-'}</span>
        </div>
        <div class="item-detail">${s.price ? s.price.toFixed(2) + ' TL / adet' : ''}</div>
      `;
    }).join('');

    const grandTotal = sales.reduce((sum, s) => sum + (s.totalPrice || 0), 0);
    const paymentMethod = sales[0].paymentMethod || 'Nakit';
    const cashier = sales[0].cashier || 'Sistem';

    const html = `
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <title>Satış Fişi ${fisNo}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; font-size: 12px; background: #fff; padding: 10px; width: 80mm; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #333; margin: 6px 0; }
          .row { display: flex; justify-content: space-between; margin: 2px 0; }
          .title { font-size: 15px; font-weight: bold; margin-bottom: 3px; }
          .subtitle { font-size: 10px; color: #555; margin-bottom: 6px; }
          .item-row { display: flex; gap: 4px; margin: 3px 0 0; font-size: 11px; }
          .item-num { min-width: 14px; }
          .item-name { flex: 1; word-break: break-word; }
          .item-qty { white-space: nowrap; }
          .item-total { white-space: nowrap; text-align: right; min-width: 60px; }
          .item-detail { font-size: 9px; color: #777; margin: 0 0 3px 18px; }
          .total-row { font-size: 13px; font-weight: bold; }
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
        <div class="row"><span>Fiş No:</span><span>${fisNo}</span></div>
        <div class="row"><span>Kasiyer:</span><span>${cashier}</span></div>
        <div class="divider"></div>
        <div class="bold" style="margin-bottom:4px;">ÜRÜNLER</div>
        ${itemRows}
        <div class="divider"></div>
        <div class="row total-row"><span>TOPLAM:</span><span>${grandTotal.toFixed(2)} TL</span></div>
        <div class="row" style="margin-top:3px;"><span>Ödeme:</span><span>${paymentMethod}</span></div>
        <div class="divider"></div>
        <div class="center footer">Bizi tercih ettiğiniz için teşekkürler!</div>
        <script>window.onload = function() { window.print(); };<\/script>
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

