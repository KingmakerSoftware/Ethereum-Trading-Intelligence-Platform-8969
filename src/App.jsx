import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import RealTimeFeed from './pages/RealTimeFeed';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import { WebSocketProvider } from './contexts/WebSocketContext';
import './App.css';

function App() {
  return (
    <WebSocketProvider>
      <Router>
        <div className="min-h-screen bg-gray-900 text-white">
          <div className="flex">
            <Sidebar />
            <div className="flex-1 ml-64">
              <Header />
              <motion.main
                className="p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/feed" element={<RealTimeFeed />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </motion.main>
            </div>
          </div>
        </div>
      </Router>
    </WebSocketProvider>
  );
}

export default App;