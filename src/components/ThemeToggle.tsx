import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../ThemeContext';
const ThemeToggle: React.FC = () => {
  const { isDarkMode, toggleDarkMode } = useTheme();
  return (
    <button onClick={toggleDarkMode} style={{
      width:38,height:38,borderRadius:12,
      background:'var(--glass2)',border:'1px solid var(--border2)',
      color:'var(--t2)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',
      backdropFilter:'blur(8px)',
    }}>
      {isDarkMode?<Sun size={16}/>:<Moon size={16}/>}
    </button>
  );
};
export default ThemeToggle;
