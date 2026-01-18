export enum StimulusType {
  WORD = 'WORD',
  IMAGE = 'IMAGE'
}

export enum Category {
  BASHKIR = 'BASHKIR',
  RUSSIAN = 'RUSSIAN',
  NATURE_A = 'NATURE_A',
  NATURE_B = 'NATURE_B'
}

export interface Stimulus {
  id: string;
  content: string; // Word text or Image URL
  type: StimulusType;
  category: Category;
}

export interface TrialResult {
  blockId: number;
  stimulusId: string;
  category: Category;
  isCorrect: boolean;
  reactionTime: number;
  timestamp: number;
}

export interface IATConfig {
  blocks: BlockConfig[];
}

export interface BlockConfig {
  id: number;
  title: string;
  leftCategories: Category[];
  rightCategories: Category[];
  trials: number; // Number of stimuli to show
  instruction: string;
}

export interface UserSession {
  userId: string;
  referrer: string;
  startTime: number;
  group: 'A' | 'B'; // Counterbalancing group
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
