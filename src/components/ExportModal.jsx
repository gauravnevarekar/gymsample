import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ExportModal({
  isOpen,
  onClose,
  onExport,
  title = "Export to Excel",
  isExporting = false,
  options = []
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <ExportModalContent
          onClose={onClose}
          onExport={onExport}
          title={title}
          isExporting={isExporting}
          options={options}
        />
      )}
    </AnimatePresence>
  );
}

function ExportModalContent({ onClose, onExport, title, isExporting, options }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const [selectedOption, setSelectedOption] = useState(options[0]?.value || '');

  const handleExportClick = () => {
    setError('');

    if (options.length > 0 && !selectedOption) {
      setError('Please choose what you want to export.');
      return;
    }
    
    // If one is filled but the other is not
    if ((startDate && !endDate) || (!startDate && endDate)) {
      setError('Please select both start and end dates, or leave both blank for All Time.');
      return;
    }

    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      setError('End date cannot be before start date.');
      return;
    }

    if (options.length > 0) {
      onExport(selectedOption, startDate, endDate);
      return;
    }

    onExport(startDate, endDate);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-surface-container-highest p-6 md:p-8 rounded-2xl w-full max-w-md border border-white/5 shadow-2xl relative"
      >
        <div className="absolute top-0 right-0 p-3">
          <button 
            onClick={onClose} 
            disabled={isExporting}
            className="text-zinc-500 hover:text-white p-2 flex transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <h2 className="text-xl md:text-2xl font-black headline-font italic mb-2 text-white uppercase">{title}</h2>
        <p className="text-xs text-zinc-400 mb-6 font-medium">Leave both dates blank to export ALL time records.</p>

        <div className="space-y-5">
          {options.length > 0 && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Export Type</label>
              <select
                value={selectedOption}
                onChange={(e) => setSelectedOption(e.target.value)}
                disabled={isExporting}
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all disabled:opacity-50"
              >
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Start Date</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                disabled={isExporting}
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all disabled:opacity-50" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">End Date</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                disabled={isExporting}
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all disabled:opacity-50" 
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <button 
              onClick={onClose} 
              disabled={isExporting}
              className="flex-1 py-3.5 bg-zinc-800 text-white font-bold text-sm rounded-xl hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              onClick={handleExportClick} 
              disabled={isExporting}
              className="flex-[2] flex items-center justify-center gap-2 py-3.5 bg-emerald-500 text-emerald-950 font-black uppercase tracking-widest text-sm rounded-xl hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  Exporting...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  Download
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
