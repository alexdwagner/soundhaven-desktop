export const clipboard = {
  async copy(text: string): Promise<boolean> {
    try {
      // Modern browsers with Clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Fallback for older browsers or insecure contexts
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
      }
    } catch (error) {
      console.warn('📱 [Clipboard] Copy not supported in this environment:', error);
      return false;
    }
  },

  async read(): Promise<string | null> {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        return await navigator.clipboard.readText();
      } else {
        console.warn('📱 [Clipboard] Read not supported in this environment');
        return null;
      }
    } catch (error) {
      console.warn('📱 [Clipboard] Read failed:', error);
      return null;
    }
  }
}; 