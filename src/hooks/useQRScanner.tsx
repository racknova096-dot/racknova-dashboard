import { useState, useRef, useCallback } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats, Html5QrcodeResult } from 'html5-qrcode';

interface UseQRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (error: string) => void;
}

export function useQRScanner({ onScanSuccess, onScanError }: UseQRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const startScanning = useCallback(() => {
    // Check if we're on a mobile device or have camera access
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasCamera(false);
      onScanError?.("Escaneo QR disponible solo en dispositivos con cámara");
      return;
    }

    setIsScanning(true);

    // Create scanner configuration
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    };

    // Create scanner instance
    scannerRef.current = new Html5QrcodeScanner(
      "qr-reader",
      config,
      false
    );

    // Success callback
    const qrCodeSuccessCallback = (decodedText: string, result: Html5QrcodeResult) => {
      stopScanning();
      onScanSuccess(decodedText);
    };

    // Error callback
    const qrCodeErrorCallback = (errorMessage: string) => {
      // Ignore common scanning errors to avoid spam
      if (!errorMessage.includes("No QR code found")) {
        console.warn("QR scan error:", errorMessage);
      }
    };

    // Start scanning
    scannerRef.current.render(qrCodeSuccessCallback, qrCodeErrorCallback);
  }, [onScanSuccess, onScanError]);

  const stopScanning = useCallback(() => {
    if (scannerRef.current) {
      try {
        scannerRef.current.clear();
      } catch (error) {
        console.warn("Error clearing scanner:", error);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  }, []);

  return {
    isScanning,
    hasCamera,
    startScanning,
    stopScanning,
  };
}