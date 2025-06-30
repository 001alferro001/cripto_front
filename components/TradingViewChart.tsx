import React, { useEffect, useRef, useState } from 'react';
import { X, ExternalLink, Maximize2, Minimize2, AlertTriangle, DollarSign, Calculator, TrendingUp, TrendingDown } from 'lucide-react';
import PaperTradingModal from './PaperTradingModal';
import RealTradingModal from './RealTradingModal';

interface TradingViewChartProps {
  symbol: string;
  alertPrice?: number;
  alertTime?: number | string;
  onClose: () => void;
  theme?: 'light' | 'dark';
}

declare global {
  interface Window {
    TradingView: any;
  }
}

// Глобальное состояние для управления скриптом TradingView
let tradingViewScriptLoaded = false;
let tradingViewScriptPromise: Promise<void> | null = null;
let widgetCounter = 0;

const TradingViewChart: React.FC<TradingViewChartProps> = ({ 
  symbol, 
  alertPrice, 
  alertTime, 
  onClose,
  theme = 'light'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [interval, setInterval] = useState('1');
  const [chartType, setChartType] = useState('1');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showPaperTrading, setShowPaperTrading] = useState(false);
  const [showRealTrading, setShowRealTrading] = useState(false);
  const [tradingDirection, setTradingDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [widgetId] = useState(() => ++widgetCounter);

  useEffect(() => {
    mountedRef.current = true;
    initializeChart();
    
    return () => {
      mountedRef.current = false;
      cleanupWidget();
    };
  }, []);

  useEffect(() => {
    if (tradingViewScriptLoaded && mountedRef.current) {
      createWidget();
    }
  }, [symbol, interval, chartType, theme]);

  const initializeChart = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await loadTradingViewScript();
      
      if (mountedRef.current) {
        createWidget();
      }
    } catch (err) {
      if (mountedRef.current) {
        setError('Ошибка загрузки TradingView');
        setIsLoading(false);
      }
    }
  };

  const loadTradingViewScript = (): Promise<void> => {
    // Если скрипт уже загружен
    if (window.TradingView && tradingViewScriptLoaded) {
      return Promise.resolve();
    }

    // Если уже есть промис загрузки
    if (tradingViewScriptPromise) {
      return tradingViewScriptPromise;
    }

    // Создаем новый промис загрузки
    tradingViewScriptPromise = new Promise((resolve, reject) => {
      // Проверяем существующий скрипт
      const existingScript = document.querySelector('script[src*="tv.js"]');
      
      if (existingScript) {
        if (window.TradingView) {
          tradingViewScriptLoaded = true;
          resolve();
          return;
        }
        
        // Ждем загрузки существующего скрипта
        existingScript.addEventListener('load', () => {
          if (window.TradingView) {
            tradingViewScriptLoaded = true;
            resolve();
          } else {
            reject(new Error('TradingView not available after script load'));
          }
        });
        
        existingScript.addEventListener('error', () => {
          tradingViewScriptPromise = null;
          reject(new Error('Script loading failed'));
        });
        
        return;
      }

      // Создаем новый скрипт
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        console.log('TradingView script loaded successfully');
        if (window.TradingView) {
          tradingViewScriptLoaded = true;
          resolve();
        } else {
          reject(new Error('TradingView not available after script load'));
        }
      };
      
      script.onerror = () => {
        console.error('Failed to load TradingView script');
        tradingViewScriptPromise = null;
        reject(new Error('Script loading failed'));
      };
      
      document.head.appendChild(script);
    });

    return tradingViewScriptPromise;
  };

  const cleanupWidget = () => {
    if (widgetRef.current) {
      try {
        if (typeof widgetRef.current.remove === 'function') {
          widgetRef.current.remove();
        }
      } catch (e) {
        console.log('Widget cleanup error:', e);
      }
      widgetRef.current = null;
    }
    
    // Очищаем контейнер
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
  };

  const createWidget = () => {
    if (!containerRef.current || !window.TradingView || !mountedRef.current) {
      return;
    }

    // Очищаем предыдущий виджет
    cleanupWidget();

    const tvSymbol = `BYBIT:${symbol.replace('USDT', '')}USDT.P`;
    const containerId = `tradingview_${widgetId}_${symbol}_${Date.now()}`;

    // Создаем контейнер для виджета
    const widgetContainer = document.createElement('div');
    widgetContainer.id = containerId;
    widgetContainer.style.width = '100%';
    widgetContainer.style.height = '100%';
    widgetContainer.style.position = 'relative';
    
    containerRef.current.appendChild(widgetContainer);

    try {
      console.log('Creating TradingView widget for:', tvSymbol, 'in container:', containerId);

      const widgetConfig = {
        autosize: true,
        symbol: tvSymbol,
        interval: interval,
        timezone: 'UTC',
        theme: theme,
        style: chartType,
        locale: 'ru',
        toolbar_bg: '#f1f3f6',
        enable_publishing: false,
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: true,
        container_id: containerId,
        studies: ['Volume@tv-basicstudies'],
        overrides: {
          'mainSeriesProperties.candleStyle.upColor': '#26a69a',
          'mainSeriesProperties.candleStyle.downColor': '#ef5350',
          'mainSeriesProperties.candleStyle.borderUpColor': '#26a69a',
          'mainSeriesProperties.candleStyle.borderDownColor': '#ef5350',
          'mainSeriesProperties.candleStyle.wickUpColor': '#26a69a',
          'mainSeriesProperties.candleStyle.wickDownColor': '#ef5350',
          'volumePaneSize': 'medium',
          'paneProperties.background': theme === 'dark' ? '#1e1e1e' : '#ffffff',
          'paneProperties.vertGridProperties.color': theme === 'dark' ? '#2a2a2a' : '#e1e1e1',
          'paneProperties.horzGridProperties.color': theme === 'dark' ? '#2a2a2a' : '#e1e1e1',
        },
        disabled_features: [
          'use_localstorage_for_settings',
          'volume_force_overlay'
        ],
        enabled_features: [
          'study_templates'
        ],
        loading_screen: {
          backgroundColor: theme === 'dark' ? '#1e1e1e' : '#ffffff',
          foregroundColor: theme === 'dark' ? '#ffffff' : '#000000'
        }
      };

      widgetRef.current = new window.TradingView.widget(widgetConfig);

      // Устанавливаем таймаут для обработки случаев, когда onChartReady не вызывается
      const chartReadyTimeout = setTimeout(() => {
        if (mountedRef.current && isLoading) {
          console.warn('Chart ready timeout, assuming chart is loaded');
          setIsLoading(false);
        }
      }, 10000);

      widgetRef.current.onChartReady(() => {
        clearTimeout(chartReadyTimeout);
        
        if (!mountedRef.current) return;

        try {
          console.log('TradingView chart ready');
          
          // Добавляем маркеры алерта
          if (alertPrice && widgetRef.current) {
            const chart = widgetRef.current.chart();

            // Горизонтальная линия алерта
            chart.createShape(
              { time: Date.now() / 1000, price: alertPrice },
              {
                shape: 'horizontal_line',
                lock: true,
                disableSelection: false,
                disableSave: true,
                disableUndo: true,
                overrides: {
                  linecolor: '#ff9800',
                  linewidth: 3,
                  linestyle: 2,
                  showLabel: true,
                  textcolor: '#ff9800',
                  text: `🎯 Alert: $${alertPrice.toFixed(6)}`,
                  horzLabelsAlign: 'right',
                  vertLabelsAlign: 'middle'
                }
              }
            );

            // Вертикальная линия времени алерта
            if (alertTime) {
              const alertTimestamp = typeof alertTime === 'number' ? alertTime : new Date(alertTime).getTime();
              chart.createShape(
                { time: alertTimestamp / 1000, price: alertPrice },
                {
                  shape: 'vertical_line',
                  lock: true,
                  disableSelection: false,
                  disableSave: true,
                  disableUndo: true,
                  overrides: {
                    linecolor: '#ff5722',
                    linewidth: 2,
                    linestyle: 1,
                    showLabel: true,
                    textcolor: '#ff5722',
                    text: '⏰ Alert Time',
                    horzLabelsAlign: 'center',
                    vertLabelsAlign: 'top'
                  }
                }
              );
            }
          }

          setIsLoading(false);
          setError(null);
          setRetryCount(0);
        } catch (error) {
          console.error('Ошибка инициализации графика:', error);
          if (mountedRef.current) {
            setError('Ошибка инициализации графика TradingView');
            setIsLoading(false);
          }
        }
      });

    } catch (error) {
      console.error('Ошибка создания TradingView виджета:', error);
      if (mountedRef.current) {
        setError('Ошибка создания графика TradingView');
        setIsLoading(false);
      }
    }
  };

  const openInTradingView = () => {
    const cleanSymbol = symbol.replace('USDT', '');
    const url = `https://www.tradingview.com/chart/?symbol=BYBIT:${cleanSymbol}USDT.P&interval=${interval}`;
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
    tradingViewScriptLoaded = false;
    tradingViewScriptPromise = null;

    // Удаляем существующие скрипты
    const existingScripts = document.querySelectorAll('script[src*="tv.js"]');
    existingScripts.forEach(script => script.remove());

    // Очищаем TradingView из window
    if (window.TradingView) {
      delete window.TradingView;
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
    { value: '1', label: '1м' },
    { value: '5', label: '5м' },
    { value: '15', label: '15м' },
    { value: '60', label: '1ч' },
    { value: '240', label: '4ч' },
    { value: '1D', label: '1д' }
  ];

  const chartTypes = [
    { value: '1', label: 'Свечи' },
    { value: '0', label: 'Бары' },
    { value: '3', label: 'Линия' },
    { value: '9', label: 'Hollow' }
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

              {/* Типы графиков */}
              <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                {chartTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setChartType(type.value)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      chartType === type.value
                        ? 'bg-green-600 text-white'
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {type.label}
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
                    {!tradingViewScriptLoaded ? 'Загрузка TradingView...' : 'Создание графика...'}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Виджет #{widgetId} • Попытка {retryCount + 1}
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
                      Виджет #{widgetId} • Скрипт загружен: {tradingViewScriptLoaded ? 'Да' : 'Нет'}
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
              <span>Данные предоставлены TradingView</span>
              <div className="flex items-center space-x-4">
                <span>📈 LONG: прибыль при росте</span>
                <span>📉 SHORT: прибыль при падении</span>
                <span>Обновляется в реальном времени</span>
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