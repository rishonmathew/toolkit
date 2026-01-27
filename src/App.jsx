import React, { useState, useRef } from 'react';
import { Upload, FileText, Scissors, RotateCw, Download, Plus, Trash2, Image as ImageIcon, FileImage, Maximize2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('merge');
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const tabs = [
    { id: 'merge', name: 'Merge PDFs', icon: Plus },
    { id: 'split', name: 'Split PDF', icon: Scissors },
    { id: 'rotate', name: 'Rotate Pages', icon: RotateCw },
    { id: 'image-to-pdf', name: 'Images to PDF', icon: ImageIcon },
    { id: 'pdf-to-images', name: 'PDF to Images', icon: FileImage },
    { id: 'compress', name: 'Compress PDF', icon: Maximize2 },
  ];

  const loadPdfLib = async () => {
    if (window.PDFLib) return window.PDFLib;
    
    const script = document.createElement('script');
    // Updated to version 1.17.1 which supports ignoreEncryption
    script.src = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
    document.head.appendChild(script);
    
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
    });
    
    return window.PDFLib;
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFileInput = (e) => {
    const selectedFiles = Array.from(e.target.files);
    handleFiles(selectedFiles);
  };

  const handleFiles = (newFiles) => {
    const validFiles = newFiles.filter(file => {
      if (activeTab === 'image-to-pdf') {
        return file.type.startsWith('image/');
      }
      return file.type === 'application/pdf';
    });
    
    setFiles(prev => [...prev, ...validFiles.map((file, idx) => ({
      file,
      id: Date.now() + idx,
      name: file.name,
      rotation: 0
    }))]);
  };

  const removeFile = (id) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const rotateFile = (id) => {
    setFiles(files.map(f => 
      f.id === id ? { ...f, rotation: (f.rotation + 90) % 360 } : f
    ));
  };

  const moveFile = (id, direction) => {
    const index = files.findIndex(f => f.id === id);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= files.length) return;
    
    const newFiles = [...files];
    [newFiles[index], newFiles[newIndex]] = [newFiles[newIndex], newFiles[index]];
    setFiles(newFiles);
  };

  const mergePDFs = async () => {
    setProcessing(true);
    try {
      const PDFLib = await loadPdfLib();
      const { PDFDocument } = PDFLib;
      
      const mergedPdf = await PDFDocument.create();
      
      for (const fileObj of files) {
        try {
          const arrayBuffer = await fileObj.file.arrayBuffer();
          
          // Try loading with ignoreEncryption first
          let pdf;
          try {
            pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
          } catch (encError) {
            // If that fails, try without the option
            console.log('Trying alternative load method for:', fileObj.name);
            pdf = await PDFDocument.load(arrayBuffer);
          }
          
          const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          copiedPages.forEach(page => mergedPdf.addPage(page));
        } catch (fileError) {
          alert(`Error processing ${fileObj.name}: ${fileError.message}\n\nThis file might be password-protected. Please try removing the password first.`);
          setProcessing(false);
          return;
        }
      }
      
      const pdfBytes = await mergedPdf.save();
      downloadFile(pdfBytes, 'merged.pdf', 'application/pdf');
      alert('PDFs merged successfully! ✅');
    } catch (error) {
      alert('Error merging PDFs: ' + error.message);
    }
    setProcessing(false);
  };

  const splitPDF = async () => {
    setProcessing(true);
    try {
      const PDFLib = await loadPdfLib();
      const { PDFDocument } = PDFLib;
      
      if (files.length === 0) {
        alert('Please upload a PDF file');
        setProcessing(false);
        return;
      }
      
      const arrayBuffer = await files[0].file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const pageCount = pdf.getPageCount();
      
      for (let i = 0; i < pageCount; i++) {
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(pdf, [i]);
        newPdf.addPage(copiedPage);
        
        const pdfBytes = await newPdf.save();
        downloadFile(pdfBytes, `page_${i + 1}.pdf`, 'application/pdf');
      }
    } catch (error) {
      alert('Error splitting PDF: ' + error.message);
    }
    setProcessing(false);
  };

  const rotatePDF = async () => {
    setProcessing(true);
    try {
      const PDFLib = await loadPdfLib();
      const { PDFDocument, degrees } = PDFLib;
      
      if (files.length === 0) {
        alert('Please upload a PDF file');
        setProcessing(false);
        return;
      }
      
      const arrayBuffer = await files[0].file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const pages = pdf.getPages();
      
      pages.forEach(page => {
        page.setRotation(degrees(files[0].rotation));
      });
      
      const pdfBytes = await pdf.save();
      downloadFile(pdfBytes, 'rotated.pdf', 'application/pdf');
    } catch (error) {
      alert('Error rotating PDF: ' + error.message);
    }
    setProcessing(false);
  };

  const imagesToPDF = async () => {
    setProcessing(true);
    try {
      const PDFLib = await loadPdfLib();
      const { PDFDocument } = PDFLib;
      
      const pdfDoc = await PDFDocument.create();
      
      for (const fileObj of files) {
        const arrayBuffer = await fileObj.file.arrayBuffer();
        let image;
        
        if (fileObj.file.type === 'image/png') {
          image = await pdfDoc.embedPng(arrayBuffer);
        } else if (fileObj.file.type === 'image/jpeg' || fileObj.file.type === 'image/jpg') {
          image = await pdfDoc.embedJpg(arrayBuffer);
        } else {
          continue;
        }
        
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });
      }
      
      const pdfBytes = await pdfDoc.save();
      downloadFile(pdfBytes, 'images.pdf', 'application/pdf');
    } catch (error) {
      alert('Error converting images to PDF: ' + error.message);
    }
    setProcessing(false);
  };

  const pdfToImages = async () => {
    setProcessing(true);
    try {
      if (files.length === 0) {
        alert('Please upload a PDF file');
        setProcessing(false);
        return;
      }

      // Load PDF.js
      if (!window.pdfjsLib) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        document.head.appendChild(script);
        await new Promise(resolve => script.onload = resolve);
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }

      const arrayBuffer = await files[0].file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({ canvasContext: context, viewport }).promise;
        
        canvas.toBlob(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `page_${i}.png`;
          a.click();
          URL.revokeObjectURL(url);
        });
      }
    } catch (error) {
      alert('Error converting PDF to images: ' + error.message);
    }
    setProcessing(false);
  };

  const compressPDF = async () => {
    setProcessing(true);
    try {
      const PDFLib = await loadPdfLib();
      const { PDFDocument } = PDFLib;
      
      if (files.length === 0) {
        alert('Please upload a PDF file');
        setProcessing(false);
        return;
      }
      
      const arrayBuffer = await files[0].file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      
      const pdfBytes = await pdf.save({
        useObjectStreams: false,
      });
      
      downloadFile(pdfBytes, 'compressed.pdf', 'application/pdf');
      
      const originalSize = files[0].file.size;
      const compressedSize = pdfBytes.length;
      const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(1);
      
      alert(`PDF compressed!\nOriginal: ${(originalSize / 1024).toFixed(1)} KB\nCompressed: ${(compressedSize / 1024).toFixed(1)} KB\nReduction: ${reduction}%`);
    } catch (error) {
      alert('Error compressing PDF: ' + error.message);
    }
    setProcessing(false);
  };

  const downloadFile = (data, filename, type) => {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const processFiles = () => {
    switch (activeTab) {
      case 'merge':
        mergePDFs();
        break;
      case 'split':
        splitPDF();
        break;
      case 'rotate':
        rotatePDF();
        break;
      case 'image-to-pdf':
        imagesToPDF();
        break;
      case 'pdf-to-images':
        pdfToImages();
        break;
      case 'compress':
        compressPDF();
        break;
      default:
        break;
    }
  };

  const getInstructions = () => {
    const instructions = {
      merge: 'Upload multiple PDF files and merge them into a single document.',
      split: 'Upload a PDF file to split it into individual pages.',
      rotate: 'Upload a PDF and click the rotate button to rotate all pages.',
      'image-to-pdf': 'Upload multiple images (JPG, PNG) to convert them into a single PDF.',
      'pdf-to-images': 'Upload a PDF to convert each page into separate PNG images.',
      compress: 'Upload a PDF to reduce its file size while maintaining quality.',
    };
    return instructions[activeTab] || '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6 font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@400;500;700&display=swap');
        
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        
        .animate-slide-up {
          animation: slideUp 0.5s ease-out;
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .glass {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .glow {
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.4);
        }
        
        .file-item {
          transition: all 0.3s ease;
        }
        
        .file-item:hover {
          transform: translateX(4px);
          background: rgba(255, 255, 255, 0.08);
        }
      `}</style>
      
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 animate-slide-up">
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent" style={{ fontFamily: 'Syne, sans-serif' }}>
             Toolkit
          </h1>
          <p className="text-purple-200 text-lg">
            Im not paying for Adobe Acrobat.
          </p>
        </div>

        {/* Tabs */}
        <div className="glass rounded-2xl p-2 mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setFiles([]);
                  }}
                  className={`p-4 rounded-xl transition-all duration-300 flex flex-col items-center gap-2 ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white glow'
                      : 'text-purple-200 hover:bg-white/10'
                  }`}
                >
                  <Icon size={24} />
                  <span className="text-xs font-medium text-center">{tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="glass rounded-2xl p-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          {/* Instructions */}
          <div className="mb-6 p-4 bg-purple-500/20 border border-purple-400/30 rounded-xl">
            <p className="text-purple-100 text-sm">
              {getInstructions()}
            </p>
          </div>

          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
              dragActive
                ? 'border-purple-400 bg-purple-500/20 scale-105'
                : 'border-purple-400/50 hover:border-purple-400 hover:bg-purple-500/10'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto mb-4 text-purple-300 animate-float" size={48} />
            <p className="text-purple-200 text-lg mb-2">
              Drag & drop your {activeTab === 'image-to-pdf' ? 'images' : 'PDF files'} here
            </p>
            <p className="text-purple-300 text-sm mb-4">or</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105 glow"
            >
              Browse Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple={activeTab === 'merge' || activeTab === 'image-to-pdf'}
              accept={activeTab === 'image-to-pdf' ? 'image/*' : 'application/pdf'}
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-8">
              <h3 className="text-purple-200 font-semibold mb-4 flex items-center gap-2">
                <FileText size={20} />
                Uploaded Files ({files.length})
              </h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {files.map((fileObj, index) => (
                  <div
                    key={fileObj.id}
                    className="file-item glass rounded-xl p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <FileText className="text-purple-400" size={24} />
                      <div className="flex-1">
                        <p className="text-purple-100 font-medium truncate">{fileObj.name}</p>
                        <p className="text-purple-300 text-xs">
                          {(fileObj.file.size / 1024).toFixed(1)} KB
                          {fileObj.rotation > 0 && ` • Rotated ${fileObj.rotation}°`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeTab === 'merge' && (
                        <>
                          <button
                            onClick={() => moveFile(fileObj.id, 'up')}
                            disabled={index === 0}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30"
                            title="Move up"
                          >
                            <span className="text-purple-300">↑</span>
                          </button>
                          <button
                            onClick={() => moveFile(fileObj.id, 'down')}
                            disabled={index === files.length - 1}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30"
                            title="Move down"
                          >
                            <span className="text-purple-300">↓</span>
                          </button>
                        </>
                      )}
                      {activeTab === 'rotate' && (
                        <button
                          onClick={() => rotateFile(fileObj.id)}
                          className="p-2 hover:bg-purple-500/20 rounded-lg transition-colors text-purple-300"
                          title="Rotate 90°"
                        >
                          <RotateCw size={18} />
                        </button>
                      )}
                      <button
                        onClick={() => removeFile(fileObj.id)}
                        className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400"
                        title="Remove"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Process Button */}
          {files.length > 0 && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={processFiles}
                disabled={processing}
                className={`flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 ${
                  processing
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 hover:scale-105 glow'
                } text-white`}
              >
                <Download size={24} />
                {processing ? 'Processing...' : `Process ${activeTab === 'merge' ? 'and Merge' : ''}`}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-purple-300 text-sm">
          <p>All processing happens in your browser. Your files never leave your device.</p>
        </div>
      </div>
    </div>
  );
}