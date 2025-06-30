import React, { useEffect, useRef, useState } from 'react';
import { X, ExternalLink, Maximize2, Minimize2, Target, Zap, AlertTriangle, RefreshCw } from 'lucide-react';

interface TradingViewChartProps {
  symbol: string;
  alertPrice?: number;
  alertTime?: number | string;
  alerts?: Alert[];
  onClose: () => void;
  theme?: 'light' | 'dark';
}

interface Alert {
  id: number;
  symbol: string;
  alert_type: string;
  price: number;
  timestamp: number | string;
  close_timestamp?: number | string;
  volume_ratio?: number;
  consecutive_count?: number;
  has_imbalance?: boolean;
  imbalance_data?: {
    type: string;
    direction: 'bullish' | 'bearish';
    top: number;
    bottom: number;
    strength: number;
  };
}

declare global {
  interface Window {
    TradingView: any;
    LightweightCharts: any;
  }
}

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
  const lightweightChartRef = useRef<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [interval, setInterval] = useState('1');
  const [chartType, setChartType] = useState('1');
  const [isLoading, setIsLoading] = useState(true);
  const [showSignals, setShowSignals] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [useAlternative, setUseAlternative] = useState(false);

  useEffect(() => {
    initializeChart();
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (!useAlternative && containerRef.current) {
      createTradingViewWidget();
    }
  }, [symbol, interval, chartType, theme, useAlternative]);

  const cleanup = () => {
    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch (e) {
        console.log('TradingView widget cleanup error:', e);
      }
    }
    if (lightweightChartRef.current) {
      try {
        lightweightChartRef.current.remove();
      } catch (e) {
        console.log('Lightweight chart cleanup error:', e);
      }
    }
  };

  const initializeChart = async () => {
    setIsLoading(true);
    setError(null);

    // Сначала пробуем TradingView
    if (!useAlternative) {
      const tradingViewLoaded = await loadTradingViewScript();
      if (tradingViewLoaded) {
        createTradingViewWidget();
        return;
      }
    }

    // Если TradingView не загрузился, используем Lightweight Charts
    const lightweightLoaded = await loadLightweightChartsScript();
    if (lightweightLoaded) {
      setUseAlternative(true);
      await loadAndCreateLightweightChart();
    } else {
      createFallbackChart();
    }
  };

  const loadTradingViewScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.TradingView) {
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      
      const timeout = setTimeout(() => {
        console.log('TradingView script timeout');
        resolve(false);
      }, 10000);

      script.onload = () => {
        clearTimeout(timeout);
        if (window.TradingView) {
          console.log('TradingView script loaded successfully');
          resolve(true);
        } else {
          resolve(false);
        }
      };
      
      script.onerror = () => {
        clearTimeout(timeout);
        console.log('TradingView script failed to load');
        resolve(false);
      };
      
      document.head.appendChild(script);
    });
  };

  const loadLightweightChartsScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.LightweightCharts) {
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js';
      script.async = true;
      
      const timeout = setTimeout(() => {
        console.log('Lightweight Charts script timeout');
        resolve(false);
      }, 10000);

      script.onload = () => {
        clearTimeout(timeout);
        if (window.LightweightCharts) {
          console.log('Lightweight Charts script loaded successfully');
          resolve(true);
        } else {
          resolve(false);
        }
      };
      
      script.onerror = () => {
        clearTimeout(timeout);
        console.log('Lightweight Charts script failed to load');
        resolve(false);
      };
      
      document.head.appendChild(script);
    });
  };

  const createTradingViewWidget = () => {
    if (!containerRef.current || !window.TradingView) {
      return;
    }

    cleanup();

    const tvSymbol = `BYBIT:${symbol.replace('USDT', '')}USDT.P`;
    const containerId = `tradingview_${symbol}_${Date.now()}`;

    containerRef.current.innerHTML = '';
    containerRef.current.id = containerId;

    try {
      chartRef.current = new window.TradingView.widget({
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
        disabled_features: ['use_localstorage_for_settings', 'volume_force_overlay'],
        enabled_features: ['study_templates', 'create_volume_indicator_by_default'],
        loading_screen: {
          backgroundColor: theme === 'dark' ? '#1e1e1e' : '#ffffff',
          foregroundColor: theme === 'dark' ? '#ffffff' : '#000000'
        }
      });

      chartRef.current.onChartReady(() => {
        console.log('TradingView chart ready');
        setIsLoading(false);
        setError(null);
        setRetryCount(0);
        
        // Добавляем сигналы если есть
        if (showSignals && alerts.length > 0) {
          addSignalsToTradingView();
        }
      });

    } catch (error) {
      console.error('Error creating TradingView widget:', error);
      setUseAlternative(true);
      loadAndCreateLightweightChart();
    }
  };

  const loadAndCreateLightweightChart = async () => {
    try {
      // Загружаем данные для графика
      const response = await fetch(`/api/chart-data/${symbol}?hours=24`);
      if (!response.ok) {
        throw new Error('Failed to load chart data');
      }

      const data = await response.json();
      const chartData = data.chart_data || [];

      if (chartData.length === 0) {
        throw new Error('No chart data available');
      }

      createLightweightChart(chartData);
    } catch (error) {
      console.error('Error loading chart data:', error);
      createFallbackChart();
    }
  };

  const createLightweightChart = (chartData: any[]) => {
    if (!containerRef.current || !window.LightweightCharts) {
      return;
    }

    cleanup();
    containerRef.current.innerHTML = '';

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
          borderColor: '#cccccc',
        },
        timeScale: {
          borderColor: '#cccccc',
          timeVisible: true,
          secondsVisible: false,
        },
      });

      lightweightChartRef.current = chart;

      // Добавляем серию свечей
      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });

      // Добавляем серию объемов
      const volumeSeries = chart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });

      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.7, bottom: 0 },
      });

      // Подготавливаем данные
      const candleData = chartData.map(item => ({
        time: Math.floor(item.timestamp / 1000),
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      }));

      const volumeData = chartData.map(item => ({
        time: Math.floor(item.timestamp / 1000),
        value: item.volume_usdt,
        color: item.is_long ? '#26a69a' : '#ef5350',
      }));

      candlestickSeries.setData(candleData);
      volumeSeries.setData(volumeData);

      // Добавляем маркеры алертов
      if (alertPrice && alertTime) {
        const alertTimestamp = Math.floor((typeof alertTime === 'number' ? alertTime : new Date(alertTime).getTime()) / 1000);
        candlestickSeries.setMarkers([{
          time: alertTimestamp,
          position: 'aboveBar',
          color: '#f68410',
          shape: 'circle',
          text: `Alert: $${alertPrice.toFixed(6)}`,
        }]);
      }

      chart.timeScale().fitContent();

      // Обработка изменения размера
      const resizeObserver = new ResizeObserver(entries => {
        if (entries.length === 0 || entries[0].target !== containerRef.current) return;
        const newRect = entries[0].contentRect;
        chart.applyOptions({ width: newRect.width, height: newRect.height });
      });

      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      setIsLoading(false);
      setError(null);
      console.log('Lightweight chart created successfully');

    } catch (error) {
      console.error('Error creating lightweight chart:', error);
      createFallbackChart();
    }
  };

  const addSignalsToTradingView = () => {
    // Реализация добавления сигналов для TradingView
    // Этот код выполняется только если TradingView успешно загружен
    console.log('Adding signals to TradingView chart');
  };

  const createFallbackChart = () => {
    if (!containerRef.current) return;

    setIsLoading(false);
    setError('Графики временно недоступны');

    containerRef.current.innerHTML = `
      <div style="
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        border: 2px dashed #dee2e6;
        border-radius: 12px;
        padding: 40px;
        text-align: center;
      ">
        <div style="
          background: white;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          max-width: 500px;
        ">
          <div style="
            width: 64px;
            height: 64px;
            background: #ffc107;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            font-size: 24px;
          ">📊</div>
          
          <h3 style="color: #495057; margin-bottom: 16px; font-size: 24px;">График недоступен</h3>
          <p style="color: #6c757d; margin-bottom: 20px; line-height: 1.5;">
            Сервисы графиков временно недоступны.<br>
            Используйте внешнюю ссылку для просмотра.
          </p>
          
          <div style="
            background: #f8f9fa;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #007bff;
          ">
            <div style="margin-bottom: 8px;">
              <strong style="color: #495057;">Символ:</strong> ${symbol}
            </div>
            ${alertPrice ? `
              <div style="margin-bottom: 8px;">
                <strong style="color: #495057;">Цена алерта:</strong> 
                <span style="color: #ffc107; font-weight: bold;">$${alertPrice.toFixed(6)}</span>
              </div>
            ` : ''}
            <div>
              <strong style="color: #495057;">Сигналов программы:</strong> 
              <span style="color: #28a745; font-weight: bold;">${alerts.length}</span>
            </div>
          </div>
          
          <button
            onclick="window.open('${getTradingViewUrl()}', '_blank')"
            style="
              background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 8px;
              cursor: pointer;
              font-size: 16px;
              font-weight: 500;
              transition: transform 0.2s;
              box-shadow: 0 2px 4px rgba(0, 123, 255, 0.3);
            "
            onmouseover="this.style.transform='translateY(-2px)'"
            onmouseout="this.style.transform='translateY(0)'"
          >
            🚀 Открыть в TradingView
          </button>
          
          ${retryCount < 3 ? `
            <button
              onclick="window.location.reload()"
              style="
                background: #28a745;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                margin-left: 10px;
              "
            >
              🔄 Попробовать снова
            </button>
          ` : ''}
        </div>
      </div>
    `;
  };

  const getTradingViewUrl = () => {
    const cleanSymbol = symbol.replace('USDT', '');
    return `https://www.tradingview.com/chart/?symbol=BYBIT:${cleanSymbol}USDT.P&interval=${interval}`;
  };

  const openInTradingView = () => {
    window.open(getTradingViewUrl(), '_blank');
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const retryLoad = () => {
    setError(null);
    setIsLoading(true);
    setRetryCount(prev => prev + 1);
    setUseAlternative(false);
    
    // Очищаем существующие скрипты
    const existingScripts = document.querySelectorAll('script[src*="tradingview"], script[src*="tv.js"], script[src*="lightweight-charts"]');
    existingScripts.forEach(script => script.remove());

    // Очищаем глобальные объекты
    if (window.TradingView) delete window.TradingView;
    if (window.LightweightCharts) delete window.LightweightCharts;

    setTimeout(() => {
      initializeChart();
    }, 1000);
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
            {alerts.length > 0 && (
              <span className="text-sm text-blue-600 bg-blue-100 px-2 py-1 rounded">
                {alerts.length} сигналов
              </span>
            )}
            {error && (
              <span className="text-sm text-red-600 bg-red-100 px-2 py-1 rounded flex items-center">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {useAlternative ? 'Резервный режим' : 'График недоступен'}
              </span>
            )}
            {useAlternative && !error && (
              <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded">
                Lightweight Charts
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {/* Кнопка перезагрузки */}
            {error && (
              <button
                onClick={retryLoad}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors"
                title="Перезагрузить график"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="text-sm">Обновить</span>
              </button>
            )}

            {/* Интервалы - только для TradingView */}
            {!useAlternative && (
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
            )}

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
                  {useAlternative ? 'Загрузка резервного графика...' : 'Загрузка графика TradingView...'}
                </p>
              </div>
            </div>
          )}
          
          <div
            ref={containerRef}
            className="w-full h-full"
          />
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <span>
                {useAlternative ? 'Данные предоставлены Lightweight Charts' : 'Данные предоставлены TradingView'}
              </span>
              {alerts.length > 0 && (
                <span className="flex items-center space-x-1">
                  <Zap className="w-3 h-3" />
                  <span>{alerts.length} сигналов программы</span>
                </span>
              )}
            </div>
            <span>Обновляется в реальном времени</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradingViewChart;