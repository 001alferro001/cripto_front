import React, { useState, useEffect } from 'react';
import { X, Calculator, TrendingUp, TrendingDown, DollarSign, Percent, Target, AlertTriangle, Save, BarChart3 } from 'lucide-react';

interface PaperTradingModalProps {
  symbol: string;
  alertPrice: number;
  alertId: number;
  onClose: () => void;
}

interface TradeCalculation {
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  quantity: number;
  riskAmount: number;
  riskPercentage: number;
  potentialLoss: number;
  potentialProfit: number;
  riskRewardRatio: number;
  positionValue: number;
  accountBalance: number;
  direction: 'LONG' | 'SHORT';
}

interface TradingSettings {
  account_balance: number;
  max_risk_per_trade: number;
  default_stop_loss_percentage: number;
  default_take_profit_percentage: number;
}

const PaperTradingModal: React.FC<PaperTradingModalProps> = ({
  symbol,
  alertPrice,
  alertId,
  onClose
}) => {
  // Состояния для калькулятора
  const [calculationMode, setCalculationMode] = useState<'risk_percentage' | 'fixed_amount' | 'fixed_stoploss'>('risk_percentage');
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [entryPrice, setEntryPrice] = useState(alertPrice);
  const [stopLoss, setStopLoss] = useState(0);
  const [takeProfit, setTakeProfit] = useState(0);
  const [quantity, setQuantity] = useState(0);
  const [riskPercentage, setRiskPercentage] = useState(2);
  const [riskAmount, setRiskAmount] = useState(100);
  const [accountBalance, setAccountBalance] = useState(10000);
  
  // Состояния для настроек
  const [settings, setSettings] = useState<TradingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Состояния для результатов расчета
  const [calculation, setCalculation] = useState<TradeCalculation | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (settings) {
      // Инициализируем значения из настроек
      setAccountBalance(settings.account_balance);
      setRiskPercentage(settings.max_risk_per_trade);
      
      // Рассчитываем стоп-лосс и тейк-профит по умолчанию в зависимости от направления
      calculateDefaultLevels();
    }
  }, [settings, entryPrice, direction]);

  useEffect(() => {
    // Автоматический пересчет при изменении любых параметров
    calculateTrade();
  }, [calculationMode, direction, entryPrice, stopLoss, takeProfit, quantity, riskPercentage, riskAmount, accountBalance]);

  const calculateDefaultLevels = () => {
    if (!settings) return;

    if (direction === 'LONG') {
      const defaultStopLoss = entryPrice * (1 - settings.default_stop_loss_percentage / 100);
      const defaultTakeProfit = entryPrice * (1 + settings.default_take_profit_percentage / 100);
      setStopLoss(defaultStopLoss);
      setTakeProfit(defaultTakeProfit);
    } else {
      // SHORT позиция
      const defaultStopLoss = entryPrice * (1 + settings.default_stop_loss_percentage / 100);
      const defaultTakeProfit = entryPrice * (1 - settings.default_take_profit_percentage / 100);
      setStopLoss(defaultStopLoss);
      setTakeProfit(defaultTakeProfit);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.trading || {
          account_balance: 10000,
          max_risk_per_trade: 2,
          default_stop_loss_percentage: 2,
          default_take_profit_percentage: 6
        });
      }
    } catch (error) {
      console.error('Ошибка загрузки настроек:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTrade = () => {
    const newErrors: string[] = [];
    
    // Валидация входных данных
    if (entryPrice <= 0) {
      newErrors.push('Цена входа должна быть больше 0');
    }
    
    if (stopLoss <= 0) {
      newErrors.push('Стоп-лосс должен быть больше 0');
    }
    
    if (takeProfit <= 0) {
      newErrors.push('Тейк-профит должен быть больше 0');
    }
    
    if (accountBalance <= 0) {
      newErrors.push('Баланс аккаунта должен быть больше 0');
    }

    // Валидация в зависимости от направления
    if (direction === 'LONG') {
      if (stopLoss >= entryPrice) {
        newErrors.push('Для LONG: стоп-лосс должен быть меньше цены входа');
      }
      if (takeProfit <= entryPrice) {
        newErrors.push('Для LONG: тейк-профит должен быть больше цены входа');
      }
    } else {
      // SHORT позиция
      if (stopLoss <= entryPrice) {
        newErrors.push('Для SHORT: стоп-лосс должен быть больше цены входа');
      }
      if (takeProfit >= entryPrice) {
        newErrors.push('Для SHORT: тейк-профит должен быть меньше цены входа');
      }
    }

    setErrors(newErrors);

    if (newErrors.length > 0) {
      setCalculation(null);
      return;
    }

    let calculatedQuantity = quantity;
    let calculatedRiskAmount = riskAmount;
    let calculatedRiskPercentage = riskPercentage;

    // Расчет риска на монету в зависимости от направления
    const riskPerCoin = direction === 'LONG' 
      ? entryPrice - stopLoss 
      : stopLoss - entryPrice;

    // Расчет в зависимости от режима
    switch (calculationMode) {
      case 'risk_percentage':
        // Режим: фиксированный процент риска
        calculatedRiskAmount = (accountBalance * riskPercentage) / 100;
        calculatedQuantity = calculatedRiskAmount / riskPerCoin;
        break;

      case 'fixed_amount':
        // Режим: фиксированная сумма риска
        calculatedQuantity = riskAmount / riskPerCoin;
        calculatedRiskPercentage = (riskAmount / accountBalance) * 100;
        break;

      case 'fixed_stoploss':
        // Режим: фиксированный стоп-лосс и процент риска
        calculatedRiskAmount = (accountBalance * riskPercentage) / 100;
        calculatedQuantity = calculatedRiskAmount / riskPerCoin;
        break;
    }

    // Общие расчеты
    const positionValue = calculatedQuantity * entryPrice;
    const potentialLoss = calculatedQuantity * riskPerCoin;
    
    const potentialProfit = direction === 'LONG'
      ? calculatedQuantity * (takeProfit - entryPrice)
      : calculatedQuantity * (entryPrice - takeProfit);
    
    const riskRewardRatio = potentialProfit / potentialLoss;

    const newCalculation: TradeCalculation = {
      entryPrice,
      stopLoss,
      takeProfit,
      quantity: calculatedQuantity,
      riskAmount: calculatedRiskAmount,
      riskPercentage: calculatedRiskPercentage,
      potentialLoss,
      potentialProfit,
      riskRewardRatio,
      positionValue,
      accountBalance,
      direction
    };

    setCalculation(newCalculation);

    // Обновляем состояния для синхронизации
    if (calculationMode === 'risk_percentage') {
      setRiskAmount(calculatedRiskAmount);
      setQuantity(calculatedQuantity);
    } else if (calculationMode === 'fixed_amount') {
      setRiskPercentage(calculatedRiskPercentage);
      setQuantity(calculatedQuantity);
    } else if (calculationMode === 'fixed_stoploss') {
      setRiskAmount(calculatedRiskAmount);
      setQuantity(calculatedQuantity);
    }
  };

  const savePaperTrade = async () => {
    if (!calculation) return;

    setSaving(true);
    try {
      const response = await fetch('/api/paper-trades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol,
          alert_id: alertId,
          direction: calculation.direction,
          entry_price: calculation.entryPrice,
          stop_loss: calculation.stopLoss,
          take_profit: calculation.takeProfit,
          quantity: calculation.quantity,
          risk_amount: calculation.riskAmount,
          risk_percentage: calculation.riskPercentage,
          position_value: calculation.positionValue,
          potential_loss: calculation.potentialLoss,
          potential_profit: calculation.potentialProfit,
          risk_reward_ratio: calculation.riskRewardRatio,
          status: 'planned'
        }),
      });

      if (response.ok) {
        alert('Бумажная сделка сохранена!');
        onClose();
      } else {
        const error = await response.json();
        alert(`Ошибка сохранения: ${error.detail || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      console.error('Ошибка сохранения бумажной сделки:', error);
      alert('Ошибка сохранения сделки');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
            <span className="text-gray-700">Загрузка настроек...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-green-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Калькулятор бумажной торговли</h2>
            <p className="text-gray-600">{symbol} • Цена алерта: ${alertPrice.toFixed(6)}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Левая колонка - Настройки */}
            <div className="space-y-6">
              {/* Направление торговли */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Направление торговли</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setDirection('LONG')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      direction === 'LONG'
                        ? 'border-green-500 bg-green-100 text-green-800'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-green-300'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <TrendingUp className="w-5 h-5" />
                      <span className="font-semibold">LONG</span>
                    </div>
                    <p className="text-xs mt-1">Покупка (рост цены)</p>
                  </button>
                  
                  <button
                    onClick={() => setDirection('SHORT')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      direction === 'SHORT'
                        ? 'border-red-500 bg-red-100 text-red-800'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-red-300'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <TrendingDown className="w-5 h-5" />
                      <span className="font-semibold">SHORT</span>
                    </div>
                    <p className="text-xs mt-1">Продажа (падение цены)</p>
                  </button>
                </div>
              </div>

              {/* Режим расчета */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Режим расчета</h3>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      value="risk_percentage"
                      checked={calculationMode === 'risk_percentage'}
                      onChange={(e) => setCalculationMode(e.target.value as any)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <span className="font-medium">Фиксированный % риска</span>
                      <p className="text-sm text-gray-600">Задаете процент риска, рассчитывается количество</p>
                    </div>
                  </label>
                  
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      value="fixed_amount"
                      checked={calculationMode === 'fixed_amount'}
                      onChange={(e) => setCalculationMode(e.target.value as any)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <span className="font-medium">Фиксированная сумма риска</span>
                      <p className="text-sm text-gray-600">Задаете сумму риска, рассчитывается количество</p>
                    </div>
                  </label>
                  
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      value="fixed_stoploss"
                      checked={calculationMode === 'fixed_stoploss'}
                      onChange={(e) => setCalculationMode(e.target.value as any)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <span className="font-medium">Фиксированный стоп-лосс</span>
                      <p className="text-sm text-gray-600">Задаете стоп-лосс и % риска, рассчитывается количество</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Основные параметры */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Параметры сделки</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Баланс аккаунта ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={accountBalance}
                      onChange={(e) => setAccountBalance(parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Цена входа ($)
                    </label>
                    <input
                      type="number"
                      step="0.00000001"
                      value={entryPrice}
                      onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Стоп-лосс ($)
                      <span className="text-xs text-gray-500 ml-1">
                        ({direction === 'LONG' ? 'должен быть меньше цены входа' : 'должен быть больше цены входа'})
                      </span>
                    </label>
                    <input
                      type="number"
                      step="0.00000001"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Тейк-профит ($)
                      <span className="text-xs text-gray-500 ml-1">
                        ({direction === 'LONG' ? 'должен быть больше цены входа' : 'должен быть меньше цены входа'})
                      </span>
                    </label>
                    <input
                      type="number"
                      step="0.00000001"
                      value={takeProfit}
                      onChange={(e) => setTakeProfit(parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  {/* Условные поля в зависимости от режима */}
                  {calculationMode === 'risk_percentage' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Риск (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="100"
                        value={riskPercentage}
                        onChange={(e) => setRiskPercentage(parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                  )}

                  {calculationMode === 'fixed_amount' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Сумма риска ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={riskAmount}
                        onChange={(e) => setRiskAmount(parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                  )}

                  {calculationMode === 'fixed_stoploss' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Риск (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="100"
                        value={riskPercentage}
                        onChange={(e) => setRiskPercentage(parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Правая колонка - Результаты */}
            <div className="space-y-6">
              {/* Ошибки */}
              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-red-900">Ошибки в расчетах:</h4>
                      <ul className="mt-2 text-sm text-red-700 space-y-1">
                        {errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Результаты расчета */}
              {calculation && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Calculator className="w-5 h-5 mr-2" />
                    Результаты расчета ({calculation.direction})
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-white p-3 rounded border">
                      <div className="text-gray-600">Количество монет</div>
                      <div className="text-lg font-bold text-gray-900">
                        {calculation.quantity.toFixed(8)}
                      </div>
                    </div>
                    
                    <div className="bg-white p-3 rounded border">
                      <div className="text-gray-600">Стоимость позиции</div>
                      <div className="text-lg font-bold text-gray-900">
                        ${calculation.positionValue.toFixed(2)}
                      </div>
                    </div>
                    
                    <div className="bg-white p-3 rounded border">
                      <div className="text-gray-600">Сумма риска</div>
                      <div className="text-lg font-bold text-red-600">
                        ${calculation.riskAmount.toFixed(2)}
                      </div>
                    </div>
                    
                    <div className="bg-white p-3 rounded border">
                      <div className="text-gray-600">Риск (%)</div>
                      <div className="text-lg font-bold text-red-600">
                        {calculation.riskPercentage.toFixed(2)}%
                      </div>
                    </div>
                    
                    <div className="bg-white p-3 rounded border">
                      <div className="text-gray-600">Потенциальный убыток</div>
                      <div className="text-lg font-bold text-red-600">
                        -${calculation.potentialLoss.toFixed(2)}
                      </div>
                    </div>
                    
                    <div className="bg-white p-3 rounded border">
                      <div className="text-gray-600">Потенциальная прибыль</div>
                      <div className="text-lg font-bold text-green-600">
                        +${calculation.potentialProfit.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-blue-100 rounded">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-900 font-medium">Соотношение риск/прибыль:</span>
                      <span className={`text-lg font-bold ${
                        calculation.riskRewardRatio >= 2 ? 'text-green-600' : 
                        calculation.riskRewardRatio >= 1 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        1:{calculation.riskRewardRatio.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-xs text-blue-700 mt-1">
                      {calculation.riskRewardRatio >= 2 ? '✅ Отличное соотношение' :
                       calculation.riskRewardRatio >= 1 ? '⚠️ Приемлемое соотношение' : '❌ Плохое соотношение'}
                    </div>
                  </div>
                </div>
              )}

              {/* Визуализация */}
              {calculation && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Визуализация сделки ({calculation.direction})
                  </h4>
                  
                  <div className="space-y-3">
                    {direction === 'LONG' ? (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-green-600">Тейк-профит:</span>
                          <span className="font-mono">${calculation.takeProfit.toFixed(6)}</span>
                        </div>
                        
                        <div className="h-2 bg-gradient-to-r from-red-200 via-yellow-200 to-green-200 rounded relative">
                          <div 
                            className="absolute w-2 h-4 bg-blue-600 rounded-full transform -translate-x-1 -translate-y-1"
                            style={{
                              left: `${((calculation.entryPrice - calculation.stopLoss) / (calculation.takeProfit - calculation.stopLoss)) * 100}%`
                            }}
                            title="Цена входа"
                          />
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-red-600">Стоп-лосс:</span>
                          <span className="font-mono">${calculation.stopLoss.toFixed(6)}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-red-600">Стоп-лосс:</span>
                          <span className="font-mono">${calculation.stopLoss.toFixed(6)}</span>
                        </div>
                        
                        <div className="h-2 bg-gradient-to-r from-green-200 via-yellow-200 to-red-200 rounded relative">
                          <div 
                            className="absolute w-2 h-4 bg-blue-600 rounded-full transform -translate-x-1 -translate-y-1"
                            style={{
                              left: `${((calculation.stopLoss - calculation.entryPrice) / (calculation.stopLoss - calculation.takeProfit)) * 100}%`
                            }}
                            title="Цена входа"
                          />
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-green-600">Тейк-профит:</span>
                          <span className="font-mono">${calculation.takeProfit.toFixed(6)}</span>
                        </div>
                      </>
                    )}
                    
                    <div className="text-center text-xs text-gray-500 mt-2">
                      <span className="inline-block w-2 h-2 bg-blue-600 rounded-full mr-1"></span>
                      Цена входа: ${calculation.entryPrice.toFixed(6)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              <p>💡 Все расчеты производятся автоматически при изменении параметров</p>
              <p className="text-xs mt-1">
                {direction === 'LONG' ? '📈 LONG: прибыль при росте цены' : '📉 SHORT: прибыль при падении цены'}
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              
              <button
                onClick={savePaperTrade}
                disabled={!calculation || errors.length > 0 || saving}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{saving ? 'Сохранение...' : `Сохранить ${direction} сделку`}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaperTradingModal;