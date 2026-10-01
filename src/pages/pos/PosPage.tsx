import React from 'react';
import { PosView } from '../../components/pos/PosView';
import { TableFloorView } from '../../components/pos/TableFloorView';
import { OnlineOrdersView } from '../../components/pos/OnlineOrdersView';
import { BillsHistoryView } from '../../components/pos/BillsHistoryView';
import { RestaurantSettings, Shift, RestaurantTable, Order } from '../../types';

interface PosPageProps {
  subView?: 'sell' | 'tables' | 'online_orders' | 'bills';
  settings: RestaurantSettings | null;
  activeShift: Shift | null;
  onOpenTableFloor?: () => void;
  selectedTableForPos?: RestaurantTable | null;
  existingOrderForPos?: Order | null;
  onSelectTableFromFloor?: (table: RestaurantTable, existingOrder?: Order) => void;
  onOpenTransferModal?: () => void;
  onOrderUpdated?: () => void;
}

export const PosPage: React.FC<PosPageProps> = ({
  subView = 'sell',
  settings,
  activeShift,
  onOpenTableFloor,
  selectedTableForPos,
  existingOrderForPos,
  onSelectTableFromFloor,
  onOpenTransferModal,
  onOrderUpdated,
}) => {
  if (subView === 'tables') {
    return (
      <TableFloorView
        onSelectTable={onSelectTableFromFloor || (() => {})}
        onOpenTransferModal={onOpenTransferModal || (() => {})}
      />
    );
  }

  if (subView === 'online_orders') {
    return <OnlineOrdersView onOrderUpdated={onOrderUpdated} />;
  }

  if (subView === 'bills') {
    return <BillsHistoryView />;
  }

  return (
    <PosView
      settings={settings}
      activeShift={activeShift}
      onOpenTableFloor={onOpenTableFloor || (() => {})}
      selectedTableForPos={selectedTableForPos}
      existingOrderForPos={existingOrderForPos}
    />
  );
};

export { PosView, TableFloorView, OnlineOrdersView, BillsHistoryView };
