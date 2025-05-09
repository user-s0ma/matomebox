// src/components/PenDrawingToolbar.tsx
import React, { useState } from "react";
import { Pen, Highlighter, Eraser, Ruler as RulerIcon, Settings2, X } from "lucide-react";
import { type PenToolType, colorValues } from "./constants";

interface PenDrawingToolbarProps {
  currentPenType: PenToolType;
  setCurrentPenType: (type: PenToolType) => void;
  drawingColor: string;
  setDrawingColor: (color: string) => void;
  drawingWidth: number;
  setDrawingWidth: (width: number) => void;
  onDone: () => void;
  rulerActive: boolean;
  setRulerActive: (active: boolean) => void;
}

const lineThicknessValues: number[] = [2, 5, 10, 15, 20, 30];

const iconButtonClass = "h-10 w-10 p-2 rounded-full flex items-center justify-center";

const PenDrawingToolbar: React.FC<PenDrawingToolbarProps> = ({
  currentPenType,
  setCurrentPenType,
  drawingColor,
  setDrawingColor,
  drawingWidth,
  setDrawingWidth,
  onDone,
  rulerActive,
  setRulerActive,
}) => {
  const [showPenColorPicker, setShowPenColorPicker] = useState(false);
  const [showPenThicknessPicker, setShowPenThicknessPicker] = useState(false);
  const closeAllPickers = () => {
    setShowPenColorPicker(false);
    setShowPenThicknessPicker(false);
  };

  const penTools = [
    { type: "pen" as PenToolType, icon: Pen, label: "ペン" },
    { type: "highlighter" as PenToolType, icon: Highlighter, label: "マーカー" },
    { type: "eraser" as PenToolType, icon: Eraser, label: "消しゴム" },
    { type: "ruler" as PenToolType, icon: RulerIcon, label: "定規" },
  ];

  const handlePenTypeChange = (type: PenToolType) => {
    if (type === "ruler") {
      const newRulerActiveState = !rulerActive;
      setRulerActive(newRulerActiveState);
      if (!rulerActive) {
        setCurrentPenType(type);
      }
    } else {
      setCurrentPenType(type);
      if (type === "highlighter") {
        setDrawingWidth(15);
      } else if (type === "pen") {
        setDrawingWidth(5);
      }
    }
    closeAllPickers();
  };

  return (
    <div
      id="pen-drawing-toolbar"
      className="p-1 fixed bottom-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-80 backdrop-blur-md text-white z-[10000] flex justify-center items-center rounded-full shadow-2xl space-x-1"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center space-x-1">
        <div className="relative">
          <button
            onClick={() => {
              closeAllPickers();
              setShowPenColorPicker(!showPenColorPicker);
            }}
            className={`${iconButtonClass} hover:bg-gray-500`}
            title="ペンの色"
            disabled={currentPenType === "eraser" || currentPenType === "ruler"}
          >
            <div className="h-6 w-6 rounded-full ring-2 ring-white ring-offset-1 ring-offset-black" style={{ backgroundColor: drawingColor }}></div>
          </button>
          {showPenColorPicker && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black rounded-xl shadow-2xl p-3 z-20 w-28">
              <div className="grid grid-cols-3 gap-2">
                {colorValues.map((colorValue) => (
                  <button
                    key={colorValue}
                    title={colorValue}
                    className={`w-6 h-6 rounded-full border border-gray-500 transition-transform hover:scale-110 focus:outline-none ${
                      drawingColor === colorValue ? "ring-2 ring-white ring-offset-1 ring-offset-black" : ""
                    }`}
                    style={{ backgroundColor: colorValue }}
                    onClick={() => {
                      setDrawingColor(colorValue);
                      setShowPenColorPicker(false);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => {
              closeAllPickers();
              setShowPenThicknessPicker(!showPenThicknessPicker);
            }}
            className={`${iconButtonClass} hover:bg-gray-500 text-xs px-2 min-w-[60px]`}
            title="ペンの太さ"
            disabled={currentPenType === "eraser" || currentPenType === "ruler"}
          >
            <Settings2 size={14} className="mr-1.5" />
            {drawingWidth}px
          </button>
          {showPenThicknessPicker && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-36 bg-black rounded-lg shadow-2xl p-1 space-y-0.5 z-20">
              {lineThicknessValues.map((thicknessValue) => (
                <button
                  key={thicknessValue}
                  onClick={() => {
                    setDrawingWidth(thicknessValue);
                    closeAllPickers();
                  }}
                  className={`w-full text-left px-2 py-1.5 text-xs rounded-md hover:bg-gray-500 text-white ${
                    drawingWidth === thicknessValue && currentPenType !== "highlighter" ? "bg-blue-600" : ""
                  }`}
                >
                  {thicknessValue}px
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center space-x-1">
        {penTools.map((tool) => (
          <button
            key={tool.type}
            title={tool.label}
            onClick={() => handlePenTypeChange(tool.type)}
            className={`${iconButtonClass} 
              ${
                tool.type === "ruler"
                  ? rulerActive
                    ? "bg-white text-gray-500"
                    : "text-gray-300 hover:bg-gray-500 hover:text-white"
                  : currentPenType === tool.type
                  ? "bg-white text-gray-500"
                  : "text-gray-300 hover:bg-gray-500 hover:text-white"
              }`}
          >
            <tool.icon size={20} strokeWidth={currentPenType === tool.type || (tool.type === "ruler" && rulerActive) ? 2.5 : 2} />
          </button>
        ))}
      </div>
      <button onClick={onDone} className={`${iconButtonClass} text-red-500 hover:bg-red-500 hover:text-white`}>
        <X size={18} strokeWidth={2.5} />
      </button>
    </div>
  );
};

export default PenDrawingToolbar;
