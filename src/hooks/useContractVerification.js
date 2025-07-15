import { useState, useEffect, useRef } from 'react';
import supabase from '../lib/supabase';

const CONTRACTS_TABLE = 'contracts_verified_8k2m9x';
const DEPLOYMENTS_TABLE = 'contract_deployments_monitor_7x9k2a';
const ALCHEMY_API_KEY = 'hO0xJVa4nKccDfXUarfTR';
const ALCHEMY_HTTP_URL = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

export const useContractVerification = () => {
  const [verifiedContracts, setVerifiedContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [verificationStats, setVerificationStats] = useState({
    total: 0,
    verified: 0,
    pending: 0,
    failed: 0
  });

  // Auto-verification queue and processing
  const [autoVerificationQueue, setAutoVerificationQueue] = useState([]);
  const [isAutoVerifying, setIsAutoVerifying] = useState(false);
  const verificationInProgress = useRef(new Set());
  const processedDeployments = useRef(new Set()); // Track processed deployments

  // Auto-verification processing interval
  const verificationIntervalRef = useRef(null);

  // Generate Etherscan URL for contract address
  const generateContractEtherscanUrl = (contractAddress) => {
    return `https://etherscan.io/address/${contractAddress}`;
  };

  // Fetch transaction receipt from Alchemy
  const fetchTransactionReceipt = async (txHash) => {
    try {
      console.log('🔍 Fetching transaction receipt for:', txHash?.slice(0, 20) + '...');
      const response = await fetch(ALCHEMY_HTTP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getTransactionReceipt',
          params: [txHash],
          id: 1
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(`Alchemy API error: ${data.error.message}`);
      }

      if (!data.result) {
        throw new Error('Transaction receipt not found');
      }

      console.log('✅ Transaction receipt fetched:', {
        txHash: txHash?.slice(0, 20) + '...',
        status: data.result.status,
        contractAddress: data.result.contractAddress || 'NULL',
        gasUsed: data.result.gasUsed,
        blockNumber: data.result.blockNumber
      });

      return data.result;
    } catch (error) {
      console.error('❌ Error fetching transaction receipt:', error);
      throw error;
    }
  };

  // Verify contract address for a transaction
  const verifyContractAddress = async (deploymentRecord) => {
    const txHash = deploymentRecord.transaction_hash;

    // Prevent duplicate verification attempts
    if (verificationInProgress.current.has(txHash)) {
      console.log('⚠️ Verification already in progress for:', txHash?.slice(0, 20) + '...');
      return;
    }

    try {
      verificationInProgress.current.add(txHash);
      console.log('🔄 Starting contract verification for:', txHash?.slice(0, 20) + '...');

      // Update deployment record to show verification is in progress
      await supabase
        .from(DEPLOYMENTS_TABLE)
        .update({
          verification_status: 'verifying',
          verification_attempted_at: new Date().toISOString()
        })
        .eq('transaction_hash', txHash);

      // Trigger immediate stats refresh
      await fetchVerificationStats();

      // Fetch transaction receipt
      const receipt = await fetchTransactionReceipt(txHash);
      const hasContractAddress = receipt.contractAddress && receipt.contractAddress !== null;

      console.log('🎯 Contract verification result:', {
        txHash: txHash?.slice(0, 20) + '...',
        hasContractAddress,
        contractAddress: receipt.contractAddress || 'NULL',
        status: receipt.status,
        gasUsed: receipt.gasUsed
      });

      // Update deployment record with verification results
      const deploymentUpdate = {
        verification_status: hasContractAddress ? 'verified' : 'no_contract',
        contract_address_resolved: receipt.contractAddress || null,
        verification_attempted_at: new Date().toISOString()
      };

      await supabase
        .from(DEPLOYMENTS_TABLE)
        .update(deploymentUpdate)
        .eq('transaction_hash', txHash);

      // If we found a contract address, save it to the contracts table
      if (hasContractAddress) {
        const contractData = {
          contract_address: receipt.contractAddress,
          transaction_hash: txHash,
          deployer_address: receipt.from,
          block_number: receipt.blockNumber,
          block_timestamp: receipt.blockTimestamp,
          gas_used: receipt.gasUsed,
          effective_gas_price: receipt.effectiveGasPrice,
          detected_at: deploymentRecord.detected_at,
          verified_at: new Date().toISOString(),
          etherscan_url: generateContractEtherscanUrl(receipt.contractAddress)
        };

        console.log('💾 Saving verified contract to database:', {
          contractAddress: receipt.contractAddress,
          txHash: txHash?.slice(0, 20) + '...',
          deployer: receipt.from?.slice(0, 20) + '...'
        });

        const { data: contractRecord, error: contractError } = await supabase
          .from(CONTRACTS_TABLE)
          .upsert(contractData, {
            onConflict: 'contract_address',
            ignoreDuplicates: false
          })
          .select();

        if (contractError) {
          console.error('❌ Error saving contract:', contractError);
          throw contractError;
        }

        console.log('✅ Contract saved successfully:', contractRecord);
      }

      // Mark as processed
      processedDeployments.current.add(txHash);

      // Refresh data after verification
      await Promise.all([
        fetchVerifiedContracts(),
        fetchVerificationStats()
      ]);

      return {
        success: true,
        hasContract: hasContractAddress,
        contractAddress: receipt.contractAddress,
        receipt
      };

    } catch (error) {
      console.error('❌ Contract verification failed:', error);

      // Update deployment record to show verification failed
      await supabase
        .from(DEPLOYMENTS_TABLE)
        .update({
          verification_status: 'failed',
          verification_attempted_at: new Date().toISOString()
        })
        .eq('transaction_hash', txHash);

      // Refresh stats even on failure
      await fetchVerificationStats();

      throw error;
    } finally {
      verificationInProgress.current.delete(txHash);
    }
  };

  // Auto-verify deployment with retry logic
  const autoVerifyDeployment = async (deploymentRecord) => {
    try {
      console.log('🤖 Auto-verifying deployment:', deploymentRecord.transaction_hash?.slice(0, 20) + '...');
      
      // Add small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await verifyContractAddress(deploymentRecord);
      
      console.log('✅ Auto-verification completed for:', deploymentRecord.transaction_hash?.slice(0, 20) + '...');
      
      return true;
    } catch (error) {
      console.error('❌ Auto-verification failed:', error);
      
      // Don't throw error to prevent breaking the queue
      return false;
    }
  };

  // Process auto-verification queue
  const processAutoVerificationQueue = async () => {
    if (isAutoVerifying || autoVerificationQueue.length === 0) {
      return;
    }

    setIsAutoVerifying(true);
    console.log('🔄 Processing auto-verification queue:', autoVerificationQueue.length, 'items');

    try {
      // Process all items in the queue
      const itemsToProcess = [...autoVerificationQueue];
      const results = [];

      for (const deployment of itemsToProcess) {
        const success = await autoVerifyDeployment(deployment);
        results.push({ deployment, success });
        
        // Remove processed item from queue
        setAutoVerificationQueue(prev => prev.filter(item => 
          item.transaction_hash !== deployment.transaction_hash
        ));

        // Add delay between verifications to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log('✅ Auto-verification queue processed:', {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

    } catch (error) {
      console.error('❌ Error processing auto-verification queue:', error);
    } finally {
      setIsAutoVerifying(false);
    }
  };

  // Add deployment to auto-verification queue
  const queueDeploymentForVerification = (deploymentRecord) => {
    // Skip if already processed
    if (processedDeployments.current.has(deploymentRecord.transaction_hash)) {
      console.log('⚠️ Deployment already processed, skipping:', deploymentRecord.transaction_hash?.slice(0, 20) + '...');
      return;
    }

    // Check if already in queue or already verified
    const alreadyQueued = autoVerificationQueue.some(
      item => item.transaction_hash === deploymentRecord.transaction_hash
    );
    
    const needsVerification = !deploymentRecord.verification_status || 
                            deploymentRecord.verification_status === 'pending';
    
    const alreadyInProgress = verificationInProgress.current.has(deploymentRecord.transaction_hash);

    if (!alreadyQueued && needsVerification && !alreadyInProgress) {
      console.log('📋 Adding to auto-verification queue:', deploymentRecord.transaction_hash?.slice(0, 20) + '...');
      setAutoVerificationQueue(prev => [...prev, deploymentRecord]);
    }
  };

  // Enhanced queue processing for all pending deployments
  const queueAllPendingDeployments = async () => {
    try {
      console.log('🔄 Checking for pending deployments to queue...');

      // Get all deployments that need verification
      const { data: allDeployments, error } = await supabase
        .from(DEPLOYMENTS_TABLE)
        .select('*')
        .or('verification_status.is.null,verification_status.eq.pending')
        .order('detected_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching pending deployments:', error);
        return;
      }

      console.log('📊 Found pending deployments:', allDeployments?.length || 0);

      // Queue new deployments
      const newlyQueued = [];
      allDeployments?.forEach(deployment => {
        if (!processedDeployments.current.has(deployment.transaction_hash) &&
            !autoVerificationQueue.some(item => item.transaction_hash === deployment.transaction_hash) &&
            !verificationInProgress.current.has(deployment.transaction_hash)) {
          
          queueDeploymentForVerification(deployment);
          newlyQueued.push(deployment.transaction_hash?.slice(0, 10) + '...');
        }
      });

      if (newlyQueued.length > 0) {
        console.log('📋 Newly queued deployments:', newlyQueued);
      }

    } catch (error) {
      console.error('❌ Error queuing pending deployments:', error);
    }
  };

  // Fetch verified contracts from database
  const fetchVerifiedContracts = async () => {
    try {
      console.log('🔄 Fetching verified contracts...');
      const { data, error } = await supabase
        .from(CONTRACTS_TABLE)
        .select('*')
        .order('verified_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('❌ Error fetching verified contracts:', error);
        setError(error.message);
        return;
      }

      console.log('✅ Fetched verified contracts:', {
        count: data?.length || 0,
        sample: data?.slice(0, 3).map(c => ({
          address: c.contract_address?.slice(0, 20) + '...',
          verified: c.verified_at
        }))
      });

      setVerifiedContracts(data || []);
      setError(null);
    } catch (err) {
      console.error('❌ Error in fetchVerifiedContracts:', err);
      setError(err.message);
    }
  };

  // Fetch verification statistics with enhanced processing
  const fetchVerificationStats = async () => {
    try {
      console.log('📊 Fetching verification statistics...');

      // Get all deployments with their verification status
      const { data: allDeployments, error: allError } = await supabase
        .from(DEPLOYMENTS_TABLE)
        .select('verification_status,transaction_hash,detected_at')
        .order('detected_at', { ascending: false });

      if (allError) {
        console.error('❌ Error fetching verification stats:', allError);
        return;
      }

      const stats = {
        total: allDeployments?.length || 0,
        verified: allDeployments?.filter(d => d.verification_status === 'verified').length || 0,
        pending: allDeployments?.filter(d => !d.verification_status || d.verification_status === 'pending').length || 0,
        failed: allDeployments?.filter(d => d.verification_status === 'failed').length || 0,
        noContract: allDeployments?.filter(d => d.verification_status === 'no_contract').length || 0
      };

      console.log('📊 Updated verification statistics:', stats);
      setVerificationStats(stats);

      // Auto-queue any new pending deployments
      const pendingDeployments = allDeployments?.filter(d => 
        (!d.verification_status || d.verification_status === 'pending') &&
        !processedDeployments.current.has(d.transaction_hash) &&
        !verificationInProgress.current.has(d.transaction_hash) &&
        !autoVerificationQueue.some(item => item.transaction_hash === d.transaction_hash)
      ) || [];

      if (pendingDeployments.length > 0) {
        console.log('🔄 Found new pending deployments for auto-verification:', pendingDeployments.length);
        
        // Fetch full deployment records for pending items
        const { data: fullDeployments, error: fullError } = await supabase
          .from(DEPLOYMENTS_TABLE)
          .select('*')
          .in('transaction_hash', pendingDeployments.map(d => d.transaction_hash));

        if (!fullError && fullDeployments) {
          fullDeployments.forEach(deployment => {
            queueDeploymentForVerification(deployment);
          });
        }
      }

    } catch (err) {
      console.error('❌ Error fetching verification stats:', err);
    }
  };

  // Delete verified contract
  const deleteVerifiedContract = async (contractAddress) => {
    try {
      console.log('🗑️ Deleting verified contract:', contractAddress);
      const { error } = await supabase
        .from(CONTRACTS_TABLE)
        .delete()
        .eq('contract_address', contractAddress);

      if (error) {
        console.error('❌ Error deleting verified contract:', error);
        throw error;
      }

      console.log('✅ Verified contract deleted successfully');
      
      // Refresh the list
      await fetchVerifiedContracts();
      await fetchVerificationStats();
    } catch (err) {
      console.error('❌ Error in deleteVerifiedContract:', err);
      throw err;
    }
  };

  // Batch verify multiple contracts
  const batchVerifyContracts = async (deploymentRecords, onProgress) => {
    const results = [];
    for (let i = 0; i < deploymentRecords.length; i++) {
      const deployment = deploymentRecords[i];
      try {
        onProgress?.(i + 1, deploymentRecords.length, deployment);
        const result = await verifyContractAddress(deployment);
        results.push({ deployment, result, success: true });
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error('❌ Batch verification failed for:', deployment.transaction_hash, error);
        results.push({ deployment, error, success: false });
      }
    }

    // Refresh stats after batch verification
    await fetchVerificationStats();
    return results;
  };

  // Start auto-verification processing
  const startAutoVerificationProcessing = () => {
    if (verificationIntervalRef.current) {
      clearInterval(verificationIntervalRef.current);
    }

    console.log('🚀 Starting auto-verification processing...');
    
    // Process queue immediately
    processAutoVerificationQueue();
    
    // Set up interval to process queue every 10 seconds
    verificationIntervalRef.current = setInterval(() => {
      if (autoVerificationQueue.length > 0) {
        console.log('⏰ Auto-verification interval: processing queue...');
        processAutoVerificationQueue();
      }
    }, 10000); // 10 seconds
  };

  // Stop auto-verification processing
  const stopAutoVerificationProcessing = () => {
    if (verificationIntervalRef.current) {
      clearInterval(verificationIntervalRef.current);
      verificationIntervalRef.current = null;
      console.log('🛑 Stopped auto-verification processing');
    }
  };

  // Set up real-time subscription for deployment changes
  useEffect(() => {
    console.log('📡 Setting up real-time subscription for deployment changes...');
    
    const channel = supabase
      .channel('contract_deployments_verification_v3')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: DEPLOYMENTS_TABLE },
        (payload) => {
          console.log('🔄 Deployment change detected:', payload.eventType, payload.new?.transaction_hash?.slice(0, 10) + '...');
          
          // Immediate stats refresh for any change
          setTimeout(() => {
            fetchVerificationStats();
          }, 100);

          // If it's a new deployment, add it to verification queue immediately
          if (payload.eventType === 'INSERT' && payload.new) {
            console.log('➕ New deployment detected, adding to verification queue immediately');
            
            // Queue for verification immediately
            setTimeout(() => {
              queueDeploymentForVerification(payload.new);
            }, 200);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Deployment verification subscription status:', status);
      });

    return () => {
      console.log('🔌 Cleaning up deployment verification subscription');
      supabase.removeChannel(channel);
    };
  }, []);

  // Set up real-time subscription for verified contracts
  useEffect(() => {
    console.log('📡 Setting up real-time subscription for verified contracts...');
    
    const channel = supabase
      .channel('verified_contracts_v3')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: CONTRACTS_TABLE },
        (payload) => {
          console.log('🔄 Verified contract change detected:', payload.eventType);
          // Refresh verified contracts list
          fetchVerifiedContracts();
        }
      )
      .subscribe();

    return () => {
      console.log('🔌 Cleaning up verified contracts subscription');
      supabase.removeChannel(channel);
    };
  }, []);

  // Process auto-verification queue when items are added
  useEffect(() => {
    if (autoVerificationQueue.length > 0 && !isAutoVerifying) {
      console.log('🔄 Auto-verification queue has items, processing...');
      const timer = setTimeout(() => {
        processAutoVerificationQueue();
      }, 1000); // Reduced delay for faster processing

      return () => clearTimeout(timer);
    }
  }, [autoVerificationQueue, isAutoVerifying]);

  // Enhanced initialization with auto-processing
  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      try {
        console.log('🚀 Initializing contract verification system...');
        
        await Promise.all([
          fetchVerifiedContracts(),
          fetchVerificationStats()
        ]);

        // Queue all pending deployments
        await queueAllPendingDeployments();
        
        // Start auto-verification processing
        startAutoVerificationProcessing();

      } catch (err) {
        console.error('❌ Error initializing contract verification:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    initialize();

    // Cleanup on unmount
    return () => {
      stopAutoVerificationProcessing();
    };
  }, []);

  // Periodic check for new deployments
  useEffect(() => {
    const periodicCheck = setInterval(() => {
      console.log('⏰ Periodic check for new pending deployments...');
      queueAllPendingDeployments();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(periodicCheck);
  }, []);

  return {
    verifiedContracts,
    loading,
    error,
    verificationStats,
    autoVerificationQueue,
    isAutoVerifying,
    verifyContractAddress,
    fetchVerifiedContracts,
    fetchVerificationStats,
    deleteVerifiedContract,
    batchVerifyContracts,
    generateContractEtherscanUrl,
    queueDeploymentForVerification,
    queueAllPendingDeployments
  };
};