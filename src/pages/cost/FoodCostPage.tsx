import React from 'react';
import { FoodCostDashboard } from '../../components/foodcost/FoodCostDashboard';
import { IngredientsManager } from '../../components/foodcost/IngredientsManager';
import { FoodCostView } from '../../components/foodcost/FoodCostView';
import { PricingSimulatorView } from '../../components/foodcost/PricingSimulatorView';

import { NavTab } from '../../components/layout/Sidebar';

interface FoodCostPageProps {
  subView?: 'dashboard' | 'ingredients' | 'recipes' | 'pricing';
  onNavigateTab?: (tab: NavTab) => void;
}

export const FoodCostPage: React.FC<FoodCostPageProps> = ({
  subView = 'dashboard',
  onNavigateTab,
}) => {
  if (subView === 'ingredients') {
    return <IngredientsManager />;
  }

  if (subView === 'recipes') {
    return <FoodCostView />;
  }

  if (subView === 'pricing') {
    return <PricingSimulatorView />;
  }

  return <FoodCostDashboard onNavigateTab={onNavigateTab} />;
};

export { FoodCostDashboard, IngredientsManager, FoodCostView, PricingSimulatorView };
