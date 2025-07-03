import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useWebSocket } from '../contexts/WebSocketContext';
import { formatDistanceToNow } from 'date-fns';

const { FiRadio, FiExternalLink, FiCopy, FiFilter, FiRefreshCw } = FiIcons;

const RealTimeFeed = () => {
  const { contractDeployments, liquidityEvents, connectionStatus } = useWebSocket();
  const [activeFilter, setActiveFilter] = useState('all');
  const [copiedHash, setCopiedHash] = useState('');

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(''), 2000);
  };

  const allEvents = [
    ...contractDeployments.map(item => ({ ...item, type: 'contract' })),
    ...liquidityEvents.map(item => ({ ...item, type: 'liquidity' }))
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const filteredEvents = allEvents.filter(event => {
    if (activeFilter === 'all') return true;
    return event.type === activeFilter;
  });

  const filters = [
    { key: 'all', label: 'All Events', count: allEvents.length },
    { key: 'contract', label: 'Contracts', count: contractDeployments.length },
    { key: 'liquidity', label: 'Liquidity', count: liquidityEvents.length }
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Real-Time Feed</h1>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-matrix-400 animate-pulse' : 'bg-red-500'
            }`}></div>
            <p className="text-gray-400">
              {connectionStatus === 'connected' ? 'Live monitoring active' : 'Connection offline'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <SafeIcon icon={FiRadio} className="text-matrix-400 text-2xl animate-pulse" />
          <span className="text-matrix-400 font-mono text-sm">LIVE</span>
        </div>
      </motion.div>

      <div className="flex flex-wrap gap-3">
        {filters.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setActiveFilter(filter.key)}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              activeFilter === filter.key
                ? 'bg-cyber-600 text-white shadow-lg shadow-cyber-600/20'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {filter.label} ({filter.count})
          </button>
        ))}
      </div>

      <motion.div
        className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="p-4 border-b border-gray-700 bg-gray-750">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Event Stream</h3>
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <SafeIcon icon={FiRefreshCw} className="animate-spin" />
              <span>Auto-updating</span>
            </div>
          </div>
        </div>

        <div className="max-h-[600px] overflow-y-auto scrollbar-hide">
          <AnimatePresence>
            {filteredEvents.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <SafeIcon icon={FiRadio} className="text-4xl mx-auto mb-4 opacity-50" />
                <p>Waiting for events...</p>
                <p className="text-sm mt-2">New contracts and liquidity events will appear here</p>
              </div>
            ) : (
              filteredEvents.map((event, index) => (
                <motion.div
                  key={event.id || `${event.type}-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="p-4 border-b border-gray-700 hover:bg-gray-700/50 transition-colors animate-slide-up"
                >
                  <div className="flex items-start space-x-4">
                    <div className={`w-3 h-3 rounded-full mt-2 ${
                      event.type === 'contract' ? 'bg-cyber-400' : 'bg-matrix-400'
                    } animate-pulse-glow`}></div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-white font-medium">
                          {event.type === 'contract' ? 'New Contract Deployed' : 'Liquidity Pool Created'}
                        </h4>
                        <span className="text-xs text-gray-400 font-mono">
                          {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-400 text-sm">Hash:</span>
                          <code className="text-cyber-400 text-sm font-mono bg-gray-900 px-2 py-1 rounded">
                            {(event.hash || event.transactionHash || 'Processing...').slice(0, 16)}...
                          </code>
                          {(event.hash || event.transactionHash) && (
                            <button
                              onClick={() => copyToClipboard(event.hash || event.transactionHash)}
                              className="text-gray-400 hover:text-white transition-colors"
                            >
                              <SafeIcon 
                                icon={FiCopy} 
                                className={copiedHash === (event.hash || event.transactionHash) ? 'text-matrix-400' : ''} 
                              />
                            </button>
                          )}
                        </div>
                        
                        {event.from && (
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-400 text-sm">From:</span>
                            <code className="text-matrix-400 text-sm font-mono bg-gray-900 px-2 py-1 rounded">
                              {event.from.slice(0, 16)}...
                            </code>
                          </div>
                        )}
                        
                        {event.contractAddress && (
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-400 text-sm">Contract:</span>
                            <code className="text-yellow-400 text-sm font-mono bg-gray-900 px-2 py-1 rounded">
                              {event.contractAddress.slice(0, 16)}...
                            </code>
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-4 mt-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            event.type === 'contract' 
                              ? 'bg-cyber-600/20 text-cyber-400' 
                              : 'bg-matrix-600/20 text-matrix-400'
                          }`}>
                            {event.type === 'contract' ? 'CONTRACT' : 'LIQUIDITY'}
                          </span>
                          
                          {event.status && (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              event.status === 'pending' 
                                ? 'bg-yellow-600/20 text-yellow-400' 
                                : 'bg-matrix-600/20 text-matrix-400'
                            }`}>
                              {event.status.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default RealTimeFeed;