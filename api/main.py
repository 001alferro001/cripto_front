"""
Главный файл FastAPI приложения
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import logging
import os

# Импортируем роутеры
from api.favorites import router as favorites_router
from api.paper_trades import router as paper_trades_router
from api.watchlist import router as watchlist_router

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Создаем приложение FastAPI
app = FastAPI(
    title="Crypto Volume Analyzer API",
    description="API для анализа объемов криптовалют",
    version="1.0.0"
)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене указать конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем роутеры
app.include_router(favorites_router, prefix="/api/favorites", tags=["favorites"])
app.include_router(paper_trades_router, prefix="/api/paper-trades", tags=["paper-trades"])
app.include_router(watchlist_router, prefix="/api/watchlist", tags=["watchlist"])

# Заглушки для других API endpoints (если они еще не реализованы)
@app.get("/api/alerts/all")
async def get_all_alerts():
    """Заглушка для получения всех алертов"""
    return {
        "volume_alerts": [],
        "consecutive_alerts": [],
        "priority_alerts": [],
        "smart_money_alerts": []
    }

@app.get("/api/settings")
async def get_settings():
    """Заглушка для получения настроек"""
    return {
        "volume_analyzer": {
            "analysis_hours": 1,
            "offset_minutes": 0,
            "volume_multiplier": 2.0,
            "min_volume_usdt": 1000,
            "consecutive_long_count": 5,
            "alert_grouping_minutes": 5,
            "data_retention_hours": 2,
            "update_interval_seconds": 1,
            "notification_enabled": True,
            "volume_type": "long"
        },
        "alerts": {
            "volume_alerts_enabled": True,
            "consecutive_alerts_enabled": True,
            "priority_alerts_enabled": True
        },
        "imbalance": {
            "fair_value_gap_enabled": True,
            "order_block_enabled": True,
            "breaker_block_enabled": True,
            "min_gap_percentage": 0.1,
            "min_strength": 0.5
        },
        "orderbook": {
            "enabled": False,
            "snapshot_on_alert": False
        },
        "telegram": {
            "enabled": False
        },
        "trading": {
            "account_balance": 10000,
            "max_risk_per_trade": 2,
            "max_open_trades": 5,
            "default_stop_loss_percentage": 2,
            "default_take_profit_percentage": 6,
            "auto_calculate_quantity": True,
            "enable_real_trading": False,
            "default_leverage": 1,
            "default_margin_type": "isolated",
            "confirm_trades": True
        }
    }

@app.post("/api/settings")
async def save_settings(settings: dict):
    """Заглушка для сохранения настроек"""
    logger.info("Настройки сохранены")
    return {"message": "Настройки сохранены"}

@app.get("/api/chart-data/{symbol}")
async def get_chart_data(symbol: str, interval: str = "1m", hours: int = 24):
    """Заглушка для получения данных графика"""
    # Возвращаем пустой массив, чтобы фронтенд переключился на mock данные
    return {"chart_data": []}

# Статические файлы (для фронтенда)
if os.path.exists("dist"):
    app.mount("/static", StaticFiles(directory="dist"), name="static")
    
    @app.get("/")
    async def read_index():
        return FileResponse('dist/index.html')

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)