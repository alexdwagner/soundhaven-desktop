import React, { createContext, useState, useContext, FunctionComponent } from 'react';
// import { CommentsContextType, Comment } from './types'; // Adjust the import path as needed

// Initialize the context with a default undefined value or an initial state
const CommentsContext = createContext<any>(undefined);

export default CommentsContext;