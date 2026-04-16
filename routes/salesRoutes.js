const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// Satış yap ve stoktan düş
router.post('/api/sales', async (req, res) => {
  try {
    const { productId, size, quantity, paymentMethod } = req.body;

    if (!productId || !size || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Ürün, beden ve miktar zorunludur'
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Ürün bulunamadı'
      });
    }

    // Bedeni bul
    const sizeItem = product.sizeStock.find(s => s.size === size);

    if (!sizeItem) {
      return res.status(404).json({
        success: false,
        message: 'Beden bulunamadı'
      });
    }

    // Stok kontrolü
    if (sizeItem.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Yeterli stok yok. Mevcut: ${sizeItem.stock}`
      });
    }

    // Stoktan düş
    sizeItem.stock -= parseInt(quantity);
    await product.save();

    res.json({
      success: true,
      message: `Satış başarılı. ${product.name} (${size}) x${quantity}`,
      product,
      totalPrice: product.price * quantity
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Satış hatası: ' + error.message
    });
  }
});

module.exports = router;
