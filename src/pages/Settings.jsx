import React from 'react';
import { motion } from 'framer-motion';
import AdminSettingsPanel from '../components/AdminSettingsPanel';

const Settings = () => {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400">Configure system parameters and monitoring behavior</p>
      </motion.div>

      <AdminSettingsPanel />
    </div>
  );
};

export default Settings;