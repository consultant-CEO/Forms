/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Layout, 
  Users, 
  Target, 
  Sparkles, 
  ClipboardCheck, 
  Loader2,
  ChevronRight,
  RefreshCw,
  Copy,
  CheckCircle2,
  FileText,
  Code,
  Palette,
  ExternalLink,
  Eye,
  Code2,
  Download,
  Wand2,
  AlertCircle,
  CheckSquare,
  Square,
  Save,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-3-flash-preview";

// Safe AI caller
const callGemini = async (prompt: string, systemPrompt?: string) => {
  console.log("Calling Gemini with prompt length:", prompt.length);
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('找不到 API 金鑰（GEMINI_API_KEY）。如果您在 GitHub 上部署，請至 Settings > Secrets 設定金鑰。');
    }
    const ai = new GoogleGenAI({ apiKey: key });
    
    // Using gemini-3-flash-preview which is the recommended model
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("AI 回傳內容為空");
    }
    console.log("Gemini response received, length:", text.length);
    return text;
  } catch (error: any) {
    console.error("Gemini Error Detail:", error);
    if (error.message?.includes('quota')) {
      throw new Error('AI 使用額度已達上限，請稍後再試。');
    }
    throw error;
  }
};

const App = () => {
  // --- States ---
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ purpose: '', target: '' });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTweaking, setIsTweaking] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [gasCode, setGasCode] = useState('');
  const [formSourceCode, setFormSourceCode] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('極簡現代風 (Minimalist)');
  const [customFormCode, setCustomFormCode] = useState('');
  const [viewMode, setViewMode] = useState('preview');
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [aiUsage, setAiUsage] = useState({ count: 0, firstCallAt: 0 });
  const [showLimitAlert, setShowLimitAlert] = useState(false);

  // --- Right-click & Keyboard Protection ---
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
      if (
        e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.key === 'S' || e.key === 's'))
      ) {
        e.preventDefault();
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // --- AI Rate Limit Check ---
  useEffect(() => {
    const saved = localStorage.getItem('ai_generation_usage');
    if (saved) {
      try {
        setAiUsage(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const checkAiLimit = () => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    let currentUsage = { ...aiUsage };

    if (now - currentUsage.firstCallAt > oneHour) {
      currentUsage = { count: 1, firstCallAt: now };
    } else {
      if (currentUsage.count >= 10) {
        setShowLimitAlert(true);
        return false;
      }
      currentUsage.count += 1;
      if (currentUsage.firstCallAt === 0) currentUsage.firstCallAt = now;
    }

    setAiUsage(currentUsage);
    localStorage.setItem('ai_generation_usage', JSON.stringify(currentUsage));
    return true;
  };
  useEffect(() => {
    const savedData = localStorage.getItem('googleFormGenDraft');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.formData) setFormData(parsed.formData);
        if (parsed.generatedContent) setGeneratedContent(parsed.generatedContent);
        if (parsed.formSourceCode) setFormSourceCode(parsed.formSourceCode);
      } catch (e) {
        console.error("Failed to parse local storage", e);
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('googleFormGenDraft', JSON.stringify({
        formData, generatedContent, formSourceCode
      }));
      if (formData.purpose || generatedContent || formSourceCode) {
        setShowSaveToast(true);
        setTimeout(() => setShowSaveToast(false), 2000);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [formData, generatedContent, formSourceCode]);

  // --- Configs ---
  const baseStyles = [
    { name: '極簡現代風 (Minimalist)', colors: ['bg-slate-100', 'bg-slate-800', 'bg-white'] },
    { name: '活潑俏皮風 (Playful)', colors: ['bg-yellow-400', 'bg-pink-500', 'bg-blue-400'] },
    { name: '專業商務風 (Corporate)', colors: ['bg-blue-800', 'bg-gray-100', 'bg-blue-600'] },
    { name: '溫馨柔和風 (Warm & Soft)', colors: ['bg-orange-100', 'bg-rose-300', 'bg-stone-50'] },
    { name: '科技未來風 (Cyberpunk)', colors: ['bg-indigo-900', 'bg-cyan-400', 'bg-fuchsia-500'] },
    { name: '自然森系風 (Nature)', colors: ['bg-emerald-800', 'bg-green-100', 'bg-teal-600'] },
    { name: '玻璃擬態 (Glassmorphism)', colors: ['bg-white/30', 'bg-indigo-500/20', 'bg-blue-200/40'] },
    { name: '暗黑奢華 (Dark Luxury)', colors: ['bg-black', 'bg-amber-600', 'bg-zinc-900'] },
    { name: '粗獷主義 (Brutalist)', colors: ['bg-yellow-300', 'bg-black', 'bg-white'] },
    { name: '手寫筆記風 (Paper)', colors: ['bg-stone-100', 'bg-blue-500', 'bg-white'] },
    { name: '復古 90 年代 (Retro Web)', colors: ['bg-gray-300', 'bg-blue-800', 'bg-white'] },
    { name: '清新雜誌報刊 (Editorial)', colors: ['bg-white', 'bg-slate-900', 'bg-slate-50'] }
  ];

  const stepsConfig = [
    { id: 1, title: '需求確認', icon: Target, desc: '輸入問卷目的與對象，讓 AI 自動構思題目。' },
    { id: 2, title: '內容確認', icon: FileText, desc: '檢查與修改問卷內容，也可直接貼上您寫好的草稿。' },
    { id: 3, title: '生成表單', icon: Code, desc: '將問卷轉換為程式碼，快速全自動建立 Google 表單。' },
    { id: 4, title: '自訂美化', icon: Palette, desc: '套用多種視覺主題，生成專屬的高質感 HTML 網頁表單。' }
  ];

  const quickTemplates = [
    { icon: '🏢', label: '員工滿意度', purpose: '了解員工對公司近期各項福利與工作環境的滿意度', target: '公司全體員工' },
    { icon: '🎉', label: '活動報名', purpose: '收集即將舉辦的年末聚餐參與意願與飲食禁忌', target: '部門內同仁' },
    { icon: '🛍️', label: '產品回饋', purpose: '調查新上市產品的使用體驗與改進建議', target: '20-35歲購買過該產品的顧客' }
  ];

  const quickTweaks = [
    { label: '➕ 增加題目', prompt: '請幫我為這份問卷增加 2-3 個相關的題目，讓調查更深入。' },
    { label: '➖ 縮短篇幅', prompt: '請幫我精簡這份問卷，保留最核心的 3-5 個題目就好。' },
    { label: '👔 語氣正式', prompt: '請將這份問卷的用語修改為非常專業、正式的商務語氣。' },
    { label: '💡 偏向選擇題', prompt: '請盡量將問卷中的問答題轉換為單選或多選題，方便後續統計。' }
  ];

  const gasInstructions = [
    { id: 'step-a', text: '開啟 Google Apps Script 網站並點擊左上角「新專案」。' },
    { id: 'step-b', text: '將預設的 myFunction 刪除，貼上上方生成的程式碼。' },
    { id: 'step-c', text: '點擊上方工具列的「💾 儲存」按鈕。' },
    { id: 'step-d', text: '點擊上方工具列的「▷ 執行」按鈕。' },
    { id: 'step-e', text: '首次執行需點擊「審查權限」➔ 選擇帳號 ➔ 進階 ➔ 前往專案 (不安全) ➔ 允許。' },
    { id: 'step-f', text: '執行完成後，在下方「執行記錄」中會顯示表單網址，複製網址貼上新網頁即可開啟google表單！' }
  ];

  // --- Functions ---
  const handleNextStep = () => {
    if (step === 1 && formData.purpose && formData.target) {
      generateSurveyContent();
    }
  };

  const applyTemplate = (tpl: any) => {
    setFormData({ purpose: tpl.purpose, target: tpl.target });
  };

  const toggleCheck = (id: string) => {
    setCheckedSteps(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // 1. 生成問卷內容
  const generateSurveyContent = async () => {
    if (!checkAiLimit()) return;
    setStep(2);
    setIsGenerating(true);
    setGeneratedContent(""); // Clear previous content

    try {
      const systemPrompt = `你是一位專業的問卷設計師。請根據使用者的「目的」與「對象」設計邏輯嚴謹的問卷內容。
      必須包含：1.問卷標題 2.開場白 3.完整題目清單(標註題型) 4.致謝辭。
      不要提供視覺或色彩建議，純文字格式即可。`;

      const text = await callGemini(`問卷目的：${formData.purpose}\n問卷對象：${formData.target}`, systemPrompt);
      if (text) {
        setGeneratedContent(text);
      } else {
        throw new Error("AI 回傳內容為空");
      }
    } catch (error: any) {
      console.error("Generate Error:", error);
      alert("生成失敗：" + (error.message || "未知錯誤"));
      setStep(1); // Return to step 1 on failure
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. AI 魔法微調
  const tweakSurveyContent = async (tweakPrompt: string) => {
    if (!checkAiLimit()) return;
    setIsTweaking(true);
    try {
      const systemPrompt = `你是一位專業問卷設計師。請根據使用者的「修改指示」，針對「目前問卷內容」進行調整。
      請直接輸出修改後的完整問卷內容，保持原有架構(標題、開場白、題目、致謝辭)，絕對不要加上任何額外的問候語或解釋說明文字。`;
      
      const userQuery = `【修改指示】：${tweakPrompt}\n\n【目前問卷內容】：\n${generatedContent}`;

      const text = await callGemini(userQuery, systemPrompt);
      if (text) setGeneratedContent(text);
    } catch (error: any) {
      console.error("Tweak Error:", error);
      alert("微調失敗：" + (error.message || "未知錯誤"));
    } finally {
      setIsTweaking(false);
    }
  };

  // 3. 生成 GAS 程式碼
  const generateGasCode = async () => {
    if (!checkAiLimit()) return;
    setStep(3);
    setIsGenerating(true);
    try {
      const systemPrompt = `你精通 Google Apps Script。請根據「問卷內容」撰寫一段自動建立 Google 表單的程式碼。
      嚴格要求：
      1. 只能輸出可執行的 JS 程式碼。
      2. 絕對不分頁 (不使用 addPageBreakItem)。
      3. 自動判斷題型 (addMultipleChoiceItem, addCheckboxItem, addTextItem 等)。
      4. 必須加上 try { form.setRequireLogin(false); } catch(e) {} 來確保表單公開。使用 try-catch 是為了避免一般 Gmail 個人帳號執行此方法時引發 "This operation is not supported" 的錯誤。
      5. 結尾必須加上 Logger.log('Form created at: ' + form.getEditUrl());`;

      const text = await callGemini(`問卷內容：\n${generatedContent}`, systemPrompt);
      if (text) {
        setGasCode(text.replace(/`{3}(?:javascript|js)?\n|`{3}/gi, '').trim());
      }
    } catch (error: any) {
      console.error("GAS Error:", error);
      alert("程式碼生成失敗：" + (error.message || "未知錯誤"));
      setStep(2);
    } finally {
      setIsGenerating(false);
    }
  };

  // 4. 生成 HTML
  const generateCustomFormCode = async () => {
    if (!checkAiLimit()) return;
    setIsGenerating(true);
    setCustomFormCode('');
    const systemPrompt = `你是一個嚴格的 HTML 產生器。
    【極度重要】你只能輸出完整的 HTML 程式碼，絕對「不要」包含任何問候語、解釋說明或 Markdown 標籤外的文字。
    
    任務清單：
    1. 找出表單提交網址 (action)：從原始碼找出 https://docs.google.com/forms/d/e/... 的網址。如果結尾是 /viewform，請強制改為 /formResponse。
    2. 精準提取題目 name 屬性 (entry.xxx) 與選項 value：絕對不能修改原本的 name 與預設選項的 value，否則資料無法寫入 Google 表單。
    3. 寫一個單一檔案的 HTML (使用 Tailwind CDN：<script src="https://cdn.tailwindcss.com"></script>)。
    4. 表單必須加上：action="【你的網址】" method="POST" target="hidden_iframe"
    5. HTML 中必須包含用來攔截跳轉的隱藏 iframe 與觸發機制：
       <iframe name="hidden_iframe" id="hidden_iframe" style="display:none;" onload="if(window.submitted){ document.getElementById('success-message').style.display='flex'; document.getElementById('custom-form').style.display='none'; }"></iframe>
       同時 form 標籤加上 onsubmit="window.submitted = true;"
    6. 依據「底色主題風格」設計 RWD 介面。必須包含一個預設隱藏的精美成功訊息區塊 (id="success-message", style="display:none;") 與表單區塊 (id="custom-form")。
    7. 佈局與可讀性極致優化 (解決文字重疊問題)：
       - 使用容器 max-w-4xl mx-auto w-full px-6 py-12，確保內容在大螢幕上有充足的呼吸空間，不與邊緣重疊。
       - 題目卡片必須有明確的間距 (mb-8) 與內距 (p-6 或 p-8)，背景色與文字色必須有強烈對比 (High Contrast)。
       - 標題使用 text-2xl md:text-5xl font-extrabold，並確保下方有足夠的 margin (mb-6)。
       - 一般文字與標籤使用 text-base md:text-lg leading-relaxed，確保字距與行距足夠。
       - 所有輸入框與按鈕必須有明確的高寬與 padding，不可以讓文字緊貼邊框。
    8. 組合設計要求：
       - 你需要將「底色主題風格」的外觀規範，套用到該 HTML 中。
       - 特定風格規範：
         - 「玻璃擬態」：使用 backdrop-blur-xl 與透明背景，容器邊框建議帶有細緻的白色半透明描邊。文字必須使用暗色調或強烈的亮色調，並確保有 text-shadow 以增加可讀性。
         - 「暗黑奢華」：使用純黑背景搭配金/古銅色 (amber/orange) 元素。字體使用優雅的 Serif，並加上適當的 letter-spacing。
         - 「粗獷主義」：使用極粗黑框 (border-4)、亮黃/亮綠配色、不使用圓角 (rounded-none)，字體使用超大超粗體文字。
         - 「手寫筆記風」：背景使用淺米色，使用 Google Fonts (如 Nanum Pen Script) 模擬手寫感，表單欄位像是在橫線紙上的排版。
         - 「復古 90 年代」：模擬舊 Windows 視窗介面，使用灰色立體邊框 (#c0c0c0)、藍色標題列與 Pixel 風格字體。
         - 「清新雜誌報刊」：大標題、大量留白 (p-16)、字體使用優雅的 Serif 與 Sans-serif 混搭，版面偏向報紙排版，注重排版美感。
    9. 安全性要求 (程式碼保護)：
       - 在生成的 HTML 中加入 JavaScript，禁用右鍵選單 (contextmenu)。
       - 禁用常見的開發者工具快捷鍵 (F12, Ctrl+Shift+I, Ctrl+U)。
       - 透過簡單的變數名混淆或邏輯處理，保護表單原始提交路徑不被直接識別。
    
    再次警告：只回傳 HTML 程式碼，開頭必須是 <!DOCTYPE html>，不要說任何廢話。`;

    const text = await callGemini(`【底色主題風格】：${selectedStyle}\n【表單原始碼】：\n${formSourceCode}`, systemPrompt);
    let finalHtml = text;
    
    const htmlMatch = text.match(/`{3}(?:html)?\n?([\s\S]*?)\n?`{3}/i);
    
    if (htmlMatch) {
      finalHtml = htmlMatch[1];
    } else {
      const docIndex = text.indexOf('<!DOCTYPE html>');
      if (docIndex !== -1) {
        finalHtml = text.substring(docIndex);
      }
    }
    
    setCustomFormCode(finalHtml.trim());
    setViewMode('preview');
    setIsGenerating(false);
  };

  // --- Utils ---
  const copyToClipboard = (textToCopy: string) => {
    if (textToCopy) {
      const el = document.createElement('textarea');
      el.value = textToCopy;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  const downloadHTML = () => {
    if (!customFormCode) return;
    const blob = new Blob([customFormCode], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `custom_survey_${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isValidSourceCode = formSourceCode.trim() === '' || 
    formSourceCode.includes('docs.google.com/forms') || 
    formSourceCode.includes('FB_PUBLIC_LOAD_DATA_');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8 flex items-center justify-center">
      
      {/* Rate Limit Alert Modal */}
      <AnimatePresence>
        {showLimitAlert && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center space-y-6"
            >
              <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800">AI 生成次數已達上限</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  為了確保服務穩定性，每小時僅限使用 10 次 AI 生成功能。<br />
                  請於一小時後再試，或檢查目前的生成內容。
                </p>
              </div>
              <button 
                onClick={() => setShowLimitAlert(false)}
                className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
              >
                我知道了
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {showSaveToast && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50"
          >
            <Save className="w-4 h-4 text-green-400" /> <span className="text-sm font-medium">草稿已自動儲存</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        layout
        className="max-w-3xl w-full bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden"
      >
        
        {/* Header */}
        <div className="bg-blue-600 p-8 text-white relative overflow-hidden">
          <div className="relative z-10 flex justify-between items-start">
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
            >
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <FileText className="w-8 h-8" /> Google 問卷魔法師 <span className="text-sm font-medium bg-blue-500/50 px-2 py-0.5 rounded-full border border-blue-400/30">v1.1.2</span>
              </h1>
              <p className="mt-2 text-blue-100 opacity-90">從構思到客製化網頁，AI 一站式幫您搞定表單</p>
            </motion.div>
            <div className="hidden md:flex gap-1">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
            </div>
          </div>
          <div className="absolute top-0 right-0 -mr-12 -mt-12 w-64 h-64 bg-blue-500 rounded-full opacity-20 blur-3xl"></div>
        </div>

        <div className="p-8">
          {/* Interactive Progress Indicator */}
          <div className="flex items-center justify-between mb-10 px-0 md:px-4">
            {stepsConfig.map((s, index) => (
              <React.Fragment key={s.id}>
                <div 
                  onClick={() => setStep(s.id)}
                  className={`group relative flex flex-col items-center gap-2 cursor-pointer transition-all ${step >= s.id ? 'text-blue-600' : 'text-slate-400 hover:text-blue-500'}`}
                >
                  <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border-2 transition-transform duration-300 group-hover:scale-110 group-hover:shadow-md ${step >= s.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
                    {step === s.id && (isGenerating || isTweaking) ? (
                      <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                    ) : (
                      <s.icon className="w-4 h-4 md:w-5 md:h-5" />
                    )}
                  </div>
                  <span className="text-[10px] md:text-xs font-semibold whitespace-nowrap hidden sm:block">{s.title}</span>
                  
                  {/* Tooltip */}
                  <div className={`absolute top-full mt-2 md:mt-3 w-48 p-2.5 bg-slate-800 text-white text-xs leading-relaxed rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 pointer-events-none ${
                    index === 0 ? 'left-0 text-left' : 
                    index === stepsConfig.length - 1 ? 'right-0 text-right' : 
                    'left-1/2 -translate-x-1/2 text-center'
                  }`}>
                    {s.desc}
                    <div className={`absolute -top-1.5 border-4 border-transparent border-b-slate-800 ${
                      index === 0 ? 'left-3 md:left-4' : 
                      index === stepsConfig.length - 1 ? 'right-3 md:right-4' : 
                      'left-1/2 -translate-x-1/2'
                    }`}></div>
                  </div>
                </div>
                {index < stepsConfig.length - 1 && (
                  <div className={`flex-1 h-1 mx-1 md:mx-4 rounded transition-colors duration-500 ${step > s.id ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
                )}
              </React.Fragment>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* 步驟 1: 需求確認 */}
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                  <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-purple-500" /> 快捷情境模板
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {quickTemplates.map((tpl, i) => (
                      <button
                        key={i}
                        onClick={() => applyTemplate(tpl)}
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:border-purple-300 hover:bg-purple-50 rounded-lg text-sm transition-all text-slate-600 flex items-center gap-1.5 shadow-sm"
                      >
                        <span>{tpl.icon}</span> {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block">
                    <span className="text-slate-700 font-bold flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-blue-500" /> 問卷目的是什麼？
                    </span>
                    <textarea 
                      className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none h-28 text-slate-600"
                      placeholder="例如：了解顧客對新產品滿意度..."
                      value={formData.purpose}
                      onChange={(e) => setFormData({...formData, purpose: e.target.value})}
                    />
                  </label>

                  <label className="block">
                    <span className="text-slate-700 font-bold flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-blue-500" /> 問卷的發放對象是誰？
                    </span>
                    <input 
                      type="text"
                      className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-600"
                      placeholder="例如：25-40 歲的上班族..."
                      value={formData.target}
                      onChange={(e) => setFormData({...formData, target: e.target.value})}
                    />
                  </label>
                </div>

                <button
                  onClick={handleNextStep}
                  disabled={!formData.purpose || !formData.target}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
                >
                  生成問卷內容 <ChevronRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {/* 步驟 2: 內容確認 */}
            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {isGenerating ? (
                  <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-4">
                    <Loader2 className="w-16 h-16 animate-spin text-blue-500" />
                    <div className="text-center">
                      <p className="text-lg font-medium text-slate-600">AI 正在為您構思題目中...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <ClipboardCheck className="w-6 h-6 text-green-500" /> 問卷內容確認
                    </h2>

                    <div className="flex flex-wrap gap-2 pb-2">
                      <span className="text-xs font-bold text-slate-400 flex items-center mr-2">AI 魔法微調：</span>
                      {quickTweaks.map((tweak, i) => (
                        <button
                          key={i}
                          onClick={() => tweakSurveyContent(tweak.prompt)}
                          disabled={isTweaking}
                          className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 rounded-lg text-xs font-medium text-indigo-700 transition-all disabled:opacity-50"
                        >
                          {tweak.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                      {isTweaking && (
                        <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex items-center justify-center">
                          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                        </div>
                      )}
                      <textarea 
                        className="w-full h-[350px] p-6 bg-transparent outline-none resize-none text-slate-700 leading-relaxed font-medium text-sm md:text-base custom-scrollbar"
                        value={generatedContent}
                        onChange={(e) => setGeneratedContent(e.target.value)}
                        placeholder="請在此貼上或編輯您的問卷內容..."
                      />
                    </div>
                    
                    <button
                      onClick={generateGasCode}
                      disabled={!generatedContent.trim() || isTweaking}
                      className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-slate-200 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
                    >
                      下一步：生成 Google 表單程式碼 <Code className="w-5 h-5" />
                    </button>
                  </>
                )}
              </motion.div>
            )}

            {/* 步驟 3: 生成表單 */}
            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {isGenerating ? (
                  <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-4">
                    <Loader2 className="w-16 h-16 animate-spin text-green-500" />
                    <div className="text-center">
                      <p className="text-lg font-medium text-slate-600">AI 正在編寫 Apps Script...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Code className="w-6 h-6 text-indigo-500" /> Google Apps Script
                      </h2>
                      <button 
                        onClick={() => copyToClipboard(gasCode)}
                        className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 text-sm font-bold shadow-sm ${copyFeedback ? 'bg-green-500 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                      >
                        {copyFeedback ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copyFeedback ? '已複製' : '複製程式碼'}
                      </button>
                    </div>

                    <div className="bg-[#1e1e1e] rounded-2xl p-6 border border-slate-800 max-h-[300px] overflow-y-auto custom-scrollbar relative group">
                      <pre className="text-green-400 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words">
                        <code>{gasCode}</code>
                      </pre>
                    </div>
                    
                    <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100">
                      <h3 className="font-bold text-indigo-800 mb-3 flex items-center gap-2">
                        <ClipboardCheck className="w-5 h-5" /> 實作待辦清單
                      </h3>
                      <div className="space-y-2">
                        {gasInstructions.map((inst) => (
                          <div 
                            key={inst.id} 
                            className="flex items-start gap-2 cursor-pointer group"
                            onClick={() => toggleCheck(inst.id)}
                          >
                            <div className="mt-0.5 text-indigo-500">
                              {checkedSteps[inst.id] ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />}
                            </div>
                            <span className={`text-sm select-none transition-all ${checkedSteps[inst.id] ? 'text-indigo-300 line-through' : 'text-indigo-800'}`}>
                              {inst.text.includes('Google Apps Script') ? (
                                <a href="https://script.google.com/" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-bold" onClick={e => e.stopPropagation()}>Google Apps Script</a>
                              ) : inst.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setStep(4)}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg mt-6"
                    >
                      下一步：脫離原廠設定，自訂美化表單 <Palette className="w-5 h-5" />
                    </button>
                  </>
                )}
              </motion.div>
            )}

            {/* 步驟 4: 自訂美化 */}
            {step === 4 && (
              <motion.div 
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Palette className="w-6 h-6 text-pink-500" /> 自訂專屬表單外觀
                </h2>

                {!customFormCode && !isGenerating && (
                  <div className="space-y-6">
                    <div className="bg-pink-50 p-5 rounded-2xl border border-pink-100">
                      <ol className="list-decimal ml-5 text-sm text-pink-700 space-y-1.5 font-medium">
                        <li>去剛建好的 Google 表單點擊右上角「預覽」(眼睛圖示)。</li>
                        <li>在預覽頁面，點擊滑鼠右鍵選擇 <strong>「檢視網頁原始碼」(Ctrl+U)</strong>。</li>
                        <li>全選複製所有代碼，貼到下方。</li>
                      </ol>
                    </div>

                    <div className="space-y-4">
                      <label className="block">
                        <div className="text-slate-700 font-bold flex items-center justify-between mb-2">
                          <span>1. 貼上 Google 表單網頁原始碼</span>
                          {!isValidSourceCode && (
                            <span className="text-red-500 text-xs flex items-center gap-1 font-normal bg-red-50 px-2 py-1 rounded">
                              <AlertCircle className="w-3.5 h-3.5" /> 這似乎不是表單原始碼，請確認是否複製正確
                            </span>
                          )}
                        </div>
                        <textarea 
                          className={`w-full h-32 p-4 rounded-2xl border ${!isValidSourceCode ? 'border-red-300 focus:ring-red-500' : 'border-slate-200 focus:ring-pink-500'} outline-none transition-all resize-none text-slate-600 font-mono text-xs custom-scrollbar`}
                          placeholder="<!DOCTYPE html><html..."
                          value={formSourceCode}
                          onChange={(e) => setFormSourceCode(e.target.value)}
                        />
                      </label>

                      <div>
                        <span className="text-slate-700 font-bold flex items-center gap-2 mb-3">
                          2. 選擇底色主題風格
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {baseStyles.map(style => (
                            <div 
                              key={style.name}
                              onClick={() => setSelectedStyle(style.name)}
                              className={`p-2.5 rounded-xl border-2 cursor-pointer flex items-center gap-3 transition-all ${
                                selectedStyle === style.name ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-slate-200 hover:border-pink-300 bg-white text-slate-600'
                              }`}
                            >
                              <div className="flex -space-x-1 shrink-0">
                                {style.colors.map((c, i) => <div key={i} className={`w-3.5 h-3.5 rounded-full border border-white/50 shadow-sm ${c}`}></div>)}
                              </div>
                              <span className="text-xs font-bold leading-tight">
                                {style.name.split(' ')[0]}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={generateCustomFormCode}
                      disabled={!formSourceCode.trim() || !isValidSourceCode}
                      className="w-full py-4 bg-pink-600 hover:bg-pink-700 disabled:bg-slate-200 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
                    >
                      魔法轉換：生成客製化網頁 <Sparkles className="w-5 h-5" />
                    </button>
                  </div>
                )}

                {isGenerating && (
                  <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-4">
                    <Loader2 className="w-16 h-16 animate-spin text-pink-500" />
                    <p className="text-lg font-medium text-slate-600">AI 正在融合主題風格與表單欄位...</p>
                  </div>
                )}

                {customFormCode && !isGenerating && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-pink-50 p-4 rounded-xl border border-pink-100">
                      <div className="text-pink-800 text-sm font-bold flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-pink-500" /> 成功生成 HTML 表單
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <div className="flex bg-white rounded-lg border border-pink-200 overflow-hidden mr-1">
                          <button onClick={() => setViewMode('preview')} className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1 transition-colors ${viewMode === 'preview' ? 'bg-pink-100 text-pink-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                            <Eye className="w-4 h-4" /> 預覽
                          </button>
                          <button onClick={() => setViewMode('code')} className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1 transition-colors ${viewMode === 'code' ? 'bg-pink-100 text-pink-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                            <Code2 className="w-4 h-4" /> 代碼
                          </button>
                        </div>
                        <button onClick={downloadHTML} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-1 shadow-sm">
                          <Download className="w-4 h-4" /> 下載 .html
                        </button>
                        <button onClick={() => setCustomFormCode('')} className="px-3 py-1.5 text-pink-600 bg-white hover:bg-pink-100 rounded-lg transition-colors text-sm font-medium border border-pink-200">
                          重新生成
                        </button>
                      </div>
                    </div>

                    {viewMode === 'preview' ? (
                      <div className="w-full bg-white rounded-2xl border-2 border-slate-200 overflow-hidden shadow-inner h-[600px]">
                        <iframe srcDoc={customFormCode} className="w-full h-full border-none" sandbox="allow-scripts allow-forms allow-same-origin" title="preview" />
                      </div>
                    ) : (
                      <div className="bg-[#1e1e1e] rounded-2xl p-6 border border-slate-800 max-h-[600px] overflow-y-auto custom-scrollbar">
                        <pre className="text-pink-400 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words">
                          <code>{customFormCode}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default App;
