import { Category, Stimulus, StimulusType } from './types';

// Supabase Configuration
// NOTE: You need to provide your specific SUPABASE_URL here. 
// The key provided in the prompt is used, but a URL is required for the client to work.
export const SUPABASE_URL = "https://gqulzoctsltwxmzvofwv.supabase.co"; 
export const SUPABASE_KEY = "sb_publishable_alcHOMdoEOvJmuSvwEeeoQ_HnbodgT3";

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
// Assumes images are located in 'public/images/' and accessible via './images/'
export const HORSE_IMAGES = Array.from({ length: 8 }, (_, i) => `./images/horse_${i + 1}.jpg`);

export const COW_IMAGES = Array.from({ length: 8 }, (_, i) => `./images/cow_${i + 1}.jpg`);

// Generate Stimuli Pool
export const STIMULI_POOL: Stimulus[] = [
  ...BASHKIR_WORDS.map((w, i) => ({ id: `bash_${i}`, content: w, type: StimulusType.WORD, category: Category.BASHKIR })),
  ...RUSSIAN_WORDS.map((w, i) => ({ id: `rus_${i}`, content: w, type: StimulusType.WORD, category: Category.RUSSIAN })),
  ...HORSE_IMAGES.map((url, i) => ({ id: `horse_${i}`, content: url, type: StimulusType.IMAGE, category: Category.HORSE })),
  ...COW_IMAGES.map((url, i) => ({ id: `cow_${i}`, content: url, type: StimulusType.IMAGE, category: Category.COW })),
];
