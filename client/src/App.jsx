import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import DashboardOverview from './components/DashboardOverview';
import BOQManager from './components/BOQManager';
import DeviceProvisioning from './components/DeviceProvisioning';
import InteractiveMap from './components/InteractiveMap';
import AiCameraScanner from './components/AiCameraScanner';
import AiTroubleshooter from './components/AiTroubleshooter';
import CategoryBuilder from './components/CategoryBuilder';
import GuardrailAlert from './components/GuardrailAlert';
import { api } from './services/api';

export default function App() {
  const [lang, setLang] = useState('en'); // 'en' | 'ku'
  const [activeTab, setActiveTab] = useState('dashboard');

  const [categories, setCategories] = useState([]);
  const [boqModels, setBoqModels] = useState([]);
  const [devices, setDevices] = useState([]);
  const [floorPlans, setFloorPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Guardrail alert state
  const [guardrailAlert, setGuardrailAlert] = useState(null);

  // Selected device for AI Troubleshooter
  const [troubleshootDevice, setTroubleshootDevice] = useState(null);

  // Cross-component selected map plan & device
  const [selectedMapPlanId, setSelectedMapPlanId] = useState(null);
  const [selectedMapDevice, setSelectedMapDevice] = useState(null);

  // Load all data on mount
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setIsLoading(true);
      const [cats, boqs, devs, maps] = await Promise.all([
        api.getCategories().catch(() => []),
        api.getBoqModels().catch(() => []),
        api.getDevices().catch(() => []),
        api.getMaps().catch(() => []),
      ]);

      setCategories(cats);
      setBoqModels(boqs);
      setDevices(devs);
      setFloorPlans(maps);
    } catch (err) {
      console.error('Failed to load project infrastructure data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to handle guardrail errors
  const catchGuardrail = (err) => {
    if (err.isGuardrail && err.data) {
      setGuardrailAlert(err.data);
    } else {
      alert(err.message || 'Operation failed');
    }
  };

  // BOQ Actions
  const handleAddBoqModel = async (modelData) => {
    try {
      const created = await api.createBoqModel(modelData);
      setBoqModels((prev) => [created, ...prev]);
    } catch (err) {
      catchGuardrail(err);
    }
  };

  const handleUpdateBoqModel = async (id, updates) => {
    try {
      const updated = await api.updateBoqModel(id, updates);
      setBoqModels((prev) => prev.map((m) => (m.id === id ? { ...m, ...updated } : m)));
      return updated;
    } catch (err) {
      catchGuardrail(err);
      throw err;
    }
  };

  const handleDeleteBoqModel = async (id) => {
    if (!window.confirm('Delete this BOQ model from catalog?')) return;
    try {
      await api.deleteBoqModel(id);
      setBoqModels((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleBulkProvision = async (modelId, params) => {
    try {
      const res = await api.bulkProvisionBoq(modelId, params);
      if (res.devices) {
        setDevices((prev) => [...prev, ...res.devices]);
        // Update model count
        setBoqModels((prev) =>
          prev.map((m) =>
            m.id === modelId
              ? { ...m, provisioned_count: (m.provisioned_count || 0) + res.devices.length }
              : m
          )
        );
        setActiveTab('devices');
      }
    } catch (err) {
      catchGuardrail(err);
    }
  };

  // Device Actions
  const handleCreateDevice = async (deviceData) => {
    try {
      const created = await api.createDevice(deviceData);
      setDevices((prev) => [created, ...prev]);
      // Update BOQ provisioned count
      setBoqModels((prev) =>
        prev.map((m) =>
          m.id === created.boq_model_id
            ? { ...m, provisioned_count: (m.provisioned_count || 0) + 1 }
            : m
        )
      );
    } catch (err) {
      catchGuardrail(err);
      throw err;
    }
  };

  const handleUpdateDevice = async (id, updates) => {
    try {
      const updated = await api.updateDevice(id, updates);
      setDevices((prev) => prev.map((d) => (d.id === id ? updated : d)));
    } catch (err) {
      catchGuardrail(err);
      throw err;
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await api.updateDeviceStatus(id, status);
      setDevices((prev) =>
        prev.map((d) => (d.id === id ? { ...d, installation_status: status } : d))
      );
    } catch (err) {
      catchGuardrail(err);
    }
  };

  const handleUpdatePosition = async (id, position) => {
    try {
      await api.updateDevicePosition(id, position);
      setDevices((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...position } : d))
      );
    } catch (err) {
      catchGuardrail(err);
    }
  };

  const handleDeleteDevice = async (id) => {
    if (!window.confirm('Delete this provisioned device instance?')) return;
    try {
      await api.deleteDevice(id);
      setDevices((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  // Category Actions
  const handleCreateCategory = async (catData) => {
    try {
      const created = await api.createCategory(catData);
      setCategories((prev) => [...prev, created]);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Delete this category?')) return;
    try {
      await api.deleteCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  // Cross-component workflow: Open Troubleshooter with device context
  const handleOpenTroubleshoot = (device) => {
    setTroubleshootDevice(device);
    setActiveTab('troubleshoot');
  };

  // Cross-component workflow: Jump to Map with floor plan & device pin focused
  const handleNavigateToMap = (floorPlanId, deviceId) => {
    if (floorPlanId) setSelectedMapPlanId(floorPlanId);
    if (deviceId) {
      const dev = devices.find((d) => d.id === deviceId);
      if (dev) setSelectedMapDevice(dev);
    }
    setActiveTab('map');
  };

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans ${lang === 'ku' ? 'rtl-ready' : ''}`}>
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lang={lang}
        setLang={setLang}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400">Loading Iraq Sitak Villa Infrastructure Engine...</p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardOverview
                categories={categories}
                boqModels={boqModels}
                devices={devices}
                setActiveTab={setActiveTab}
                lang={lang}
              />
            )}

            {activeTab === 'boq' && (
              <BOQManager
                boqModels={boqModels}
                categories={categories}
                devices={devices}
                floorPlans={floorPlans}
                onAddModel={handleAddBoqModel}
                onUpdateModel={handleUpdateBoqModel}
                onDeleteModel={handleDeleteBoqModel}
                onBulkProvision={handleBulkProvision}
                onCreateDevice={handleCreateDevice}
                onUpdateStatus={handleUpdateStatus}
                onNavigateToMap={handleNavigateToMap}
                lang={lang}
              />
            )}

            {activeTab === 'devices' && (
              <DeviceProvisioning
                devices={devices}
                boqModels={boqModels}
                floorPlans={floorPlans}
                categories={categories}
                onCreateDevice={handleCreateDevice}
                onUpdateDevice={handleUpdateDevice}
                onUpdateStatus={handleUpdateStatus}
                onDeleteDevice={handleDeleteDevice}
                onOpenTroubleshoot={handleOpenTroubleshoot}
                onNavigateToMap={handleNavigateToMap}
                lang={lang}
              />
            )}

            {activeTab === 'map' && (
              <InteractiveMap
                floorPlans={floorPlans}
                devices={devices}
                boqModels={boqModels}
                categories={categories}
                onUpdatePosition={handleUpdatePosition}
                onOpenTroubleshoot={handleOpenTroubleshoot}
                initialSelectedPlanId={selectedMapPlanId}
                initialSelectedDevice={selectedMapDevice}
                lang={lang}
              />
            )}

            {activeTab === 'scanner' && (
              <AiCameraScanner
                boqModels={boqModels}
                categories={categories}
                onDeviceRegistered={handleCreateDevice}
                lang={lang}
              />
            )}

            {activeTab === 'troubleshoot' && (
              <AiTroubleshooter
                devices={devices}
                boqModels={boqModels}
                initialDevice={troubleshootDevice}
                lang={lang}
              />
            )}

            {activeTab === 'settings' && (
              <CategoryBuilder
                categories={categories}
                onCreateCategory={handleCreateCategory}
                onDeleteCategory={handleDeleteCategory}
                lang={lang}
              />
            )}
          </>
        )}
      </main>

      {/* Smart Placement Guardrail Alert Modal */}
      <GuardrailAlert
        alert={guardrailAlert}
        onClose={() => setGuardrailAlert(null)}
        lang={lang}
      />
    </div>
  );
}

