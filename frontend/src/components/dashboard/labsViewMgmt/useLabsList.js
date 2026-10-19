import { useCallback, useEffect, useState } from 'react';
import { listManagedLabs, getBugCounts } from './labsApi.js';

// The list of labs the user can manage: first load, search, pages and the pending-bug badges.
export function useLabsList(token) {
    const [labSearch, setLabSearch] = useState('');
    // The search that was actually run (what is typed in the box only counts after pressing Buscar)
    const [activeSearch, setActiveSearch] = useState('');
    const [isSearchMode, setIsSearchMode] = useState(false);
    const [labs, setLabs] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [listError, setListError] = useState('');
    const [bugCounts, setBugCounts] = useState({});

    const fetchBugCounts = useCallback(async (labIds) => {
        if (labIds.length === 0) {
            setBugCounts({});
            return;
        }

        try {
            const { ok, data } = await getBugCounts(token, labIds);
            setBugCounts(ok ? data.counts || {} : {});
        } catch {
            setBugCounts({});
        }
    }, [token]);

    const fetchLabs = useCallback(async (search, page) => {
        setIsLoading(true);
        setListError('');

        try {
            const { ok, data } = await listManagedLabs(token, search, page);

            if (!ok) {
                setListError(data.message || 'No se pudieron cargar los laboratorios.');
                setLabs([]);
                return;
            }

            const fetchedLabs = data.labs || [];
            setLabs(fetchedLabs);
            setTotalPages(data.totalPages || 1);
            fetchBugCounts(fetchedLabs.map((lab) => lab.labid));
        } catch {
            setListError('No se pudo conectar con el servidor.');
            setLabs([]);
        } finally {
            setIsLoading(false);
        }
    }, [token, fetchBugCounts]);

    // Carga inicial: los 5 laboratorios más recientes.
    useEffect(() => {
        fetchLabs('', 1);
    }, [fetchLabs]);

    const changeSearchText = (text) => setLabSearch(text.slice(0, 100));

    const runSearch = () => {
        const query = labSearch.trim();
        if (!query) return;

        setIsSearchMode(true);
        setActiveSearch(query);
        setCurrentPage(1);
        fetchLabs(query, 1);
    };

    const goToPage = (page) => {
        setCurrentPage(page);
        fetchLabs(activeSearch, page);
    };

    // Loads the current page again (after saving or deleting a lab)
    const reload = () => fetchLabs(activeSearch, currentPage);

    const setBugCount = (labid, pending) => setBugCounts((prev) => ({ ...prev, [labid]: pending }));

    return {
        labSearch,
        changeSearchText,
        runSearch,
        isSearchMode,
        labs,
        currentPage,
        totalPages,
        goToPage,
        isLoading,
        listError,
        bugCounts,
        setBugCount,
        reload,
    };
}
