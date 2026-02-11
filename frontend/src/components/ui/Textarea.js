import React from 'react';
import './Textarea.css';

export default function Textarea({ className = '', ...props }) {
  return (
    <textarea className={`textarea ${className}`} {...props} />
  );
}
