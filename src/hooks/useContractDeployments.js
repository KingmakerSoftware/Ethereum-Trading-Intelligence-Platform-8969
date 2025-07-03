import { useState, useEffect, useRef } from 'react';
import supabase from '../lib/supabase';

const TABLE_NAME = 'contract_deployments_monitor_7x9k2a';

export const useContractDeployments = () => {
  const [contractDeployments, setContractDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [realtimeStatus, setRealtimeStatus] = useState('disconnected');
  const subscriptionRef = useRef(null);
  const channelRef = useRef(null);

  // Generate Etherscan URL for transaction
  const generateEtherscanUrl = (txHash) => {
    return `https://etherscan.io/tx/${txHash}`;
  };

  // Initialize table and enable real-time
  const initializeTable = async () => {
    try {
      console.log('🔧 Initializing table and enabling real-time...');
      
      // Test basic table access first
      const { data: testData, error: testError } = await supabase
        .from(TABLE_NAME)
        .select('id')
        .limit(1);
      
      if (testError) {
        console.error('❌ Table access error:', testError);
        setError(`Table access failed: ${testError.message}`);
        return;
      }
      
      console.log('✅ Table is accessible');
      
      // Enable real-time on the table (this might need to be done in Supabase dashboard)
      console.log('📡 Real-time should be enabled on the table in Supabase dashboard');
      
    } catch (error) {
      console.error('❌ Error initializing table:', error);
      setError(`Table initialization failed: ${error.message}`);
    }
  };

  // Fetch contract deployments from Supabase
  const fetchContractDeployments = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      
      console.log('🔄 Fetching contract deployments from Supabase...');
      
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('❌ Error fetching contract deployments:', error);
        setError(error.message);
        return;
      }

      console.log('✅ Fetched contract deployments from Supabase:', {
        count: data?.length || 0,
        timestamp: new Date().toISOString(),
        sample: data?.slice(0, 3).map(d => ({
          hash: d.transaction_hash?.slice(0, 10) + '...',
          detected: d.detected_at,
          from: d.from_address?.slice(0, 10) + '...'
        }))
      });
      
      setContractDeployments(data || []);
      setError(null);
      setLastFetch(new Date());
    } catch (err) {
      console.error('❌ Error in fetchContractDeployments:', err);
      setError(err.message);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // Save contract deployment to Supabase
  const saveContractDeployment = async (deploymentData) => {
    try {
      const etherscanUrl = generateEtherscanUrl(deploymentData.transaction_hash);
      
      const dataToSave = {
        transaction_hash: deploymentData.transaction_hash,
        from_address: deploymentData.from_address,
        to_address: deploymentData.to_address || null,
        input_data: deploymentData.input_data,
        input_size: deploymentData.input_size,
        gas_price: deploymentData.gas_price,
        gas_limit: deploymentData.gas_limit,
        value: deploymentData.value,
        nonce: deploymentData.nonce,
        block_number: deploymentData.block_number,
        detected_at: deploymentData.detected_at || new Date().toISOString(),
        status: deploymentData.status || 'pending',
        contract_address: deploymentData.contract_address,
        etherscan_url: etherscanUrl
      };

      console.log('💾 Saving contract deployment to Supabase:', {
        txHash: dataToSave.transaction_hash?.slice(0, 10) + '...',
        fromAddress: dataToSave.from_address?.slice(0, 10) + '...',
        etherscanUrl: etherscanUrl,
        detected_at: dataToSave.detected_at
      });

      const { data, error } = await supabase
        .from(TABLE_NAME)
        .upsert(dataToSave, { 
          onConflict: 'transaction_hash',
          ignoreDuplicates: false 
        })
        .select();

      if (error) {
        console.error('❌ Error saving contract deployment:', error);
        throw error;
      }

      console.log('✅ Contract deployment saved successfully:', data);
      
      return data;
    } catch (err) {
      console.error('❌ Error in saveContractDeployment:', err);
      setError(err.message);
      throw err;
    }
  };

  // Update contract deployment status
  const updateContractDeployment = async (txHash, updates) => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('transaction_hash', txHash)
        .select();

      if (error) {
        console.error('❌ Error updating contract deployment:', error);
        throw error;
      }

      console.log('✅ Contract deployment updated:', data);
      
      return data;
    } catch (err) {
      console.error('❌ Error in updateContractDeployment:', err);
      setError(err.message);
      throw err;
    }
  };

  // Delete contract deployment
  const deleteContractDeployment = async (txHash) => {
    try {
      const { error } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq('transaction_hash', txHash);

      if (error) {
        console.error('❌ Error deleting contract deployment:', error);
        throw error;
      }

      console.log('✅ Contract deployment deleted:', txHash);
      
    } catch (err) {
      console.error('❌ Error in deleteContractDeployment:', err);
      setError(err.message);
      throw err;
    }
  };

  // Clear all contract deployments
  const clearAllContractDeployments = async () => {
    try {
      console.log('🗑️ Clearing all contract deployments...');
      
      const { error } = await supabase
        .from(TABLE_NAME)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

      if (error) {
        console.error('❌ Error clearing contract deployments:', error);
        throw error;
      }

      console.log('✅ All contract deployments cleared');
      
      // Immediately update the local state
      setContractDeployments([]);
      
    } catch (err) {
      console.error('❌ Error in clearAllContractDeployments:', err);
      setError(err.message);
      throw err;
    }
  };

  // Get statistics
  const getStatistics = () => {
    const total = contractDeployments.length;
    const today = new Date().toDateString();
    const todayCount = contractDeployments.filter(deployment => 
      new Date(deployment.detected_at).toDateString() === today
    ).length;
    
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last24HoursCount = contractDeployments.filter(deployment => 
      new Date(deployment.detected_at) > last24Hours
    ).length;

    return {
      total,
      today: todayCount,
      last24Hours: last24HoursCount
    };
  };

  // Set up real-time subscription with enhanced debugging
  const setupRealtimeSubscription = () => {
    console.log('🔄 Setting up real-time subscription...');
    
    // Clean up existing subscription
    if (channelRef.current) {
      console.log('🧹 Cleaning up existing real-time subscription');
      try {
        channelRef.current.unsubscribe();
      } catch (e) {
        console.log('⚠️ Error unsubscribing from channel:', e);
      }
      channelRef.current = null;
    }

    // Create unique channel name with timestamp
    const channelName = `contract_deployments_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    console.log('📡 Creating unique channel:', channelName);

    try {
      // Create new channel with specific table subscription
      const channel = supabase.channel(channelName);
      
      // Subscribe to postgres changes with specific table
      channel
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: TABLE_NAME
        }, (payload) => {
          console.log('🎯 [REALTIME-EVENT] Real-time event received:', {
            event: payload.eventType,
            table: payload.table,
            timestamp: new Date().toISOString(),
            hasNewData: !!payload.new,
            hasOldData: !!payload.old,
            newTxHash: payload.new?.transaction_hash?.slice(0, 20) + '...' || 'N/A'
          });

          // Handle different event types
          switch (payload.eventType) {
            case 'INSERT':
              console.log('➕ [REALTIME-INSERT] New contract deployment detected via real-time');
              console.log('📝 [REALTIME-INSERT] New record data:', {
                id: payload.new.id,
                txHash: payload.new.transaction_hash?.slice(0, 20) + '...',
                status: payload.new.status,
                detected_at: payload.new.detected_at
              });
              
              setContractDeployments(prev => {
                // Check if this record already exists by transaction_hash
                const exists = prev.some(item => 
                  item.transaction_hash === payload.new.transaction_hash
                );
                if (exists) {
                  console.log('⚠️ [REALTIME-INSERT] Record already exists, skipping duplicate');
                  return prev;
                }
                console.log('✅ [REALTIME-INSERT] Adding new record to state');
                const newState = [payload.new, ...prev];
                console.log('📊 [REALTIME-INSERT] New state count:', newState.length);
                return newState;
              });
              break;
            
            case 'UPDATE':
              console.log('🔄 [REALTIME-UPDATE] Contract deployment updated via real-time');
              console.log('📝 [REALTIME-UPDATE] Updated record data:', payload.new);
              
              setContractDeployments(prev => 
                prev.map(item => 
                  item.id === payload.new.id ? payload.new : item
                )
              );
              break;
            
            case 'DELETE':
              console.log('🗑️ [REALTIME-DELETE] Contract deployment deleted via real-time');
              console.log('📝 [REALTIME-DELETE] Deleted record data:', payload.old);
              
              setContractDeployments(prev => 
                prev.filter(item => item.id !== payload.old.id)
              );
              break;
            
            default:
              console.log('❓ [REALTIME-UNKNOWN] Unknown real-time event:', payload.eventType);
              // For unknown events, just refresh the data
              setTimeout(() => fetchContractDeployments(true), 1000);
          }
        })
        .subscribe((status) => {
          console.log('📡 [REALTIME-STATUS] Real-time subscription status changed:', status);
          setRealtimeStatus(status);
          
          if (status === 'SUBSCRIBED') {
            console.log('✅ [REALTIME-STATUS] Real-time subscription is now active!');
            console.log('🎉 [REALTIME-STATUS] Listening for changes on table:', TABLE_NAME);
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ [REALTIME-STATUS] Real-time subscription error');
            setRealtimeStatus('error');
            
            // Retry after delay
            setTimeout(() => {
              console.log('🔄 [REALTIME-STATUS] Retrying real-time subscription after error...');
              setupRealtimeSubscription();
            }, 5000);
          } else if (status === 'TIMED_OUT') {
            console.error('⏰ [REALTIME-STATUS] Real-time subscription timed out');
            setRealtimeStatus('timeout');
            
            // Retry after delay
            setTimeout(() => {
              console.log('🔄 [REALTIME-STATUS] Retrying real-time subscription after timeout...');
              setupRealtimeSubscription();
            }, 3000);
          } else if (status === 'CLOSED') {
            console.log('🔌 [REALTIME-STATUS] Real-time subscription closed');
            setRealtimeStatus('closed');
          }
        });

      channelRef.current = channel;
      
    } catch (error) {
      console.error('❌ [REALTIME-ERROR] Error setting up real-time subscription:', error);
      setRealtimeStatus('error');
    }
  };

  // Load data on mount
  useEffect(() => {
    console.log('🚀 useContractDeployments hook initialized');
    
    // Initialize table first, then fetch data
    initializeTable().then(() => {
      fetchContractDeployments();
    });
  }, []);

  // Set up real-time subscription after initial load
  useEffect(() => {
    if (!loading) {
      console.log('🔄 Setting up real-time subscription after initial load');
      // Small delay to ensure everything is ready
      setTimeout(() => {
        setupRealtimeSubscription();
      }, 2000);
    }

    // Cleanup on unmount
    return () => {
      console.log('🔌 Cleaning up real-time subscription');
      if (channelRef.current) {
        try {
          channelRef.current.unsubscribe();
        } catch (e) {
          console.log('⚠️ Error during cleanup:', e);
        }
        channelRef.current = null;
      }
    };
  }, [loading]);

  // Add a manual refresh function for debugging
  const forceRefresh = () => {
    console.log('🔄 Force refreshing contract deployments...');
    fetchContractDeployments();
  };

  // Enhanced test real-time connection with better error handling
  const testRealtimeConnection = async () => {
    console.log('🧪 [REALTIME-TEST] Testing real-time connection...');
    
    try {
      // Generate a unique test record
      const testRecord = {
        transaction_hash: `0xTEST_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        from_address: '0x1234567890123456789012345678901234567890',
        to_address: null,
        input_data: '0x608060405234801561001057600080fd5b50',
        input_size: '21 bytes',
        gas_price: '0x5d21dba00',
        gas_limit: '0x5208',
        value: '0x0',
        nonce: '0x1',
        detected_at: new Date().toISOString(),
        status: 'test',
        etherscan_url: 'https://etherscan.io/tx/0xtest'
      };

      console.log('📝 [REALTIME-TEST] Inserting test record:', testRecord.transaction_hash);
      console.log('📊 [REALTIME-TEST] Current real-time status:', realtimeStatus);
      console.log('📊 [REALTIME-TEST] Current deployments count:', contractDeployments.length);
      
      // First, try to insert the record
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert(testRecord)
        .select();

      if (error) {
        console.error('❌ [REALTIME-TEST] Error inserting test record:', error);
        throw error;
      }

      console.log('✅ [REALTIME-TEST] Test record inserted successfully:', data);
      
      // Clean up test record after 15 seconds
      setTimeout(async () => {
        try {
          console.log('🧹 [REALTIME-TEST] Cleaning up test record...');
          await supabase
            .from(TABLE_NAME)
            .delete()
            .eq('transaction_hash', testRecord.transaction_hash);
          console.log('✅ [REALTIME-TEST] Test record cleaned up');
        } catch (cleanupError) {
          console.error('❌ [REALTIME-TEST] Error cleaning up test record:', cleanupError);
        }
      }, 15000);

      return testRecord;

    } catch (error) {
      console.error('❌ [REALTIME-TEST] Real-time test failed:', error);
      setError(`Real-time test failed: ${error.message}`);
      throw error;
    }
  };

  return {
    contractDeployments,
    loading,
    error,
    lastFetch,
    realtimeStatus,
    saveContractDeployment,
    updateContractDeployment,
    deleteContractDeployment,
    clearAllContractDeployments,
    fetchContractDeployments,
    forceRefresh,
    getStatistics,
    generateEtherscanUrl,
    testRealtimeConnection
  };
};