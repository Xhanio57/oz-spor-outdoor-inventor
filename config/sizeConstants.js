const STANDARD_SIZE = 'Standart';
const JUDOGI_START_CM = 100;
const JUDOGI_END_CM = 200;
const JUDOGI_STEP_CM = 10;
const SHOE_START = 36;
const SHOE_END = 46;

const CATEGORY_SIZE_MAP = {
  Judogi: Array.from(
    { length: ((JUDOGI_END_CM - JUDOGI_START_CM) / JUDOGI_STEP_CM) + 1 },
    (_, i) => `${JUDOGI_START_CM + i * JUDOGI_STEP_CM}cm`
  ),
  Ayakkabı: Array.from({ length: (SHOE_END - SHOE_START) + 1 }, (_, i) => `${SHOE_START + i}`),
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
