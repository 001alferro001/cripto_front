"""
API для управления избранными торговыми парами
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter()

class FavoriteCreate(BaseModel):
    symbol: str
    notes: Optional[str] = None
    color: Optional[str] = "#FFD700"

class FavoriteUpdate(BaseModel):
    notes: Optional[str] = None
    color: Optional[str] = None

class FavoriteReorder(BaseModel):
    symbol_order: List[str]

def get_db_connection():
    """Получение подключения к базе данных"""
    conn = sqlite3.connect('crypto_analyzer.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_favorites_table():
    """Инициализация таблицы избранного"""
    conn = get_db_connection()
    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS favorites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT UNIQUE NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                price_drop_percentage REAL,
                current_price REAL,
                historical_price REAL,
                notes TEXT,
                color TEXT DEFAULT '#FFD700',
                sort_order INTEGER DEFAULT 0,
                favorite_added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Добавляем индексы для оптимизации
        conn.execute('CREATE INDEX IF NOT EXISTS idx_favorites_symbol ON favorites(symbol)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_favorites_sort_order ON favorites(sort_order)')
        
        conn.commit()
        logger.info("✅ Таблица favorites инициализирована")
    except Exception as e:
        logger.error(f"❌ Ошибка инициализации таблицы favorites: {e}")
        conn.rollback()
    finally:
        conn.close()

@router.get("/")
async def get_favorites():
    """Получить все избранные пары"""
    conn = get_db_connection()
    try:
        cursor = conn.execute('''
            SELECT 
                id, symbol, is_active, price_drop_percentage, 
                current_price, historical_price, notes, color, 
                sort_order, favorite_added_at, created_at, updated_at
            FROM favorites 
            ORDER BY sort_order ASC, favorite_added_at DESC
        ''')
        
        favorites = []
        for row in cursor.fetchall():
            favorites.append({
                'id': row['id'],
                'symbol': row['symbol'],
                'is_active': bool(row['is_active']),
                'price_drop_percentage': row['price_drop_percentage'],
                'current_price': row['current_price'],
                'historical_price': row['historical_price'],
                'notes': row['notes'],
                'color': row['color'] or '#FFD700',
                'sort_order': row['sort_order'] or 0,
                'favorite_added_at': row['favorite_added_at'],
                'created_at': row['created_at'],
                'updated_at': row['updated_at']
            })
        
        logger.info(f"📋 Получено {len(favorites)} избранных пар")
        return favorites
        
    except Exception as e:
        logger.error(f"❌ Ошибка получения избранного: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка получения избранного: {str(e)}")
    finally:
        conn.close()

@router.post("/")
async def add_favorite(favorite: FavoriteCreate):
    """Добавить пару в избранное"""
    conn = get_db_connection()
    try:
        # Проверяем, не существует ли уже такая пара
        cursor = conn.execute('SELECT id FROM favorites WHERE symbol = ?', (favorite.symbol,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail=f"Пара {favorite.symbol} уже в избранном")
        
        # Получаем максимальный sort_order
        cursor = conn.execute('SELECT MAX(sort_order) as max_order FROM favorites')
        max_order = cursor.fetchone()['max_order'] or 0
        
        # Добавляем новую пару
        cursor = conn.execute('''
            INSERT INTO favorites (symbol, notes, color, sort_order, favorite_added_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            favorite.symbol.upper(),
            favorite.notes,
            favorite.color or '#FFD700',
            max_order + 1,
            datetime.utcnow().isoformat()
        ))
        
        conn.commit()
        favorite_id = cursor.lastrowid
        
        logger.info(f"✅ Добавлена пара в избранное: {favorite.symbol}")
        
        return {
            'id': favorite_id,
            'symbol': favorite.symbol.upper(),
            'message': f'Пара {favorite.symbol} добавлена в избранное'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка добавления в избранное: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка добавления в избранное: {str(e)}")
    finally:
        conn.close()

@router.put("/{symbol}")
async def update_favorite(symbol: str, favorite: FavoriteUpdate):
    """Обновить избранную пару"""
    conn = get_db_connection()
    try:
        # Проверяем существование пары
        cursor = conn.execute('SELECT id FROM favorites WHERE symbol = ?', (symbol.upper(),))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail=f"Пара {symbol} не найдена в избранном")
        
        # Обновляем данные
        update_fields = []
        params = []
        
        if favorite.notes is not None:
            update_fields.append('notes = ?')
            params.append(favorite.notes)
        
        if favorite.color is not None:
            update_fields.append('color = ?')
            params.append(favorite.color)
        
        if update_fields:
            update_fields.append('updated_at = ?')
            params.append(datetime.utcnow().isoformat())
            params.append(symbol.upper())
            
            query = f"UPDATE favorites SET {', '.join(update_fields)} WHERE symbol = ?"
            conn.execute(query, params)
            conn.commit()
        
        logger.info(f"✅ Обновлена избранная пара: {symbol}")
        return {'message': f'Пара {symbol} обновлена'}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка обновления избранного: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка обновления избранного: {str(e)}")
    finally:
        conn.close()

@router.delete("/{symbol}")
async def remove_favorite(symbol: str):
    """Удалить пару из избранного"""
    conn = get_db_connection()
    try:
        # Проверяем существование пары
        cursor = conn.execute('SELECT id FROM favorites WHERE symbol = ?', (symbol.upper(),))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail=f"Пара {symbol} не найдена в избранном")
        
        # Удаляем пару
        conn.execute('DELETE FROM favorites WHERE symbol = ?', (symbol.upper(),))
        conn.commit()
        
        logger.info(f"✅ Удалена пара из избранного: {symbol}")
        return {'message': f'Пара {symbol} удалена из избранного'}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка удаления из избранного: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка удаления из избранного: {str(e)}")
    finally:
        conn.close()

@router.post("/reorder")
async def reorder_favorites(reorder: FavoriteReorder):
    """Изменить порядок избранных пар"""
    conn = get_db_connection()
    try:
        # Обновляем порядок для каждой пары
        for index, symbol in enumerate(reorder.symbol_order):
            conn.execute(
                'UPDATE favorites SET sort_order = ?, updated_at = ? WHERE symbol = ?',
                (index, datetime.utcnow().isoformat(), symbol.upper())
            )
        
        conn.commit()
        logger.info(f"✅ Обновлен порядок {len(reorder.symbol_order)} избранных пар")
        return {'message': 'Порядок избранного обновлен'}
        
    except Exception as e:
        logger.error(f"❌ Ошибка изменения порядка избранного: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка изменения порядка: {str(e)}")
    finally:
        conn.close()

# Инициализируем таблицу при импорте модуля
init_favorites_table()