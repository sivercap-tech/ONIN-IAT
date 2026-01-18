import { Category, Stimulus, StimulusType } from './types';

// Supabase Configuration
export const SUPABASE_URL = "https://gqulzoctsltwxmzvofwv.supabase.co"; 
export const SUPABASE_KEY = "sb_publishable_alcHOMdoEOvJmuSvwEeeoQ_HnbodgT3";

// URL for the second part of the test
// TODO: Replace this with the actual URL of the second IAT test
export const NEXT_TEST_URL = "https://example.com/second-iat-part";

// Bashkir Words
export const BASHKIR_WORDS = [
  "Юрта", "Сабантуй", "Тюбетейка", "Агидель", "Урал-Батыр", 
  "Бешмет", "Кумыс", "Курай", "Бешбармак"
];

// Russian Words
export const RUSSIAN_WORDS = [
  "Шапка-ушанка", "Квас", "Пельмени", "Балалайка", "Изба", 
  "Илья Муромец", "Волга", "Масленица", "Кокошник"
];

// Local Images
// Using import.meta.glob ensures that Vite processes these files as assets,
// includes them in the build output, and provides the correct hashed URLs.
// This works even if the 'images' folder is not in 'public'.
const horseModules = import.meta.glob('./images/horse_*.jpg', { eager: true, import: 'default' });
const cowModules = import.meta.glob('./images/cow_*.jpg', { eager: true, import: 'default' });

// Helper to sort images numerically (e.g. horse_1, horse_2, ..., horse_10)
const getSortedImages = (modules: Record<string, unknown>) => {
  return Object.entries(modules)
    .sort(([keyA], [keyB]) => {
      // Extract the number from the filename
      const numA = parseInt(keyA.match(/_(\d+)\./)?.[1] || '0');
      const numB = parseInt(keyB.match(/_(\d+)\./)?.[1] || '0');
      return numA - numB;
    })
    .map(([_, url]) => url as string);
};

export const HORSE_IMAGES = getSortedImages(horseModules);
export const COW_IMAGES = getSortedImages(cowModules);

// Fallback / Debugging
if (HORSE_IMAGES.length === 0) {
  console.warn("No horse images found! Check that files exist in ./images/horse_*.jpg");
}
if (COW_IMAGES.length === 0) {
  console.warn("No cow images found! Check that files exist in ./images/cow_*.jpg");
}

// Generate Stimuli Pool
export const STIMULI_POOL: Stimulus[] = [
  ...BASHKIR_WORDS.map((w, i) => ({ id: `bash_${i}`, content: w, type: StimulusType.WORD, category: Category.BASHKIR })),
  ...RUSSIAN_WORDS.map((w, i) => ({ id: `rus_${i}`, content: w, type: StimulusType.WORD, category: Category.RUSSIAN })),
  ...HORSE_IMAGES.map((url, i) => ({ id: `horse_${i}`, content: url, type: StimulusType.IMAGE, category: Category.HORSE })),
  ...COW_IMAGES.map((url, i) => ({ id: `cow_${i}`, content: url, type: StimulusType.IMAGE, category: Category.COW })),
];
