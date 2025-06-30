import React, { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, Download, BookOpen, Info, Calculator, DollarSign, Clock, AlertTriangle, Target } from 'lucide-react';
import OrderBookModal from './OrderBookModal';
import TimeZoneToggle from './TimeZoneToggle';
import PaperTradingModal from './PaperTradingModal';
import RealTradingModal from './RealTradingModal';
import { useTimeZone } from '../contexts/TimeZoneContext';
import { formatTime } from '../utils/timeUtils';

interface Alert {
  id: number;
  symbol: string;
  alert_type: string;
  price: number;
  timestamp: number | string;
  close_timestamp?: number | string;
  preliminary_alert?: Alert;
  has_imbalance?: boolean;
  imbalance_data?: {
    type: 'fair_value_gap' | 'order_block' | 'breaker_block';
    strength: number;
    direction: 'bullish' | 'bearish';
    top: number;
    bottom: number;
    timestamp: number;
  };
  candle_data?: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    alert_level?: number;
  };
  order_book_snapshot?: {
    bids: Array<[number, number]>;
    asks: Array<[number, number]>;
    timestamp: number | string;
  };
}

interface ChartData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  volume_usdt: number;
  is_long: boolean;
}

interface ChartModalProps {
  alert: Alert;
  onClose: () => void;
}

declare global {
  interface Window {
    LightweightCharts: any;
  }
}

// Кэш для загруженного скрипта
let chartScriptLoaded = false;
let chartScriptPromise: Promise<void> | null = null;

