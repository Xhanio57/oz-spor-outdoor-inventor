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
    stock: {
      type: Number,
      default: 0,
      min: [0, 'Stok negatif olamaz']
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
  next();
});

module.exports = mongoose.model('Product', productSchema);
