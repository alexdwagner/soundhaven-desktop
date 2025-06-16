const fs = require('fs');
const path = require('path');

// Files that need to be updated with their import replacements
const filesToUpdate = [
  {
    path: path.join(__dirname, 'frontend', 'src', 'app', 'providers', 'TracksProvider.tsx'),
    from: [
      'import { handleResponse } from "../services/apiService";',
      'import { backendUrl } from "../services/apiService";'
    ],
    to: 'import { apiService } from "@/services/electronApiService";'
  },
  {
    path: path.join(__dirname, 'frontend', 'src', 'app', 'hooks', 'UseValidateToken.ts'),
    from: 'import { validateToken } from \'@/services/apiService\';',
    to: 'import { apiService } from \'@/services/electronApiService\';'
  },
  {
    path: path.join(__dirname, 'frontend', 'src', 'app', 'providers', 'CommentsProvider.tsx'),
    from: 'import { backendUrl } from "../services/apiService";',
    to: 'import { apiService } from "@/services/electronApiService";'
  },
  {
    path: path.join(__dirname, 'frontend', 'src', 'app', 'providers', 'PlaylistsProvider.tsx'),
    from: [
      'import { handleResponse } from "../services/apiService";',
      'import { backendUrl } from "../services/apiService";'
    ],
    to: 'import { apiService } from "@/services/electronApiService";'
  },
  {
    path: path.join(__dirname, 'frontend', 'src', 'app', 'components', 'auth', 'RegisterForm.tsx'),
    from: 'import { register as registerUser } from \'../../services/apiService\';',
    to: 'import { apiService } from \'@/services/electronApiService\';'
  },
  {
    path: path.join(__dirname, 'frontend', 'src', 'app', 'components', 'auth', 'LoginForm.tsx'),
    from: 'import { login as loginService } from \'../../services/apiService\';',
    to: 'import { apiService } from \'@/services/electronApiService\';'
  }
];

// Update each file
filesToUpdate.forEach(({ path: filePath, from, to }) => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Convert single string to array for uniform handling
    const fromArray = Array.isArray(from) ? from : [from];
    
    // Replace each 'from' pattern with 'to'
    fromArray.forEach((fromStr) => {
      content = content.replace(fromStr, '');
    });
    
    // Add the new import if it doesn't exist
    if (!content.includes(to)) {
      const lines = content.split('\n');
      const lastImportIndex = lines.findLastIndex(line => line.startsWith('import'));
      
      if (lastImportIndex !== -1) {
        lines.splice(lastImportIndex + 1, 0, to);
      } else {
        // If no imports, add at the top after any potential shebang
        const firstNonImport = lines.findIndex(line => !line.startsWith('import'));
        lines.splice(firstNonImport, 0, to);
      }
      
      content = lines.join('\n');
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated imports in ${filePath}`);
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error);
  }
});

// Now update the code to use the new apiService methods
const filesToUpdateUsage = [
  {
    path: path.join(__dirname, 'frontend', 'src', 'app', 'providers', 'TracksProvider.tsx'),
    replacements: [
      { from: 'handleResponse\(', to: 'apiService.' },
      { from: 'backendUrl', to: 'apiService.backendUrl' }
    ]
  },
  {
    path: path.join(__dirname, 'frontend', 'src', 'app', 'hooks', 'UseValidateToken.ts'),
    replacements: [
      { from: 'validateToken', to: 'apiService.validateToken' }
    ]
  },
  {
    path: path.join(__dirname, 'frontend', 'src', 'app', 'providers', 'CommentsProvider.tsx'),
    replacements: [
      { from: 'backendUrl', to: 'apiService.backendUrl' }
    ]
  },
  {
    path: path.join(__dirname, 'frontend', 'src', 'app', 'providers', 'PlaylistsProvider.tsx'),
    replacements: [
      { from: 'handleResponse\(', to: 'apiService.' },
      { from: 'backendUrl', to: 'apiService.backendUrl' }
    ]
  },
  {
    path: path.join(__dirname, 'frontend', 'src', 'app', 'components', 'auth', 'RegisterForm.tsx'),
    replacements: [
      { from: 'registerUser\\s*\\(', to: 'apiService.register(' },
      { from: 'registerUser\\s*\\(', to: 'apiService.register(' }
    ]
  },
  {
    path: path.join(__dirname, 'frontend', 'src', 'app', 'components', 'auth', 'LoginForm.tsx'),
    replacements: [
      { from: 'loginService\\s*\\(', to: 'apiService.login(' }
    ]
  }
];

// Update method calls in each file
filesToUpdateUsage.forEach(({ path: filePath, replacements }) => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    replacements.forEach(({ from, to }) => {
      const regex = new RegExp(from, 'g');
      content = content.replace(regex, to);
    });
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated method calls in ${filePath}`);
  } catch (error) {
    console.error(`Error updating method calls in ${filePath}:`, error);
  }
});

console.log('Import and method call updates complete!');
