import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { STIMULI_POOL, BASHKIR_WORDS, RUSSIAN_WORDS, COW_IMAGES, HORSE_IMAGES, NEXT_TEST_URL } from '../constants';
import { Category, StimulusType, UserSession, BlockConfig } from '../types';
import { saveResults, recordTransition } from '../services/supabaseService';

// Helper to get random item
const getRandom = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];

// Generate blocks based on counterbalancing group
const getBlocks = (group: 'A' | 'B'): BlockConfig[] => {
  // Group A: Standard (Bashkir+Horse vs Russian+Cow)
  // Group B: Inverted (Bashkir+Cow vs Russian+Horse)
  
  const isGroupA = group === 'A';

  const combinedBlock1_Left = isGroupA 
    ? [Category.BASHKIR, Category.HORSE] 
    : [Category.BASHKIR, Category.COW];
  
  const combinedBlock1_Right = isGroupA 
    ? [Category.RUSSIAN, Category.COW] 
    : [Category.RUSSIAN, Category.HORSE];

  const combinedBlock1_Instruct = isGroupA
    ? "Нажимайте 'E' для БАШКИРЫ или ЛОШАДИ.\nНажимайте 'I' для РУССКИЕ или КОРОВЫ."
    : "Нажимайте 'E' для БАШКИРЫ или КОРОВЫ.\nНажимайте 'I' для РУССКИЕ или ЛОШАДИ.";

  const combinedBlock2_Left = isGroupA
    ? [Category.RUSSIAN, Category.HORSE]
    : [Category.RUSSIAN, Category.COW];

  const combinedBlock2_Right = isGroupA
    ? [Category.BASHKIR, Category.COW]
    : [Category.BASHKIR, Category.HORSE];

  const combinedBlock2_Instruct = isGroupA
    ? "Нажимайте 'E' для РУССКИЕ или ЛОШАДИ.\nНажимайте 'I' для БАШКИРЫ или КОРОВЫ."
    : "Нажимайте 'E' для РУССКИЕ или КОРОВЫ.\nНажимайте 'I' для БАШКИРЫ или ЛОШАДИ.";

  return [
    {
      id: 1,
      title: "Блок 1 из 7: Тренировка слов",
      instruction: "Запомните слова для каждой категории.\nНажимайте 'E' (слева) для БАШКИРСКИХ слов.\nНажимайте 'I' (справа) для РУССКИХ слов.",
      leftCategories: [Category.BASHKIR],
      rightCategories: [Category.RUSSIAN],
      trials: 20
    },
    {
      id: 2,
      title: "Блок 2 из 7: Тренировка изображений",
      instruction: "Запомните изображения для каждой категории.\nНажимайте 'E' (слева) для ЛОШАДЕЙ.\nНажимайте 'I' (справа) для КОРОВ.",
      leftCategories: [Category.HORSE],
      rightCategories: [Category.COW],
      trials: 20
    },
    {
      id: 3,
      title: "Блок 3 из 7: Совмещение (Тренировка)",
      instruction: combinedBlock1_Instruct,
      leftCategories: combinedBlock1_Left,
      rightCategories: combinedBlock1_Right,
      trials: 20
    },
    {
      id: 4,
      title: "Блок 4 из 7: Совмещение (Тест)",
      instruction: "То же самое задание, но быстрее.\n" + combinedBlock1_Instruct,
      leftCategories: combinedBlock1_Left,
      rightCategories: combinedBlock1_Right,
      trials: 40
    },
    {
      id: 5,
      title: "Блок 5 из 7: Смена сторон (Слова)",
      instruction: "ВНИМАНИЕ: Стороны для слов поменялись!\nНажимайте 'E' (слева) для РУССКИХ слов.\nНажимайте 'I' (справа) для БАШКИРСКИХ слов.",
      leftCategories: [Category.RUSSIAN],
      rightCategories: [Category.BASHKIR],
      trials: 40
    },
    {
      id: 6,
      title: "Блок 6 из 7: Обратное совмещение (Тренировка)",
      instruction: combinedBlock2_Instruct,
      leftCategories: combinedBlock2_Left,
      rightCategories: combinedBlock2_Right,
      trials: 20
    },
    {
      id: 7,
      title: "Блок 7 из 7: Обратное совмещение (Тест)",
      instruction: "То же самое задание, но быстрее.\n" + combinedBlock2_Instruct,
      leftCategories: combinedBlock2_Left,
      rightCategories: combinedBlock2_Right,
      trials: 40
    }
  ];
};

