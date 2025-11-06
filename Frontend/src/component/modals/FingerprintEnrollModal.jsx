import React, { useState, useEffect } from "react";
import { X, Fingerprint, CheckCircle, AlertCircle, Hand, Loader, Scan } from "lucide-react";

function FingerprintEnrollModal({ isOpen, onSuccess, employeeId, employeeName }) {
  const [step, setStep] = useState("select");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [occupiedSlots, setOccupiedSlots] = useState([]);
  const [enrollmentStatus, setEnrollmentStatus] = useState({});
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [useDigital, setUseDigital] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [fingerprintData, setFingerprintData] = useState(null);
  const [loading, setLoading] = useState(false);

  const API_BASE = "http://192.168.1.9:3001/api";

  const getToken = () => {
    const employeeToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('employee_token='))
      ?.split('=')[1];
    
    const adminToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('admin_token='))
      ?.split('=')[1];
    
    return employeeToken || adminToken;
  };

  useEffect(() => {
    if (isOpen && step === "select") {
      fetchOccupiedSlots();
    }
  }, [isOpen, step]);

  const fetchOccupiedSlots = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/fingerprint/occupied-slots`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch slots");

      const data = await response.json();
      setOccupiedSlots(data.slots || []);
    } catch (err) {
      console.error("Error fetching slots:", err);
      setError("Failed to load available slots");
    } finally {
      setLoading(false);
    }
  };

  const generateFingerprintData = () => {
    const minutiae = [];
    const numPoints = Math.floor(Math.random() * 20) + 40;
    
    for (let i = 0; i < numPoints; i++) {
      minutiae.push({
        x: Math.floor(Math.random() * 256),
        y: Math.floor(Math.random() * 256),
        angle: Math.floor(Math.random() * 360),
        type: Math.random() > 0.5 ? 'ridge_ending' : 'bifurcation'
      });
    }

    return {
      template_id: `FP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      minutiae: minutiae,
      quality: Math.floor(Math.random() * 30) + 70,
      captured_at: new Date().toISOString(),
      scan_count: scanCount + 1
    };
  };

  const handleDigitalEnrollment = async () => {
    if (!selectedSlot) {
      setError("Please select a slot");
      return;
    }

    try {
      setStep("enrolling");
      setError(null);
      setScanCount(0);
      
      await simulateScan(1);
      await simulateScan(2);
      
      setStatusMessage("Creating fingerprint model...");
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const fingerprintModel = generateFingerprintData();
      setFingerprintData(fingerprintModel);
      
      setStatusMessage("Saving to database...");
      await saveDigitalFingerprint(fingerprintModel);
      
    } catch (err) {
      console.error("Error in digital enrollment:", err);
      setError(err.message || "Digital enrollment failed");
      setStep("error");
    }
  };

  const simulateScan = async (scanNumber) => {
    setStatusMessage(`Place your finger (Scan ${scanNumber}/2)...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setScanCount(scanNumber);
    setStatusMessage(`Scan ${scanNumber} captured!`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (scanNumber < 2) {
      setStatusMessage("Remove your finger...");
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  };

  const saveDigitalFingerprint = async (fingerprintModel) => {
    try {
      console.log("Saving digital fingerprint:", {
        employee_id: employeeId,
        slot: selectedSlot,
        has_data: !!fingerprintModel
      });

      const token = getToken();
      const response = await fetch(`${API_BASE}/fingerprint/enroll-digital`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employee_id: employeeId,
          slot: selectedSlot,
          fingerprint_data: fingerprintModel,
          enrollment_type: 'digital'
        }),
      });

      const data = await response.json();
      console.log("Server response:", data);

      if (!response.ok) {
        throw new Error(data.error || data.details || "Failed to save digital fingerprint");
      }
      
      setStep("success");
      setStatusMessage("Digital fingerprint enrolled successfully!");
      
      setTimeout(() => {
        onSuccess();
      }, 2000);
      
    } catch (err) {
      console.error("Error saving digital fingerprint:", err);
      throw new Error(err.message || "Failed to save fingerprint to database");
    }
  };

  const handleHardwareEnrollment = async () => {
    if (!selectedSlot) {
      setError("Please select a slot");
      return;
    }

    try {
      setStep("enrolling");
      setError(null);
      setStatusMessage("Initializing enrollment...");

      const token = getToken();
      const response = await fetch(`${API_BASE}/fingerprint/enroll`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employee_id: employeeId,
          slot: selectedSlot,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start enrollment");
      }

      const data = await response.json();
      console.log("Enrollment started:", data);

      startStatusPolling();
    } catch (err) {
      console.error("Error starting enrollment:", err);
      setError(err.message);
      setStep("error");
    }
  };

  const startStatusPolling = () => {
    const interval = setInterval(async () => {
      try {
        const token = getToken();
        const response = await fetch(
          `${API_BASE}/fingerprint/enroll-status?slot=${selectedSlot}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) throw new Error("Failed to get status");

        const status = await response.json();
        console.log("Enrollment status:", status);

        setEnrollmentStatus(status);

        if (status.message) {
          setStatusMessage(status.message);
        }

        if (status.status === "complete") {
          clearInterval(interval);
          setStep("success");
          setStatusMessage("Fingerprint enrolled successfully!");
          
          setTimeout(() => {
            onSuccess();
          }, 2000);
        } else if (status.status === "error") {
          clearInterval(interval);
          setStep("error");
          setError(status.message || "Enrollment failed");
        }
      } catch (err) {
        console.error("Error polling status:", err);
        clearInterval(interval);
        setStep("error");
        setError("Lost connection to enrollment service");
      }
    }, 1000);
  };

  const handleStartEnrollment = () => {
    if (useDigital) {
      handleDigitalEnrollment();
    } else {
      handleHardwareEnrollment();
    }
  };

  const generateSlots = () => {
    const slots = [];
    for (let i = 1; i <= 127; i++) {
      slots.push({
        value: i,
        label: `Slot ${i}`,
        occupied: occupiedSlots.includes(i),
      });
    }
    return slots;
  };

  const handleClose = () => {
    if (step === "enrolling") {
      if (!confirm("Enrollment is in progress. Are you sure you want to cancel?")) {
        return;
      }
    }
    setStep("select");
    setSelectedSlot(null);
    setError(null);
    setStatusMessage("");
    setScanCount(0);
    setFingerprintData(null);
    onSuccess();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 p-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="bg-white bg-opacity-20 p-2 rounded-lg">
                <Fingerprint className="w-7 h-7 text-white" />
              </div>
              Fingerprint Enrollment
            </h2>
            {step !== "enrolling" && (
              <button
                onClick={handleClose}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {step === "select" && (
            <div className="space-y-5">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-sm text-gray-500 mb-1">Employee</p>
                <p className="text-lg font-bold text-gray-800">{employeeName}</p>
                <p className="text-sm text-gray-600 font-mono">{employeeId}</p>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-4 shadow-sm">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useDigital}
                    onChange={(e) => setUseDigital(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
                        <Hand className="w-5 h-5 text-white" />
                      </div>
                      <p className="font-bold text-gray-800">Digital Simulation Mode</p>
                    </div>
                    <p className="text-sm text-gray-600">
                      Test enrollment without physical hardware sensor. Perfect for development and testing.
                    </p>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">
                  Select Fingerprint Slot
                </label>
                <select
                  value={selectedSlot || ""}
                  onChange={(e) => setSelectedSlot(parseInt(e.target.value))}
                  disabled={loading}
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-gray-800 font-medium disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Choose an available slot...</option>
                  {generateSlots().map((slot) => (
                    <option
                      key={slot.value}
                      value={slot.value}
                      disabled={slot.occupied}
                    >
                      {slot.label} {slot.occupied ? "⚠️ Occupied" : "✓ Available"}
                    </option>
                  ))}
                </select>
                {loading && (
                  <p className="text-sm text-gray-500 mt-2 flex items-center gap-2">
                    <Loader className="w-4 h-4 animate-spin" />
                    Loading available slots...
                  </p>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-300 text-red-800 px-4 py-3 rounded-lg text-sm flex items-start gap-3 shadow-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <button
                onClick={handleStartEnrollment}
                disabled={!selectedSlot || loading}
                className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105 active:scale-95 shadow-lg disabled:shadow-none disabled:transform-none"
              >
                {loading ? "Loading..." : `Start ${useDigital ? "Digital" : "Hardware"} Enrollment`}
              </button>
            </div>
          )}

          {step === "enrolling" && (
            <div className="space-y-6 text-center py-4">
              <div className="flex justify-center">
                <div className="relative">
                  {/* Animated fingerprint with pulse effect */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-40 h-40 bg-yellow-400 rounded-full opacity-20 animate-ping"></div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-36 h-36 border-8 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <div className="relative z-10 bg-gradient-to-br from-yellow-400 to-yellow-500 p-8 rounded-full shadow-2xl">
                    <Scan className="w-20 h-20 text-white animate-pulse" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-gray-800">
                  {useDigital ? "Digital" : "Hardware"} Enrollment
                </h3>
                <div className="inline-block bg-yellow-100 border border-yellow-300 rounded-full px-4 py-1">
                  <p className="text-yellow-800 font-semibold text-sm">IN PROGRESS</p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 shadow-inner">
                <p className="text-lg text-gray-700 font-medium mb-3">{statusMessage}</p>
                {scanCount > 0 && (
                  <div className="flex items-center justify-center gap-2">
                    <div className="flex gap-1">
                      {[1, 2].map((num) => (
                        <div
                          key={num}
                          className={`w-3 h-3 rounded-full transition-all ${
                            num <= scanCount ? 'bg-green-500 scale-110' : 'bg-gray-300'
                          }`}
                        ></div>
                      ))}
                    </div>
                    <p className="text-sm text-gray-600 font-semibold ml-2">
                      Scan {scanCount}/2 completed
                    </p>
                  </div>
                )}
              </div>

              <div className={`border-2 rounded-xl px-5 py-4 text-left shadow-sm ${
                useDigital 
                  ? 'bg-gradient-to-br from-purple-50 to-blue-50 border-purple-300' 
                  : 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-300'
              }`}>
                <p className={`font-bold mb-3 flex items-center gap-2 ${
                  useDigital ? 'text-purple-700' : 'text-blue-700'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    useDigital ? 'bg-purple-600' : 'bg-blue-600'
                  } animate-pulse`}></div>
                  {useDigital ? "Digital Mode Instructions:" : "Hardware Mode Instructions:"}
                </p>
                <ul className={`space-y-2 text-sm ${
                  useDigital ? 'text-purple-700' : 'text-blue-700'
                }`}>
                  {useDigital ? (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="font-bold">•</span>
                        <span>Simulating fingerprint capture</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold">•</span>
                        <span>Generating digital template model</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold">•</span>
                        <span>Data stored for later hardware sync</span>
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="font-bold">•</span>
                        <span>Place finger firmly on the sensor</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold">•</span>
                        <span>Keep finger still during each scan</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold">•</span>
                        <span>Two scans required for accuracy</span>
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="space-y-5 text-center py-4">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-green-400 rounded-full opacity-20 animate-ping"></div>
                  <div className="relative bg-gradient-to-br from-green-400 to-green-500 p-8 rounded-full shadow-2xl">
                    <CheckCircle className="w-20 h-20 text-white" />
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-green-700 mb-2">
                  Enrollment Successful!
                </h3>
                <p className="text-gray-600">{statusMessage}</p>
              </div>
              {fingerprintData && useDigital && (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl text-left text-sm space-y-2 shadow-inner border border-gray-200">
                  <p className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <Fingerprint className="w-4 h-4" />
                    Digital Fingerprint Data:
                  </p>
                  <div className="space-y-1 text-gray-600 font-mono text-xs">
                    <p className="flex justify-between">
                      <span className="font-semibold">Template ID:</span>
                      <span className="text-gray-500">{fingerprintData.template_id}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="font-semibold">Quality Score:</span>
                      <span className="text-green-600 font-bold">{fingerprintData.quality}%</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="font-semibold">Minutiae Points:</span>
                      <span className="text-blue-600 font-bold">{fingerprintData.minutiae.length}</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "error" && (
            <div className="space-y-5 text-center py-4">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-red-400 rounded-full opacity-20 animate-ping"></div>
                  <div className="relative bg-gradient-to-br from-red-400 to-red-500 p-8 rounded-full shadow-2xl">
                    <AlertCircle className="w-20 h-20 text-white" />
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-red-700 mb-2">
                  Enrollment Failed
                </h3>
                <p className="text-gray-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                  {error}
                </p>
              </div>
              <button
                onClick={() => {
                  setStep("select");
                  setError(null);
                  setSelectedSlot(null);
                  setScanCount(0);
                  setFingerprintData(null);
                  fetchOccupiedSlots();
                }}
                className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105 active:scale-95 shadow-lg"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FingerprintEnrollModal;