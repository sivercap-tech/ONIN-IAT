import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { STIMULI_POOL, BASHKIR_WORDS, RUSSIAN_WORDS, COW_IMAGES, HORSE_IMAGES, NEXT_TEST_URL } from './constants';
import { Category, StimulusType, UserSession, BlockConfig } from './types';
import { saveResults, recordTransition } from './services/supabaseService';

// Helper to get random item
const getRandom = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];

// Generate blocks based on counterbalancing group
const getBlocks = (group: 'A' | 'B'): BlockConfig[] => {
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

const IATTest = ({ session, onComplete }: { session: UserSession | null, onComplete: () => void }) => {
  // New State: General Instructions before starting blocks
  const [showGeneralIntro, setShowGeneralIntro] = useState(true);

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

  // SAFE ACCESS: Use optional chaining and default fallback to prevent crash if session is null
  const group = session?.group || 'A';
  const blocks = useMemo(() => getBlocks(group), [group]);
  const currentBlock = blocks[currentBlockIndex];

  // Buffer references to avoid closure staleness
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
    if (!session) return; // Guard logic

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
    if (!session) return;

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

    const validCategories = [...block.leftCategories, ...block.rightCategories];
    const pool = STIMULI_POOL.filter(s => validCategories.includes(s.category));
    const nextStim = getRandom(pool);

    setCurrentStimulus(nextStim);
    setMistake(false);
    setStartTime(performance.now());
    setTrialCount(prev => prev + 1);
  }, [currentBlockIndex, results, finishTest]);

  const handleInput = useCallback((action: 'LEFT' | 'RIGHT' | 'SPACE') => {
    const state = stateRef.current;
    if (state.finished || state.isSaving || state.isTransitioning) return;

    if (state.showGeneralIntro) {
      if (action === 'SPACE') {
        setShowGeneralIntro(false);
      }
      return;
    }

    if (state.isInstruction) {
      if (action === 'SPACE') {
        setIsInstruction(false);
        nextTrial();
      }
      return;
    }

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

  // !!! CRITICAL SAFETY CHECK !!!
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-8 text-center">
         <h1 className="text-2xl text-red-400 mb-4">Ошибка сессии</h1>
         <p>Не удалось загрузить данные пользователя. Попробуйте обновить страницу.</p>
         <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-slate-700 rounded hover:bg-slate-600">Обновить</button>
      </div>
    );
  }

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

  // --- MOBILE TEMPLATE ---
  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden select-none">
      
      {/* Mobile Header */}
      <div className="md:hidden flex flex-col w-full bg-slate-900 pt-2 pb-1">
         <div className="w-full h-1 bg-slate-800 mb-2">
             <div 
               className="h-full bg-emerald-500 transition-all duration-300 ease-out" 
               style={{ width: `${(trialCount / currentBlock.trials) * 100}%` }}
             ></div>
         </div>
         
         <div className="flex justify-between items-start px-3">
             <div className="text-left text-sm font-bold uppercase tracking-wider text-blue-400 leading-tight max-w-[45%]">
               {currentBlock.leftCategories.map(c => (
                 <div key={c}>{c === Category.BASHKIR ? 'Башкиры' : c === Category.RUSSIAN ? 'Русские' : c === Category.HORSE ? 'Лошади' : 'Коровы'}</div>
               ))}
             </div>

             <div className="text-slate-600 text-[10px] font-bold uppercase tracking-widest mt-1">
                {currentBlockIndex + 1}/{blocks.length}
             </div>

             <div className="text-right text-sm font-bold uppercase tracking-wider text-blue-400 leading-tight max-w-[45%]">
               {currentBlock.rightCategories.map(c => (
                 <div key={c}>{c === Category.BASHKIR ? 'Башкиры' : c === Category.RUSSIAN ? 'Русские' : c === Category.HORSE ? 'Лошади' : 'Коровы'}</div>
               ))}
             </div>
         </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex justify-between items-center p-4 md:p-6 h-28 md:h-32 w-full max-w-5xl mx-auto mt-4">
        <div className="flex-1 text-left text-lg md:text-2xl font-bold uppercase tracking-wider text-blue-400 leading-tight">
          {currentBlock.leftCategories.map(c => (
             <div key={c}>{c === Category.BASHKIR ? 'Башкиры' : c === Category.RUSSIAN ? 'Русские' : c === Category.HORSE ? 'Лошади' : 'Коровы'}</div>
          ))}
        </div>

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
        
        {/* Intro/Instruction Logic for Display */}
        {showGeneralIntro && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900 p-4 text-center pointer-events-auto overflow-y-auto">
             {/* General Intro Content */}
             <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-2xl mb-8 w-full max-w-4xl cursor-pointer" onClick={() => handleInput('SPACE')}>
                <p className="text-lg md:text-xl text-slate-200 mb-6">
                  Постарайтесь действовать быстро, но без ошибок.<br/>
                  Нажимайте <span className="text-emerald-400 font-bold">'E'</span> (лево) и <span className="text-blue-400 font-bold">'I'</span> (право).<br/>
                  Нажмите ПРОБЕЛ, чтобы начать.
                </p>
                {/* Example Items grid here if needed... */}
             </div>
          </div>
        )}

        {!showGeneralIntro && isInstruction && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-900 p-4 text-center pointer-events-auto" onClick={() => handleInput('SPACE')}>
             <h2 className="text-2xl font-bold mb-4 text-blue-400">{currentBlock.title}</h2>
             <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 max-w-2xl cursor-pointer">
                <pre className="whitespace-pre-wrap font-sans text-xl text-slate-200">{currentBlock.instruction}</pre>
                <div className="mt-4 text-emerald-400 animate-pulse">Нажмите ПРОБЕЛ</div>
             </div>
          </div>
        )}

        {/* Actual Test Stimulus */}
        {!showGeneralIntro && !isInstruction && (
            <>
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
                      onError={handleImageError}
                      className="max-h-[30vh] md:max-h-[45vh] w-auto rounded-xl shadow-2xl border-4 border-slate-700 select-none pointer-events-none"
                    />
                  </div>
                )}
            </>
        )}
      </div>

      {/* Footer Controls */}
      <div className="p-4 pb-8 flex gap-4 md:gap-8 w-full justify-center items-stretch h-36 md:h-48 z-10">
        <button 
          className="flex-1 max-w-md bg-slate-800/90 backdrop-blur-sm border-2 border-slate-600 hover:border-emerald-500/50 hover:bg-slate-700 active:bg-slate-600 active:scale-95 rounded-2xl flex flex-col items-center justify-center transition-all shadow-lg active:shadow-inner group touch-manipulation"
          onMouseDown={() => handleInput('LEFT')}
          onTouchStart={(e) => { e.preventDefault(); handleInput('LEFT'); }}
        >
          <span className="text-4xl md:text-6xl font-extrabold text-emerald-400 mb-2 group-hover:text-emerald-300">E</span>
          <span className="text-xs md:text-sm text-slate-400 uppercase tracking-widest font-bold">Лево</span>
        </button>
        <button 
          className="flex-1 max-w-md bg-slate-800/90 backdrop-blur-sm border-2 border-slate-600 hover:border-blue-500/50 hover:bg-slate-700 active:bg-slate-600 active:scale-95 rounded-2xl flex flex-col items-center justify-center transition-all shadow-lg active:shadow-inner group touch-manipulation"
          onMouseDown={() => handleInput('RIGHT')}
          onTouchStart={(e) => { e.preventDefault(); handleInput('RIGHT'); }}
        >
           <span className="text-4xl md:text-6xl font-extrabold text-blue-400 mb-2 group-hover:text-blue-300">I</span>
           <span className="text-xs md:text-sm text-slate-400 uppercase tracking-widest font-bold">Право</span>
        </button>
      </div>
    </div>
  );
};

export default IATTest;
