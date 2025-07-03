import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

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
  const [toParameterFeed, setToParameterFeed] = useState([]); // New: Track 'to' parameters
  
  const wsRef = useRef(null);
  const subscriptionIds = useRef({});
  const reconnectTimeoutRef = useRef(null);
  const isDisconnecting = useRef(false); // Track intentional disconnection
  const enabledStateRef = useRef(false); // Track enabled state synchronously
  const messageCount = useRef(0); // Track total messages received

  // CHAINNODE API BACKUP - Updated API configuration for Chainnodes
  const API_KEY = 'b1af9900-d408-48de-852a-633b546fae1f';
  const WS_URL = `wss://mainnet.chainnodes.org/${API_KEY}`;

  // Rate limiting configuration for free plan
  const RATE_LIMITS = {
    RECONNECT_DELAY: 30000, // 30 seconds between reconnect attempts
    SUBSCRIPTION_DELAY: 3000, // 3 seconds between subscription requests
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
    console.log(`[WebSocket Debug] ${message}`);
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

    setRawResponses(prev => [responseEntry, ...prev.slice(0, 200)]); // Keep more entries for debugging
  };

  // Add 'to' parameter entry
  const addToParameterEntry = (txHash, txData) => {
    if (isDisconnecting.current || !enabledStateRef.current) {
      return;
    }

    const timestamp = new Date();
    const toAddress = txData.to;
    const hasInput = txData.input && txData.input !== '0x' && txData.input.length > 2;
    const fromAddress = txData.from;
    const isContractDeployment = toAddress === null || toAddress === undefined || toAddress === '';

    const toEntry = {
      id: Date.now() + Math.random(),
      timestamp,
      txHash: txHash?.slice(0, 16) + '...' || 'unknown',
      to: toAddress,
      from: fromAddress?.slice(0, 16) + '...' || 'unknown',
      isContractDeployment,
      hasInput,
      inputSize: hasInput ? `${Math.floor(txData.input.length / 2) - 1} bytes` : '0 bytes',
      gasPrice: txData.gasPrice,
      value: txData.value,
      nonce: txData.nonce
    };

    setToParameterFeed(prev => [toEntry, ...prev.slice(0, 200)]);
  };

  const disconnect = () => {
    addDebugMessage('🔌 Initiating disconnect...');
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
      addDebugMessage(`🔌 Closing WebSocket (state: ${currentState})`);

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
    addDebugMessage('✅ Disconnect completed');

    // Reset disconnecting flag after a brief delay
    setTimeout(() => {
      isDisconnecting.current = false;
    }, 300);
  };

  const connect = () => {
    addDebugMessage(`🚀 Connect called - enabled: ${enabledStateRef.current}, disconnecting: ${isDisconnecting.current}`);
    
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
      addDebugMessage('✅ WebSocket already connected');
      return;
    }

    // Clean up any existing connection
    if (wsRef.current) {
      addDebugMessage('🧹 Cleaning up existing connection...');
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

    addDebugMessage(`🚀 Creating new WebSocket connection...`);
    addDebugMessage(`🔗 URL: ${WS_URL.substring(0, 50)}...`);
    setConnectionStatus('connecting');

    try {
      wsRef.current = new WebSocket(WS_URL);

      wsRef.current.onopen = () => {
        addDebugMessage(`✅ WebSocket.onopen - enabled: ${enabledStateRef.current}, disconnecting: ${isDisconnecting.current}`);
        
        if (!enabledStateRef.current || isDisconnecting.current) {
          addDebugMessage('⚠️ Connection opened but WebSocket is disabled, closing...');
          if (wsRef.current) {
            wsRef.current.close();
          }
          return;
        }

        addDebugMessage('🎉 WebSocket connection established successfully!');
        setIsConnected(true);
        setConnectionStatus('connected');

        // Clear any existing reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        // Reset message counter
        messageCount.current = 0;

        // Delay subscription setup to respect rate limits
        addDebugMessage('⏳ Scheduling subscriptions in 2s...');
        setTimeout(() => {
          if (enabledStateRef.current && !isDisconnecting.current && wsRef.current?.readyState === WebSocket.OPEN) {
            setupSubscriptions();
          } else {
            addDebugMessage(`❌ Skipping subscriptions - enabled: ${enabledStateRef.current}, disconnecting: ${isDisconnecting.current}, state: ${wsRef.current?.readyState}`);
          }
        }, 2000);
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
          addDebugMessage(`📨 [${messageCount.current}] Raw message: ${JSON.stringify(data).substring(0, 100)}...`);
          
          // Always add to raw responses for debugging
          addRawResponse(data, 'websocket');
          
          handleMessage(data);
        } catch (error) {
          addDebugMessage(`❌ Error parsing message: ${error.message}`);
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        addDebugMessage(`🔌 WebSocket closed: Code ${event.code}, Reason: ${event.reason || 'None'}`);
        setIsConnected(false);

        // Only set to disconnected if we're not intentionally disconnecting
        if (!isDisconnecting.current) {
          setConnectionStatus('disconnected');
        }

        // Only attempt reconnect if enabled, not intentionally disconnecting, and not a normal closure
        if (enabledStateRef.current && !isDisconnecting.current && event.code !== 1000) {
          const delay = RATE_LIMITS.RECONNECT_DELAY;
          addDebugMessage(`⏳ Scheduling reconnect in ${delay / 1000}s (rate limiting)`);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (enabledStateRef.current && !isDisconnecting.current) {
              addDebugMessage('🔄 Attempting to reconnect...');
              connect();
            }
          }, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        if (!isDisconnecting.current) {
          addDebugMessage(`❌ WebSocket error - likely rate limited or network issue`);
          console.error('WebSocket error:', error);
          setConnectionStatus('error');
        }
      };

      addDebugMessage('📡 WebSocket created, waiting for connection...');
    } catch (error) {
      addDebugMessage(`❌ Failed to create WebSocket: ${error.message}`);
      setConnectionStatus('error');
    }
  };

  const setupSubscriptions = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !enabledStateRef.current || isDisconnecting.current) {
      addDebugMessage('❌ Cannot setup subscriptions - WebSocket not ready or disabled');
      return;
    }

    addDebugMessage('🚀 Setting up subscriptions...');

    // Try regular newPendingTransactions first (this might be what works)
    const pendingTxSub = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_subscribe',
      params: ['newPendingTransactions'] // Try this first
    };

    try {
      wsRef.current.send(JSON.stringify(pendingTxSub));
      addDebugMessage('📡 Sent newPendingTransactions subscription (trying hash-only first)');
      addRawResponse(pendingTxSub, 'request');

      // Add delay before trying the full body version
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN && enabledStateRef.current && !isDisconnecting.current) {
          const pendingTxWithBodySub = {
            jsonrpc: '2.0',
            id: 3,
            method: 'eth_subscribe',
            params: ['newPendingTransactionsWithBody'] // Try the full body version
          };

          wsRef.current.send(JSON.stringify(pendingTxWithBodySub));
          addDebugMessage('📡 Sent newPendingTransactionsWithBody subscription');
          addRawResponse(pendingTxWithBodySub, 'request');
        }
      }, 1000);

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
          addDebugMessage('📡 Sent Uniswap events subscription');
          addRawResponse(pairCreatedSub, 'request');
        }
      }, RATE_LIMITS.SUBSCRIPTION_DELAY);
    } catch (error) {
      addDebugMessage(`❌ Error sending subscriptions: ${error.message}`);
    }
  };

  const handleMessage = (data) => {
    // Double-check that we should be processing messages
    if (isDisconnecting.current || !enabledStateRef.current) {
      return;
    }

    // Log what type of message we're handling
    if (data.method === 'eth_subscription') {
      addDebugMessage(`🎯 Subscription data received: ${JSON.stringify(data).substring(0, 200)}...`);
      
      const { subscription, result } = data.params;
      
      // Get the subscription ID to know which subscription this is from
      const subId = Object.keys(subscriptionIds.current).find(
        key => subscriptionIds.current[key] === subscription
      );
      
      addDebugMessage(`📋 Subscription ID: ${subscription}, Original ID: ${subId}`);

      // Handle different types of subscription results
      if (typeof result === 'string' && result.startsWith('0x')) {
        // This is likely a transaction hash from newPendingTransactions
        addDebugMessage(`🔗 Transaction hash received: ${result.slice(0, 20)}...`);
        
        // For hash-only subscriptions, we need to fetch the full transaction
        if (subId === '1') { // newPendingTransactions subscription
          fetchTransactionDetails(result);
        }
      } else if (result && typeof result === 'object' && result.hash) {
        // This is a full transaction object from newPendingTransactionsWithBody
        const txData = result;
        const txHash = txData.hash;
        
        addDebugMessage(`🎯 Full transaction received: ${txHash.slice(0, 10)}...`);
        
        // Add to 'to' parameter feed for analysis
        addToParameterEntry(txHash, txData);

        // Log key details for debugging
        const toAddress = txData.to;
        const hasInput = txData.input && txData.input !== '0x' && txData.input.length > 2;
        
        addDebugMessage(`🔍 TX: ${txHash.slice(0, 10)}... | to: ${toAddress || 'NULL'} | input: ${hasInput ? 'YES' : 'NO'}`);

        // Check if this is a contract deployment (to field is null/undefined)
        if (toAddress === null || toAddress === undefined || toAddress === '') {
          if (hasInput) {
            addDebugMessage(`🏭 Contract deployment detected: ${txHash.slice(0, 10)}...`);
            
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
          } else {
            addDebugMessage(`⚠️ NULL 'to' but no input data: ${txHash.slice(0, 10)}...`);
          }
        }
      }
      // Handle liquidity events (PairCreated)
      else if (result && result.topics && result.topics[0] === PAIR_CREATED_TOPIC) {
        addDebugMessage('💧 Liquidity event detected!');
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
      addDebugMessage(`✅ Subscription ${data.id} confirmed: ${data.result.slice(0, 10)}...`);
      
      if (data.id === 1) {
        addDebugMessage('🎉 newPendingTransactions subscription active!');
      } else if (data.id === 2) {
        addDebugMessage('🎉 Uniswap events subscription active!');
      } else if (data.id === 3) {
        addDebugMessage('🎉 newPendingTransactionsWithBody subscription active!');
      }
    }
    // Handle errors
    else if (data.error) {
      if (data.error.message && data.error.message.includes('rate')) {
        addDebugMessage(`⏳ Rate limited: ${data.error.message}`);
      } else if (data.error.message && data.error.message.includes('newPendingTransactionsWithBody')) {
        addDebugMessage(`❌ newPendingTransactionsWithBody not supported: ${data.error.message}`);
        addDebugMessage('💡 Falling back to newPendingTransactions (hash-only)');
      } else {
        addDebugMessage(`❌ API Error: ${data.error.message || JSON.stringify(data.error)}`);
      }
    }
    // Handle other responses (like eth_blockNumber)
    else if (data.id === 999 && data.result) {
      addDebugMessage(`✅ Test successful! Block: ${parseInt(data.result, 16)}`);
    }
  };

  // Fetch transaction details for hash-only subscriptions
  const fetchTransactionDetails = (txHash) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const txRequest = {
      jsonrpc: '2.0',
      id: 1000 + Math.floor(Math.random() * 1000),
      method: 'eth_getTransactionByHash',
      params: [txHash]
    };

    try {
      wsRef.current.send(JSON.stringify(txRequest));
      addDebugMessage(`🔍 Fetching transaction details for: ${txHash.slice(0, 20)}...`);
      addRawResponse(txRequest, 'request');
    } catch (error) {
      addDebugMessage(`❌ Error fetching transaction details: ${error.message}`);
    }
  };

  // Test connection function
  const testConnection = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addDebugMessage('❌ Cannot test - WebSocket not connected');
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
      addDebugMessage('🧪 Sent test request (eth_blockNumber)');
      addRawResponse(testRequest, 'request');
    } catch (error) {
      addDebugMessage(`❌ Error sending test request: ${error.message}`);
    }
  };

  // Alternative connection method
  const tryAlternativeConnection = () => {
    addDebugMessage('🔄 Trying alternative connection...');

    const httpRequest = {
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1
    };

    fetch(`https://mainnet.chainnodes.org/${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(httpRequest)
    })
      .then(response => response.json())
      .then(data => {
        addRawResponse(httpRequest, 'http-request');
        addRawResponse(data, 'http-response');

        if (data.result) {
          addDebugMessage(`✅ HTTP API works! Block: ${parseInt(data.result, 16)}`);
          addDebugMessage('⏳ Waiting before WebSocket retry...');
          setTimeout(() => {
            if (enabledStateRef.current && !isDisconnecting.current) {
              connect();
            }
          }, 5000);
        } else if (data.error && data.error.message.includes('rate')) {
          addDebugMessage(`⏳ Rate limited via HTTP: ${data.error.message}`);
        } else {
          addDebugMessage(`❌ HTTP API error: ${JSON.stringify(data)}`);
        }
      })
      .catch(error => {
        addDebugMessage(`❌ HTTP test failed: ${error.message}`);
      });
  };

  // Toggle WebSocket connection with proper state management
  const toggleConnection = () => {
    const newEnabledState = !isEnabled;
    addDebugMessage(`🔄 Toggling connection: ${isEnabled ? 'ON→OFF' : 'OFF→ON'}`);

    if (newEnabledState) {
      // Turning ON
      addDebugMessage('🟢 WebSocket enabled - preparing connection...');
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
      addDebugMessage('🔴 WebSocket disabled - disconnecting...');
      // Update ref immediately
      enabledStateRef.current = false;
      // Set the React state
      setIsEnabled(false);
      disconnect();
    }
  };

  // Generate mock data for demo
  const generateMockData = () => {
    addDebugMessage('🎭 Generating mock data for demo');

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
    addDebugMessage('🧹 Cleared raw response log');
  };

  // Clear 'to' parameter feed
  const clearToParameterFeed = () => {
    setToParameterFeed([]);
    addDebugMessage('🧹 Cleared \'to\' parameter feed');
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
    toParameterFeed, // New: Expose 'to' parameter feed
    connect,
    disconnect,
    testConnection,
    tryAlternativeConnection,
    toggleConnection,
    clearRawResponses,
    clearToParameterFeed, // New: Function to clear 'to' parameter feed
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};