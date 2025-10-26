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
  <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 sm:p-8">
        <div className="max-w-7xl mx-auto bg-white shadow-2xl rounded-2xl border border-blue-100 overflow-hidden">
          {/* Header */}
          <header className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 border-b border-blue-800">
            <div className="flex items-center space-x-4">
              <img src="/Swipe_idOZK2iGIC_1.svg" alt="Swipe Logo" className="h-10 w-auto" />
              <div>
                <h1 className="text-3xl font-bold text-white">Invoice Management System</h1>
                <p className="mt-1 text-sm text-blue-100">
                  Automated data extraction and management powered by AI
                </p>
              </div>
            </div>
          </header>

          {/* Body - Sidebar + Main content */}
          <div className="flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-blue-100 p-4 space-y-2">
              <nav className="flex flex-col space-y-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center justify-start py-3 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-500/40 transform scale-105'
                        : 'text-gray-600 hover:text-blue-700 hover:bg-blue-50'
                    }`}
                  >
                    <tab.icon
                      className={`w-5 h-5 mr-3 ${
                        activeTab === tab.id ? 'text-white' : 'text-gray-400'
                      }`}
                    />
                    {tab.name}
                  </button>
                ))}
              </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 bg-gradient-to-b from-white to-blue-50/30 min-h-[400px]">
              <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-6">
                <Upload />
                <div className="mt-6">
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
