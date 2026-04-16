const mongoose = require('mongoose');

const generateUniqueBarcode = async () => {
  let barcode;
  let isUnique = false;
  
  while (!isUnique) {
    barcode = Math.floor(10000000 + Math.random() * 90000000).toString();
    const existingProduct = await mongoose.model('Product').findOne({ barcode });
    isUnique = !existingProduct;
  }
  
  return barcode;
};

// Beden seçenekleri kategoriye göre
const sizeOptions = {
  'Judo Ürünleri': ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  'Spor Giyim': ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  'Kamp Ekipmanları': ['Tek Boyut'],
  'Diğer': ['Tek Boyut']
};

const sizeStockSchema = new mongoose.Schema({
  size: {
    type: String,
    required: true
  },
  stock: {
    type: Number,
    default: 0,
    min: [0, 'Stok negatif olamaz']
  }
}, { _id: false });

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Ürün adı zorunludur'],
      trim: true,
      maxlength: [100, 'Ürün adı 100 karakteri geçemez']
    },
    barcode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    price: {
      type: Number,
      required: [true, 'Fiyat zorunludur'],
      min: [0, 'Fiyat negatif olamaz']
    },
    category: {
      type: String,
      required: [true, 'Kategori zorunludur'],
      enum: ['Judo Ürünleri', 'Spor Giyim', 'Kamp Ekipmanları', 'Diğer'],
      default: 'Diğer'
    },
    // Beden bazlı stok
    sizeStock: [sizeStockSchema],
    
    image: {
      type: String,
      default: '/images/default-product.png'
    },
    description: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

productSchema.pre('save', async function (next) {
  if (!this.barcode) {
    this.barcode = await generateUniqueBarcode();
  }
  
  // Eğer sizeStock boşsa, kategori için varsayılan bedenleri ekle
  if (!this.sizeStock || this.sizeStock.length === 0) {
    const defaultSizes = sizeOptions[this.category] || ['Tek Boyut'];
    this.sizeStock = defaultSizes.map(size => ({
      size,
      stock: 0
    }));
  }
  
  next();
});

// Toplam stoku hesapla
productSchema.virtual('totalStock').get(function() {
  return this.sizeStock.reduce((total, item) => total + item.stock, 0);
});

module.exports = mongoose.model('Product', productSchema);