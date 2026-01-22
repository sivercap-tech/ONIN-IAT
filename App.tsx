import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import IATTest from './components/IATTest';
import { UserSession } from './types';

// Simple UUID generator
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const Dashboard = ({ startTest }: { startTest: () => void }) => {
  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8 flex items-center justify-center">
      <div className="max-w-4xl w-full grid grid-cols-1 gap-4 md:gap-8">
        
        {/* Header Section */}
        <div className="text-center mb-4 md:mb-8">
          <h1 className="text-3xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-4 md:mb-6 leading-tight drop-shadow-sm">
            Социологический опрос
          </h1>
        </div>

        {/* Start Test Card */}
        <div className="bg-gradient-to-r from-blue-900/40 to-slate-800/40 backdrop-blur-md rounded-2xl p-6 md:p-12 border border-slate-700/50 shadow-2xl flex flex-col items-center justify-center text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 md:mb-6">Добро пожаловать!</h2>
          <p className="text-blue-100 mb-8 md:mb-10 max-w-2xl text-base md:text-xl leading-relaxed opacity-90">
            Итак, вас ждет специальный психологический тест – тест имплицитных ассоциаций. Он обычно используется для того, чтобы выяснить, какие в обществе есть представления о разных вещах, в том числе национальных группах. Он может Вас удивить и немного утомить. Но чтобы все получилось, Вам надо пройти тест до конца и в точности следовать инструкции далее. 
          </p>
          <button 
            onClick={startTest}
            className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white text-lg md:text-xl font-bold py-3 md:py-4 px-8 md:px-12 rounded-full shadow-lg shadow-emerald-500/20 transform hover:scale-105 transition-all active:scale-95 border-t border-emerald-400/20"
          >
            Далее
          </button>
        </div>

      </div>
    </div>
  );
};

const AppContent = () => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [testActive, setTestActive] = useState(false);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const externalId = queryParams.get('external_id');
    const userId = externalId || generateUUID();
    // Initialize Session with Counterbalancing
    const referrer = document.referrer || "direct";
    
    // Random assignment to Group A or B
    const group = Math.random() < 0.5 ? 'A' : 'B';

    const newSession: UserSession = {
      userId,
      referrer,
      startTime: Date.now(),
      group
    };
    setSession(newSession);
    console.log(`User initialized: ${userId}, Group: ${group}`);
  }, []);

  const handleStartTest = () => {
    if (session) {
      setTestActive(true);
    } else {
      console.warn("Session not initialized yet");
    }
  };

  const handleTestComplete = () => {
    setTestActive(false);
  };

  if (testActive && session) {
    return <IATTest session={session} onComplete={handleTestComplete} />;
  }

  return <Dashboard startTest={handleStartTest} />;
};

const App = () => {
  return (
    <HashRouter>
       <Routes>
         <Route path="/" element={<AppContent />} />
       </Routes>
    </HashRouter>
  );
};

export default App;
