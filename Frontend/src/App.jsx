import React, { useState } from 'react';
import { FileInput, Package, User } from 'lucide-react';
import './App.css';
import { Provider } from 'react-redux';
import store from './store';
import Upload from './components/Upload';
import Invoices from './components/Invoices';
import Products from './components/Products';
import Customers from './components/Customers';

function App() {
  const [activeTab, setActiveTab] = useState('invoices');

  const tabs = [
    { id: 'invoices', name: 'Invoices', icon: FileInput },
    { id: 'products', name: 'Products', icon: Package },
    { id: 'customers', name: 'Customers', icon: User },
  ];

  return (
    <Provider store={store}>
  <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-2 sm:p-4 md:p-8">
        <div className="max-w-7xl mx-auto bg-white shadow-2xl rounded-2xl border border-blue-100 overflow-hidden">
          {/* Header */}
          <header className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 sm:p-6 border-b border-blue-800">
            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <img src="/Swipe_idOZK2iGIC_1.svg" alt="Swipe Logo" className="h-8 sm:h-10 w-auto" />
              <div className="text-center sm:text-left">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">Invoice Management System</h1>
                <p className="mt-1 text-xs sm:text-sm text-blue-100">
                  Automated data extraction and management powered by AI
                </p>
              </div>
            </div>
          </header>

          {/* Body - Sidebar + Main content */}
          <div className="flex flex-col md:flex-row">
            {/* Sidebar - Horizontal on mobile, vertical on desktop */}
            <aside className="w-full md:w-64 bg-white border-b md:border-r md:border-b-0 border-blue-100 p-2 sm:p-4">
              <nav className="flex flex-row md:flex-col space-x-2 md:space-x-0 md:space-y-2 overflow-x-auto md:overflow-x-visible">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center justify-center md:justify-start py-2 sm:py-3 px-3 sm:px-4 rounded-lg font-medium text-xs sm:text-sm transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-500/40 transform scale-105'
                        : 'text-gray-600 hover:text-blue-700 hover:bg-blue-50'
                    }`}
                  >
                    <tab.icon
                      className={`w-4 h-4 sm:w-5 sm:h-5 md:mr-3 ${
                        activeTab === tab.id ? 'text-white' : 'text-gray-400'
                      }`}
                    />
                    <span className="hidden md:inline">{tab.name}</span>
                  </button>
                ))}
              </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-3 sm:p-4 md:p-6 bg-gradient-to-b from-white to-blue-50/30 min-h-[400px]">
              <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-3 sm:p-4 md:p-6">
                <Upload />
                <div className="mt-4 sm:mt-6">
                  {activeTab === 'invoices' && <Invoices />}
                  {activeTab === 'products' && <Products />}
                  {activeTab === 'customers' && <Customers />}
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </Provider>
  );
}

export default App;
