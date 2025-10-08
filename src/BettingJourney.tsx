import { useState, useEffect } from 'react';
import { Plus, CheckCircle2, AlertCircle, ArrowRight, Trash2, RefreshCw } from 'lucide-react';
import { CalculationResult, JourneyState, BetEntry } from '../types';

interface BettingJourneyProps {
  result: CalculationResult;
  onClose: () => void;
}

export default function BettingJourney({ result, onClose }: BettingJourneyProps) {
  const getStorageKey = () => {
    return `betting-journey-${result.oddsA}-${result.oddsB}-${result.budget}`;
  };

  const loadFromStorage = (): JourneyState => {
    try {
      const saved = localStorage.getItem(getStorageKey());
      if (saved) return JSON.parse(saved);
    } catch (error) {
      console.error('Failed to load journey from storage:', error);
    }
    return {
      bookA: { entries: [], totalDeposit: 0, totalBonus: 0 },
      bookB: { entries: [], totalDeposit: 0, totalBonus: 0 },
      isComplete: false,
    };
  };

  const [journey, setJourney] = useState<JourneyState>(loadFromStorage);
  const [currentBook, setCurrentBook] = useState<'A' | 'B'>('A');
  const [betAmount, setBetAmount] = useState('');
  const [isBonus, setIsBonus] = useState(false);
  const [fundSource, setFundSource] = useState<'A' | 'B' | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(journey));
    } catch (error) {
      console.error('Failed to save journey to storage:', error);
    }
  }, [journey]);

  const addBet = () => {
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) return;

    const newEntry: BetEntry = {
      id: `${Date.now()}-${Math.random()}`,
      amount,
      isBonus,
      timestamp: Date.now(),
      fundSource: fundSource || currentBook,
    };

    setJourney(prev => {
      const targetBook = currentBook === 'A' ? prev.bookA : prev.bookB;
      const sourceBook = fundSource === 'A' ? prev.bookA : fundSource === 'B' ? prev.bookB : (currentBook === 'A' ? prev.bookA : prev.bookB);

      // Update target book (where bet is placed)
      const updatedTargetBook = {
        entries: [...targetBook.entries, newEntry],
        totalDeposit: isBonus ? targetBook.totalDeposit : targetBook.totalDeposit + amount,
        totalBonus: isBonus ? targetBook.totalBonus + amount : targetBook.totalBonus,
      };

      // Update source book (where funds came from) if different
      let updatedSourceBook = sourceBook;
      if (fundSource && fundSource !== currentBook && !isBonus) {
        updatedSourceBook = {
          ...sourceBook,
          totalDeposit: sourceBook.totalDeposit + amount,
        };
      }

      return {
        ...prev,
        [currentBook === 'A' ? 'bookA' : 'bookB']: updatedTargetBook,
        ...(fundSource && fundSource !== currentBook ? {
          [fundSource === 'A' ? 'bookA' : 'bookB']: updatedSourceBook
        } : {}),
      };
    });

    setBetAmount('');
    setIsBonus(false);
    setFundSource(null);
  };

  const removeBet = (bookKey: 'A' | 'B', betId: string) => {
    setJourney(prev => {
      const book = bookKey === 'A' ? prev.bookA : prev.bookB;
      const bet = book.entries.find(e => e.id === betId);
      if (!bet) return prev;

      const updatedBook = {
        entries: book.entries.filter(e => e.id !== betId),
        totalDeposit: bet.isBonus ? book.totalDeposit : book.totalDeposit - bet.amount,
        totalBonus: bet.isBonus ? book.totalBonus - bet.amount : book.totalBonus,
      };

      // If funds came from different book, update that too
      let updates: any = {
        [bookKey === 'A' ? 'bookA' : 'bookB']: updatedBook,
      };

      if (bet.fundSource && bet.fundSource !== bookKey && !bet.isBonus) {
        const sourceBook = bet.fundSource === 'A' ? prev.bookA : prev.bookB;
        updates[bet.fundSource === 'A' ? 'bookA' : 'bookB'] = {
          ...sourceBook,
          totalDeposit: sourceBook.totalDeposit - bet.amount,
        };
      }

      return {
        ...prev,
        ...updates,
      };
    });
  };

  const getBookProgress = (bookKey: 'A' | 'B') => {
    const book = bookKey === 'A' ? journey.bookA : journey.bookB;
    const targetDeposit = bookKey === 'A' ? result.depositA : result.depositB;
    const targetBonus = bookKey === 'A' ? result.bonusStakeA : result.bonusStakeB;
    const targetTotal = bookKey === 'A' ? result.stakeA : result.stakeB;

    const totalPlaced = book.totalDeposit + book.totalBonus;
    const depositRemaining = Math.max(0, targetDeposit - book.totalDeposit);
    const bonusRemaining = Math.max(0, targetBonus - book.totalBonus);
    const totalRemaining = Math.max(0, targetTotal - totalPlaced);

    const isDepositComplete = book.totalDeposit >= targetDeposit - 1;
    const isBonusComplete = targetBonus === 0 || book.totalBonus >= targetBonus - 1;
    const isComplete = totalPlaced >= targetTotal - 1;

    return {
      totalPlaced,
      depositRemaining,
      bonusRemaining,
      totalRemaining,
      isComplete,
      isDepositComplete,
      isBonusComplete,
    };
  };

  const progressA = getBookProgress('A');
  const progressB = getBookProgress('B');
  const allComplete = progressA.isComplete && progressB.isComplete;

  const getRecommendation = () => {
    if (!progressA.isComplete) {
      if (!progressA.isDepositComplete) {
        return {
          book: 'A',
          type: 'deposit',
          amount: progressA.depositRemaining,
          message: `Place ₹${progressA.depositRemaining.toFixed(0)} deposit on Book A to reach ₹${result.stakeA.toFixed(0)} total`,
        };
      }
      if (!progressA.isBonusComplete && result.bonusStakeA > 0) {
        return {
          book: 'A',
          type: 'bonus',
          amount: progressA.bonusRemaining,
          message: `Use ₹${progressA.bonusRemaining.toFixed(0)} bonus on Book A to reach ₹${result.stakeA.toFixed(0)} total`,
        };
      }
      if (progressA.totalRemaining > 0) {
        return {
          book: 'A',
          type: 'deposit',
          amount: progressA.totalRemaining,
          message: `Add ₹${progressA.totalRemaining.toFixed(0)} more to Book A to reach ₹${result.stakeA.toFixed(0)} total`,
        };
      }
    }

    if (!progressB.isComplete) {
      if (!progressB.isDepositComplete) {
        return {
          book: 'B',
          type: 'deposit',
          amount: progressB.depositRemaining,
          message: `Place ₹${progressB.depositRemaining.toFixed(0)} deposit on Book B to reach ₹${result.stakeB.toFixed(0)} total`,
        };
      }
      if (!progressB.isBonusComplete && result.bonusStakeB > 0) {
        return {
          book: 'B',
          type: 'bonus',
          amount: progressB.bonusRemaining,
          message: `Use ₹${progressB.bonusRemaining.toFixed(0)} bonus on Book B to reach ₹${result.stakeB.toFixed(0)} total`,
        };
      }
      if (progressB.totalRemaining > 0) {
        return {
          book: 'B',
          type: 'deposit',
          amount: progressB.totalRemaining,
          message: `Add ₹${progressB.totalRemaining.toFixed(0)} more to Book B to reach ₹${result.stakeB.toFixed(0)} total`,
        };
      }
    }

    return null;
  };

  const recommendation = getRecommendation();

  const clearJourney = () => {
    if (confirm('Are you sure you want to clear all bet entries? This cannot be undone.')) {
      const freshState = {
        bookA: { entries: [], totalDeposit: 0, totalBonus: 0 },
        bookB: { entries: [], totalDeposit: 0, totalBonus: 0 },
        isComplete: false,
      };
      setJourney(freshState);
      localStorage.removeItem(getStorageKey());
    }
  };

  const totalTargetNeeded = result.stakeA + result.stakeB;
  const totalPlaced =
    journey.bookA.totalDeposit +
    journey.bookB.totalDeposit +
    journey.bookA.totalBonus +
    journey.bookB.totalBonus;
  const totalRemaining = Math.max(0, totalTargetNeeded - totalPlaced);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* HEADER */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-slate-800">Betting Journey</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={clearJourney}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition"
              >
                <RefreshCw className="w-4 h-4" />
                Clear All
              </button>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl">
                ×
              </button>
            </div>
          </div>

          {/* TOTAL PROGRESS */}
          <div className="bg-slate-100 border border-slate-300 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Total Target Progress</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-slate-600 mb-1">Total Target</p>
                <p className="text-lg font-bold text-slate-800">₹{totalTargetNeeded.toFixed(0)}</p>
              </div>
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-slate-600 mb-1">Placed</p>
                <p
                  className={`text-lg font-bold ${
                    totalPlaced >= totalTargetNeeded ? 'text-green-600' : 'text-blue-600'
                  }`}
                >
                  ₹{totalPlaced.toFixed(0)}
                </p>
              </div>
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-slate-600 mb-1">Remaining</p>
                <p className="text-lg font-bold text-orange-600">₹{totalRemaining.toFixed(0)}</p>
              </div>
            </div>
          </div>

          {/* STATUS MESSAGE */}
          {allComplete ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-semibold text-green-900">Strategy Complete!</p>
                <p className="text-sm text-green-700">All bets placed according to plan.</p>
              </div>
            </div>
          ) : recommendation ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
              <ArrowRight className="w-6 h-6 text-blue-600" />
              <div>
                <p className="font-semibold text-blue-900">Next Step</p>
                <p className="text-sm text-blue-700">{recommendation.message}</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* BODY */}
        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* BOOK A */}
            <div
              className={`border-2 rounded-xl p-5 transition ${
                currentBook === 'A' ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">
                  Book A @ {result.oddsA}
                </h3>
                {progressA.isComplete && <CheckCircle2 className="w-6 h-6 text-green-600" />}
              </div>

              <div className="space-y-3 mb-4">
                {/* Deposit progress */}
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-600">Placed:</span>
                    <span
                      className={`font-semibold ${
                        progressA.isDepositComplete ? 'text-green-600' : 'text-slate-800'
                      }`}
                    >
                      ₹{journey.bookA.totalDeposit.toFixed(0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Remaining:</span>
                    <span className="font-semibold text-orange-600">
                      ₹{progressA.depositRemaining.toFixed(0)}
                    </span>
                  </div>
                </div>

                {/* Bonus progress */}
                {result.bonusStakeA > 0 && (
                  <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-600">Used:</span>
                      <span
                        className={`font-semibold ${
                          progressA.isBonusComplete ? 'text-green-600' : 'text-slate-800'
                        }`}
                      >
                        ₹{journey.bookA.totalBonus.toFixed(0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Remaining:</span>
                      <span className="font-semibold text-orange-600">
                        ₹{progressA.bonusRemaining.toFixed(0)}
                      </span>
                    </div>
                  </div>
                )}

                {/* TOTAL target progress */}
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 font-medium">Total Target:</span>
                    <span className="font-bold text-slate-800">
                      ₹{result.stakeA.toFixed(0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Remaining to Target:</span>
                    <span
                      className={`font-semibold ${
                        progressA.totalRemaining > 0 ? 'text-orange-600' : 'text-green-600'
                      }`}
                    >
                      ₹{progressA.totalRemaining.toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* entries */}
              {journey.bookA.entries.length > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-xs font-semibold text-slate-600 mb-2">Bets Placed:</p>
                  {journey.bookA.entries.map(entry => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between text-sm bg-white rounded p-2 border border-slate-200"
                    >
                      <div className="flex flex-col">
                        <span className={entry.isBonus ? 'text-emerald-600' : 'text-slate-800'}>
                          ₹{entry.amount.toFixed(0)} {entry.isBonus ? '(Bonus)' : '(Deposit)'}
                        </span>
                        {entry.fundSource && entry.fundSource !== 'A' && !entry.isBonus && (
                          <span className="text-xs text-amber-600">From Book {entry.fundSource}</span>
                        )}
                      </div>
                      <button
                        onClick={() => removeBet('A', entry.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setCurrentBook('A')}
                className={`w-full py-2 px-4 rounded-lg font-medium transition ${
                  currentBook === 'A'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {currentBook === 'A' ? 'Adding to Book A' : 'Switch to Book A'}
              </button>
            </div>

            {/* BOOK B */}
            <div
              className={`border-2 rounded-xl p-5 transition ${
                currentBook === 'B' ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">
                  Book B @ {result.oddsB}
                </h3>
                {progressB.isComplete && <CheckCircle2 className="w-6 h-6 text-green-600" />}
              </div>

              <div className="space-y-3 mb-4">
                {/* Deposit progress */}
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-600">Placed:</span>
                    <span
                      className={`font-semibold ${
                        progressB.isDepositComplete ? 'text-green-600' : 'text-slate-800'
                      }`}
                    >
                      ₹{journey.bookB.totalDeposit.toFixed(0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Remaining:</span>
                    <span className="font-semibold text-orange-600">
                      ₹{progressB.depositRemaining.toFixed(0)}
                    </span>
                  </div>
                </div>

                {/* Bonus progress */}
                {result.bonusStakeB > 0 && (
                  <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-600">Used:</span>
                      <span
                        className={`font-semibold ${
                          progressB.isBonusComplete ? 'text-green-600' : 'text-slate-800'
                        }`}
                      >
                        ₹{journey.bookB.totalBonus.toFixed(0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Remaining:</span>
                      <span className="font-semibold text-orange-600">
                        ₹{progressB.bonusRemaining.toFixed(0)}
                      </span>
                    </div>
                  </div>
                )}

                {/* TOTAL target progress */}
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 font-medium">Total Target:</span>
                    <span className="font-bold text-slate-800">
                      ₹{result.stakeB.toFixed(0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Remaining to Target:</span>
                    <span
                      className={`font-semibold ${
                        progressB.totalRemaining > 0 ? 'text-orange-600' : 'text-green-600'
                      }`}
                    >
                      ₹{progressB.totalRemaining.toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* entries */}
              {journey.bookB.entries.length > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-xs font-semibold text-slate-600 mb-2">Bets Placed:</p>
                  {journey.bookB.entries.map(entry => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between text-sm bg-white rounded p-2 border border-slate-200"
                    >
                      <div className="flex flex-col">
                        <span className={entry.isBonus ? 'text-emerald-600' : 'text-slate-800'}>
                          ₹{entry.amount.toFixed(0)} {entry.isBonus ? '(Bonus)' : '(Deposit)'}
                        </span>
                        {entry.fundSource && entry.fundSource !== 'B' && !entry.isBonus && (
                          <span className="text-xs text-amber-600">From Book {entry.fundSource}</span>
                        )}
                      </div>
                      <button
                        onClick={() => removeBet('B', entry.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setCurrentBook('B')}
                className={`w-full py-2 px-4 rounded-lg font-medium transition ${
                  currentBook === 'B'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {currentBook === 'B' ? 'Adding to Book B' : 'Switch to Book B'}
              </button>
            </div>
          </div>

          {/* ADD BET FORM */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              Add Bet to Book {currentBook}
            </h3>

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  value={betAmount}
                  onChange={e => setBetAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Bet Type
                </label>
                <select
                  value={isBonus ? 'bonus' : 'deposit'}
                  onChange={e => setIsBonus(e.target.value === 'bonus')}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                >
                  <option value="deposit">Deposit</option>
                  <option value="bonus">Bonus</option>
                </select>
              </div>
            </div>

            {/* Show remaining amount helper */}
            {currentBook === 'A' && progressB.depositRemaining > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <div className="text-sm">
                  <p className="font-medium text-amber-900 mb-1">💡 Tip: Use Book B Remaining Funds</p>
                  <p className="text-amber-700 text-xs mb-2">
                    You have ₹{progressB.depositRemaining.toFixed(0)} remaining in Book B. You can use it here at Book A odds ({result.oddsA}).
                  </p>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      placeholder="Enter amount"
                      className="flex-1 px-2 py-1 text-xs border border-amber-300 rounded focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none"
                      max={progressB.depositRemaining}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const value = (e.target as HTMLInputElement).value;
                          if (value && parseFloat(value) > 0) {
                            setBetAmount(value);
                            setFundSource('B');
                            setIsBonus(false);
                          }
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        setBetAmount(progressB.depositRemaining.toFixed(0));
                        setFundSource('B');
                        setIsBonus(false);
                      }}
                      className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded whitespace-nowrap"
                    >
                      Use All
                    </button>
                  </div>
                </div>
              </div>
            )}

            {currentBook === 'B' && progressA.depositRemaining > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <div className="text-sm">
                  <p className="font-medium text-amber-900 mb-1">💡 Tip: Use Book A Remaining Funds</p>
                  <p className="text-amber-700 text-xs mb-2">
                    You have ₹{progressA.depositRemaining.toFixed(0)} remaining in Book A. You can use it here at Book B odds ({result.oddsB}).
                  </p>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      placeholder="Enter amount"
                      className="flex-1 px-2 py-1 text-xs border border-amber-300 rounded focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none"
                      max={progressA.depositRemaining}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const value = (e.target as HTMLInputElement).value;
                          if (value && parseFloat(value) > 0) {
                            setBetAmount(value);
                            setFundSource('A');
                            setIsBonus(false);
                          }
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        setBetAmount(progressA.depositRemaining.toFixed(0));
                        setFundSource('A');
                        setIsBonus(false);
                      }}
                      className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded whitespace-nowrap"
                    >
                      Use All
                    </button>
                  </div>
                </div>
              </div>
            )}

            {fundSource && fundSource !== currentBook && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-900">Using funds from Book {fundSource}</p>
                  <p className="text-amber-700 text-xs">
                    This bet will be placed on Book {currentBook}, but funds are from Book {fundSource}
                  </p>
                </div>
              </div>
            )}

            {recommendation && recommendation.book === currentBook && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900">Recommendation</p>
                  <p className="text-blue-700">
                    Add ₹{recommendation.amount.toFixed(0)} as {recommendation.type}
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={addBet}
              disabled={!betAmount || parseFloat(betAmount) <= 0}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Bet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
