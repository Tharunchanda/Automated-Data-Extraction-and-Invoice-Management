import React from 'react';
import { useState } from 'react';
import { FileInput, Package, User } from 'lucide-react';
import './App.css';
import { Provider } from 'react-redux';
import store from './store';
import Upload from './components/Upload';
import Invoices from './components/Invoices';
import Products from './components/Products';
import Customers from './components/Customers';

/**
 * Main application component
 */
function App() {
    // State to keep track of the active tab
    const [activeTab, setActiveTab] = useState('invoices');

    const tabs = [
        { id: 'invoices', name: 'Invoices', icon: FileInput },
        { id: 'products', name: 'Products', icon: Package },
        { id: 'customers', name: 'Customers', icon: User },
    ];

    return (
        <Provider store={store}>
            <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
            <div className="max-w-7xl mx-auto bg-white shadow-xl rounded-lg border border-gray-200 overflow-hidden">
                {/* Header */}
                <header className="p-6 border-b border-gray-200">
                    <h1 className="text-3xl font-bold text-gray-900">Swipe Invoice Management</h1>
                    <p className="mt-1 text-sm text-gray-500">Automated data extraction and management</p>
                </header>

                <div className="p-6">
                    {/* Tabs Navigation */}
                    <div className="mb-6">
                        <div className="border-b border-gray-200">
                            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                            activeTab === tab.id
                                                ? 'border-blue-600 text-blue-700'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }`}
                                    >
                                        <tab.icon 
                                            className={`w-5 h-5 mr-2 ${activeTab === tab.id ? 'text-blue-600' : 'text-gray-400'}`} 
                                        />
                                        {tab.name}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </div>

                    {/* Tab Content Placeholder */}
                    <main className="min-h-[300px] p-4">
                        <Upload />
                        {activeTab === 'invoices' && <Invoices />}
                        {activeTab === 'products' && <Products />}
                        {activeTab === 'customers' && <Customers />}
                    </main>
                </div>
            </div>
        </div>
        </Provider>
    );
}

export default App;
