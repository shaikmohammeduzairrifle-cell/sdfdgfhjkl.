import { useState } from 'react';
import { Calculator, TrendingUp, Info, Map } from 'lucide-react';
import BettingJourney from './BettingJourney';

function App() {
  const [budget, setBudget] = useState(15000);
  const [oddsA, setOddsA] = useState(1.60);
  const [oddsB, setOddsB] = useState(2.35);
  const [bonusPercentA, setBonusPercentA] = useState(0);
  const [bonusPercentB, setBonusPercentB] = useState(20);
  const [minOddsForBonusA, setMinOddsForBonusA] = useState(2.1);
  const [rounding, setRounding] = useState(0);
  const [randomMode, setRandomMode] = useState(false);
  const [depositA, setDepositA] = useState(0);
  const [depositB, setDepositB] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [showJourney, setShowJourney] = useState(false);

  const pickRandomChoice = (arr: number[]) => {
    return arr[Math.floor(Math.random() * arr.length)];
  };

  const calculate = () => {
    const MAX_DEPOSIT_PER_BOOK = 15000;
    const MAX_BONUS = 3000;
    const MAX_TOTAL_DEPOSIT = 30000;

    const bonusA = bonusPercentA / 100;
    const bonusB = bonusPercentB / 100;
    let chosenRounding = rounding;
    let distributedLeftover = true;
    let jitterEnabled = false;

    if (randomMode) {
      chosenRounding = pickRandomChoice([0, 10, 50, 100]);
      distributedLeftover = Math.random() < 0.7;
      jitterEnabled = true;
    }

    // Calculate deposits using the standard arbitrage formula
    let rawDepositA = budget / (1 + (oddsA / oddsB));
    let rawDepositB = budget - rawDepositA;

    let calcDepositA = rawDepositA;
    let calcDepositB = rawDepositB;
    if (chosenRounding > 0) {
      calcDepositA = Math.floor(rawDepositA / chosenRounding) * chosenRounding;
      calcDepositB = Math.floor(rawDepositB / chosenRounding) * chosenRounding;
    }

    // Apply per-book deposit limits
    calcDepositA = Math.min(calcDepositA, MAX_DEPOSIT_PER_BOOK);
    calcDepositB = Math.min(calcDepositB, MAX_DEPOSIT_PER_BOOK);

    let used = calcDepositA + calcDepositB;
    let leftover = Math.max(0, budget - used);

    if (leftover > 0 && distributedLeftover) {
      let ratioA = rawDepositA / budget;
      let ratioB = rawDepositB / budget;

      let addA = leftover * ratioA;
      let addB = leftover * ratioB;

      if (chosenRounding > 0) {
        addA = Math.floor(addA / chosenRounding) * chosenRounding;
        addB = Math.floor(addB / chosenRounding) * chosenRounding;
      }

      // Check limits before adding
      calcDepositA = Math.min(calcDepositA + addA, MAX_DEPOSIT_PER_BOOK);
      calcDepositB = Math.min(calcDepositB + addB, MAX_DEPOSIT_PER_BOOK);

      used = calcDepositA + calcDepositB;
      leftover = Math.max(0, budget - used);
    }

    // Enforce total deposit limit
    if (used > MAX_TOTAL_DEPOSIT) {
      const scale = MAX_TOTAL_DEPOSIT / used;
      calcDepositA = Math.floor(calcDepositA * scale);
      calcDepositB = Math.floor(calcDepositB * scale);
      used = calcDepositA + calcDepositB;
      leftover = budget - used;
    }

    setDepositA(calcDepositA);
    setDepositB(calcDepositB);

    // Calculate bonus amounts based on deposits with maximum limit
    let bonusAmountA = Math.min(calcDepositA * bonusA, MAX_BONUS);
    let bonusAmountB = Math.min(calcDepositB * bonusB, MAX_BONUS);

    // Check if Book A odds meet minimum requirement for bonus
    const canUseBonusOnA = oddsA >= minOddsForBonusA;
    const canUseBonusOnB = oddsB >= minOddsForBonusA;

    let bonusStakeA = 0;
    let bonusStakeB = 0;
    let bonusADivertedToB = 0;

    // Handle Book A bonus
    if (bonusAmountA > 0) {
      if (!canUseBonusOnA && canUseBonusOnB) {
        // Divert Book A bonus to Book B
        bonusADivertedToB = bonusAmountA;
        bonusStakeB += bonusAmountA;
      } else if (canUseBonusOnA) {
        // Use bonus on A normally
        bonusStakeA = bonusAmountA;
      }
    }

    // Add Book B's own bonus
    if (bonusAmountB > 0) {
      bonusStakeB += bonusAmountB;
    }

    // Now we need to redistribute the total capital (deposits + bonuses) to balance payouts
    let totalCapital = calcDepositA + calcDepositB + bonusStakeA + bonusStakeB;

    // Recalculate stakes using total capital to ensure equal returns
    let rebalancedStakeA = totalCapital / (1 + (oddsA / oddsB));
    let rebalancedStakeB = totalCapital - rebalancedStakeA;

    let stakeA = rebalancedStakeA;
    let stakeB = rebalancedStakeB;

    if (chosenRounding > 0) {
      stakeA = Math.floor(stakeA / chosenRounding) * chosenRounding;
      stakeB = Math.floor(stakeB / chosenRounding) * chosenRounding;
    }

    if (jitterEnabled && chosenRounding > 0) {
      let jitterA = Math.floor(Math.random() * Math.min(chosenRounding, Math.max(0, stakeA)));
      let jitterB = Math.floor(Math.random() * Math.min(chosenRounding, Math.max(0, stakeB)));

      stakeA = Math.max(0, stakeA - jitterA);
      stakeB = Math.max(0, stakeB - jitterB);

      let bonusDivisorA = canUseBonusOnA ? (1 + bonusA) : 1;
      let bonusDivisorB = (1 + bonusB + (bonusStakeB / calcDepositB));

      let recoveredCash = (jitterA / bonusDivisorA) + (jitterB / bonusDivisorB);
      leftover += recoveredCash;
      leftover = Math.max(0, Math.min(leftover, budget - (calcDepositA + calcDepositB)));
    }

    let payoutA = stakeA * oddsA;
    let payoutB = stakeB * oddsB;

    let guaranteed = Math.min(payoutA, payoutB);
    let profit = guaranteed - budget;

    let usedCapital = calcDepositA + calcDepositB;
    let profitOnUsed = guaranteed - usedCapital;

    let totalBonus = bonusAmountA + bonusAmountB;

    setResult({
      randomMode,
      chosenRounding,
      distributedLeftover,
      jitterEnabled,
      depositA: calcDepositA,
      depositB: calcDepositB,
      bonusAmountA,
      bonusAmountB,
      bonusStakeA,
      bonusStakeB,
      bonusPercentA,
      bonusPercentB,
      totalBonus,
      leftover,
      stakeA,
      stakeB,
      bonusADivertedToB,
      canUseBonusOnA,
      canUseBonusOnB,
      minOddsForBonusA,
      guaranteed,
      profit,
      profitOnUsed,
      usedCapital,
      budget,
      oddsA,
      oddsB
    });
  };

  const recalculateFromDeposits = () => {
    const MAX_DEPOSIT_PER_BOOK = 15000;
    const MAX_BONUS = 3000;
    const MAX_TOTAL_DEPOSIT = 30000;

    // Validate deposits
    let validatedDepositA = Math.min(depositA, MAX_DEPOSIT_PER_BOOK);
    let validatedDepositB = Math.min(depositB, MAX_DEPOSIT_PER_BOOK);

    // Check total deposit limit
    if (validatedDepositA + validatedDepositB > MAX_TOTAL_DEPOSIT) {
      const scale = MAX_TOTAL_DEPOSIT / (validatedDepositA + validatedDepositB);
      validatedDepositA = Math.floor(validatedDepositA * scale);
      validatedDepositB = Math.floor(validatedDepositB * scale);

      setDepositA(validatedDepositA);
      setDepositB(validatedDepositB);
    }

    const bonusA = bonusPercentA / 100;
    const bonusB = bonusPercentB / 100;

    let bonusAmountA = Math.min(validatedDepositA * bonusA, MAX_BONUS);
    let bonusAmountB = Math.min(validatedDepositB * bonusB, MAX_BONUS);

    const canUseBonusOnA = oddsA >= minOddsForBonusA;
    const canUseBonusOnB = oddsB >= minOddsForBonusA;

    let bonusStakeA = 0;
    let bonusStakeB = 0;
    let bonusADivertedToB = 0;

    if (bonusAmountA > 0) {
      if (!canUseBonusOnA && canUseBonusOnB) {
        bonusADivertedToB = bonusAmountA;
        bonusStakeB += bonusAmountA;
      } else if (canUseBonusOnA) {
        bonusStakeA = bonusAmountA;
      }
    }

    if (bonusAmountB > 0) {
      bonusStakeB += bonusAmountB;
    }

    // Rebalance with total capital to ensure equal returns
    let totalCapital = validatedDepositA + validatedDepositB + bonusStakeA + bonusStakeB;
    let stakeA = totalCapital / (1 + (oddsA / oddsB));
    let stakeB = totalCapital - stakeA;

    let payoutA = stakeA * oddsA;
    let payoutB = stakeB * oddsB;

    let guaranteed = Math.min(payoutA, payoutB);
    let profit = guaranteed - budget;

    let usedCapital = validatedDepositA + validatedDepositB;
    let leftover = Math.max(0, budget - usedCapital);
    let profitOnUsed = guaranteed - usedCapital;

    let totalBonus = bonusAmountA + bonusAmountB;

    setResult({
      randomMode: false,
      chosenRounding: 0,
      distributedLeftover: false,
      jitterEnabled: false,
      depositA: validatedDepositA,
      depositB: validatedDepositB,
      bonusAmountA,
      bonusAmountB,
      bonusStakeA,
      bonusStakeB,
      bonusPercentA,
      bonusPercentB,
      totalBonus,
      leftover,
      stakeA,
      stakeB,
      bonusADivertedToB,
      canUseBonusOnA,
      canUseBonusOnB,
      minOddsForBonusA,
      guaranteed,
      profit,
      profitOnUsed,
      usedCapital,
      budget,
      oddsA,
      oddsB
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Calculator className="w-10 h-10 text-emerald-600" />
            <h1 className="text-4xl font-bold text-slate-800">Arbitrage Calculator</h1>
          </div>
          <p className="text-slate-600">Calculate guaranteed profits with deposit bonuses</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <h2 className="text-xl font-semibold text-slate-800 mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              Input Parameters
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Cash Budget (₹)
                </label>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-amber-900 mb-2">Deposit Limits</h3>
                <div className="text-xs text-slate-600 space-y-1">
                  <p>• Maximum per book: ₹15,000</p>
                  <p>• Maximum total deposit: ₹30,000</p>
                  <p>• Maximum bonus: ₹3,000</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Odds Book A
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={oddsA}
                    onChange={(e) => setOddsA(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Odds Book B
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={oddsB}
                    onChange={(e) => setOddsB(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Bonus Book A (%)
                  </label>
                  <input
                    type="number"
                    value={bonusPercentA}
                    onChange={(e) => setBonusPercentA(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Bonus Book B (%)
                  </label>
                  <input
                    type="number"
                    value={bonusPercentB}
                    onChange={(e) => setBonusPercentB(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Minimum Odds for Bonus A
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={minOddsForBonusA}
                  onChange={(e) => setMinOddsForBonusA(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
                <p className="text-xs text-slate-500 mt-2">
                  If Book A odds are below this value, the bonus will be used on Book B instead
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Safe Mode (Round Down)
                </label>
                <select
                  value={rounding}
                  onChange={(e) => setRounding(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition bg-white"
                >
                  <option value="0">None</option>
                  <option value="10">Nearest 10</option>
                  <option value="50">Nearest 50</option>
                  <option value="100">Nearest 100</option>
                </select>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={randomMode}
                    onChange={(e) => setRandomMode(e.target.checked)}
                    className="mt-1 w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700">
                      Enable Random Safe Mode
                    </span>
                    <p className="text-xs text-slate-500 mt-1">
                      Varies rounding, leftover handling, and adds jitter for human-like behavior
                    </p>
                  </div>
                </label>
              </div>

              <button
                onClick={calculate}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition shadow-sm hover:shadow-md"
              >
                Calculate Arbitrage
              </button>

              {result && (
                <button
                  onClick={() => setShowJourney(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                >
                  <Map className="w-5 h-5" />
                  Start Betting Journey
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            {result ? (
              <div>
                <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Info className="w-5 h-5 text-emerald-600" />
                  Results
                </h2>

                <div className="space-y-4">
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Mode Settings</h3>
                    <div className="text-sm text-slate-600 space-y-1">
                      <p><span className="font-medium">Random Safe Mode:</span> {result.randomMode ? 'ON' : 'OFF'}</p>
                      <p><span className="font-medium">Rounding Step:</span> {result.chosenRounding === 0 ? 'None' : `₹${result.chosenRounding}`}</p>
                      {result.randomMode && (
                        <>
                          <p><span className="font-medium">Leftover Distributed:</span> {result.distributedLeftover ? 'Yes' : 'No'}</p>
                          <p><span className="font-medium">Jitter Applied:</span> {result.jitterEnabled ? 'Yes' : 'No'}</p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                    <h3 className="text-sm font-semibold text-emerald-900 mb-3">Deposits & Bonuses</h3>
                    <div className="space-y-3 text-sm">
                      <div>
                        <label className="block text-slate-600 mb-1">Deposit Book A:</label>
                        <input
                          type="number"
                          value={depositA}
                          onChange={(e) => {
                            setDepositA(Number(e.target.value));
                          }}
                          onBlur={recalculateFromDeposits}
                          className="w-full px-3 py-1.5 border border-emerald-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-800 font-semibold"
                        />
                      </div>
                      <div className="flex justify-between pl-4">
                        <span className="text-slate-600">Bonus Book A ({result.bonusPercentA}%):</span>
                        <span className="font-semibold text-emerald-600">₹{result.bonusAmountA.toFixed(0)}</span>
                      </div>
                      {result.bonusADivertedToB > 0 && (
                        <div className="pl-4 text-xs text-amber-600">
                          ⚠ Bonus diverted to Book B (odds restriction)
                        </div>
                      )}
                      <div>
                        <label className="block text-slate-600 mb-1">Deposit Book B:</label>
                        <input
                          type="number"
                          value={depositB}
                          onChange={(e) => {
                            setDepositB(Number(e.target.value));
                          }}
                          onBlur={recalculateFromDeposits}
                          className="w-full px-3 py-1.5 border border-emerald-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition text-slate-800 font-semibold"
                        />
                      </div>
                      <div className="flex justify-between pl-4">
                        <span className="text-slate-600">Bonus Book B ({result.bonusPercentB}%):</span>
                        <span className="font-semibold text-emerald-600">₹{result.bonusAmountB.toFixed(0)}</span>
                      </div>
                      <div className="pt-2 border-t border-emerald-200">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-600">Bonus Stake on A:</span>
                          <span className="font-semibold text-emerald-700">₹{result.bonusStakeA.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between text-xs mb-2">
                          <span className="text-slate-600">Bonus Stake on B:</span>
                          <span className="font-semibold text-emerald-700">₹{result.bonusStakeB.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Total Deposit:</span>
                          <span className="font-semibold text-slate-800">₹{(result.depositA + result.depositB).toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Total Bonus:</span>
                          <span className="font-semibold text-emerald-600">₹{result.totalBonus.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Unused Balance:</span>
                          <span className="font-semibold text-slate-800">₹{result.leftover.toFixed(0)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h3 className="text-sm font-semibold text-blue-900 mb-3">Betting Strategy</h3>
                    <div className="space-y-3 text-sm">
                      <div>
                        <div className="flex justify-between font-semibold">
                          <span className="text-slate-700">Total Stake on A:</span>
                          <span className="text-slate-800">₹{result.stakeA.toFixed(0)} @ {result.oddsA}</span>
                        </div>
                        <div className="pl-4 text-xs text-slate-600 mt-1">
                          <div>Main: ₹{result.depositA.toFixed(0)}</div>
                          <div>Bonus: ₹{result.bonusStakeA.toFixed(0)}</div>
                        </div>
                        {!result.canUseBonusOnA && result.bonusAmountA > 0 && (
                          <div className="pl-4 text-xs text-amber-600 mt-1">
                            ⚠ Bonus not used here (odds {result.oddsA} &lt; {result.minOddsForBonusA})
                          </div>
                        )}
                        <div className="pl-4 text-xs text-blue-700 mt-1">
                          Return if wins: ₹{(result.stakeA * result.oddsA).toFixed(0)}
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between font-semibold">
                          <span className="text-slate-700">Total Stake on B:</span>
                          <span className="text-slate-800">₹{result.stakeB.toFixed(0)} @ {result.oddsB}</span>
                        </div>
                        <div className="pl-4 text-xs text-slate-600 mt-1">
                          <div>Main: ₹{result.depositB.toFixed(0)}</div>
                          <div>Bonus: ₹{result.bonusStakeB.toFixed(0)}</div>
                          {result.bonusADivertedToB > 0 && (
                            <div className="text-blue-600 mt-0.5">
                              (includes ₹{result.bonusADivertedToB.toFixed(0)} from Book A)
                            </div>
                          )}
                        </div>
                        <div className="pl-4 text-xs text-blue-700 mt-1">
                          Return if wins: ₹{(result.stakeB * result.oddsB).toFixed(0)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg p-5 text-white shadow-md">
                    <h3 className="text-sm font-semibold mb-3 opacity-90">Calculate Returns</h3>
                    <div className="space-y-3 text-sm">
                      <div>
                        <div className="text-emerald-50 font-medium mb-1">If A wins:</div>
                        <div className="pl-3 font-mono text-xs">
                          ₹{result.stakeA.toFixed(2)} × {result.oddsA} = ₹{(result.stakeA * result.oddsA).toFixed(2)}
                        </div>
                      </div>

                      <div>
                        <div className="text-emerald-50 font-medium mb-1">If B wins:</div>
                        <div className="pl-3 font-mono text-xs">
                          ₹{result.stakeB.toFixed(2)} × {result.oddsB} = ₹{(result.stakeB * result.oddsB).toFixed(2)}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-emerald-400">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">🔹</span>
                          <span className="text-emerald-50 font-medium">Guaranteed return ≈</span>
                          <span className="font-bold text-lg">₹{result.guaranteed.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-emerald-400">
                        <div className="text-emerald-50 font-medium mb-2">Profit vs your own deposit (₹{result.usedCapital.toFixed(0)})</div>
                        <div className="pl-3 font-mono text-xs mb-2">
                          {result.guaranteed.toFixed(2)} − {result.usedCapital.toFixed(2)} = ₹{result.profitOnUsed.toFixed(2)}
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                          <div className="flex-1">
                            <div className="flex items-center gap-1">
                              <span className="text-lg">✅</span>
                              <span className="font-semibold">Guaranteed Profit:</span>
                            </div>
                            <div className="text-xl font-bold mt-1">₹{result.profitOnUsed.toFixed(2)}</div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-1">
                              <span className="text-lg">✅</span>
                              <span className="font-semibold">Risk-Free ROI:</span>
                            </div>
                            <div className="text-xl font-bold mt-1">≈ {(result.profitOnUsed / result.usedCapital * 100).toFixed(1)}%</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center p-8">
                <div>
                  <Calculator className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 text-lg">Enter your parameters and click Calculate</p>
                  <p className="text-slate-400 text-sm mt-2">Results will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {showJourney && result && (
          <BettingJourney
            result={result}
            onClose={() => setShowJourney(false)}
          />
        )}
      </div>
    </div>
  );
}

export default App;
