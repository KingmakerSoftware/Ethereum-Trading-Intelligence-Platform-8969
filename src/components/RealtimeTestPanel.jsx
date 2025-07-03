import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useContractDeployments } from '../hooks/useContractDeployments';

const { FiTestTube, FiCheckCircle, FiXCircle, FiLoader, FiAlertCircle, FiEye, FiTrash2 } = FiIcons;

const RealtimeTestPanel = () => {
  const { testRealtimeConnection, realtimeStatus, error, contractDeployments } = useContractDeployments();
  const [testStatus, setTestStatus] = useState('idle');
  const [testMessage, setTestMessage] = useState('');
  const [testRecord, setTestRecord] = useState(null);
  const [debugLogs, setDebugLogs] = useState([]);
  const [showDebugLogs, setShowDebugLogs] = useState(false);

  // Add debug log function
  const addDebugLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp,
      message,
      type
    };
    setDebugLogs(prev => [logEntry, ...prev.slice(0, 49)]); // Keep last 50 logs
    
    // Also log to console with a specific prefix to make it easier to find
    console.log(`[REALTIME-TEST] ${message}`);
  };

  // Clear debug logs
  const clearDebugLogs = () => {
    setDebugLogs([]);
    addDebugLog('Debug logs cleared');
  };

  // Monitor contract deployments for test records
  useEffect(() => {
    if (testRecord) {
      const testRecordExists = contractDeployments.some(deployment => 
        deployment.transaction_hash === testRecord.transaction_hash
      );
      
      if (testRecordExists) {
        addDebugLog(`✅ Test record found in UI! Hash: ${testRecord.transaction_hash.slice(0, 20)}...`, 'success');
        setTestMessage(prev => prev + ' ✅ Record appeared in UI!');
      } else {
        addDebugLog(`⏳ Test record not yet visible in UI. Hash: ${testRecord.transaction_hash.slice(0, 20)}...`, 'warning');
      }
    }
  }, [contractDeployments, testRecord]);

  const handleTest = async () => {
    setTestStatus('testing');
    setTestMessage('');
    addDebugLog('🔄 Starting real-time test...', 'info');
    
    try {
      addDebugLog(`📊 Current real-time status: ${realtimeStatus}`, 'info');
      addDebugLog(`📊 Current deployments count: ${contractDeployments.length}`, 'info');
      
      setTestMessage('📝 Inserting test record to database...');
      addDebugLog('📝 Calling testRealtimeConnection...', 'info');
      
      const record = await testRealtimeConnection();
      setTestRecord(record);
      
      addDebugLog(`✅ Test record inserted: ${record.transaction_hash}`, 'success');
      addDebugLog(`⏳ Waiting for real-time update...`, 'info');
      
      setTestStatus('success');
      setTestMessage(`✅ Test record inserted! Hash: ${record.transaction_hash.slice(0, 20)}... - Waiting for real-time update...`);
      
      // Check if record appears in UI after 5 seconds
      setTimeout(() => {
        const recordInUI = contractDeployments.some(deployment => 
          deployment.transaction_hash === record.transaction_hash
        );
        
        if (recordInUI) {
          addDebugLog('🎉 SUCCESS: Test record appeared in UI via real-time!', 'success');
          setTestMessage(prev => prev + ' 🎉 SUCCESS: Real-time is working!');
        } else {
          addDebugLog('❌ FAILED: Test record not visible in UI after 5 seconds', 'error');
          setTestMessage(prev => prev + ' ❌ Real-time may not be working properly.');
        }
      }, 5000);
      
      // Reset after 25 seconds
      setTimeout(() => {
        setTestStatus('idle');
        setTestMessage('');
        setTestRecord(null);
      }, 25000);
      
    } catch (error) {
      addDebugLog(`❌ Test failed: ${error.message}`, 'error');
      setTestStatus('error');
      setTestMessage(`❌ Test failed: ${error.message}`);
      
      // Reset after 10 seconds
      setTimeout(() => {
        setTestStatus('idle');
        setTestMessage('');
        setTestRecord(null);
      }, 10000);
    }
  };

  const handleDirectInsert = async () => {
    setTestStatus('testing');
    setTestMessage('');
    addDebugLog('🔄 Starting direct insert test...', 'info');
    
    try {
      // Import supabase directly for this test
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        'https://caxwxxqlyznymadgaqwj.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNheHd4eHFseXpueW1hZGdhcXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1MTIyNjgsImV4cCI6MjA2NzA4ODI2OH0.vHj0fZ8k77GUcEzg96BDiq8ilv77TeQTI6Ol97k6bnM'
      );
      
      const testRecord = {
        transaction_hash: `0xDIRECT_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        from_address: '0x1234567890123456789012345678901234567890',
        to_address: null,
        input_data: '0x608060405234801561001057600080fd5b50',
        input_size: '21 bytes',
        gas_price: '0x5d21dba00',
        gas_limit: '0x5208',
        value: '0x0',
        nonce: '0x1',
        detected_at: new Date().toISOString(),
        status: 'direct_test',
        etherscan_url: 'https://etherscan.io/tx/0xtest'
      };

      addDebugLog(`📝 Direct insert test record: ${testRecord.transaction_hash}`, 'info');
      
      const { data, error } = await supabase
        .from('contract_deployments_monitor_7x9k2a')
        .insert(testRecord)
        .select();

      if (error) {
        throw error;
      }

      addDebugLog(`✅ Direct insert successful: ${data[0].transaction_hash}`, 'success');
      setTestRecord(testRecord);
      setTestStatus('success');
      setTestMessage(`✅ Direct insert successful! Hash: ${testRecord.transaction_hash.slice(0, 20)}... - Waiting for real-time update...`);
      
      // Check if record appears in UI after 5 seconds
      setTimeout(() => {
        const recordInUI = contractDeployments.some(deployment => 
          deployment.transaction_hash === testRecord.transaction_hash
        );
        
        if (recordInUI) {
          addDebugLog('🎉 SUCCESS: Direct insert record appeared in UI via real-time!', 'success');
          setTestMessage(prev => prev + ' 🎉 SUCCESS: Real-time is working!');
        } else {
          addDebugLog('❌ FAILED: Direct insert record not visible in UI after 5 seconds', 'error');
          setTestMessage(prev => prev + ' ❌ Real-time may not be working properly.');
        }
      }, 5000);
      
      // Clean up after 15 seconds
      setTimeout(async () => {
        try {
          await supabase
            .from('contract_deployments_monitor_7x9k2a')
            .delete()
            .eq('transaction_hash', testRecord.transaction_hash);
          addDebugLog('✅ Direct test record cleaned up', 'info');
        } catch (cleanupError) {
          addDebugLog(`❌ Error cleaning up direct test record: ${cleanupError.message}`, 'error');
        }
      }, 15000);
      
      // Reset after 25 seconds
      setTimeout(() => {
        setTestStatus('idle');
        setTestMessage('');
        setTestRecord(null);
      }, 25000);
      
    } catch (error) {
      addDebugLog(`❌ Direct insert failed: ${error.message}`, 'error');
      setTestStatus('error');
      setTestMessage(`❌ Direct insert failed: ${error.message}`);
      
      // Reset after 10 seconds
      setTimeout(() => {
        setTestStatus('idle');
        setTestMessage('');
        setTestRecord(null);
      }, 10000);
    }
  };

  // Test real-time subscription directly
  const testRealtimeSubscription = async () => {
    addDebugLog('🔄 Testing real-time subscription directly...', 'info');
    
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        'https://caxwxxqlyznymadgaqwj.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNheHd4eHFseXpueW1hZGdhcXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1MTIyNjgsImV4cCI6MjA2NzA4ODI2OH0.vHj0fZ8k77GUcEzg96BDiq8ilv77TeQTI6Ol97k6bnM'
      );
      
      const testChannel = supabase.channel('test_realtime_channel');
      
      testChannel
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'contract_deployments_monitor_7x9k2a'
        }, (payload) => {
          addDebugLog(`📨 Real-time event received: ${payload.eventType}`, 'success');
          addDebugLog(`📊 Event data: ${JSON.stringify(payload).substring(0, 100)}...`, 'info');
        })
        .subscribe((status) => {
          addDebugLog(`📡 Test subscription status: ${status}`, 'info');
        });
      
      // Clean up after 30 seconds
      setTimeout(() => {
        testChannel.unsubscribe();
        addDebugLog('🔌 Test subscription cleaned up', 'info');
      }, 30000);
      
    } catch (error) {
      addDebugLog(`❌ Real-time subscription test failed: ${error.message}`, 'error');
    }
  };

  return (
    <motion.div
      className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <SafeIcon icon={FiTestTube} className="text-purple-400 text-xl" />
          <h3 className="text-lg font-semibold text-white">Real-time Test Panel</h3>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowDebugLogs(!showDebugLogs)}
            className="flex items-center space-x-2 px-3 py-1 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 transition-colors"
          >
            <SafeIcon icon={FiEye} />
            <span>{showDebugLogs ? 'Hide' : 'Show'} Debug Logs</span>
          </button>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              realtimeStatus === 'SUBSCRIBED' ? 'bg-green-400 animate-pulse' :
              realtimeStatus === 'CONNECTING' ? 'bg-yellow-400 animate-pulse' :
              'bg-red-400'
            }`}></div>
            <span className="text-sm text-gray-400">
              Status: {realtimeStatus}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-4">
          <div className="flex items-center space-x-2">
            <SafeIcon icon={FiAlertCircle} className="text-red-400" />
            <span className="text-red-400 text-sm font-medium">Error</span>
          </div>
          <p className="text-red-300 text-xs mt-1">{error}</p>
        </div>
      )}

      {/* Debug Logs Section */}
      {showDebugLogs && (
        <div className="bg-gray-900 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-white font-medium">Debug Logs</h4>
            <button
              onClick={clearDebugLogs}
              className="flex items-center space-x-1 px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors"
            >
              <SafeIcon icon={FiTrash2} />
              <span>Clear</span>
            </button>
          </div>
          <div className="bg-black rounded p-3 max-h-48 overflow-y-auto font-mono text-xs">
            {debugLogs.length === 0 ? (
              <div className="text-gray-500">No debug logs yet...</div>
            ) : (
              debugLogs.map(log => (
                <div
                  key={log.id}
                  className={`mb-1 ${
                    log.type === 'success' ? 'text-green-400' :
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'warning' ? 'text-yellow-400' :
                    'text-gray-300'
                  }`}
                >
                  [{log.timestamp}] {log.message}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="bg-gray-900 rounded-lg p-4">
          <h4 className="text-white font-medium mb-2">Test Real-time Updates</h4>
          <p className="text-gray-400 text-sm mb-4">
            This will insert a test record and verify if it appears automatically in the contract deployment list.
          </p>
          
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleTest}
              disabled={testStatus === 'testing'}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SafeIcon icon={
                testStatus === 'testing' ? FiLoader :
                testStatus === 'success' ? FiCheckCircle :
                testStatus === 'error' ? FiXCircle :
                FiTestTube
              } className={testStatus === 'testing' ? 'animate-spin' : ''} />
              <span>
                {testStatus === 'testing' ? 'Testing...' :
                 testStatus === 'success' ? 'Test Passed' :
                 testStatus === 'error' ? 'Test Failed' :
                 'Test Real-time'}
              </span>
            </button>
            
            <button
              onClick={handleDirectInsert}
              disabled={testStatus === 'testing'}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SafeIcon icon={FiTestTube} className={testStatus === 'testing' ? 'animate-spin' : ''} />
              <span>Direct Insert Test</span>
            </button>
            
            <button
              onClick={testRealtimeSubscription}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <SafeIcon icon={FiTestTube} />
              <span>Test Subscription</span>
            </button>
          </div>
          
          {testMessage && (
            <div className={`mt-4 p-3 rounded-lg text-sm ${
              testStatus === 'success' ? 'bg-green-900/20 border border-green-500/30 text-green-400' :
              testStatus === 'error' ? 'bg-red-900/20 border border-red-500/30 text-red-400' :
              'bg-yellow-900/20 border border-yellow-500/30 text-yellow-400'
            }`}>
              {testMessage}
            </div>
          )}

          {testRecord && (
            <div className="mt-4 p-3 bg-gray-800 rounded-lg border border-gray-600">
              <h5 className="text-white font-medium mb-2">Test Record Details:</h5>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-400">Hash:</span>
                  <code className="text-cyan-400 ml-2">{testRecord.transaction_hash.slice(0, 20)}...</code>
                </div>
                <div>
                  <span className="text-gray-400">Status:</span>
                  <span className="text-purple-400 ml-2">{testRecord.status}</span>
                </div>
                <div>
                  <span className="text-gray-400">From:</span>
                  <code className="text-green-400 ml-2">{testRecord.from_address.slice(0, 20)}...</code>
                </div>
                <div>
                  <span className="text-gray-400">To:</span>
                  <span className="text-red-400 ml-2">{testRecord.to_address || 'NULL'}</span>
                </div>
                <div>
                  <span className="text-gray-400">In UI:</span>
                  <span className={`ml-2 ${
                    contractDeployments.some(d => d.transaction_hash === testRecord.transaction_hash) 
                      ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {contractDeployments.some(d => d.transaction_hash === testRecord.transaction_hash) 
                      ? 'YES ✅' : 'NO ❌'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
          <h4 className="text-blue-400 font-medium mb-2">Debug Instructions:</h4>
          <ol className="text-blue-300 text-sm space-y-1">
            <li>1. Click "Show Debug Logs" to see real-time debugging</li>
            <li>2. Click "Test Real-time" to insert a test record</li>
            <li>3. Watch the debug logs for detailed information</li>
            <li>4. Check if "In UI" shows "YES ✅" in the test record details</li>
            <li>5. If real-time fails, try "Test Subscription" to debug the connection</li>
            <li>6. Look for real-time events in the debug logs</li>
          </ol>
        </div>
      </div>
    </motion.div>
  );
};

export default RealtimeTestPanel;