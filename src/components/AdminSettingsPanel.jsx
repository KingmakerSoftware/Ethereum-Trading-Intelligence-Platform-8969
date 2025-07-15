import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiSettings, FiSave, FiRefreshCw, FiClock, FiAlertCircle, FiCheck } = FiIcons;

const AdminSettingsPanel = () => {
  const [settings, setSettings] = useState({
    activeMonitorTimeMinutes: 60,
    autoVerificationEnabled: true,
    maxQueueSize: 100,
    verificationDelayMs: 1000,
    periodicCheckIntervalSeconds: 30
  });
  
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('cryptoIntel_adminSettings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsedSettings }));
        console.log('📋 Loaded admin settings from localStorage:', parsedSettings);
      } catch (err) {
        console.error('❌ Error loading admin settings:', err);
      }
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Validate settings
      if (settings.activeMonitorTimeMinutes < 1 || settings.activeMonitorTimeMinutes > 1440) {
        throw new Error('Active Monitor Time must be between 1 and 1440 minutes (24 hours)');
      }
      
      if (settings.verificationDelayMs < 500 || settings.verificationDelayMs > 10000) {
        throw new Error('Verification Delay must be between 500ms and 10 seconds');
      }

      // Save to localStorage
      localStorage.setItem('cryptoIntel_adminSettings', JSON.stringify(settings));
      
      // Trigger a custom event to notify other components
      window.dispatchEvent(new CustomEvent('adminSettingsChanged', { 
        detail: settings 
      }));
      
      console.log('✅ Admin settings saved:', settings);
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      
    } catch (err) {
      console.error('❌ Error saving settings:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reset to defaults
  const resetToDefaults = () => {
    setSettings({
      activeMonitorTimeMinutes: 60,
      autoVerificationEnabled: true,
      maxQueueSize: 100,
      verificationDelayMs: 1000,
      periodicCheckIntervalSeconds: 30
    });
    setError(null);
  };

  const handleInputChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
    setError(null);
    setSaved(false);
  };

  return (
    <motion.div
      className="bg-gray-800 rounded-xl p-6 border border-gray-700"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <SafeIcon icon={FiSettings} className="text-purple-400 text-xl" />
          <h3 className="text-lg font-semibold text-white">Admin Settings</h3>
          <span className="text-xs bg-purple-600/20 text-purple-400 px-2 py-1 rounded">
            ADMIN
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          {saved && (
            <div className="flex items-center space-x-1 text-green-400 text-sm">
              <SafeIcon icon={FiCheck} />
              <span>Saved</span>
            </div>
          )}
          
          <button
            onClick={resetToDefaults}
            className="px-3 py-1 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 transition-colors"
          >
            Reset
          </button>
          
          <button
            onClick={saveSettings}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SafeIcon icon={loading ? FiRefreshCw : FiSave} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-4">
          <div className="flex items-center space-x-2">
            <SafeIcon icon={FiAlertCircle} className="text-red-400" />
            <span className="text-red-400 text-sm font-medium">Error</span>
          </div>
          <p className="text-red-300 text-xs mt-1">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Liquidity Monitoring Settings */}
        <div className="bg-gray-900/50 rounded-lg p-4">
          <h4 className="text-white font-medium mb-4 flex items-center space-x-2">
            <SafeIcon icon={FiClock} className="text-cyan-400" />
            <span>Liquidity Monitoring</span>
          </h4>
          
          <div className="space-y-4">
            {/* Active Monitor Time */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Active Monitor Time (minutes)
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={settings.activeMonitorTimeMinutes}
                  onChange={(e) => handleInputChange('activeMonitorTimeMinutes', parseInt(e.target.value) || 60)}
                  className="w-24 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                />
                <span className="text-gray-400 text-sm">minutes</span>
                <span className="text-gray-500 text-xs">
                  ({Math.floor(settings.activeMonitorTimeMinutes / 60)}h {settings.activeMonitorTimeMinutes % 60}m)
                </span>
              </div>
              <p className="text-gray-400 text-xs mt-1">
                How long to monitor each contract for liquidity events. Range: 1-1440 minutes (24 hours max).
              </p>
            </div>
          </div>
        </div>

        {/* Contract Verification Settings */}
        <div className="bg-gray-900/50 rounded-lg p-4">
          <h4 className="text-white font-medium mb-4 flex items-center space-x-2">
            <SafeIcon icon={FiRefreshCw} className="text-green-400" />
            <span>Contract Verification</span>
          </h4>
          
          <div className="space-y-4">
            {/* Auto-Verification Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-300">
                  Auto-Verification Enabled
                </label>
                <p className="text-gray-400 text-xs mt-1">
                  Automatically verify contract addresses for new deployments
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoVerificationEnabled}
                  onChange={(e) => handleInputChange('autoVerificationEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            {/* Verification Delay */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Verification Delay (milliseconds)
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  min="500"
                  max="10000"
                  step="100"
                  value={settings.verificationDelayMs}
                  onChange={(e) => handleInputChange('verificationDelayMs', parseInt(e.target.value) || 1000)}
                  className="w-32 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                />
                <span className="text-gray-400 text-sm">ms</span>
                <span className="text-gray-500 text-xs">
                  ({(settings.verificationDelayMs / 1000).toFixed(1)}s)
                </span>
              </div>
              <p className="text-gray-400 text-xs mt-1">
                Delay between verification requests to avoid rate limiting. Range: 500ms-10s.
              </p>
            </div>

            {/* Max Queue Size */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Queue Size
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  min="10"
                  max="1000"
                  value={settings.maxQueueSize}
                  onChange={(e) => handleInputChange('maxQueueSize', parseInt(e.target.value) || 100)}
                  className="w-24 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                />
                <span className="text-gray-400 text-sm">items</span>
              </div>
              <p className="text-gray-400 text-xs mt-1">
                Maximum number of deployments to queue for verification.
              </p>
            </div>

            {/* Periodic Check Interval */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Periodic Check Interval (seconds)
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  min="10"
                  max="300"
                  value={settings.periodicCheckIntervalSeconds}
                  onChange={(e) => handleInputChange('periodicCheckIntervalSeconds', parseInt(e.target.value) || 30)}
                  className="w-24 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                />
                <span className="text-gray-400 text-sm">seconds</span>
              </div>
              <p className="text-gray-400 text-xs mt-1">
                How often to check for new pending deployments. Range: 10-300 seconds.
              </p>
            </div>
          </div>
        </div>

        {/* Current Settings Summary */}
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
          <h5 className="text-blue-400 font-medium mb-2">Current Configuration</h5>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-400">Monitor Duration:</span>
              <span className="text-blue-300 ml-2">
                {settings.activeMonitorTimeMinutes} minutes
              </span>
            </div>
            <div>
              <span className="text-gray-400">Auto-Verification:</span>
              <span className={`ml-2 ${settings.autoVerificationEnabled ? 'text-green-400' : 'text-red-400'}`}>
                {settings.autoVerificationEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Verification Delay:</span>
              <span className="text-blue-300 ml-2">
                {settings.verificationDelayMs}ms
              </span>
            </div>
            <div>
              <span className="text-gray-400">Check Interval:</span>
              <span className="text-blue-300 ml-2">
                {settings.periodicCheckIntervalSeconds}s
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminSettingsPanel;