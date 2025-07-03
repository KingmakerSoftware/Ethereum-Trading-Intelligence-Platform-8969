import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useContractDeployments } from '../hooks/useContractDeployments';
import StatsCard from '../components/StatsCard';
import ActivityChart from '../components/ActivityChart';
import DebugPanel from '../components/DebugPanel';
import RawResponseViewer from '../components/RawResponseViewer';
import ToParameterViewer from '../components/ToParameterViewer';
import RealtimeTestPanel from '../components/RealtimeTestPanel';

const { FiTrendingUp, FiTrendingDown, FiActivity, FiDollarSign, FiRefreshCw } = FiIcons;

const Dashboard = () => {
  const { liquidityEvents, connectionStatus } = useWebSocket();
  const { contractDeployments, getStatistics, lastFetch, forceRefresh } = useContractDeployments();
  const [refreshing, setRefreshing] = useState(false);

  const contractStats = getStatistics();

  // Manual refresh function
  const handleManualRefresh = async () => {
    setRefreshing(true);
    await forceRefresh();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const stats = [
    {
      title: 'New Contracts Today',
      value: contractStats.today,
      change: `+${contractStats.today} today`,
      icon: FiActivity,
      color: 'cyber'
    },
    {
      title: 'Liquidity Events',
      value: liquidityEvents.length,
      change: '+8.2%',
      icon: FiDollarSign,
      color: 'matrix'
    },
    {
      title: 'Active Monitoring',
      value: connectionStatus === 'connected' ? 'LIVE' : 'OFFLINE',
      change: connectionStatus === 'connected' ? 'Connected' : 'Disconnected',
      icon: connectionStatus === 'connected' ? FiTrendingUp : FiTrendingDown,
      color: connectionStatus === 'connected' ? 'matrix' : 'red'
    },
    {
      title: 'Total Tracked',
      value: contractStats.total + liquidityEvents.length,
      change: 'All Time',
      icon: FiActivity,
      color: 'cyber'
    }
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="motion-prevent-jump"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
            <p className="text-gray-400">Real-time Ethereum intelligence and analytics</p>
          </div>
          <div className="flex items-center space-x-4">
            {lastFetch && (
              <div className="text-sm text-gray-400">
                Last updated: {lastFetch.toLocaleTimeString()}
              </div>
            )}
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <SafeIcon icon={FiRefreshCw} className={`text-sm ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Data</span>
            </button>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="motion-prevent-jump"
          >
            <StatsCard {...stat} />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="motion-prevent-jump"
        >
          <DebugPanel />
        </motion.div>
        
        <motion.div
          className="bg-gray-800 rounded-xl p-6 border border-gray-700"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <h3 className="text-xl font-semibold text-white mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {[
              ...contractDeployments.slice(0, 3).map(contract => ({
                ...contract,
                type: 'contract',
                hash: contract.transaction_hash,
                timestamp: new Date(contract.detected_at)
              })),
              ...liquidityEvents.slice(0, 2)
            ]
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
              .slice(0, 5)
              .map((item, index) => (
                <div key={item.id || index} className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg">
                  <div className={`w-2 h-2 rounded-full ${
                    item.type === 'contract' ? 'bg-cyber-400' : 'bg-matrix-400'
                  }`}></div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">
                      {item.type === 'contract' ? 'Contract Deployed' : 'Liquidity Pool Created'}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {item.hash ? `${item.hash.slice(0, 10)}...` : 'Processing...'}
                    </p>
                  </div>
                  <span className="text-gray-400 text-xs">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            {contractDeployments.length === 0 && liquidityEvents.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <p>Waiting for blockchain events...</p>
                <p className="text-sm mt-1">Check the debug panel to see connection status</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="motion-prevent-jump"
        >
          <ActivityChart />
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="motion-prevent-jump"
        >
          <RawResponseViewer />
        </motion.div>
      </div>

      {/* Real-time Test Panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.8 }}
        className="motion-prevent-jump"
      >
        <RealtimeTestPanel />
      </motion.div>

      {/* Contract Deployment Monitor */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.9 }}
        className="motion-prevent-jump"
        style={{ willChange: 'transform' }}
      >
        <ToParameterViewer />
      </motion.div>
    </div>
  );
};

export default Dashboard;