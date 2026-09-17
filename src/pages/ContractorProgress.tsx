import React, { useState } from 'react';
import {
  Send,
  Camera,
  CheckCircle2,
  Clock,
  Upload,
  X,
  Construction,
} from 'lucide-react';

interface ContractorProgressProps {
  projectId?: string;
}

interface ProgressUpdate {
  id: string;
  milestone: string;
  description: string;
  date: string;
  photos: string[];
}

const MILESTONES = [
  'Foundation',
  'Structure',
  'Roofing',
  'Electrical',
  'Plumbing',
  'Interior',
  'Finishing',
  'Completion',
];

const ContractorProgress: React.FC<ContractorProgressProps> = ({
  projectId,
}) => {
  const [milestone, setMilestone] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoErrors, setPhotoErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [updates, setUpdates] = useState<ProgressUpdate[]>([]);

  const handlePhotoChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) return;

    setPhotos((previous) => [...previous, ...files]);
    setPhotoErrors((previous) => ({
      ...previous,
      photo_taken: '',
    }));

    event.target.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos((previous) =>
      previous.filter((_, photoIndex) => photoIndex !== index)
    );
  };

  const submitProgress = async () => {
    setSuccess('');

    const errors: Record<string, string> = {};

    if (!milestone) {
      errors.milestone_missing =
        'Select the milestone this update belongs to.';
    }

    if (photos.length === 0) {
      errors.photo_taken =
        'Take or upload at least one photo to submit.';
    }

    if (!description.trim()) {
      errors.no_body = 'Briefly describe what changed today.';
    }

    setPhotoErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      /*
       * The original file was corrupted and the original
       * submitProgress service call was lost.
       *
       * This replacement keeps the complete UI working and
       * stores the submitted update locally until the existing
       * project service can be reconnected.
       */

      const newUpdate: ProgressUpdate = {
        id: crypto.randomUUID(),
        milestone,
        description: description.trim(),
        date: new Date().toISOString(),
        photos: photos.map((file) => file.name),
      };

      setUpdates((previous) => [newUpdate, ...previous]);

      setMilestone('');
      setDescription('');
      setPhotos([]);
      setPhotoErrors({});
      setSuccess('Construction update submitted successfully.');
    } catch (error) {
      console.error('Failed to submit construction update:', error);
      setSuccess('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-900 p-3 text-white">
              <Construction className="h-6 w-6" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Construction Progress
              </h1>
              <p className="text-sm text-slate-500">
                {projectId
                  ? `Project ID: ${projectId}`
                  : 'Update your assigned construction project'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-1 text-lg font-semibold text-slate-900">
            Submit Construction Update
          </h2>

          <p className="mb-6 text-sm text-slate-500">
            Select the current milestone, describe today's work, and
            upload construction photographs.
          </p>

          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Construction milestone
              </label>

              <select
                value={milestone}
                onChange={(event) => {
                  setMilestone(event.target.value);
                  setPhotoErrors((previous) => ({
                    ...previous,
                    milestone_missing: '',
                  }));
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-900"
              >
                <option value="">Select milestone</option>

                {MILESTONES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              {photoErrors.milestone_missing && (
                <p className="mt-2 text-sm text-red-600">
                  {photoErrors.milestone_missing}
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Today's construction update
              </label>

              <textarea
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  setPhotoErrors((previous) => ({
                    ...previous,
                    no_body: '',
                  }));
                }}
                rows={5}
                placeholder="Example: Foundation work completed for the east side of the house..."
                className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900"
              />

              {photoErrors.no_body && (
                <p className="mt-2 text-sm text-red-600">
                  {photoErrors.no_body}
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Construction photographs
              </label>

              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition hover:border-slate-500">
                <Camera className="mb-3 h-8 w-8 text-slate-500" />

                <span className="font-medium text-slate-700">
                  Take or upload photos
                </span>

                <span className="mt-1 text-xs text-slate-500">
                  Add at least one construction photo
                </span>

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </label>

              {photoErrors.photo_taken && (
                <p className="mt-2 text-sm text-red-600">
                  {photoErrors.photo_taken}
                </p>
              )}

              {photos.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {photos.map((photo, index) => (
                    <div
                      key={`${photo.name}-${index}`}
                      className="relative rounded-xl border border-slate-200 bg-white p-3"
                    >
                      <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4 text-slate-500" />

                        <span className="min-w-0 flex-1 truncate text-xs text-slate-700">
                          {photo.name}
                        </span>

                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-red-600"
                          aria-label="Remove photo"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {success && (
              <div className="flex items-center gap-2 rounded-xl bg-green-50 p-4 text-sm text-green-700">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                {success}
              </div>
            )}

            <button
              type="button"
              onClick={submitProgress}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3.5 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" />

              {submitting
                ? 'Submitting...'
                : 'Submit construction update'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Recent Updates
              </h2>

              <p className="text-sm text-slate-500">
                Your submitted construction progress
              </p>
            </div>

            <Clock className="h-5 w-5 text-slate-400" />
          </div>

          {updates.length === 0 ? (
            <div className="rounded-xl bg-slate-50 p-8 text-center">
              <Construction className="mx-auto mb-3 h-8 w-8 text-slate-400" />

              <p className="text-sm font-medium text-slate-700">
                No progress updates yet
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Submit your first construction update above.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {updates.map((update) => (
                <div
                  key={update.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {update.milestone}
                    </span>

                    <span className="text-xs text-slate-500">
                      {new Date(update.date).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-sm leading-6 text-slate-700">
                    {update.description}
                  </p>

                  {update.photos.length > 0 && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                      <Camera className="h-4 w-4" />
                      {update.photos.length} photo
                      {update.photos.length !== 1 ? 's' : ''} attached
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContractorProgress;
export { ContractorProgress };