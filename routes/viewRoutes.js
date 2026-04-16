const express = require('express');
const router = express.Router();

// Admin - Ürün Ekleme Sayfası
router.get('/admin/add-product', (req, res) => {
  res.render('admin-add-product', {
    title: 'Ürün Ekle'
  });
});

// Admin - Stok Listesi Sayfası
router.get('/admin/inventory', (req, res) => {
  res.render('admin-inventory', {
    title: 'Stok Listesi'
  });
});

// POS - Satış Sayfası
router.get('/pos', (req, res) => {
  res.render('pos-sales', {
    title: 'Hızlı Satış (POS)'
  });
});

// Ana Sayfa (Dashboard)
router.get('/', (req, res) => {
  res.render('dashboard', {
    title: 'Ana Sayfa'
  });
});

module.exports = router;
