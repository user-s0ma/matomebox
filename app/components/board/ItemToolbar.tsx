// src/components/ItemToolbar.tsx
import { useState } from "react";
import { Trash2, Copy, AlignLeft, AlignCenter, AlignRight, ChevronDown, Settings2 } from "lucide-react";
import type { TextAlign, StickyNoteData, TextNoteData, DrawLineData, DashboardItem } from "./constants";
import { colorValues } from "./constants";

interface ItemToolbarProps {
  item: DashboardItem;
  onDelete: () => void;
  onDuplicate: () => void;
  onUpdateItem: (updatedProps: Partial<DashboardItem>) => void;
  isGroupSelected: boolean;
}

const fontSizeValues: string[] = ["12px", "14px", "16px", "18px", "20px", "24px", "30px", "36px", "48px"];
const lineThicknessValues: number[] = [1, 2, 4, 7, 10, 15];

const ItemToolbar: React.FC<ItemToolbarProps> = ({ item, onDelete, onDuplicate, onUpdateItem, isGroupSelected }) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontSizePicker, setShowFontSizePicker] = useState(false);
  const [showAlignPicker, setShowAlignPicker] = useState(false);
  const [showLineThicknessPicker, setShowLineThicknessPicker] = useState(false);

  const handleUpdate = (changedProperties: Partial<DashboardItem>) => {
    onUpdateItem(changedProperties);
  };

  const iconButtonClass = "h-10 w-10 p-2 rounded-full hover:bg-gray-600 transition-colors text-gray-300 hover:text-white flex items-center justify-center";
  const activeIconButtonClass = "bg-blue-600 text-white";

  const AlignmentIcon =
    item.type === "text" && (item as TextNoteData).textAlign === "left"
      ? AlignLeft
      : item.type === "text" && (item as TextNoteData).textAlign === "center"
      ? AlignCenter
      : AlignRight;

  const closeAllPickers = () => {
    setShowColorPicker(false);
    setShowFontSizePicker(false);
    setShowAlignPicker(false);
    setShowLineThicknessPicker(false);
  };

  if (isGroupSelected) {
    return (
      <div
        id="item-action-toolbar"
        className="p-1 fixed bottom-2 left-1/2 -translate-x-1/2 bg-black bg-opacity-80 backdrop-blur-md text-white z-[10000] flex justify-center items-center rounded-full shadow-2xl space-x-1"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs text-gray-400 px-3">複数選択中</span>
        <button className={`${iconButtonClass} hover:bg-gray-500 text-white`} onClick={onDuplicate} title="選択項目を複製">
          <Copy size={18} />
        </button>
        <button className={`${iconButtonClass} text-red-500 hover:bg-red-500 hover:text-white`} onClick={onDelete} title="選択項目を削除">
          <Trash2 size={18} />
        </button>
      </div>
    );
  }

  return (
    <div
      id="item-action-toolbar"
      className="p-1 fixed bottom-2 left-1/2 -translate-x-1/2 bg-black bg-opacity-80 backdrop-blur-md text-white z-[10000] flex justify-center items-center rounded-full shadow-2xl space-x-1"
      onClick={(e) => e.stopPropagation()}
    >
      {item.type === "note" && (
        <>
          <div className="relative">
            <button
              onClick={() => {
                closeAllPickers();
                setShowColorPicker(!showColorPicker);
              }}
              className={`${iconButtonClass} hover:bg-gray-500`}
              title="付箋の色"
            >
              <div
                className="h-6 w-6 rounded-full ring-2 ring-white ring-offset-1 ring-offset-black"
                style={{ backgroundColor: (item as StickyNoteData).color }}
              ></div>
            </button>
            {showColorPicker && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black rounded-xl shadow-2xl p-3 z-20 w-28">
                <div className="grid grid-cols-3 gap-2">
                  {colorValues.map((colorValue) => (
                    <button
                      key={colorValue}
                      title={colorValue}
                      className={`w-6 h-6 rounded-full border border-gray-500 transition-transform hover:scale-110 focus:outline-none ${
                        (item as StickyNoteData).color === colorValue ? "ring-2 ring-white ring-offset-1 ring-offset-black" : ""
                      }`}
                      style={{ backgroundColor: colorValue }}
                      onClick={() => {
                        handleUpdate({ color: colorValue });
                        closeAllPickers();
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
                setShowFontSizePicker(!showFontSizePicker);
              }}
              className={`${iconButtonClass} hover:bg-gray-500 text-xs px-2 min-w-[60px]`}
            >
              Aa <span className="ml-1 text-xs">{parseInt((item as StickyNoteData).fontSize)}</span>
            </button>
            {showFontSizePicker && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black rounded-xl shadow-2xl p-3 z-20 w-28">
                {fontSizeValues.map((fontSizeValue) => (
                  <button
                    key={fontSizeValue}
                    onClick={() => {
                      handleUpdate({ fontSize: fontSizeValue });
                      closeAllPickers();
                    }}
                    className={`w-full text-left px-2 py-1.5 text-xs rounded-md hover:bg-gray-500 ${
                      (item as StickyNoteData).fontSize === fontSizeValue ? activeIconButtonClass : ""
                    }`}
                  >
                    {parseInt(fontSizeValue)}px
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      {item.type === "text" && (
        <>
          <div className="relative">
            <button
              onClick={() => {
                closeAllPickers();
                setShowColorPicker(!showColorPicker);
              }}
              className={`${iconButtonClass} hover:bg-gray-500`}
              title="テキストの色"
            >
              <div
                className="h-6 w-6 rounded-full ring-2 ring-white ring-offset-1 ring-offset-black"
                style={{ backgroundColor: (item as TextNoteData).color }}
              ></div>
            </button>
            {showColorPicker && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black rounded-xl shadow-2xl p-3 z-20 w-28">
                <div className="grid grid-cols-3 gap-2">
                  {colorValues.map((colorValue) => (
                    <button
                      key={colorValue}
                      title={colorValue}
                      className={`w-6 h-6 rounded-full border border-gray-500 transition-transform hover:scale-110 focus:outline-none ${
                        (item as TextNoteData).color === colorValue ? "ring-2 ring-white ring-offset-1 ring-offset-black" : ""
                      }`}
                      style={{ backgroundColor: colorValue }}
                      onClick={() => {
                        handleUpdate({ color: colorValue });
                        closeAllPickers();
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            {showFontSizePicker && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-32 bg-black rounded-lg shadow-2xl p-1 space-y-0.5 z-20">
                {fontSizeValues.map((fontSizeValue) => (
                  <button
                    key={fontSizeValue}
                    onClick={() => {
                      handleUpdate({ fontSize: fontSizeValue });
                      closeAllPickers();
                    }}
                    className={`w-full text-left px-2 py-1.5 text-xs rounded-md hover:bg-gray-500 ${
                      (item as TextNoteData).fontSize === fontSizeValue ? activeIconButtonClass : ""
                    }`}
                  >
                    {parseInt(fontSizeValue)}px
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => {
                closeAllPickers();
                setShowFontSizePicker(!showFontSizePicker);
              }}
              className={`${iconButtonClass} hover:bg-gray-500 text-xs px-2.5 min-w-[60px]`}
            >
              Aa <span className="ml-1 mr-0.5 text-xs">{parseInt((item as TextNoteData).fontSize)}</span> <ChevronDown size={12} className="ml-0.5" />
            </button>
          </div>
          <div className="relative">
            <button
              onClick={() => {
                closeAllPickers();
                setShowAlignPicker(!showAlignPicker);
              }}
              className={`${iconButtonClass} hover:bg-gray-500`}
              title="文字揃え"
            >
              <AlignmentIcon size={18} />
            </button>
            {showAlignPicker && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black rounded-lg shadow-2xl p-1 z-20 w-max">
                {[
                  { align: "left" as TextAlign, icon: AlignLeft, label: "左揃え" },
                  { align: "center" as TextAlign, icon: AlignCenter, label: "中央揃え" },
                  { align: "right" as TextAlign, icon: AlignRight, label: "右揃え" },
                ].map(({ align, icon: Icon, label }) => (
                  <button
                    key={align}
                    onClick={() => {
                      handleUpdate({ textAlign: align });
                      closeAllPickers();
                    }}
                    title={label}
                    className={`w-full flex items-center space-x-2 px-3 py-1.5 text-xs rounded-md hover:bg-gray-500 ${
                      (item as TextNoteData).textAlign === align ? activeIconButtonClass : ""
                    }`}
                  >
                    <Icon size={16} /> <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      {item.type === "line" && (
        <>
          <div className="relative">
            <button
              onClick={() => {
                closeAllPickers();
                setShowColorPicker(!showColorPicker);
              }}
              className={`${iconButtonClass} hover:bg-gray-500`}
              title="線の色"
            >
              <div
                className="h-6 w-6 rounded-full ring-2 ring-white ring-offset-1 ring-offset-black"
                style={{ backgroundColor: (item as DrawLineData).color }}
              ></div>
            </button>
            {showColorPicker && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black rounded-xl shadow-2xl p-3 z-20 w-28">
                <div className="grid grid-cols-3 gap-2">
                  {colorValues.map((colorValue) => (
                    <button
                      key={colorValue}
                      title={colorValue}
                      className={`w-6 h-6 rounded-full border border-gray-500 transition-transform hover:scale-110 focus:outline-none ${
                        (item as DrawLineData).color === colorValue ? "ring-2 ring-white ring-offset-1 ring-offset-black" : ""
                      }`}
                      style={{ backgroundColor: colorValue }}
                      onClick={() => {
                        handleUpdate({ color: colorValue });
                        closeAllPickers();
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          {(item as DrawLineData).penType !== "highlighter" && (
            <div className="relative">
              <button
                onClick={() => {
                  closeAllPickers();
                  setShowLineThicknessPicker(!showLineThicknessPicker);
                }}
                className={`${iconButtonClass} hover:bg-gray-500 text-xs px-2.5 min-w-[60px]`}
              >
                <Settings2 size={14} className="mr-1" />
                {(item as DrawLineData).width}px
              </button>
              {showLineThicknessPicker && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-36 bg-black rounded-lg shadow-2xl p-1 space-y-0.5 z-20">
                  {lineThicknessValues.map((thicknessValue) => (
                    <button
                      key={thicknessValue}
                      onClick={() => {
                        handleUpdate({ width: thicknessValue });
                        closeAllPickers();
                      }}
                      className={`w-full text-left px-2 py-1.5 text-xs rounded-md hover:bg-gray-500 ${
                        (item as DrawLineData).width === thicknessValue ? activeIconButtonClass : ""
                      }`}
                    >
                      {thicknessValue}px
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
      <button className={`${iconButtonClass} hover:bg-gray-500 text-white`} onClick={onDuplicate} title="複製">
        <Copy size={18} />
      </button>
      <button className={`${iconButtonClass} text-red-500 hover:bg-red-500 hover:text-white`} onClick={onDelete} title="削除">
        <Trash2 size={18} />
      </button>
    </div>
  );
};

export default ItemToolbar;
