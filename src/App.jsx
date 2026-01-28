import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Scissors, RotateCw, Download, Plus, Trash2, Image as ImageIcon, FileImage, Maximize2, Edit3 } from 'lucide-react';

// PDF Toolkit - My web dev project
// Uses React for the UI and pdf-lib for PDF stuff
function App() {
  // Using React hooks for state management
  const [activeTab, setActiveTab] = useState('merge'); // which tool is active
  const [files, setFiles] = useState([]); // uploaded files
  const [processing, setProcessing] = useState(false); 
  const [dragActive, setDragActive] = useState(false); // for drag and drop
  const fileInputRef = useRef(null); // hidden file input reference
  
  // PDF editing states - learned these from React tutorial
  const [pdfPages, setPdfPages] = useState([]); // holds all the PDF pages
  const [currentPage, setCurrentPage] = useState(0); // which page we're on
  const [annotations, setAnnotations] = useState([]); // all the stuff user added
  const [editMode, setEditMode] = useState('select'); // what tool they're using - start with select
  const [fontSize, setFontSize] = useState(12); // text size
  const [textColor, setTextColor] = useState('#000000'); // text color
  const [activeTextInput, setActiveTextInput] = useState(null); // for typing text
  const [selectedAnnotation, setSelectedAnnotation] = useState(null); // which one is selected
  const [isDragging, setIsDragging] = useState(false); // are we dragging?
  const [isResizing, setIsResizing] = useState(false); // are we resizing?
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 }); // where drag started
  const canvasRef = useRef(null); // for signatures

  // Array of available tools/tabs
  const tabs = [
    { id: 'merge', name: 'Merge PDFs', icon: Plus },
    { id: 'split', name: 'Split PDF', icon: Scissors },
    { id: 'rotate', name: 'Rotate Pages', icon: RotateCw },
    { id: 'edit-sign', name: 'Edit & Sign', icon: Edit3 },
    { id: 'image-to-pdf', name: 'Images to PDF', icon: ImageIcon },
    { id: 'pdf-to-images', name: 'PDF to Images', icon: FileImage },
    { id: 'compress', name: 'Compress PDF', icon: Maximize2 },
  ];

  // This handles moving and resizing when user drags mouse
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      // If we're dragging something
      if (isDragging && selectedAnnotation) {
        const annotation = annotations.find(ann => ann.id === selectedAnnotation);
        if (annotation) {
          const container = document.querySelector('[data-pdf-container="true"]');
          if (container) {
            const rect = container.getBoundingClientRect();
            const newX = e.clientX - rect.left - dragStart.x;
            const newY = e.clientY - rect.top - dragStart.y;
            
            // Move the annotation to new position
            updateAnnotationPosition(selectedAnnotation, newX - annotation.x, newY - annotation.y);
          }
        }
      } 
      // If we're resizing something
      else if (isResizing && selectedAnnotation) {
        const annotation = annotations.find(ann => ann.id === selectedAnnotation);
        if (annotation) {
          if (annotation.type === 'signature') {
            // Resize signature image
            const deltaX = e.clientX - dragStart.x;
            const deltaY = e.clientY - dragStart.y;
            const newWidth = dragStart.width + deltaX;
            const newHeight = dragStart.height + deltaY;
            updateAnnotationSize(selectedAnnotation, newWidth, newHeight, 1);
          } else if (annotation.type === 'text') {
            // Resize text font
            const deltaX = e.clientX - dragStart.x;
            const scaleFactor = 1 + (deltaX / 100);
            
            // Don't let it get too big or small
            if (scaleFactor > 0.3 && scaleFactor < 5) {
              const newFontSize = Math.round(dragStart.fontSize * scaleFactor);
              
              // Update the font size (keep it between 8 and 72)
              setAnnotations(annotations.map(ann => 
                ann.id === selectedAnnotation ? { ...ann, fontSize: Math.max(8, Math.min(72, newFontSize)) } : ann
              ));
            }
          }
        }
      }
    };

    // When mouse is released, stop dragging/resizing
    const handleGlobalMouseUp = () => {
      if (isDragging || isResizing) {
        console.log('Stopped dragging/resizing'); // for debugging
        setIsDragging(false);
        setIsResizing(false);
      }
    };

    // Add event listeners if we're dragging or resizing
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    // Clean up - remove event listeners when done
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, isResizing, selectedAnnotation, annotations, dragStart]);

  // Function to dynamically load the PDF library
  // This loads the library only when needed (lazy loading)
  const loadPdfLib = async () => {
    if (window.PDFLib) return window.PDFLib; // check if already loaded
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
    document.head.appendChild(script);
    
    // Wait for the script to load
    return new Promise((resolve, reject) => {
      script.onload = () => resolve(window.PDFLib);
      script.onerror = reject;
    });
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true); // show visual feedback
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

  // Process uploaded files and add them to state
  const handleFiles = (newFiles) => {
    // If we're editing a PDF and user tries to upload new one, warn them!
    if (activeTab === 'edit-sign' && pdfPages.length > 0 && annotations.length > 0) {
      const confirmMessage = `⚠️ Warning: You have ${annotations.length} unsaved annotation${annotations.length !== 1 ? 's' : ''}.\n\nUploading a new PDF will clear all your current work.\n\nAre you sure you want to continue?`;
      const userConfirmed = window.confirm(confirmMessage);
      
      if (!userConfirmed) {
        // User clicked cancel, don't upload new file
        console.log('User cancelled file upload'); // debug
        return;
      }
      
      // User clicked OK, clear everything
      console.log('Clearing PDF and annotations for new upload'); // debug
      setPdfPages([]);
      setAnnotations([]);
      setSelectedAnnotation(null);
    }
    
    // Figure out what kind of files we accept
    const validFiles = newFiles.filter(file => {
      if (activeTab === 'image-to-pdf') {
        return file.type.startsWith('image/');
      }
      return file.type === 'application/pdf';
    });
    
    // Add files to state with unique IDs
    setFiles(prev => [...prev, ...validFiles.map((file, idx) => ({
      file: file,
      id: Date.now() + idx, // simple unique ID
      name: file.name,
      rotation: 0 // for rotate functionality
    }))]);
  };

  // Remove a file from the list
  const removeFile = (id) => {
    setFiles(files.filter(f => f.id !== id));
  };

  // Rotate a file by 90 degrees
  const rotateFile = (id) => {
    setFiles(files.map(f => 
      f.id === id ? { ...f, rotation: (f.rotation + 90) % 360 } : f
    ));
  };

  // Move files up or down in the list (for controlling merge order)
  const moveFile = (id, direction) => {
    const index = files.findIndex(f => f.id === id);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= files.length) return;
    
    // Swap the files
    const newFiles = [...files];
    [newFiles[index], newFiles[newIndex]] = [newFiles[newIndex], newFiles[index]];
    setFiles(newFiles);
  };

  // MERGE PDFS FUNCTION
  // Combines multiple PDFs into one
  const mergePDFs = async () => {
    setProcessing(true);
    console.log('Starting PDF merge...');
    
    try {
      const PDFLib = await loadPdfLib();
      const { PDFDocument } = PDFLib;
      
      // Create new PDF document
      const mergedPdf = await PDFDocument.create();
      
      // Loop through each file and copy its pages
      for (const fileObj of files) {
        try {
          const arrayBuffer = await fileObj.file.arrayBuffer();
          
          // Try loading with encryption handling
          let pdf;
          try {
            pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
          } catch (encError) {
            console.log('Trying alternative load for:', fileObj.name);
            pdf = await PDFDocument.load(arrayBuffer);
          }
          
          // Copy all pages from this PDF
          const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          copiedPages.forEach(page => mergedPdf.addPage(page));
          console.log('Added pages from:', fileObj.name);
          
        } catch (fileError) {
          alert(`Error with ${fileObj.name}: ${fileError.message}\n\nIf password-protected, remove password first.`);
          setProcessing(false);
          return;
        }
      }
      
      // Save and download the merged PDF
      const pdfBytes = await mergedPdf.save();
      downloadFile(pdfBytes, 'merged.pdf', 'application/pdf');
      console.log('Merge complete!');
      alert('PDFs merged successfully!');
      
    } catch (error) {
      console.error('Merge error:', error);
      alert('Error merging PDFs: ' + error.message);
    }
    
    setProcessing(false);
  };

  // SPLIT PDF FUNCTION
  // Splits a PDF into individual pages
  const splitPDF = async () => {
    setProcessing(true);
    console.log('Starting PDF split...');
    
    try {
      const PDFLib = await loadPdfLib();
      const { PDFDocument } = PDFLib;
      
      if (files.length === 0) {
        alert('Please upload a PDF file first!');
        setProcessing(false);
        return;
      }
      
      // Load the PDF
      const arrayBuffer = await files[0].file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const pageCount = pdf.getPageCount();
      
      console.log(`Splitting ${pageCount} pages...`);
      
      // Create a separate PDF for each page
      for (let i = 0; i < pageCount; i++) {
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(pdf, [i]);
        newPdf.addPage(copiedPage);
        
        const pdfBytes = await newPdf.save();
        downloadFile(pdfBytes, `page_${i + 1}.pdf`, 'application/pdf');
      }
      
      console.log('Split complete!');
      alert(`Split into ${pageCount} pages!`);
      
    } catch (error) {
      console.error('Split error:', error);
      alert('Error splitting PDF: ' + error.message);
    }
    
    setProcessing(false);
  };

  // ROTATE PDF FUNCTION
  // Rotates all pages in a PDF
  const rotatePDF = async () => {
    setProcessing(true);
    console.log('Rotating PDF...');
    
    try {
      const PDFLib = await loadPdfLib();
      const { PDFDocument, degrees } = PDFLib;
      
      if (files.length === 0) {
        alert('Please upload a PDF file first!');
        setProcessing(false);
        return;
      }
      
      // Load PDF and get pages
      const arrayBuffer = await files[0].file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const pages = pdf.getPages();
      
      // Apply rotation to each page
      pages.forEach(page => {
        page.setRotation(degrees(files[0].rotation));
      });
      
      const pdfBytes = await pdf.save();
      downloadFile(pdfBytes, 'rotated.pdf', 'application/pdf');
      console.log('Rotation complete!');
      
    } catch (error) {
      console.error('Rotation error:', error);
      alert('Error rotating PDF: ' + error.message);
    }
    
    setProcessing(false);
  };

  // IMAGES TO PDF FUNCTION
  // Converts image files to a PDF
  const imagesToPDF = async () => {
    setProcessing(true);
    console.log('Converting images to PDF...');
    
    try {
      const PDFLib = await loadPdfLib();
      const { PDFDocument } = PDFLib;
      
      const pdfDoc = await PDFDocument.create();
      
      // Process each image file
      for (const fileObj of files) {
        const arrayBuffer = await fileObj.file.arrayBuffer();
        let image;
        
        // Embed image based on type
        if (fileObj.file.type === 'image/png') {
          image = await pdfDoc.embedPng(arrayBuffer);
        } else if (fileObj.file.type === 'image/jpeg' || fileObj.file.type === 'image/jpg') {
          image = await pdfDoc.embedJpg(arrayBuffer);
        } else {
          console.log('Skipping unsupported image:', fileObj.name);
          continue;
        }
        
        // Create page sized to image
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });
        console.log('Added image:', fileObj.name);
      }
      
      const pdfBytes = await pdfDoc.save();
      downloadFile(pdfBytes, 'images.pdf', 'application/pdf');
      console.log('Conversion complete!');
      
    } catch (error) {
      console.error('Image conversion error:', error);
      alert('Error converting images: ' + error.message);
    }
    
    setProcessing(false);
  };

  // PDF TO IMAGES FUNCTION
  // Extracts each page of a PDF as an image
  const pdfToImages = async () => {
    setProcessing(true);
    console.log('Converting PDF to images...');
    
    try {
      if (files.length === 0) {
        alert('Please upload a PDF file first!');
        setProcessing(false);
        return;
      }

      // Load PDF.js library for rendering
      if (!window.pdfjsLib) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        document.head.appendChild(script);
        await new Promise(resolve => script.onload = resolve);
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }

      const arrayBuffer = await files[0].file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      console.log(`Converting ${pdf.numPages} pages...`);
      
      // Render each page to a canvas and download
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 }); // 2x scale for better quality
        
        // Create canvas element
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        // Render PDF page to canvas
        await page.render({ canvasContext: context, viewport }).promise;
        
        // Convert canvas to blob and download
        canvas.toBlob(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `page_${i}.png`;
          a.click();
          URL.revokeObjectURL(url);
        });
      }
      
      console.log('Conversion complete!');
      alert('Images downloaded!');
      
    } catch (error) {
      console.error('PDF to image error:', error);
      alert('Error converting PDF: ' + error.message);
    }
    
    setProcessing(false);
  };

  // COMPRESS PDF FUNCTION
  // Reduces PDF file size
  const compressPDF = async () => {
    setProcessing(true);
    console.log('Compressing PDF...');
    
    try {
      const PDFLib = await loadPdfLib();
      const { PDFDocument } = PDFLib;
      
      if (files.length === 0) {
        alert('Please upload a PDF file first!');
        setProcessing(false);
        return;
      }
      
      const arrayBuffer = await files[0].file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      
      // Save with compression options
      const pdfBytes = await pdf.save({
        useObjectStreams: false,
      });
      
      downloadFile(pdfBytes, 'compressed.pdf', 'application/pdf');
      
      // Calculate and show compression results
      const originalSize = files[0].file.size;
      const compressedSize = pdfBytes.length;
      const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(1);
      
      console.log(`Original: ${originalSize} bytes, Compressed: ${compressedSize} bytes`);
      alert(`PDF compressed!\nOriginal: ${(originalSize / 1024).toFixed(1)} KB\nCompressed: ${(compressedSize / 1024).toFixed(1)} KB\nReduction: ${reduction}%`);
      
    } catch (error) {
      console.error('Compression error:', error);
      alert('Error compressing PDF: ' + error.message);
    }
    
    setProcessing(false);
  };

  // EDIT & SIGN PDF FUNCTIONS
  // Load PDF so we can edit it
  const loadPDFForEditing = async () => {
    if (files.length === 0) {
      alert('Please upload a PDF file first!');
      return;
    }

    setProcessing(true);
    console.log('Loading PDF for editing...'); // debug

    try {
      // Load PDF.js library (needed to render PDFs as images)
      if (!window.pdfjsLib) {
        console.log('Loading PDF.js library...'); // debug
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        document.head.appendChild(script);
        await new Promise(resolve => script.onload = resolve);
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }

      const arrayBuffer = await files[0].file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      console.log(`PDF has ${pdf.numPages} pages`); // debug
      
      // Render each page to a canvas
      // This took me a while to figure out!
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 }); // 1.5x scale looks good
        
        // Create canvas and draw PDF page on it
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({ canvasContext: context, viewport }).promise;
        
        // Save the canvas for this page
        pages.push({
          canvas: canvas,
          width: viewport.width,
          height: viewport.height,
          pageNumber: i
        });
        
        console.log(`Rendered page ${i}`); // debug
      }
      
      setPdfPages(pages);
      setCurrentPage(0);
      setAnnotations([]);
      console.log('Done loading PDF!'); // debug
      
    } catch (error) {
      console.error('Error loading PDF:', error);
      alert('Error loading PDF: ' + error.message);
    }
    
    setProcessing(false);
  };

  // Add text annotation
  const addTextAnnotation = (x, y, text) => {
    if (!text || text.trim() === '') return;
    
    setAnnotations([...annotations, {
      type: 'text',
      page: currentPage,
      x: x,
      y: y,
      text: text,
      fontSize: fontSize,
      color: textColor,
      id: Date.now()
    }]);
    setActiveTextInput(null); // close the input
  };

  // Undo the last thing they added - removes from end of array
  const undoLastAnnotation = () => {
    if (annotations.length > 0) {
      console.log('Undoing last annotation'); // debug
      setAnnotations(annotations.slice(0, -1));
      setSelectedAnnotation(null);
    }
  };

  // When they click on something to select it
  const selectAnnotation = (id) => {
    console.log('Selected annotation:', id); // debug
    setSelectedAnnotation(id);
  };

  // Move an annotation to a new position
  const updateAnnotationPosition = (id, deltaX, deltaY) => {
    // Loop through annotations and update the one that matches
    setAnnotations(annotations.map(ann => {
      if (ann.id === id) {
        return { ...ann, x: ann.x + deltaX, y: ann.y + deltaY };
      }
      return ann;
    }));
  };

  // Resize an annotation (text or signature)
  const updateAnnotationSize = (id, newWidth, newHeight, scaleFactor) => {
    setAnnotations(annotations.map(ann => {
      if (ann.id === id) {
        if (ann.type === 'text') {
          // For text, we change the font size not the width/height
          const newSize = Math.max(8, Math.round(ann.fontSize * scaleFactor));
          return { ...ann, fontSize: newSize };
        } else if (ann.type === 'signature') {
          // For signatures, we change the image size
          return { 
            ...ann, 
            width: Math.max(50, newWidth), 
            height: Math.max(20, newHeight) 
          };
        }
      }
      return ann;
    }));
  };

  // Delete the currently selected annotation
  const deleteSelectedAnnotation = () => {
    if (selectedAnnotation) {
      console.log('Deleting annotation:', selectedAnnotation); // debug
      setAnnotations(annotations.filter(ann => ann.id !== selectedAnnotation));
      setSelectedAnnotation(null);
    }
  };

  // Add checkbox annotation
  const addCheckbox = (x, y, checked = true) => {
    setAnnotations([...annotations, {
      type: 'checkbox',
      page: currentPage,
      x: x,
      y: y,
      checked: checked,
      id: Date.now()
    }]);
  };

  // Add signature annotation
  const addSignature = (signatureDataUrl) => {
    if (!signatureDataUrl) return;
    
    setAnnotations([...annotations, {
      type: 'signature',
      page: currentPage,
      x: 100, // Default position
      y: 100,
      dataUrl: signatureDataUrl,
      width: 200,
      height: 50,
      id: Date.now()
    }]);
  };

  // Save edited PDF
  const saveEditedPDF = async () => {
    setProcessing(true);
    console.log('Saving edited PDF...');

    try {
      const PDFLib = await loadPdfLib();
      const { PDFDocument, rgb } = PDFLib;
      
      // Load original PDF
      const arrayBuffer = await files[0].file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const pages = pdfDoc.getPages();
      
      // Add annotations to PDF
      for (const annotation of annotations) {
        const page = pages[annotation.page];
        const { height } = page.getSize();
        
        // Convert coordinates (canvas to PDF coordinate system)
        const pdfY = height - annotation.y;
        
        if (annotation.type === 'text') {
          // Convert hex color to RGB for pdf-lib
          // Found this regex on Stack Overflow - it works!
          const hex = annotation.color || '#000000';
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          let r = 0, g = 0, b = 0;
          if (result) {
            r = parseInt(result[1], 16) / 255;
            g = parseInt(result[2], 16) / 255;
            b = parseInt(result[3], 16) / 255;
          }
          
          page.drawText(annotation.text, {
            x: annotation.x,
            y: pdfY,
            size: annotation.fontSize,
            color: rgb(r, g, b),
          });
        } else if (annotation.type === 'checkbox') {
          // Draw checkbox
          const size = 15;
          page.drawRectangle({
            x: annotation.x,
            y: pdfY - size,
            width: size,
            height: size,
            borderColor: rgb(0, 0, 0),
            borderWidth: 1.5,
          });
          
          if (annotation.checked) {
            // Draw checkmark
            page.drawText('✓', {
              x: annotation.x + 2,
              y: pdfY - size + 2,
              size: 12,
              color: rgb(0, 0, 0),
            });
          }
        } else if (annotation.type === 'signature') {
          // Convert signature data URL to image and embed
          try {
            const imageBytes = await fetch(annotation.dataUrl).then(res => res.arrayBuffer());
            const image = await pdfDoc.embedPng(imageBytes);
            
            page.drawImage(image, {
              x: annotation.x,
              y: pdfY - annotation.height,
              width: annotation.width,
              height: annotation.height,
            });
          } catch (err) {
            console.log('Error embedding signature:', err);
          }
        }
      }
      
      const pdfBytes = await pdfDoc.save();
      downloadFile(pdfBytes, 'edited-signed.pdf', 'application/pdf');
      console.log('PDF saved with annotations!');
      alert('PDF saved successfully!');
      
    } catch (error) {
      console.error('Error saving PDF:', error);
      alert('Error saving PDF: ' + error.message);
    }
    
    setProcessing(false);
  };

  // Helper function to download files
  const downloadFile = (data, filename, type) => {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url); // clean up
  };

  // Main function to process files based on selected tab
  const processFiles = () => {
    if (files.length === 0) {
      alert('Please add some files first!');
      return;
    }
    
    // Call appropriate function based on active tab
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
      case 'edit-sign':
        if (pdfPages.length === 0) {
          loadPDFForEditing();
        } else {
          saveEditedPDF();
        }
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
        console.log('Unknown tab:', activeTab);
        break;
    }
  };

  // Get instructions for the current tab
  const getInstructions = () => {
    const instructions = {
      merge: 'Upload multiple PDF files and merge them into a single document.',
      split: 'Upload a PDF file to split it into individual pages.',
      rotate: 'Upload a PDF and click the rotate button to rotate all pages.',
      'edit-sign': 'Upload a PDF to fill in forms, add text, checkmarks, and signatures.',
      'image-to-pdf': 'Upload multiple images (JPG, PNG) to convert them into a single PDF.',
      'pdf-to-images': 'Upload a PDF to convert each page into separate PNG images.',
      compress: 'Upload a PDF to reduce its file size.',
    };
    return instructions[activeTab] || '';
  };

  // RENDER THE UI
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#0a0a0a',
      padding: '40px 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header Section */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ 
            fontSize: '48px', 
            fontWeight: '700', 
            color: '#ffffff', 
            marginBottom: '10px',
            letterSpacing: '-0.02em'
          }}>
            Toolkit
          </h1>
          <p style={{ color: '#888888', fontSize: '16px', fontWeight: '400' }}>
            I'm not paying for Adobe Acrobat.
          </p>
        </div>

        {/* Tab Navigation */}
        <div style={{ 
          backgroundColor: '#141414', 
          borderRadius: '12px', 
          padding: '8px', 
          marginBottom: '30px',
          border: '1px solid #222222'
        }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
            gap: '6px' 
          }}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setFiles([]); // clear files when switching tabs
                    setPdfPages([]); // clear loaded PDF pages
                    setAnnotations([]); // clear annotations
                  }}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: isActive ? '#ffffff' : 'transparent',
                    color: isActive ? '#0a0a0a' : '#888888',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                    fontWeight: isActive ? '600' : '400',
                    fontSize: '13px'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = '#1a1a1a';
                      e.currentTarget.style.color = '#ffffff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#888888';
                    }
                  }}
                >
                  <Icon size={20} />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{ 
          backgroundColor: '#141414', 
          borderRadius: '12px', 
          padding: '30px',
          border: '1px solid #222222'
        }}>
          
          {/* Instructions Box */}
          <div style={{ 
            backgroundColor: '#1a1a1a', 
            border: '1px solid #2a2a2a', 
            borderRadius: '8px', 
            padding: '12px 16px', 
            marginBottom: '25px' 
          }}>
            <p style={{ margin: 0, color: '#cccccc', fontSize: '14px' }}>
              {getInstructions()}
            </p>
          </div>

          {/* File Upload Area */}
          <div
            style={{
              border: dragActive ? '2px dashed #ffffff' : '2px dashed #333333',
              borderRadius: '12px',
              padding: '50px 20px',
              textAlign: 'center',
              backgroundColor: dragActive ? '#1a1a1a' : 'transparent',
              marginBottom: '25px',
              transition: 'all 0.2s',
              cursor: 'pointer'
            }}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload size={48} style={{ color: '#666666', margin: '0 auto 15px' }} />
            <p style={{ fontSize: '16px', color: '#cccccc', marginBottom: '10px', fontWeight: '500' }}>
              Drag & drop your {activeTab === 'image-to-pdf' ? 'images' : 'PDF files'} here
            </p>
            <p style={{ fontSize: '14px', color: '#666666', marginBottom: '15px' }}>or</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                backgroundColor: '#ffffff',
                color: '#0a0a0a',
                padding: '12px 32px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#e5e5e5';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#ffffff';
              }}
            >
              Browse Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple={activeTab === 'merge' || activeTab === 'image-to-pdf'}
              accept={activeTab === 'image-to-pdf' ? 'image/*' : 'application/pdf'}
              onChange={handleFileInput}
              style={{ display: 'none' }}
            />
          </div>

          {/* Edit & Sign PDF Editor (only show when in edit-sign mode and PDF is loaded) */}
          {activeTab === 'edit-sign' && pdfPages.length > 0 && (
            <div style={{ marginBottom: '25px' }}>
              {/* Tools Bar */}
              <div style={{ 
                backgroundColor: '#1a1a1a', 
                padding: '16px', 
                borderRadius: '8px', 
                marginBottom: '15px',
                border: '1px solid #2a2a2a',
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
                alignItems: 'center'
              }}>
                {/* Mode Buttons */}
                <button
                  onClick={() => {
                    setEditMode('select');
                    setSelectedAnnotation(null);
                  }}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '6px',
                    border: editMode === 'select' ? '1px solid #ffffff' : '1px solid #333333',
                    backgroundColor: editMode === 'select' ? '#ffffff' : 'transparent',
                    color: editMode === 'select' ? '#0a0a0a' : '#888888',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '13px',
                    transition: 'all 0.2s'
                  }}
                >
                  ⬚ Select
                </button>
                <button
                  onClick={() => {
                    setEditMode('text');
                    setSelectedAnnotation(null);
                  }}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '6px',
                    border: editMode === 'text' ? '1px solid #ffffff' : '1px solid #333333',
                    backgroundColor: editMode === 'text' ? '#ffffff' : 'transparent',
                    color: editMode === 'text' ? '#0a0a0a' : '#888888',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '13px',
                    transition: 'all 0.2s'
                  }}
                >
                  Text
                </button>
                <button
                  onClick={() => {
                    setEditMode('checkbox');
                    setSelectedAnnotation(null);
                  }}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '6px',
                    border: editMode === 'checkbox' ? '1px solid #ffffff' : '1px solid #333333',
                    backgroundColor: editMode === 'checkbox' ? '#ffffff' : 'transparent',
                    color: editMode === 'checkbox' ? '#0a0a0a' : '#888888',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '13px',
                    transition: 'all 0.2s'
                  }}
                >
                  Checkbox ✓
                </button>
                <button
                  onClick={() => {
                    const signatureText = prompt('Type your signature:');
                    if (signatureText) {
                      const canvas = document.createElement('canvas');
                      canvas.width = 200;
                      canvas.height = 50;
                      const ctx = canvas.getContext('2d');
                      ctx.fillStyle = 'white';
                      ctx.fillRect(0, 0, 200, 50);
                      ctx.font = 'italic 24px cursive';
                      ctx.fillStyle = 'black';
                      ctx.fillText(signatureText, 10, 35);
                      addSignature(canvas.toDataURL());
                    }
                  }}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '6px',
                    border: '1px solid #333333',
                    backgroundColor: 'transparent',
                    color: '#888888',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '13px',
                    transition: 'all 0.2s'
                  }}
                >
                  Signature ✍️
                </button>

                <div style={{ width: '1px', height: '30px', backgroundColor: '#333333', margin: '0 4px' }}></div>

                {/* Font Size Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '13px', color: '#888888' }}>Size:</label>
                  <select
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #333333',
                      backgroundColor: '#0a0a0a',
                      color: '#ffffff',
                      fontSize: '13px',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    <option value="8">8</option>
                    <option value="10">10</option>
                    <option value="12">12</option>
                    <option value="14">14</option>
                    <option value="16">16</option>
                    <option value="18">18</option>
                    <option value="20">20</option>
                    <option value="24">24</option>
                    <option value="28">28</option>
                    <option value="32">32</option>
                  </select>
                </div>

                {/* Color Picker */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '13px', color: '#888888' }}>Color:</label>
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    style={{
                      width: '40px',
                      height: '36px',
                      borderRadius: '6px',
                      border: '1px solid #333333',
                      backgroundColor: 'transparent',
                      cursor: 'pointer'
                    }}
                  />
                </div>

                <div style={{ width: '1px', height: '30px', backgroundColor: '#333333', margin: '0 4px' }}></div>

                {/* Undo Button */}
                <button
                  onClick={undoLastAnnotation}
                  disabled={annotations.length === 0}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '6px',
                    border: '1px solid #333333',
                    backgroundColor: 'transparent',
                    color: annotations.length === 0 ? '#444444' : '#ffffff',
                    cursor: annotations.length === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    fontSize: '13px',
                    opacity: annotations.length === 0 ? 0.5 : 1,
                    transition: 'all 0.2s'
                  }}
                >
                  ↶ Undo
                </button>

                {/* Delete Selected Button (only show when annotation is selected) */}
                {selectedAnnotation && (
                  <button
                    onClick={deleteSelectedAnnotation}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '6px',
                      border: '1px solid #333333',
                      backgroundColor: 'transparent',
                      color: '#ff4444',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '13px',
                      transition: 'all 0.2s'
                    }}
                  >
                    🗑️ Delete
                  </button>
                )}
                
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                    disabled={currentPage === 0}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      border: '1px solid #333333',
                      backgroundColor: 'transparent',
                      color: currentPage === 0 ? '#444444' : '#ffffff',
                      cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
                      opacity: currentPage === 0 ? 0.5 : 1,
                      fontSize: '13px',
                      fontWeight: '600'
                    }}
                  >
                    ← Prev
                  </button>
                  <span style={{ fontWeight: '600', color: '#ffffff', fontSize: '13px' }}>
                    {currentPage + 1} / {pdfPages.length}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(pdfPages.length - 1, currentPage + 1))}
                    disabled={currentPage === pdfPages.length - 1}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      border: '1px solid #333333',
                      backgroundColor: 'transparent',
                      color: currentPage === pdfPages.length - 1 ? '#444444' : '#ffffff',
                      cursor: currentPage === pdfPages.length - 1 ? 'not-allowed' : 'pointer',
                      opacity: currentPage === pdfPages.length - 1 ? 0.5 : 1,
                      fontSize: '13px',
                      fontWeight: '600'
                    }}
                  >
                    Next →
                  </button>
                </div>
              </div>

              {/* PDF Page Display with Click Handler */}
              <div
                style={{
                  position: 'relative',
                  border: '1px solid #333333',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: '#ffffff',
                  cursor: editMode === 'text' || editMode === 'checkbox' ? 'crosshair' : editMode === 'select' ? 'default' : 'default'
                }}
                onClick={(e) => {
                  // Only handle clicks on the PDF background, not on annotations
                  if (e.target.tagName === 'IMG' || e.target === e.currentTarget) {
                    if (editMode === 'text') {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const y = e.clientY - rect.top;
                      // Create inline text input
                      setActiveTextInput({ x, y });
                    } else if (editMode === 'checkbox') {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const y = e.clientY - rect.top;
                      addCheckbox(x, y, true);
                    } else if (editMode === 'select') {
                      // Deselect if clicking on empty space
                      setSelectedAnnotation(null);
                    }
                  }
                }}
              >
                {pdfPages[currentPage] && (
                  <div style={{ position: 'relative' }} data-pdf-container="true">
                    <img 
                      src={pdfPages[currentPage].canvas.toDataURL()} 
                      alt={`Page ${currentPage + 1}`}
                      style={{ width: '100%', display: 'block' }}
                    />
                    
                    {/* Inline Text Input */}
                    {activeTextInput && (
                      <input
                        type="text"
                        autoFocus
                        placeholder="Type here..."
                        style={{
                          position: 'absolute',
                          left: `${activeTextInput.x}px`,
                          top: `${activeTextInput.y}px`,
                          fontSize: `${fontSize}px`,
                          color: textColor,
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: '2px solid #000000',
                          padding: '4px 8px',
                          fontFamily: 'Arial, sans-serif',
                          outline: 'none',
                          minWidth: '150px',
                          zIndex: 1000
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const text = e.target.value;
                            if (text.trim()) {
                              addTextAnnotation(activeTextInput.x, activeTextInput.y, text);
                            } else {
                              setActiveTextInput(null);
                            }
                          } else if (e.key === 'Escape') {
                            setActiveTextInput(null);
                          }
                        }}
                        onBlur={(e) => {
                          const text = e.target.value;
                          if (text.trim()) {
                            addTextAnnotation(activeTextInput.x, activeTextInput.y, text);
                          } else {
                            setActiveTextInput(null);
                          }
                        }}
                      />
                    )}
                    
                    {/* Show all annotations for this page */}
                    {annotations
                      .filter(ann => ann.page === currentPage)
                      .map(ann => {
                        const isSelected = selectedAnnotation === ann.id;
                        
                        return (
                        <div
                          key={ann.id}
                          style={{
                            position: 'absolute',
                            left: `${ann.x}px`,
                            top: `${ann.y}px`,
                            pointerEvents: editMode === 'select' ? 'auto' : 'none',
                            cursor: editMode === 'select' ? (isSelected ? 'move' : 'pointer') : 'default',
                            // Show blue border if this one is selected
                            border: isSelected ? '2px solid #3b82f6' : 'none',
                            padding: isSelected ? '2px' : '0',
                            borderRadius: '4px'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            // If in select mode, select this annotation
                            if (editMode === 'select') {
                              selectAnnotation(ann.id);
                            }
                          }}
                          onMouseDown={(e) => {
                            // Start dragging if this is selected
                            if (editMode === 'select' && isSelected) {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsDragging(true);
                              
                              // Find the PDF container to calculate position
                              const container = e.currentTarget.closest('[data-pdf-container="true"]');
                              if (container) {
                                const rect = container.getBoundingClientRect();
                                setDragStart({ 
                                  x: e.clientX - rect.left - ann.x, 
                                  y: e.clientY - rect.top - ann.y 
                                });
                              }
                            }
                          }}
                        >
                          {ann.type === 'text' && (
                            <span style={{ 
                              padding: '2px 4px',
                              fontSize: `${ann.fontSize}px`,
                              fontFamily: 'Arial, sans-serif',
                              color: ann.color,
                              backgroundColor: 'rgba(255, 255, 255, 0.8)',
                              border: '1px solid rgba(0, 0, 0, 0.1)',
                              whiteSpace: 'nowrap',
                              display: 'inline-block'
                            }}>
                              {ann.text}
                            </span>
                          )}
                          {ann.type === 'checkbox' && (
                            <div style={{
                              width: '15px',
                              height: '15px',
                              border: '2px solid black',
                              backgroundColor: 'rgba(255, 255, 255, 0.8)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px'
                            }}>
                              {ann.checked && '✓'}
                            </div>
                          )}
                          {ann.type === 'signature' && (
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <img 
                                src={ann.dataUrl} 
                                alt="Signature"
                                style={{
                                  width: `${ann.width}px`,
                                  height: `${ann.height}px`,
                                  border: '1px dashed #667eea',
                                  display: 'block'
                                }}
                              />
                            </div>
                          )}
                          
                          {/* Resize handle - only show for text and signatures when selected */}
                          {/* This was hard to figure out but I got it working! */}
                          {isSelected && (ann.type === 'text' || ann.type === 'signature') && editMode === 'select' && (
                            <div
                              style={{
                                position: 'absolute',
                                right: '-6px',
                                bottom: '-6px',
                                width: '12px',
                                height: '12px',
                                backgroundColor: '#3b82f6',
                                border: '2px solid white',
                                borderRadius: '50%',
                                cursor: 'nwse-resize',
                                zIndex: 10
                              }}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsResizing(true);
                                
                                // Save starting position and size
                                setDragStart({ 
                                  x: e.clientX, 
                                  y: e.clientY,
                                  width: ann.type === 'signature' ? ann.width : 0,
                                  height: ann.type === 'signature' ? ann.height : 0,
                                  fontSize: ann.type === 'text' ? ann.fontSize : 0
                                });
                              }}
                            />
                          )}
                        </div>
                      );
                      })
                    }
                  </div>
                )}
              </div>

              {/* Annotation Count */}
              {annotations.length > 0 && (
                <div style={{ marginTop: '12px', fontSize: '13px', color: '#888888', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span>{annotations.length} annotation{annotations.length !== 1 ? 's' : ''} added</span>
                  <button
                    onClick={() => setAnnotations([])}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      border: '1px solid #333333',
                      borderRadius: '6px',
                      backgroundColor: 'transparent',
                      color: '#ff4444',
                      cursor: 'pointer',
                      fontWeight: '600',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#1a1a1a';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'transparent';
                    }}
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>
          )}

          {/* File List */}
          {files.length > 0 && !(activeTab === 'edit-sign' && pdfPages.length > 0) && (
            <div>
              <h3 style={{ 
                fontSize: '16px', 
                fontWeight: '600', 
                marginBottom: '12px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                color: '#ffffff'
              }}>
                <FileText size={18} />
                Uploaded Files ({files.length})
              </h3>
              <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '5px' }}>
                {files.map((fileObj, index) => (
                  <div
                    key={fileObj.id}
                    style={{
                      backgroundColor: '#1a1a1a',
                      borderRadius: '8px',
                      padding: '12px',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: '1px solid #2a2a2a'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                      <FileText style={{ color: '#ffffff', flexShrink: 0 }} size={20} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ 
                          margin: 0, 
                          fontWeight: '600', 
                          color: '#ffffff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: '14px'
                        }}>
                          {fileObj.name}
                        </p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#888888' }}>
                          {(fileObj.file.size / 1024).toFixed(1)} KB
                          {fileObj.rotation > 0 && ` • Rotated ${fileObj.rotation}°`}
                        </p>
                      </div>
                    </div>
                    
                    {/* File Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      {/* Show move buttons only for merge tab */}
                      {activeTab === 'merge' && (
                        <>
                          <button
                            onClick={() => moveFile(fileObj.id, 'up')}
                            disabled={index === 0}
                            style={{
                              padding: '6px 10px',
                              border: '1px solid #333333',
                              borderRadius: '6px',
                              backgroundColor: 'transparent',
                              color: index === 0 ? '#444444' : '#ffffff',
                              cursor: index === 0 ? 'not-allowed' : 'pointer',
                              opacity: index === 0 ? 0.5 : 1,
                              fontSize: '14px',
                              fontWeight: 'bold'
                            }}
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveFile(fileObj.id, 'down')}
                            disabled={index === files.length - 1}
                            style={{
                              padding: '6px 10px',
                              border: '1px solid #333333',
                              borderRadius: '6px',
                              backgroundColor: 'transparent',
                              color: index === files.length - 1 ? '#444444' : '#ffffff',
                              cursor: index === files.length - 1 ? 'not-allowed' : 'pointer',
                              opacity: index === files.length - 1 ? 0.5 : 1,
                              fontSize: '14px',
                              fontWeight: 'bold'
                            }}
                            title="Move down"
                          >
                            ↓
                          </button>
                        </>
                      )}
                      
                      {/* Show rotate button only for rotate tab */}
                      {activeTab === 'rotate' && (
                        <button
                          onClick={() => rotateFile(fileObj.id)}
                          style={{
                            padding: '6px',
                            border: '1px solid #333333',
                            borderRadius: '6px',
                            backgroundColor: 'transparent',
                            color: '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="Rotate 90°"
                        >
                          <RotateCw size={16} />
                        </button>
                      )}
                      
                      {/* Remove button (always visible) */}
                      <button
                        onClick={() => removeFile(fileObj.id)}
                        style={{
                          padding: '6px',
                          border: '1px solid #333333',
                          borderRadius: '6px',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          color: '#ff4444',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Remove file"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Process Button */}
          {files.length > 0 && (
            <div style={{ marginTop: '25px', textAlign: 'center' }}>
              <button
                onClick={processFiles}
                disabled={processing}
                style={{
                  backgroundColor: processing ? '#444444' : '#ffffff',
                  color: processing ? '#888888' : '#0a0a0a',
                  padding: '14px 40px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: processing ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!processing) {
                    e.target.style.backgroundColor = '#e5e5e5';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!processing) {
                    e.target.style.backgroundColor = '#ffffff';
                  }
                }}
              >
                <Download size={24} />
                {processing ? 'Processing...' : (
                  activeTab === 'edit-sign' ? 
                    (pdfPages.length === 0 ? 'Load PDF' : 'Save Edited PDF') : 
                    'Process Files'
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ 
          textAlign: 'center', 
          marginTop: '30px', 
          color: '#666666', 
          fontSize: '13px' 
        }}>
          <p>All processing happens in your browser. Your files never leave your device.</p>
        </div>
      </div>
    </div>
  );
}

export default App;