const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/oz_spor');

const productSchema = new mongoose.Schema({
  name: String,
  category: String,
  barcode: String,
  stock: Number,
  price: Number,
  image: String
});

const Product = mongoose.model('Product', productSchema);

async function seedData() {
  try {
    await Product.deleteMany({});
    await Product.insertMany([
      {name: "Beyaz Judo Giysi", category: "Judo Ürünleri", barcode: "1234567890001", stock: 15, price: 299.99, image: "https://via.placeholder.com/150?text=Judo"},
      {name: "Spor Ayakkabı", category: "Spor Giyim", barcode: "1234567890002", stock: 8, price: 449.99, image: "https://via.placeholder.com/150?text=Ayakkabi"},
      {name: "Kamp Çadırı", category: "Kamp Ekipmanları", barcode: "1234567890003", stock: 5, price: 1299.99, image: "https://via.placeholder.com/150?text=Cadir"}
    ]);
    console.log('✅ Veriler eklendi!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  }
}

seedData();
