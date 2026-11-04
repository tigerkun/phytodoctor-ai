/**
 * Add Plant modal — extracted from Home.tsx so any surface can open it:
 * the dashboard hero, the Quick Actions FAB, future onboarding flows.
 * Self-contained: owns its form state, photo upload and submission.
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PlantService } from '../../services/plantService';
import { GameService } from '../../services/gameService';
import { StorageService } from '../../services/storageService';
import { supabase } from '../../lib/supabase';
import type { Plant, SoilType } from '../../types';

export default function AddPlantModal({
  isOpen,
  onClose,
  onScanRedirect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onScanRedirect: () => void;
}) {
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [soilType, setSoilType] = useState<SoilType>('well-draining');
  const [potSize, setPotSize] = useState('10 inch');
  const [location, setLocation] = useState('Conservatory');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [existingPlants, setExistingPlants] = useState<Plant[]>([]);
  const [parentPlantId, setParentPlantId] = useState('');
  const [propagationMethod, setPropagationMethod] = useState<Plant['propagationMethod']>(null);

  useEffect(() => {
    if (!isOpen) return;
    // Populates the propagation parent dropdown. fetchPlants reads Supabase
    // first, so an unreachable cloud rejects — without this catch the
    // rejection is unhandled and the dropdown stays empty with nothing said.
    PlantService.fetchPlants()
      .then(setExistingPlants)
      .catch(() => { /* dropdown stays empty; manual entry still works */ });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !species.trim()) {
      setFormError('Please enter both specimen name and species.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    let uploadedPhotoUrl = '';

    try {
      if (photoFile) {
        setUploadingPhoto(true);
        const { data: { session } } = (await supabase?.auth?.getSession()) || { data: { session: null } };
        const activeUserId = session?.user?.id || GameService.getUserId();
        const cloudUrl = await StorageService.uploadPlantPhoto(photoFile, activeUserId);
        if (cloudUrl) {
          uploadedPhotoUrl = cloudUrl;
        }
      }
    } catch (err: any) {
      console.warn('Storage upload error:', err);
    } finally {
      setUploadingPhoto(false);
    }

    try {
      await PlantService.addPlant({
        name: name.trim(),
        species: species.trim(),
        soilType,
        potSize: potSize.trim(),
        location: location.trim(),
        guardianScore: 92,
        status: 'Stable',
        photoUrl: uploadedPhotoUrl,
        parentPlantId: parentPlantId || null,
        propagationMethod: parentPlantId ? propagationMethod : null,
      });
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to inscribe specimen to Supabase.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="relative w-full max-w-md rounded-2xl border border-[#c5a059]/40 bg-[#faf6ee] dark:bg-[#1a140e] p-6 shadow-2xl text-left z-10"
      >
        <div className="flex items-center justify-between mb-4 border-b border-[#dcd2c0] dark:border-[#3d2e20] pb-3">
          <div>
            <h3 className="font-serif font-black text-xl text-[#2b2118] dark:text-[#f4eee1]">
              Inscribe New Specimen
            </h3>
            <p className="text-xs text-[#725e4c] dark:text-[#b8a695] font-serif italic">
              Persisted directly to Supabase Postgres with RLS
            </p>
          </div>

          {existingPlants.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-mono uppercase tracking-wider font-bold text-[#725e4c] dark:text-[#b8a695]">
                Propagated from
                <select value={parentPlantId} onChange={e => setParentPlantId(e.target.value)} className="mt-1 w-full rounded-lg border border-[#dcd2c0] bg-white px-2 py-2 text-xs dark:bg-[#251d16]">
                  <option value="">New root specimen</option>
                  {existingPlants.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
                </select>
              </label>
              <label className="text-[11px] font-mono uppercase tracking-wider font-bold text-[#725e4c] dark:text-[#b8a695]">
                Method
                <select value={propagationMethod || ''} onChange={e => setPropagationMethod((e.target.value || null) as Plant['propagationMethod'])} disabled={!parentPlantId} className="mt-1 w-full rounded-lg border border-[#dcd2c0] bg-white px-2 py-2 text-xs disabled:opacity-50 dark:bg-[#251d16]">
                  <option value="">Choose method</option>
                  <option value="cutting">Cutting</option>
                  <option value="division">Division</option>
                  <option value="seed">Seed</option>
                  <option value="offset">Offset</option>
                </select>
              </label>
            </div>
          )}
          <button
            onClick={onClose}
            className="text-xs font-mono font-bold text-[#8c6e38] hover:text-[#2b2118] dark:hover:text-white"
          >
            ✕
          </button>
        </div>

        {formError && (
          <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-mono">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="specimen-designation-nickname" className="block text-[11px] font-mono uppercase tracking-wider font-bold text-[#725e4c] dark:text-[#b8a695] mb-1">
              Specimen Designation / Nickname
            </label>
            <input id="specimen-designation-nickname"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Empress Monstera"
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcd2c0] dark:border-[#3d2e20] bg-white dark:bg-[#251d16] text-[#2b2118] dark:text-[#f4eee1] focus:outline-none focus:ring-1 focus:ring-[#8c6e38]"
            />
          </div>

          <div>
            <label htmlFor="botanical-species" className="block text-[11px] font-mono uppercase tracking-wider font-bold text-[#725e4c] dark:text-[#b8a695] mb-1">
              Botanical Species
            </label>
            <input id="botanical-species"
              type="text"
              required
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              placeholder="e.g. Monstera deliciosa"
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcd2c0] dark:border-[#3d2e20] bg-white dark:bg-[#251d16] text-[#2b2118] dark:text-[#f4eee1] focus:outline-none focus:ring-1 focus:ring-[#8c6e38]"
            />
          </div>

          <div>
            <label htmlFor="specimen-photograph-cloud-storage" className="block text-[11px] font-mono uppercase tracking-wider font-bold text-[#725e4c] dark:text-[#b8a695] mb-1">
              Specimen Photograph (Cloud Storage)
            </label>
            <input id="specimen-photograph-cloud-storage"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setPhotoFile(f);
                  setPhotoPreview(URL.createObjectURL(f));
                }
              }}
              className="w-full text-xs text-[#725e4c] dark:text-[#b8a695] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#2e4a34] file:text-[#f4eee1] hover:file:bg-[#395c41] cursor-pointer"
            />
            {photoPreview && (
              <div className="mt-2 relative w-14 h-14 rounded-lg overflow-hidden border border-[#c5a059]/40">
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="substrate-type" className="block text-[11px] font-mono uppercase tracking-wider font-bold text-[#725e4c] dark:text-[#b8a695] mb-1">
                Substrate Type
              </label>
              <select id="substrate-type"
                value={soilType || ''}
                onChange={(e) => setSoilType(e.target.value as SoilType)}
                className="w-full px-2.5 py-2 text-xs rounded-lg border border-[#dcd2c0] dark:border-[#3d2e20] bg-white dark:bg-[#251d16] text-[#2b2118] dark:text-[#f4eee1] focus:outline-none focus:ring-1 focus:ring-[#8c6e38]"
              >
                <option value="well-draining">Well Draining</option>
                <option value="loamy">Loamy</option>
                <option value="peaty">Peaty</option>
                <option value="sandy">Sandy</option>
                <option value="clay">Clay</option>
              </select>
            </div>

            <div>
              <label htmlFor="pot-vessel" className="block text-[11px] font-mono uppercase tracking-wider font-bold text-[#725e4c] dark:text-[#b8a695] mb-1">
                Pot Vessel
              </label>
              <input id="pot-vessel"
                type="text"
                value={potSize}
                onChange={(e) => setPotSize(e.target.value)}
                placeholder="10 inch terracotta"
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcd2c0] dark:border-[#3d2e20] bg-white dark:bg-[#251d16] text-[#2b2118] dark:text-[#f4eee1] focus:outline-none focus:ring-1 focus:ring-[#8c6e38]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="sanctuary-station-room" className="block text-[11px] font-mono uppercase tracking-wider font-bold text-[#725e4c] dark:text-[#b8a695] mb-1">
              Sanctuary Station / Room
            </label>
            <input id="sanctuary-station-room"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Living Room Solarium"
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#dcd2c0] dark:border-[#3d2e20] bg-white dark:bg-[#251d16] text-[#2b2118] dark:text-[#f4eee1] focus:outline-none focus:ring-1 focus:ring-[#8c6e38]"
            />
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl font-serif font-bold text-xs uppercase tracking-wider bg-[#2e4a34] hover:bg-[#395c41] text-[#f4eee1] transition-all disabled:opacity-50"
            >
              {uploadingPhoto ? 'Uplinking photo to vault...' : submitting ? 'Inscribing to Supabase...' : 'Save Specimen to Cloud'}
            </button>

            <button
              type="button"
              onClick={onScanRedirect}
              className="w-full py-2 text-[11px] font-mono font-semibold text-[#8c6e38] hover:underline text-center"
            >
              Or capture & diagnose via Wet Lab Camera →
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
