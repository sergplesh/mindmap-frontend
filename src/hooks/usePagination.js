import { useCallback, useEffect, useMemo, useState } from 'react';

export const usePagination = (items, pageSize = 3) => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil((items?.length || 0) / pageSize));

  useEffect(() => {
    setCurrentPage((prevPage) => Math.min(prevPage, totalPages));
  }, [totalPages]);

  const pageItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return (items || []).slice(startIndex, startIndex + pageSize);
  }, [currentPage, items, pageSize]);

  const reset = useCallback(() => setCurrentPage(1), []);
  const goNext = useCallback(() => {
    setCurrentPage((prevPage) => Math.min(prevPage + 1, totalPages));
  }, [totalPages]);
  const goPrev = useCallback(() => {
    setCurrentPage((prevPage) => Math.max(prevPage - 1, 1));
  }, []);

  return {
    currentPage,
    totalPages,
    pageItems,
    pageSize,
    setCurrentPage,
    reset,
    goNext,
    goPrev
  };
};