const IATTest = ({ session, onComplete }: { session: UserSession, onComplete: () => void }) => {
  // New State: General Instructions before starting blocks
  const [showGeneralIntro, setShowGeneralIntro] = useState(true);
  const [introStep, setIntroStep] = useState(0);

  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [isInstruction, setIsInstruction] = useState(true);
  const [trialCount, setTrialCount] = useState(0);
  const [currentStimulus, setCurrentStimulus] = useState<any>(null);
  const [startTime, setStartTime] = useState(0);
  const [mistake, setMistake] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  
  // States for finishing process
  const [finished, setFinished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Debounce Ref
  const lastInputTime = useRef(0);

  // Initialize blocks based on session group
  const blocks = useMemo(() => getBlocks(session.group), [session.group]);
  const currentBlock = blocks[currentBlockIndex];

  // Buffer references to avoid closure staleness in event listeners
  const stateRef = useRef({
    showGeneralIntro,
    currentBlockIndex,
    isInstruction,
    currentStimulus,
    startTime,
    mistake,
    trialCount,
    finished,
    isSaving,
    isTransitioning,
    blocks
  });

  // Sync ref
  useEffect(() => {
    stateRef.current = { 
      showGeneralIntro,
      currentBlockIndex, 
      isInstruction, 
      currentStimulus, 
      startTime, 
      mistake, 
      trialCount, 
      finished,
      isSaving,
      isTransitioning,
      blocks
    };
  }, [showGeneralIntro, currentBlockIndex, isInstruction, currentStimulus, startTime, mistake, trialCount, finished, isSaving, isTransitioning, blocks]);

  const finishTest = useCallback(async (finalResults: any[]) => {
    setFinished(true);
    setIsSaving(true);
    
    const response = await saveResults(session, {
      group: session.group,
      data: finalResults
    });
    
    setIsSaving(false);
    if (response.error) {
      setSaveError(response.error.message || "Неизвестная ошибка при сохранении");
    }
  }, [session]);

  const handleNextTest = async () => {
    setIsTransitioning(true);
    await recordTransition(session);

    const separator = NEXT_TEST_URL.includes('?') ? '&' : '?';
    window.location.href = `${NEXT_TEST_URL}${separator}pid=${session.userId}`;
  };

  const nextTrial = useCallback(() => {
    const blocksLocal = stateRef.current.blocks;
    const block = blocksLocal[currentBlockIndex];

    if (stateRef.current.trialCount >= block.trials) {
      // End of block
      if (currentBlockIndex >= blocksLocal.length - 1) {
        finishTest(results); 
        return;
      }
      setCurrentBlockIndex(prev => prev + 1);
      setTrialCount(0);
      setIsInstruction(true);
      return;
    }

    // Pick a stimulus that matches active categories
    const validCategories = [...block.leftCategories, ...block.rightCategories];
    const pool = STIMULI_POOL.filter(s => validCategories.includes(s.category));

    // --- ИЗМЕНЕНИЕ: Запрет повтора стимулов ---
    // Исключаем текущий стимул из кандидатов, если в пуле есть другие варианты
    let availableCandidates = pool;
    if (stateRef.current.currentStimulus && pool.length > 1) {
        availableCandidates = pool.filter(s => s.id !== stateRef.current.currentStimulus.id);
    }
    const nextStim = getRandom(availableCandidates);
    // ------------------------------------------

    setCurrentStimulus(nextStim);
    setMistake(false);
    setStartTime(performance.now());
    setTrialCount(prev => prev + 1);
  }, [currentBlockIndex, results, finishTest]);

  const handleInput = useCallback((action: 'LEFT' | 'RIGHT' | 'SPACE') => {
    // FIX: Debounce to prevent double-taps/ghost clicks (150ms buffer)
    const now = performance.now();
    if (now - lastInputTime.current < 150) {
      return; 
    }
    lastInputTime.current = now;

    const state = stateRef.current;
    if (state.finished || state.isSaving || state.isTransitioning) return;

    // Handle General Intro Screen
    if (state.showGeneralIntro) {
      if (action === 'SPACE') {
        setShowGeneralIntro(false);
      }
      return;
    }

    // Handle Block Instruction Screen
    if (state.isInstruction) {
      if (action === 'SPACE') {
        setIsInstruction(false);
        nextTrial();
      }
      return;
    }

    // Handle Test
    if (!state.currentStimulus) return;

    const block = state.blocks[state.currentBlockIndex];
    
    let isLeft = false; 
    let isRight = false;
    
    if (action === 'LEFT') isLeft = true;
    if (action === 'RIGHT') isRight = true;

    if (!isLeft && !isRight) return;

    const correctSide = block.leftCategories.includes(state.currentStimulus.category) ? 'left' : 'right';
    const pressedSide = isLeft ? 'left' : 'right';

    if (correctSide !== pressedSide) {
      setMistake(true);
    } else {
      const endTime = performance.now();
      const rt = endTime - state.startTime;
      
      const result = {
        blockId: block.id,
        blockName: block.title,
        stimulusId: state.currentStimulus.id,
        category: state.currentStimulus.category,
        isCorrect: !state.mistake,
        reactionTime: rt,
        timestamp: Date.now()
      };

      setResults(prev => [...prev, result]);
      
      const isLastBlock = state.currentBlockIndex >= state.blocks.length - 1;
      const isLastTrial = state.trialCount >= block.trials - 1;
      
      if (isLastBlock && isLastTrial) {
         finishTest([...results, result]);
      } else {
         nextTrial();
      }
    }
  }, [nextTrial, results, finishTest]);

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleInput('SPACE');
      }
      if (e.code === 'KeyE') handleInput('LEFT');
      if (e.code === 'KeyI') handleInput('RIGHT');
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [handleInput]);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    target.style.display = 'none';
    const parent = target.parentElement;
    if (parent) {
      const errorText = document.createElement('span');
      errorText.innerText = 'IMG Error';
      errorText.className = 'text-xs text-red-400';
      parent.appendChild(errorText);
    }
    console.warn(`Failed to load image: ${target.src}`);
  };

  if (finished) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white p-8 text-center">
        <h1 className="text-4xl font-bold mb-4 text-emerald-400">Первая часть завершена!</h1>
        
        {isSaving ? (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-lg text-slate-300">Сохранение результатов...</p>
          </div>
        ) : saveError ? (
          <div className="bg-red-900/50 border border-red-500 p-6 rounded-xl max-w-md mb-8">
            <h3 className="text-xl font-bold text-red-400 mb-2">Ошибка сохранения</h3>
            <p className="text-slate-200 mb-4">{saveError}</p>
            <p className="text-sm text-slate-400">Пожалуйста, сообщите администратору или проверьте настройки Supabase URL.</p>
          </div>
        ) : (
          <p className="text-lg mb-8 text-slate-300">Данные успешно сохранены.</p>
        )}

        {isTransitioning ? (
           <div className="flex flex-col items-center mt-4">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="text-emerald-400">Переход ко второй части...</p>
           </div>
        ) : (
          <div className="flex gap-4 mt-4">
            <button 
              onClick={handleNextTest}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-lg font-bold text-lg transition-colors shadow-lg hover:scale-105 transform duration-200"
            >
              Перейти ко второй части
            </button>
          </div>
        )}
      </div>
    );
  }

  // General Intro Screen (before any blocks)
  if (showGeneralIntro) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4 text-center max-w-7xl mx-auto">
        
        {/* Шаг 1: Текстовая инструкция */}
        {introStep === 0 && (
          <div className="bg-slate-800 p-6 md:p-10 rounded-xl border border-slate-700 shadow-2xl w-full max-w-3xl flex flex-col items-center">
            <h2 className="text-2xl md:text-4xl font-bold text-emerald-400 mb-6">Инструкция</h2>
            <p className="text-lg md:text-2xl leading-relaxed text-slate-200 mb-8 text-left md:text-center">
              Постарайтесь действовать как можно быстрее, но при этом сохранять внимательность.
              <br/><br/>
              Вы будете использовать клавиши 
              <span className="font-bold text-emerald-400 mx-2">'E'</span> и 
              <span className="font-bold text-blue-400 mx-2">'I'</span> 
              (или кнопки на экране), чтобы сортировать слова и картинки.
              <br/><br/>
              Если вы ошибетесь, появится красный <span className="text-red-500 font-bold">X</span>. Исправьте ошибку, нажав другую кнопку, чтобы продолжить.
            </p>
            <button 
              onClick={() => setIntroStep(1)}
              className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white text-xl font-bold py-4 px-12 rounded-full shadow-lg transition-transform active:scale-95"
            >
              Далее
            </button>
          </div>
        )}

        {/* Шаг 2: Примеры категорий */}
        {introStep === 1 && (
          <div className="bg-slate-800 p-2 md:p-8 rounded-xl border border-slate-700 shadow-2xl w-full flex flex-col items-center pb-24 md:pb-8">
            <p className="text-base md:text-2xl text-slate-300 mb-4 md:mb-6">Запомните категории и примеры:</p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6 text-left mb-2 w-full">
              {/* Bashkirs */}
              <div className="bg-slate-900/60 p-2 md:p-4 rounded-lg border border-slate-700">
                <h3 className="font-bold text-emerald-400 text-sm md:text-lg mb-2 text-center border-b border-slate-700 pb-1">Башкиры</h3>
                <ul className="text-slate-300 space-y-0.5 text-[10px] md:text-base text-center leading-tight">
                  {BASHKIR_WORDS.map((w) => <li key={w}>{w}</li>)}
                </ul>
              </div>

              {/* Russians */}
              <div className="bg-slate-900/60 p-2 md:p-4 rounded-lg border border-slate-700">
                <h3 className="font-bold text-blue-400 text-sm md:text-lg mb-2 text-center border-b border-slate-700 pb-1">Русские</h3>
                <ul className="text-slate-300 space-y-0.5 text-[10px] md:text-base text-center leading-tight">
                  {RUSSIAN_WORDS.map((w) => <li key={w}>{w}</li>)}
                </ul>
              </div>

              {/* Horses */}
              <div className="bg-slate-900/60 p-2 md:p-4 rounded-lg border border-slate-700">
                <h3 className="font-bold text-emerald-400 text-sm md:text-lg mb-2 text-center border-b border-slate-700 pb-1">Лошади</h3>
                <div className="grid grid-cols-2 gap-1 md:gap-2">
                  {HORSE_IMAGES.slice(0, 4).map((src, i) => (
                    <div key={i} className="aspect-square bg-slate-800 rounded overflow-hidden">
                      <img src={src} className="w-full h-full object-cover" alt="Horse" onError={handleImageError} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Cows */}
              <div className="bg-slate-900/60 p-2 md:p-4 rounded-lg border border-slate-700">
                <h3 className="font-bold text-blue-400 text-sm md:text-lg mb-2 text-center border-b border-slate-700 pb-1">Коровы</h3>
                <div className="grid grid-cols-2 gap-1 md:gap-2">
                   {COW_IMAGES.slice(0, 4).map((src, i) => (
                    <div key={i} className="aspect-square bg-slate-800 rounded overflow-hidden">
                      <img src={src} className="w-full h-full object-cover" alt="Cow" onError={handleImageError} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button 
              onClick={() => handleInput('SPACE')}
              className="fixed bottom-6 left-4 right-4 md:static md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white text-xl font-bold py-3 md:py-4 px-12 rounded-full shadow-lg transition-transform active:scale-95 animate-pulse z-50"
            >
              Начать тест
            </button>
          </div>
        )}

      </div>
    );
  }

  // Instruction Screen (for Blocks)
  if (isInstruction) {
    return (
      <div 
        className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-2 md:p-8 text-center max-w-5xl mx-auto cursor-pointer"
        onClick={() => handleInput('SPACE')}
      >
        <h2 className="text-lg md:text-3xl font-bold mb-2 md:mb-4 text-blue-400">{currentBlock.title}</h2>
        
        <div className="bg-slate-800 p-3 md:p-6 rounded-xl border border-slate-700 shadow-2xl mb-4 select-none w-full max-w-3xl">
          <pre className="whitespace-pre-wrap font-sans text-sm md:text-xl leading-relaxed text-slate-200 mb-2 md:mb-4">
            {currentBlock.instruction}
          </pre>
          
          {/* Block 1: Words - Bashkir (Left), Russian (Right) */}
          {currentBlock.id === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 mt-2 text-left border-t border-slate-600 pt-2 md:pt-4">
              <div className="bg-slate-900/50 p-2 md:p-4 rounded-lg">
                <h3 className="font-bold text-emerald-400 mb-1 md:mb-2 text-center text-sm md:text-lg">Башкирские (E)</h3>
                <div className="flex flex-wrap gap-1 md:gap-2 justify-center">
                  {BASHKIR_WORDS.map(w => (
                    <span key={w} className="px-1.5 py-0.5 md:px-2 md:py-1 bg-emerald-900/40 border border-emerald-500/30 rounded text-[10px] md:text-sm text-emerald-100">{w}</span>
                  ))}
                </div>
              </div>
              <div className="bg-slate-900/50 p-2 md:p-4 rounded-lg">
                <h3 className="font-bold text-blue-400 mb-1 md:mb-2 text-center text-sm md:text-lg">Русские (I)</h3>
                <div className="flex flex-wrap gap-1 md:gap-2 justify-center">
                  {RUSSIAN_WORDS.map(w => (
                    <span key={w} className="px-1.5 py-0.5 md:px-2 md:py-1 bg-blue-900/40 border border-blue-500/30 rounded text-[10px] md:text-sm text-blue-100">{w}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Block 5: Words - Russian (Left), Bashkir (Right) */}
          {currentBlock.id === 5 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 mt-2 text-left border-t border-slate-600 pt-2 md:pt-4">
              <div className="bg-slate-900/50 p-2 md:p-4 rounded-lg">
                <h3 className="font-bold text-emerald-400 mb-1 md:mb-2 text-center text-sm md:text-lg">Русские (E)</h3>
                <div className="flex flex-wrap gap-1 md:gap-2 justify-center">
                  {RUSSIAN_WORDS.map(w => (
                    <span key={w} className="px-1.5 py-0.5 md:px-2 md:py-1 bg-emerald-900/40 border border-emerald-500/30 rounded text-[10px] md:text-sm text-emerald-100">{w}</span>
                  ))}
                </div>
              </div>
              <div className="bg-slate-900/50 p-2 md:p-4 rounded-lg">
                <h3 className="font-bold text-blue-400 mb-1 md:mb-2 text-center text-sm md:text-lg">Башкирские (I)</h3>
                <div className="flex flex-wrap gap-1 md:gap-2 justify-center">
                  {BASHKIR_WORDS.map(w => (
                    <span key={w} className="px-1.5 py-0.5 md:px-2 md:py-1 bg-blue-900/40 border border-blue-500/30 rounded text-[10px] md:text-sm text-blue-100">{w}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Block 2: Images - Horse (Left), Cow (Right) */}
          {currentBlock.id === 2 && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 mt-2 border-t border-slate-600 pt-2 md:pt-4">
                <div className="bg-slate-900/50 p-2 md:p-4 rounded-lg">
                  <h3 className="font-bold text-emerald-400 mb-1 md:mb-2 text-center text-sm md:text-lg">Лошади (E)</h3>
                  <div className="flex justify-center gap-1 md:gap-2 flex-wrap">
                     {HORSE_IMAGES.map((src, i) => (
                       <div key={i} className="flex items-center justify-center bg-slate-800 rounded border border-slate-600 w-10 h-10 md:w-14 md:h-14 overflow-hidden">
                         <img 
                           src={src} 
                           className="w-full h-full object-cover" 
                           alt={`Horse ${i+1}`}
                           onError={handleImageError}
                         />
                       </div>
                     ))}
                  </div>
                </div>
                <div className="bg-slate-900/50 p-2 md:p-4 rounded-lg">
                  <h3 className="font-bold text-blue-400 mb-1 md:mb-2 text-center text-sm md:text-lg">Коровы (I)</h3>
                  <div className="flex justify-center gap-1 md:gap-2 flex-wrap">
                     {COW_IMAGES.map((src, i) => (
                       <div key={i} className="flex items-center justify-center bg-slate-800 rounded border border-slate-600 w-10 h-10 md:w-14 md:h-14 overflow-hidden">
                         <img 
                           src={src} 
                           className="w-full h-full object-cover" 
                           alt={`Cow ${i+1}`}
                           onError={handleImageError}
                         />
                       </div>
                     ))}
                  </div>
                </div>
             </div>
          )}

        </div>
        <div className="animate-pulse text-emerald-400 font-bold text-base md:text-2xl">
          Нажмите на экран или ПРОБЕЛ
        </div>
      </div>
    );
  }

  // Test Screen
  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden select-none">
      {/* Header / Labels */}
      <div className="flex justify-between items-center p-4 md:p-6 h-28 md:h-32 w-full max-w-5xl mx-auto mt-4">
        
        <div className="flex-1 text-left text-lg md:text-2xl font-bold uppercase tracking-wider text-blue-400 leading-tight">
          {currentBlock.leftCategories.map(c => (
             <div key={c}>{c === Category.BASHKIR ? 'Башкиры' : c === Category.RUSSIAN ? 'Русские' : c === Category.HORSE ? 'Лошади' : 'Коровы'}</div>
          ))}
        </div>

        {/* Progress Indicator */}
        <div className="flex flex-col items-center justify-start w-24 pt-1 mx-2">
          <div className="text-slate-500 text-[10px] md:text-xs font-medium uppercase tracking-widest mb-1 whitespace-nowrap">
            Блок {currentBlockIndex + 1}
          </div>
          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
             <div 
               className="h-full bg-emerald-500 transition-all duration-300 ease-out" 
               style={{ width: `${(trialCount / currentBlock.trials) * 100}%` }}
             ></div>
          </div>
        </div>

        <div className="flex-1 text-right text-lg md:text-2xl font-bold uppercase tracking-wider text-blue-400 leading-tight">
          {currentBlock.rightCategories.map(c => (
             <div key={c}>{c === Category.BASHKIR ? 'Башкиры' : c === Category.RUSSIAN ? 'Русские' : c === Category.HORSE ? 'Лошади' : 'Коровы'}</div>
          ))}
        </div>
      </div>

      {/* Stimulus Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative pointer-events-none">
        {mistake && (
          <div className="absolute text-red-500 text-8xl md:text-9xl font-bold animate-bounce opacity-80 z-20">
            X
          </div>
        )}
        
        {currentStimulus?.type === StimulusType.WORD && (
          <div className="text-4xl md:text-7xl font-bold text-white drop-shadow-xl text-center px-4 max-w-4xl leading-tight">
            {currentStimulus.content}
          </div>
        )}

        {currentStimulus?.type === StimulusType.IMAGE && (
          <div className="flex flex-col items-center">
            <img 
              src={currentStimulus.content} 
              alt="stimulus" 
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                console.error("Missing Stimulus Image:", target.src);
              }}
              className="max-h-[25vh] md:max-h-[45vh] w-auto rounded-xl shadow-2xl border-4 border-slate-700 select-none pointer-events-none"
            />
            <div className="hidden">Изображение не найдено</div>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="p-4 pb-8 mb-16 flex xl:hidden gap-4 w-full justify-center items-stretch h-36 z-10">
        <button 
          className="flex-1 max-w-md bg-slate-800/90 backdrop-blur-sm border-2 border-slate-600 hover:border-emerald-500/50 hover:bg-slate-700 active:bg-slate-600 active:scale-95 rounded-2xl flex flex-col items-center justify-center transition-all shadow-lg active:shadow-inner group touch-manipulation"
          onMouseDown={() => handleInput('LEFT')}
          onTouchStart={(e) => { e.preventDefault(); handleInput('LEFT'); }}
        >
          <span className="text-4xl font-extrabold text-emerald-400 mb-2 group-hover:text-emerald-300">E</span>
          <span className="text-xs text-slate-400 uppercase tracking-widest font-bold">Лево</span>
        </button>
        <button 
          className="flex-1 max-w-md bg-slate-800/90 backdrop-blur-sm border-2 border-slate-600 hover:border-blue-500/50 hover:bg-slate-700 active:bg-slate-600 active:scale-95 rounded-2xl flex flex-col items-center justify-center transition-all shadow-lg active:shadow-inner group touch-manipulation"
          onMouseDown={() => handleInput('RIGHT')}
          onTouchStart={(e) => { e.preventDefault(); handleInput('RIGHT'); }}
        >
           <span className="text-4xl font-extrabold text-blue-400 mb-2 group-hover:text-blue-300">I</span>
           <span className="text-xs text-slate-400 uppercase tracking-widest font-bold">Право</span>
        </button>
      </div>
    </div>
  );
};

export default IATTest;
