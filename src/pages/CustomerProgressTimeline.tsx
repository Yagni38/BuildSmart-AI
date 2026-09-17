import React from 'react';
import {
  CheckCircle2,
  Clock,
  Circle,
  Construction,
} from 'lucide-react';

interface CustomerProgressTimelineProps {
  projectId?: string;
}

interface TimelineItem {
  name: string;
  status: 'completed' | 'in_progress' | 'pending';
  progress: number;
}

const TIMELINE: TimelineItem[] = [
  {
    name: 'Foundation',
    status: 'completed',
    progress: 100,
  },
  {
    name: 'Structure',
    status: 'in_progress',
    progress: 60,
  },
  {
    name: 'Roofing',
    status: 'pending',
    progress: 0,
  },
  {
    name: 'Electrical',
    status: 'pending',
    progress: 0,
  },
  {
    name: 'Plumbing',
    status: 'pending',
    progress: 0,
  },
  {
    name: 'Interior',
    status: 'pending',
    progress: 0,
  },
  {
    name: 'Finishing',
    status: 'pending',
    progress: 0,
  },
  {
    name: 'Completion',
    status: 'pending',
    progress: 0,
  },
];

const CustomerProgressTimeline: React.FC<
  CustomerProgressTimelineProps
> = ({ projectId }) => {
  const completed = TIMELINE.filter(
    (item) => item.status === 'completed'
  ).length;

  const current = TIMELINE.find(
    (item) => item.status === 'in_progress'
  );

  const overallProgress = Math.round(
    TIMELINE.reduce((total, item) => total + item.progress, 0) /
      TIMELINE.length
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-900 p-3 text-white">
              <Construction className="h-6 w-6" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Project Progress
              </h1>

              <p className="text-sm text-slate-500">
                {projectId
                  ? `Project ID: ${projectId}`
                  : 'Track your construction project'}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                Overall Progress
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {overallProgress}%
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                Completed Milestones
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {completed}/{TIMELINE.length}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                Current Stage
              </p>

              <p className="mt-1 text-lg font-bold text-slate-900">
                {current?.name ?? 'Not started'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold text-slate-900">
            Construction Timeline
          </h2>

          <p className="mb-8 text-sm text-slate-500">
            Follow each milestone from foundation to completion.
          </p>

          <div className="space-y-6">
            {TIMELINE.map((item, index) => {
              const isCompleted = item.status === 'completed';
              const isCurrent = item.status === 'in_progress';

              return (
                <div
                  key={item.name}
                  className="flex gap-4"
                >
                  <div className="flex flex-col items-center">
                    {isCompleted ? (
                      <CheckCircle2 className="h-7 w-7 text-green-600" />
                    ) : isCurrent ? (
                      <Clock className="h-7 w-7 text-blue-600" />
                    ) : (
                      <Circle className="h-7 w-7 text-slate-300" />
                    )}

                    {index < TIMELINE.length - 1 && (
                      <div className="mt-2 h-full min-h-12 w-px bg-slate-200" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-slate-900">
                        {item.name}
                      </h3>

                      <span className="text-sm font-medium text-slate-500">
                        {item.progress}%
                      </span>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-900 transition-all"
                        style={{
                          width: `${item.progress}%`,
                        }}
                      />
                    </div>

                    <p className="mt-2 text-xs text-slate-500">
                      {isCompleted
                        ? 'Milestone completed'
                        : isCurrent
                          ? 'Work is currently in progress'
                          : 'Not started yet'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Daily Logs
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Construction updates and photographs submitted by the
            contractor will appear here.
          </p>

          <div className="mt-5 rounded-xl bg-slate-50 p-6 text-center">
            <p className="text-sm text-slate-500">
              No daily updates available yet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerProgressTimeline;
export { CustomerProgressTimeline };