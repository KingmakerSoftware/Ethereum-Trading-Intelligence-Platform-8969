import React,{useEffect,useState} from 'react';
import {motion} from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import {useWebSocket} from '../contexts/WebSocketContext';
import {useContractDeployments} from '../hooks/useContractDeployments';
import StatsCard from '../components/StatsCard';
import ActivityChart from '../components/ActivityChart';
import DebugPanel from '../components/DebugPanel';
import RawResponseViewer from '../components/RawResponseViewer';
import ToParameterViewer from '../components/ToParameterViewer';
import ContractVerificationPanel from '../components/ContractVerificationPanel';
import LiquidityMonitoringPanel from '../components/LiquidityMonitoringPanel';

const {FiTrendingUp,FiTrendingDown,FiActivity,FiDollarSign}=FiIcons;

const Dashboard=()=> {
  const {liquidityEvents,connectionStatus}=useWebSocket();
  const {contractDeployments,getStatistics}=useContractDeployments();

  const contractStats=getStatistics();

  const stats=[ 
    {title: 'New Contracts Today',value: contractStats.today,change: `+${contractStats.today} today`,icon: FiActivity,color: 'cyber'},
    {title: 'Liquidity Events',value: liquidityEvents.length,change: '+8.2%',icon: FiDollarSign,color: 'matrix'},
    {title: 'Active Monitoring',value: connectionStatus==='connected' ? 'LIVE' : 'OFFLINE',change: connectionStatus==='connected' ? 'Connected' : 'Disconnected',icon: connectionStatus==='connected' ? FiTrendingUp : FiTrendingDown,color: connectionStatus==='connected' ? 'matrix' : 'red'},
    {title: 'Total Tracked',value: contractStats.total + liquidityEvents.length,change: 'All Time',icon: FiActivity,color: 'cyber'} 
  ];

  return ( 
    <div className="space-y-6"> 
      <motion.div 
        initial={{opacity: 0,y: 20}} 
        animate={{opacity: 1,y: 0}} 
        transition={{duration: 0.5}} 
        className="motion-prevent-jump" 
      > 
        <div className="flex items-center justify-between"> 
          <div> 
            <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1> 
            <p className="text-gray-400">Real-time Ethereum intelligence and analytics</p> 
          </div> 
        </div> 
      </motion.div> 

      {/* Stats Cards */} 
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"> 
        {stats.map((stat,index)=> ( 
          <motion.div 
            key={stat.title} 
            initial={{opacity: 0,y: 20}} 
            animate={{opacity: 1,y: 0}} 
            transition={{duration: 0.5,delay: index * 0.1}} 
            className="motion-prevent-jump" 
          > 
            <StatsCard {...stat} /> 
          </motion.div> 
        ))} 
      </div> 

      {/* Debug Panel - Full Width */}
      <motion.div 
        initial={{opacity: 0,y: 20}} 
        animate={{opacity: 1,y: 0}} 
        transition={{duration: 0.5,delay: 0.4}} 
        className="motion-prevent-jump" 
      > 
        <DebugPanel /> 
      </motion.div>

      {/* Contract Verification Panel */} 
      <motion.div 
        initial={{opacity: 0,y: 20}} 
        animate={{opacity: 1,y: 0}} 
        transition={{duration: 0.5,delay: 0.5}} 
        className="motion-prevent-jump" 
      > 
        <ContractVerificationPanel /> 
      </motion.div> 

      {/* Liquidity Monitoring Panel */} 
      <motion.div 
        initial={{opacity: 0,y: 20}} 
        animate={{opacity: 1,y: 0}} 
        transition={{duration: 0.5,delay: 0.6}} 
        className="motion-prevent-jump" 
      > 
        <LiquidityMonitoringPanel /> 
      </motion.div> 

      {/* Contract Deployment Monitor */} 
      <motion.div 
        initial={{opacity: 0,y: 20}} 
        animate={{opacity: 1,y: 0}} 
        transition={{duration: 0.5,delay: 0.7}} 
        className="motion-prevent-jump" 
        style={{willChange: 'transform'}} 
      > 
        <ToParameterViewer /> 
      </motion.div> 

      {/* Charts Row */} 
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"> 
        <motion.div 
          initial={{opacity: 0,y: 20}} 
          animate={{opacity: 1,y: 0}} 
          transition={{duration: 0.5,delay: 0.8}} 
          className="motion-prevent-jump" 
        > 
          <ActivityChart /> 
        </motion.div> 
        <motion.div 
          initial={{opacity: 0,y: 20}} 
          animate={{opacity: 1,y: 0}} 
          transition={{duration: 0.5,delay: 0.9}} 
          className="motion-prevent-jump" 
        > 
          <RawResponseViewer /> 
        </motion.div> 
      </div> 
    </div> 
  );
};

export default Dashboard;