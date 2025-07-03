import React from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useWebSocket } from '../contexts/WebSocketContext';

const { FiTerminal, FiRefreshCw, FiWifi, FiWifiOff, FiAlertCircle, FiClock, FiToggleLeft, FiToggleRight, FiPower } = FiIcons;

const DebugPanel = () => {
  const {
    debugMessages,
    connectionStatus,
    isEnabled,
    testConnection,
    connect,
    tryAlternativeConnection,
    toggleConnection
  } = useWebSocket();

  return (
    <motion.div
      className="bg-gray-800 rounded-xl p-6 border border-gray-700"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <SafeIcon icon={FiTerminal} className="text-cyber-400 text-xl" />
          <h3 className="text-lg font-semibold text-white">Connection Debug</h3>
          <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded">ALCHEMY API</span>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleConnection}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 ${
              isEnabled
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
            }`}
          >
            <SafeIcon icon={isEnabled ? FiToggleRight : FiToggleLeft} className="text-lg" />
            <span className="text-sm font-medium">
              {isEnabled ? 'ON' : 'OFF'}
            </span>
          </button>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-400 animate-pulse' :
              connectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' :
              connectionStatus === 'error' ? 'bg-red-400' :
              'bg-gray-400'
            }`}></div>
            <span className="text-sm text-gray-400 capitalize">{connectionStatus}</span>
          </div>
        </div>
      </div>

      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mb-4">
        <div className="flex items-center space-x-2">
          <SafeIcon icon={FiClock} className="text-blue-400" />
          <span className="text-blue-400 text-sm font-medium">Alchemy WebSocket</span>
        </div>
        <p className="text-blue-300 text-xs mt-1">
          Connected to Alchemy's eth-mainnet endpoint with alchemy_pendingTransactions subscription.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={testConnection}
          disabled={!isEnabled}
          className="px-3 py-1 bg-cyber-600 text-white rounded text-sm hover:bg-cyber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Test Connection
        </button>
        <button
          onClick={connect}
          disabled={!isEnabled}
          className="px-3 py-1 bg-matrix-600 text-white rounded text-sm hover:bg-matrix-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reconnect
        </button>
        <button
          onClick={tryAlternativeConnection}
          className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 transition-colors"
        >
          Try HTTP API
        </button>
      </div>

      {!isEnabled && (
        <div className="bg-gray-900/20 border border-gray-500/30 rounded-lg p-3 mb-4">
          <div className="flex items-center space-x-2">
            <SafeIcon icon={FiPower} className="text-gray-400" />
            <span className="text-gray-400 text-sm font-medium">WebSocket Disabled</span>
          </div>
          <p className="text-gray-300 text-xs mt-1">
            Toggle the connection on to start monitoring Alchemy blockchain events.
          </p>
        </div>
      )}

      {connectionStatus === 'error' && isEnabled && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-4">
          <div className="flex items-center space-x-2">
            <SafeIcon icon={FiAlertCircle} className="text-red-400" />
            <span className="text-red-400 text-sm font-medium">Connection Failed</span>
          </div>
          <p className="text-red-300 text-xs mt-1">
            Unable to connect to Alchemy WebSocket. Check API key or network connection.
          </p>
        </div>
      )}

      <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm max-h-60 overflow-y-auto">
        <div className="text-gray-400 mb-2">Alchemy Connection Log:</div>
        {debugMessages.length === 0 ? (
          <div className="text-gray-500 italic">No debug messages yet...</div>
        ) : (
          debugMessages.map((message, index) => (
            <div
              key={index}
              className={`mb-1 ${
                message.includes('✅') ? 'text-green-400' :
                message.includes('❌') ? 'text-red-400' :
                message.includes('🔄') || message.includes('🚀') ? 'text-yellow-400' :
                message.includes('⏳') || message.includes('🐌') ? 'text-orange-400' :
                message.includes('📨') || message.includes('🎯') ? 'text-blue-400' :
                message.includes('🎭') ? 'text-purple-400' :
                message.includes('🟢') ? 'text-green-300' :
                message.includes('🔴') ? 'text-red-300' :
                'text-gray-300'
              }`}
            >
              {message}
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
};

export default DebugPanel;