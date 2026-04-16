const mongoose = require('mongoose');
const {
  CATEGORIES,
  ALL_SIZES,
  STANDARD_SIZE,
  getSizesForCategory,
  hasMultipleSizes
} = require('../config/sizeConstants');

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
      enum: CATEGORIES,
      default: 'Diğer'
    },
    size: {
      type: String,
      enum: ALL_SIZES,
      required: [
        function isSizeRequired() {
          return hasMultipleSizes(this.category);
        },
        'Beden zorunludur'
      ],
      validate: {
        validator: function validateSize(value) {
          const validSizes = getSizesForCategory(this.category);
          return validSizes.includes(value);
        },
        message: 'Seçilen beden kategori ile eşleşmiyor'
      }
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

  if (!hasMultipleSizes(this.category)) {
    this.size = STANDARD_SIZE;
  }

  next();
});

module.exports = mongoose.model('Product', productSchema);
