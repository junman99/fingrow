import React, { forwardRef, useImperativeHandle } from 'react';
import { Alert } from 'react-native';
import { useInvestStore } from '../../store/invest';

export type DeletePortfolioSheetRef = {
  showDeleteSheet: (args: { id: string; name?: string }) => void;
  show: (args: { id: string; name?: string }) => void;
};

const DeletePortfolioSheet = forwardRef<DeletePortfolioSheetRef>((_, ref) => {
  const getState = useInvestStore.getState;

  const openConfirm = ({ id, name }: { id: string; name?: string }) => {
    const title = 'Delete portfolio?';
    const message =
      (name ? `“${name}” ` : '') +
      'This action will remove the portfolio and its lots from FinGrow. This cannot be undone.';

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const s: any = getState();
          if (s.activePortfolioId === id) {
            const others = (s.portfolios ?? []).map((p: any) => p.id).filter((pid: string) => pid !== id);
            if (others.length > 0 && typeof s.setActivePortfolio === 'function') {
              s.setActivePortfolio(others[0]);
            } else if (typeof s.setActivePortfolio === 'function') {
              s.setActivePortfolio(null);
            }
          }
          if (typeof s.deletePortfolio === 'function') {
            s.deletePortfolio(id);
          } else if (typeof s.removePortfolio === 'function') {
            s.removePortfolio(id);
          }
        },
      },
    ]);
  };

  useImperativeHandle(ref, () => ({
    showDeleteSheet: openConfirm,
    show: openConfirm,
  }));

  return null;
});

export default DeletePortfolioSheet;
