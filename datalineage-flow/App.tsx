import React, { useState, useMemo } from 'react';
import { DataFlowChart } from './components/DataFlowChart';
import { generateConfigChange } from './services/geminiService';
import { MOCK_DATA, INITIAL_CONFIG, PRESETS } from './constants';
import { VisualConfig } from './types';
import { 
  Maximize, RotateCcw, Sparkles, Loader2, Settings2, MessageSquare, 
  Palette, Layout, LucideIcon, Share2, MousePointer2
} from 'lucide-react';

// Reusable Control Components
const Section = ({ title, icon: Icon, children }: { title: string, icon: LucideIcon, children: React.ReactNode }) => (
    <div className="border-b border-slate-100 pb-4 mb-4 last:border-0">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Icon size={14} /> {title}
        </h3>
        <div className="space-y-3">{children}</div>
    </div>
);

const ControlRow = ({ label, children }: { label: string, children: React.ReactNode }) => (
    <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-600">{label}</label>
        <div className="w-32">{children}</div>
    </div>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input className="w-full text-xs p-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none" {...props} />
);

const Select = ({ options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: string[] }) => (
    <select className="w-full text-xs p-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white" {...props}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
);

const ColorPicker = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="flex items-center gap-2 justify-end">
        <span className="text-[10px] font-mono text-slate-400">{props.value}</span>
        <input type="color" className="w-6 h-6 rounded overflow-hidden border-0 cursor-pointer" {...props} />
    </div>
);

