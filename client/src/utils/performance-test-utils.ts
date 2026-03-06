/**
 * 🧪 Примеры для тестирования производительности
 * 
 * Используйте эти функции для генерирования тестовых данных с разным количеством маркеров
 * для проверки производительности Canvas и DOM рендеринга.
 */

import type { Location } from '@shared/schema';
import { nanoid } from 'nanoid';

type LocationType = 'workstation' | 'meeting-room' | 'socket' | 'equipment' | 'camera' | 'ac' | 'common-area';
type LocationStatus = 'available' | 'occupied' | 'maintenance';

/**
 * Генерирует случайные координаты на карте этажа
 */
function getRandomCoordinates(): { x: number; y: number } {
  return {
    x: Math.random() * 100,
    y: Math.random() * 100,
  };
}

/**
 * Генерирует случайный статус локации
 */
function getRandomStatus(): LocationStatus {
  const statuses: LocationStatus[] = ['available', 'occupied', 'maintenance'];
  return statuses[Math.floor(Math.random() * statuses.length)];
}

/**
 * Генерирует случайный тип локации
 */
function getRandomType(): LocationType {
  const types: LocationType[] = [
    'workstation',
    'meeting-room',
    'socket',
    'equipment',
    'camera',
    'ac',
    'common-area',
  ];
  return types[Math.floor(Math.random() * types.length)];
}

/**
 * Генерирует массив случайных локаций
 * 
 * @param count - количество локаций для генерирования
 * @param floor - номер этажа (по умолчанию "5")
 * @returns Массив объектов Location
 */
export function generateTestLocations(count: number, floor: string = '5'): Location[] {
  const locations: Location[] = [];

  for (let i = 0; i < count; i++) {
    const type = getRandomType();
    const coords = getRandomCoordinates();
    const status = getRandomStatus();

    const location: Location = {
      id: nanoid(),
      name: `${type}-${i + 1}`,
      type,
      status,
      floor,
      x: coords.x,
      y: coords.y,
      width: 80,
      height: 60,
      capacity: type === 'meeting-room' ? Math.floor(Math.random() * 20) + 2 : null,
      employee: type === 'workstation' ? `Employee ${i + 1}` : null,
      equipment: type === 'equipment' ? 'Printer' : null,
      inventoryId: null,
      customColor: null,
      customFields: 
        type === 'socket' 
          ? {
              port: `eth0/${(i % 48) + 1}`,
              Status: status === 'available' ? 'connected' : status === 'occupied' ? 'notconnected' : 'disabled',
              StatusLastSync: new Date().toISOString(),
            }
          : {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    locations.push(location);
  }

  return locations;
}

/**
 * Сценарии для тестирования
 */
export const performanceTestScenarios = {
  /**
   * 🟢 GREEN: Малое количество маркеров
   * Оба режима (DOM и Canvas) работают на отлично
   */
  small: {
    name: 'Маленькое количество (50 маркеров)',
    count: 50,
    description: 'FPS: 55+, TTI: <1s, Memory: <100MB',
    expectedMetrics: {
      fps: '55+',
      tti: '<1s',
      memory: '<100MB',
    },
  },

  /**
   * 🟡 YELLOW: Среднее количество маркеров
   * DOM может начать показывать узкие места
   */
  medium: {
    name: 'Среднее количество (100 маркеров)',
    count: 100,
    description: 'FPS: 40-50, TTI: 1-2s, Memory: 120-150MB',
    expectedMetrics: {
      fps: '40-50',
      tti: '1-2s',
      memory: '120-150MB',
    },
  },

  /**
   * 🔴 RED: Большое количество маркеров
   * DOM рендеринг становится узким местом
   * Canvas должен показать преимущество
   */
  large: {
    name: 'Большое количество (150 маркеров)',
    count: 150,
    description: 'DOM: 25-35 FPS, Canvas: 45-55 FPS',
    expectedMetrics: {
      fps: 'DOM: 25-35, Canvas: 45-55',
      tti: '2-3s',
      memory: 'DOM: 180-220MB, Canvas: 100-130MB',
    },
  },

  /**
   * 🔴 CRITICAL: Очень большое количество маркеров
   * DOM практически невозможно использовав
   * Canvas - единственный вариант
   */
  veryLarge: {
    name: 'Очень большое количество (300+ маркеров)',
    count: 300,
    description: 'DOM: 10-15 FPS (неиспользуемо), Canvas: 40-50 FPS',
    expectedMetrics: {
      fps: 'DOM: 10-15 (bad), Canvas: 40-50',
      tti: '3-5s',
      memory: 'DOM: 400+MB, Canvas: 150-200MB',
    },
  },
};

/**
 * Инструмент для профилирования производительности
 * Используйте в консоли браузера
 */
export class PerformanceProfiler {
  private startTime: number = 0;
  private startMemory: number = 0;

  /**
   * Начать профилирование
   */
  start() {
    this.startTime = performance.now();
    if ((performance as any).memory) {
      this.startMemory = (performance as any).memory.usedJSHeapSize;
    }
    console.log('⏱️ Профилирование начато...');
  }

  /**
   * Завершить профилирование и вывести результаты
   */
  end(label: string = 'Операция') {
    const duration = performance.now() - this.startTime;
    const memoryUsed = (performance as any).memory 
      ? (performance as any).memory.usedJSHeapSize - this.startMemory
      : 0;

    console.group(`📊 Результаты: ${label}`);
    console.log(`⏱️  Время: ${duration.toFixed(2)}ms`);
    if (memoryUsed !== 0) {
      console.log(
        `💾 Память: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB`
      );
    }
    console.groupEnd();
  }

  /**
   * Измерить FPS за N секунд
   */
  static measureFPS(duration: number = 5): Promise<number> {
    return new Promise((resolve) => {
      let frameCount = 0;
      let lastTime = performance.now();

      const countFrame = () => {
        frameCount++;
        const currentTime = performance.now();

        if (currentTime - lastTime >= duration * 1000) {
          const fps = (frameCount / ((currentTime - lastTime) / 1000)).toFixed(1);
          console.log(`📊 FPS за ${duration}s: ${fps}`);
          resolve(parseFloat(fps as string));
        } else {
          requestAnimationFrame(countFrame);
        }
      };

      requestAnimationFrame(countFrame);
    });
  }
}

/**
 * Как использовать:
 * 
 * 1. Генерировать тестовые данные:
 *    const testData = generateTestLocations(100);
 * 
 * 2. Профилировать:
 *    const profiler = new PerformanceProfiler();
 *    profiler.start();
 *    // ... какая-то операция ...
 *    profiler.end('Render 100 markers');
 * 
 * 3. Измерить FPS:
 *    const fps = await PerformanceProfiler.measureFPS(5);
 * 
 * 4. Сценарии тестирования:
 *    Object.values(performanceTestScenarios).forEach(scenario => {
 *      console.log(scenario.name, scenario.description);
 *    });
 */
