import { useState, useEffect, useCallback } from "react";
import Cookies from "js-cookie";

export function useFetchData(url, transform) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        if (!url) {
            setLoading(false);
            return;
        }

        // Try employee token first, then admin token
        const token = Cookies.get("employee_token") || Cookies.get("admin_token");
        if (!token) {
            console.error("No token found in cookies");
            setError("Unauthorized");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || "Unauthorized");
            }

            const result = await res.json();
            
            // Handle different response structures
            let items = [];
            if (result.fingerprints) {
                items = result.fingerprints;
            } else if (result.data) {
                items = result.data;
            } else if (Array.isArray(result)) {
                items = result;
            } else if (result.success && result.employee) {
                // Handle single employee response
                items = [result.employee];
            }
            
            const dataArray = Array.isArray(items) ? items : [];
            setData(transform ? dataArray.map(transform) : dataArray);
            setError(null);
        } catch (err) {
            console.error("Database Error:", err);
            setError(err.message);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [url, transform]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Push data - can be called with or without an item
    const pushData = useCallback(async () => {
        // Refresh the entire dataset
        setLoading(true);
        await fetchData();
    }, [fetchData]);

    const deleteData = useCallback((id, key = "employee_id") => {
        setData(prev => prev.filter(item => item[key] !== id));
    }, []);

    const updateData = useCallback((updatedItem, key = "employee_id") => {
        const newItem = transform ? transform(updatedItem) : updatedItem;
        setData(prev => prev.map(item => item[key] === newItem[key] ? newItem : item));
    }, [transform]);

    return { data, loading, error, pushData, deleteData, updateData };
}