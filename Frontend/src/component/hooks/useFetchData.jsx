import { useState, useEffect } from "react";

export function useFetchData(url, transform) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        if (!url) return;
        fetch(url)
            .then(res => res.json())
            .then(result => {
                if (!isMounted) return;

                // ✅ Make sure result.data exists and is an array
                const items = Array.isArray(result.data) ? result.data : [];
                setData(transform ? items.map(transform) : items);
            })
            .catch(err => {
                console.error("Database Error:", err)
                setData([])
            })
            .finally(() => { if (isMounted) setLoading(false); });

        return () => { isMounted = false; };
    }, [url, transform]);

    // ✅ Add new item
    const pushData = (item) => {
        const newItem = transform ? transform(item) : item;
        setData(prev => [...prev, newItem]);
    };

    // ✅ Delete item by key
    const deleteData = (id, key = "employee_id") => {
        setData(prev => prev.filter(item => item[key] !== id));
    };

    // ✅ Update item by key
    const updateData = (updatedItem, key = "employee_id") => {
        const newItem = transform ? transform(updatedItem) : updatedItem;
        setData(prev => prev.map(item => item[key] === newItem[key] ? newItem : item));
    };

    return { data, loading, pushData, deleteData, updateData };
}
