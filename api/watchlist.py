"""
API для управления списком наблюдения (watchlist)
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter()

class WatchlistCreate(BaseModel):
    symbol: str

class WatchlistUpdate(BaseModel):
    id: int
    symbol: str
    is_active: bool

def get_db_connection():
    """Получение подключения к базе данных"""
    conn = sqlite3.connect('crypto_analyzer.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_watchlist_table():
    """Инициализация таблицы watchlist"""
    conn = get_db_connection()
    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS watchlist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT UNIQUE NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                price_drop_percentage REAL,
                current_price REAL,
                historical_price REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Добавляем колонку is_favorite если её нет
        try:
            conn.execute('ALTER TABLE watchlist ADD COLUMN is_favorite BOOLEAN DEFAULT FALSE')
        except sqlite3.OperationalError:
            # Колонка уже существует
            pass
        
        # Добавляем индексы для оптимизации
        conn.execute('CREATE INDEX IF NOT EXISTS idx_watchlist_symbol ON watchlist(symbol)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_watchlist_active ON watchlist(is_active)')
        
        conn.commit()
        logger.info("✅ Таблица watchlist инициализирована")
    except Exception as e:
        logger.error(f"❌ Ошибка инициализации таблицы watchlist: {e}")
        conn.rollback()
    finally:
        conn.close()

def update_watchlist_favorites():
    """Обновляем статус is_favorite в watchlist на основе таблицы favorites"""
    conn = get_db_connection()
    try:
        # Сначала сбрасываем все флаги
        conn.execute('UPDATE watchlist SET is_favorite = FALSE')
        
        # Затем устанавливаем флаги для пар, которые есть в favorites
        conn.execute('''
            UPDATE watchlist 
            SET is_favorite = TRUE 
            WHERE symbol IN (SELECT symbol FROM favorites)
        ''')
        
        conn.commit()
        logger.debug("✅ Обновлены флаги избранного в watchlist")
    except Exception as e:
        logger.error(f"❌ Ошибка обновления флагов избранного: {e}")
        conn.rollback()
    finally:
        conn.close()

@router.get("/")
async def get_watchlist():
    """Получить весь список наблюдения"""
    conn = get_db_connection()
    try:
        # Обновляем флаги избранного перед возвратом данных
        update_watchlist_favorites()
        
        cursor = conn.execute('''
            SELECT 
                id, symbol, is_active, is_favorite, price_drop_percentage, 
                current_price, historical_price, created_at, updated_at
            FROM watchlist 
            ORDER BY is_favorite DESC, symbol ASC
        ''')
        
        watchlist = []
        for row in cursor.fetchall():
            watchlist.append({
                'id': row['id'],
                'symbol': row['symbol'],
                'is_active': bool(row['is_active']),
                'is_favorite': bool(row['is_favorite']),
                'price_drop_percentage': row['price_drop_percentage'],
                'current_price': row['current_price'],
                'historical_price': row['historical_price'],
                'created_at': row['created_at'],
                'updated_at': row['updated_at']
            })
        
        logger.info(f"📋 Получен watchlist: {len(watchlist)} пар")
        return watchlist
        
    except Exception as e:
        logger.error(f"❌ Ошибка получения watchlist: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка получения списка: {str(e)}")
    finally:
        conn.close()

@router.post("/")
async def add_to_watchlist(item: WatchlistCreate):
    """Добавить пару в список наблюдения"""
    conn = get_db_connection()
    try:
        # Проверяем, не существует ли уже такая пара
        cursor = conn.execute('SELECT id FROM watchlist WHERE symbol = ?', (item.symbol.upper(),))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail=f"Пара {item.symbol} уже в списке наблюдения")
        
        # Добавляем новую пару
        cursor = conn.execute('''
            INSERT INTO watchlist (symbol, created_at, updated_at)
            VALUES (?, ?, ?)
        ''', (
            item.symbol.upper(),
            datetime.utcnow().isoformat(),
            datetime.utcnow().isoformat()
        ))
        
        conn.commit()
        watchlist_id = cursor.lastrowid
        
        logger.info(f"✅ Добавлена пара в watchlist: {item.symbol}")
        
        return {
            'id': watchlist_id,
            'symbol': item.symbol.upper(),
            'message': f'Пара {item.symbol} добавлена в список наблюдения'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка добавления в watchlist: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка добавления в список: {str(e)}")
    finally:
        conn.close()

@router.put("/{item_id}")
async def update_watchlist_item(item_id: int, item: WatchlistUpdate):
    """Обновить элемент списка наблюдения"""
    conn = get_db_connection()
    try:
        # Проверяем существование элемента
        cursor = conn.execute('SELECT id FROM watchlist WHERE id = ?', (item_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail=f"Элемент с ID {item_id} не найден")
        
        # Обновляем данные
        conn.execute('''
            UPDATE watchlist 
            SET symbol = ?, is_active = ?, updated_at = ?
            WHERE id = ?
        ''', (
            item.symbol.upper(),
            item.is_active,
            datetime.utcnow().isoformat(),
            item_id
        ))
        
        conn.commit()
        
        logger.info(f"✅ Обновлен элемент watchlist ID={item_id}: {item.symbol}")
        return {'message': f'Элемент {item.symbol} обновлен'}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка обновления watchlist: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка обновления элемента: {str(e)}")
    finally:
        conn.close()

@router.delete("/{item_id}")
async def remove_from_watchlist(item_id: int):
    """Удалить пару из списка наблюдения"""
    conn = get_db_connection()
    try:
        # Проверяем существование элемента
        cursor = conn.execute('SELECT symbol FROM watchlist WHERE id = ?', (item_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Элемент с ID {item_id} не найден")
        
        symbol = row['symbol']
        
        # Удаляем элемент
        conn.execute('DELETE FROM watchlist WHERE id = ?', (item_id,))
        conn.commit()
        
        logger.info(f"✅ Удален элемент из watchlist: {symbol}")
        return {'message': f'Пара {symbol} удалена из списка наблюдения'}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка удаления из watchlist: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка удаления элемента: {str(e)}")
    finally:
        conn.close()

# Инициализируем таблицу при импорте модуля
init_watchlist_table()