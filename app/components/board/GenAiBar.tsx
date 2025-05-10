// src/components/board/GenAiPanel.tsx
import { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";

interface GenAiPanelProps {
  isVisible: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
  isLoading?: boolean;
  countSelectedItems: () => number;
}

const GenAiPanel: React.FC<GenAiPanelProps> = ({ isVisible, onClose, onSend, isLoading = false, countSelectedItems }) => {
  const [editedText, setEditedText] = useState("");

  const iconButtonClass = "h-10 w-10 p-2 rounded-full hover:bg-gray-500 transition-colors text-gray-300 hover:text-white flex items-center justify-center";

  useEffect(() => {
    if (isVisible) {
      setEditedText("");
    }
  }, [isVisible]);

  const handleSend = () => {
    if (editedText.trim() && !isLoading) {
      onSend(editedText);
    }
  };

  return (
    <div
      className={`w-[calc(100%_-_16px)] max-w-xl p-1 fixed bottom-2 left-1/2 -translate-x-1/2 bg-black text-white z-[10000] flex justify-center items-center rounded-3xl shadow-2xl space-x-1 transition-transform
                  ${isVisible && !isLoading ? "translate-y-0" : "translate-y-[calc(100%_+_8px)]"}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <button onClick={onClose} className={`${iconButtonClass} text-red-500 hover:bg-red-500 hover:text-white`}>
        <X size={18} />
      </button>
      <span className="shrink-0 text-xs text-gray-300 p-2">選択中: {countSelectedItems()}</span>
      <input
        value={editedText}
        onChange={(e) => setEditedText(e.target.value)}
        placeholder="何をしますか？"
        className="w-full flex-1 h-10 px-4 py-2 rounded-3xl bg-transparent text-white resize-none"
      />
      <button
        onClick={handleSend}
        disabled={isLoading || !editedText.trim()}
        className={`${iconButtonClass} bg-linear-to-bl from-violet-400 to-sky-400 text-white`}
      >
        <Sparkles size={18} />
      </button>
    </div>
  );
};

export default GenAiPanel;
