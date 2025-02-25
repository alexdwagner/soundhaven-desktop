"use client";

import React, { useState } from 'react';
import { useTracks } from './hooks/UseTracks';
import { Track } from '../../types/types';

interface FileUploadProps {
    onUploadSuccess: () => void;
}

    const FileUpload: React.FC<FileUploadProps> = ({ onUploadSuccess }) => {
        const [uploading, setUploading] = useState(false);
    const { uploadTrack } = useTracks(); // Use the `useTracks` hook

    const extractTitleFromFileName = (fileName: string) => {
        // Remove file extension and replace underscores/dashes with spaces
        return fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    };

    const handleFileUpload = async (file: File) => {
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', extractTitleFromFileName(file.name));

        try {
            const success = await uploadTrack(formData); // Use the uploadTrack function from the hook
            if (success) {
                console.log('Track uploaded successfully');
                onUploadSuccess();
                // Optionally, refetch tracks to update the list
            } else {
                console.error('Track upload failed with no error thrown');
            }
        } catch (error) {
            console.error('Error during file upload:', error);
        } finally {
            setUploading(false);
        }
    };

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            const selectedFile = event.target.files[0];
            await handleFileUpload(selectedFile);
        }
    };


    return (
        <div className='p-4 mt-4 bg-gray-100 rounded-lg'>
            <div style={{ display: 'inline-block', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <input type="file" onChange={handleFileSelect} disabled={uploading} style={{ width: '100%', opacity: 0, position: 'absolute', cursor: 'pointer' }} />
                <label htmlFor="fileInput" style={{ cursor: 'pointer' }}>
                    <button disabled={uploading} style={{ pointerEvents: 'none', backgroundColor: 'lightblue', border: '1px solid #ccc', padding: '5px 10px', borderRadius: '5px' }}>
                        Upload File
                    </button>
                </label>
            </div>
        </div>
    );       
};

export default FileUpload;