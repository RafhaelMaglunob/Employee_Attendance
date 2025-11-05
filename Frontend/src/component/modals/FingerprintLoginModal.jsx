import React, { useState, useEffect } from 'react';
import { Fingerprint, CheckCircle, AlertCircle, Loader } from 'lucide-react';

const FingerprintLoginModal = ({ isOpen, onSuccess, employeeId }) => {
  const [step, setStep] = useState(1); // 1-5 for multiple scans
  const [status, setStatus] = useState('waiting'); // waiting, scanning, success, error
  const [message, setMessage] = useState('');
  const [scannedFingerprints, setScannedFingerprints] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const totalScans = 5; // Require 5 fingerprint scans like phone security

  useEffect(() => {
    if (isOpen) {
      resetState();
    }
  }, [isOpen]);

  const resetState = () => {
    setStep(1);
    setStatus('waiting');
    setMessage('');
    setScannedFingerprints([]);
    setIsProcessing(false);
  };

  const handleFingerprintScan = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    setStatus('scanning');
    setMessage('Scanning fingerprint...');

    // Simulate API call to fingerprint sensor
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Simulate success (in real implementation, check actual fingerprint match)
    const scanSuccess = Math.random() > 0.1; // 90% success rate for demo

    if (scanSuccess) {
      setScannedFingerprints([...scannedFingerprints, step]);
      setStatus('success');
      setMessage(`Scan ${step} of ${totalScans} complete!`);

      await new Promise(resolve => setTimeout(resolve, 800));

      if (step < totalScans) {
        // Move to next scan
        setStep(step + 1);
        setStatus('waiting');
        setMessage('');
      } else {
        // All scans complete - verify identity
        setMessage('Verifying identity...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Success - call onSuccess callback
        setStatus('complete');
        setMessage('Login successful!');
        await new Promise(resolve => setTimeout(resolve, 1000));
        onSuccess({ employee_id: employeeId, authenticated: true });
      }
    } else {
      setStatus('error');
      setMessage('Fingerprint not recognized. Please try again.');
      await new Promise(resolve => setTimeout(resolve, 2000));
      setStatus('waiting');
      setMessage('');
    }

    setIsProcessing(false);
  };

  if (!isOpen) return null;

  const progressPercentage = (scannedFingerprints.length / totalScans) * 100;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white text-center">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Fingerprint className="w-12 h-12" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2">Secure Login</h2>
          <p className="text-blue-100 text-sm">
            Complete {totalScans} fingerprint scans to verify your identity
          </p>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                Scan Progress
              </span>
              <span className="text-sm font-bold text-blue-600">
                {scannedFingerprints.length} / {totalScans}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Scan Indicators */}
          <div className="flex justify-center gap-3 mb-8">
            {Array.from({ length: totalScans }).map((_, index) => {
              const scanNumber = index + 1;
              const isCompleted = scannedFingerprints.includes(scanNumber);
              const isCurrent = scanNumber === step;
              
              return (
                <div
                  key={index}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCompleted
                      ? 'bg-green-500 scale-110'
                      : isCurrent
                      ? 'bg-blue-500 scale-125 ring-4 ring-blue-200 animate-pulse'
                      : 'bg-gray-200'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-6 h-6 text-white" />
                  ) : (
                    <Fingerprint
                      className={`w-6 h-6 ${isCurrent ? 'text-white' : 'text-gray-400'}`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Status Display */}
          <div className="text-center mb-8">
            {status === 'waiting' && (
              <div className="space-y-3">
                <div className="w-32 h-32 mx-auto bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                  <Fingerprint className="w-16 h-16 text-blue-600" />
                </div>
                <p className="text-gray-700 font-medium">
                  Place your finger on the sensor
                </p>
                <p className="text-sm text-gray-500">
                  Scan {step} of {totalScans}
                </p>
              </div>
            )}

            {status === 'scanning' && (
              <div className="space-y-3">
                <div className="w-32 h-32 mx-auto bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center animate-pulse">
                  <Loader className="w-16 h-16 text-white animate-spin" />
                </div>
                <p className="text-blue-600 font-medium animate-pulse">
                  {message}
                </p>
              </div>
            )}

            {status === 'success' && (
              <div className="space-y-3">
                <div className="w-32 h-32 mx-auto bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-16 h-16 text-white" />
                </div>
                <p className="text-green-600 font-medium">{message}</p>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-3">
                <div className="w-32 h-32 mx-auto bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-16 h-16 text-white" />
                </div>
                <p className="text-red-600 font-medium">{message}</p>
              </div>
            )}

            {status === 'complete' && (
              <div className="space-y-3">
                <div className="w-32 h-32 mx-auto bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-20 h-20 text-white" />
                </div>
                <p className="text-green-600 font-bold text-lg">{message}</p>
                <p className="text-sm text-gray-600">Redirecting to dashboard...</p>
              </div>
            )}
          </div>

          {/* Action Button */}
          {status === 'waiting' && (
            <button
              onClick={handleFingerprintScan}
              disabled={isProcessing}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              Scan Fingerprint
            </button>
          )}

          {/* Security Notice */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-blue-900 mb-1">Enhanced Security</p>
                <p className="text-xs text-blue-700">
                  Multiple scans ensure accurate identification and prevent unauthorized access
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FingerprintLoginModal;