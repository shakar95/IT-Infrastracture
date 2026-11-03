import React from 'react';
import {
  Layers,
  Cpu,
  CheckCircle2,
  Network,
  Server,
  ArrowUpRight,
  Camera,
  Bot,
  MapPin,
  TrendingUp,
  Clock,
  ShieldCheck,
  Tv,
  Volume2,
  Monitor,
  Film,
  Wifi,
  PhoneCall,
  Bell,
  Key,
} from 'lucide-react';
import { translations } from '../i18n/translations';

const ICON_MAP = {
  Tv,
  Cpu,
  Volume2,
  Monitor,
  Film,
  Wifi,
  Camera,
  ShieldCheck,
  Key,
  Bell,
  PhoneCall,
  Layers,
};

export default function DashboardOverview({
  categories = [],
  boqModels = [],
  devices = [],
  setActiveTab,
  onSelectCategory,
  lang = 'en',
}) {
  const t = translations[lang] || translations.en;
  const isKu = lang === 'ku';

  // Calculations
  const totalBoqModelsCount = boqModels.length;
  const totalTargetQty = boqModels.reduce((acc, m) => acc + (m.total_qty || 0), 0);
  const totalProvisionedDevices = devices.length;

  const verifiedDevices = devices.filter((d) => d.installation_status === 'Verified').length;
  const verifiedRate = totalProvisionedDevices > 0 ? Math.round((verifiedDevices / totalProvisionedDevices) * 100) : 0;

  const uniqueVlans = new Set(devices.map((d) => d.vlan_id).filter(Boolean)).size;
  const rackDevicesCount = devices.filter((d) => d.placement_zone === 'rack').length;

  // Stat Cards Config
  const stats = [
    {
      title: t.totalBoqModels,
      value: totalBoqModelsCount,
      sub: `${totalTargetQty} total units specified in BOQ`,
      icon: Layers,
      color: 'from-blue-500 to-indigo-500',
      tab: 'boq',
    },
    {
      title: t.totalDevices,
      value: totalProvisionedDevices,
      sub: `${totalTargetQty - totalProvisionedDevices} units remaining to provision`,
      icon: Cpu,
      color: 'from-purple-500 to-pink-500',
      tab: 'devices',
    },
    {
      title: t.verifiedRate,
      value: `${verifiedRate}%`,
      sub: `${verifiedDevices} of ${totalProvisionedDevices} commissioned`,
      icon: CheckCircle2,
      color: 'from-emerald-500 to-teal-500',
      tab: 'devices',
    },
    {
      title: t.activeVlans,
      value: uniqueVlans || 5,
      sub: 'VLAN 10, 20, 30, 40, 50 isolated',
      icon: Network,
      color: 'from-amber-500 to-orange-500',
      tab: 'devices',
    },
    {
      title: t.rackUnitsOccupied,
      value: `${rackDevicesCount} Units`,
      sub: 'Main 42U Server Rack A (Sitak)',
      icon: Server,
      color: 'from-cyan-500 to-blue-500',
      tab: 'map',
    },
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900/60 via-indigo-900/40 to-slate-900 border border-blue-500/20 p-6 sm:p-8">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 mb-3">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>{isKu ? 'پرۆژەی نایابی ڤێلای سیتەک • سلێمانی' : 'VIP Mountain Estate • Sulaymaniyah, KRI'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {isKu
              ? 'سیستەمی چاودێری و بەڕێوەبردنی تەواوەتی ژێرخانی IT و ELV'
              : 'Unified IT & ELV Infrastructure Commissioning Engine'}
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-300">
            {isKu
              ? 'چاودێریکردنی سەنتەری پەخشی IPTV، سیستەمی کۆنترۆڵی Crestron، تۆڕی خێرای Wi-Fi 7، کامێراکانی CCTV، ناسینەوەی تابلۆی ئۆتۆمبێل LPR، و دەروازە زیرەکەکان.'
              : 'Real-time telemetry, spatial floor plan mapping, and automated provisioning for IPTV headends, Crestron automation, Wi-Fi 7, CCTV, LPR gate barriers, and video intercoms.'}
          </p>

          {/* Quick Action Pills */}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => setActiveTab('devices')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 transition active:scale-95"
            >
              <Cpu className="w-4 h-4" />
              {t.btnNewDevice}
            </button>
            <button
              onClick={() => setActiveTab('scanner')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition active:scale-95"
            >
              <Camera className="w-4 h-4 text-amber-400" />
              {t.btnScanSticker}
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition active:scale-95"
            >
              <MapPin className="w-4 h-4 text-blue-400" />
              {t.btnOpenMap}
            </button>
            <button
              onClick={() => setActiveTab('troubleshoot')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/30 transition active:scale-95"
            >
              <Bot className="w-4 h-4 text-indigo-400" />
              {t.btnAiHelp}
            </button>
          </div>
        </div>

        {/* Ambient Glow */}
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              onClick={() => {
                if (stat.tab === 'boq' && onSelectCategory) {
                  onSelectCategory('all');
                } else {
                  setActiveTab(stat.tab);
                }
              }}
              className="cursor-pointer group relative p-5 bg-slate-900/70 border border-slate-800/80 hover:border-blue-500/40 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{stat.title}</span>
                <div className={`p-2 rounded-xl bg-gradient-to-tr ${stat.color} text-white shadow-md`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-white group-hover:text-blue-400 transition">
                  {stat.value}
                </span>
                <p className="mt-1 text-[11px] text-slate-400 truncate">{stat.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Category Breakdown Section (11 ELV Categories) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">{t.categoryDistribution}</h3>
            <p className="text-xs text-slate-400">
              {isKu
                ? 'بەشەکانی سیستەمی ئەندازیاری ELV بەپێی ستانداردەکانی پرۆژەی سیتەک'
                : 'Status and distribution across all 11 Sitak Villa ELV infrastructure disciplines'}
            </p>
          </div>
          <button
            onClick={() => {
              if (onSelectCategory) {
                onSelectCategory('all');
              } else {
                setActiveTab('boq');
              }
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300"
          >
            <span>{isKu ? 'بینینی کەتەلۆکی BOQ' : 'View Full BOQ'}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map((cat) => {
            const IconComponent = ICON_MAP[cat.icon_name] || Layers;
            const modelsInCat = boqModels.filter((m) => m.category_id === cat.id);
            const totalQty = modelsInCat.reduce((acc, m) => acc + (m.total_qty || 0), 0);
            const provCount = devices.filter((d) => {
              const m = boqModels.find((model) => model.id === d.boq_model_id);
              return m && m.category_id === cat.id;
            }).length;

            const progress = totalQty > 0 ? Math.min(100, Math.round((provCount / totalQty) * 100)) : 0;

            return (
              <div
                key={cat.id}
                onClick={() => {
                  if (onSelectCategory) {
                    onSelectCategory(cat.id);
                  } else {
                    setActiveTab('boq');
                  }
                }}
                className="cursor-pointer p-4 bg-slate-900/60 border border-slate-800 hover:border-blue-500/60 rounded-2xl hover:bg-slate-800/80 transition-all duration-200 group relative shadow-sm hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between">
                  <div
                    className="p-2.5 rounded-xl text-white shadow-sm"
                    style={{ backgroundColor: `${cat.color_code || '#3B82F6'}25`, color: cat.color_code || '#3B82F6' }}
                  >
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                      {provCount} / {totalQty} Units
                    </span>
                    <div className="p-1 rounded-md text-slate-500 group-hover:text-blue-400 group-hover:bg-blue-500/10 transition">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition truncate">
                    {isKu ? cat.name_ku : cat.name}
                  </h4>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {isKu ? cat.name : cat.name_ku}
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="mt-3 pt-3 border-t border-slate-800/60">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>Provisioning</span>
                    <span className="font-semibold text-slate-200">{progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: cat.color_code || '#3B82F6',
                      }}
                    />
                  </div>
                </div>

                {/* Card Action Hint */}
                <div className="mt-2.5 pt-2 border-t border-slate-800/40 flex items-center justify-between text-[10px] text-slate-500 group-hover:text-blue-400 transition">
                  <span>{isKu ? 'کلیک بکە بۆ بینینی کەرەستەکانی ئەم بەشە' : 'Click to view BOQ models'}</span>
                  <span className="font-bold">→</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Devices Quick Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">{t.recentActivity}</h3>
          </div>
          <button
            onClick={() => setActiveTab('devices')}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300"
          >
            {isKu ? 'بینینی هەموو ئامێرەکان' : 'View All Devices'} →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">{t.customLabel}</th>
                <th className="px-4 py-3">{t.model}</th>
                <th className="px-4 py-3">{t.ipAddress}</th>
                <th className="px-4 py-3">{t.switchPort}</th>
                <th className="px-4 py-3">{t.rackLocation}</th>
                <th className="px-4 py-3">{t.status}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {devices.slice(0, 5).map((dev) => {
                const model = boqModels.find((m) => m.id === dev.boq_model_id);
                return (
                  <tr key={dev.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-mono font-bold text-white">{dev.custom_label_id}</td>
                    <td className="px-4 py-3">{model ? `${model.brand} ${model.model}` : 'Generic ELV'}</td>
                    <td className="px-4 py-3 font-mono text-cyan-400">{dev.ip_address || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {dev.switch_name ? `${dev.switch_name} [${dev.switch_port}]` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{dev.rack_unit || 'Field Mounted'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          dev.installation_status === 'Verified'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : dev.installation_status === 'Configured'
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            : dev.installation_status === 'Installed'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {dev.installation_status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

