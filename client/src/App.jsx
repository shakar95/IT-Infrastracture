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
import CreateProjectModal from './components/CreateProjectModal';
import { api } from './services/api';

export default function App() {
  const [lang, setLang] = useState('en'); // 'en' | 'ku'
  const [activeTab, setActiveTab] = useState('dashboard');

  const [categories, setCategories] = useState([]);
  const [boqModels, setBoqModels] = useState([]);
  const [devices, setDevices] = useState([]);
  const [floorPlans, setFloorPlans] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Guardrail alert state
  const [guardrailAlert, setGuardrailAlert] = useState(null);

  // Selected device for AI Troubleshooter
  const [troubleshootDevice, setTroubleshootDevice] = useState(null);

  // Cross-component selected map plan & device
  const [selectedMapPlanId, setSelectedMapPlanId] = useState(null);
  const [selectedMapDevice, setSelectedMapDevice] = useState(null);

  // Cross-component selected BOQ category filter (from Dashboard cards)
  const [selectedBoqCategory, setSelectedBoqCategory] = useState('all');

  const handleSelectCategoryFromDashboard = (categoryId) => {
    setSelectedBoqCategory(categoryId || 'all');
    setActiveTab('boq');
  };

  // Load all data on mount
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setIsLoading(true);
      const [cats, projs] = await Promise.all([
        api.getCategories().catch(() => []),
        api.getProjects().catch(() => []),
      ]);

      setCategories(cats);

      let initialProj = null;
      if (Array.isArray(projs) && projs.length > 0) {
        setProjects(projs);
        initialProj = projs[0];
        setActiveProject(projs[0]);
      } else {
        const defaultProj = {
          id: 'proj-sitak',
          name: 'Iraq Sitak Villa Project',
          name_ku: 'پرۆژەی نایابی ڤێلای سیتەک',
          location: 'Sitak, Sulaymaniyah, KRI',
          location_ku: 'سیتەک، سلێمانی',
          client_name: 'VIP Mountain Estate',
        };
        setProjects([defaultProj]);
        initialProj = defaultProj;
        setActiveProject(defaultProj);
      }

      // Load data scoped strictly to initial project
      const [boqs, devs, maps] = await Promise.all([
        api.getBoqModels({ project_id: initialProj.id }).catch(() => []),
        api.getDevices({ project_id: initialProj.id }).catch(() => []),
        api.getMaps({ project_id: initialProj.id }).catch(() => []),
      ]);

      setBoqModels(boqs || []);
      setDevices(devs || []);
      setFloorPlans(maps || []);
    } catch (err) {
      console.error('Failed to load project infrastructure data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Re-fetch data whenever switching to another project / site
  const loadProjectScopedData = async (projectId) => {
    try {
      setIsLoading(true);
      const [boqs, devs, maps] = await Promise.all([
        api.getBoqModels({ project_id: projectId }).catch(() => []),
        api.getDevices({ project_id: projectId }).catch(() => []),
        api.getMaps({ project_id: projectId }).catch(() => []),
      ]);
      setBoqModels(boqs || []);
      setDevices(devs || []);
      setFloorPlans(maps || []);
    } catch (err) {
      console.error('Failed to load project data:', err);
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
      const created = await api.createBoqModel({
        ...modelData,
        project_id: activeProject?.id || 'proj-sitak',
      });
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

  const handleBulkImportBoq = async (importedItems) => {
    try {
      const targetProjId = activeProject?.id || 'proj-sitak';
      const res = await api.bulkImportBoqModels(importedItems, targetProjId);
      if (res && res.models) {
        setBoqModels(res.models);
      } else if (Array.isArray(res)) {
        setBoqModels(res);
      }
      return res;
    } catch (err) {
      catchGuardrail(err);
      throw err;
    }
  };

  // Restore BOQ Version
  const handleRestoreBoqVersion = async (versionId) => {
    try {
      const targetProjId = activeProject?.id || 'proj-sitak';
      const res = await api.restoreBoqVersion(versionId, targetProjId);
      if (res && res.models) {
        setBoqModels(res.models);
      }
      return res;
    } catch (err) {
      alert(err.message || 'Failed to restore BOQ version');
      throw err;
    }
  };

  // Create Manual BOQ Version Snapshot
  const handleCreateBoqSnapshot = async (snapshotData) => {
    try {
      const targetProjId = activeProject?.id || 'proj-sitak';
      return await api.createBoqSnapshot(targetProjId, snapshotData);
    } catch (err) {
      alert(err.message || 'Failed to create BOQ snapshot');
      throw err;
    }
  };

  // Multi-Project / Site Management Actions
  const handleCreateProject = async (projectData) => {
    try {
      const created = await api.createProject(projectData);
      setProjects((prev) => [...prev, created]);
      setActiveProject(created);
      // New project starts completely isolated and empty!
      setBoqModels([]);
      setDevices([]);
      setFloorPlans([]);
      return created;
    } catch (err) {
      alert(err.message || 'Failed to create project');
      throw err;
    }
  };

  const handleSwitchProject = (project) => {
    setActiveProject(project);
    loadProjectScopedData(project.id);
  };

  const handleDeleteProject = async (projectId) => {
    const targetProj = projects.find((p) => p.id === projectId);
    const projName = targetProj
      ? (lang === 'ku' ? (targetProj.name_ku || targetProj.name) : targetProj.name)
      : 'this project';

    const confirmMsg = lang === 'ku'
      ? `ئایا دڵنیایت لە سڕینەوەی تەواوەتی پڕۆژەی "${projName}"؟\nئاگاداربە: هەموو کەتەلۆگی BOQ، دیڤایسە تۆمارکراوەکان، و نەخشەکانی ئەم پڕۆژەیە بە یەکجاری دەسڕێنەوە!`
      : `Are you sure you want to completely delete "${projName}"?\nWarning: All BOQ items, provisioned devices, and floor plans for this site will be permanently deleted!`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setIsLoading(true);
      await api.deleteProject(projectId);
      const remainingProjects = projects.filter((p) => p.id !== projectId);

      if (remainingProjects.length === 0) {
        // If all projects were deleted, recreate the baseline default Sitak Villa project
        const defaultProj = {
          id: 'proj-sitak',
          name: 'Iraq Sitak Villa Project',
          name_ku: 'پرۆژەی نایابی ڤێلای سیتەک',
          location: 'Sitak, Sulaymaniyah, KRI',
          location_ku: 'سیتەک، سلێمانی',
          client_name: 'VIP Mountain Estate',
        };
        setProjects([defaultProj]);
        setActiveProject(defaultProj);
        await loadProjectScopedData(defaultProj.id);
      } else {
        setProjects(remainingProjects);
        if (activeProject?.id === projectId) {
          setActiveProject(remainingProjects[0]);
          await loadProjectScopedData(remainingProjects[0].id);
        }
      }
    } catch (err) {
      alert(err.message || 'Failed to delete project');
    } finally {
      setIsLoading(false);
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

  // Floor Plan Actions
  const handleCreateFloorPlan = async (planData) => {
    try {
      const created = await api.createFloorPlan({
        ...planData,
        project_id: planData.project_id || activeProject?.id || 'proj-sitak',
      });
      setFloorPlans((prev) => [...prev, created]);
      return created;
    } catch (err) {
      alert(err.message || 'Failed to create floor plan');
      throw err;
    }
  };

  const handleDeleteFloorPlan = async (id) => {
    if (!window.confirm('Delete this floor plan / site plan?')) return;
    try {
      await api.deleteFloorPlan(id);
      setFloorPlans((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      alert(err.message || 'Failed to delete floor plan');
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
        projects={projects}
        activeProject={activeProject}
        onSwitchProject={handleSwitchProject}
        onOpenCreateProject={() => setIsCreateProjectOpen(true)}
        onDeleteProject={handleDeleteProject}
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
                activeProject={activeProject}
                setActiveTab={setActiveTab}
                onSelectCategory={handleSelectCategoryFromDashboard}
                lang={lang}
              />
            )}

            {activeTab === 'boq' && (
              <BOQManager
                boqModels={boqModels}
                categories={categories}
                devices={devices}
                floorPlans={floorPlans}
                activeProject={activeProject}
                selectedCategory={selectedBoqCategory}
                onSelectCategory={setSelectedBoqCategory}
                onAddModel={handleAddBoqModel}
                onUpdateModel={handleUpdateBoqModel}
                onDeleteModel={handleDeleteBoqModel}
                onBulkProvision={handleBulkProvision}
                onBulkImport={handleBulkImportBoq}
                onRestoreVersion={handleRestoreBoqVersion}
                onCreateSnapshot={handleCreateBoqSnapshot}
                onCreateDevice={handleCreateDevice}
                onUpdateStatus={handleUpdateStatus}
                onNavigateToMap={handleNavigateToMap}
                onCreateCategory={handleCreateCategory}
                onCreateFloorPlan={handleCreateFloorPlan}
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
                onCreateCategory={handleCreateCategory}
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
                onUpdateDevice={handleUpdateDevice}
                onOpenTroubleshoot={handleOpenTroubleshoot}
                onCreateFloorPlan={handleCreateFloorPlan}
                onDeleteFloorPlan={handleDeleteFloorPlan}
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

      {/* Create Project / Site Modal */}
      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        onCreateProject={handleCreateProject}
        lang={lang}
      />
    </div>
  );
}

