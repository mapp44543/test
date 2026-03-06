import React from "react";

interface LocationHighlightRingProps {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
}

/**
 * Компонент для отображения кружка вокруг выделенной локации
 * Создаёт анимированный кружок с пульсирующим эффектом, центрированный на маркере
 */
export const LocationHighlightRing: React.FC<LocationHighlightRingProps> = ({
  left,
  top,
  width,
  height,
  scale,
}) => {
  // Расчитываем размер кружка (больше чем сам маркер)
  const ringSize = Math.max(width, height) + 26;
  const ringLeft = left - (ringSize - width) / 2;
  const ringTop = top - (ringSize - height) / 2;

  return (
    <svg
      className="location-highlight-ring-svg"
      style={{
        position: "absolute",
        left: `${ringLeft}px`,
        top: `${ringTop}px`,
        width: `${ringSize}px`,
        height: `${ringSize}px`,
        pointerEvents: "none",
        zIndex: 10,
        overflow: "visible",
      }}
      viewBox={`0 0 ${ringSize} ${ringSize}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Внешний кружок (пульсирующий) */}
      <circle
        cx={ringSize / 2}
        cy={ringSize / 2}
        r={ringSize / 2}
        fill="none"
        stroke="#dc2626"
        strokeWidth="2"
        className="location-highlight-ring-pulse"
      />
    </svg>
  );
};
