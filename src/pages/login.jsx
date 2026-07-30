import React from 'react';
import brandIcon from "../assets/favicon.svg";
import { LogIn, LogOut, ShieldCheck } from "lucide-react";
import 'bootstrap/dist/css/bootstrap.min.css';

export default function Login() {
  const handleLogin = (provider) => {
    window.location.href = `/.auth/login/${provider}`;
  };

  return (
    <div className="container-fluid bg-light min-vh-100 d-flex align-items-center justify-content-center p-3">
      <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 w-100" style={{ maxWidth: "420px" }}>
        
        {/* Brand Header */}
        <div className="text-center mb-4">
          <img src={brandIcon} alt="" width="56" height="56" className="mb-3" />
          <h1 className="h4 fw-bold text-dark mb-1">Our Family Money</h1>
          <p className="text-muted small">Sign in to securely access your family expenses</p>
        </div>

        {/* Identity Providers */}
        <div className="d-flex flex-column gap-2 mb-4">
          <button 
            type="button" 
            onClick={() => handleLogin('aad')} 
            className="btn btn-dark d-flex align-items-center justify-content-center gap-2 py-2 fw-semibold shadow-sm"
          >
            <LogIn size={18} />
            <span>Sign in with Microsoft</span>
          </button>
          
          <button 
            type="button" 
            onClick={() => handleLogin('github')} 
            className="btn btn-outline-secondary d-flex align-items-center justify-content-center gap-2 py-2 fw-semibold bg-white text-dark"
          >
            <LogIn size={18} />
            <span>Sign in with GitHub</span>
          </button>
        </div>

      </div>
    </div>
  );
}