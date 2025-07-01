"""
API для управления бумажными сделками
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter()

class PaperTradeCreate(BaseModel):
    symbol: str
    alert_id: Optional[int] = None
    direction: str  # 'LONG' или 'SHORT'
    entry_price: float
    stop_loss: float
    take_profit: float
    quantity: float
    risk_amount: float
    risk_percentage: float
    position_value: float
    potential_loss: float
    potential_profit: float
    risk_reward_ratio: float
    status: str = 'planned'  # 'planned', 'active', 'closed'
    notes: Optional[str] = None

class PaperTradeUpdate(BaseModel):
    status: Optional[str] = None
    exit_price: Optional[float] = None
    exit_time: Optional[str] = None
    actual_profit_loss: Optional[float] = None
    notes: Optional[str] = None

def get_db_connection():
    """Получение подключения к базе данных"""
    conn = sqlite3.connect('crypto_analyzer.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_paper_trades_table():
    """Инициализация таблицы бумажных сделок"""
    conn = get_db_connection()
    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS paper_trades (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                alert_id INTEGER,
                direction TEXT NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
                entry_price REAL NOT NULL,
                stop_loss REAL NOT NULL,
                take_profit REAL NOT NULL,
                quantity REAL NOT NULL,
                risk_amount REAL NOT NULL,
                risk_percentage REAL NOT NULL,
                position_value REAL NOT NULL,
                potential_loss REAL NOT NULL,
                potential_profit REAL NOT NULL,
                risk_reward_ratio REAL NOT NULL,
                status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'closed')),
                exit_price REAL,
                exit_time TIMESTAMP,
                actual_profit_loss REAL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Добавляем индексы для оптимизации
        conn.execute('CREATE INDEX IF NOT EXISTS idx_paper_trades_symbol ON paper_trades(symbol)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_paper_trades_status ON paper_trades(status)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_paper_trades_created_at ON paper_trades(created_at)')
        
        conn.commit()
        logger.info("✅ Таблица paper_trades инициализирована")
    except Exception as e:
        logger.error(f"❌ Ошибка инициализации таблицы paper_trades: {e}")
        conn.rollback()
    finally:
        conn.close()

@router.get("/")
async def get_paper_trades(status: Optional[str] = None, symbol: Optional[str] = None):
    """Получить все бумажные сделки"""
    conn = get_db_connection()
    try:
        query = '''
            SELECT 
                id, symbol, alert_id, direction, entry_price, stop_loss, take_profit,
                quantity, risk_amount, risk_percentage, position_value,
                potential_loss, potential_profit, risk_reward_ratio,
                status, exit_price, exit_time, actual_profit_loss, notes,
                created_at, updated_at
            FROM paper_trades 
            WHERE 1=1
        '''
        params = []
        
        if status:
            query += ' AND status = ?'
            params.append(status)
        
        if symbol:
            query += ' AND symbol = ?'
            params.append(symbol.upper())
        
        query += ' ORDER BY created_at DESC'
        
        cursor = conn.execute(query, params)
        
        trades = []
        for row in cursor.fetchall():
            trades.append({
                'id': row['id'],
                'symbol': row['symbol'],
                'alert_id': row['alert_id'],
                'direction': row['direction'],
                'entry_price': row['entry_price'],
                'stop_loss': row['stop_loss'],
                'take_profit': row['take_profit'],
                'quantity': row['quantity'],
                'risk_amount': row['risk_amount'],
                'risk_percentage': row['risk_percentage'],
                'position_value': row['position_value'],
                'potential_loss': row['potential_loss'],
                'potential_profit': row['potential_profit'],
                'risk_reward_ratio': row['risk_reward_ratio'],
                'status': row['status'],
                'exit_price': row['exit_price'],
                'exit_time': row['exit_time'],
                'actual_profit_loss': row['actual_profit_loss'],
                'notes': row['notes'],
                'created_at': row['created_at'],
                'updated_at': row['updated_at']
            })
        
        logger.info(f"📋 Получено {len(trades)} бумажных сделок")
        return trades
        
    except Exception as e:
        logger.error(f"❌ Ошибка получения бумажных сделок: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка получения сделок: {str(e)}")
    finally:
        conn.close()

@router.post("/")
async def create_paper_trade(trade: PaperTradeCreate):
    """Создать новую бумажную сделку"""
    conn = get_db_connection()
    try:
        # Валидация данных
        if trade.direction not in ['LONG', 'SHORT']:
            raise HTTPException(status_code=400, detail="Направление должно быть LONG или SHORT")
        
        if trade.entry_price <= 0:
            raise HTTPException(status_code=400, detail="Цена входа должна быть больше 0")
        
        if trade.quantity <= 0:
            raise HTTPException(status_code=400, detail="Количество должно быть больше 0")
        
        # Валидация логики стоп-лосса и тейк-профита
        if trade.direction == 'LONG':
            if trade.stop_loss >= trade.entry_price:
                raise HTTPException(status_code=400, detail="Для LONG стоп-лосс должен быть меньше цены входа")
            if trade.take_profit <= trade.entry_price:
                raise HTTPException(status_code=400, detail="Для LONG тейк-профит должен быть больше цены входа")
        else:  # SHORT
            if trade.stop_loss <= trade.entry_price:
                raise HTTPException(status_code=400, detail="Для SHORT стоп-лосс должен быть больше цены входа")
            if trade.take_profit >= trade.entry_price:
                raise HTTPException(status_code=400, detail="Для SHORT тейк-профит должен быть меньше цены входа")
        
        # Создаем сделку
        cursor = conn.execute('''
            INSERT INTO paper_trades (
                symbol, alert_id, direction, entry_price, stop_loss, take_profit,
                quantity, risk_amount, risk_percentage, position_value,
                potential_loss, potential_profit, risk_reward_ratio,
                status, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            trade.symbol.upper(),
            trade.alert_id,
            trade.direction,
            trade.entry_price,
            trade.stop_loss,
            trade.take_profit,
            trade.quantity,
            trade.risk_amount,
            trade.risk_percentage,
            trade.position_value,
            trade.potential_loss,
            trade.potential_profit,
            trade.risk_reward_ratio,
            trade.status,
            trade.notes,
            datetime.utcnow().isoformat(),
            datetime.utcnow().isoformat()
        ))
        
        conn.commit()
        trade_id = cursor.lastrowid
        
        logger.info(f"✅ Создана бумажная сделка: {trade.symbol} {trade.direction} ID={trade_id}")
        
        return {
            'id': trade_id,
            'symbol': trade.symbol.upper(),
            'direction': trade.direction,
            'message': f'{trade.direction} бумажная сделка для {trade.symbol} создана'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка создания бумажной сделки: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка создания сделки: {str(e)}")
    finally:
        conn.close()

@router.put("/{trade_id}")
async def update_paper_trade(trade_id: int, trade_update: PaperTradeUpdate):
    """Обновить бумажную сделку"""
    conn = get_db_connection()
    try:
        # Проверяем существование сделки
        cursor = conn.execute('SELECT id FROM paper_trades WHERE id = ?', (trade_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail=f"Сделка с ID {trade_id} не найдена")
        
        # Обновляем данные
        update_fields = []
        params = []
        
        if trade_update.status is not None:
            if trade_update.status not in ['planned', 'active', 'closed']:
                raise HTTPException(status_code=400, detail="Неверный статус сделки")
            update_fields.append('status = ?')
            params.append(trade_update.status)
        
        if trade_update.exit_price is not None:
            update_fields.append('exit_price = ?')
            params.append(trade_update.exit_price)
        
        if trade_update.exit_time is not None:
            update_fields.append('exit_time = ?')
            params.append(trade_update.exit_time)
        
        if trade_update.actual_profit_loss is not None:
            update_fields.append('actual_profit_loss = ?')
            params.append(trade_update.actual_profit_loss)
        
        if trade_update.notes is not None:
            update_fields.append('notes = ?')
            params.append(trade_update.notes)
        
        if update_fields:
            update_fields.append('updated_at = ?')
            params.append(datetime.utcnow().isoformat())
            params.append(trade_id)
            
            query = f"UPDATE paper_trades SET {', '.join(update_fields)} WHERE id = ?"
            conn.execute(query, params)
            conn.commit()
        
        logger.info(f"✅ Обновлена бумажная сделка ID={trade_id}")
        return {'message': f'Сделка {trade_id} обновлена'}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка обновления бумажной сделки: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка обновления сделки: {str(e)}")
    finally:
        conn.close()

@router.delete("/{trade_id}")
async def delete_paper_trade(trade_id: int):
    """Удалить бумажную сделку"""
    conn = get_db_connection()
    try:
        # Проверяем существование сделки
        cursor = conn.execute('SELECT id FROM paper_trades WHERE id = ?', (trade_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail=f"Сделка с ID {trade_id} не найдена")
        
        # Удаляем сделку
        conn.execute('DELETE FROM paper_trades WHERE id = ?', (trade_id,))
        conn.commit()
        
        logger.info(f"✅ Удалена бумажная сделка ID={trade_id}")
        return {'message': f'Сделка {trade_id} удалена'}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка удаления бумажной сделки: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка удаления сделки: {str(e)}")
    finally:
        conn.close()

@router.get("/stats")
async def get_paper_trading_stats():
    """Получить статистику бумажной торговли"""
    conn = get_db_connection()
    try:
        # Общая статистика
        cursor = conn.execute('''
            SELECT 
                COUNT(*) as total_trades,
                COUNT(CASE WHEN status = 'planned' THEN 1 END) as planned_trades,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_trades,
                COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_trades,
                SUM(CASE WHEN status = 'closed' AND actual_profit_loss > 0 THEN 1 ELSE 0 END) as winning_trades,
                SUM(CASE WHEN status = 'closed' AND actual_profit_loss < 0 THEN 1 ELSE 0 END) as losing_trades,
                SUM(CASE WHEN status = 'closed' THEN actual_profit_loss ELSE 0 END) as total_pnl,
                AVG(CASE WHEN status = 'closed' THEN actual_profit_loss ELSE NULL END) as avg_pnl,
                SUM(risk_amount) as total_risk_amount
            FROM paper_trades
        ''')
        
        stats = dict(cursor.fetchone())
        
        # Статистика по символам
        cursor = conn.execute('''
            SELECT 
                symbol,
                COUNT(*) as trades_count,
                SUM(CASE WHEN status = 'closed' THEN actual_profit_loss ELSE 0 END) as symbol_pnl
            FROM paper_trades
            GROUP BY symbol
            ORDER BY trades_count DESC
            LIMIT 10
        ''')
        
        symbol_stats = [dict(row) for row in cursor.fetchall()]
        
        # Статистика по направлениям
        cursor = conn.execute('''
            SELECT 
                direction,
                COUNT(*) as trades_count,
                SUM(CASE WHEN status = 'closed' THEN actual_profit_loss ELSE 0 END) as direction_pnl,
                AVG(CASE WHEN status = 'closed' THEN actual_profit_loss ELSE NULL END) as avg_pnl
            FROM paper_trades
            GROUP BY direction
        ''')
        
        direction_stats = [dict(row) for row in cursor.fetchall()]
        
        return {
            'general': stats,
            'by_symbol': symbol_stats,
            'by_direction': direction_stats
        }
        
    except Exception as e:
        logger.error(f"❌ Ошибка получения статистики: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка получения статистики: {str(e)}")
    finally:
        conn.close()

# Инициализируем таблицу при импорте модуля
init_paper_trades_table()