const ChartModal: React.FC<ChartModalProps> = ({ alert, onClose }) => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOrderBook, setShowOrderBook] = useState(false);
  const [showTimestampInfo, setShowTimestampInfo] = useState(false);
  const [showPaperTrading, setShowPaperTrading] = useState(false);
  const [showRealTrading, setShowRealTrading] = useState(false);
  const [chartReady, setChartReady] = useState(false);
  const [dataSource, setDataSource] = useState<'database' | 'mock'>('database');
  const [alertVisible, setAlertVisible] = useState(true);
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  
  const { timeZone } = useTimeZone();

  useEffect(() => {
    // Параллельная загрузка скрипта и данных
    Promise.all([
      loadLightweightChartsScript(),
      loadChartDataFromDatabase()
    ]).catch(console.error);
    
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (chartReady && chartData.length > 0) {
      createChart();
    }
  }, [chartReady, chartData]);

  const loadChartDataFromDatabase = async () => {
    try {
      setLoading(true);
      setError(null);

      // Загружаем все доступные данные для данного символа из базы данных
      const response = await fetch(`/api/chart-data/${alert.symbol}/database`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const candleData = data.chart_data || data.data || data || [];
        
        if (candleData.length > 0) {
          setChartData(candleData);
          setDataSource('database');
          
          // Проверяем, виден ли сигнал на графике
          const alertTimestamp = typeof alert.timestamp === 'number' 
            ? alert.timestamp 
            : new Date(alert.timestamp).getTime();
          
          const alertCloseTimestamp = alert.close_timestamp 
            ? (typeof alert.close_timestamp === 'number' 
                ? alert.close_timestamp 
                : new Date(alert.close_timestamp).getTime())
            : alertTimestamp;

          // Находим временные границы данных
          const dataStartTime = Math.min(...candleData.map(d => d.timestamp));
          const dataEndTime = Math.max(...candleData.map(d => d.timestamp));
          
          // Проверяем, попадает ли сигнал в диапазон данных
          const signalInRange = alertCloseTimestamp >= dataStartTime && alertCloseTimestamp <= dataEndTime;
          setAlertVisible(signalInRange);
          
          console.log(`📊 Загружено ${candleData.length} свечей из базы данных для ${alert.symbol}`);
          console.log(`🎯 Сигнал ${signalInRange ? 'виден' : 'не виден'} на графике`);
          console.log(`📅 Диапазон данных: ${new Date(dataStartTime).toISOString()} - ${new Date(dataEndTime).toISOString()}`);
          console.log(`🚨 Время сигнала: ${new Date(alertCloseTimestamp).toISOString()}`);
        } else {
          // Если нет данных в базе, генерируем mock данные
          console.warn('Нет данных в базе, используем mock данные');
          const mockData = generateMockData();
          setChartData(mockData);
          setDataSource('mock');
          setAlertVisible(true);
        }
      } else {
        throw new Error(`API вернул статус ${response.status}`);
      }
    } catch (error) {
      console.error('Ошибка загрузки данных из базы:', error);
      // В случае ошибки используем mock данные
      const mockData = generateMockData();
      setChartData(mockData);
      setDataSource('mock');
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const generateMockData = () => {
    const alertTimestamp = typeof alert.timestamp === 'number' 
      ? alert.timestamp 
      : new Date(alert.timestamp).getTime();
    
    const alertCloseTimestamp = alert.close_timestamp 
      ? (typeof alert.close_timestamp === 'number' 
          ? alert.close_timestamp 
          : new Date(alert.close_timestamp).getTime())
      : alertTimestamp;

    const data = [];
    let price = alert.price || 50000;
    
    // Генерируем 120 свечей: 60 до сигнала и 60 после
    const signalCandleIndex = 60;
    const startTime = alertCloseTimestamp - (signalCandleIndex * 60 * 1000);
    
    for (let i = 0; i < 120; i++) {
      const timestamp = startTime + (i * 60 * 1000);
      
      // Если это свеча сигнала, используем точную цену
      if (i === signalCandleIndex) {
        const open = price;
        const close = alert.price;
        const high = Math.max(open, close) + Math.abs(close - open) * 0.1;
        const low = Math.min(open, close) - Math.abs(close - open) * 0.1;
        const volume = Math.random() * 2000000; // Увеличенный объем для сигнала
        
        data.push({
          timestamp,
          open,
          high,
          low,
          close,
          volume,
          volume_usdt: volume * close,
          is_long: close > open
        });
        
        price = close;
      } else {
        // Обычные свечи с небольшими изменениями
        const change = (Math.random() - 0.5) * price * 0.015; // изменение до 1.5%
        const open = price;
        const close = price + change;
        const high = Math.max(open, close) + Math.random() * price * 0.005;
        const low = Math.min(open, close) - Math.random() * price * 0.005;
        const volume = Math.random() * 1000000;
        
        data.push({
          timestamp,
          open,
          high,
          low,
          close,
          volume,
          volume_usdt: volume * close,
          is_long: close > open
        });
        
        price = close;
      }
    }
    
    return data;
  };

  const loadLightweightChartsScript = async (): Promise<void> => {
    if (window.LightweightCharts) {
      setChartReady(true);
      return Promise.resolve();
    }

    if (chartScriptLoaded) {
      setChartReady(true);
      return Promise.resolve();
    }

    if (chartScriptPromise) {
      return chartScriptPromise;
    }

    chartScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js';
      script.async = true;
      
      script.onload = () => {
        console.log('Lightweight Charts loaded successfully');
        chartScriptLoaded = true;
        setChartReady(true);
        setError(null);
        resolve();
      };
      
      script.onerror = () => {
        console.error('Failed to load Lightweight Charts');
        setError('Ошибка загрузки библиотеки графиков');
        setChartReady(false);
        chartScriptPromise = null;
        reject(new Error('Script loading failed'));
      };
      
      document.head.appendChild(script);
    });

    return chartScriptPromise;
  };

  const createChart = () => {
    if (!chartContainerRef.current || !window.LightweightCharts || chartData.length === 0) {
      return;
    }

    if (chartRef.current) {
      chartRef.current.remove();
    }

    try {
      const chart = window.LightweightCharts.createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 500,
        layout: {
          background: { color: '#ffffff' },
          textColor: '#333',
        },
        grid: {
          vertLines: { color: '#f0f0f0' },
          horzLines: { color: '#f0f0f0' },
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

      chartRef.current = chart;

      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });

      candlestickSeriesRef.current = candlestickSeries;

      const volumeSeries = chart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
      });

      volumeSeriesRef.current = volumeSeries;

      chart.priceScale('volume').applyOptions({
        scaleMargins: {
          top: 0.7,
          bottom: 0,
        },
      });

      // Подготавливаем данные для графика
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

      // Добавляем маркеры алертов только если сигнал виден
      if (alertVisible) {
        addAlertMarkers(candlestickSeries);
      }

      // Добавляем зоны имбаланса если есть
      if (alert.has_imbalance && alert.imbalance_data) {
        addImbalanceZones(chart);
      }

      // Подгоняем график под данные
      chart.timeScale().fitContent();

      // Если сигнал виден, центрируем на нем
      if (alertVisible) {
        const alertTimestamp = alert.close_timestamp || alert.timestamp;
        const alertTime = Math.floor((typeof alertTimestamp === 'number' ? alertTimestamp : new Date(alertTimestamp).getTime()) / 1000);
        
        // Устанавливаем видимый диапазон вокруг сигнала
        const visibleRange = {
          from: alertTime - 1800, // 30 минут до
          to: alertTime + 1800     // 30 минут после
        };
        
        chart.timeScale().setVisibleRange(visibleRange);
      }

      // Оптимизированный ResizeObserver
      let resizeTimeout: NodeJS.Timeout;
      const resizeObserver = new ResizeObserver(entries => {
        if (entries.length === 0 || entries[0].target !== chartContainerRef.current) {
          return;
        }
        
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          const newRect = entries[0].contentRect;
          chart.applyOptions({ width: newRect.width, height: newRect.height });
        }, 100);
      });

      if (chartContainerRef.current) {
        resizeObserver.observe(chartContainerRef.current);
      }

      console.log('Chart created successfully');
    } catch (err) {
      console.error('Error creating chart:', err);
      setError('Ошибка создания графика');
    }
  };

  const addAlertMarkers = (series: any) => {
    const alertTime = alert.close_timestamp || alert.timestamp;
    const alertTimestamp = Math.floor((typeof alertTime === 'number' ? alertTime : new Date(alertTime).getTime()) / 1000);

    const markers = [{
      time: alertTimestamp,
      position: 'aboveBar',
      color: '#f68410',
      shape: 'circle',
      text: `🎯 ${alert.alert_type}: $${alert.price.toFixed(6)}`,
    }];

    // Добавляем маркер предварительного алерта если есть
    if (alert.preliminary_alert) {
      const prelimTime = Math.floor((typeof alert.preliminary_alert.timestamp === 'number' ? alert.preliminary_alert.timestamp : new Date(alert.preliminary_alert.timestamp).getTime()) / 1000);
      markers.push({
        time: prelimTime,
        position: 'belowBar',
        color: '#ff9800',
        shape: 'square',
        text: `⚠️ Предварительный: $${alert.preliminary_alert.price.toFixed(6)}`,
      });
    }

    // Добавляем маркер уровня алерта если есть
    if (alert.candle_data?.alert_level) {
      markers.push({
        time: alertTimestamp,
        position: 'belowBar',
        color: '#9c27b0',
        shape: 'square',
        text: `📊 Уровень: $${alert.candle_data.alert_level.toFixed(6)}`,
      });
    }

    series.setMarkers(markers);
  };

  const addImbalanceZones = (chart: any) => {
    if (!alert.imbalance_data) return;

    const alertTime = alert.close_timestamp || alert.timestamp;
    const alertTimestamp = Math.floor((typeof alertTime === 'number' ? alertTime : new Date(alertTime).getTime()) / 1000);

    const imbalanceTopSeries = chart.addLineSeries({
      color: alert.imbalance_data.direction === 'bullish' ? '#26a69a' : '#ef5350',
      lineWidth: 2,
      lineStyle: window.LightweightCharts.LineStyle.Dashed,
      title: `${alert.imbalance_data.type.toUpperCase()} Top`,
    });

    const imbalanceBottomSeries = chart.addLineSeries({
      color: alert.imbalance_data.direction === 'bullish' ? '#26a69a' : '#ef5350',
      lineWidth: 2,
      lineStyle: window.LightweightCharts.LineStyle.Dashed,
      title: `${alert.imbalance_data.type.toUpperCase()} Bottom`,
    });

    // Показываем зону имбаланса на всем видимом диапазоне
    const dataStartTime = Math.min(...chartData.map(d => Math.floor(d.timestamp / 1000)));
    const dataEndTime = Math.max(...chartData.map(d => Math.floor(d.timestamp / 1000)));

    imbalanceTopSeries.setData([
      { time: dataStartTime, value: alert.imbalance_data.top },
      { time: dataEndTime, value: alert.imbalance_data.top },
    ]);

    imbalanceBottomSeries.setData([
      { time: dataStartTime, value: alert.imbalance_data.bottom },
      { time: dataEndTime, value: alert.imbalance_data.bottom },
    ]);
  };

  const openTradingView = () => {
    const cleanSymbol = alert.symbol.replace('USDT', '');
    const url = `https://www.tradingview.com/chart/?symbol=BYBIT:${cleanSymbol}USDT.P&interval=1`;
    window.open(url, '_blank');
  };

  const downloadChart = () => {
    const csvContent = [
      'Timestamp,Open,High,Low,Close,Volume,Volume_USDT,Is_Long',
      ...chartData.map(d => 
        `${new Date(d.timestamp).toISOString()},${d.open},${d.high},${d.low},${d.close},${d.volume},${d.volume_usdt},${d.is_long}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${alert.symbol}_chart_data.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg w-full max-w-[95vw] h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{alert.symbol}</h2>
              <div className="flex items-center space-x-4 mt-1">
                <p className="text-gray-600">
                  Внутренний график • Алерт: {formatTime(alert.close_timestamp || alert.timestamp, timeZone)}
                </p>
                <span className={`text-sm px-2 py-1 rounded ${
                  dataSource === 'database' ? 'text-green-600 bg-green-100' : 'text-yellow-600 bg-yellow-100'
                }`}>
                  {dataSource === 'database' ? 'Данные из БД' : 'Demo данные'}
                </span>
                {!alertVisible && (
                  <span className="text-sm text-orange-600 bg-orange-100 px-2 py-1 rounded flex items-center">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Сигнал вне диапазона
                  </span>
                )}
                {alertVisible && (
                  <span className="text-sm text-blue-600 bg-blue-100 px-2 py-1 rounded flex items-center">
                    <Target className="w-3 h-3 mr-1" />
                    Сигнал виден
                  </span>
                )}
              </div>
              {alert.has_imbalance && (
                <div className="flex items-center space-x-2 mt-2">
                  <span className="text-orange-500 text-sm">⚠️ Обнаружен имбаланс</span>
                  {alert.imbalance_data && (
                    <span className="text-xs text-gray-500">
                      ({alert.imbalance_data.type}, {alert.imbalance_data.direction}, сила: {alert.imbalance_data.strength.toFixed(1)}%)
                    </span>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              <TimeZoneToggle />

              <button
                onClick={() => setShowTimestampInfo(!showTimestampInfo)}
                className="text-gray-500 hover:text-gray-700 p-2"
                title="Информация о данных"
              >
                <Info className="w-4 h-4" />
              </button>

              {/* Кнопки торговли */}
              <button
                onClick={() => setShowPaperTrading(true)}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Calculator className="w-4 h-4" />
                <span>Бумажная</span>
              </button>

              <button
                onClick={() => setShowRealTrading(true)}
                className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <DollarSign className="w-4 h-4" />
                <span>Реальная</span>
              </button>

              {alert.order_book_snapshot && (
                <button
                  onClick={() => setShowOrderBook(true)}
                  className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Стакан</span>
                </button>
              )}
              
              <button
                onClick={downloadChart}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Скачать</span>
              </button>
              
              <button
                onClick={openTradingView}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>TradingView</span>
              </button>
              
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Информация о данных */}
          {showTimestampInfo && (
            <div className="p-4 bg-blue-50 border-b border-gray-200">
              <h4 className="font-medium text-blue-900 mb-2">📊 Информация о данных графика</h4>
              <div className="text-sm text-blue-700 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p><strong>Источник данных:</strong> {dataSource === 'database' ? 'База данных системы' : 'Демонстрационные данные'}</p>
                    <p><strong>Количество свечей:</strong> {chartData.length}</p>
                    <p><strong>Интервал:</strong> 1 минута</p>
                  </div>
                  <div>
                    <p><strong>Диапазон данных:</strong> {chartData.length > 0 ? 
                      `${formatTime(Math.min(...chartData.map(d => d.timestamp)), timeZone, { includeDate: false })} - ${formatTime(Math.max(...chartData.map(d => d.timestamp)), timeZone, { includeDate: false })}` : 
                      'Нет данных'}</p>
                    <p><strong>Сигнал:</strong> {alertVisible ? '✅ Виден на графике' : '❌ Вне диапазона данных'}</p>
                  </div>
                </div>
                {!alertVisible && (
                  <div className="mt-3 p-3 bg-orange-100 rounded">
                    <p className="text-orange-800"><strong>⚠️ Сигнал не виден:</strong> Время сигнала выходит за границы доступных данных в базе. График показывает все доступные данные для данного актива.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chart Content */}
          <div className="flex-1 p-6 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-600">Загрузка данных из базы...</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Получение минутных свечей для {alert.symbol}
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-red-600 mb-4">Ошибка: {error}</p>
                  <button
                    onClick={loadChartDataFromDatabase}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors mr-2"
                  >
                    Попробовать снова
                  </button>
                  <button
                    onClick={openTradingView}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Открыть TradingView
                  </button>
                </div>
              </div>
            ) : !chartReady ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
                  <p className="text-gray-600">Загрузка библиотеки графиков...</p>
                </div>
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                  <p className="text-gray-600">Нет данных для отображения</p>
                  <p className="text-sm text-gray-500 mt-2">В базе данных нет свечей для {alert.symbol}</p>
                </div>
              </div>
            ) : (
              <div className="h-full">
                <div 
                  ref={chartContainerRef} 
                  className="w-full h-full"
                  style={{ minHeight: '400px' }}
                />
              </div>
            )}
          </div>

          {/* Alert Info */}
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Тип алерта:</span>
                <span className="ml-2 text-gray-900 font-medium">
                  {alert.alert_type === 'volume_spike' ? 'Превышение объема' :
                   alert.alert_type === 'consecutive_long' ? 'LONG последовательность' :
                   alert.alert_type === 'priority' ? 'Приоритетный' : 'Неизвестный'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Цена алерта:</span>
                <span className="ml-2 text-gray-900 font-mono">${alert.price.toFixed(8)}</span>
              </div>
              <div>
                <span className="text-gray-600">Время:</span>
                <span className="ml-2 text-gray-900 flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatTime(alert.close_timestamp || alert.timestamp, timeZone)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Свечей на графике:</span>
                <span className="ml-2 text-gray-900">{chartData.length}</span>
              </div>
            </div>
            
            {alert.candle_data && (
              <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                <div className="text-sm font-medium text-gray-700 mb-2">Данные свечи алерта (OHLCV):</div>
                <div className="grid grid-cols-5 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Open:</span>
                    <div className="text-gray-900 font-mono">${alert.candle_data.open.toFixed(8)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">High:</span>
                    <div className="text-gray-900 font-mono">${alert.candle_data.high.toFixed(8)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Low:</span>
                    <div className="text-gray-900 font-mono">${alert.candle_data.low.toFixed(8)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Close:</span>
                    <div className="text-gray-900 font-mono">${alert.candle_data.close.toFixed(8)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Volume:</span>
                    <div className="text-gray-900 font-mono">{alert.candle_data.volume.toFixed(2)}</div>
                  </div>
                </div>
                {alert.candle_data.alert_level && (
                  <div className="mt-2 text-sm">
                    <span className="text-gray-600">Уровень алерта:</span>
                    <span className="ml-2 text-purple-600 font-mono">${alert.candle_data.alert_level.toFixed(8)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Информация об источнике данных */}
            <div className="mt-4 text-xs text-gray-500 flex justify-between items-center">
              <span>
                Источник данных: {dataSource === 'database' ? '🗄️ База данных системы' : '🎭 Demo данные'} • 
                Powered by Lightweight Charts • 
                {alertVisible ? '🎯 Сигнал отображен' : '⚠️ Сигнал вне диапазона'}
              </span>
              <span>Часовой пояс: {timeZone === 'UTC' ? 'UTC' : 'Локальное время'}</span>
            </div>
          </div>
        </div>

        {/* Order Book Modal */}
        {showOrderBook && alert.order_book_snapshot && (
          <OrderBookModal
            orderBook={alert.order_book_snapshot}
            alertPrice={alert.price}
            symbol={alert.symbol}
            onClose={() => setShowOrderBook(false)}
          />
        )}
      </div>

      {/* Модальные окна торговли */}
      {showPaperTrading && (
        <PaperTradingModal
          symbol={alert.symbol}
          alertPrice={alert.price}
          alertId={alert.id}
          onClose={() => setShowPaperTrading(false)}
        />
      )}

      {showRealTrading && (
        <RealTradingModal
          symbol={alert.symbol}
          alertPrice={alert.price}
          alertId={alert.id}
          onClose={() => setShowRealTrading(false)}
        />
      )}
    </>
  );
};

export default ChartModal;