import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiActivity, FiTrendingUp, FiRadio, FiSettings, FiZap } = FiIcons;

const menuItems = [
  { path: '/', icon: FiActivity, label: 'Dashboard' },
  { path: '/feed', icon: FiRadio, label: 'Live Feed' },
  { path: '/analytics', icon: FiTrendingUp, label: 'Analytics' },
  { path: '/settings', icon: FiSettings, label: 'Settings' },
];

const Sidebar = () => {
  const location = useLocation();

  return (
    <motion.div 
      className="fixed left-0 top-0 h-full w-64 bg-gray-800 border-r border-gray-700"
      initial={{ x: -100 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="p-6">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-10 h-10 bg-gradient-to-r from-cyber-400 to-matrix-400 rounded-lg flex items-center justify-center">
            <SafeIcon icon={FiZap} className="text-white text-xl" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white animate-glow">CryptoIntel</h1>
            <p className="text-xs text-gray-400">Advanced Analytics</p>
          </div>
        </div>

        <nav className="space-y-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-cyber-600 text-white shadow-lg shadow-cyber-600/20' 
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <SafeIcon icon={item.icon} className="text-lg" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="absolute bottom-6 left-6 right-6">
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-2 h-2 bg-matrix-400 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-300">Network Status</span>
          </div>
          <p className="text-xs text-gray-400">Ethereum Mainnet</p>
          <p className="text-xs text-matrix-400">Connected</p>
        </div>
      </div>
    </motion.div>
  );
};

export default Sidebar;