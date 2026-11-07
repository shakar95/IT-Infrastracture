import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  X,
  Send,
  Maximize2,
  Minimize2,
  RotateCcw,
  Copy,
  Check,
  Download,
  FileSpreadsheet,
  ChevronDown,
  Layers,
  Server,
  Network,
  Cpu,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../services/api';

export default function GeminiChatToggle({
  devices = [],
  boqModels = [],
  racks = [],
  categories = [],
  floorPlans = [],
  activeProject = null,
  lang = 'en',
}) {
  const isKu = lang === 'ku';

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const initialGreeting = isKu
    ? `سڵاو! من **Gemini Infrastructure AI** ی زیرەکم.

من ئاگاداری سەرجەم ئامێرەکان (**${devices.length} ئامێر**)، مۆدێلەکانی BOQ، ڕاکەکان (**${racks.length} ڕاک**)، پۆرتەکانی سویچ و پەیوەندی نێوانیانم لە پڕۆژەی **${activeProject?.name_ku || activeProject?.name || 'Sitak Villa'}**.

دەتوانیت هەر پرسیارێکم لێ بکەیت دەربارەی:
- **پەیوەندی نێوان ئامێرەکان:** کام ئامێر لەسەر کام سویچ و کام پۆرتە یان لەناو کام ڕاکەدا جێگیر کراوە.
- **دروستکردنی تەیبڵ و ڕاپۆرت:** داوای دروستکردنی هەر تەیبڵێک بکە بەپێی کامێرا، وایفای، ئایپی، ڤیلان یان ڕاکەکان و دەتوانیت ڕاستەوخۆ بە فایلی Excel دایبەزێنیت!`
    : `Hello! I am **Gemini Infrastructure AI**, your autonomous infrastructure architect.

I have live, real-time access to all **${devices.length} devices**, BOQ models, **${racks.length} server racks**, and switch patching for **${activeProject?.name || 'Iraq Sitak Villa'}**.

Feel free to ask me anything about:
- **Equipment Interconnectivity:** Which devices are patched into which switches & ports, or mounted in which racks.
- **Dynamic Table Reports:** Request any custom equipment table (CCTV, Wi-Fi 7, IP allocations, VLANs, Pending status) and instantly export it to **Excel / CSV**!`;

  const [messages, setMessages] = useState([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content: initialGreeting,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      provider: 'gemini-1.5-flash',
    },
  ]);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  const quickPrompts = isKu
    ? [
        { label: '📊 تەیبڵی کامێراکان', query: 'تەیبڵێکم بۆ دروست بکە لە هەموو کامێراکانی چاودێری و LPR لەگەڵ ئایپی، سویچ و پۆرتەکانیان' },
        { label: '🗄️ ڕاپۆرتی ڕاکەکان', query: 'تەیبڵێکی تەواوی ڕاکەکانی سێرڤەر و ئامێرە جێگیرکراوەکانی ناویانم بۆ ئامادە بکە' },
        { label: '🔌 پەیوەندی سویچەکان', query: 'نەخشە و تەیبڵی پەیوەندی پۆرتەکانی سویچ و ئامێرە پاتچکراوەکانم بۆ بنووسە' },
        { label: '🌐 خشتەی ئایپی و ڤیلان', query: 'خشتەی تەواوی ناونیشانی IP و VLAN ی هەموو ئامێرەکان بە ڕیزبەندی دروست بکە' },
        { label: '⚠️ ئامێرە تەواونەکراوەکان', query: 'تەیبڵێکی ئەو ئامێرانەم بۆ بهێنە کە هێشتا دۆخیان Pending ـە و تەواو نەکراون' },
        { label: '📈 پوختەی گشتی پڕۆژە', query: 'پوختەیەکی ئەندازیاری و گشتی دەربارەی بارودۆخی هەموو تۆڕ و ئینفراسترەکچەرەکە بدە' },
      ]
    : [
        { label: '📊 CCTV Cameras Table', query: 'Generate an exhaustive table report of all CCTV cameras with IP, switch, port, and status' },
        { label: '🗄️ Server Racks Report', query: 'Provide a structured table report of all server racks and the equipment mounted inside each rack' },
        { label: '🔌 Switch Port Map', query: 'Map out the switch port patching connections for all network switches' },
        { label: '🌐 IP & VLAN Table', query: 'Create a complete IP address allocation and VLAN scheme table for all devices' },
        { label: '⚠️ Pending Devices', query: 'Give me a table of all equipment with Pending installation status' },
        { label: '📈 Project Overview', query: 'Give me a comprehensive infrastructure summary and health audit for the project' },
      ];

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const liveContext = {
        devices,
        boqModels,
        racks,
        categories,
        floorPlans,
        projectName: activeProject?.name || 'Iraq Sitak Villa Project',
      };

      const res = await api.chatInfrastructure(
        [...messages, userMsg],
        text,
        liveContext
      );

      const aiMsg = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: res.reply || (isKu ? 'وەڵام وەرگیرا بەڵام بەتاڵ بوو.' : 'Response received successfully.'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: res.provider || 'gemini-1.5-flash',
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errorMsg = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: isKu
          ? `⚠️ کێشەیەک ڕوویدا لە کاتی وەڵامدانەوە: ${err.message}`
          : `⚠️ Failed to get AI response: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    if (window.confirm(isKu ? 'ئایا دڵنیایت لە پاککردنەوەی چاتەکە؟' : 'Clear conversation history?')) {
      setMessages([
        {
          id: `msg-welcome-${Date.now()}`,
          role: 'assistant',
          content: initialGreeting,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          provider: 'gemini-1.5-flash',
        },
      ]);
    }
  };

  // Export table rows to Excel (.xlsx) file
  const handleExportTableToExcel = (tableData, fileName = 'Infrastructure_Report') => {
    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(tableData);

      // Auto-fit column widths
      const colWidths = tableData[0]?.map((_, colIdx) => {
        let maxLen = 12;
        tableData.forEach((row) => {
          const val = row[colIdx] ? String(row[colIdx]) : '';
          if (val.length > maxLen) maxLen = Math.min(val.length + 3, 40);
        });
        return { wch: maxLen };
      }) || [];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Report');
      XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      alert('Failed to export Excel file: ' + err.message);
    }
  };

  // Copy table as TSV (Tab-separated values) ready to paste directly into Excel or Google Sheets
  const handleCopyTable = (tableData, copyKey) => {
    try {
      const tsv = tableData.map((row) => row.join('\t')).join('\n');
      navigator.clipboard.writeText(tsv);
      setCopiedId(copyKey);
      setTimeout(() => setCopiedId(null), 2200);
    } catch (err) {
      alert('Failed to copy table: ' + err.message);
    }
  };

  // Helper to parse Markdown tables inside messages
  const parseMarkdownTables = (text) => {
    const lines = text.split('\n');
    const parts = [];
    let currentTable = null;
    let currentText = [];

    const flushText = () => {
      if (currentText.length > 0) {
        parts.push({ type: 'text', content: currentText.join('\n') });
        currentText = [];
      }
    };

    const flushTable = () => {
      if (currentTable) {
        parts.push({ type: 'table', ...currentTable });
        currentTable = null;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check if line is a table row (starts and ends with |)
      if (line.startsWith('|') && line.endsWith('|')) {
        const cells = line
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim().replace(/\*\*/g, '').replace(/`/g, ''));

        // Check if separator line (|---|---|)
        const isSeparator = cells.every((c) => /^:?-+:?$/.test(c.trim()));

        if (!currentTable) {
          flushText();
          currentTable = { headers: cells, rows: [], rawData: [cells] };
        } else if (isSeparator) {
          // skip separator row
        } else {
          currentTable.rows.push(cells);
          currentTable.rawData.push(cells);
        }
      } else {
        if (currentTable) {
          flushTable();
        }
        currentText.push(lines[i]);
      }
    }

    if (currentTable) flushTable();
    if (currentText.length > 0) flushText();

    return parts;
  };

  return (
    <>
      {/* 1. Global Floating Gemini AI Toggle Button */}
      <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 animate-bounce-subtle">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`group relative flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl transition-all duration-300 active:scale-95 cursor-pointer ${
            isOpen
              ? 'bg-slate-900 border-2 border-indigo-500 text-white shadow-indigo-950/80 ring-4 ring-indigo-500/20'
              : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-indigo-900/50 hover:shadow-indigo-600/40 hover:scale-105 ring-2 ring-indigo-400/40'
          }`}
          title={isKu ? 'چاتی زیرەکی Gemini AI بۆ ئینفراسترەکچەر' : 'Toggle Gemini Infrastructure AI Chat'}
        >
          {/* Subtle Outer Glowing Ripple */}
          {!isOpen && (
            <span className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 opacity-30 group-hover:opacity-60 blur-md transition duration-500 animate-pulse pointer-events-none" />
          )}

          {/* AI Icon */}
          <div className="relative w-7 h-7 rounded-xl bg-white/15 flex items-center justify-center shrink-0 shadow-inner">
            <Sparkles className="w-4 h-4 text-amber-300 animate-spin-slow" />
          </div>

          <div className="text-left hidden sm:block">
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-xs font-extrabold tracking-wide font-sans">Gemini AI</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <span className="text-[10px] text-indigo-200/90 font-medium leading-none block mt-1">
              {isKu ? 'پرسیار و تەیبڵ ڕاپۆرت' : 'Infrastructure Q&A & Tables'}
            </span>
          </div>

          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-slate-300 ml-1" />
          ) : (
            <span className="sm:hidden text-xs font-bold font-sans">AI</span>
          )}
        </button>
      </div>

      {/* 2. Floating AI Chat Window / Drawer */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-300 flex flex-col bg-slate-900/95 backdrop-blur-xl border border-indigo-500/50 rounded-3xl shadow-2xl overflow-hidden animate-scaleIn ${
            isExpanded
              ? 'inset-3 sm:inset-6 md:inset-8 w-auto h-auto max-w-none max-h-none'
              : 'bottom-20 right-3 sm:right-6 w-[95vw] sm:w-[500px] md:w-[580px] h-[640px] max-h-[85vh]'
          }`}
          style={{
            boxShadow: '0 25px 50px -12px rgba(99, 102, 241, 0.35), 0 0 40px rgba(0, 0, 0, 0.8)',
          }}
        >
          {/* Chat Window Top Header */}
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-900/50 shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-1.5 truncate">
                    <span>Gemini Infrastructure AI</span>
                    <span className="px-1.5 py-0.2 rounded-md text-[9px] font-bold font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      RAG 1.5
                    </span>
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 truncate font-mono">
                  <span className="text-cyan-400 font-semibold">{devices.length} {isKu ? 'ئامێر' : 'devices'}</span>
                  <span>•</span>
                  <span className="text-indigo-400 font-semibold">{racks.length} {isKu ? 'ڕاک' : 'racks'}</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-semibold">{activeProject?.name || 'Sitak Villa'}</span>
                </div>
              </div>
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleClearChat}
                title={isKu ? 'پاککردنەوەی مێژووی چات' : 'Clear Chat History'}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                title={isExpanded ? (isKu ? 'بچووککردنەوە' : 'Restore Size') : (isKu ? 'گەورەکردنی پەنجەرە' : 'Expand Fullscreen')}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer hidden sm:block"
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title={isKu ? 'داخستن' : 'Close'}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Suggested Queries Chips Bar */}
          <div className="px-3.5 py-2 bg-slate-950/60 border-b border-slate-800/80 shrink-0 overflow-x-auto no-scrollbar flex items-center gap-1.5">
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(qp.query)}
                disabled={isLoading}
                className="px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap bg-slate-900/90 hover:bg-indigo-950/60 text-slate-300 hover:text-indigo-200 border border-slate-800 hover:border-indigo-500/40 shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-40"
              >
                {qp.label}
              </button>
            ))}
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              const parsedParts = parseMarkdownTables(msg.content);

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 animate-fadeIn ${
                    isUser ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                      isUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white ring-2 ring-indigo-500/30'
                    }`}
                  >
                    {isUser ? <Cpu className="w-4 h-4" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
                  </div>

                  {/* Bubble */}
                  <div
                    className={`max-w-[88%] sm:max-w-[82%] rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed space-y-3 ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-tr-none shadow-lg shadow-blue-900/20'
                        : msg.isError
                        ? 'bg-red-950/50 border border-red-800 text-red-200 rounded-tl-none'
                        : 'bg-slate-950/80 border border-slate-800/90 text-slate-200 rounded-tl-none shadow-md'
                    }`}
                  >
                    {/* Render message parts: text + rich tables */}
                    {parsedParts.map((part, pIdx) => {
                      if (part.type === 'text') {
                        return (
                          <div
                            key={pIdx}
                            className="whitespace-pre-line leading-relaxed break-words font-sans"
                          >
                            {part.content}
                          </div>
                        );
                      }

                      if (part.type === 'table') {
                        const copyKey = `table-${msg.id}-${pIdx}`;
                        const isCopied = copiedId === copyKey;

                        return (
                          <div
                            key={pIdx}
                            className="my-3 rounded-2xl border border-indigo-500/40 bg-slate-900 overflow-hidden shadow-xl"
                          >
                            {/* Table Action Bar */}
                            <div className="px-3 py-2 bg-slate-950/90 border-b border-indigo-500/30 flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-[11px] font-bold font-mono text-indigo-300 flex items-center gap-1.5">
                                <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400" />
                                <span>{isKu ? 'تەیبڵی داتای ئینفراسترەکچەر' : 'Infrastructure Data Table'}</span>
                                <span className="opacity-70 font-normal">({part.rows.length} rows)</span>
                              </span>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleCopyTable(part.rawData, copyKey)}
                                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1 transition cursor-pointer"
                                  title={isKu ? 'کۆپیکردنی تەیبڵ بۆ ناو ئێکسڵ' : 'Copy Table to Clipboard (TSV / Excel Ready)'}
                                >
                                  {isCopied ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-400" />
                                      <span className="text-emerald-400">{isKu ? 'کۆپی کرا!' : 'Copied!'}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>{isKu ? 'کۆپی' : 'Copy'}</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleExportTableToExcel(part.rawData, `Infrastructure_Report`)}
                                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm flex items-center gap-1 transition active:scale-95 cursor-pointer"
                                  title={isKu ? 'داگرتنی فایلی Excel (.xlsx)' : 'Download as Excel Spreadsheet (.xlsx)'}
                                >
                                  <Download className="w-3 h-3" />
                                  <span>{isKu ? 'داگرتنی ئێکسڵ' : 'Export Excel'}</span>
                                </button>
                              </div>
                            </div>

                            {/* Responsive Table Body */}
                            <div className="overflow-x-auto max-h-[340px] custom-scrollbar">
                              <table className="w-full text-left border-collapse text-[11px]">
                                <thead>
                                  <tr className="bg-slate-950/90 border-b border-indigo-500/20 text-indigo-300 font-mono font-bold">
                                    {part.headers.map((h, hIdx) => (
                                      <th key={hIdx} className="px-3 py-2 whitespace-nowrap">
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60 font-sans">
                                  {part.rows.map((row, rIdx) => (
                                    <tr
                                      key={rIdx}
                                      className="hover:bg-indigo-950/20 transition-colors duration-150 odd:bg-slate-900/40 even:bg-slate-950/40"
                                    >
                                      {row.map((cell, cIdx) => {
                                        const isStatusCell = cell.includes('Verified') || cell.includes('Configured') || cell.includes('Pending') || cell.includes('Installed');
                                        const isIpCell = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cell);

                                        return (
                                          <td
                                            key={cIdx}
                                            className={`px-3 py-2 whitespace-nowrap ${
                                              cIdx === 1 ? 'font-mono font-bold text-white' : 'text-slate-300'
                                            }`}
                                          >
                                            {isStatusCell ? (
                                              <span
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono ${
                                                  cell.includes('Verified')
                                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                                    : cell.includes('Configured')
                                                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                                                    : cell.includes('Installed')
                                                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                                }`}
                                              >
                                                {cell}
                                              </span>
                                            ) : isIpCell ? (
                                              <span className="font-mono text-cyan-300 font-semibold">{cell}</span>
                                            ) : (
                                              cell
                                            )}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      }

                      return null;
                    })}

                    {/* Timestamp & Provider footer */}
                    <div className="flex items-center justify-between text-[10px] opacity-70 pt-1 font-mono">
                      <span>{msg.timestamp}</span>
                      {msg.provider && <span>Engine: {msg.provider}</span>}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing / Loading state */}
            {isLoading && (
              <div className="flex items-center gap-3 animate-fadeIn">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shrink-0">
                  <RefreshCw className="w-4 h-4 text-amber-300 animate-spin" />
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-indigo-500/30 text-xs text-indigo-300 font-mono flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                  <span>{isKu ? 'جێمینی سەرقاڵی شیکاری تۆڕ و دروستکردنی تەیبڵە...' : 'Gemini AI is analyzing topology & synthesizing table...'}</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Box Bar */}
          <div className="p-3 sm:p-4 bg-slate-950/90 border-t border-slate-800 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-end gap-2"
            >
              <div className="flex-1 bg-slate-900 border border-slate-800 focus-within:border-indigo-500 rounded-2xl p-2 sm:p-2.5 transition shadow-inner">
                <textarea
                  ref={inputRef}
                  rows={2}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={
                    isKu
                      ? 'پرسیارێک بنووسە یان داوای دروستکردنی تەیبڵ بکە (بۆ نموونە: تەیبڵی هەموو کامێراکانم بۆ دەربهێنە)...'
                      : 'Ask about devices, topology, or request custom table reports...'
                  }
                  className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none resize-none leading-relaxed"
                />
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px] text-slate-500 font-mono">
                  <span>Enter to send • Shift+Enter for newline</span>
                  <span className="text-indigo-400 font-semibold">{inputText.length} chars</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !inputText.trim()}
                className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-40 text-white shadow-lg shadow-indigo-900/40 transition active:scale-95 cursor-pointer shrink-0"
                title={isKu ? 'ناردنی پرسیار' : 'Send message'}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
