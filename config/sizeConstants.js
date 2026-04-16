const STANDARD_SIZE = 'Standart';

const CATEGORY_SIZE_MAP = {
  Judogi: Array.from({ length: 11 }, (_, i) => `${100 + i * 10}cm`),
  Ayakkabı: Array.from({ length: 11 }, (_, i) => `${36 + i}`),
  'Spor Giyim': ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'],
  'Kamp Malzemeleri': [STANDARD_SIZE],
  Aksesuarlar: [STANDARD_SIZE],
  'Diğer': [STANDARD_SIZE]
};

const CATEGORIES = Object.keys(CATEGORY_SIZE_MAP);
const ALL_SIZES = [...new Set(Object.values(CATEGORY_SIZE_MAP).flat())];

const getSizesForCategory = (category) => CATEGORY_SIZE_MAP[category] || [];

const hasMultipleSizes = (category) => getSizesForCategory(category).length > 1;

module.exports = {
  STANDARD_SIZE,
  CATEGORY_SIZE_MAP,
  CATEGORIES,
  ALL_SIZES,
  getSizesForCategory,
  hasMultipleSizes
};
