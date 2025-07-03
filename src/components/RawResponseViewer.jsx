import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useWebSocket } from '../contexts/WebSocketContext';
import { formatDistanceToNow } from 'date-fns';

const { FiCode, FiTrash2, FiCopy, FiChevronDown, FiChevronRight, FiDatabase, FiZap, FiGlobe, FiSend } = FiIcons;

const RawResponseViewer = () => {
  const { rawResponses, totalRawResponsesReceived, clearRawResponses } = useWebSocket();
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [copiedId, setCopiedId] = useState(null);

  const toggleExpand = (id) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const copyToClipboard = (data, id) => {
    const jsonString = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(jsonString);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'alchemy-websocket':
      case 'websocket':
        return FiZap;
      case 'alchemy-request':
      case 'request':
        return FiSend;
      case 'alchemy-http-request':
      case 'alchemy-http-response':
      case 'http-request':
      case 'http-response':
        return FiGlobe;
      default:
        return FiDatabase;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'alchemy-websocket':
      case 'websocket':
        return 'text-cyber-400 bg-cyber-400/10';
      case 'alchemy-request':
      case 'request':
        return 'text-yellow-400 bg-yellow-400/10';
      case 'alchemy-http-request':
      case 'alchemy-http-response':
      case 'http-request':
      case 'http-response':
        return 'text-purple-400 bg-purple-400/10';
      case 'mock-block':
        return 'text-matrix-400 bg-matrix-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  const formatJsonPreview = (data) => {
    const str = JSON.stringify(data);
    if (str.length > 100) {
      return str.substring(0, 100) + '...';
    }
    return str;
  };

  return (
    <motion.div
      className="bg-gray-800 rounded-xl p-6 border border-gray-700"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <SafeIcon icon={FiCode} className="text-cyber-400 text-xl" />
          <h3 className="text-lg font-semibold text-white">Raw Response Viewer</h3>
          <div className="flex items-center space-x-2">
            <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded">
              {rawResponses.length} visible
            </span>
            <span className="text-xs bg-matrix-600/20 text-matrix-400 px-2 py-1 rounded">
              {totalRawResponsesReceived} total
            </span>
          </div>
        </div>
        <button
          onClick={clearRawResponses}
          className="flex items-center space-x-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
        >
          <SafeIcon icon={FiTrash2} className="text-sm" />
          <span>Clear</span>
        </button>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        <AnimatePresence>
          {rawResponses.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <SafeIcon icon={FiCode} className="text-4xl mx-auto mb-4 opacity-50" />
              <p>No responses captured yet</p>
              <p className="text-sm mt-2">WebSocket and HTTP responses will appear here</p>
            </div>
          ) : (
            rawResponses.map((response) => {
              const isExpanded = expandedItems.has(response.id);
              const TypeIcon = getTypeIcon(response.type);

              return (
                <motion.div
                  key={response.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-gray-700 rounded-lg border border-gray-600 overflow-hidden"
                >
                  <div
                    className="p-3 cursor-pointer hover:bg-gray-600 transition-colors"
                    onClick={() => toggleExpand(response.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <SafeIcon
                          icon={isExpanded ? FiChevronDown : FiChevronRight}
                          className="text-gray-400"
                        />
                        <div className={`p-1 rounded ${getTypeColor(response.type)}`}>
                          <SafeIcon icon={TypeIcon} className="text-sm" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-white text-sm font-medium">
                              {response.type.replace('-', ' ').toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-400">
                              {response.size} bytes
                            </span>
                          </div>
                          <div className="text-xs text-gray-400">
                            {formatDistanceToNow(response.timestamp, { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(response.data, response.id);
                        }}
                        className="p-1 text-gray-400 hover:text-white transition-colors"
                      >
                        <SafeIcon
                          icon={FiCopy}
                          className={copiedId === response.id ? 'text-matrix-400' : ''}
                        />
                      </button>
                    </div>
                    {!isExpanded && (
                      <div className="mt-2 text-xs text-gray-400 font-mono bg-gray-800 p-2 rounded">
                        {formatJsonPreview(response.data)}
                      </div>
                    )}
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 bg-gray-900 border-t border-gray-600">
                          <pre className="text-xs text-gray-300 font-mono overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(response.data, null, 2)}
                          </pre>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default RawResponseViewer;