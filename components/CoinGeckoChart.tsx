import React, { useEffect, useState } from 'react';
import { X, ExternalLink, TrendingUp, TrendingDown, RefreshCw, AlertTriangle, Globe } from 'lucide-react';

interface CoinGeckoChartProps {
  symbol: string;
  onClose: () => void;
}

interface CoinData {
  id: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
  image: string;
  symbol: string;
  market_cap_rank?: number;
  circulating_supply?: number;
  total_supply?: number;
}

interface PriceData {
  prices: number[][];
  market_caps: number[][];
  total_volumes: number[][];
}

const CoinGeckoChart: React.FC<CoinGeckoChartProps> = ({ symbol, onClose }) => {
  const [coinData, setCoinData] = useState<CoinData | null>(null);
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState('7');
  const [retryCount, setRetryCount] = useState(0);
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    loadCoinData();
  }, [symbol]);

  useEffect(() => {
    if (coinData) {
      loadPriceData();
    }
  }, [coinData, days]);

  useEffect(() => {
    if (priceData && coinData) {
      loadChartScript();
    }
  }, [priceData, coinData]);

  const loadCoinData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Преобразуем символ (например, BTCUSDT -> bitcoin)
      const coinId = getCoinId(symbol);
      
      if (!coinId) {
        // Если не нашли в маппинге, попробуем поиск по символу
        const searchResult = await searchCoinBySymbol(symbol);
        if (!searchResult) {
          setError('Криптовалюта не найдена в CoinGecko');
          setLoading(false);
          return;
        }
        setCoinData(searchResult);
        setLoading(false);
        return;
      }

      // Загружаем данные о монете с правильными параметрами
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 секунд таймаут

      try {
        // Используем правильный endpoint с минимальными параметрами
        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`,
          { 
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'CryptoAnalyzer/1.0'
            }
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 429) {
            throw new Error('Превышен лимит запросов CoinGecko API. Попробуйте позже.');
          }
          throw new Error(`Ошибка загрузки данных CoinGecko: ${response.status}`);
        }

        const data = await response.json();
        
        // Проверяем наличие необходимых данных
        if (!data.market_data || !data.market_data.current_price) {
          throw new Error('Неполные данные от CoinGecko API');
        }
        
        setCoinData({
          id: data.id,
          name: data.name,
          symbol: data.symbol.toUpperCase(),
          current_price: data.market_data.current_price.usd || 0,
          price_change_percentage_24h: data.market_data.price_change_percentage_24h || 0,
          market_cap: data.market_data.market_cap.usd || 0,
          total_volume: data.market_data.total_volume.usd || 0,
          image: data.image?.large || data.image?.small || '',
          market_cap_rank: data.market_cap_rank,
          circulating_supply: data.market_data.circulating_supply,
          total_supply: data.market_data.total_supply
        });

        setRetryCount(0);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }

    } catch (err) {
      console.error('CoinGecko API error:', err);
      if (err.name === 'AbortError') {
        setError('Таймаут запроса к CoinGecko API');
      } else {
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      }
      setRetryCount(prev => prev + 1);
    } finally {
      setLoading(false);
    }
  };

  const loadPriceData = async () => {
    if (!coinData) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // Загружаем исторические данные цен
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coinData.id}/market_chart?vs_currency=usd&days=${days}&interval=${days === '1' ? 'hourly' : 'daily'}`,
        { 
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'CryptoAnalyzer/1.0'
          }
        }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setPriceData(data);
      } else {
        console.warn('Не удалось загрузить исторические данные цен');
        setPriceData(null);
      }
    } catch (error) {
      console.warn('Ошибка загрузки исторических данных:', error);
      setPriceData(null);
    }
  };

  const loadChartScript = async () => {
    try {
      // Проверяем, загружен ли уже скрипт Chart.js
      if (window.Chart) {
        createChart();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js';
      script.async = true;
      
      script.onload = () => {
        console.log('Chart.js loaded successfully');
        createChart();
      };
      
      script.onerror = () => {
        console.error('Failed to load Chart.js');
        setChartReady(false);
      };
      
      document.head.appendChild(script);
    } catch (err) {
      console.error('Error loading Chart.js:', err);
      setChartReady(false);
    }
  };

  const createChart = () => {
    if (!priceData || !coinData) {
      setChartReady(true); // Показываем интерфейс даже без графика
      return;
    }

    try {
      const canvas = document.getElementById('priceChart') as HTMLCanvasElement;
      if (!canvas) {
        setTimeout(createChart, 100); // Повторяем попытку через 100мс
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Очищаем предыдущий график
      if (window.chartInstance) {
        window.chartInstance.destroy();
      }

      // Подготавливаем данные для графика
      const labels = priceData.prices.map(([timestamp]) => {
        const date = new Date(timestamp);
        return days === '1' ? 
          date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) :
          date.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' });
      });

      const prices = priceData.prices.map(([, price]) => price);
      const volumes = priceData.total_volumes.map(([, volume]) => volume);

      // Создаем график
      window.chartInstance = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Цена (USD)',
              data: prices,
              borderColor: coinData.price_change_percentage_24h >= 0 ? '#10b981' : '#ef4444',
              backgroundColor: coinData.price_change_percentage_24h >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.1,
              yAxisID: 'y'
            },
            {
              label: 'Объем (USD)',
              data: volumes,
              type: 'bar',
              backgroundColor: 'rgba(59, 130, 246, 0.3)',
              borderColor: 'rgba(59, 130, 246, 0.8)',
              borderWidth: 1,
              yAxisID: 'y1'
            }
          ]
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
              text: `${coinData.name} (${coinData.symbol}) - ${days} дней`,
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
                  if (context.datasetIndex === 0) {
                    return `Цена: $${context.parsed.y.toLocaleString()}`;
                  } else {
                    return `Объем: $${(context.parsed.y / 1000000).toFixed(2)}M`;
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
          }
        }
      });

      setChartReady(true);
    } catch (error) {
      console.error('Error creating chart:', error);
      setChartReady(true); // Показываем интерфейс даже при ошибке графика
    }
  };

  const searchCoinBySymbol = async (symbol: string): Promise<CoinData | null> => {
    try {
      // Убираем USDT из символа для поиска
      const cleanSymbol = symbol.replace('USDT', '').toLowerCase();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      // Поиск по символу
      const searchResponse = await fetch(
        `https://api.coingecko.com/api/v3/search?query=${cleanSymbol}`,
        { 
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'CryptoAnalyzer/1.0'
          }
        }
      );
      
      clearTimeout(timeoutId);
      
      if (!searchResponse.ok) {
        return null;
      }
      
      const searchData = await searchResponse.json();
      const coin = searchData.coins?.find((c: any) => 
        c.symbol.toLowerCase() === cleanSymbol
      );
      
      if (!coin) {
        return null;
      }
      
      // Загружаем полные данные найденной монеты
      const coinController = new AbortController();
      const coinTimeoutId = setTimeout(() => coinController.abort(), 8000);
      
      const coinResponse = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coin.id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`,
        { 
          signal: coinController.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'CryptoAnalyzer/1.0'
          }
        }
      );
      
      clearTimeout(coinTimeoutId);
      
      if (!coinResponse.ok) {
        return null;
      }
      
      const coinData = await coinResponse.json();
      
      return {
        id: coinData.id,
        name: coinData.name,
        symbol: coinData.symbol.toUpperCase(),
        current_price: coinData.market_data.current_price.usd || 0,
        price_change_percentage_24h: coinData.market_data.price_change_percentage_24h || 0,
        market_cap: coinData.market_data.market_cap.usd || 0,
        total_volume: coinData.market_data.total_volume.usd || 0,
        image: coinData.image?.large || coinData.image?.small || '',
        market_cap_rank: coinData.market_cap_rank,
        circulating_supply: coinData.market_data.circulating_supply,
        total_supply: coinData.market_data.total_supply
      };
      
    } catch (error) {
      console.error('Ошибка поиска монеты:', error);
      return null;
    }
  };

  const getCoinId = (symbol: string): string | null => {
    // Расширенный и обновленный маппинг популярных символов на ID CoinGecko
    const symbolMap: { [key: string]: string } = {
      // Топ криптовалюты
      'BTCUSDT': 'bitcoin',
      'ETHUSDT': 'ethereum',
      'BNBUSDT': 'binancecoin',
      'XRPUSDT': 'ripple',
      'ADAUSDT': 'cardano',
      'SOLUSDT': 'solana',
      'DOGEUSDT': 'dogecoin',
      'DOTUSDT': 'polkadot',
      'AVAXUSDT': 'avalanche-2',
      'SHIBUSDT': 'shiba-inu',
      'LTCUSDT': 'litecoin',
      'MATICUSDT': 'matic-network',
      'TRXUSDT': 'tron',
      'UNIUSDT': 'uniswap',
      'LINKUSDT': 'chainlink',
      'ATOMUSDT': 'cosmos',
      'ETCUSDT': 'ethereum-classic',
      'XLMUSDT': 'stellar',
      'BCHUSDT': 'bitcoin-cash',
      'FILUSDT': 'filecoin',
      'EOSUSDT': 'eos',
      'AAVEUSDT': 'aave',
      'MKRUSDT': 'maker',
      'COMPUSDT': 'compound-governance-token',
      'ALGOUSDT': 'algorand',
      'VETUSDT': 'vechain',
      'ICPUSDT': 'internet-computer',
      'FTMUSDT': 'fantom',
      'SANDUSDT': 'the-sandbox',
      'MANAUSDT': 'decentraland',
      'AXSUSDT': 'axie-infinity',
      'THETAUSDT': 'theta-token',
      'XTZUSDT': 'tezos',
      'NEARUSDT': 'near',
      'FLOWUSDT': 'flow',
      'IOTAUSDT': 'iota',
      'XMRUSDT': 'monero',
      'ZECUSDT': 'zcash',
      'DASHUSDT': 'dash',
      'NEOUSDT': 'neo',
      'QTUMUSDT': 'qtum',
      'OMGUSDT': 'omisego',
      'BATUSDT': 'basic-attention-token',
      'ZRXUSDT': '0x',
      'ENJUSDT': 'enjincoin',
      'CHZUSDT': 'chiliz',
      'HOTUSDT': 'holotoken',
      'ZILUSDT': 'zilliqa',
      'RVNUSDT': 'ravencoin',
      'SCUSDT': 'siacoin',
      'DGBUSDT': 'digibyte',
      'WAVESUSDT': 'waves',
      'ZENUSDT': 'zencash',
      'ONTUSDT': 'ontology',
      'FETUSDT': 'fetch-ai',
      'CELRUSDT': 'celer-network',
      'BANDUSDT': 'band-protocol',
      
      // Новые популярные токены 2024
      'PEPEUSDT': 'pepe',
      'WIFUSDT': 'dogwifcoin',
      'BONKUSDT': 'bonk',
      'FLOKIUSDT': 'floki',
      'APTUSDT': 'aptos',
      'SUIUSDT': 'sui',
      'ARBUSDT': 'arbitrum',
      'OPUSDT': 'optimism',
      'INJUSDT': 'injective-protocol',
      'TIAUSDT': 'celestia',
      'SEIUSDT': 'sei-network',
      'STXUSDT': 'blockstack',
      'JUPUSDT': 'jupiter-exchange-solana',
      'WLDUSDT': 'worldcoin-wld',
      'PYTHUSDT': 'pyth-network',
      'JITOUSDT': 'jito-governance-token',
      'RAYUSDT': 'raydium',
      'RENDERUSDT': 'render-token',
      'GRTUSDT': 'the-graph',
      'IMXUSDT': 'immutable-x',
      'LDOUSDT': 'lido-dao',
      'STRKUSDT': 'starknet',
      'MANTAUSDT': 'manta-network',
      'ALTUSDT': 'altlayer',
      'DYMUSDT': 'dymension',
      'PIXELUSDT': 'pixels',
      'PORTALUSDT': 'portal',
      'AIUSDT': 'sleepless-ai',
      'XAIUSDT': 'xai-blockchain',
      'ACEUSDT': 'fusionist',
      'MAVUSDT': 'maverick-protocol',
      'PENDLEUSDT': 'pendle',
      'ARKMUSDT': 'arkham',
      'AGIXUSDT': 'singularitynet',
      'GALAUSDT': 'gala',
      'GMTUSDT': 'stepn',
      'APEUSDT': 'apecoin',
      
      // DeFi токены
      'LRCUSDT': 'loopring',
      'CRVUSDT': 'curve-dao-token',
      'SUSHIUSDT': 'sushi',
      'YFIUSDT': 'yearn-finance',
      'SNXUSDT': 'havven',
      'UMAUSDT': 'uma',
      'BALUSDT': 'balancer',
      'RENUSDT': 'republic-protocol',
      'KNCUSDT': 'kyber-network-crystal',
      'STORJUSDT': 'storj',
      'OCEANUSDT': 'ocean-protocol',
      'SKLUSDT': 'skale',
      'NUUSDT': 'nucypher',
      'KEEPUSDT': 'keep-network',
      'ANKRUSDT': 'ankr',
      'CTSIUSDT': 'cartesi',
      'COTIUSDT': 'coti',
      'CKBUSDT': 'nervos-network',
      'REQUSDT': 'request-network',
      'MTLUSDT': 'metal',
      'DENTUSDT': 'dent',
      'KEYUSDT': 'selfkey',
      'STMXUSDT': 'storm',
      'DOCKUSDT': 'dock',
      'WANUSDT': 'wanchain',
      'FUNUSDT': 'funfair',
      'CVCUSDT': 'civic',
      'BTTUSDT': 'bittorrent',
      'WINUSDT': 'wink',
      'ONGUSDT': 'ontology-gas',
      'NKNUSDT': 'nkn'
    };

    return symbolMap[symbol] || null;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1e12) {
      return `$${(num / 1e12).toFixed(2)}T`;
    } else if (num >= 1e9) {
      return `$${(num / 1e9).toFixed(2)}B`;
    } else if (num >= 1e6) {
      return `$${(num / 1e6).toFixed(2)}M`;
    } else if (num >= 1e3) {
      return `$${(num / 1e3).toFixed(2)}K`;
    }
    return `$${num.toFixed(2)}`;
  };

  const formatSupply = (num: number): string => {
    if (num >= 1e12) {
      return `${(num / 1e12).toFixed(2)}T`;
    } else if (num >= 1e9) {
      return `${(num / 1e9).toFixed(2)}B`;
    } else if (num >= 1e6) {
      return `${(num / 1e6).toFixed(2)}M`;
    } else if (num >= 1e3) {
      return `${(num / 1e3).toFixed(2)}K`;
    }
    return num.toFixed(0);
  };

  const openCoinGecko = () => {
    if (coinData) {
      window.open(`https://www.coingecko.com/en/coins/${coinData.id}`, '_blank');
    }
  };

  const retryLoad = () => {
    setRetryCount(0);
    setError(null);
    setPriceData(null);
    setChartReady(false);
    loadCoinData();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-6xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-blue-50">
          <div className="flex items-center space-x-4">
            {coinData && coinData.image && (
              <img 
                src={coinData.image} 
                alt={coinData.name}
                className="w-10 h-10 rounded-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <Globe className="w-6 h-6 mr-2 text-green-600" />
                {coinData ? `${coinData.name} (${coinData.symbol})` : symbol}
              </h2>
              <p className="text-gray-600">Данные CoinGecko API</p>
              {coinData?.market_cap_rank && (
                <p className="text-sm text-blue-600">
                  Рейтинг по капитализации: #{coinData.market_cap_rank}
                </p>
              )}
              {error && (
                <p className="text-sm text-red-600 mt-1 flex items-center">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {error}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Кнопка обновления */}
            <button
              onClick={retryLoad}
              disabled={loading}
              className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Обновить</span>
            </button>

            {/* Период графика */}
            <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
              {[
                { value: '1', label: '1д' },
                { value: '7', label: '7д' },
                { value: '30', label: '30д' },
                { value: '90', label: '90д' },
                { value: '365', label: '1г' }
              ].map((period) => (
                <button
                  key={period.value}
                  onClick={() => setDays(period.value)}
                  disabled={loading || error !== null}
                  className={`px-3 py-1 text-sm rounded transition-colors disabled:opacity-50 ${
                    days === period.value
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>

            <button
              onClick={openCoinGecko}
              disabled={!coinData}
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>CoinGecko</span>
            </button>
            
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Загрузка данных CoinGecko...</p>
                <p className="text-sm text-gray-500 mt-2">Попытка {retryCount + 1}</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-600 mb-4">{error}</p>
                <div className="space-y-3">
                  {retryCount < 3 && (
                    <button
                      onClick={retryLoad}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors mr-2"
                    >
                      Попробовать снова ({retryCount + 1}/3)
                    </button>
                  )}
                  <div>
                    <button
                      onClick={() => window.open(`https://www.coingecko.com/en/search?query=${symbol}`, '_blank')}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Поиск на CoinGecko
                    </button>
                  </div>
                  {retryCount >= 3 && (
                    <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <strong>Возможные причины:</strong>
                      </p>
                      <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                        <li>• CoinGecko API временно недоступен</li>
                        <li>• Превышен лимит запросов (429 ошибка)</li>
                        <li>• Проблемы с интернет-соединением</li>
                        <li>• Монета не найдена в базе CoinGecko</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : coinData ? (
            <div className="h-full flex flex-col space-y-6">
              {/* Расширенная статистика */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                  <div className="text-sm text-blue-700 font-medium">Текущая цена</div>
                  <div className="text-xl font-bold text-blue-900">
                    {formatNumber(coinData.current_price)}
                  </div>
                </div>
                
                <div className={`bg-gradient-to-br p-4 rounded-lg border ${
                  coinData.price_change_percentage_24h >= 0 
                    ? 'from-green-50 to-green-100 border-green-200' 
                    : 'from-red-50 to-red-100 border-red-200'
                }`}>
                  <div className={`text-sm font-medium ${
                    coinData.price_change_percentage_24h >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}>
                    Изменение 24ч
                  </div>
                  <div className={`text-xl font-bold flex items-center ${
                    coinData.price_change_percentage_24h >= 0 ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {coinData.price_change_percentage_24h >= 0 ? (
                      <TrendingUp className="w-5 h-5 mr-1" />
                    ) : (
                      <TrendingDown className="w-5 h-5 mr-1" />
                    )}
                    {Math.abs(coinData.price_change_percentage_24h).toFixed(2)}%
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                  <div className="text-sm text-purple-700 font-medium">Рыночная кап.</div>
                  <div className="text-xl font-bold text-purple-900">
                    {formatNumber(coinData.market_cap)}
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
                  <div className="text-sm text-orange-700 font-medium">Объем 24ч</div>
                  <div className="text-xl font-bold text-orange-900">
                    {formatNumber(coinData.total_volume)}
                  </div>
                </div>

                {coinData.circulating_supply && (
                  <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-4 rounded-lg border border-teal-200">
                    <div className="text-sm text-teal-700 font-medium">В обращении</div>
                    <div className="text-xl font-bold text-teal-900">
                      {formatSupply(coinData.circulating_supply)}
                    </div>
                  </div>
                )}

                {coinData.total_supply && (
                  <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-lg border border-indigo-200">
                    <div className="text-sm text-indigo-700 font-medium">Общий запас</div>
                    <div className="text-xl font-bold text-indigo-900">
                      {formatSupply(coinData.total_supply)}
                    </div>
                  </div>
                )}
              </div>

              {/* График */}
              <div className="flex-1 bg-gray-50 rounded-lg p-4 min-h-[400px]">
                {chartReady ? (
                  <div className="h-full">
                    <canvas id="priceChart" className="w-full h-full"></canvas>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                      <p className="text-gray-600">Загрузка графика...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-600">Нет данных для отображения</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <span>Данные предоставлены CoinGecko API</span>
              {coinData && (
                <span>ID: {coinData.id}</span>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <span>Обновляется каждые 5 минут</span>
              {retryCount > 0 && (
                <span className="text-orange-600">Попыток: {retryCount}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Объявляем глобальные переменные для Chart.js
declare global {
  interface Window {
    Chart: any;
    chartInstance: any;
  }
}

export default CoinGeckoChart;