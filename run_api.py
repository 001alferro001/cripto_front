"""
Скрипт для запуска API сервера
"""
import uvicorn
import logging

if __name__ == "__main__":
    # Настройка логирования
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    print("🚀 Запуск API сервера...")
    print("📡 API будет доступен по адресу: http://localhost:8000")
    print("📚 Документация API: http://localhost:8000/docs")
    print("🔄 Для остановки нажмите Ctrl+C")
    
    # Запускаем сервер
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Автоперезагрузка при изменении кода
        log_level="info"
    )