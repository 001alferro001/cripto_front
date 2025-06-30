import React, { useState, useEffect } from 'react';
import { X, Calculator, TrendingUp, TrendingDown, DollarSign, Percent, Target, AlertTriangle, Save, BarChart3, Shield, Zap } from 'lucide-react';

interface RealTradingModalProps {
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
  leverage: number;
  marginRequired: number;
}

interface TradingSettings {
  account_balance: number;
  max_risk_per_trade: number;
  default_stop_loss_percentage: number;
  default_take_profit_percentage: number;
  api_key?: string;
  api_secret?: string;
  enable_real_trading?: boolean;
  default_leverage?: number;
  default_margin_type?: 'isolated' | 'cross';
  confirm_trades?: boolean;
}

const RealTradingModal: React.FC<RealTradingModalProps> = ({
  symbol,
  alertPrice,
  alertId,
  onClose
}) => {
  // Состояния для калькулятора
  const [calculationMode, setCalculationMode] = useState<'risk_percentage' | 'fixed_amount' | 'fixed_stoploss'>('risk_percentage');
  const [entryPrice, setEntryPrice] = useState(alertPrice);
  const [stopLoss, setStopLoss] = useState(0);
  const [takeProfit, setTakeProfit] = useState(0);
  const [quantity, setQuantity] = useState(0);
  const [riskPercentage, setRiskPercentage] = useState(2);
  const [riskAmount, setRiskAmount] = useState(100);
  const [accountBalance, setAccountBalance] = useState(10000);
  const [leverage, setLeverage] = useState(1);
  const [marginType, setMarginType] = useState<'isolated' | 'cross'>('isolated');
  
  // Состояния для настроек
  const [settings, setSettings] = useState<TradingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  
  // Состояния для результатов расчета
  const [calculation, setCalculation] = useState<TradeCalculation | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (settings) {
      setAccountBalance(settings.account_balance);
      setRiskPercentage(settings.max_risk_per_trade);
      setLeverage(settings.default_leverage || 1);
      setMarginType(settings.default_margin_type || 'isolated');
      
      const defaultStopLoss = entryPrice * (1 - settings.default_stop_loss_percentage / 100);
      const defaultTakeProfit = entryPrice * (1 + settings.default_take_profit_percentage / 100);
      
      setStopLoss(defaultStopLoss);
      setTakeProfit(defaultTakeProfit);

      // Проверяем подключение API
      if (settings.api_key && settings.api_secret) {
        testApiConnection();
      }
    }
  }, [settings, entryPrice]);

  useEffect(() => {
    calculateTrade();
  }, [calculationMode, entryPrice, stopLoss, takeProfit, quantity, riskPercentage, riskAmount, accountBalance, leverage]);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.trading || {
          account_balance: 10000,
          max_risk_per_trade: 2,
          default_stop_loss_percentage: 2,
          default_take_profit_percentage: 6,
          default_leverage: 1,
          default_margin_type: 'isolated',
          confirm_trades: true
        });
      }
    } catch (error) {
      console.error('Ошибка загрузки настроек:', error);
    } finally {
      setLoading(false);
    }
  };

  const testApiConnection = async () => {
    if (!settings?.api_key || !settings?.api_secret) return;

    setTestingApi(true);
    try {
      const response = await fetch('/api/trading/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: settings.api_key,
          api_secret: settings.api_secret
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setApiConnected(true);
        setAccountBalance(data.balance || settings.account_balance);
      } else {
        setApiConnected(false);
      }
    } catch (error) {
      console.error('Ошибка проверки API:', error);
      setApiConnected(false);
    } finally {
      setTestingApi(false);
    }
  };

  const calculateTrade = () => {
    const newErrors: string[] = [];
    
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

    if (stopLoss >= entryPrice) {
      newErrors.push('Стоп-лосс должен быть меньше цены входа');
    }

    if (takeProfit <= entryPrice) {
      newErrors.push('Тейк-профит должен быть больше цены входа');
    }

    if (leverage < 1 || leverage > 100) {
      newErrors.push('Кредитное плечо должно быть от 1 до 100');
    }

    setErrors(newErrors);

    if (newErrors.length > 0) {
      setCalculation(null);
      return;
    }

    let calculatedQuantity = quantity;
    let calculatedRiskAmount = riskAmount;
    let calculatedRiskPercentage = riskPercentage;

    switch (calculationMode) {
      case 'risk_percentage':
        calculatedRiskAmount = (accountBalance * riskPercentage) / 100;
        const riskPerCoin = entryPrice - stopLoss;
        calculatedQuantity = (calculatedRiskAmount * leverage) / riskPerCoin;
        break;

      case 'fixed_amount':
        const riskPerCoinFixed = entryPrice - stopLoss;
        calculatedQuantity = (riskAmount * leverage) / riskPerCoinFixed;
        calculatedRiskPercentage = (riskAmount / accountBalance) * 100;
        break;

      case 'fixed_stoploss':
        calculatedRiskAmount = (accountBalance * riskPercentage) / 100;
        const riskPerCoinStopLoss = entryPrice - stopLoss;
        calculatedQuantity = (calculatedRiskAmount * leverage) / riskPerCoinStopLoss;
        break;
    }

    const positionValue = calculatedQuantity * entryPrice;
    const marginRequired = positionValue / leverage;
    const potentialLoss = calculatedQuantity * (entryPrice - stopLoss);
    const potentialProfit = calculatedQuantity * (takeProfit - entryPrice);
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
      leverage,
      marginRequired
    };

    setCalculation(newCalculation);

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

  const executeRealTrade = async () => {
    if (!calculation || !apiConnected) return;

    if (settings?.confirm_trades && !confirm(`Вы уверены, что хотите открыть реальную сделку?\n\nСимвол: ${symbol}\nКоличество: ${calculation.quantity.toFixed(8)}\nЦена входа: $${calculation.entryPrice.toFixed(6)}\nСтоп-лосс: $${calculation.stopLoss.toFixed(6)}\nТейк-профит: $${calculation.takeProfit.toFixed(6)}\nПлечо: ${leverage}x\nМаржа: $${calculation.marginRequired.toFixed(2)}`)) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/trading/execute-trade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol,
          side: 'BUY', // Всегда покупаем (LONG)
          quantity: calculation.quantity,
          entry_price: calculation.entryPrice,
          stop_loss: calculation.stopLoss,
          take_profit: calculation.takeProfit,
          leverage,
          margin_type: marginType,
          alert_id: alertId,
          risk_amount: calculation.riskAmount,
          risk_percentage: calculation.riskPercentage
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Сделка успешно открыта!\nID ордера: ${result.order_id}\nСтатус: ${result.status}`);
        onClose();
      } else {
        const error = await response.json();
        alert(`Ошибка выполнения сделки: ${error.detail || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      console.error('Ошибка выполнения реальной сделки:', error);
      alert('Ошибка выполнения сделки');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mr-3"></div>
            <span className="text-gray-700">Загрузка настроек...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-purple-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Реальная торговля</h2>
            <p className="text-gray-600">{symbol} • Цена алерта: ${alertPrice.toFixed(6)}</p>
            <div className="flex items-center space-x-4 mt-2">
              <div className={`flex items-center space-x-2 ${apiConnected ? 'text-green-600' : 'text-red-600'}`}>
                <Shield className="w-4 h-4" />
                <span className="text-sm">
                  {testingApi ? 'Проверка API...' : apiConnected ? 'API подключен' : 'API не подключен'}
                </span>
              </div>
              {settings?.enable_real_trading && (
                <div className="flex items-center space-x-2 text-orange-600">
                  <Zap className="w-4 h-4" />
                  <span className="text-sm">Реальная торговля включена</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* API Warning */}
        {!apiConnected && (
          <div className="p-4 bg-red-50 border-b border-red-200">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-900">API не подключен</h4>
                <p className="text-sm text-red-700 mt-1">
                  Для реальной торговли необходимо настроить API ключи в настройках системы.
                  Перейдите в Настройки → Торговля и добавьте ваши API ключи от Bybit.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Левая колонка - Настройки */}
            <div className="space-y-6">
              {/* Режим расчета */}
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Режим расчета</h3>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      value="risk_percentage"
                      checked={calculationMode === 'risk_percentage'}
                      onChange={(e) => setCalculationMode(e.target.value as any)}
                      className="w-4 h-4 text-purple-600"
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
                      className="w-4 h-4 text-purple-600"
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
                      className="w-4 h-4 text-purple-600"
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Баланс аккаунта ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={accountBalance}
                        onChange={(e) => setAccountBalance(parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        disabled={apiConnected}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Кредитное плечо
                      </label>
                      <select
                        value={leverage}
                        onChange={(e) => setLeverage(parseInt(e.target.value))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      >
                        {[1, 2, 3, 5, 10, 20, 25, 50, 75, 100].map(lev => (
                          <option key={lev} value={lev}>{lev}x</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Цена входа ($)
                      </label>
                      <input
                        type="number"
                        step="0.00000001"
                        value={entryPrice}
                        onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Тип маржи
                      </label>
                      <select
                        value={marginType}
                        onChange={(e) => setMarginType(e.target.value as 'isolated' | 'cross')}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="isolated">Изолированная</option>
                        <option value="cross">Кросс</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Стоп-лосс ($)
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
                      </label>
                      <input
                        type="number"
                        step="0.00000001"
                        value={takeProfit}
                        onChange={(e) => setTakeProfit(parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
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
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Calculator className="w-5 h-5 mr-2" />
                    Результаты расчета
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
                      <div className="text-gray-600">Требуемая маржа</div>
                      <div className="text-lg font-bold text-purple-600">
                        ${calculation.marginRequired.toFixed(2)}
                      </div>
                    </div>
                    
                    <div className="bg-white p-3 rounded border">
                      <div className="text-gray-600">Плечо</div>
                      <div className="text-lg font-bold text-blue-600">
                        {calculation.leverage}x
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
                    Визуализация сделки
                  </h4>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-600">Тейк-профит:</span>
                      <span className="font-mono">${calculation.takeProfit.toFixed(6)}</span>
                    </div>
                    
                    <div className="h-2 bg-gradient-to-r from-red-200 via-yellow-200 to-green-200 rounded relative">
                      <div 
                        className="absolute w-2 h-4 bg-purple-600 rounded-full transform -translate-x-1 -translate-y-1"
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
                    
                    <div className="text-center text-xs text-gray-500 mt-2">
                      <span className="inline-block w-2 h-2 bg-purple-600 rounded-full mr-1"></span>
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
              <p>⚠️ Реальная торговля связана с риском потери средств</p>
              <p className="text-xs mt-1">Убедитесь в правильности всех параметров перед выполнением сделки</p>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              
              <button
                onClick={executeRealTrade}
                disabled={!calculation || errors.length > 0 || saving || !apiConnected || !settings?.enable_real_trading}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <DollarSign className="w-4 h-4" />
                )}
                <span>{saving ? 'Выполнение...' : 'Выполнить сделку'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTradingModal;