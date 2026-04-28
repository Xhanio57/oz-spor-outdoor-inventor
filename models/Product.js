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

const sizeStockSchema = new mongoose.Schema({
  size: String,
  stock: { type: Number, default: 0, min: 0 }
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
      enum: ['Spor Giyim', 'Judogi', 'Kamp Malzemeleri', 'Ayakkabı', 'Aksesuarlar', 'Çocuk Giyim', 'Diğer'],
      default: 'Diğer'
    },
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

const CATEGORY_SIZES = {
  'Judogi': Array.from({ length: 11 }, (_, i) => (100 + i * 10).toString() + 'cm'),
  'Ayakkabı': Array.from({ length: 11 }, (_, i) => (36 + i).toString()),
  'Spor Giyim': ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '5XL'],
  'Çocuk Giyim': ['4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16'],
  'Kamp Malzemeleri': ['Tek Boyut'],
  'Aksesuarlar': ['Tek Boyut'],
  'Diğer': ['Tek Boyut']
};

productSchema.pre('save', async function (next) {
  if (!this.barcode) {
    this.barcode = await generateUniqueBarcode();
  }

  if (!this.sizeStock || this.sizeStock.length === 0) {
    const sizes = CATEGORY_SIZES[this.category] || ['Tek Boyut'];
    this.sizeStock = sizes.map(size => ({ size, stock: 0 }));
  }

  next();
});

productSchema.virtual('totalStock').get(function () {
  return this.sizeStock.reduce((total, item) => total + item.stock, 0);
});

module.exports = mongoose.model('Product', productSchema);
