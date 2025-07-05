import { useState, useEffect, useRef } from 'react';
import supabase from '../lib/supabase';

const TABLE_NAME = 'contract_deployments_monitor_7x9k2a';

export const useContractDeployments = () => {
  const [contractDeployments, setContractDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [realtimeStatus, setRealtimeStatus] = useState('disconnected');
  const subscriptionRef = useRef(null);
  const channelRef = useRef(null);

  // Generate Etherscan URL for transaction
  const generateEtherscanUrl = (txHash) => {
    return `https://etherscan.io/tx/${txHash}`;
  };

  // Test real-time connection by inserting a test record
  const testRealtimeConnection = async () => {
    const testRecord = {
      transaction_hash: `0xTEST_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      from_address: '0x' + Math.random().toString(36).substring(2, 8).repeat(5),
      to_address: null,
      input_data: '0x608060405234801561001057600080fd5b50' + Math.random().toString(36).substring(2, 20),
      input_size: '50 bytes',
      gas_price: '0x' + Math.floor(Math.random() * 1000000).toString(16),
      gas_limit: '0x' + Math.floor(Math.random() * 500000).toString(16),
      value: '0x0',
      nonce: '0x' + Math.floor(Math.random() * 100).toString(16),
      detected_at: new Date().toISOString(),
      status: 'test_realtime',
      verification_status: 'pending',
      etherscan_url: `https://etherscan.io/tx/0xtest${Date.now()}`
    };

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(testRecord)
      .select();

    if (error) {
      throw error;
    }

    return testRecord;
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
          from: d.from_address?.slice(0, 10) + '...',
          verificationStatus: d.verification_status || 'pending'
        }))
      });

      setContractDeployments(data || []);
      setError(null);
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
        verification_status: 'pending', // Add verification status
        etherscan_url: etherscanUrl
      };

      console.log('💾 Saving contract deployment to Supabase:', {
        txHash: dataToSave.transaction_hash?.slice(0, 10) + '...',
        fromAddress: dataToSave.from_address?.slice(0, 10) + '...',
        etherscanUrl: etherscanUrl,
        detected_at: dataToSave.detected_at,
        verification_status: dataToSave.verification_status
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

  // Delete contract deployment - ENHANCED VERSION
  const deleteContractDeployment = async (txHash) => {
    try {
      console.log('🗑️ Starting deletion process for:', txHash);
      
      // First, verify the record exists
      const { data: existingRecord, error: findError } = await supabase
        .from(TABLE_NAME)
        .select('id, transaction_hash')
        .eq('transaction_hash', txHash)
        .single();

      if (findError) {
        console.error('❌ Error finding record to delete:', findError);
        if (findError.code === 'PGRST116') {
          console.log('⚠️ Record not found in database, removing from UI only');
          setContractDeployments(prev => 
            prev.filter(deployment => deployment.transaction_hash !== txHash)
          );
          return;
        }
        throw findError;
      }

      console.log('✅ Found record to delete:', {
        id: existingRecord.id,
        txHash: existingRecord.transaction_hash?.slice(0, 20) + '...'
      });

      // Now delete the record
      const { data: deletedData, error: deleteError } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq('transaction_hash', txHash)
        .select();

      if (deleteError) {
        console.error('❌ Error deleting contract deployment:', deleteError);
        console.error('Delete error details:', {
          code: deleteError.code,
          message: deleteError.message,
          details: deleteError.details,
          hint: deleteError.hint
        });
        throw deleteError;
      }

      console.log('✅ Contract deployment deleted from database:', {
        txHash: txHash?.slice(0, 20) + '...',
        deletedRecords: deletedData?.length || 0,
        deletedData: deletedData
      });
      
      // Update local state to immediately remove the item
      setContractDeployments(prev => {
        const newDeployments = prev.filter(deployment => deployment.transaction_hash !== txHash);
        console.log('🔄 Updated local state:', {
          before: prev.length,
          after: newDeployments.length,
          removed: prev.length - newDeployments.length
        });
        return newDeployments;
      });

      // Verify deletion worked by checking if record still exists
      setTimeout(async () => {
        try {
          const { data: verifyData, error: verifyError } = await supabase
            .from(TABLE_NAME)
            .select('id')
            .eq('transaction_hash', txHash)
            .single();

          if (verifyError && verifyError.code === 'PGRST116') {
            console.log('✅ Deletion verified: Record no longer exists in database');
          } else if (verifyData) {
            console.error('❌ Deletion failed: Record still exists in database');
            // Refresh the data to show the record is still there
            await fetchContractDeployments(true);
          }
        } catch (verifyErr) {
          console.log('✅ Deletion verification completed (record not found)');
        }
      }, 1000);

    } catch (err) {
      console.error('❌ Error in deleteContractDeployment:', err);
      setError(`Delete failed: ${err.message}`);
      throw err;
    }
  };

  // Clear all contract deployments
  const clearAllContractDeployments = async () => {
    try {
      console.log('🧹 Clearing all contract deployments...');
      
      const { error } = await supabase
        .from(TABLE_NAME)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

      if (error) {
        console.error('❌ Error clearing all contract deployments:', error);
        throw error;
      }

      console.log('✅ All contract deployments cleared');
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

  // Set up real-time subscription
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
            newTxHash: payload.new?.transaction_hash?.slice(0, 20) + '...' || 'N/A',
            oldTxHash: payload.old?.transaction_hash?.slice(0, 20) + '...' || 'N/A'
          });

          // Handle different event types
          switch (payload.eventType) {
            case 'INSERT':
              console.log('➕ [REALTIME-INSERT] New contract deployment detected via real-time');
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
                return [payload.new, ...prev];
              });
              break;

            case 'UPDATE':
              console.log('🔄 [REALTIME-UPDATE] Contract deployment updated via real-time');
              setContractDeployments(prev => 
                prev.map(item => 
                  item.id === payload.new.id ? payload.new : item
                )
              );
              break;

            case 'DELETE':
              console.log('🗑️ [REALTIME-DELETE] Contract deployment deleted via real-time');
              console.log('🗑️ [REALTIME-DELETE] Removing from state:', {
                oldId: payload.old?.id,
                oldTxHash: payload.old?.transaction_hash?.slice(0, 20) + '...'
              });
              setContractDeployments(prev => {
                const newState = prev.filter(item => item.id !== payload.old.id);
                console.log('🗑️ [REALTIME-DELETE] State updated:', {
                  before: prev.length,
                  after: newState.length,
                  removed: prev.length - newState.length
                });
                return newState;
              });
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

  return {
    contractDeployments,
    loading,
    error,
    realtimeStatus,
    saveContractDeployment,
    updateContractDeployment,
    deleteContractDeployment,
    clearAllContractDeployments,
    fetchContractDeployments,
    getStatistics,
    generateEtherscanUrl,
    testRealtimeConnection
  };
};