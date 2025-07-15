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

// Helper function to get admin settings
const getAdminSettings = () => {
  try {
    const savedSettings = localStorage.getItem('cryptoIntel_adminSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      return {
        activeMonitorTimeMinutes: settings.activeMonitorTimeMinutes || 60,
        ...settings
      };
    }
  } catch (err) {
    console.error('❌ Error loading admin settings:', err);
  }

  // Default settings
  return {
    activeMonitorTimeMinutes: 60,
    autoVerificationEnabled: true,
    maxQueueSize: 100,
    verificationDelayMs: 1000,
    periodicCheckIntervalSeconds: 30
  };
};

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
  const adminSettingsRef = useRef(getAdminSettings()); // Store admin settings
  
  // Prevent race conditions
  const isInitializingRef = useRef(false);
  const channelRef = useRef(null);
  const deletingRef = useRef(new Set()); // Track items being deleted

  // Listen for admin settings changes
  useEffect(() => {
    const handleSettingsChange = (event) => {
      console.log('📋 Admin settings changed:', event.detail);
      adminSettingsRef.current = { ...adminSettingsRef.current, ...event.detail };
      
      // Immediately check and update active monitors with new settings
      checkAndExpireOldMonitors();
    };

    window.addEventListener('adminSettingsChanged', handleSettingsChange);
    return () => window.removeEventListener('adminSettingsChanged', handleSettingsChange);
  }, []);

  // FIXED: Check if a monitor should still be active based on elapsed time
  const isMonitorStillActive = (startedAt, adminSettings = null) => {
    const settings = adminSettings || adminSettingsRef.current;
    const monitorDurationMs = settings.activeMonitorTimeMinutes * 60 * 1000;
    
    // Parse the started_at timestamp correctly - handle both ISO strings and Date objects
    let startTime;
    if (typeof startedAt === 'string') {
      startTime = new Date(startedAt).getTime();
    } else if (startedAt instanceof Date) {
      startTime = startedAt.getTime();
    } else {
      console.error('❌ Invalid startedAt format:', startedAt);
      return { isActive: false, elapsedTime: 0, remainingTime: 0, maxDuration: monitorDurationMs };
    }
    
    const currentTime = Date.now();
    const elapsedTime = currentTime - startTime;
    
    const isActive = elapsedTime < monitorDurationMs;
    const remainingTime = Math.max(0, monitorDurationMs - elapsedTime);
    
    console.log('⏰ DETAILED Monitor time check:', {
      contractAddress: 'checking...',
      startedAtRaw: startedAt,
      startedAtParsed: new Date(startTime).toISOString(),
      currentTime: new Date(currentTime).toISOString(),
      elapsedTimeMs: elapsedTime,
      elapsedMinutes: Math.floor(elapsedTime / (1000 * 60)),
      elapsedHours: Math.floor(elapsedTime / (1000 * 60 * 60)),
      maxMinutes: settings.activeMonitorTimeMinutes,
      maxDurationMs: monitorDurationMs,
      isActive,
      remainingTimeMs: remainingTime,
      remainingMinutes: Math.floor(remainingTime / (1000 * 60)),
      shouldExpire: !isActive,
      timeDifference: elapsedTime - monitorDurationMs
    });

    return {
      isActive,
      elapsedTime,
      remainingTime,
      maxDuration: monitorDurationMs
    };
  };

  // ENHANCED: Check and expire monitors that have exceeded their time limit
  const checkAndExpireOldMonitors = async () => {
    if (isInitializingRef.current) {
      console.log('⚠️ Already initializing, skipping expiration check');
      return;
    }

    try {
      console.log('🔄 EXPIRATION CHECK: Starting comprehensive monitor expiration check...');
      const settings = adminSettingsRef.current;
      console.log('📋 Current admin settings:', settings);
      
      // Get ALL monitors from database, not just 'monitoring' ones
      const { data: allMonitors, error } = await supabase
        .from(LIQUIDITY_MONITORS_TABLE)
        .select('*')
        .order('started_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching monitors for expiration check:', error);
        return;
      }

      if (!allMonitors || allMonitors.length === 0) {
        console.log('✅ No monitors found in database');
        return;
      }

      console.log('📊 EXPIRATION CHECK: Found monitors in database:', {
        total: allMonitors.length,
        byStatus: allMonitors.reduce((acc, m) => {
          acc[m.status] = (acc[m.status] || 0) + 1;
          return acc;
        }, {}),
        sample: allMonitors.slice(0, 3).map(m => ({
          address: m.contract_address?.slice(0, 10) + '...',
          status: m.status,
          startedAt: m.started_at,
          duration: m.monitor_duration_minutes || 'unknown'
        }))
      });

      // Check each monitor against current time and admin settings
      const expiredMonitors = [];
      const stillActiveMonitors = [];
      const alreadyExpiredMonitors = [];

      allMonitors.forEach(monitor => {
        const timeCheck = isMonitorStillActive(monitor.started_at, settings);
        
        console.log('🔍 EXPIRATION CHECK: Monitor analysis:', {
          contractAddress: monitor.contract_address?.slice(0, 20) + '...',
          currentStatus: monitor.status,
          startedAt: monitor.started_at,
          timeCheck: {
            isActive: timeCheck.isActive,
            elapsedMinutes: Math.floor(timeCheck.elapsedTime / (1000 * 60)),
            remainingMinutes: Math.floor(timeCheck.remainingTime / (1000 * 60)),
            shouldExpire: !timeCheck.isActive
          }
        });
        
        if (monitor.status === 'monitoring' && !timeCheck.isActive) {
          console.log('⏰ FOUND EXPIRED MONITOR:', {
            contractAddress: monitor.contract_address?.slice(0, 20) + '...',
            startedAt: monitor.started_at,
            elapsedMinutes: Math.floor(timeCheck.elapsedTime / (1000 * 60)),
            maxMinutes: settings.activeMonitorTimeMinutes,
            overdue: Math.floor((timeCheck.elapsedTime - timeCheck.maxDuration) / (1000 * 60)) + ' minutes'
          });
          expiredMonitors.push(monitor);
        } else if (monitor.status === 'monitoring' && timeCheck.isActive) {
          console.log('✅ Monitor still active:', {
            contractAddress: monitor.contract_address?.slice(0, 20) + '...',
            remainingMinutes: Math.floor(timeCheck.remainingTime / (1000 * 60))
          });
          stillActiveMonitors.push(monitor);
        } else if (monitor.status !== 'monitoring') {
          console.log('ℹ️ Monitor already in non-monitoring state:', {
            contractAddress: monitor.contract_address?.slice(0, 20) + '...',
            status: monitor.status
          });
          alreadyExpiredMonitors.push(monitor);
        }
      });

      console.log('📊 EXPIRATION CHECK: Summary:', {
        totalMonitors: allMonitors.length,
        needsExpiring: expiredMonitors.length,
        stillActive: stillActiveMonitors.length,
        alreadyExpired: alreadyExpiredMonitors.length
      });

      // Update expired monitors in database
      if (expiredMonitors.length > 0) {
        console.log(`⏰ EXPIRING ${expiredMonitors.length} monitors due to time elapsed`);
        
        // Use a transaction to update all expired monitors at once
        const expiredAddresses = expiredMonitors.map(m => m.contract_address);
        
        const { data: updateResult, error: updateError } = await supabase
          .from(LIQUIDITY_MONITORS_TABLE)
          .update({
            status: 'expired',
            stopped_at: new Date().toISOString(),
            expiry_reason: 'time_elapsed_on_load'
          })
          .in('contract_address', expiredAddresses)
          .select();

        if (updateError) {
          console.error('❌ Error batch updating expired monitors:', updateError);
        } else {
          console.log('✅ Batch updated expired monitors:', {
            updated: updateResult?.length || 0,
            addresses: updateResult?.map(r => r.contract_address?.slice(0, 10) + '...')
          });
        }

        // Stop any active listeners for expired monitors
        expiredMonitors.forEach(monitor => {
          const listenerInfo = activeListenersRef.current.get(monitor.contract_address);
          if (listenerInfo && factoryContractRef.current) {
            console.log('🛑 Removing listener for expired monitor:', monitor.contract_address?.slice(0, 10) + '...');
            factoryContractRef.current.off(listenerInfo.filter, listenerInfo.listener);
            activeListenersRef.current.delete(monitor.contract_address);
          }
        });

        console.log('✅ Completed expiring old monitors');
      } else {
        console.log('✅ No monitors need to be expired');
      }

    } catch (err) {
      console.error('❌ Error in checkAndExpireOldMonitors:', err);
    }
  };

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

  // FIXED: Start monitoring WITHOUT updating existing started_at timestamps
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

      // Get current admin settings
      const settings = adminSettingsRef.current;
      const monitorDurationMs = settings.activeMonitorTimeMinutes * 60 * 1000;
      const startTime = new Date();
      const expiresAt = new Date(Date.now() + monitorDurationMs).toISOString();

      console.log('⏰ Monitor will run for:', {
        duration: settings.activeMonitorTimeMinutes,
        startTime: startTime.toISOString(),
        expiresAt: expiresAt
      });

      // CRITICAL FIX: Check if monitor already exists in database
      const { data: existingMonitor, error: checkError } = await supabase
        .from(LIQUIDITY_MONITORS_TABLE)
        .select('*')
        .eq('contract_address', contractAddress)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('❌ Error checking existing monitor:', checkError);
        throw checkError;
      }

      let monitorData;
      let shouldInsert = true;

      if (existingMonitor) {
        console.log('📋 Found existing monitor:', {
          address: existingMonitor.contract_address?.slice(0, 20) + '...',
          status: existingMonitor.status,
          startedAt: existingMonitor.started_at,
          originalDuration: existingMonitor.monitor_duration_minutes
        });

        // CRITICAL: Don't update started_at if monitor already exists!
        // Only update the status if it's not already monitoring
        if (existingMonitor.status !== 'monitoring') {
          monitorData = {
            ...existingMonitor,
            status: 'monitoring',
            // Keep original started_at and duration!
            started_at: existingMonitor.started_at,
            monitor_duration_minutes: existingMonitor.monitor_duration_minutes,
            // Update expires_at based on original start time
            expires_at: new Date(
              new Date(existingMonitor.started_at).getTime() + 
              (existingMonitor.monitor_duration_minutes * 60 * 1000)
            ).toISOString()
          };
          console.log('🔄 Updating existing monitor status to monitoring (preserving original timestamps)');
        } else {
          console.log('✅ Monitor already active, skipping database update');
          shouldInsert = false;
        }
      } else {
        // Create new monitor record
        monitorData = {
          contract_address: contractAddress,
          transaction_hash: contractData.transaction_hash,
          deployer_address: contractData.deployer_address,
          started_at: startTime.toISOString(), // Only set for NEW monitors
          status: 'monitoring',
          expires_at: expiresAt,
          pair_address: null,
          liquidity_detected: false,
          monitor_type: 'pair_creation',
          monitor_duration_minutes: settings.activeMonitorTimeMinutes
        };
        console.log('📝 Creating new monitor with fresh timestamps');
      }

      // Save to database only if needed
      if (shouldInsert) {
        const { data: savedMonitor, error: saveError } = await supabase
          .from(LIQUIDITY_MONITORS_TABLE)
          .upsert(monitorData, { onConflict: 'contract_address' })
          .select();

        if (saveError) {
          throw saveError;
        }

        console.log('💾 Monitor record saved:', {
          id: savedMonitor[0].id,
          address: savedMonitor[0].contract_address?.slice(0, 20) + '...',
          started_at: savedMonitor[0].started_at,
          status: savedMonitor[0].status,
          duration: savedMonitor[0].monitor_duration_minutes
        });
      }

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
        monitorId: existingMonitor?.id || null,
        expiresAt: monitorData?.expires_at || expiresAt
      });

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

  // FIXED: Delete monitor completely with enhanced deletion protection
  const deleteMonitor = async (contractAddress) => {
    try {
      console.log('🗑️ STARTING ENHANCED DELETE PROCESS for monitor:', contractAddress);

      // Prevent duplicate deletion attempts
      if (deletingRef.current.has(contractAddress)) {
        console.log('⚠️ Delete already in progress for:', contractAddress);
        return;
      }

      deletingRef.current.add(contractAddress);

      // 1. Stop any active listeners first
      await stopLiquidityMonitoring(contractAddress, 'deleted');

      // 2. Temporarily disable real-time subscription to prevent re-adds
      console.log('🔕 Temporarily disabling real-time subscriptions for deletion');
      
      // 3. Delete from database with enhanced verification
      console.log('🗑️ Deleting from database...');
      const { data: deletedData, error: deleteError } = await supabase
        .from(LIQUIDITY_MONITORS_TABLE)
        .delete()
        .eq('contract_address', contractAddress)
        .select();

      if (deleteError) {
        console.error('❌ Database delete failed:', deleteError);
        deletingRef.current.delete(contractAddress);
        throw deleteError;
      }

      console.log('✅ Database delete successful:', {
        deletedCount: deletedData?.length || 0,
        deletedRecord: deletedData?.[0]?.contract_address?.slice(0, 10) + '...'
      });

      // 4. Immediately and aggressively update local state
      console.log('🔄 Aggressively updating local state...');
      setActiveMonitors(prev => {
        const filtered = prev.filter(monitor => 
          monitor.contract_address.toLowerCase() !== contractAddress.toLowerCase()
        );
        console.log('📊 Local state forcibly updated:', {
          before: prev.length,
          after: filtered.length,
          removed: prev.length - filtered.length,
          removedAddress: contractAddress.slice(0, 20) + '...'
        });
        return filtered;
      });

      // 5. Update stats immediately
      setMonitoringStats(prev => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
        active: Math.max(0, prev.active - 1)
      }));

      // 6. Multiple verification checks
      setTimeout(async () => {
        try {
          console.log('🔍 VERIFICATION CHECK 1: Checking if record still exists...');
          const { data: verifyData, error: verifyError } = await supabase
            .from(LIQUIDITY_MONITORS_TABLE)
            .select('id, contract_address')
            .eq('contract_address', contractAddress)
            .single();

          if (verifyError && verifyError.code === 'PGRST116') {
            console.log('✅ DELETE VERIFIED: Record no longer exists in database');
          } else if (verifyData) {
            console.error('❌ DELETE FAILED: Record still exists in database!', verifyData);
            // Force another deletion attempt
            console.log('🔄 Attempting force deletion...');
            await supabase
              .from(LIQUIDITY_MONITORS_TABLE)
              .delete()
              .eq('contract_address', contractAddress);
          }
        } catch (verifyErr) {
          console.log('✅ DELETE VERIFIED: Record not found during verification');
        }

        deletingRef.current.delete(contractAddress);
      }, 500);

      // 7. Second verification check
      setTimeout(async () => {
        console.log('🔍 VERIFICATION CHECK 2: Final verification...');
        try {
          const { data: finalCheck } = await supabase
            .from(LIQUIDITY_MONITORS_TABLE)
            .select('id')
            .eq('contract_address', contractAddress)
            .single();

          if (finalCheck) {
            console.error('❌ CRITICAL: Record still exists after multiple deletion attempts');
            // Force refresh to show current state
            await fetchActiveMonitors(true);
          } else {
            console.log('✅ FINAL VERIFICATION: Deletion successful');
          }
        } catch (err) {
          console.log('✅ FINAL VERIFICATION: Record confirmed deleted');
        }
      }, 2000);

      console.log('✅ Enhanced monitor delete process completed successfully');

    } catch (err) {
      console.error('❌ Error in deleteMonitor:', err);
      deletingRef.current.delete(contractAddress);
      setError(`Delete failed: ${err.message}`);
      throw err;
    }
  };

  // ENHANCED: Fetch active monitors from database with proper expiration checking
  const fetchActiveMonitors = async (silent = false) => {
    try {
      if (!silent) {
        console.log('🔄 Fetching monitors from database...');
      }

      const { data, error } = await supabase
        .from(LIQUIDITY_MONITORS_TABLE)
        .select('*')
        .order('started_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching monitors:', error);
        throw error;
      }

      console.log('📊 Raw monitors from database:', {
        total: data?.length || 0,
        byStatus: data?.reduce((acc, m) => {
          acc[m.status] = (acc[m.status] || 0) + 1;
          return acc;
        }, {}) || {},
        sample: data?.slice(0, 3).map(m => ({
          address: m.contract_address?.slice(0, 10) + '...',
          status: m.status,
          startedAt: m.started_at
        })) || []
      });

      // Filter out any monitors that are currently being deleted
      const filteredData = data?.filter(monitor => 
        !deletingRef.current.has(monitor.contract_address)
      ) || [];

      console.log('📊 After filtering out deleting monitors:', {
        before: data?.length || 0,
        after: filteredData.length,
        currentlyDeleting: Array.from(deletingRef.current).map(addr => addr.slice(0, 10) + '...')
      });

      // Check each monitor against current time and admin settings
      const settings = adminSettingsRef.current;
      
      const processedMonitors = filteredData.map(monitor => {
        const timeCheck = isMonitorStillActive(monitor.started_at, settings);
        
        return {
          ...monitor,
          isExpiredByTime: !timeCheck.isActive,
          remainingTime: timeCheck.remainingTime,
          elapsedTime: timeCheck.elapsedTime
        };
      });

      console.log('📊 Processed monitors with time checks:', {
        total: processedMonitors.length,
        active: processedMonitors.filter(m => m.status === 'monitoring' && !m.isExpiredByTime).length,
        expiredByTime: processedMonitors.filter(m => m.status === 'monitoring' && m.isExpiredByTime).length,
        alreadyExpired: processedMonitors.filter(m => m.status === 'expired').length
      });

      setActiveMonitors(processedMonitors);

      // Calculate stats
      const stats = {
        total: processedMonitors.length || 0,
        active: processedMonitors.filter(m => 
          m.status === 'monitoring' && !m.isExpiredByTime
        ).length || 0,
        pairDetected: processedMonitors.filter(m => 
          m.status === 'pair_detected'
        ).length || 0,
        expired: processedMonitors.filter(m => 
          m.status === 'expired' || (m.status === 'monitoring' && m.isExpiredByTime)
        ).length || 0
      };

      setMonitoringStats(stats);

    } catch (err) {
      console.error('❌ Error in fetchActiveMonitors:', err);
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
        // Check if the existing monitor is still valid based on time
        const timeCheck = isMonitorStillActive(existingMonitor.started_at);
        if (timeCheck.isActive) {
          console.log('⚠️ Already monitoring contract:', verifiedContract.contract_address);
          return;
        } else {
          console.log('⏰ Existing monitor expired, will start new one:', verifiedContract.contract_address);
          // Clean up the expired monitor first
          await stopLiquidityMonitoring(verifiedContract.contract_address, 'expired');
        }
      }

      console.log('🚀 Auto-starting liquidity monitoring for verified contract:', verifiedContract.contract_address);
      await startLiquidityMonitoring(verifiedContract.contract_address, verifiedContract);

    } catch (err) {
      console.error('❌ Error auto-starting monitoring:', err);
    }
  };

  // Setup real-time subscriptions with deletion awareness
  useEffect(() => {
    const setupRealtimeSubscriptions = () => {
      // Clean up existing channel
      if (channelRef.current) {
        console.log('🧹 Cleaning up existing real-time subscription');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      console.log('📡 Setting up real-time subscription for liquidity monitoring...');
      
      // Create a single channel for all monitor changes
      const channel = supabase
        .channel(`liquidity_monitors_${Date.now()}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: LIQUIDITY_MONITORS_TABLE
        }, (payload) => {
          const contractAddress = payload.new?.contract_address || payload.old?.contract_address;
          
          console.log('🔄 Monitor real-time change detected:', {
            event: payload.eventType,
            contractAddress: contractAddress?.slice(0, 10) + '...',
            isCurrentlyDeleting: deletingRef.current.has(contractAddress)
          });
          
          // Ignore events for items we're currently deleting
          if (deletingRef.current.has(contractAddress)) {
            console.log('🚫 Ignoring real-time event for item being deleted');
            return;
          }
          
          // Only refresh if it's not a delete operation from our own deleteMonitor function
          if (payload.eventType !== 'DELETE') {
            fetchActiveMonitors(true); // Silent refresh
          }
        })
        .subscribe((status) => {
          console.log('📡 Liquidity monitoring subscription status:', status);
        });

      channelRef.current = channel;

      // Set up events subscription
      const eventsChannel = supabase
        .channel(`liquidity_events_${Date.now()}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: LIQUIDITY_EVENTS_TABLE
        }, (payload) => {
          console.log('💧 Liquidity event change detected:', payload.eventType);
          fetchLiquidityEvents();
        })
        .subscribe();

      return () => {
        console.log('🔌 Cleaning up real-time subscriptions');
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
        supabase.removeChannel(eventsChannel);
      };
    };

    const cleanup = setupRealtimeSubscriptions();
    return cleanup;
  }, []);

  // Periodic check for expired monitors - run every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('⏰ Periodic check for expired monitors...');
      checkAndExpireOldMonitors();
    }, 60000); // Check every 60 seconds

    return () => clearInterval(interval);
  }, []);

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      if (isInitializingRef.current) {
        console.log('⚠️ Already initializing, skipping...');
        return;
      }

      isInitializingRef.current = true;
      setLoading(true);

      try {
        console.log('🚀 INITIALIZING Liquidity Monitoring System...');
        
        // Load current admin settings
        adminSettingsRef.current = getAdminSettings();
        console.log('📋 Loaded admin settings:', adminSettingsRef.current);

        await initializeProvider();
        
        // CRITICAL: First expire old monitors, then fetch the updated list
        console.log('⏰ Step 1: Expiring old monitors...');
        await checkAndExpireOldMonitors();
        
        console.log('📊 Step 2: Fetching updated monitor list...');
        await fetchActiveMonitors();
        
        console.log('💧 Step 3: Fetching liquidity events...');
        await fetchLiquidityEvents();

        console.log('✅ Liquidity monitoring system initialized successfully');

      } catch (err) {
        console.error('❌ Error initializing liquidity monitoring:', err);
        setError(err.message);
      } finally {
        setLoading(false);
        isInitializingRef.current = false;
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

      // Clean up real-time subscription
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

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
    fetchLiquidityEvents,
    isMonitorStillActive, // Export for external use
    getAdminSettings: () => adminSettingsRef.current // Export current settings
  };
};