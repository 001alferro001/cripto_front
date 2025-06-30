import React, { useEffect, useRef, useState } from 'react';
import { X, ExternalLink, Maximize2, Minimize2, AlertTriangle, DollarSign, Calculator, TrendingUp, TrendingDown } from 'lucide-react';
import PaperTradingModal from './PaperTradingModal';
import RealTradingModal from './RealTradingModal';

interface TradingViewChartProps {
  symbol: string;
  alertPrice?: number;
  alertTime?: number | string;
  alerts?: any[];
  onClose: () => void;
  theme?: 'light' | 'dark';
}

declare global {
  interface Window {
    LightweightCharts: any;
  }
}

// Глобальное состояние для управления скриптом Lightweight Charts
let lightweightChartsLoaded = false;
let lightweightChartsPromise: Promise<void> | null = null;

const TradingViewChart: React.FC<TradingViewChartProps> = ({ 
  symbol, 
  alertPrice, 
  alertTime,
  alerts = [],
  onClose,
  theme = 'light'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const mountedRef = useRef(true);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [interval, setInterval] = useState('1m');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showPaperTrading, setShowPaperTrading] = useState(false);
  const [showRealTrading, setShowRealTrading] = useState(false);
  const [tradingDirection, setTradingDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    mountedRef.current = true;
    initializeChart();
    
    return () => {
      mountedRef.current = false;
      cleanupChart();
    };
  }, []);

  useEffect(() => {
    if (lightweightChartsLoaded && mountedRef.current) {
      loadChartData();
    }
  }, [symbol, interval]);

  const initializeChart = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await loadLightweightChartsScript();
      
      if (mountedRef.current) {
        await loadChartData();
      }
    } catch (err) {
      if (mountedRef.current) {
        setError('Ошибка загрузки библиотеки графиков');
        setIsLoading(false);
      }
    }
  };

  const loadLightweightChartsScript = (): Promise<void> => {
    // Если библиотека уже загружена
    if (window.LightweightCharts && lightweightChartsLoaded) {
      return Promise.resolve();
    }

    // Если уже есть промис загрузки
    if (lightweightChartsPromise) {
      return lightweightChartsPromise;
    }

    // Создаем новый промис загрузки
    lightweightChartsPromise = new Promise((resolve, reject) => {
      // Проверяем существующий скрипт
      const existingScript = document.querySelector('script[src*="lightweight-charts"]');
      
      if (existingScript) {
        if (window.LightweightCharts) {
          lightweightChartsLoaded = true;
          resolve();
          return;
        }
        
        // Ждем загрузки существующего скрипта
        existingScript.addEventListener('load', () => {
          if (window.LightweightCharts) {
            lightweightChartsLoaded = true;
            resolve();
          } else {
            reject(new Error('LightweightCharts not available after script load'));
          }
        });
        
        existingScript.addEventListener('error', () => {
          lightweightChartsPromise = null;
          reject(new Error('Script loading failed'));
        });
        
        return;
      }

      // Создаем новый скрипт
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js';
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        console.log('Lightweight Charts script loaded successfully');
        if (window.LightweightCharts) {
          lightweightChartsLoaded = true;
          resolve();
        } else {
          reject(new Error('LightweightCharts not available after script load'));
        }
      };
      
      script.onerror = () => {
        console.error('Failed to load Lightweight Charts script');
        lightweightChartsPromise = null;
        reject(new Error('Script loading failed'));
      };
      
      document.head.appendChild(script);
    });

    return lightweightChartsPromise;
  };

  const loadChartData = async () => {
    if (!mountedRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

      // Загружаем данные свечей
      const response = await fetch(`/api/chart-data/${symbol}?interval=${interval}&hours=24`);
      
      if (!response.ok) {
        throw new Error('Ошибка загрузки данных графика');
      }

      const data = await response.json();
      const candleData = data.chart_data || [];
      
      setChartData(candleData);
      
      if (mountedRef.current) {
        createChart(candleData);
      }
    } catch (err) {
      if (mountedRef.current) {
        console.error('Ошибка загрузки данных графика:', err);
        setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
        setIsLoading(false);
      }
    }
  };

  const createChart = (data: any[]) => {
    if (!containerRef.current || !window.LightweightCharts || !mountedRef.current) {
      return;
    }

    // Очищаем предыдущий график
    cleanupChart();

    try {
      const chart = window.LightweightCharts.createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
        layout: {
          background: { color: theme === 'dark' ? '#1e1e1e' : '#ffffff' },
          textColor: theme === 'dark' ? '#ffffff' : '#333333',
        },
        grid: {
          vertLines: { color: theme === 'dark' ? '#2a2a2a' : '#f0f0f0' },
          horzLines: { color: theme === 'dark' ? '#2a2a2a' : '#f0f0f0' },
        },
        crosshair: {
          mode: window.LightweightCharts.CrosshairMode.Normal,
        },
        rightPriceScale: {
          borderColor: theme === 'dark' ? '#485158' : '#cccccc',
        },
        timeScale: {
          borderColor: theme === 'dark' ? '#485158' : '#cccccc',
          timeVisible: true,
          secondsVisible: false,
        },
      });

      chartRef.current = chart;

      // Добавляем серию свечей
      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });

      candlestickSeriesRef.current = candlestickSeries;

      // Добавляем серию объемов
      const volumeSeries = chart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
      });

      volumeSeriesRef.current = volumeSeries;

      // Настраиваем шкалу объемов
      chart.priceScale('volume').applyOptions({
        scaleMargins: {
          top: 0.7,
          bottom: 0,
        },
      });

      // Подготавливаем данные для графика
      if (data && data.length > 0) {
        const candleData = data.map(item => ({
          time: Math.floor(item.timestamp / 1000),
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
        }));

        const volumeData = data.map(item => ({
          time: Math.floor(item.timestamp / 1000),
          value: item.volume_usdt || item.volume,
          color: item.is_long ? '#26a69a' : '#ef5350',
        }));

        candlestickSeries.setData(candleData);
        volumeSeries.setData(volumeData);

        // Добавляем маркеры алертов
        addAlertMarkers(candlestickSeries);

        // Подгоняем график под данные
        chart.timeScale().fitContent();
      }

      // Обработчик изменения размера
      const resizeObserver = new ResizeObserver(entries => {
        if (entries.length === 0 || entries[0].target !== containerRef.current) {
          return;
        }
        
        const newRect = entries[0].contentRect;
        chart.applyOptions({ 
          width: newRect.width, 
          height: newRect.height 
        });
      });

      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      setIsLoading(false);
      setError(null);
      setRetryCount(0);

      console.log('Chart created successfully with', data.length, 'data points');
    } catch (error) {
      console.error('Ошибка создания графика:', error);
      if (mountedRef.current) {
        setError('Ошибка создания графика');
        setIsLoading(false);
      }
    }
  };

  const addAlertMarkers = (series: any) => {
    if (!alertPrice || !series) return;

    const markers = [];

    // Основной маркер алерта
    const alertTimestamp = alertTime 
      ? Math.floor((typeof alertTime === 'number' ? alertTime : new Date(alertTime).getTime()) / 1000)
      : Math.floor(Date.now() / 1000);

    markers.push({
      time: alertTimestamp,
      position: 'aboveBar',
      color: '#f68410',
      shape: 'circle',
      text: `Alert: $${alertPrice.toFixed(6)}`,
    });

    // Добавляем маркеры для связанных алертов
    alerts.forEach((alert, index) => {
      if (alert.symbol === symbol) {
        const time = Math.floor((typeof alert.timestamp === 'number' ? alert.timestamp : new Date(alert.timestamp).getTime()) / 1000);
        markers.push({
          time,
          position: index % 2 === 0 ? 'aboveBar' : 'belowBar',
          color: alert.alert_type === 'volume_spike' ? '#2196f3' : 
                 alert.alert_type === 'consecutive_long' ? '#4caf50' : '#9c27b0',
          shape: 'square',
          text: `${alert.alert_type}: $${alert.price.toFixed(6)}`,
        });
      }
    });

    if (markers.length > 0) {
      series.setMarkers(markers);
    }
  };

  const cleanupChart = () => {
    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch (e) {
        console.log('Chart cleanup error:', e);
      }
      chartRef.current = null;
    }
    
    candlestickSeriesRef.current = null;
    volumeSeriesRef.current = null;
  };

  const openInTradingView = () => {
    const cleanSymbol = symbol.replace('USDT', '');
    const tvInterval = interval === '1m' ? '1' : 
                     interval === '5m' ? '5' : 
                     interval === '15m' ? '15' : 
                     interval === '1h' ? '60' : 
                     interval === '4h' ? '240' : '1D';
    const url = `https://www.tradingview.com/chart/?symbol=BYBIT:${cleanSymbol}USDT.P&interval=${tvInterval}`;
    window.open(url, '_blank');
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const retryLoad = () => {
    setError(null);
    setIsLoading(true);
    setRetryCount(prev => prev + 1);
    
    // Сбрасываем глобальное состояние
    lightweightChartsLoaded = false;
    lightweightChartsPromise = null;

    // Удаляем существующие скрипты
    const existingScripts = document.querySelectorAll('script[src*="lightweight-charts"]');
    existingScripts.forEach(script => script.remove());

    // Очищаем LightweightCharts из window
    if (window.LightweightCharts) {
      delete window.LightweightCharts;
    }

    // Перезагружаем через небольшую задержку
    setTimeout(() => {
      if (mountedRef.current) {
        initializeChart();
      }
    }, 500);
  };

  const openPaperTrading = (direction: 'LONG' | 'SHORT') => {
    setTradingDirection(direction);
    setShowPaperTrading(true);
  };

  const openRealTrading = (direction: 'LONG' | 'SHORT') => {
    setTradingDirection(direction);
    setShowRealTrading(true);
  };

  const intervals = [
    { value: '1m', label: '1м' },
    { value: '5m', label: '5м' },
    { value: '15m', label: '15м' },
    { value: '1h', label: '1ч' },
    { value: '4h', label: '4ч' },
    { value: '1d', label: '1д' }
  ];

  return (
    <>
      <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 ${
        isFullscreen ? 'p-0' : ''
      }`}>
        <div className={`bg-white rounded-lg flex flex-col ${
          isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-[95vw] h-[90vh]'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-bold text-gray-900">{symbol}</h2>
              {alertPrice && (
                <span className="text-sm text-orange-600 bg-orange-100 px-2 py-1 rounded">
                  Alert: ${alertPrice.toFixed(6)}
                </span>
              )}
              {error && (
                <span className="text-sm text-red-600 bg-red-100 px-2 py-1 rounded flex items-center">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  График недоступен
                </span>
              )}
            </div>

            <div className="flex items-center space-x-3">
              {/* Кнопки торговли LONG/SHORT */}
              <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                <span className="text-xs text-gray-600 px-2">Бумажная:</span>
                <button
                  onClick={() => openPaperTrading('LONG')}
                  className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs transition-colors"
                >
                  <TrendingUp className="w-3 h-3" />
                  <span>LONG</span>
                </button>
                <button
                  onClick={() => openPaperTrading('SHORT')}
                  className="flex items-center space-x-1 bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs transition-colors"
                >
                  <TrendingDown className="w-3 h-3" />
                  <span>SHORT</span>
                </button>
              </div>

              <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                <span className="text-xs text-gray-600 px-2">Реальная:</span>
                <button
                  onClick={() => openRealTrading('LONG')}
                  className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs transition-colors"
                >
                  <TrendingUp className="w-3 h-3" />
                  <span>LONG</span>
                </button>
                <button
                  onClick={() => openRealTrading('SHORT')}
                  className="flex items-center space-x-1 bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs transition-colors"
                >
                  <TrendingDown className="w-3 h-3" />
                  <span>SHORT</span>
                </button>
              </div>

              {/* Интервалы */}
              <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                {intervals.map((int) => (
                  <button
                    key={int.value}
                    onClick={() => setInterval(int.value)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      interval === int.value
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {int.label}
                  </button>
                ))}
              </div>

              <button
                onClick={toggleFullscreen}
                className="text-gray-600 hover:text-gray-800 p-2"
                title={isFullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <button
                onClick={openInTradingView}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>TradingView</span>
              </button>

              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Chart Container */}
          <div className="flex-1 relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-600">
                    {!lightweightChartsLoaded ? 'Загрузка Lightweight Charts...' : 'Загрузка данных графика...'}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Попытка {retryCount + 1}
                  </p>
                </div>
              </div>
            )}

            {error && !isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                <div className="text-center max-w-md">
                  <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                  <p className="text-orange-600 mb-4">{error}</p>
                  <div className="space-y-2">
                    <div className="space-x-2">
                      <button
                        onClick={retryLoad}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        Попробовать снова ({retryCount + 1})
                      </button>
                      <button
                        onClick={openInTradingView}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        Открыть в TradingView
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Библиотека загружена: {lightweightChartsLoaded ? 'Да' : 'Нет'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div
              ref={containerRef}
              className="w-full h-full"
              style={{ minHeight: '400px' }}
            />
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center text-sm text-gray-600">
              <span>Данные предоставлены Lightweight Charts</span>
              <div className="flex items-center space-x-4">
                <span>📈 LONG: прибыль при росте</span>
                <span>📉 SHORT: прибыль при падении</span>
                <span>Свечей: {chartData.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Модальные окна торговли */}
      {showPaperTrading && (
        <PaperTradingModal
          symbol={symbol}
          alertPrice={alertPrice || 0}
          alertId={0}
          direction={tradingDirection}
          onClose={() => setShowPaperTrading(false)}
        />
      )}

      {showRealTrading && (
        <RealTradingModal
          symbol={symbol}
          alertPrice={alertPrice || 0}
          alertId={0}
          direction={tradingDirection}
          onClose={() => setShowRealTrading(false)}
        />
      )}
    </>
  );
};

export default TradingViewChart;