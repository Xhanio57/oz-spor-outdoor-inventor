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

