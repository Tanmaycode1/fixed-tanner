import { toast } from 'react-hot-toast';
import { AxiosError } from 'axios';

export const handleApiError = (error: any) => {
  console.error('API Error:', error);
  
  if (error instanceof AxiosError) {
    // Handle network errors
    if (!error.response) {
      toast.error('Network error. Please check your connection.');
      return;
    }

    // Handle API errors with response
    const message = error.response.data?.message || error.message;
    toast.error(message);
    
    // Handle 401 unauthorized globally
    if (error.response.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
  } else {
    // Handle other errors
    toast.error('An unexpected error occurred');
  }
}; 