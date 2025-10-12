import { useState, useEffect } from "react";

export function useFetchData(url, transform) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        fetch(url)
            .then(res => res.json())
            .then(result => {
                if (!isMounted) return;
                setData(transform ? result.map(transform) : result);
        })
        .catch(err => console.error("Database Error:", err))
        .finally(() => { if (isMounted) setLoading(false); });

        return () => { isMounted = false; };
    }, [url, transform]);

    // ✅ Add
    const pushData = (item) => {
        const newItem = transform ? transform(item) : item;
        setData(prev => [...prev, newItem]);
    };

    // ✅ Delete
    const deleteData = (id, key = "employee_id") => {
        setData(prev => prev.filter(item => item[key] !== id));
    };

    // ✅ Update
    const updateData = (updatedItem, key = "employee_id") => {
        setData(prev =>
            prev.map(item =>
                item[key] === updatedItem[key]
                ? (transform ? transform(updatedItem) : updatedItem)
                : item
            )
        );
    };

    return { data, loading, pushData, deleteData, updateData };
}
