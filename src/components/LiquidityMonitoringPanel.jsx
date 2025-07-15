import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useLiquidityMonitoring } from '../hooks/useLiquidityMonitoring';
import { useContractVerification } from '../hooks/useContractVerification';
import { formatDistanceToNow } from 'date-fns';

const { FiDroplet, FiPlay, FiStop, FiTrash2, FiClock, FiCheckCircle, FiXCircle, FiExternalLink, FiRefreshCw, FiTrendingUp, FiZap, FiTarget, FiAlertCircle, FiSettings } = FiIcons;

const LiquidityMonitoringPanel = () => {
  const { 
    activeMonitors, 
    liquidityEvents, 
    loading, 
    error, 
    monitoringStats, 
    startLiquidityMonitoring, 
    stopLiquidityMonitoring, 
    deleteMonitor, 
    autoStartMonitoring, 
    fetchActiveMonitors,
    isMonitorStillActive,
    getAdminSettings
  } = useLiquidityMonitoring();
  
  const { verifiedContracts } = useContractVerification();
  const [selectedContract, setSelectedContract] = useState('');
  const [autoMonitorEnabled, setAutoMonitorEnabled] = useState(true);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [adminSettings, setAdminSettings] = useState(getAdminSettings());

  // Listen for admin settings changes
  useEffect(() => {
    const handleSettingsChange = (event) => {
      setAdminSettings(event.detail);
    };

    window.addEventListener('adminSettingsChanged', handleSettingsChange);
    return () => window.removeEventListener('adminSettingsChanged', handleSettingsChange);
  }, []);

  // Auto-start monitoring for newly verified contracts
  useEffect(() => {
    if (autoMonitorEnabled && verifiedContracts.length > 0) {
      verifiedContracts.forEach(contract => {
        // Check if not already monitoring
        const isMonitoring = activeMonitors.some(monitor =>
          monitor.contract_address.toLowerCase() === contract.contract_address.toLowerCase()
        );

        if (!isMonitoring) {
          console.log('🚀 Auto-starting monitoring for:', contract.contract_address);
          autoStartMonitoring(contract);
        }
      });
    }
  }, [verifiedContracts, autoMonitorEnabled, activeMonitors, autoStartMonitoring]);

  const handleManualStartMonitoring = async () => {
    if (!selectedContract) return;

    const contractData = verifiedContracts.find(c =>
      c.contract_address.toLowerCase() === selectedContract.toLowerCase()
    );

    if (contractData) {
      await startLiquidityMonitoring(selectedContract, contractData);
      setSelectedContract('');
    }
  };

  const getMonitorStatusColor = (status) => {
    switch (status) {
      case 'monitoring': return 'text-blue-400 bg-blue-900/20';
      case 'pair_detected': return 'text-green-400 bg-green-900/20';
      case 'expired': return 'text-yellow-400 bg-yellow-900/20';
      case 'deleted':
      case 'manual': return 'text-gray-400 bg-gray-900/20';
      default: return 'text-purple-400 bg-purple-900/20';
    }
  };

  const getMonitorStatusIcon = (status) => {
    switch (status) {
      case 'monitoring': return FiPlay;
      case 'pair_detected': return FiCheckCircle;
      case 'expired': return FiClock;
      case 'deleted':
      case 'manual': return FiStop;
      default: return FiTarget;
    }
  };

  const getTimeRemaining = (expiresAt, startedAt) => {
    // Use admin settings to calculate accurate remaining time
    const timeCheck = isMonitorStillActive(startedAt);
    
    if (!timeCheck.isActive) {
      return 'Expired';
    }

    const remainingMs = timeCheck.remainingTime;
    const minutes = Math.floor(remainingMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  // Safe function to get monitor duration with fallback
  const getMonitorDuration = (monitor) => {
    // First try to get from monitor record, then fallback to admin settings
    return monitor.monitor_duration_minutes || adminSettings.activeMonitorTimeMinutes || 60;
  };

  const openEtherscan = (address, type = 'address') => {
    const baseUrl = type === 'tx' ? 'https://etherscan.io/tx/' : 'https://etherscan.io/address/';
    window.open(`${baseUrl}${address}`, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <motion.div
        className="bg-gray-800 rounded-xl p-6 border border-gray-700"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center py-8">
          <SafeIcon icon={FiRefreshCw} className="text-4xl mx-auto mb-4 animate-spin text-cyan-400" />
          <p className="text-white">Loading liquidity monitoring...</p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Monitoring Statistics */}
      <motion.div
        className="bg-gray-800 rounded-xl p-6 border border-gray-700"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <SafeIcon icon={FiDroplet} className="text-cyan-400 text-xl" />
            <h3 className="text-lg font-semibold text-white">Liquidity Monitoring</h3>
            <span className="text-xs bg-cyan-600/20 text-cyan-400 px-2 py-1 rounded">
              AUTO-MONITOR
            </span>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-purple-900/20 px-3 py-1 rounded">
              <SafeIcon icon={FiSettings} className="text-purple-400" />
              <span className="text-purple-400 text-sm">
                {adminSettings.activeMonitorTimeMinutes}min duration
              </span>
            </div>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoMonitorEnabled}
                onChange={(e) => setAutoMonitorEnabled(e.target.checked)}
                className="rounded bg-gray-700 border-gray-600 text-cyan-400 focus:ring-cyan-400"
              />
              <span className="text-sm text-gray-300">Auto-monitor verified contracts</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{monitoringStats.total}</div>
            <div className="text-sm text-gray-400">Total Monitors</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-cyan-400">{monitoringStats.active}</div>
            <div className="text-sm text-gray-400">Active Monitoring</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{monitoringStats.pairDetected}</div>
            <div className="text-sm text-gray-400">Pairs Detected</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">{monitoringStats.expired}</div>
            <div className="text-sm text-gray-400">Expired Monitors</div>
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-900/20 border border-red-500/30 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <SafeIcon icon={FiAlertCircle} className="text-red-400" />
              <span className="text-red-400 text-sm font-medium">Monitoring Error</span>
            </div>
            <p className="text-red-300 text-xs mt-1">{error}</p>
          </div>
        )}

        {/* Admin Settings Info */}
        <div className="mt-4 bg-purple-900/20 border border-purple-500/30 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <SafeIcon icon={FiSettings} className="text-purple-400" />
            <span className="text-purple-400 text-sm font-medium">Current Monitor Settings</span>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-2 text-xs">
            <div>
              <span className="text-gray-400">Monitor Duration:</span>
              <span className="text-purple-300 ml-2">{adminSettings.activeMonitorTimeMinutes} minutes</span>
            </div>
            <div>
              <span className="text-gray-400">Auto-Verification:</span>
              <span className={`ml-2 ${adminSettings.autoVerificationEnabled ? 'text-green-400' : 'text-red-400'}`}>
                {adminSettings.autoVerificationEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
          <p className="text-purple-300 text-xs mt-1">
            Modify these settings in the Settings page to change monitoring behavior.
          </p>
        </div>
      </motion.div>

      {/* Manual Monitor Control */}
      <motion.div
        className="bg-gray-800 rounded-xl p-6 border border-gray-700"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <h3 className="text-lg font-semibold text-white mb-4">Manual Monitor Control</h3>
        <div className="flex items-center space-x-4">
          <select
            value={selectedContract}
            onChange={(e) => setSelectedContract(e.target.value)}
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
          >
            <option value="">Select a verified contract to monitor...</option>
            {verifiedContracts
              .filter(contract => !activeMonitors.some(monitor =>
                monitor.contract_address.toLowerCase() === contract.contract_address.toLowerCase() &&
                (monitor.status === 'monitoring' || isMonitorStillActive(monitor.started_at).isActive)
              ))
              .map(contract => (
                <option key={contract.id} value={contract.contract_address}>
                  {contract.contract_address.slice(0, 20)}...
                </option>
              ))}
          </select>
          <button
            onClick={handleManualStartMonitoring}
            disabled={!selectedContract}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SafeIcon icon={FiPlay} className="inline mr-2" />
            Start Monitoring
          </button>
        </div>
      </motion.div>

      {/* Active Monitors */}
      <motion.div
        className="bg-gray-800 rounded-xl p-6 border border-gray-700"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Active Monitors</h3>
          <button
            onClick={fetchActiveMonitors}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Refresh monitors"
          >
            <SafeIcon icon={FiRefreshCw} />
          </button>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {activeMonitors.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <SafeIcon icon={FiDroplet} className="text-4xl mx-auto mb-4 opacity-50" />
              <p>No active monitors</p>
              <p className="text-sm mt-2">
                {autoMonitorEnabled 
                  ? "Monitors will be automatically created for verified contracts" 
                  : "Enable auto-monitoring or manually start monitoring contracts"}
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {activeMonitors.map((monitor) => {
                const timeCheck = isMonitorStillActive(monitor.started_at);
                const displayStatus = !timeCheck.isActive ? 'expired' : monitor.status;
                const monitorDuration = getMonitorDuration(monitor);
                
                return (
                  <motion.div
                    key={monitor.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                    className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="p-2 rounded bg-cyan-600/20">
                          <SafeIcon 
                            icon={getMonitorStatusIcon(displayStatus)} 
                            className={`${getMonitorStatusColor(displayStatus).split(' ')[0]} ${
                              displayStatus === 'monitoring' && timeCheck.isActive ? 'animate-pulse' : ''
                            }`} 
                          />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <code className="text-cyan-400 text-sm font-mono bg-cyan-900/20 px-2 py-1 rounded">
                              {monitor.contract_address.slice(0, 20)}...
                            </code>
                            <span className={`text-xs px-2 py-1 rounded font-medium ${getMonitorStatusColor(displayStatus)}`}>
                              {displayStatus.toUpperCase()}
                            </span>
                            {monitor.liquidity_detected && (
                              <span className="text-xs px-2 py-1 rounded font-medium bg-green-600/20 text-green-400">
                                LIQUID
                              </span>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center space-x-1">
                              <span className="text-gray-400">Started:</span>
                              <span className="text-gray-300">
                                {formatDistanceToNow(new Date(monitor.started_at), { addSuffix: true })}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <span className="text-gray-400">Duration:</span>
                              <span className="text-purple-400">
                                {monitorDuration}min
                              </span>
                            </div>
                            
                            {displayStatus === 'monitoring' && timeCheck.isActive && (
                              <div className="flex items-center space-x-1">
                                <span className="text-gray-400">Remaining:</span>
                                <span className="text-yellow-400">
                                  {getTimeRemaining(monitor.expires_at, monitor.started_at)}
                                </span>
                              </div>
                            )}
                            
                            {monitor.pair_address && (
                              <div className="flex items-center space-x-1">
                                <span className="text-gray-400">Pair:</span>
                                <code className="text-green-400 font-mono">
                                  {monitor.pair_address.slice(0, 16)}...
                                </code>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-1 ml-2">
                        <button
                          onClick={() => openEtherscan(monitor.contract_address)}
                          className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                          title="View contract on Etherscan"
                        >
                          <SafeIcon icon={FiExternalLink} />
                        </button>
                        
                        {monitor.pair_address && (
                          <button
                            onClick={() => openEtherscan(monitor.pair_address)}
                            className="p-1 text-gray-400 hover:text-green-400 transition-colors"
                            title="View pair on Etherscan"
                          >
                            <SafeIcon icon={FiTrendingUp} />
                          </button>
                        )}
                        
                        {displayStatus === 'monitoring' && timeCheck.isActive && (
                          <button
                            onClick={() => stopLiquidityMonitoring(monitor.contract_address)}
                            className="p-1 text-gray-400 hover:text-yellow-400 transition-colors"
                            title="Stop monitoring"
                          >
                            <SafeIcon icon={FiStop} />
                          </button>
                        )}
                        
                        <button
                          onClick={() => deleteMonitor(monitor.contract_address)}
                          className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                          title="Delete monitor"
                        >
                          <SafeIcon icon={FiTrash2} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </motion.div>

      {/* Liquidity Events */}
      <motion.div
        className="bg-gray-800 rounded-xl p-6 border border-gray-700"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Liquidity Events</h3>
          <div className="flex items-center space-x-2">
            <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded">
              {liquidityEvents.length} events
            </span>
            <button
              onClick={() => setShowEventDetails(!showEventDetails)}
              className="text-cyan-400 hover:text-cyan-300 transition-colors text-sm"
            >
              {showEventDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {liquidityEvents.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <SafeIcon icon={FiZap} className="text-4xl mx-auto mb-4 opacity-50" />
              <p>No liquidity events detected yet</p>
              <p className="text-sm mt-2">Events will appear when pairs are created or liquidity is added</p>
            </div>
          ) : (
            <AnimatePresence>
              {liquidityEvents.map((event) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-gray-700 rounded-lg p-3 hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className={`w-3 h-3 rounded-full ${
                        event.event_type === 'PairCreated' ? 'bg-green-400 animate-pulse' : 'bg-blue-400 animate-pulse'
                      }`}></div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`text-sm font-medium ${
                            event.event_type === 'PairCreated' ? 'text-green-400' : 'text-blue-400'
                          }`}>
                            {event.event_type}
                          </span>
                          <code className="text-cyan-400 text-xs font-mono">
                            {event.contract_address.slice(0, 16)}...
                          </code>
                        </div>
                        
                        {showEventDetails && (
                          <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                            {event.pair_address && (
                              <div className="flex items-center space-x-1">
                                <span className="text-gray-400">Pair:</span>
                                <code className="text-green-400 font-mono">
                                  {event.pair_address.slice(0, 12)}...
                                </code>
                              </div>
                            )}
                            <div className="flex items-center space-x-1">
                              <span className="text-gray-400">Block:</span>
                              <span className="text-yellow-400">{event.block_number}</span>
                            </div>
                            {event.amount0 && (
                              <div className="flex items-center space-x-1">
                                <span className="text-gray-400">Amount0:</span>
                                <span className="text-purple-400">{parseFloat(event.amount0).toExponential(2)}</span>
                              </div>
                            )}
                            {event.amount1 && (
                              <div className="flex items-center space-x-1">
                                <span className="text-gray-400">Amount1:</span>
                                <span className="text-purple-400">{parseFloat(event.amount1).toExponential(2)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1 ml-2">
                      <button
                        onClick={() => openEtherscan(event.transaction_hash, 'tx')}
                        className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                        title="View transaction on Etherscan"
                      >
                        <SafeIcon icon={FiExternalLink} />
                      </button>
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(event.detected_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default LiquidityMonitoringPanel;