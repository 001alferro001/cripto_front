import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Settings, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  List, 
  Heart,
  Brain,
  TrendingUp,
  TrendingDown,
  Clock,
  ExternalLink,
  Calculator,
  DollarSign
} from 'lucide-react';
import ChartSelector from './ChartSelector';
import SettingsModal from './SettingsModal';
import WatchlistModal from './WatchlistModal';
import FavoritesModal from './FavoritesModal';
import StreamDataModal from './StreamDataModal';
import SmartMoneyChartModal from './SmartMoneyChartModal';
import PaperTradingModal from './PaperTradingModal';
import RealTradingModal from './RealTradingModal';
import TimeZoneToggle from './TimeZoneToggle';
import { TimeZoneProvider, useTimeZone } from '../contexts/TimeZoneContext';
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
  imbalance_data?: any;
  candle_data?: any;
  order_book_snapshot?: any;
  volume_ratio?: number;
  consecutive_count?: number;
}

interface SmartMoneyAlert {
  id: number;
  symbol: string;
  type: 'fair_value_gap' | 'order_block' | 'breaker_block';
  direction: 'bullish' | 'bearish';
  strength: number;
  price: number;
  timestamp: string;
  top?: number;
  bottom?: number;
  related_alert_id?: number;
}

interface WatchlistItem {
  id: number;
  symbol: string;
  is_active: boolean;
  is_favorite: boolean;
  price_drop_percentage?: number;
  current_price?: number;
  historical_price?: number;
  created_at: string;
  updated_at: string;
  notes?: string;
  color?: string;
}

interface FavoriteItem {
  id: number;
  symbol: string;
  is_active: boolean;
  price_drop_percentage?: number;
  current_price?: number;
  historical_price?: number;
  notes?: string;
  color?: string;
  sort_order?: number;
  favorite_added_at?: string;
}

interface StreamData {
  symbol: string;
  price: number;
  volume: number;
  volume_usdt: number;
  is_long: boolean;
  timestamp: string;
  change_24h?: number;
}

interface Settings {
  volume_analyzer: any;
  alerts: any;
  imbalance: any;
  orderbook: any;
  telegram: any;
  trading: any;
}

const AppContent: React.FC = () => {
  const [volumeAlerts, setVolumeAlerts] = useState<Alert[]>([]);
  const [consecutiveAlerts, setConsecutiveAlerts] = useState<Alert[]>([]);
  const [priorityAlerts, setPriorityAlerts] = useState<Alert[]>([]);
  const [smartMoneyAlerts, setSmartMoneyAlerts] = useState<SmartMoneyAlert[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [streamData, setStreamData] = useState<StreamData[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [selectedSmartMoneyAlert, setSelectedSmartMoneyAlert] = useState<SmartMoneyAlert | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showWatchlist, setShowWatchlist] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showStreamData, setShowStreamData] = useState(false);
  const [showPaperTrading, setShowPaperTrading] = useState(false);
  const [showRealTrading, setShowRealTrading] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'volume' | 'consecutive' | 'priority' | 'smart_money' | 'favorites'>('volume');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Состояния для торговых модалей
  const [tradingSymbol, setTradingSymbol] = useState('');
  const [tradingPrice, setTradingPrice] = useState(0);
  const [tradingAlertId, setTradingAlertId] = useState(0);

  const { timeZone } = useTimeZone();

  useEffect(() => {
    loadInitialData();
    const interval = setInterval(loadAlerts, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadAlerts(),
        loadWatchlist(),
        loadFavorites(),
        loadSettings()
      ]);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      setError('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const loadAlerts = async () => {
    try {
      const response = await fetch('/api/alerts/all');
      if (response.ok) {
        const data = await response.json();
        setVolumeAlerts(data.volume_alerts || []);
        setConsecutiveAlerts(data.consecutive_alerts || []);
        setPriorityAlerts(data.priority_alerts || []);
        setSmartMoneyAlerts(data.smart_money_alerts || []);
        setLastUpdate(new Date());
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('disconnected');
      }
    } catch (error) {
      console.error('Ошибка загрузки алертов:', error);
      setConnectionStatus('disconnected');
    }
  };

  const loadWatchlist = async () => {
    try {
      const response = await fetch('/api/watchlist');
      if (response.ok) {
        const data = await response.json();
        setWatchlist(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки списка наблюдения:', error);
    }
  };

  const loadFavorites = async () => {
    try {
      const response = await fetch('/api/favorites');
      if (response.ok) {
        const data = await response.json();
        setFavorites(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки избранного:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки настроек:', error);
    }
  };

  const handleSaveSettings = (newSettings: Settings) => {
    setSettings(newSettings);
  };

  const handleToggleFavorite = async (symbol: string, isFavorite: boolean) => {
    try {
      if (isFavorite) {
        // Удаляем из избранного
        const response = await fetch(`/api/favorites/${symbol}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          await loadFavorites();
          await loadWatchlist();
        } else {
          const error = await response.json();
          throw new Error(error.detail || 'Ошибка удаления из избранного');
        }
      } else {
        // Добавляем в избранное
        const response = await fetch('/api/favorites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ symbol }),
        });
        if (response.ok) {
          await loadFavorites();
          await loadWatchlist();
        } else {
          const error = await response.json();
          throw new Error(error.detail || 'Ошибка добавления в избранное');
        }
      }
    } catch (error) {
      console.error('Ошибка переключения избранного:', error);
      alert(`Ошибка: ${error.message}`);
      throw error;
    }
  };

  // Проверяем, находится ли символ в избранном
  const isSymbolFavorite = (symbol: string): boolean => {
    return favorites.some(fav => fav.symbol === symbol);
  };

  const openTradingView = (symbol: string) => {
    const cleanSymbol = symbol.replace('USDT', '');
    const url = `https://www.tradingview.com/chart/?symbol=BYBIT:${cleanSymbol}USDT.P&interval=1`;
    window.open(url, '_blank');
  };

  const openPaperTrading = (symbol: string, price: number, alertId: number = 0) => {
    setTradingSymbol(symbol);
    setTradingPrice(price);
    setTradingAlertId(alertId);
    setShowPaperTrading(true);
  };

  const openRealTrading = (symbol: string, price: number, alertId: number = 0) => {
    setTradingSymbol(symbol);
    setTradingPrice(price);
    setTradingAlertId(alertId);
    setShowRealTrading(true);
  };

  const renderAlertRow = (alert: Alert) => {
    const isFavorite = isSymbolFavorite(alert.symbol);
    
    return (
      <div
        key={alert.id}
        className="bg-white rounded-lg shadow border-l-4 border-blue-500 p-4 hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => setSelectedAlert(alert)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`w-3 h-3 rounded-full ${
              alert.alert_type === 'volume_spike' ? 'bg-blue-500' :
              alert.alert_type === 'consecutive_long' ? 'bg-green-500' :
              alert.alert_type === 'priority' ? 'bg-purple-500' : 'bg-gray-500'
            }`}></div>
            
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-gray-900 text-lg">{alert.symbol}</span>
                {isFavorite && (
                  <Heart className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                )}
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  alert.alert_type === 'volume_spike' ? 'bg-blue-100 text-blue-800' :
                  alert.alert_type === 'consecutive_long' ? 'bg-green-100 text-green-800' :
                  alert.alert_type === 'priority' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {alert.alert_type === 'volume_spike' ? 'Превышение объема' :
                   alert.alert_type === 'consecutive_long' ? 'LONG последовательность' :
                   alert.alert_type === 'priority' ? 'Приоритетный' : 'Неизвестный'}
                </span>
                {alert.volume_ratio && (
                  <span className="text-blue-600">
                    x{alert.volume_ratio.toFixed(1)}
                  </span>
                )}
                {alert.consecutive_count && (
                  <span className="text-green-600">
                    {alert.consecutive_count} подряд
                  </span>
                )}
                {alert.has_imbalance && (
                  <span className="text-orange-500">⚠️ Имбаланс</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-xl font-bold text-gray-900">
              ${alert.price.toFixed(8)}
            </div>
            <div className="text-sm text-gray-600">
              <Clock className="w-3 h-3 inline mr-1" />
              {formatTime(alert.close_timestamp || alert.timestamp, timeZone)}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleFavorite(alert.symbol, isFavorite);
              }}
              className={`p-1 ${
                isFavorite
                  ? 'text-yellow-500 hover:text-yellow-600'
                  : 'text-gray-400 hover:text-yellow-500'
              }`}
              title={isFavorite ? "Удалить из избранного" : "Добавить в избранное"}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openPaperTrading(alert.symbol, alert.price, alert.id);
              }}
              className="text-green-600 hover:text-green-800 p-1"
              title="Бумажная торговля"
            >
              <Calculator className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openRealTrading(alert.symbol, alert.price, alert.id);
              }}
              className="text-purple-600 hover:text-purple-800 p-1"
              title="Реальная торговля"
            >
              <DollarSign className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openTradingView(alert.symbol);
              }}
              className="text-blue-600 hover:text-blue-800 p-1"
              title="Открыть в TradingView"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSmartMoneyAlertRow = (alert: SmartMoneyAlert) => {
    const isFavorite = isSymbolFavorite(alert.symbol);
    
    return (
      <div
        key={alert.id}
        className="bg-white rounded-lg shadow border-l-4 border-purple-500 p-4 hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => setSelectedSmartMoneyAlert(alert)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`w-3 h-3 rounded-full ${
              alert.direction === 'bullish' ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-gray-900 text-lg">{alert.symbol}</span>
                {isFavorite && (
                  <Heart className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                )}
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  alert.type === 'fair_value_gap' ? 'bg-blue-100 text-blue-800' :
                  alert.type === 'order_block' ? 'bg-green-100 text-green-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {alert.type === 'fair_value_gap' ? 'Fair Value Gap' :
                   alert.type === 'order_block' ? 'Order Block' : 'Breaker Block'}
                </span>
                <span className={`text-xs ${
                  alert.direction === 'bullish' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {alert.direction === 'bullish' ? 'Бычий' : 'Медвежий'}
                </span>
                <span className="text-purple-600">
                  Сила: {alert.strength.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-xl font-bold text-gray-900">
              ${alert.price.toFixed(8)}
            </div>
            <div className="text-sm text-gray-600">
              <Clock className="w-3 h-3 inline mr-1" />
              {formatTime(alert.timestamp, timeZone)}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleFavorite(alert.symbol, isFavorite);
              }}
              className={`p-1 ${
                isFavorite
                  ? 'text-yellow-500 hover:text-yellow-600'
                  : 'text-gray-400 hover:text-yellow-500'
              }`}
              title={isFavorite ? "Удалить из избранного" : "Добавить в избранное"}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openPaperTrading(alert.symbol, alert.price);
              }}
              className="text-green-600 hover:text-green-800 p-1"
              title="Бумажная торговля"
            >
              <Calculator className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openRealTrading(alert.symbol, alert.price);
              }}
              className="text-purple-600 hover:text-purple-800 p-1"
              title="Реальная торговля"
            >
              <DollarSign className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openTradingView(alert.symbol);
              }}
              className="text-blue-600 hover:text-blue-800 p-1"
              title="Открыть в TradingView"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderFavoriteRow = (favorite: FavoriteItem) => (
    <div
      key={favorite.id}
      className="bg-white rounded-lg shadow border-l-4 p-4 hover:shadow-md transition-shadow"
      style={{ borderLeftColor: favorite.color || '#FFD700' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className={`w-3 h-3 rounded-full ${favorite.is_active ? 'bg-green-500' : 'bg-red-500'}`}></div>
          
          <div>
            <span className="font-semibold text-gray-900 text-lg">{favorite.symbol}</span>
            <div className="flex items-center space-x-2 text-sm">
              <Heart className="w-3 h-3 text-yellow-500 fill-yellow-500" />
              <span className="text-gray-600">
                {favorite.is_active ? 'Активна' : 'Неактивна'}
              </span>
              {favorite.price_drop_percentage && (
                <span className="text-red-600">
                  Падение: {favorite.price_drop_percentage.toFixed(2)}%
                </span>
              )}
            </div>
            {favorite.notes && (
              <div className="text-xs text-gray-500 mt-1 max-w-xs truncate">
                {favorite.notes}
              </div>
            )}
          </div>
        </div>
        
        <div className="text-right">
          {favorite.current_price && (
            <div className="text-xl font-bold text-gray-900">
              ${favorite.current_price.toFixed(8)}
            </div>
          )}
          <div className="text-sm text-gray-600">
            {favorite.favorite_added_at && formatTime(favorite.favorite_added_at, timeZone)}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => openPaperTrading(favorite.symbol, favorite.current_price || 0)}
            className="text-green-600 hover:text-green-800 p-1"
            title="Бумажная торговля"
          >
            <Calculator className="w-4 h-4" />
          </button>
          <button
            onClick={() => openRealTrading(favorite.symbol, favorite.current_price || 0)}
            className="text-purple-600 hover:text-purple-800 p-1"
            title="Реальная торговля"
          >
            <DollarSign className="w-4 h-4" />
          </button>
          <button
            onClick={() => openTradingView(favorite.symbol)}
            className="text-blue-600 hover:text-blue-800 p-1"
            title="Открыть в TradingView"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  const getCurrentAlerts = () => {
    switch (activeTab) {
      case 'volume':
        return volumeAlerts;
      case 'consecutive':
        return consecutiveAlerts;
      case 'priority':
        return priorityAlerts;
      case 'smart_money':
        return smartMoneyAlerts;
      case 'favorites':
        return favorites;
      default:
        return [];
    }
  };

  const getTabCount = (tab: string) => {
    switch (tab) {
      case 'volume':
        return volumeAlerts.length;
      case 'consecutive':
        return consecutiveAlerts.length;
      case 'priority':
        return priorityAlerts.length;
      case 'smart_money':
        return smartMoneyAlerts.length;
      case 'favorites':
        return favorites.length;
      default:
        return 0;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadInitialData}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <BarChart3 className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Crypto Volume Analyzer</h1>
              <div className="flex items-center space-x-2">
                {connectionStatus === 'connected' ? (
                  <Wifi className="w-5 h-5 text-green-500" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-500" />
                )}
                <span className="text-sm text-gray-600">
                  {connectionStatus === 'connected' ? 'Подключено' : 'Отключено'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <TimeZoneToggle />
              
              {lastUpdate && (
                <span className="text-sm text-gray-500">
                  Обновлено: {formatTime(lastUpdate.toISOString(), timeZone, { includeDate: false, includeSeconds: true })}
                </span>
              )}
              
              <button
                onClick={() => setShowStreamData(true)}
                className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg transition-colors"
              >
                <TrendingUp className="w-4 h-4" />
                <span>Поток</span>
              </button>
              
              <button
                onClick={() => setShowFavorites(true)}
                className="flex items-center space-x-2 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded-lg transition-colors"
              >
                <Heart className="w-4 h-4" />
                <span>Избранное ({favorites.length})</span>
              </button>
              
              <button
                onClick={() => setShowWatchlist(true)}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition-colors"
              >
                <List className="w-4 h-4" />
                <span>Список ({watchlist.length})</span>
              </button>
              
              <button
                onClick={loadAlerts}
                className="text-gray-600 hover:text-gray-800 p-2"
                title="Обновить данные"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => setShowSettings(true)}
                className="text-gray-600 hover:text-gray-800 p-2"
                title="Настройки"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            {[
              { id: 'volume', label: 'Объемы', icon: TrendingUp },
              { id: 'consecutive', label: 'Последовательности', icon: TrendingDown },
              { id: 'priority', label: 'Приоритетные', icon: BarChart3 },
              { id: 'smart_money', label: 'Smart Money', icon: Brain },
              { id: 'favorites', label: 'Избранное', icon: Heart }
            ].map((tab) => {
              const Icon = tab.icon;
              const count = getTabCount(tab.id);
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      activeTab === tab.id
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {activeTab === 'smart_money' ? (
            smartMoneyAlerts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Brain className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Нет Smart Money сигналов</p>
              </div>
            ) : (
              smartMoneyAlerts.map(renderSmartMoneyAlertRow)
            )
          ) : activeTab === 'favorites' ? (
            favorites.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Heart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Нет избранных торговых пар</p>
                <p className="mt-2 text-sm">Добавьте пары в избранное, нажав на иконку сердечка в сигналах</p>
              </div>
            ) : (
              favorites.map(renderFavoriteRow)
            )
          ) : (
            getCurrentAlerts().length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Нет алертов</p>
              </div>
            ) : (
              getCurrentAlerts().map(renderAlertRow)
            )
          )}
        </div>
      </main>

      {/* Modals */}
      {selectedAlert && (
        <ChartSelector
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
        />
      )}

      {selectedSmartMoneyAlert && (
        <SmartMoneyChartModal
          alert={selectedSmartMoneyAlert}
          onClose={() => setSelectedSmartMoneyAlert(null)}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={handleSaveSettings}
        />
      )}

      {showWatchlist && (
        <WatchlistModal
          watchlist={watchlist}
          onClose={() => setShowWatchlist(false)}
          onUpdate={loadWatchlist}
          onToggleFavorite={handleToggleFavorite}
        />
      )}

      {showFavorites && (
        <FavoritesModal
          favorites={favorites}
          onClose={() => setShowFavorites(false)}
          onUpdate={loadFavorites}
        />
      )}

      {showStreamData && (
        <StreamDataModal
          streamData={streamData}
          connectionStatus={connectionStatus}
          onClose={() => setShowStreamData(false)}
        />
      )}

      {showPaperTrading && (
        <PaperTradingModal
          symbol={tradingSymbol}
          alertPrice={tradingPrice}
          alertId={tradingAlertId}
          onClose={() => setShowPaperTrading(false)}
        />
      )}

      {showRealTrading && (
        <RealTradingModal
          symbol={tradingSymbol}
          alertPrice={tradingPrice}
          alertId={tradingAlertId}
          onClose={() => setShowRealTrading(false)}
        />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <TimeZoneProvider>
      <AppContent />
    </TimeZoneProvider>
  );
};

export default App;