export default function App() {
  const [data] = useState(MOCK_DATA);
  const [config, setConfig] = useState<VisualConfig>(INITIAL_CONFIG);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const stats = useMemo(() => ({
      nodes: data.nodes.length,
      links: data.links.length,
  }), [data]);

  const handleGeminiAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setIsProcessing(true);
    try {
      const changes = await generateConfigChange(config, prompt);
      setConfig(prev => ({ ...prev, ...changes, presetName: 'Custom' }));
    } finally {
      setIsProcessing(false);
      setPrompt('');
    }
  };

  const applyPreset = (name: string) => {
      if (PRESETS[name]) {
          // Merge preset with defaults to ensure all fields are present if preset is partial
          setConfig({ ...INITIAL_CONFIG, ...PRESETS[name] });
      }
  };

  const update = (key: keyof VisualConfig, value: any) => {
      setConfig(prev => ({ ...prev, [key]: value, presetName: 'Custom' }));
  };

  return (
    <div className="flex h-screen w-full flex-col font-sans">
      {/* Header */}
      <header className="flex-none bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex flex-col">
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
               <div className="w-3 h-3 rounded-full bg-blue-600"></div>
               DataLineage Flow
            </h1>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                {stats.nodes} Nodes • {stats.links} Links • {config.presetName || 'Custom'}
            </div>
        </div>
        
        <div className="flex items-center gap-2">
           <button onClick={() => setFitTrigger(Date.now())} className="btn-icon">
             <Maximize size={16} /> <span className="hidden sm:inline">Fit</span>
           </button>
           <button onClick={() => setConfig(INITIAL_CONFIG)} className="btn-icon">
             <RotateCcw size={16} /> <span className="hidden sm:inline">Reset</span>
           </button>
           <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`btn-icon ${isSidebarOpen ? 'bg-blue-50 text-blue-600 border-blue-200' : ''}`}>
             <Settings2 size={16} />
           </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative bg-slate-50">
            <DataFlowChart data={data} config={config} onFitRequest={fitTrigger} />
            <div className="absolute bottom-6 left-6 pointer-events-none">
                 <div className="bg-white/80 backdrop-blur px-3 py-1.5 rounded-full text-xs text-slate-500 border border-slate-200 shadow-sm flex items-center gap-2">
                    <MousePointer2 size={12} /> Click node to isolate connections
                 </div>
            </div>
        </div>

        {/* Sidebar */}
        <aside className={`bg-white border-l border-slate-200 flex-none transition-all duration-300 ease-in-out flex flex-col ${isSidebarOpen ? 'w-80' : 'w-0 overflow-hidden opacity-0'}`}>
            {/* AI Assistant */}
            <div className="p-4 bg-slate-50 border-b border-slate-100">
                <form onSubmit={handleGeminiAction} className="relative">
                    <input 
                        value={prompt} onChange={e => setPrompt(e.target.value)}
                        placeholder="Ask AI to change styles..."
                        className="w-full pl-9 pr-9 py-2 rounded-md border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        disabled={isProcessing}
                    />
                    <Sparkles className="absolute left-3 top-2.5 text-blue-500" size={14} />
                    {isProcessing ? 
                        <Loader2 className="absolute right-3 top-2.5 animate-spin text-slate-400" size={14} /> :
                        <button type="submit" disabled={!prompt} className="absolute right-3 top-2.5 text-slate-400 hover:text-blue-600 disabled:opacity-50"><MessageSquare size={14} /></button>
                    }
                </form>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                
                {/* Presets */}
                <Section title="Style Presets" icon={Layout}>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.keys(PRESETS).map(p => (
                            <button 
                                key={p} 
                                onClick={() => applyPreset(p)}
                                className={`text-xs py-2 px-3 rounded border text-left transition-all ${config.presetName === p ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300 text-blue-700 font-medium' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </Section>

                {/* Node Settings */}
                <Section title="Nodes" icon={Settings2}>
                    <ControlRow label="Shape">
                        <Select value={config.nodeShape} onChange={e => update('nodeShape', e.target.value)} options={['rectangle', 'pill', 'roundedRect', 'ellipse', 'diamond', 'hexagon', 'parallelogram']} />
                    </ControlRow>
                    <ControlRow label="Fill Type">
                        <Select value={config.nodeFillType || 'solid'} onChange={e => update('nodeFillType', e.target.value)} options={['solid', 'gradient']} />
                    </ControlRow>
                    <ControlRow label="Width">
                        <Input type="range" min="50" max="300" value={config.nodeWidth} onChange={e => update('nodeWidth', +e.target.value)} />
                    </ControlRow>
                    <ControlRow label="Height">
                        <Input type="range" min="30" max="150" value={config.nodeHeight} onChange={e => update('nodeHeight', +e.target.value)} />
                    </ControlRow>
                    <ControlRow label="Fill Opacity">
                        <Input type="range" min="0" max="1" step="0.1" value={config.nodeFillOpacity} onChange={e => update('nodeFillOpacity', +e.target.value)} />
                    </ControlRow>
                     <ControlRow label="Border">
                        <Select value={config.nodeBorderStyle} onChange={e => update('nodeBorderStyle', e.target.value)} options={['solid', 'dashed', 'dotted', 'none']} />
                    </ControlRow>
                    {config.nodeBorderStyle !== 'none' && (
                        <ControlRow label="Border Width">
                             <Input type="number" min="0" max="10" value={config.nodeBorderWidth} onChange={e => update('nodeBorderWidth', +e.target.value)} />
                        </ControlRow>
                    )}
                </Section>

                {/* Link Settings */}
                <Section title="Links" icon={Share2}>
                     <ControlRow label="Curve">
                        <Select value={config.linkCurveStyle} onChange={e => update('linkCurveStyle', e.target.value)} options={['bezier', 'step', 'straight']} />
                    </ControlRow>
                    <ControlRow label="Color Mode">
                        <Select value={config.linkColorMode} onChange={e => update('linkColorMode', e.target.value)} options={['source', 'target', 'gradient', 'custom']} />
                    </ControlRow>
                    {config.linkColorMode === 'custom' && (
                        <ControlRow label="Color">
                            <ColorPicker value={config.linkColor} onChange={e => update('linkColor', e.target.value)} />
                        </ControlRow>
                    )}
                    <ControlRow label="Width">
                        <Input type="number" min="1" max="10" value={config.linkWidth} onChange={e => update('linkWidth', +e.target.value)} />
                    </ControlRow>
                    <ControlRow label="Opacity">
                        <Input type="range" min="0" max="1" step="0.1" value={config.lineOpacity} onChange={e => update('lineOpacity', +e.target.value)} />
                    </ControlRow>
                     <div className="flex gap-4 pt-2">
                        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                            <input type="checkbox" checked={config.showStartMarker} onChange={e => update('showStartMarker', e.target.checked)} /> Start Arrow
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                            <input type="checkbox" checked={config.showEndMarker} onChange={e => update('showEndMarker', e.target.checked)} /> End Arrow
                        </label>
                    </div>
                </Section>
                
                 {/* Display Settings */}
                <Section title="Display" icon={Palette}>
                    <ControlRow label="Background">
                        <ColorPicker value={config.backgroundColor} onChange={e => update('backgroundColor', e.target.value)} />
                    </ControlRow>
                     <ControlRow label="Shadows">
                        <div className="flex items-center justify-end">
                            <input type="checkbox" checked={config.nodeShadowEnabled} onChange={e => update('nodeShadowEnabled', e.target.checked)} />
                        </div>
                    </ControlRow>
                     <ControlRow label="Badges">
                        <div className="flex items-center justify-end">
                            <input type="checkbox" checked={config.showBadges} onChange={e => update('showBadges', e.target.checked)} />
                        </div>
                    </ControlRow>
                </Section>

            </div>
        </aside>
      </div>

      <style>{`
        .btn-icon {
            @apply p-2 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-2 text-xs font-medium transition-colors bg-white;
        }
      `}</style>
    </div>
  );
}
