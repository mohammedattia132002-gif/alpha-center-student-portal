import React, { createContext, useContext, useState, useEffect } from 'react';
import { Student } from './types';

interface AuthContextType {
  student: Student | null;
  login: (student: Student) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [student, setStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const savedStudent = localStorage.getItem('alpha_student');
      if (savedStudent) {
        setStudent(JSON.parse(savedStudent));
      }
    } catch (err) {
      console.error('Failed to parse saved student:', err);
      localStorage.removeItem('alpha_student');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (student: Student) => {
    setStudent(student);
    localStorage.setItem('alpha_student', JSON.stringify(student));
  };

  const logout = () => {
    setStudent(null);
    localStorage.removeItem('alpha_student');
  };

  return (
    <AuthContext.Provider value={{ student, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
