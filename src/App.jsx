import React, { useState, useEffect } from 'react';
import { Heart, Scissors, Sparkles, RotateCcw } from 'lucide-react';

const App = () => {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [gameStatus, setGameStatus] = useState('playing');
  const [promoCode, setPromoCode] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [winLine, setWinLine] = useState([]);
  const [stats, setStats] = useState({ wins: 0, losses: 0, draws: 0 });
  const [showConfetti, setShowConfetti] = useState(false);
  const [showCopyNotification, setShowCopyNotification] = useState(false);

  const tgDebug = {
    hasTelegram: Boolean(window?.Telegram),
    hasWebApp: Boolean(window?.Telegram?.WebApp),
    initDataLen: window?.Telegram?.WebApp?.initData?.length || 0,
    user: window?.Telegram?.WebApp?.initDataUnsafe?.user || null,
  };

  useEffect(() => {
    const saved = localStorage.getItem('gameStats');
    if (saved) setStats(JSON.parse(saved));
  }, []);

  function getTelegramInitData() {
  return window?.Telegram?.WebApp?.initData || "";
}

async function sendToTelegram(text) {
  const initData = getTelegramInitData();

  const resp = await fetch("/api/telegram", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, initData }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.ok) throw new Error("Telegram send failed");
  return data;
}

  const generatePromoCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const checkWinner = (squares) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];

    for (let line of lines) {
      const [a, b, c] = line;
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return { winner: squares[a], line };
      }
    }
    return null;
  };

  const handleWin = () => {
    const promo = generatePromoCode();
    setPromoCode(promo);
    setGameStatus('won');
    setShowModal(true);
    setShowConfetti(true);
    sendToTelegram(`🎉 Победа! Промокод выдан: ${promo}`);
    
    const newStats = { ...stats, wins: stats.wins + 1 };
    setStats(newStats);
    localStorage.setItem('gameStats', JSON.stringify(newStats));

    setTimeout(() => setShowConfetti(false), 3000);
  };

  const handleLoss = () => {
    setGameStatus('lost');
    setShowModal(true);
    sendToTelegram('😔 Проигрыш');
    
    const newStats = { ...stats, losses: stats.losses + 1 };
    setStats(newStats);
    localStorage.setItem('gameStats', JSON.stringify(newStats));
  };

  const handleDraw = () => {
    setGameStatus('draw');
    setShowModal(true);
    
    const newStats = { ...stats, draws: stats.draws + 1 };
    setStats(newStats);
    localStorage.setItem('gameStats', JSON.stringify(newStats));
  };

  const makeComputerMove = (currentBoard) => {
    const emptyCells = currentBoard
      .map((cell, idx) => (cell === null ? idx : null))
      .filter((idx) => idx !== null);

    if (emptyCells.length === 0) return;

    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];

    // Попытка выиграть
    for (let line of lines) {
      const [a, b, c] = line;
      if (currentBoard[a] === 'scissors' && currentBoard[b] === 'scissors' && !currentBoard[c]) {
        return c;
      }
      if (currentBoard[a] === 'scissors' && currentBoard[c] === 'scissors' && !currentBoard[b]) {
        return b;
      }
      if (currentBoard[b] === 'scissors' && currentBoard[c] === 'scissors' && !currentBoard[a]) {
        return a;
      }
    }

    // Блокировка игрока
    for (let line of lines) {
      const [a, b, c] = line;
      if (currentBoard[a] === 'heart' && currentBoard[b] === 'heart' && !currentBoard[c]) {
        return c;
      }
      if (currentBoard[a] === 'heart' && currentBoard[c] === 'heart' && !currentBoard[b]) {
        return b;
      }
      if (currentBoard[b] === 'heart' && currentBoard[c] === 'heart' && !currentBoard[a]) {
        return a;
      }
    }

    if (currentBoard[4] === null) return 4;
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  };

  const handleCellClick = (index) => {
    if (board[index] || !isPlayerTurn || gameStatus !== 'playing') return;

    const newBoard = [...board];
    newBoard[index] = 'heart';
    setBoard(newBoard);

    const result = checkWinner(newBoard);
    if (result && result.winner === 'heart') {
      setWinLine(result.line);
      setTimeout(() => handleWin(), 500);
      return;
    }

    if (!newBoard.includes(null)) {
      setTimeout(() => handleDraw(), 500);
      return;
    }

    setIsPlayerTurn(false);
    setTimeout(() => {
      const computerMove = makeComputerMove(newBoard);
      if (computerMove !== undefined) {
        newBoard[computerMove] = 'scissors';
        setBoard(newBoard);

        const computerResult = checkWinner(newBoard);
        if (computerResult && computerResult.winner === 'scissors') {
          setWinLine(computerResult.line);
          setTimeout(() => handleLoss(), 500);
          return;
        }

        if (!newBoard.includes(null)) {
          setTimeout(() => handleDraw(), 500);
          return;
        }

        setIsPlayerTurn(true);
      }
    }, 600);
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setIsPlayerTurn(true);
    setGameStatus('playing');
    setShowModal(false);
    setWinLine([]);
  };

  const copyPromoCode = () => {
    navigator.clipboard.writeText(promoCode);
    setShowCopyNotification(true);
    setTimeout(() => setShowCopyNotification(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-rose-100 to-amber-100 flex items-center justify-center p-4">
      {/* Уведомление о копировании */}
      {showCopyNotification && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50 animate-[scale-in_0.3s_ease-out]">
          <div className="bg-gradient-to-r from-emerald-400 to-green-500 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3">
            <div className="text-2xl">✅</div>
            <span className="font-medium text-lg">Промокод скопирован!</span>
          </div>
        </div>
      )}

      {window?.Telegram && (
        <pre className="fixed bottom-2 left-2 z-50 max-w-[90%] bg-black/80 text-green-400 text-xs p-3 rounded-xl overflow-auto">
          {JSON.stringify(tgDebug, null, 2)}
        </pre>
      )}

      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-ping"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random() * 2}s`
              }}
            >
              <Sparkles className="text-pink-400" size={20} />
            </div>
          ))}
        </div>
      )}

      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-rose-600 mb-2 font-serif">
            Сердечки vs Ножницы
          </h1>
          <p className="text-gray-600">Выиграй и получи промокод!</p>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8 mb-6">
          <div className="flex justify-around mb-6 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-500">{stats.wins}</div>
              <div className="text-gray-600">Победы</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-rose-500">{stats.losses}</div>
              <div className="text-gray-600">Поражения</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-500">{stats.draws}</div>
              <div className="text-gray-600">Ничьи</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            {board.map((cell, index) => (
              <button
                key={index}
                onClick={() => handleCellClick(index)}
                disabled={!isPlayerTurn || gameStatus !== 'playing'}
                className={`aspect-square bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl shadow-lg 
                  flex items-center justify-center transition-all duration-300 hover:scale-105 
                  ${winLine.includes(index) ? 'ring-4 ring-amber-400 bg-amber-100' : ''}
                  ${!cell && isPlayerTurn && gameStatus === 'playing' ? 'hover:shadow-xl cursor-pointer' : ''}
                  ${!isPlayerTurn || gameStatus !== 'playing' ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                {cell === 'heart' && (
                  <Heart className="text-rose-500 animate-[scale-in_0.3s_ease-out]" size={48} fill="currentColor" />
                )}
                {cell === 'scissors' && (
                  <Scissors className="text-indigo-500 animate-[scale-in_0.3s_ease-out]" size={48} />
                )}
              </button>
            ))}
          </div>

          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-100 to-rose-100 px-6 py-3 rounded-full">
              {isPlayerTurn && gameStatus === 'playing' ? (
                <>
                  <Heart className="text-rose-500" size={20} fill="currentColor" />
                  <span className="text-gray-700 font-medium">Ваш ход</span>
                </>
              ) : gameStatus === 'playing' ? (
                <>
                  <Scissors className="text-indigo-500" size={20} />
                  <span className="text-gray-700 font-medium">Ход компьютера...</span>
                </>
              ) : (
                <span className="text-gray-700 font-medium">Игра окончена</span>
              )}
            </div>
          </div>

          <button
            onClick={resetGame}
            className="w-full bg-gradient-to-r from-rose-400 to-pink-500 text-white py-3 rounded-full font-medium
              shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2"
          >
            <RotateCcw size={20} />
            Новая игра
          </button>
        </div>

        <div className="text-center text-sm text-gray-600">
          <div className="flex items-center justify-center gap-4">
            <span className="flex items-center gap-1">
              <Heart className="text-rose-500" size={16} fill="currentColor" /> Вы
            </span>
            <span className="flex items-center gap-1">
              <Scissors className="text-indigo-500" size={16} /> Компьютер
            </span>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 animate-[scale-in_0.3s_ease-out]">
            {gameStatus === 'won' && (
              <>
                <div className="text-center mb-6">
                  <div className="text-6xl mb-4">🎉</div>
                  <h2 className="text-3xl font-bold text-rose-600 mb-2">Поздравляем!</h2>
                  <p className="text-gray-600">Вы выиграли!</p>
                </div>
                <div className="bg-gradient-to-r from-amber-100 to-yellow-100 rounded-2xl p-6 mb-6">
                  <p className="text-sm text-gray-600 mb-2 text-center">Ваш промокод на скидку:</p>
                  <div className="text-3xl font-bold text-center text-amber-700 mb-3 tracking-wider">
                    {promoCode}
                  </div>
                  <button
                    onClick={copyPromoCode}
                    className="w-full bg-amber-500 text-white py-2 rounded-full text-sm font-medium
                      hover:bg-amber-600 transition-colors"
                  >
                    Скопировать код
                  </button>
                </div>
              </>
            )}

            {gameStatus === 'lost' && (
              <>
                <div className="text-center mb-6">
                  <div className="text-6xl mb-4">💪</div>
                  <h2 className="text-2xl font-bold text-gray-700 mb-2">Почти получилось!</h2>
                  <p className="text-gray-600">Не сдавайтесь, попробуйте ещё раз!</p>
                </div>
              </>
            )}

            {gameStatus === 'draw' && (
              <>
                <div className="text-center mb-6">
                  <div className="text-6xl mb-4">🤝</div>
                  <h2 className="text-2xl font-bold text-gray-700 mb-2">Ничья!</h2>
                  <p className="text-gray-600">Отличная партия!</p>
                </div>
              </>
            )}

            <button
              onClick={resetGame}
              className="w-full bg-gradient-to-r from-rose-400 to-pink-500 text-white py-3 rounded-full font-medium
                shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              Играть снова
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;