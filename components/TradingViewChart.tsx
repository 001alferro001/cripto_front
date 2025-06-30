import React, { useEffect, useRef, useState } from 'react';
import { X, ExternalLink, Maximize2, Minimize2, AlertTriangle, DollarSign, Calculator, TrendingUp, TrendingDown, Clock, BarChart3, Globe, BarChart2, Activity } from 'lucide-react';
import PaperTradingModal from './PaperTradingModal';
import RealTradingModal from './RealTradingModal';
import CoinGeckoChart from './CoinGeckoChart';
import ChartModal from './ChartModal';
import { useTimeZone } from '../contexts/TimeZoneContext';
import { formatTime } from '../utils/timeUtils';

interface TradingViewChartProps {
  symbol: string;
  alertPrice?: number;
  alertTime?: number | string;
  alerts?: any[];
  onClose: () => void;
  onError?: () => void;
  theme?: 'light' | 'dark';
}

declare global {
  interface Window {
    LightweightCharts: any;
    Chart: any;
  }
}

// Глобальное состояние для управления библиотеками графиков
let lightweightChartsLoaded = false;
let lightweightChartsPromise: Promise<void> | null = null;
let chartJsLoaded = false;
let chartJsPromise: Promise<void> | null = null;

const TradingViewChart: React.FC<TradingViewChartProps> = ({ 
  symbol, 
  alertPrice, 
  alertTime,
  alerts = [],
  onClose,
  onError,
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
  const [dataSource, setDataSource] = useState<'api' | 'mock'>('api');
  const [chartLibrary, setChartLibrary] = useState<'lightweight' | 'chartjs' | 'fallback'>('lightweight');
  const [showFallbackOptions, setShowFallbackOptions] = useState(false);
  
  // Новые состояния для типов графиков
  const [chartType, setChartType] = useState<'candlestick' | 'line' | 'bar'>('candlestick');
  const [showVolume, setShowVolume] = useState(true);
  
  const { timeZone } = useTimeZone();

  useEffect(() => {
    mountedRef.current = true;
    initializeChart();
    
    return () => {
      mountedRef.current = false;
      cleanupChart();
    };
  }, []);

  useEffect(() => {
    if ((lightweightChartsLoaded || chartJsLoaded) && mountedRef.current) {
      loadChartData();
    }
  }, [symbol, interval]);

  // Пересоздаем график при изменении типа
  useEffect(() => {
    if (chartData.length > 0 && mountedRef.current) {
      if (chartLibrary === 'lightweight') {
        createLightweightChart(chartData);
      } else if (chartLibrary === 'chartjs') {
        createChartJsChart(chartData);
      }
    }
  }, [chartType, showVolume]);

  const initializeChart = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setShowFallbackOptions(false);
      
      // Пробуем загрузить Lightweight Charts
      try {
        await loadLightweightChartsScript();
        setChartLibrary('lightweight');
        console.log('✅ Используем Lightweight Charts');
      } catch (lightweightError) {
        console.warn('❌ Lightweight Charts не загружен, пробуем Chart.js:', lightweightError);
        
        // Если Lightweight Charts не загрузился, пробуем Chart.js
        try {
          await loadChartJsScript();
          setChartLibrary('chartjs');
          console.log('✅ Используем Chart.js как альтернативу');
        } catch (chartJsError) {
          console.error('❌ Chart.js тоже не загружен:', chartJsError);
          setChartLibrary('fallback');
          setShowFallbackOptions(true);
          setError('Библиотеки графиков недоступны. Используйте альтернативные варианты.');
          if (onError) onError();
        }
      }
      
      if (mountedRef.current && (lightweightChartsLoaded || chartJsLoaded)) {
        await loadChartData();
      }
    } catch (err) {
      if (mountedRef.current) {
        setError('Ошибка инициализации графиков');
        setShowFallbackOptions(true);
        setIsLoading(false);
        if (onError) onError();
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

      // Создаем новый скрипт с таймаутом
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js';
      script.async = true;
      script.defer = true;
      
      // Таймаут для загрузки скрипта
      const timeout = setTimeout(() => {
        script.remove();
        lightweightChartsPromise = null;
        reject(new Error('Lightweight Charts loading timeout'));
      }, 10000); // 10 секунд
      
      script.onload = () => {
        clearTimeout(timeout);
        console.log('Lightweight Charts script loaded successfully');
        if (window.LightweightCharts) {
          lightweightChartsLoaded = true;
          resolve();
        } else {
          reject(new Error('LightweightCharts not available after script load'));
        }
      };
      
      script.onerror = () => {
        clearTimeout(timeout);
        console.error('Failed to load Lightweight Charts script');
        lightweightChartsPromise = null;
        reject(new Error('Script loading failed'));
      };
      
      document.head.appendChild(script);
    });

    return lightweightChartsPromise;
  };

  const loadChartJsScript = (): Promise<void> => {
    // Если библиотека уже загружена
    if (window.Chart && chartJsLoaded) {
      return Promise.resolve();
    }

    // Если уже есть промис загрузки
    if (chartJsPromise) {
      return chartJsPromise;
    }

    // Создаем новый промис загрузки
    chartJsPromise = new Promise((resolve, reject) => {
      // Удаляем существующие скрипты Chart.js
      const existingScripts = document.querySelectorAll('script[src*="chart"]');
      existingScripts.forEach(script => {
        if (script.getAttribute('src')?.includes('chart.js') || script.getAttribute('src')?.includes('chart.umd')) {
          script.remove();
        }
      });

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js';
      script.async = true;
      
      // Таймаут для загрузки скрипта
      const timeout = setTimeout(() => {
        script.remove();
        chartJsPromise = null;
        reject(new Error('Chart.js loading timeout'));
      }, 8000); // 8 секунд
      
      script.onload = () => {
        clearTimeout(timeout);
        console.log('Chart.js script loaded successfully');
        if (window.Chart) {
          chartJsLoaded = true;
          resolve();
        } else {
          reject(new Error('Chart.js not available after script load'));
        }
      };
      
      script.onerror = () => {
        clearTimeout(timeout);
        console.error('Failed to load Chart.js script');
        chartJsPromise = null;
        reject(new Error('Chart.js loading failed'));
      };
      
      document.head.appendChild(script);
    });

    return chartJsPromise;
  };

  const generateMockData = () => {
    const now = Date.now();
    const data = [];
    let price = alertPrice || 50000;
    
    // Генерируем 100 свечей за последние 100 минут
    for (let i = 99; i >= 0; i--) {
      const timestamp = now - (i * 60 * 1000); // каждая свеча = 1 минута
      const change = (Math.random() - 0.5) * price * 0.02; // изменение до 2%
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * price * 0.01;
      const low = Math.min(open, close) - Math.random() * price * 0.01;
      const volume = Math.random() * 1000000;
      
      data.push({
        timestamp,
        open,
        high,
        low,
        close,
        volume,
        volume_usdt: volume * price,
        is_long: close > open
      });
      
      price = close;
    }
    
    return data;
  };

  const loadChartData = async () => {
    if (!mountedRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

      let candleData = [];

      // Сначала пробуем загрузить данные с API
      try {
        const apiUrl = `/api/chart-data/${symbol}?interval=${interval}&hours=24`;
        console.log('Загружаем данные с API:', apiUrl);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(apiUrl, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          candleData = data.chart_data || data.data || data || [];
          setDataSource('api');
          console.log('Данные загружены с API:', candleData.length, 'свечей');
        } else {
          throw new Error(`API вернул статус ${response.status}`);
        }
      } catch (apiError) {
        console.warn('Ошибка загрузки с API, используем mock данные:', apiError);
        candleData = generateMockData();
        setDataSource('mock');
      }
      
      setChartData(candleData);
      
      if (mountedRef.current) {
        if (chartLibrary === 'lightweight') {
          createLightweightChart(candleData);
        } else if (chartLibrary === 'chartjs') {
          createChartJsChart(candleData);
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        console.error('Ошибка загрузки данных графика:', err);
        // В случае полной ошибки, все равно показываем mock данные
        const mockData = generateMockData();
        setChartData(mockData);
        setDataSource('mock');
        if (chartLibrary === 'lightweight') {
          createLightweightChart(mockData);
        } else if (chartLibrary === 'chartjs') {
          createChartJsChart(mockData);
        }
      }
    }
  };

  const createLightweightChart = (data: any[]) => {
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

      // Добавляем серию в зависимости от типа графика
      let mainSeries;
      if (chartType === 'candlestick') {
        mainSeries = chart.addCandlestickSeries({
          upColor: '#26a69a',
          downColor: '#ef5350',
          borderVisible: false,
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350',
        });
      } else if (chartType === 'line') {
        mainSeries = chart.addLineSeries({
          color: '#2196f3',
          lineWidth: 2,
        });
      } else { // bar
        mainSeries = chart.addHistogramSeries({
          color: '#2196f3',
        });
      }

      candlestickSeriesRef.current = mainSeries;

      // Добавляем серию объемов если включена
      if (showVolume) {
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
      }

      // Подготавливаем данные для графика
      if (data && data.length > 0) {
        let mainData;
        
        if (chartType === 'candlestick') {
          mainData = data.map(item => ({
            time: Math.floor((item.timestamp || Date.now()) / 1000),
            open: Number(item.open) || 0,
            high: Number(item.high) || 0,
            low: Number(item.low) || 0,
            close: Number(item.close) || 0,
          })).filter(item => item.open > 0 && item.high > 0 && item.low > 0 && item.close > 0);
        } else {
          mainData = data.map(item => ({
            time: Math.floor((item.timestamp || Date.now()) / 1000),
            value: Number(item.close) || 0,
          })).filter(item => item.value > 0);
        }

        if (showVolume) {
          const volumeData = data.map(item => ({
            time: Math.floor((item.timestamp || Date.now()) / 1000),
            value: Number(item.volume_usdt || item.volume) || 0,
            color: item.is_long ? '#26a69a' : '#ef5350',
          })).filter(item => item.value > 0);

          if (volumeData.length > 0 && volumeSeriesRef.current) {
            volumeSeriesRef.current.setData(volumeData);
            console.log('Установлены данные объемов:', volumeData.length);
          }
        }

        if (mainData.length > 0) {
          mainSeries.setData(mainData);
          console.log('Установлены основные данные:', mainData.length);
        }

        // Добавляем маркеры алертов
        addAlertMarkers(mainSeries);

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

      console.log('Lightweight Chart created successfully with', data.length, 'data points');
    } catch (error) {
      console.error('Ошибка создания Lightweight Chart:', error);
      if (mountedRef.current) {
        // Пробуем Chart.js как fallback
        setChartLibrary('chartjs');
        loadChartJsScript().then(() => {
          createChartJsChart(data);
        }).catch(() => {
          setError('Ошибка создания графика');
          setShowFallbackOptions(true);
          setIsLoading(false);
        });
      }
    }
  };

  const createChartJsChart = (data: any[]) => {
    if (!containerRef.current || !window.Chart || !mountedRef.current) {
      return;
    }

    // Очищаем предыдущий график
    cleanupChart();

    try {
      // Создаем canvas элемент
      const canvas = document.createElement('canvas');
      canvas.width = containerRef.current.clientWidth;
      canvas.height = containerRef.current.clientHeight;
      containerRef.current.appendChild(canvas);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Cannot get canvas context');
      }

      // Подготавливаем данные для Chart.js
      const labels = data.map(item => {
        const date = new Date(item.timestamp);
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      });

      const datasets = [];

      // Основной датасет в зависимости от типа графика
      if (chartType === 'candlestick') {
        // Для свечного графика используем комбинацию линий
        datasets.push(
          {
            label: 'High',
            data: data.map(item => item.high),
            borderColor: 'rgba(76, 175, 80, 0.8)',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            borderWidth: 1,
            fill: false,
            pointRadius: 0,
            yAxisID: 'y'
          },
          {
            label: 'Low',
            data: data.map(item => item.low),
            borderColor: 'rgba(244, 67, 54, 0.8)',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            borderWidth: 1,
            fill: false,
            pointRadius: 0,
            yAxisID: 'y'
          },
          {
            label: 'Close',
            data: data.map(item => item.close),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 3,
            fill: false,
            tension: 0.1,
            yAxisID: 'y'
          }
        );
      } else if (chartType === 'line') {
        datasets.push({
          label: 'Цена (USD)',
          data: data.map(item => item.close),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.1,
          yAxisID: 'y'
        });
      } else { // bar
        datasets.push({
          label: 'Цена (USD)',
          data: data.map(item => item.close),
          backgroundColor: data.map(item => item.is_long ? 'rgba(76, 175, 80, 0.8)' : 'rgba(244, 67, 54, 0.8)'),
          borderColor: data.map(item => item.is_long ? 'rgba(76, 175, 80, 1)' : 'rgba(244, 67, 54, 1)'),
          borderWidth: 1,
          yAxisID: 'y'
        });
      }

      // Добавляем объемы если включены
      if (showVolume) {
        datasets.push({
          label: 'Объем (USD)',
          data: data.map(item => item.volume_usdt || item.volume),
          type: 'bar',
          backgroundColor: 'rgba(16, 185, 129, 0.3)',
          borderColor: 'rgba(16, 185, 129, 0.8)',
          borderWidth: 1,
          yAxisID: 'y1'
        });
      }

      // Создаем график
      chartRef.current = new window.Chart(ctx, {
        type: chartType === 'bar' ? 'bar' : 'line',
        data: {
          labels,
          datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            title: {
              display: true,
              text: `${symbol} - ${chartType === 'candlestick' ? 'Свечной' : chartType === 'line' ? 'Линейный' : 'Столбчатый'} график (Chart.js)`,
              font: {
                size: 16,
                weight: 'bold'
              }
            },
            legend: {
              display: true,
              position: 'top'
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  if (context.dataset.label?.includes('Объем')) {
                    return `Объем: $${(context.parsed.y / 1000000).toFixed(2)}M`;
                  } else {
                    return `${context.dataset.label}: $${context.parsed.y.toLocaleString()}`;
                  }
                }
              }
            }
          },
          scales: {
            x: {
              display: true,
              title: {
                display: true,
                text: 'Время'
              }
            },
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              title: {
                display: true,
                text: 'Цена (USD)'
              },
              ticks: {
                callback: function(value) {
                  return '$' + Number(value).toLocaleString();
                }
              }
            },
            ...(showVolume && {
              y1: {
                type: 'linear',
                display: true,
                position: 'right',
                title: {
                  display: true,
                  text: 'Объем (USD)'
                },
                grid: {
                  drawOnChartArea: false,
                },
                ticks: {
                  callback: function(value) {
                    return '$' + (Number(value) / 1000000).toFixed(1) + 'M';
                  }
                }
              }
            })
          }
        }
      });

      setIsLoading(false);
      setError(null);
      setRetryCount(0);

      console.log('Chart.js chart created successfully with', data.length, 'data points');
    } catch (error) {
      console.error('Ошибка создания Chart.js:', error);
      if (mountedRef.current) {
        setError('Ошибка создания графика');
        setShowFallbackOptions(true);
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
      text: `🎯 Alert: $${alertPrice.toFixed(6)}`,
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

    if (markers.length > 0 && series.setMarkers) {
      series.setMarkers(markers);
      console.log('Добавлены маркеры алертов:', markers.length);
    }
  };

  const cleanupChart = () => {
    if (chartRef.current) {
      try {
        if (chartLibrary === 'lightweight') {
          chartRef.current.remove();
        } else if (chartLibrary === 'chartjs') {
          chartRef.current.destroy();
        }
      } catch (e) {
        console.log('Chart cleanup error:', e);
      }
      chartRef.current = null;
    }
    
    // Очищаем контейнер
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
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
    setShowFallbackOptions(false);
    
    // Сбрасываем глобальное состояние
    lightweightChartsLoaded = false;
    lightweightChartsPromise = null;
    chartJsLoaded = false;
    chartJsPromise = null;

    // Удаляем существующие скрипты
    const existingScripts = document.querySelectorAll('script[src*="lightweight-charts"], script[src*="chart.js"], script[src*="chart.umd"]');
    existingScripts.forEach(script => script.remove());

    // Очищаем библиотеки из window
    if (window.LightweightCharts) {
      delete window.LightweightCharts;
    }
    if (window.Chart) {
      delete window.Chart;
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

  const chartTypes = [
    { value: 'candlestick', label: 'Свечи', icon: BarChart3 },
    { value: 'line', label: 'Линия', icon: Activity },
    { value: 'bar', label: 'Столбцы', icon: BarChart2 }
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
              {alertTime && (
                <span className="text-sm text-blue-600 bg-blue-100 px-2 py-1 rounded flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatTime(alertTime, timeZone)}
                </span>
              )}
              {dataSource === 'mock' && (
                <span className="text-sm text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
                  Demo данные
                </span>
              )}
              <span className={`text-sm px-2 py-1 rounded ${
                chartLibrary === 'lightweight' ? 'text-green-600 bg-green-100' :
                chartLibrary === 'chartjs' ? 'text-blue-600 bg-blue-100' :
                'text-red-600 bg-red-100'
              }`}>
                {chartLibrary === 'lightweight' ? 'Lightweight Charts' :
                 chartLibrary === 'chartjs' ? 'Chart.js' : 'Fallback'}
              </span>
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

              {/* Тип графика (только для Chart.js) */}
              {chartLibrary === 'chartjs' && (
                <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                  {chartTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        onClick={() => setChartType(type.value as any)}
                        className={`flex items-center space-x-1 px-2 py-1 text-xs rounded transition-colors ${
                          chartType === type.value
                            ? 'bg-purple-600 text-white'
                            : 'text-gray-600 hover:bg-gray-200'
                        }`}
                        title={type.label}
                      >
                        <Icon className="w-3 h-3" />
                        <span className="hidden sm:inline">{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Переключатель объемов (только для Chart.js) */}
              {chartLibrary === 'chartjs' && (
                <button
                  onClick={() => setShowVolume(!showVolume)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    showVolume
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  Объемы
                </button>
              )}

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
                    {chartLibrary === 'lightweight' && !lightweightChartsLoaded ? 'Загрузка Lightweight Charts...' :
                     chartLibrary === 'chartjs' && !chartJsLoaded ? 'Загрузка Chart.js...' :
                     'Загрузка данных графика...'}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Попытка {retryCount + 1} • {dataSource === 'mock' ? 'Используются demo данные' : 'Загрузка с API'}
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
                    {showFallbackOptions && (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm text-gray-600">Альтернативные варианты:</p>
                        <div className="space-x-2">
                          <button
                            onClick={() => {
                              onClose();
                              // Здесь можно открыть CoinGecko
                            }}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded text-sm transition-colors"
                          >
                            <Globe className="w-4 h-4 inline mr-1" />
                            CoinGecko
                          </button>
                          <button
                            onClick={() => {
                              onClose();
                              // Здесь можно открыть внутренний график
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded text-sm transition-colors"
                          >
                            <BarChart3 className="w-4 h-4 inline mr-1" />
                            Внутренний
                          </button>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-gray-500">
                      Библиотека: {chartLibrary} • 
                      Источник данных: {dataSource}
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
              <span>
                Данные: {dataSource === 'api' ? 'API Backend' : 'Demo данные'} • 
                График: {chartLibrary === 'lightweight' ? 'Lightweight Charts' :
                         chartLibrary === 'chartjs' ? `Chart.js (${chartType === 'candlestick' ? 'Свечи' : chartType === 'line' ? 'Линия' : 'Столбцы'})` : 'Fallback'}
              </span>
              <div className="flex items-center space-x-4">
                <span>📈 LONG: прибыль при росте</span>
                <span>📉 SHORT: прибыль при падении</span>
                <span>Свечей: {chartData.length}</span>
                {alertTime && (
                  <span>🕐 Алерт: {formatTime(alertTime, timeZone, { includeDate: false })}</span>
                )}
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