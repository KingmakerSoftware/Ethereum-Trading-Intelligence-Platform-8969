import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useContractVerification } from '../hooks/useContractVerification';
import { useContractDeployments } from '../hooks/useContractDeployments';
import { formatDistanceToNow } from 'date-fns';

const { FiCheckCircle, FiXCircle, FiClock, FiExternalLink, FiCopy, FiRefreshCw, FiPlay, FiTrash2, FiAlertCircle, FiShield, FiZap } = FiIcons;

const ContractVerificationPanel = () => {
  const {
    verifiedContracts,
    loading,
    error,
    verificationStats,
    autoVerificationQueue,
    isAutoVerifying,
    verifyContractAddress,
    fetchVerifiedContracts,
    deleteVerifiedContract,
    batchVerifyContracts,
    generateContractEtherscanUrl
  } = useContractVerification();

  const { contractDeployments } = useContractDeployments();

  const [verifying, setVerifying] = useState(null);
  const [batchVerifying, setBatchVerifying] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [copiedAddress, setCopiedAddress] = useState('');
  const [showVerificationDetails, setShowVerificationDetails] = useState(false);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(''), 2000);
  };

  const handleVerifySingle = async (deployment) => {
    setVerifying(deployment.id);
    try {
      await verifyContractAddress(deployment);
      await fetchVerifiedContracts();
    } catch (error) {
      console.error('❌ Verification failed:', error);
    } finally {
      setVerifying(null);
    }
  };

  const handleBatchVerify = async () => {
    const pendingDeployments = contractDeployments.filter(d =>
      d.verification_status === 'pending' || !d.verification_status
    );

    if (pendingDeployments.length === 0) {
      return;
    }

    setBatchVerifying(true);
    setBatchProgress({ current: 0, total: pendingDeployments.length });

    try {
      await batchVerifyContracts(pendingDeployments, (current, total, deployment) => {
        setBatchProgress({ current, total });
      });
      await fetchVerifiedContracts();
    } catch (error) {
      console.error('❌ Batch verification failed:', error);
    } finally {
      setBatchVerifying(false);
      setBatchProgress({ current: 0, total: 0 });
    }
  };

  const handleDeleteContract = async (contractAddress) => {
    try {
      await deleteVerifiedContract(contractAddress);
    } catch (error) {
      console.error('❌ Error deleting contract:', error);
    }
  };

  const openContractEtherscan = (contractAddress) => {
    const url = generateContractEtherscanUrl(contractAddress);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Generate Etherscan URL for transaction hash
  const generateTransactionEtherscanUrl = (txHash) => {
    return `https://etherscan.io/tx/${txHash}`;
  };

  const openTransactionEtherscan = (txHash) => {
    const url = generateTransactionEtherscanUrl(txHash);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getVerificationStatusColor = (status) => {
    switch (status) {
      case 'verified':
        return 'text-green-400 bg-green-900/20';
      case 'verifying':
        return 'text-yellow-400 bg-yellow-900/20';
      case 'failed':
        return 'text-red-400 bg-red-900/20';
      case 'no_contract':
        return 'text-gray-400 bg-gray-900/20';
      default:
        return 'text-blue-400 bg-blue-900/20';
    }
  };

  const getVerificationStatusIcon = (status) => {
    switch (status) {
      case 'verified':
        return FiCheckCircle;
      case 'verifying':
        return FiRefreshCw;
      case 'failed':
        return FiXCircle;
      case 'no_contract':
        return FiAlertCircle;
      default:
        return FiClock;
    }
  };

  return (
    <div className="space-y-6">
      {/* Verification Statistics */}
      <motion.div
        className="bg-gray-800 rounded-xl p-6 border border-gray-700"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <SafeIcon icon={FiShield} className="text-cyber-400 text-xl" />
            <h3 className="text-lg font-semibold text-white">Contract Verification Status</h3>
            {isAutoVerifying && (
              <div className="flex items-center space-x-2 bg-blue-900/20 px-3 py-1 rounded">
                <SafeIcon icon={FiZap} className="text-blue-400 animate-pulse" />
                <span className="text-blue-400 text-sm">Auto-Verifying...</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleBatchVerify}
              disabled={batchVerifying || verificationStats.pending === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-cyber-600 text-white rounded-lg hover:bg-cyber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SafeIcon icon={batchVerifying ? FiRefreshCw : FiPlay} className={batchVerifying ? 'animate-spin' : ''} />
              <span>
                {batchVerifying
                  ? `Verifying ${batchProgress.current}/${batchProgress.total}`
                  : `Verify ${verificationStats.pending} Pending`}
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{verificationStats.total}</div>
            <div className="text-sm text-gray-400">Total Deployments</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{verificationStats.verified}</div>
            <div className="text-sm text-gray-400">Verified Contracts</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">{verificationStats.pending}</div>
            <div className="text-sm text-gray-400">Pending Verification</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-400">{verificationStats.failed}</div>
            <div className="text-sm text-gray-400">Failed / No Contract</div>
          </div>
        </div>

        {/* Auto-Verification Queue Status */}
        {autoVerificationQueue.length > 0 && (
          <div className="mt-4 bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <SafeIcon icon={FiZap} className="text-blue-400 animate-pulse" />
              <span className="text-blue-400 text-sm font-medium">
                Auto-Verification Queue: {autoVerificationQueue.length} items
              </span>
            </div>
            <p className="text-blue-300 text-xs mt-1">
              Contracts are being automatically verified as they are detected.
            </p>
          </div>
        )}
      </motion.div>

      {/* Deployment Verification Status */}
      <motion.div
        className="bg-gray-800 rounded-xl p-6 border border-gray-700"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Deployment Verification Status</h3>
          <button
            onClick={() => setShowVerificationDetails(!showVerificationDetails)}
            className="text-cyber-400 hover:text-cyber-300 transition-colors"
          >
            {showVerificationDetails ? 'Hide Details' : 'Show Details'}
          </button>
        </div>

        {showVerificationDetails && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {contractDeployments.map((deployment) => (
              <div
                key={deployment.id}
                className="bg-gray-700 rounded-lg p-3 flex items-center justify-between"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <SafeIcon
                      icon={getVerificationStatusIcon(deployment.verification_status)}
                      className={`${getVerificationStatusColor(deployment.verification_status).split(' ')[0]} ${
                        deployment.verification_status === 'verifying' ? 'animate-spin' : ''
                      }`}
                    />
                    <span
                      className={`text-xs px-2 py-1 rounded font-medium ${getVerificationStatusColor(
                        deployment.verification_status
                      )}`}
                    >
                      {deployment.verification_status?.toUpperCase() || 'PENDING'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <code className="text-cyber-400 text-xs font-mono">
                      {deployment.transaction_hash?.slice(0, 20)}...
                    </code>
                    {deployment.contract_address_resolved && (
                      <div className="mt-1">
                        <code className="text-matrix-400 text-xs font-mono bg-matrix-900/20 px-2 py-1 rounded">
                          Contract: {deployment.contract_address_resolved?.slice(0, 20)}...
                        </code>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {/* 🔥 NEW: Transaction Etherscan link for failed/pending status */}
                  {(deployment.verification_status === 'failed' || 
                    deployment.verification_status === 'pending' || 
                    !deployment.verification_status) && deployment.transaction_hash && (
                    <button
                      onClick={() => openTransactionEtherscan(deployment.transaction_hash)}
                      className="p-1 text-gray-400 hover:text-orange-400 transition-colors"
                      title={`View transaction on Etherscan: ${deployment.transaction_hash}`}
                    >
                      <SafeIcon icon={FiExternalLink} />
                    </button>
                  )}
                  
                  {/* Existing contract Etherscan link for verified contracts */}
                  {deployment.contract_address_resolved && (
                    <button
                      onClick={() => openContractEtherscan(deployment.contract_address_resolved)}
                      className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                      title="View contract on Etherscan"
                    >
                      <SafeIcon icon={FiExternalLink} />
                    </button>
                  )}
                  
                  {(!deployment.verification_status || deployment.verification_status === 'pending') && (
                    <button
                      onClick={() => handleVerifySingle(deployment)}
                      disabled={verifying === deployment.id}
                      className="p-1 text-gray-400 hover:text-cyber-400 transition-colors disabled:opacity-50"
                      title="Verify contract address"
                    >
                      <SafeIcon
                        icon={FiRefreshCw}
                        className={verifying === deployment.id ? 'animate-spin' : ''}
                      />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Verified Contracts List */}
      <motion.div
        className="bg-gray-800 rounded-xl p-6 border border-gray-700"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Verified Contracts</h3>
          <div className="flex items-center space-x-2">
            <span className="text-xs bg-matrix-600/20 text-matrix-400 px-2 py-1 rounded">
              {verifiedContracts.length} verified
            </span>
            <button
              onClick={fetchVerifiedContracts}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Refresh contracts"
            >
              <SafeIcon icon={FiRefreshCw} />
            </button>
          </div>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {loading && verifiedContracts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <SafeIcon icon={FiRefreshCw} className="text-4xl mx-auto mb-4 animate-spin" />
              <p>Loading verified contracts...</p>
            </div>
          ) : verifiedContracts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <SafeIcon icon={FiShield} className="text-4xl mx-auto mb-4 opacity-50" />
              <p>No verified contracts yet</p>
              <p className="text-sm mt-2">Contracts are being automatically verified as they are detected</p>
            </div>
          ) : (
            <AnimatePresence>
              {verifiedContracts.map((contract) => (
                <motion.div
                  key={contract.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="p-2 rounded bg-matrix-600/20">
                        <SafeIcon icon={FiCheckCircle} className="text-matrix-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <code className="text-matrix-400 text-sm font-mono bg-matrix-900/20 px-2 py-1 rounded">
                            {contract.contract_address?.slice(0, 20)}...
                          </code>
                          <span className="text-xs px-2 py-1 rounded font-medium bg-green-600/20 text-green-400">
                            VERIFIED
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center space-x-1">
                            <span className="text-gray-400">Deployer:</span>
                            <code className="text-blue-400 font-mono">
                              {contract.deployer_address?.slice(0, 16)}...
                            </code>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-gray-400">Block:</span>
                            <span className="text-yellow-400">
                              {contract.block_number ? parseInt(contract.block_number, 16) : 'N/A'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-gray-400">Gas Used:</span>
                            <span className="text-purple-400">
                              {contract.gas_used ? parseInt(contract.gas_used, 16).toLocaleString() : 'N/A'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-gray-400">Verified:</span>
                            <span className="text-gray-500">
                              {formatDistanceToNow(new Date(contract.verified_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 ml-2">
                      <button
                        onClick={() => openContractEtherscan(contract.contract_address)}
                        className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                        title="View contract on Etherscan"
                      >
                        <SafeIcon icon={FiExternalLink} />
                      </button>
                      <button
                        onClick={() => copyToClipboard(contract.contract_address)}
                        className="p-1 text-gray-400 hover:text-white transition-colors"
                        title="Copy contract address"
                      >
                        <SafeIcon
                          icon={FiCopy}
                          className={copiedAddress === contract.contract_address ? 'text-matrix-400' : ''}
                        />
                      </button>
                      <button
                        onClick={() => handleDeleteContract(contract.contract_address)}
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                        title="Delete contract record"
                      >
                        <SafeIcon icon={FiTrash2} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ContractVerificationPanel;