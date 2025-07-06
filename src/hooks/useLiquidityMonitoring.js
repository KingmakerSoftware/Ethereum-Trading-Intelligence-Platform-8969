import { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import supabase from '../lib/supabase';

const LIQUIDITY_MONITORS_TABLE = 'liquidity_monitors_9x3k7b';
const LIQUIDITY_EVENTS_TABLE = 'liquidity_events_5m8n2p';

// Alchemy WebSocket configuration
const ALCHEMY_API_KEY = 'hO0xJVa4nKccDfXUarfTR';
const ALCHEMY_WEBSOCKET_URL = `wss://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

// Uniswap V2 Factory contract configuration
const UNISWAP_V2_FACTORY_ADDRESS = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const FACTORY_ABI = [
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint)",
];

// Uniswap V2 Pair ABI for Mint events
const PAIR_ABI = [
  "event Mint(address indexed sender, uint amount0, uint amount1)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
];

export const useLiquidityMonitoring = () => {
  const [activeMonitors, setActiveMonitors] = useState([]);
  const [liquidityEvents, setLiquidityEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [monitoringStats, setMonitoringStats] = useState({
    total: 0,
    active: 0,
    pairDetected: 0,
    expired: 0
  });

  // WebSocket provider and contracts
  const providerRef = useRef(null);
  const factoryContractRef = useRef(null);
  const activeListenersRef = useRef(new Map()); // contractAddress -> listener info
  const pairListenersRef = useRef(new Map()); // pairAddress -> listener info

  // Initialize WebSocket provider
  const initializeProvider = async () => {
    try {
      if (providerRef.current) {
        console.log('🔌 Closing existing WebSocket provider...');
        await providerRef.current.destroy();
      }

      console.log('🚀 Initializing Alchemy WebSocket provider for liquidity monitoring...');
      providerRef.current = new ethers.WebSocketProvider(ALCHEMY_WEBSOCKET_URL);
      
      // Create factory contract instance
      factoryContractRef.current = new ethers.Contract(
        UNISWAP_V2_FACTORY_ADDRESS,
        FACTORY_ABI,
        providerRef.current
      );

      console.log('✅ Liquidity monitoring provider initialized');
      return true;
    } catch (err) {
      console.error('❌ Error initializing provider:', err);
      setError(err.message);
      return false;
    }
  };

  // Start monitoring a verified contract for PairCreated events
  const startLiquidityMonitoring = async (contractAddress, contractData) => {
    try {
      console.log('🔄 Starting liquidity monitoring for:', contractAddress);

      // Check if already monitoring
      if (activeListenersRef.current.has(contractAddress)) {
        console.log('⚠️ Already monitoring contract:', contractAddress);
        return;
      }

      // Ensure provider is ready
      if (!providerRef.current || !factoryContractRef.current) {
        const initialized = await initializeProvider();
        if (!initialized) {
          throw new Error('Failed to initialize provider');
        }
      }

      // Create monitor record in database
      const monitorData = {
        contract_address: contractAddress,
        transaction_hash: contractData.transaction_hash,
        deployer_address: contractData.deployer_address,
        started_at: new Date().toISOString(),
        status: 'monitoring',
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
        pair_address: null,
        liquidity_detected: false,
        monitor_type: 'pair_creation'
      };

      const { data: savedMonitor, error: saveError } = await supabase
        .from(LIQUIDITY_MONITORS_TABLE)
        .upsert(monitorData, { onConflict: 'contract_address' })
        .select();

      if (saveError) {
        throw saveError;
      }

      console.log('💾 Monitor record saved:', savedMonitor[0]);

      // Set up PairCreated event listener with contract filter
      const pairCreatedFilter = factoryContractRef.current.filters.PairCreated();
      
      const listener = async (...args) => {
        const event = args[args.length - 1]; // Last argument is the event object
        const [token0, token1, pairAddress] = args.slice(0, 3);

        console.log('🎯 PairCreated event detected:', {
          token0,
          token1,
          pairAddress,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash
        });

        // Check if this pair involves our monitored contract
        if (token0.toLowerCase() === contractAddress.toLowerCase() || 
            token1.toLowerCase() === contractAddress.toLowerCase()) {
          
          console.log('🎉 Liquidity pair found for monitored contract!', {
            contractAddress,
            pairAddress,
            token0,
            token1
          });

          await handlePairCreated(contractAddress, pairAddress, token0, token1, event);
        }
      };

      // Start listening
      factoryContractRef.current.on(pairCreatedFilter, listener);

      // Store listener info
      activeListenersRef.current.set(contractAddress, {
        listener,
        filter: pairCreatedFilter,
        startTime: Date.now(),
        contractData,
        monitorId: savedMonitor[0].id
      });

      // Set timeout to stop monitoring after 1 hour
      setTimeout(() => {
        stopLiquidityMonitoring(contractAddress, 'expired');
      }, 60 * 60 * 1000); // 1 hour

      console.log('✅ Started monitoring contract for liquidity:', contractAddress);
      await fetchActiveMonitors();

    } catch (err) {
      console.error('❌ Error starting liquidity monitoring:', err);
      setError(err.message);
    }
  };

  // Handle PairCreated event detection
  const handlePairCreated = async (contractAddress, pairAddress, token0, token1, event) => {
    try {
      console.log('🔄 Processing PairCreated event...');

      // Update monitor record
      await supabase
        .from(LIQUIDITY_MONITORS_TABLE)
        .update({
          status: 'pair_detected',
          pair_address: pairAddress,
          liquidity_detected: true,
          pair_detected_at: new Date().toISOString(),
          monitor_type: 'mint_events'
        })
        .eq('contract_address', contractAddress);

      // Record the liquidity event
      const eventData = {
        contract_address: contractAddress,
        pair_address: pairAddress,
        token0_address: token0,
        token1_address: token1,
        event_type: 'PairCreated',
        transaction_hash: event.transactionHash,
        block_number: event.blockNumber,
        detected_at: new Date().toISOString(),
        event_data: {
          token0,
          token1,
          pairAddress,
          blockNumber: event.blockNumber
        }
      };

      await supabase
        .from(LIQUIDITY_EVENTS_TABLE)
        .insert(eventData);

      console.log('💾 PairCreated event saved to database');

      // Stop monitoring for PairCreated and start monitoring for Mint events
      stopLiquidityMonitoring(contractAddress, 'pair_detected');
      await startMintEventMonitoring(contractAddress, pairAddress);

      // Refresh data
      await fetchActiveMonitors();
      await fetchLiquidityEvents();

    } catch (err) {
      console.error('❌ Error handling PairCreated event:', err);
    }
  };

  // Start monitoring Mint events on the detected pair
  const startMintEventMonitoring = async (contractAddress, pairAddress) => {
    try {
      console.log('🔄 Starting Mint event monitoring for pair:', pairAddress);

      // Create pair contract instance
      const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, providerRef.current);

      // Set up Mint event listener
      const mintFilter = pairContract.filters.Mint();
      
      const mintListener = async (...args) => {
        const event = args[args.length - 1];
        const [sender, amount0, amount1] = args.slice(0, 3);

        console.log('💧 Mint event detected on pair!', {
          pairAddress,
          sender,
          amount0: amount0.toString(),
          amount1: amount1.toString(),
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash
        });

        await handleMintEvent(contractAddress, pairAddress, sender, amount0, amount1, event);
      };

      pairContract.on(mintFilter, mintListener);

      // Store pair listener info
      pairListenersRef.current.set(pairAddress, {
        contractAddress,
        listener: mintListener,
        filter: mintFilter,
        contract: pairContract,
        startTime: Date.now()
      });

      console.log('✅ Started monitoring Mint events for pair:', pairAddress);

    } catch (err) {
      console.error('❌ Error starting Mint event monitoring:', err);
    }
  };

  // Handle Mint event detection
  const handleMintEvent = async (contractAddress, pairAddress, sender, amount0, amount1, event) => {
    try {
      console.log('🔄 Processing Mint event...');

      // Record the mint event
      const eventData = {
        contract_address: contractAddress,
        pair_address: pairAddress,
        event_type: 'Mint',
        sender_address: sender,
        amount0: amount0.toString(),
        amount1: amount1.toString(),
        transaction_hash: event.transactionHash,
        block_number: event.blockNumber,
        detected_at: new Date().toISOString(),
        event_data: {
          sender,
          amount0: amount0.toString(),
          amount1: amount1.toString(),
          blockNumber: event.blockNumber
        }
      };

      await supabase
        .from(LIQUIDITY_EVENTS_TABLE)
        .insert(eventData);

      console.log('💾 Mint event saved to database');

      // Update monitor status
      await supabase
        .from(LIQUIDITY_MONITORS_TABLE)
        .update({
          last_mint_at: new Date().toISOString(),
          total_mint_events: supabase.raw('total_mint_events + 1')
        })
        .eq('contract_address', contractAddress);

      await fetchLiquidityEvents();

    } catch (err) {
      console.error('❌ Error handling Mint event:', err);
    }
  };

  // Stop monitoring a specific contract
  const stopLiquidityMonitoring = async (contractAddress, reason = 'manual') => {
    try {
      console.log('🛑 Stopping liquidity monitoring for:', contractAddress, 'Reason:', reason);

      // Remove PairCreated listener
      const listenerInfo = activeListenersRef.current.get(contractAddress);
      if (listenerInfo && factoryContractRef.current) {
        factoryContractRef.current.off(listenerInfo.filter, listenerInfo.listener);
        activeListenersRef.current.delete(contractAddress);
      }

      // Update database record
      await supabase
        .from(LIQUIDITY_MONITORS_TABLE)
        .update({
          status: reason,
          stopped_at: new Date().toISOString()
        })
        .eq('contract_address', contractAddress);

      console.log('✅ Stopped monitoring:', contractAddress);
      await fetchActiveMonitors();

    } catch (err) {
      console.error('❌ Error stopping monitoring:', err);
    }
  };

  // Stop monitoring a Mint event listener
  const stopMintEventMonitoring = async (pairAddress) => {
    try {
      console.log('🛑 Stopping Mint event monitoring for pair:', pairAddress);

      const pairInfo = pairListenersRef.current.get(pairAddress);
      if (pairInfo) {
        pairInfo.contract.off(pairInfo.filter, pairInfo.listener);
        pairListenersRef.current.delete(pairAddress);
      }

      console.log('✅ Stopped Mint monitoring for pair:', pairAddress);

    } catch (err) {
      console.error('❌ Error stopping Mint monitoring:', err);
    }
  };

  // Delete monitor completely
  const deleteMonitor = async (contractAddress) => {
    try {
      await stopLiquidityMonitoring(contractAddress, 'deleted');
      
      await supabase
        .from(LIQUIDITY_MONITORS_TABLE)
        .delete()
        .eq('contract_address', contractAddress);

      console.log('🗑️ Monitor deleted:', contractAddress);
      await fetchActiveMonitors();

    } catch (err) {
      console.error('❌ Error deleting monitor:', err);
    }
  };

  // Fetch active monitors from database
  const fetchActiveMonitors = async () => {
    try {
      const { data, error } = await supabase
        .from(LIQUIDITY_MONITORS_TABLE)
        .select('*')
        .order('started_at', { ascending: false });

      if (error) throw error;

      setActiveMonitors(data || []);
      
      // Calculate stats
      const stats = {
        total: data?.length || 0,
        active: data?.filter(m => m.status === 'monitoring').length || 0,
        pairDetected: data?.filter(m => m.status === 'pair_detected').length || 0,
        expired: data?.filter(m => m.status === 'expired').length || 0
      };
      setMonitoringStats(stats);

    } catch (err) {
      console.error('❌ Error fetching monitors:', err);
      setError(err.message);
    }
  };

  // Fetch liquidity events from database
  const fetchLiquidityEvents = async () => {
    try {
      const { data, error } = await supabase
        .from(LIQUIDITY_EVENTS_TABLE)
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setLiquidityEvents(data || []);

    } catch (err) {
      console.error('❌ Error fetching liquidity events:', err);
    }
  };

  // Auto-start monitoring for newly verified contracts
  const autoStartMonitoring = async (verifiedContract) => {
    try {
      // Check if we're already monitoring this contract
      const existingMonitor = activeMonitors.find(m => 
        m.contract_address.toLowerCase() === verifiedContract.contract_address.toLowerCase()
      );

      if (existingMonitor) {
        console.log('⚠️ Already monitoring contract:', verifiedContract.contract_address);
        return;
      }

      console.log('🚀 Auto-starting liquidity monitoring for verified contract:', verifiedContract.contract_address);
      await startLiquidityMonitoring(verifiedContract.contract_address, verifiedContract);

    } catch (err) {
      console.error('❌ Error auto-starting monitoring:', err);
    }
  };

  // Setup real-time subscriptions
  useEffect(() => {
    const setupRealtimeSubscriptions = () => {
      // Subscribe to monitor changes
      const monitorChannel = supabase
        .channel('liquidity_monitors_changes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: LIQUIDITY_MONITORS_TABLE 
        }, (payload) => {
          console.log('🔄 Monitor change detected:', payload);
          fetchActiveMonitors();
        })
        .subscribe();

      // Subscribe to liquidity events
      const eventsChannel = supabase
        .channel('liquidity_events_changes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: LIQUIDITY_EVENTS_TABLE 
        }, (payload) => {
          console.log('💧 Liquidity event change detected:', payload);
          fetchLiquidityEvents();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(monitorChannel);
        supabase.removeChannel(eventsChannel);
      };
    };

    const cleanup = setupRealtimeSubscriptions();
    return cleanup;
  }, []);

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      try {
        await initializeProvider();
        await fetchActiveMonitors();
        await fetchLiquidityEvents();
      } catch (err) {
        console.error('❌ Error initializing liquidity monitoring:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    initialize();

    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up liquidity monitoring...');
      
      // Stop all active listeners
      activeListenersRef.current.forEach((listenerInfo, contractAddress) => {
        if (factoryContractRef.current) {
          factoryContractRef.current.off(listenerInfo.filter, listenerInfo.listener);
        }
      });
      activeListenersRef.current.clear();

      // Stop all pair listeners
      pairListenersRef.current.forEach((pairInfo, pairAddress) => {
        if (pairInfo.contract) {
          pairInfo.contract.off(pairInfo.filter, pairInfo.listener);
        }
      });
      pairListenersRef.current.clear();

      // Destroy provider
      if (providerRef.current) {
        providerRef.current.destroy();
      }
    };
  }, []);

  return {
    activeMonitors,
    liquidityEvents,
    loading,
    error,
    monitoringStats,
    startLiquidityMonitoring,
    stopLiquidityMonitoring,
    deleteMonitor,
    autoStartMonitoring,
    fetchActiveMonitors,
    fetchLiquidityEvents
  };
};