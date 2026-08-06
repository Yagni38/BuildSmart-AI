import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Layers, ShoppingCart, Check, Tag, ShieldCheck, Sparkles, Building2 } from 'lucide-react';
import { INITIAL_MATERIALS, MaterialItem } from '../mockData';
import { AiInsight } from '../components/AiInsight';

export const MaterialEstimator: React.FC = () => {
  const [materials, setMaterials] = useState<MaterialItem[]>(INITIAL_MATERIALS);
  const [filterCategory, setFilterCategory] = useState<'all' | 'structural' | 'finishing' | 'services'>('all');
  const [lockedList, setLockedList] = useState<string[]>([]);

  const handleToggleLock = (id: string) => {
    if (lockedList.includes(id)) {
      setLockedList(prev => prev.filter(x => x !== id));
    } else {
      setLockedList(prev => [...prev, id]);
    }
  };

  const filteredMaterials = filterCategory === 'all' 
    ? materials 
    : materials.filter(m => m.category === filterCategory);

  const totalCost = filteredMaterials.reduce((acc, m) => acc + m.cost, 0);

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-6 px-4">
      {/* Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-8 h-8 text-terracotta" /> Material Estimator
          </h1>
          <p className="text-neutral-500 font-light mt-1">
            Structural material specifications, quantities, regional wholesale vendor listings, and pre-booking index.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-xs font-semibold text-neutral-400 block uppercase">Procurement Target</span>
            <span className="text-xl font-extrabold text-neutral-900">₹{(totalCost / 100000).toFixed(2)} Lakhs</span>
          </div>
          <span className="text-xs bg-terracotta-50 text-terracotta font-semibold px-2.5 py-1 rounded border border-terracotta-100 uppercase">
            {lockedList.length} Locked
          </span>
        </div>
      </div>

      {/* Categories filter tabs */}
      <div className="flex border-b border-neutral-200 overflow-x-auto pb-0.5 gap-2 scrollbar-none">
        {['all', 'structural', 'finishing', 'services'].map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat as any)}
            className={`py-2.5 px-4 text-xs font-extrabold border-b-2 uppercase tracking-wider transition-all ${
              filterCategory === cat 
                ? "border-terracotta text-terracotta bg-terracotta-50/20" 
                : "border-transparent text-neutral-400 hover:text-neutral-900"
            }`}
          >
            {cat} Materials
          </button>
        ))}
      </div>

      {/* Materials List Table */}
      <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-neutral-100 text-neutral-400 font-semibold">
              <th className="pb-3 pr-4 font-bold text-xs uppercase">Material Name</th>
              <th className="pb-3 px-4 font-bold text-xs uppercase">Est. Quantity</th>
              <th className="pb-3 px-4 font-bold text-xs uppercase text-right">Est. Price (INR)</th>
              <th className="pb-3 px-4 font-bold text-xs uppercase">Local Supplier Shop</th>
              <th className="pb-3 px-4 font-bold text-xs uppercase">AI Purchase Optimizer</th>
              <th className="pb-3 pl-4 font-bold text-xs uppercase text-right">Pre-Book Options</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filteredMaterials.map(m => {
              const isLocked = lockedList.includes(m.id);
              return (
                <tr key={m.id} className="text-neutral-700 font-semibold hover:bg-neutral-50/40 transition-colors">
                  <td className="py-4 pr-4">
                    <div>
                      <div className="font-bold text-neutral-900 text-sm">{m.name}</div>
                      <span className="text-[10px] bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
                        {m.category}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-bold text-neutral-800">{m.quantity}</td>
                  <td className="py-4 px-4 text-right font-extrabold text-neutral-900">
                    ₹{m.cost.toLocaleString('en-IN')}
                  </td>
                  <td className="py-4 px-4 text-xs text-neutral-500 max-w-[150px] truncate">
                    {m.supplier}
                  </td>
                  <td className="py-4 px-4 text-xs max-w-[280px]">
                    <div className="flex items-start gap-1 text-neutral-500 leading-normal font-light">
                      <Sparkles className="w-3.5 h-3.5 text-terracotta flex-shrink-0 mt-0.5" />
                      <span>{m.recommendation}</span>
                    </div>
                  </td>
                  <td className="py-4 pl-4 text-right">
                    <button
                      onClick={() => handleToggleLock(m.id)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 ml-auto ${
                        isLocked 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                          : "bg-white text-neutral-700 border-neutral-200 hover:border-terracotta hover:text-terracotta"
                      }`}
                    >
                      {isLocked ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Price Locked
                        </>
                      ) : (
                        <>
                          <Tag className="w-3.5 h-3.5" /> Lock Price
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AiInsight
        insight="Bulk purchasing of OPC 53 Cement can yield a vendor cash rebate of ₹38,000 when fulfilled by regional Indiranagar supplier hubs."
        recommendation="Lock the Cement and Steel prices immediately to guard against the tariff hike. Delivery schedules will align automatically with the Project Tracker timeline."
        confidenceScore={98}
        impactValue="₹38,000 Rebate Secured"
      />
    </div>
  );
};
