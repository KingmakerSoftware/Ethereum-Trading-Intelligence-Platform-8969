import React from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useContractDeployments } from '../hooks/useContractDeployments';

const ActivityChart = () => {
  const { liquidityEvents } = useWebSocket();
  const { contractDeployments } = useContractDeployments();

  // Generate sample data for the last 7 days
  const generateWeeklyData = () => {
    const days = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
      const dateString = date.toDateString();
      
      const contractsInDay = contractDeployments.filter(contract => 
        new Date(contract.detected_at).toDateString() === dateString
      ).length;
      
      const liquidityInDay = liquidityEvents.filter(event => 
        new Date(event.timestamp).toDateString() === dateString
      ).length;
      
      days.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        contracts: contractsInDay,
        liquidity: liquidityInDay
      });
    }
    
    return days;
  };

  const weeklyData = generateWeeklyData();

  return (
    <motion.div
      className="bg-gray-800 rounded-xl p-6 border border-gray-700"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h3 className="text-xl font-semibold text-white mb-4">Weekly Activity</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={weeklyData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="day" stroke="#9CA3AF" />
          <YAxis stroke="#9CA3AF" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#FFFFFF'
            }}
          />
          <Line
            type="monotone"
            dataKey="contracts"
            stroke="#38BDF8"
            strokeWidth={3}
            dot={{ fill: '#38BDF8', strokeWidth: 2, r: 4 }}
            name="Contracts"
          />
          <Line
            type="monotone"
            dataKey="liquidity"
            stroke="#22C55E"
            strokeWidth={3}
            dot={{ fill: '#22C55E', strokeWidth: 2, r: 4 }}
            name="Liquidity Events"
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

export default ActivityChart;