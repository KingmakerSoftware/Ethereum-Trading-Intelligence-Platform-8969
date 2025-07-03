import React from 'react';
import { motion } from 'framer-motion';
import SafeIcon from '../common/SafeIcon';

const StatsCard = ({ title, value, change, icon, color = 'cyber' }) => {
  const colorClasses = {
    cyber: 'from-cyber-600 to-cyber-700 text-cyber-400',
    matrix: 'from-matrix-600 to-matrix-700 text-matrix-400',
    red: 'from-red-600 to-red-700 text-red-400'
  };

  return (
    <motion.div
      className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-all duration-200"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${colorClasses[color].split(' ').slice(0, 2).join(' ')} flex items-center justify-center`}>
          <SafeIcon icon={icon} className="text-white text-xl" />
        </div>
        <div className={`text-sm font-medium px-2 py-1 rounded ${
          change.startsWith('+') ? 'text-matrix-400 bg-matrix-400/10' : 
          change.startsWith('-') ? 'text-red-400 bg-red-400/10' :
          'text-gray-400 bg-gray-400/10'
        }`}>
          {change}
        </div>
      </div>
      
      <div>
        <h3 className="text-gray-400 text-sm font-medium">{title}</h3>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
      </div>
    </motion.div>
  );
};

export default StatsCard;