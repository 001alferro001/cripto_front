import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Globe, X, Target, AlertCircle, DollarSign, Calculator, AlertTriangle } from 'lucide-react';
import TradingViewChart from './TradingViewChart';
import CoinGeckoChart from './CoinGeckoChart';
import ChartModal from './ChartModal';
import PaperTradingModal from './PaperTradingModal';
import RealTradingModal from './RealTradingModal';

interface Alert {
  id: number;
  symbol: string;
  alert_type: string;
  price: number;
  timestamp: number | string;
  close_timestamp?: number | string;
  preliminary_alert?: Alert;
  has_imbalance?: boolean;
  imbalance_data?: any;
  candle_data?: any;
  order_book_snapshot?: any;
  volume_ratio?: number;
  consecutive_count?: number;
}

interface ChartSelectorProps {
  alert: Alert;
  onClose: () => void;
}

type ChartType = 'tradingview' | 'coingecko' | 'internal' | 'paper_trading' | 'real_trading' | null;

const ChartSelector: React.FC<ChartSelectorProps> = ({ alert, onClose }) => {
  const [selectedChart, setSelectedChart] = useState<ChartType>(null);
  const [relatedAlerts, setRelatedAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoFallback, setAutoFallback] = useState(false);

  useEffect(() => {
    loadRelatedAlerts();
  }, [alert.symbol]);

  // Автоматическое переключение на альтернативы при проблемах с TradingView
  useEffect(() => {
    if (selectedChart === 'tradingview' && autoFallback) {
      console.log('🔄 Автоматическое переключение на CoinGecko из-за проблем с TradingView');
      setSelectedChart('coingecko');
      setAutoFallback(false);
    }
  }, [selectedChart, autoFallback]);

  const loadRelatedAlerts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/alerts/symbol/${alert.symbol}?hours=24`);
      if (response.ok) {
        const data = await response.json();
        setRelatedAlerts(data.alerts || []);
      } else {
        const allResponse = await fetch('/api/alerts/all');
        if (allResponse.ok) {
          const allData = await allResponse.json();

          const allAlerts = [
            ...(allData.volume_alerts || []),
            ...(allData.consecutive_alerts || []),
            ...(allData.priority_alerts || [])
          ];

          const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
          const symbolAlerts = allAlerts.filter((a: Alert) => {
            if (a.symbol !== alert.symbol) return false;

            const alertTime = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
            return alertTime > oneDayAgo;
          });

          symbolAlerts.sort((a: Alert, b: Alert) => {
            const timeA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
            const timeB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
            return timeA - timeB;
          });

          setRelatedAlerts(symbolAlerts);
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки связанных алертов:', error);
      setError('Ошибка загрузки алертов');
    } finally {
      setLoading(false);
    }
  };

  const handleTradingViewError = () => {
    console.warn('⚠️ Проблемы с TradingView, включаем автоматическое переключение');
    setAutoFallback(true);
  };

  if (selectedChart === 'tradingview') {
    return (
      <TradingViewChart
        symbol={alert.symbol}
        alertPrice={alert.price}
        alertTime={alert.close_timestamp || alert.timestamp}
        onClose={() => {
          setSelectedChart(null);
          setAutoFallback(false);
        }}
        onError={handleTradingViewError}
      />
    );
  }

  if (selectedChart === 'coingecko') {
    return (
      <CoinGeckoChart
        symbol={alert.symbol}
        onClose={() => setSelectedChart(null)}
      />
    );
  }

  if (selectedChart === 'internal') {
    return (
      <ChartModal
        alert={alert}
        onClose={() => setSelectedChart(null)}
      />
    );
  }

  if (selectedChart === 'paper_trading') {
    return (
      <PaperTradingModal
        symbol={alert.symbol}
        alertPrice={alert.price}
        alertId={alert.id}
        onClose={() => setSelectedChart(null)}
      />
    );
  }

  if (selectedChart === 'real_trading') {
    return (
      <RealTradingModal
        symbol={alert.symbol}
        alertPrice={alert.price}
        alertId={alert.id}
        onClose={() => setSelectedChart(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Выберите действие</h2>
            <p className="text-gray-600">{alert.symbol} • ${alert.price.toFixed(6)}</p>
            {loading ? (
              <p className="text-sm text-gray-500 mt-1">Загрузка алертов...</p>
            ) : error ? (
              <p className="text-sm text-red-500 mt-1 flex items-center">
                <AlertCircle className="w-3 h-3 mr-1" />
                {error}
              </p>
            ) : relatedAlerts.length > 0 ? (
              <p className="text-sm text-blue-600 mt-1">
                Найдено {relatedAlerts.length} сигналов за 24 часа
              </p>
            ) : (
              <p className="text-sm text-gray-500 mt-1">Нет сигналов за 24 часа</p>
            )}
            {autoFallback && (
              <p className="text-sm text-orange-600 mt-1 flex items-center">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Автоматическое переключение на альтернативы
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Chart Options */}
        <div className="p-6 space-y-4">
          {/* TradingView */}
          <button
            onClick={() => setSelectedChart('tradingview')}
            className="w-full p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-lg font-semibold text-gray-900">TradingView с торговлей</h3>
                <p className="text-gray-600">
                  Профессиональные графики с возможностью торговли
                </p>
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                  <span>✓ Реальное время</span>
                  <span>✓ Бумажная торговля</span>
                  <span>✓ Реальная торговля</span>
                  <span>✓ Автоматический fallback</span>
                  {!loading && relatedAlerts.length > 0 && (
                    <span className="flex items-center space-x-1 text-blue-600">
                      <Target className="w-3 h-3" />
                      <span>{relatedAlerts.length} сигналов</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="text-green-600 font-semibold">Рекомендуется</div>
            </div>
          </button>

          {/* Trading Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Paper Trading */}
            <button
              onClick={() => setSelectedChart('paper_trading')}
              className="p-6 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all group"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200">
                  <Calculator className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-lg font-semibold text-gray-900">Бумажная торговля</h3>
                  <p className="text-gray-600">
                    Калькулятор риска и виртуальные сделки
                  </p>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                    <span>✓ Расчет риска</span>
                    <span>✓ Без риска</span>
                  </div>
                </div>
              </div>
            </button>

            {/* Real Trading */}
            <button
              onClick={() => setSelectedChart('real_trading')}
              className="p-6 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all group"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200">
                  <DollarSign className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-lg font-semibold text-gray-900">Реальная торговля</h3>
                  <p className="text-gray-600">
                    Выполнение реальных сделок через API
                  </p>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                    <span>✓ API Bybit</span>
                    <span>✓ Реальные деньги</span>
                  </div>
                </div>
              </div>
            </button>
          </div>

          {/* Alternative Charts */}
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Альтернативные графики</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* CoinGecko */}
              <button
                onClick={() => setSelectedChart('coingecko')}
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200">
                    <Globe className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-base font-semibold text-gray-900">CoinGecko</h3>
                    <p className="text-sm text-gray-600">
                      Рыночные данные и статистика
                    </p>
                  </div>
                </div>
              </button>

              {/* Internal Chart */}
              <button
                onClick={() => setSelectedChart('internal')}
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-base font-semibold text-gray-900">Внутренний график</h3>
                    <p className="text-sm text-gray-600">
                      График на основе собранных данных
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            <p className="mb-2">
              <strong>🎯 Новые возможности:</strong> Торговля доступна из всех графиков!
            </p>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-green-600">💰 Бумажная торговля</span> - практика без риска
              </div>
              <div>
                <span className="text-purple-600">💸 Реальная торговля</span> - через API Bybit
              </div>
              <div>
                <span className="text-blue-600">📊 Автоматический fallback</span> - при проблемах с графиками
              </div>
            </div>
            {autoFallback && (
              <div className="mt-2 p-2 bg-orange-100 rounded text-orange-700">
                <strong>🔄 Автоматическое переключение:</strong> При проблемах с основными графиками система автоматически переключается на альтернативы
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChartSelector;