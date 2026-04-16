const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// POS Satış Endpoint - Quantity parametresi ile
router.post('/api/satis', async (req, res) => {
  try {
    const { barcode, quantity } = req.body;

    // Barkod validasyonu
    if (!barcode || barcode.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Hata: Barkod boş olamaz'
      });
    }

    // Quantity varsayılan 1
    const qty = quantity || 1;

    // Barkoda göre ürünü bul
    const product = await Product.findOne({ barcode: barcode.trim() });

    // Ürün bulunamadıysa
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Hata: Ürün bulunamadı'
      });
    }

    // Stok yetersizse
    if (product.stock < qty) {
      return res.status(400).json({
        success: false,
        message: `Hata: Stok yetersiz. Mevcut: ${product.stock}`
      });
    }

    // Stok azalt ve kaydet
    product.stock -= qty;
    await product.save();

    res.json({
      success: true,
      message: `Başarılı: ${product.name} (${qty} adet) satıldı. Kalan Stok: ${product.stock}`,
      product: {
        name: product.name,
        price: product.price,
        quantity: qty,
        remainingStock: product.stock
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Satış işleminde hata oluştu: ' + error.message
    });
  }
});

module.exports = router;
