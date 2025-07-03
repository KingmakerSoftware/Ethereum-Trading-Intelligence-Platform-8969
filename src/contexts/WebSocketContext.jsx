import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useContractDeployments } from '../hooks/useContractDeployments';

const WebSocketContext = createContext();

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false); // WebSocket toggle state
  const [contractDeployments, setContractDeployments] = useState([]);
  const [liquidityEvents, setLiquidityEvents] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [debugMessages, setDebugMessages] = useState([]);
  const [rawResponses, setRawResponses] = useState([]); // Store full responses
  const [toParameterFeed, setToParameterFeed] = useState([]); // Track 'to' parameters

  // Running totals
  const [totalRawResponsesReceived, setTotalRawResponsesReceived] = useState(0);
  const [totalToParameterEntriesReceived, setTotalToParameterEntriesReceived] = useState(0);

  // Supabase integration
  const { saveContractDeployment, clearAllContractDeployments, generateEtherscanUrl } = useContractDeployments();

  const wsRef = useRef(null);
  const subscriptionIds = useRef({});
  const reconnectTimeoutRef = useRef(null);
  const isDisconnecting = useRef(false); // Track intentional disconnection
  const enabledStateRef = useRef(false); // Track enabled state synchronously
  const messageCount = useRef(0); // Track total messages received

  // ALCHEMY API Configuration
  const ALCHEMY_API_KEY = 'hO0xJVa4nKccDfXUarfTR';
  const WS_URL = `wss://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

  // Rate limiting configuration
  const RATE_LIMITS = {
    RECONNECT_DELAY: 5000, // 5 seconds between reconnect attempts (Alchemy is more generous)
    SUBSCRIPTION_DELAY: 1000, // 1 second between subscription requests
  };

  // Uniswap V2 Factory address and event topics
  const UNISWAP_V2_FACTORY = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
  const PAIR_CREATED_TOPIC = '0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9';

  // Keep enabledStateRef in sync with isEnabled state
  useEffect(() => {
    enabledStateRef.current = isEnabled;
  }, [isEnabled]);

  const addDebugMessage = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugMessages(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 20)]);
    console.log(`[Alchemy WebSocket Debug] ${message}`);
  };

  const addRawResponse = (response, type = 'websocket') => {
    // Don't add responses if we're disconnecting or disabled
    if (isDisconnecting.current || !enabledStateRef.current) {
      return;
    }

    const timestamp = new Date();
    const responseEntry = {
      id: Date.now() + Math.random(),
      timestamp,
      type,
      data: response,
      size: JSON.stringify(response).length
    };

    // Increment total counter
    setTotalRawResponsesReceived(prev => prev + 1);

    // Add to array (newest first) and keep last 200 items
    setRawResponses(prev => [responseEntry, ...prev.slice(0, 199)]);
  };

  // Add 'to' parameter entry with enhanced contract detection and Supabase saving
  const addToParameterEntry = async (txHash, txData) => {
    if (isDisconnecting.current || !enabledStateRef.current) {
      return;
    }

    const timestamp = new Date();
    const toAddress = txData.to;
    const hasInput = txData.input && txData.input !== '0x' && txData.input.length > 2;
    const fromAddress = txData.from;

    // Strict contract deployment detection
    const isContractDeployment = (
      (toAddress === null || toAddress === undefined || toAddress === '') &&
      hasInput &&
      txData.input.length > 10 // Must have substantial input data
    );

    const toEntry = {
      id: Date.now() + Math.random(),
      timestamp,
      txHash: txHash?.slice(0, 16) + '...' || 'unknown',
      fullTxHash: txHash, // Store the complete transaction hash
      to: toAddress || 'NULL',
      fullTo: toAddress, // Store the complete to address
      from: fromAddress?.slice(0, 16) + '...' || 'unknown',
      fullFrom: fromAddress, // Store the complete from address
      isContractDeployment,
      hasInput,
      inputSize: hasInput ? `${Math.floor(txData.input.length / 2) - 1} bytes` : '0 bytes',
      gasPrice: txData.gasPrice,
      value: txData.value,
      nonce: txData.nonce,
      etherscanUrl: generateEtherscanUrl(txHash) // Add Etherscan URL
    };

    console.log('Adding to parameter entry:', {
      txHash: txHash?.slice(0, 16),
      fullTxHash: txHash,
      toAddress,
      hasInput,
      isContractDeployment,
      inputLength: txData.input?.length || 0,
      inputData: txData.input?.slice(0, 20) + '...'
    });

    // Increment total counter
    setTotalToParameterEntriesReceived(prev => prev + 1);

    // Add to array (newest first) and keep last 200 items
    setToParameterFeed(prev => {
      const newFeed = [toEntry, ...prev.slice(0, 199)];
      
      // Debug contract filtering
      const contractCount = newFeed.filter(item => item.isContractDeployment === true).length;
      console.log('Updated toParameterFeed:', {
        totalItems: newFeed.length,
        contractDeployments: contractCount,
        newEntry: {
          id: toEntry.id,
          isContractDeployment: toEntry.isContractDeployment,
          to: toEntry.to,
          fullTxHash: toEntry.fullTxHash,
          hasInput: toEntry.hasInput
        }
      });
      return newFeed;
    });

    // 🔥 NEW: Save contract deployment to Supabase
    if (isContractDeployment) {
      try {
        const deploymentData = {
          transaction_hash: txHash,
          from_address: fromAddress,
          to_address: toAddress,
          input_data: txData.input,
          input_size: hasInput ? `${Math.floor(txData.input.length / 2) - 1} bytes` : '0 bytes',
          gas_price: txData.gasPrice,
          gas_limit: txData.gas,
          value: txData.value,
          nonce: txData.nonce,
          detected_at: timestamp.toISOString(),
          status: 'pending'
        };

        console.log('💾 Saving contract deployment to Supabase:', {
          txHash: txHash?.slice(0, 10) + '...',
          fromAddress: fromAddress?.slice(0, 10) + '...',
          inputSize: deploymentData.input_size
        });

        await saveContractDeployment(deploymentData);
        addDebugMessage(`💾 Contract deployment saved to Supabase: ${txHash?.slice(0, 10)}...`);
      } catch (error) {
        console.error('❌ Error saving contract deployment to Supabase:', error);
        addDebugMessage(`❌ Failed to save contract deployment: ${error.message}`);
      }
    }
  };

  const disconnect = () => {
    addDebugMessage('🔌 Initiating Alchemy disconnect...');
    isDisconnecting.current = true;

    // Clear any pending reconnect attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
      addDebugMessage('⏹️ Cancelled pending reconnect');
    }

    // Close WebSocket connection
    if (wsRef.current) {
      const currentState = wsRef.current.readyState;
      addDebugMessage(`🔌 Closing Alchemy WebSocket (state: ${currentState})`);

      // Remove event listeners to prevent further processing
      wsRef.current.onmessage = null;
      wsRef.current.onopen = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;

      // Force close if not already closed
      if (currentState === WebSocket.OPEN || currentState === WebSocket.CONNECTING) {
        wsRef.current.close(1000, 'Manual disconnect');
      }
      wsRef.current = null;
    }

    // Clear subscription tracking
    subscriptionIds.current = {};

    // Update state
    setIsConnected(false);
    setConnectionStatus('disconnected');
    addDebugMessage('✅ Alchemy disconnect completed');

    // Reset disconnecting flag after a brief delay
    setTimeout(() => {
      isDisconnecting.current = false;
    }, 300);
  };

  const connect = () => {
    addDebugMessage(`🚀 Alchemy connect called - enabled: ${enabledStateRef.current}, disconnecting: ${isDisconnecting.current}`);

    if (!enabledStateRef.current) {
      addDebugMessage('❌ WebSocket disabled - cannot connect');
      return;
    }

    if (isDisconnecting.current) {
      addDebugMessage('⏳ Still disconnecting, will retry in 1s...');
      setTimeout(() => connect(), 1000);
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      addDebugMessage('✅ Alchemy WebSocket already connected');
      return;
    }

    // Clean up any existing connection
    if (wsRef.current) {
      addDebugMessage('🧹 Cleaning up existing Alchemy connection...');
      const oldWs = wsRef.current;
      wsRef.current = null;

      // Remove listeners and close
      oldWs.onmessage = null;
      oldWs.onopen = null;
      oldWs.onerror = null;
      oldWs.onclose = null;
      if (oldWs.readyState === WebSocket.OPEN || oldWs.readyState === WebSocket.CONNECTING) {
        oldWs.close();
      }
    }

    addDebugMessage(`🚀 Creating new Alchemy WebSocket connection...`);
    addDebugMessage(`🔗 Alchemy URL: ${WS_URL.substring(0, 50)}...`);
    setConnectionStatus('connecting');

    try {
      wsRef.current = new WebSocket(WS_URL);

      wsRef.current.onopen = () => {
        addDebugMessage(`✅ Alchemy WebSocket.onopen - enabled: ${enabledStateRef.current}, disconnecting: ${isDisconnecting.current}`);

        if (!enabledStateRef.current || isDisconnecting.current) {
          addDebugMessage('⚠️ Connection opened but WebSocket is disabled, closing...');
          if (wsRef.current) {
            wsRef.current.close();
          }
          return;
        }

        addDebugMessage('🎉 Alchemy WebSocket connection established successfully!');
        setIsConnected(true);
        setConnectionStatus('connected');

        // Clear any existing reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        // Reset message counter
        messageCount.current = 0;

        // Setup Alchemy subscriptions immediately
        addDebugMessage('⏳ Setting up Alchemy subscriptions...');
        setTimeout(() => {
          if (enabledStateRef.current && !isDisconnecting.current && wsRef.current?.readyState === WebSocket.OPEN) {
            setupAlchemySubscriptions();
          } else {
            addDebugMessage(`❌ Skipping subscriptions - enabled: ${enabledStateRef.current}, disconnecting: ${isDisconnecting.current}, state: ${wsRef.current?.readyState}`);
          }
        }, 500);
      };

      wsRef.current.onmessage = (event) => {
        // Ignore messages if we're disconnecting or disabled
        if (isDisconnecting.current || !enabledStateRef.current) {
          return;
        }

        messageCount.current++;
        try {
          const data = JSON.parse(event.data);
          // Log ALL messages for debugging
          addDebugMessage(`📨 [${messageCount.current}] Alchemy message: ${JSON.stringify(data).substring(0, 100)}...`);

          // Always add to raw responses for debugging
          addRawResponse(data, 'alchemy-websocket');

          handleAlchemyMessage(data);
        } catch (error) {
          addDebugMessage(`❌ Error parsing Alchemy message: ${error.message}`);
          console.error('Error parsing Alchemy WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        addDebugMessage(`🔌 Alchemy WebSocket closed: Code ${event.code}, Reason: ${event.reason || 'None'}`);
        setIsConnected(false);

        // Only set to disconnected if we're not intentionally disconnecting
        if (!isDisconnecting.current) {
          setConnectionStatus('disconnected');
        }

        // Only attempt reconnect if enabled, not intentionally disconnecting, and not a normal closure
        if (enabledStateRef.current && !isDisconnecting.current && event.code !== 1000) {
          const delay = RATE_LIMITS.RECONNECT_DELAY;
          addDebugMessage(`⏳ Scheduling Alchemy reconnect in ${delay / 1000}s`);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (enabledStateRef.current && !isDisconnecting.current) {
              addDebugMessage('🔄 Attempting to reconnect to Alchemy...');
              connect();
            }
          }, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        if (!isDisconnecting.current) {
          addDebugMessage(`❌ Alchemy WebSocket error - network issue or API limit`);
          console.error('Alchemy WebSocket error:', error);
          setConnectionStatus('error');
        }
      };

      addDebugMessage('📡 Alchemy WebSocket created, waiting for connection...');
    } catch (error) {
      addDebugMessage(`❌ Failed to create Alchemy WebSocket: ${error.message}`);
      setConnectionStatus('error');
    }
  };

  const setupAlchemySubscriptions = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !enabledStateRef.current || isDisconnecting.current) {
      addDebugMessage('❌ Cannot setup Alchemy subscriptions - WebSocket not ready or disabled');
      return;
    }

    addDebugMessage('🚀 Setting up Alchemy subscriptions...');

    // Alchemy's specific pending transactions subscription
    const alchemyPendingTxSub = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_subscribe',
      params: ['alchemy_pendingTransactions']
    };

    try {
      wsRef.current.send(JSON.stringify(alchemyPendingTxSub));
      addDebugMessage('📡 Sent alchemy_pendingTransactions subscription');
      addRawResponse(alchemyPendingTxSub, 'alchemy-request');

      // Add Uniswap events subscription with delay
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN && enabledStateRef.current && !isDisconnecting.current) {
          const pairCreatedSub = {
            jsonrpc: '2.0',
            id: 2,
            method: 'eth_subscribe',
            params: [
              'logs',
              {
                address: UNISWAP_V2_FACTORY,
                topics: [PAIR_CREATED_TOPIC]
              }
            ]
          };

          wsRef.current.send(JSON.stringify(pairCreatedSub));
          addDebugMessage('📡 Sent Uniswap events subscription to Alchemy');
          addRawResponse(pairCreatedSub, 'alchemy-request');
        }
      }, RATE_LIMITS.SUBSCRIPTION_DELAY);
    } catch (error) {
      addDebugMessage(`❌ Error sending Alchemy subscriptions: ${error.message}`);
    }
  };

  const handleAlchemyMessage = (data) => {
    // Double-check that we should be processing messages
    if (isDisconnecting.current || !enabledStateRef.current) {
      return;
    }

    // Handle subscription data
    if (data.method === 'eth_subscription') {
      addDebugMessage(`🎯 Alchemy subscription data received: ${JSON.stringify(data).substring(0, 200)}...`);
      const { subscription, result } = data.params;

      // Get the subscription ID to know which subscription this is from
      const subId = Object.keys(subscriptionIds.current).find(
        key => subscriptionIds.current[key] === subscription
      );
      addDebugMessage(`📋 Alchemy Subscription ID: ${subscription}, Original ID: ${subId}`);

      // Handle Alchemy pending transactions (should be full transaction objects)
      if (result && typeof result === 'object' && result.hash) {
        // This is a full transaction object from alchemy_pendingTransactions
        const txData = result;
        const txHash = txData.hash;
        addDebugMessage(`🎯 Alchemy full transaction received: ${txHash.slice(0, 10)}...`);

        // Add to 'to' parameter feed for analysis (this will also save to Supabase)
        addToParameterEntry(txHash, txData);

        // Log key details for debugging
        const toAddress = txData.to;
        const hasInput = txData.input && txData.input !== '0x' && txData.input.length > 2;
        addDebugMessage(`🔍 Alchemy TX: ${txHash.slice(0, 10)}... | to: ${toAddress || 'NULL'} | input: ${hasInput ? 'YES' : 'NO'} | inputLen: ${txData.input?.length || 0}`);

        // Check if this is a contract deployment (to field is null/undefined AND has input)
        const isContractDeployment = (
          (toAddress === null || toAddress === undefined || toAddress === '') &&
          hasInput &&
          txData.input.length > 10
        );

        if (isContractDeployment) {
          addDebugMessage(`🏭 Alchemy contract deployment detected: ${txHash.slice(0, 10)}...`);
          const deployment = {
            id: Date.now() + Math.random(),
            hash: txHash,
            from: txData.from,
            gasPrice: txData.gasPrice,
            gasLimit: txData.gas,
            timestamp: new Date(),
            status: 'pending',
            contractAddress: null,
            inputSize: txData.input.length,
            value: txData.value,
            nonce: txData.nonce
          };

          setContractDeployments(prev => [deployment, ...prev.slice(0, 49)]);
        }
      }
      // Handle liquidity events (PairCreated)
      else if (result && result.topics && result.topics[0] === PAIR_CREATED_TOPIC) {
        addDebugMessage('💧 Alchemy liquidity event detected!');
        const liquidityEvent = {
          id: Date.now() + Math.random(),
          type: 'PairCreated',
          transactionHash: result.transactionHash,
          address: result.address,
          blockNumber: result.blockNumber,
          timestamp: new Date(),
          topics: result.topics,
          data: result.data
        };

        setLiquidityEvents(prev => [liquidityEvent, ...prev.slice(0, 49)]);
      }
    }
    // Handle subscription confirmations
    else if (data.id && data.result && typeof data.result === 'string' && data.result.startsWith('0x')) {
      subscriptionIds.current[data.id] = data.result;
      addDebugMessage(`✅ Alchemy subscription ${data.id} confirmed: ${data.result.slice(0, 10)}...`);

      if (data.id === 1) {
        addDebugMessage('🎉 alchemy_pendingTransactions subscription active!');
      } else if (data.id === 2) {
        addDebugMessage('🎉 Alchemy Uniswap events subscription active!');
      }
    }
    // Handle errors
    else if (data.error) {
      if (data.error.message && data.error.message.includes('rate')) {
        addDebugMessage(`⏳ Alchemy rate limited: ${data.error.message}`);
      } else if (data.error.message && data.error.message.includes('subscription')) {
        addDebugMessage(`❌ Alchemy subscription error: ${data.error.message}`);
      } else {
        addDebugMessage(`❌ Alchemy API Error: ${data.error.message || JSON.stringify(data.error)}`);
      }
    }
    // Handle other responses (like eth_blockNumber)
    else if (data.id === 999 && data.result) {
      addDebugMessage(`✅ Alchemy test successful! Block: ${parseInt(data.result, 16)}`);
    }
  };

  // Test connection function
  const testConnection = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addDebugMessage('❌ Cannot test - Alchemy WebSocket not connected');
      return;
    }

    const testRequest = {
      jsonrpc: '2.0',
      id: 999,
      method: 'eth_blockNumber',
      params: []
    };

    try {
      wsRef.current.send(JSON.stringify(testRequest));
      addDebugMessage('🧪 Sent test request to Alchemy (eth_blockNumber)');
      addRawResponse(testRequest, 'alchemy-request');
    } catch (error) {
      addDebugMessage(`❌ Error sending test request to Alchemy: ${error.message}`);
    }
  };

  // Alternative connection method using HTTP
  const tryAlternativeConnection = () => {
    addDebugMessage('🔄 Trying Alchemy HTTP alternative...');
    const httpRequest = {
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1
    };

    fetch(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(httpRequest)
    })
      .then(response => response.json())
      .then(data => {
        addRawResponse(httpRequest, 'alchemy-http-request');
        addRawResponse(data, 'alchemy-http-response');

        if (data.result) {
          addDebugMessage(`✅ Alchemy HTTP API works! Block: ${parseInt(data.result, 16)}`);
          addDebugMessage('⏳ Waiting before Alchemy WebSocket retry...');
          setTimeout(() => {
            if (enabledStateRef.current && !isDisconnecting.current) {
              connect();
            }
          }, 3000);
        } else if (data.error) {
          addDebugMessage(`❌ Alchemy HTTP API error: ${JSON.stringify(data.error)}`);
        }
      })
      .catch(error => {
        addDebugMessage(`❌ Alchemy HTTP test failed: ${error.message}`);
      });
  };

  // Toggle WebSocket connection with proper state management
  const toggleConnection = () => {
    const newEnabledState = !isEnabled;
    addDebugMessage(`🔄 Toggling Alchemy connection: ${isEnabled ? 'ON→OFF' : 'OFF→ON'}`);

    if (newEnabledState) {
      // Turning ON
      addDebugMessage('🟢 Alchemy WebSocket enabled - preparing connection...');
      // Reset disconnecting flag immediately when turning on
      isDisconnecting.current = false;
      // Update the ref immediately for synchronous access
      enabledStateRef.current = true;
      // Set the React state
      setIsEnabled(true);
      // Start connection immediately using the ref value
      setTimeout(() => {
        connect();
      }, 50);
    } else {
      // Turning OFF
      addDebugMessage('🔴 Alchemy WebSocket disabled - disconnecting...');
      // Update ref immediately
      enabledStateRef.current = false;
      // Set the React state
      setIsEnabled(false);
      disconnect();
    }
  };

  // Generate mock data for demo
  const generateMockData = () => {
    addDebugMessage('🎭 Generating mock data for Alchemy demo');
    const mockContracts = [
      {
        id: Date.now() + Math.random(),
        hash: '0x1234567890abcdef1234567890abcdef12345678',
        from: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        timestamp: new Date(Date.now() - 5 * 60000),
        status: 'confirmed',
        contractAddress: '0x9876543210987654321098765432109876543210'
      },
      {
        id: Date.now() + Math.random() + 1,
        hash: '0xfedcba0987654321fedcba0987654321fedcba09',
        from: '0x1111222233334444555566667777888899990000',
        timestamp: new Date(Date.now() - 12 * 60000),
        status: 'pending',
        contractAddress: null
      }
    ];

    const mockLiquidity = [
      {
        id: Date.now() + Math.random() + 2,
        type: 'PairCreated',
        transactionHash: '0xaabbccddeeff00112233445566778899aabbccdd',
        address: UNISWAP_V2_FACTORY,
        timestamp: new Date(Date.now() - 8 * 60000),
      }
    ];

    setContractDeployments(prev => [...mockContracts, ...prev].slice(0, 49));
    setLiquidityEvents(prev => [...mockLiquidity, ...prev].slice(0, 49));
  };

  // Clear raw responses
  const clearRawResponses = () => {
    setRawResponses([]);
    setTotalRawResponsesReceived(0);
    addDebugMessage('🧹 Cleared Alchemy raw response log and reset counter');
  };

  // Clear 'to' parameter feed
  const clearToParameterFeed = async () => {
    setToParameterFeed([]);
    setTotalToParameterEntriesReceived(0);
    addDebugMessage('🧹 Cleared Alchemy \'to\' parameter feed and reset counter');
    
    // Also clear Supabase data
    try {
      await clearAllContractDeployments();
      addDebugMessage('🧹 Cleared all contract deployments from Supabase');
    } catch (error) {
      console.error('❌ Error clearing Supabase data:', error);
      addDebugMessage(`❌ Error clearing Supabase data: ${error.message}`);
    }
  };

  // Initialize with mock data
  useEffect(() => {
    generateMockData();

    return () => {
      isDisconnecting.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, []);

  const value = {
    isConnected,
    isEnabled,
    connectionStatus,
    contractDeployments,
    liquidityEvents,
    debugMessages,
    rawResponses,
    toParameterFeed,
    totalRawResponsesReceived,
    totalToParameterEntriesReceived,
    connect,
    disconnect,
    testConnection,
    tryAlternativeConnection,
    toggleConnection,
    clearRawResponses,
    clearToParameterFeed,
    generateEtherscanUrl
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};