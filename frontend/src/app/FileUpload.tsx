"use client";

import React, { useState, useRef, useCallback } from 'react';
import { useTracks } from './hooks/UseTracks';

interface FileUploadProps {
    onUploadSuccess: () => void;
}

interface UploadProgress {
    fileName: string;
    progress: number;
    status: 'pending' | 'uploading' | 'success' | 'error';
    error?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadSuccess }) => {
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { uploadBatchTracks } = useTracks();

    const validateFile = (file: File): string | null => {
        const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp4', 'audio/aac', 'audio/ogg'];
        const maxSize = 2 * 1024 * 1024 * 1024; // 2GB

        if (!allowedTypes.includes(file.type)) {
            return `File type ${file.type} is not supported`;
        }

        if (file.size > maxSize) {
            return `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds 2GB limit`;
        }

        return null;
    };

    const handleFiles = useCallback((files: FileList | File[]) => {
        const fileArray = Array.from(files);
        const validFiles: File[] = [];
        const errors: string[] = [];

        fileArray.forEach(file => {
            const error = validateFile(file);
            if (error) {
                errors.push(`${file.name}: ${error}`);
            } else {
                validFiles.push(file);
            }
        });

        if (errors.length > 0) {
            alert(`Some files were rejected:\n${errors.join('\n')}`);
        }

        if (validFiles.length > 0) {
            setSelectedFiles(validFiles);
            setUploadProgress(validFiles.map(file => ({
                fileName: file.name,
                progress: 0,
                status: 'pending'
            })));
        }
    }, []);

    const handleBatchUpload = async () => {
        if (selectedFiles.length === 0) return;

        console.log('🚀 Starting batch upload with files:', selectedFiles.map(f => f.name));
        setUploading(true);
        
        try {
            console.log('📞 Calling uploadBatchTracks...');
            const result = await uploadBatchTracks(selectedFiles);
            console.log('📥 uploadBatchTracks result:', result);
            
            if (result) {
                console.log(`✅ Batch upload completed: ${result.successful} successful, ${result.failedCount} failed`);
                
                if (result.successful > 0) {
                    onUploadSuccess();
                }
                
                if (result.failed.length > 0) {
                    alert(`Some uploads failed:\n${result.failed.map((f: { fileName: string; error: string }) => `${f.fileName}: ${f.error}`).join('\n')}`);
                }
            } else {
                console.error('❌ uploadBatchTracks returned undefined');
            }
        } catch (error) {
            console.error('❌ Error during batch upload:', error);
            alert('Batch upload failed');
        } finally {
            setUploading(false);
            setSelectedFiles([]);
            setUploadProgress([]);
        }
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            handleFiles(event.target.files);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
        setUploadProgress(prev => prev.filter((_, i) => i !== index));
    };

    const clearSelection = () => {
        setSelectedFiles([]);
        setUploadProgress([]);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors">
            {/* Drag & Drop Area */}
            <div
                className={`text-center p-8 rounded-lg transition-colors ${
                    isDragOver 
                        ? 'bg-blue-50 border-blue-400' 
                        : 'bg-gray-50 border-gray-200'
                } border-2 border-dashed`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className="mb-4">
                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
                
                <div className="text-lg font-medium text-gray-900 mb-2">
                    Drop audio files here, or{' '}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-blue-600 hover:text-blue-500 underline"
                        disabled={uploading}
                    >
                        browse
                    </button>
                </div>
                
                <p className="text-sm text-gray-500">
                    Supports MP3, WAV, FLAC, M4A, AAC, OGG (up to 2GB per file)
                </p>
                
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="audio/*"
                    onChange={handleFileSelect}
                    disabled={uploading}
                    className="hidden"
                />
            </div>

            {/* Selected Files */}
            {selectedFiles.length > 0 && (
                <div className="mt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium text-gray-900">
                            Selected Files ({selectedFiles.length})
                        </h3>
                        <div className="space-x-2">
                            <button
                                onClick={clearSelection}
                                disabled={uploading}
                                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
                            >
                                Clear All
                            </button>
                            <button
                                onClick={handleBatchUpload}
                                disabled={uploading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {uploading ? 'Uploading...' : 'Upload All'}
                            </button>
                        </div>
                    </div>
                    
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {selectedFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                                <div className="flex items-center space-x-3">
                                    <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                    </svg>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                        <p className="text-xs text-gray-500">
                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => removeFile(index)}
                                    disabled={uploading}
                                    className="text-red-500 hover:text-red-700 disabled:opacity-50"
                                >
                                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Upload Progress */}
            {uploadProgress.length > 0 && uploading && (
                <div className="mt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Progress</h3>
                    <div className="space-y-3">
                        {uploadProgress.map((item, index) => (
                            <div key={index} className="bg-gray-50 rounded-md p-3">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-medium text-gray-900">{item.fileName}</span>
                                    <span className="text-sm text-gray-500">{item.progress}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div 
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${item.progress}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FileUpload;