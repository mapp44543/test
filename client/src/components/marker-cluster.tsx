import React from "react";
import type { Location } from "@shared/schema";

interface MarkerClusterProps {
  count: number;
  color: string;
  size: number;
  position: { x: number; y: number };
  onClick: () => void;
  isHighlighted?: boolean;
}

/**
 * MarkerCluster Component
 * Отображает кластер (группу) маркеров в виде чиcла
 * Используется при масштабировании < 0.7
 */
export const MarkerCluster = React.memo(function MarkerCluster({
  count,
  color,
  size,
  position,
  onClick,
  isHighlighted,
}: MarkerClusterProps) {
  // Динамический цвет в зависимости от количества маркеров в кластере
  let bgColor = color;
  if (count > 30) {
    bgColor = "bg-red-600"; // Большой кластер
  } else if (count > 10) {
    bgColor = "bg-orange-500"; // Средний кластер
  } else {
    bgColor = "bg-yellow-400"; // Маленький кластер
  }

  return (
    <div
      className={`
        marker-cluster absolute left-0 top-0 rounded-full 
        flex items-center justify-center
        font-bold text-white
        cursor-pointer transition-transform duration-75
        ${bgColor}
        ${isHighlighted ? "ring-4 ring-red-300" : ""}
        border-2 border-white
      `}
      style={{
        left: `0px`,
        top: `0px`,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        width: `${size}px`,
        height: `${size}px`,
        willChange: 'transform',
        fontSize: `${Math.max(10, size * 0.4)}px`,
      }}
      onClick={onClick}
      title={`${count} маркер${count > 1 && count < 5 ? 'а' : count > 5 ? 'ов' : ''}`}
      data-testid={`marker-cluster-${count}`}
    >
      {count > 99 ? "99+" : count}
    </div>
  );
});

export default MarkerCluster;
