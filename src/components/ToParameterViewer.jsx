import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useContractDeployments } from '../hooks/useContractDeployments';
import { formatDistanceToNow } from 'date-fns';

const { FiTarget, FiCopy, FiCheckCircle, FiExternalLink, FiWifi, FiWifiOff, FiTrash2, FiAlertCircle } = FiIcons;

const ToParameterViewer = () => {
  const { 
    contractDeployments, 
    loading, 
    error, 
    realtimeStatus, 
    getStatistics, 
    generateEtherscanUrl,
    deleteContractDeployment 
  } = useContractDeployments();
  
  const [copiedId, setCopiedId] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ show: false, record: null });
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute to refresh "time ago" labels
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openEtherscan = (txHash) => {
    const url = generateEtherscanUrl(txHash);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDeleteClick = (record) => {
    setDeleteModal({ show: true, record });
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.record) return;
    
    setDeleting(deleteModal.record.id);
    setDeleteError(null);
    
    try {
      console.log('🗑️ [DELETE-UI] Starting delete process for:', deleteModal.record.transaction_hash);
      
      await deleteContractDeployment(deleteModal.record.transaction_hash);
      
      console.log('✅ [DELETE-UI] Delete completed successfully');
      setDeleteModal({ show: false, record: null });
      
      // Show success message briefly
      setTimeout(() => {
        console.log('✅ [DELETE-UI] Delete operation finished');
      }, 500);
      
    } catch (error) {
      console.error('❌ [DELETE-UI] Error deleting record:', error);
      setDeleteError(error.message || 'Failed to delete record');
      
      // Don't close modal on error, let user try again
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModal({ show: false, record: null });
    setDeleteError(null);
  };

  const stats = getStatistics();

  if (error) {
    return (
      <motion.div
        className="bg-red-900/20 border border-red-500/30 rounded-xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center space-x-2 mb-2">
          <SafeIcon icon={FiTarget} className="text-red-400" />
          <h3 className="text-lg font-semibold text-white">Contract Deployment Monitor</h3>
        </div>
        <p className="text-red-300">Error loading contract deployments: {error}</p>
      </motion.div>
    );
  }

  return (
    <>
      <motion.div
        className="bg-gray-800 rounded-xl p-6 border border-gray-700"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <SafeIcon icon={FiTarget} className="text-cyber-400 text-xl" />
            <h3 className="text-lg font-semibold text-white">Contract Deployment Monitor</h3>
            <div className="flex items-center space-x-2">
              <span className="text-xs bg-matrix-600/20 text-matrix-400 px-2 py-1 rounded">
                {contractDeployments.length} saved
              </span>
              <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded">
                {stats.total} total
              </span>
              <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded">
                {stats.today} today
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              realtimeStatus === 'SUBSCRIBED' ? 'bg-green-400 animate-pulse' :
              realtimeStatus === 'CONNECTING' ? 'bg-yellow-400 animate-pulse' :
              'bg-red-400'
            }`}></div>
            <span className="text-xs text-gray-400">
              Real-time: {realtimeStatus}
            </span>
          </div>
        </div>

        <div className={`border rounded-lg p-3 mb-4 ${
          realtimeStatus === 'SUBSCRIBED' ? 'bg-green-900/20 border-green-500/30' : 'bg-yellow-900/20 border-yellow-500/30'
        }`}>
          <div className="flex items-center space-x-2 mb-2">
            <SafeIcon icon={realtimeStatus === 'SUBSCRIBED' ? FiWifi : FiWifiOff} className={
              realtimeStatus === 'SUBSCRIBED' ? 'text-green-400' : 'text-yellow-400'
            } />
            <span className={`text-sm font-medium ${
              realtimeStatus === 'SUBSCRIBED' ? 'text-green-400' : 'text-yellow-400'
            }`}>
              Real-time Status: {realtimeStatus}
            </span>
          </div>
          <p className={`text-xs ${
            realtimeStatus === 'SUBSCRIBED' ? 'text-green-300' : 'text-yellow-300'
          }`}>
            {realtimeStatus === 'SUBSCRIBED' 
              ? 'Contract deployments are automatically updated in real-time from Supabase.' 
              : 'Real-time updates are not active. Contract deployments will be added when detected.'}
          </p>
          <div className="mt-2 text-xs text-blue-400">
            🔗 Click the external link icon to view transactions on Etherscan
          </div>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {loading && contractDeployments.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <SafeIcon icon={FiTarget} className="text-4xl mx-auto mb-4 animate-spin" />
              <p>Loading contract deployments...</p>
            </div>
          ) : contractDeployments.length === 0 ? (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 text-gray-400"
            >
              <SafeIcon icon={FiTarget} className="text-4xl mx-auto mb-4 opacity-50" />
              <p>No contract deployments found</p>
              <p className="text-sm mt-2">
                Contract deployments will be saved here when detected
              </p>
              <p className="text-xs mt-2 text-blue-400">
                Enable the WebSocket connection to start monitoring
              </p>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              {contractDeployments.map((deployment) => (
                <motion.div
                  key={deployment.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="bg-gray-700 rounded-lg border border-matrix-500/50 bg-matrix-900/10 p-3 hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="p-1 rounded bg-matrix-600/20 text-matrix-400">
                        <SafeIcon icon={FiCheckCircle} className="text-sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <code className="text-cyber-400 text-xs font-mono bg-gray-900 px-2 py-1 rounded">
                            {deployment.transaction_hash?.slice(0, 16)}...
                          </code>
                          <span className="text-xs px-2 py-1 rounded font-medium bg-matrix-600/20 text-matrix-400">
                            CONTRACT DEPLOY
                          </span>
                          <span className={`text-xs px-2 py-1 rounded font-medium ${
                            deployment.status === 'confirmed' ? 'bg-green-600/20 text-green-400' :
                            deployment.status === 'test' ? 'bg-purple-600/20 text-purple-400' :
                            'bg-yellow-600/20 text-yellow-400'
                          }`}>
                            {deployment.status?.toUpperCase()}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center space-x-1">
                            <span className="text-gray-400">from:</span>
                            <code className="text-green-400 bg-green-900/20 font-mono px-1 py-0.5 rounded">
                              {deployment.from_address?.slice(0, 16)}...
                            </code>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-gray-400">to:</span>
                            <code className="text-red-400 bg-red-900/20 font-mono px-1 py-0.5 rounded">
                              {deployment.to_address || 'NULL'}
                            </code>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-gray-400">input:</span>
                            <span className="text-matrix-400">
                              {deployment.input_size}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-gray-400">value:</span>
                            <span className="text-yellow-400 text-xs">
                              {deployment.value === '0x0' ? '0 ETH' : `${parseInt(deployment.value || '0x0', 16)} wei`}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-gray-400">gasPrice:</span>
                            <span className="text-blue-400 text-xs">
                              {deployment.gas_price ? `${parseInt(deployment.gas_price, 16)} wei` : 'N/A'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-gray-400">detected:</span>
                            <span className="text-gray-500">
                              {formatDistanceToNow(new Date(deployment.detected_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 ml-2">
                      <button
                        onClick={() => openEtherscan(deployment.transaction_hash)}
                        className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                        title="View on Etherscan"
                      >
                        <SafeIcon icon={FiExternalLink} />
                      </button>
                      <button
                        onClick={() => copyToClipboard(deployment.transaction_hash, deployment.id)}
                        className="p-1 text-gray-400 hover:text-white transition-colors"
                        title={`Copy transaction hash: ${deployment.transaction_hash}`}
                      >
                        <SafeIcon icon={FiCopy} className={copiedId === deployment.id ? 'text-matrix-400' : ''} />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(deployment)}
                        disabled={deleting === deployment.id}
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                        title="Delete this record"
                      >
                        <SafeIcon icon={FiTrash2} className={deleting === deployment.id ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {stats.total > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-600">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-matrix-400">{contractDeployments.length}</div>
                <div className="text-xs text-gray-400">Displayed</div>
              </div>
              <div>
                <div className="text-lg font-bold text-blue-400">{stats.total}</div>
                <div className="text-xs text-gray-400">Total Saved</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-400">{stats.today}</div>
                <div className="text-xs text-gray-400">Today</div>
              </div>
              <div>
                <div className="text-lg font-bold text-yellow-400">{stats.last24Hours}</div>
                <div className="text-xs text-gray-400">Last 24h</div>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModal.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={handleDeleteCancel}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-800 rounded-xl p-6 border border-gray-700 max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-red-600/20 rounded-full flex items-center justify-center">
                  <SafeIcon icon={FiTrash2} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Delete Contract Deployment</h3>
                  <p className="text-gray-400 text-sm">This action cannot be undone</p>
                </div>
              </div>
              
              <div className="bg-gray-900 rounded-lg p-3 mb-4">
                <div className="text-sm text-gray-300 mb-2">
                  <strong>Transaction Hash:</strong>
                </div>
                <code className="text-cyber-400 text-xs font-mono bg-gray-800 px-2 py-1 rounded block break-all">
                  {deleteModal.record?.transaction_hash}
                </code>
              </div>

              {deleteError && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <SafeIcon icon={FiAlertCircle} className="text-red-400" />
                    <span className="text-red-400 text-sm font-medium">Delete Failed</span>
                  </div>
                  <p className="text-red-300 text-xs mt-1">{deleteError}</p>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={handleDeleteCancel}
                  className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleting === deleteModal.record?.id}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting === deleteModal.record?.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ToParameterViewer;