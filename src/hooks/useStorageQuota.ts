import { useState, useEffect } from 'react';
import { checkStorageEstimate } from '../utils/storage';

export function useStorageQuota() {
  const [quotaInfo, setQuotaInfo] = useState({
    usageMb: 0,
    quotaMb: 0,
    percentUsed: 0,
  });

  const check = async () => {
    const est = await checkStorageEstimate();
    setQuotaInfo(est);
  };

  useEffect(() => {
    check();
  }, []);

  return { ...quotaInfo, refreshQuota: check };
}
