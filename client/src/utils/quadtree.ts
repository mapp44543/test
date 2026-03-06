/**
 * Quadtree для оптимизированного поиска маркеров
 * 
 * Цель: заменить O(n) перебор всех маркеров на O(log n) поиск через Quadtree
 * 
 * Использование:
 * ```
 * const quadtree = new Quadtree(0, 0, imageWidth, imageHeight);
 * markers.forEach(marker => quadtree.insert(marker));
 * const found = quadtree.query(clickX, clickY, searchRadius);
 * ```
 */

export interface QuadtreeItem {
  id: string;
  x: number;
  y: number;
  radius: number;
}

interface Bounds {
  x: number;
  y: number;
  x2: number;
  y2: number;
}

interface QuadNode {
  bounds: Bounds;
  children: QuadNode[];
  items: QuadtreeItem[];
  level: number;
}

/**
 * Quadtree пространственный индекс
 * Разделяет пространство на 4 квадранта для быстрого поиска объектов
 */
export class Quadtree {
  private root: QuadNode;
  private readonly maxItems: number = 4; // Максимум items в узле перед разделением
  private readonly maxLevels: number = 8; // Максимальная глубина дерева

  /**
   * Создаёт новое Quadtree
   * @param x - левая координата
   * @param y - верхняя координата
   * @param width - ширина
   * @param height - высота
   */
  constructor(x: number, y: number, width: number, height: number) {
    this.root = {
      bounds: { x, y, x2: x + width, y2: y + height },
      children: [],
      items: [],
      level: 0,
    };
  }

  /**
   * Вставляет элемент в quadtree
   * @param item - элемент с координатами и радиусом
   */
  insert(item: QuadtreeItem): void {
    this._insert(this.root, item);
  }

  /**
   * Запрашивает все элементы в радиусе от позиции
   * @param x - x координата центра поиска
   * @param y - y координата центра поиска
   * @param searchRadius - радиус поиска
   * @returns массив ID найденных элементов
   */
  query(x: number, y: number, searchRadius: number): string[] {
    const results: string[] = [];
    this._query(this.root, x, y, searchRadius, results);
    return results;
  }

  /**
   * Очищает все элементы из quadtree
   */
  clear(): void {
    this.root = {
      bounds: this.root.bounds,
      children: [],
      items: [],
      level: 0,
    };
  }

  /**
   * Пересоздаёт quadtree на основе новых bounds
   */
  rebuild(x: number, y: number, width: number, height: number): void {
    this.root = {
      bounds: { x, y, x2: x + width, y2: y + height },
      children: [],
      items: [],
      level: 0,
    };
  }

  /**
   * Получает статистику дерева для отладки
   */
  getStats(): { nodeCount: number; totalItems: number; maxDepth: number } {
    let nodeCount = 0;
    let totalItems = 0;
    let maxDepth = 0;

    const traverse = (node: QuadNode) => {
      nodeCount++;
      maxDepth = Math.max(maxDepth, node.level);
      totalItems += node.items.length;
      node.children.forEach(traverse);
    };

    traverse(this.root);
    return { nodeCount, totalItems, maxDepth };
  }

  // ============ PRIVATE METHODS ============

  private _insert(node: QuadNode, item: QuadtreeItem): void {
    const { bounds, items, children, level } = node;

    // Проверяем, помещается ли item в этот узел
    // item должен полностью находиться в bounds узла
    if (
      item.x - item.radius < bounds.x ||
      item.x + item.radius > bounds.x2 ||
      item.y - item.radius < bounds.y ||
      item.y + item.radius > bounds.y2
    ) {
      // Item выходит за границы этого узла - не вставляем
      return;
    }

    // Если в узле мало элементов или мы на максимальной глубине, добавляем сюда
    if (items.length < this.maxItems || level === this.maxLevels) {
      items.push(item);
      return;
    }

    // Если у нас нет детей, разделяем узел
    if (children.length === 0) {
      this._subdivide(node);
    }

    // Пытаемся вставить в детские узлы
    for (const child of children) {
      this._insert(child, item);
    }
  }

  private _query(
    node: QuadNode,
    x: number,
    y: number,
    searchRadius: number,
    results: string[]
  ): void {
    const { bounds, items, children } = node;

    // Проверяем пересечение AABB (axis-aligned bounding box) узла с кругом поиска
    // Если нет пересечения, узел можно пропустить
    if (!this._circleRectIntersects(bounds, x, y, searchRadius)) {
      return;
    }

    // Проверяем items в этом узле
    for (const item of items) {
      const distance = Math.hypot(item.x - x, item.y - y);
      // Если расстояние меньше суммы радиусов, маркер найден
      if (distance < item.radius + searchRadius) {
        results.push(item.id);
      }
    }

    // Рекурсивно проверяем детские узлы
    for (const child of children) {
      this._query(child, x, y, searchRadius, results);
    }
  }

  private _subdivide(node: QuadNode): void {
    const { bounds, level } = node;
    const x = bounds.x;
    const y = bounds.y;
    const w = (bounds.x2 - bounds.x) / 2;
    const h = (bounds.y2 - bounds.y) / 2;

    // Создаём 4 дочерних узла (NE, SE, SW, NW)
    node.children = [
      // North-East (верхний правый)
      {
        bounds: { x: x + w, y, x2: x + w * 2, y2: y + h },
        children: [],
        items: [],
        level: level + 1,
      },
      // South-East (нижний правый)
      {
        bounds: { x: x + w, y: y + h, x2: x + w * 2, y2: y + h * 2 },
        children: [],
        items: [],
        level: level + 1,
      },
      // South-West (нижний левый)
      {
        bounds: { x, y: y + h, x2: x + w, y2: y + h * 2 },
        children: [],
        items: [],
        level: level + 1,
      },
      // North-West (верхний левый)
      {
        bounds: { x, y, x2: x + w, y2: y + h },
        children: [],
        items: [],
        level: level + 1,
      },
    ];
  }

  /**
   * Проверяет пересечение окружности с прямоугольником (AABB)
   * https://stackoverflow.com/questions/21089959/detecting-circle-rectangle-intersection
   */
  private _circleRectIntersects(
    rect: Bounds,
    cx: number,
    cy: number,
    radius: number
  ): boolean {
    // Находим ближайшую точку прямоугольника к центру окружности
    const closestX = Math.max(rect.x, Math.min(cx, rect.x2));
    const closestY = Math.max(rect.y, Math.min(cy, rect.y2));

    // Вычисляем расстояние между центром окружности и ближайшей точкой
    const distanceX = cx - closestX;
    const distanceY = cy - closestY;
    const distanceSquared = distanceX * distanceX + distanceY * distanceY;

    // Если расстояние меньше или равно радиусу, есть пересечение
    return distanceSquared <= radius * radius;
  }
}
