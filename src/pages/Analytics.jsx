import React from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useContractDeployments } from '../hooks/useContractDeployments';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const { FiTrendingUp, FiBarChart3, FiPieChart, FiActivity } = FiIcons;

const Analytics = () => {
  const { liquidityEvents } = useWebSocket();
  const { contractDeployments } = useContractDeployments();

  // Generate hourly data for the last 24 hours
  const generateHourlyData = () => {
    const hours = [];
    const now = new Date();
    
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now.getTime() - (i * 60 * 60 * 1000));
      const hourKey = hour.getHours();
      
      const contractsInHour = contractDeployments.filter(contract => 
        new Date(contract.detected_at).getHours() === hourKey &&
        new Date(contract.detected_at).toDateString() === new Date().toDateString()
      ).length;
      
      const liquidityInHour = liquidityEvents.filter(event => 
        new Date(event.timestamp).getHours() === hourKey &&
        new Date(event.timestamp).toDateString() === new Date().toDateString()
      ).length;
      
      hours.push({
        hour: `${hourKey}:00`,
        contracts: contractsInHour,
        liquidity: liquidityInHour,
        total: contractsInHour + liquidityInHour
      });
    }
    
    return hours;
  };

  const hourlyData = generateHourlyData();

  const totalContracts = contractDeployments.length;
  const totalLiquidity = liquidityEvents.length;
  const todayContracts = contractDeployments.filter(c => 
    new Date(c.detected_at).toDateString() === new Date().toDateString()
  ).length;
  const todayLiquidity = liquidityEvents.filter(e => 
    new Date(e.timestamp).toDateString() === new Date().toDateString()
  ).length;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold text-white mb-2">Analytics</h1>
        <p className="text-gray-400">Comprehensive insights and trends</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Total Contracts', value: totalContracts, icon: FiActivity, color: 'cyber' },
          { title: 'Total Liquidity Events', value: totalLiquidity, icon: FiTrendingUp, color: 'matrix' },
          { title: 'Today\'s Contracts', value: todayContracts, icon: FiBarChart3, color: 'cyber' },
          { title: 'Today\'s Liquidity', value: todayLiquidity, icon: FiPieChart, color: 'matrix' }
        ].map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="bg-gray-800 rounded-xl p-6 border border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">{stat.title}</p>
                <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-lg bg-${stat.color}-600/20 flex items-center justify-center`}>
                <SafeIcon icon={stat.icon} className={`text-${stat.color}-400 text-xl`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          className="bg-gray-800 rounded-xl p-6 border border-gray-700"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <h3 className="text-xl font-semibold text-white mb-4">24-Hour Activity</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="hour" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
              />
              <Line
                type="monotone"
                dataKey="contracts"
                stroke="#38BDF8"
                strokeWidth={2}
                name="Contracts"
              />
              <Line
                type="monotone"
                dataKey="liquidity"
                stroke="#22C55E"
                strokeWidth={2}
                name="Liquidity"
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          className="bg-gray-800 rounded-xl p-6 border border-gray-700"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <h3 className="text-xl font-semibold text-white mb-4">Event Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="hour" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="total" fill="#38BDF8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      <motion.div
        className="bg-gray-800 rounded-xl p-6 border border-gray-700"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <h3 className="text-xl font-semibold text-white mb-4">Performance Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-cyber-400">{totalContracts + totalLiquidity}</div>
            <div className="text-gray-400 text-sm mt-1">Total Events Tracked</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-matrix-400">
              {Math.round(((todayContracts + todayLiquidity) / Math.max(totalContracts + totalLiquidity, 1)) * 100)}%
            </div>
            <div className="text-gray-400 text-sm mt-1">Today's Activity</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-400">Live</div>
            <div className="text-gray-400 text-sm mt-1">Monitoring Status</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Analytics;