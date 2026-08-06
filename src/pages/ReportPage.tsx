import React from 'react';
import { motion } from 'framer-motion';
import { FileText, FileDown, ShieldCheck, Clock, DownloadCloud } from 'lucide-react';
import { AiInsight } from '../components/AiInsight';

export const ReportPage: React.FC = () => {
  const reports = [
    { name: "Initial Cost Quotation Packet", desc: "Consolidated cost parameters, contractor margins, and contingency reserves blueprint.", date: "Aug 02, 2026", size: "1.8 MB", type: "PDF" },
    { name: "Material Procurement Audit List", desc: "Detailed bill of quantities for concrete, Fe 550 steel, AAC blocks, and finishing textures.", date: "Aug 05, 2026", size: "840 KB", type: "CSV" },
    { name: "Tax Invoice & Payments Ledger", desc: "Consolidated record of contractor milestone payouts, structural approvals, and GST receipts.", date: "Aug 06, 2026", size: "2.4 MB", type: "PDF" },
    { name: "Weekly Construction Progress Audit", desc: "Pillar casting logs, excavation compliance certificates, and structural engineer signs.", date: "Aug 06, 2026", size: "4.2 MB", type: "PDF" }
  ];

  const handleDownload = (name: string) => {
    alert(`Downloading ${name} directly to your downloads directory...`);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-6 px-4">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Reports & Compliance</h1>
        <p className="text-neutral-500 font-light mt-1">
          Download certified PDF receipts, contractor quotations, structural reports, and regional tax compliance declarations.
        </p>
      </div>

      {/* Reports Grid */}
      <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-4">
        <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Compliance Documents</span>
        
        <div className="divide-y divide-neutral-100">
          {reports.map((rep, idx) => (
            <div key={idx} className="py-4 flex flex-wrap items-center justify-between gap-4 font-semibold text-neutral-800">
              <div className="flex items-start gap-3 max-w-[75%]">
                <div className="w-10 h-10 rounded-xl bg-neutral-50 border border-neutral-100 text-terracotta flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-950">{rep.name}</h3>
                  <p className="text-xs text-neutral-400 font-light leading-relaxed mt-0.5">{rep.desc}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-neutral-400 font-medium">
                    <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> Updated: {rep.date}</span>
                    <span>•</span>
                    <span>Format: {rep.type}</span>
                    <span>•</span>
                    <span>Size: {rep.size}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDownload(rep.name)}
                className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
              >
                <DownloadCloud className="w-4 h-4" /> Download
              </button>
            </div>
          ))}
        </div>
      </div>

      <AiInsight
        insight="All structural updates are digitally stamped and verified under national real estate safety codes."
        recommendation="Download the Weekly Construction Progress Audit to submit to bank officials for next milestone loan disbursement."
        confidenceScore={99}
        impactValue="100% Tax Compliant"
      />
    </div>
  );
};
