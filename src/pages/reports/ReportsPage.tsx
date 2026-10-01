import React from 'react';
import { ReportsView } from '../../components/reports/ReportsView';
import { ExpensesView } from '../../components/expenses/ExpensesView';
import { ShiftsView } from '../../components/shifts/ShiftsView';
import { Shift } from '../../types';

interface ReportsPageProps {
  subView?: 'reports' | 'expenses' | 'shifts';
  activeShift?: Shift | null;
  onOpenShiftModal?: () => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  subView = 'reports',
  activeShift = null,
  onOpenShiftModal,
}) => {
  if (subView === 'expenses') {
    return <ExpensesView />;
  }

  if (subView === 'shifts') {
    return <ShiftsView activeShift={activeShift} onOpenShiftModal={onOpenShiftModal || (() => {})} />;
  }

  return <ReportsView />;
};

export { ReportsView, ExpensesView, ShiftsView };
